import { writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { Agent, fetch as uFetch } from 'undici';
import { parseTCMB } from './parse-tcmb.js';

// undici agent to bypass truncgil's self-signed SSL certificate
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

// Parses Turkish number format: "45.823,50" → 45823.50
function parseTR(str) {
  if (!str || str === '') return NaN;
  return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

async function fetchTruncgil() {
  const url = 'https://finans.truncgil.com/today.json';
  try {
    const res = await uFetch(url, { dispatcher: insecureAgent });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('truncgil error:', err.message);
    return null;
  }
}

async function fetchFawaz() {
  const url = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/try.json';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'currency-api-tr/1.0' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('fawaz error:', err.message);
    return null;
  }
}

async function fetchBigpara() {
  const url = 'https://api.bigpara.hurriyet.com.tr/doviz/headerlist/anasayfa';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'currency-api-tr/1.0' },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('bigpara unavailable (optional):', err.message);
    return null;
  }
}

// Sanity check: warn if bigpara USD deviates >5% from TCMB
function validateWithBigpara(bigparaData, tcmbRates) {
  if (!bigparaData || !tcmbRates?.USD) return;
  try {
    const items = bigparaData?.data?.items || bigparaData?.items || [];
    const usdItem = items.find(i => i.code === 'USD' || i.sembol === 'USD');
    if (!usdItem) return;

    const bpBid = parseFloat(usdItem.alis || usdItem.bid || '0');
    const tcmbBid = tcmbRates.USD.bid;

    if (bpBid > 0 && tcmbBid > 0) {
      const diff = Math.abs(bpBid - tcmbBid) / tcmbBid;
      if (diff > 0.05) {
        console.warn(`[warn] USD bigpara/TCMB deviation ${(diff * 100).toFixed(1)}% — bigpara: ${bpBid}, TCMB: ${tcmbBid}`);
      }
    }
  } catch (err) {
    console.warn('bigpara validation error:', err.message);
  }
}

// TCMB currency code → try object key
const TCMB_KEY_MAP = {
  USD: 'usd', EUR: 'eur', GBP: 'gbp', CHF: 'chf', JPY: 'jpy',
  SAR: 'sar', AED: 'aed', AZN: 'azn', CNY: 'cny', KZT: 'kzt',
  KRW: 'krw', QAR: 'qar', RUB: 'rub', CAD: 'cad', AUD: 'aud',
  SEK: 'sek', NOK: 'nok', DKK: 'dkk', RON: 'ron', PKR: 'pkr',
  KWD: 'kwd', XDR: 'xdr'
};

// truncgil gold key → output key
const GOLD_KEY_MAP = {
  'gram-altin':      'xau_gram',
  'ceyrek-altin':    'xau_ceyrek',
  'yarim-altin':     'xau_yarim',
  'tam-altin':       'xau_tam',
  'cumhuriyet-altini': 'xau_cumhuriyet'
};

async function main() {
  console.log('Fetching exchange rates...');

  const [tcmbRates, truncgilData, fawazData, bigparaData] = await Promise.all([
    parseTCMB(),
    fetchTruncgil(),
    fetchFawaz(),
    fetchBigpara()
  ]);

  if (!tcmbRates && !truncgilData) {
    console.error('All primary sources failed — JSON not updated');
    process.exit(0);
  }

  validateWithBigpara(bigparaData, tcmbRates);

  const sources = [];
  const tryObj = {};

  // 1. TCMB official forex rates (bid/ask)
  if (tcmbRates) {
    sources.push('tcmb');
    for (const [tcmbCode, key] of Object.entries(TCMB_KEY_MAP)) {
      if (tcmbRates[tcmbCode]) {
        tryObj[key] = tcmbRates[tcmbCode];
      }
    }
    console.log(`TCMB: ${Object.keys(tcmbRates).length} currencies fetched`);
  }

  // 2. truncgil gold prices (primary gold source)
  let truncgilOk = false;
  if (truncgilData) {
    truncgilOk = true;
    sources.push('truncgil');
    for (const [truncKey, outKey] of Object.entries(GOLD_KEY_MAP)) {
      const entry = truncgilData[truncKey];
      if (!entry) continue;

      const bid = parseTR(entry['Alış']);
      const ask = parseTR(entry['Satış']);

      if (!isNaN(bid) && !isNaN(ask)) {
        tryObj[outKey] = { bid, ask };
      }
    }
    console.log('truncgil: gold prices fetched');
  }

  // 3. fawaz — UZS, HUF, XAG (silver), XPT (platinum)
  //    These are not available from TCMB or truncgil.
  if (fawazData?.try) {
    sources.push('fawaz');
    const ft = fawazData.try;

    // UZS — Uzbekistani som
    if (ft.uzs && ft.uzs > 0) {
      const uzsRate = 1 / ft.uzs;
      tryObj['uzs'] = { bid: parseFloat(uzsRate.toFixed(6)), ask: parseFloat(uzsRate.toFixed(6)) };
    }

    // XAG — silver gram (troy oz → gram: 1 troy oz = 31.1035 g)
    if (ft.xag && ft.xag > 0) {
      const xagGramTRY = (1 / ft.xag) / 31.1035;
      tryObj['xag_gram'] = {
        bid: parseFloat(xagGramTRY.toFixed(4)),
        ask: parseFloat(xagGramTRY.toFixed(4))
      };
    }

    // XPT — platinum gram
    if (ft.xpt && ft.xpt > 0) {
      const xptGramTRY = (1 / ft.xpt) / 31.1035;
      tryObj['xpt_gram'] = {
        bid: parseFloat(xptGramTRY.toFixed(4)),
        ask: parseFloat(xptGramTRY.toFixed(4))
      };
    }

    // HUF — Hungarian forint (not listed by TCMB)
    if (ft.huf && ft.huf > 0) {
      const hufRate = 1 / ft.huf;
      tryObj['huf'] = { bid: parseFloat(hufRate.toFixed(4)), ask: parseFloat(hufRate.toFixed(4)) };
    }

    console.log('fawaz: UZS, HUF, XAG, XPT fetched');
  } else {
    console.warn('fawaz failed — xag/xpt/uzs/huf will be missing');
  }

  // 4. bigpara gold fallback — used only when truncgil is down
  //    Derives quarter/half/full coin prices from gram price using standard weights + market premium coefficients.
  if (!truncgilOk && bigparaData) {
    try {
      const items = bigparaData?.data?.items || bigparaData?.items || [];
      const gldItem = items.find(i => i.sembol === 'GLDGR' || i.code === 'GLDGR');
      if (gldItem) {
        const bid = parseFloat(String(gldItem.alis || gldItem.bid || '0').replace(',', '.'));
        const ask = parseFloat(String(gldItem.satis || gldItem.ask || '0').replace(',', '.'));
        if (bid > 0 && ask > 0) {
          tryObj['xau_gram'] = { bid, ask };
          const purity = 0.916; // 22k gold
          const COIN_PREMIUM = { ceyrek: 1.0410, yarim: 1.0400, tam: 1.0337, cumhuriyet: 1.0133 };
          tryObj['xau_ceyrek']     = { bid: parseFloat((bid * 1.75  * purity * COIN_PREMIUM.ceyrek).toFixed(2)),     ask: parseFloat((ask * 1.75  * purity * COIN_PREMIUM.ceyrek).toFixed(2)) };
          tryObj['xau_yarim']      = { bid: parseFloat((bid * 3.5   * purity * COIN_PREMIUM.yarim).toFixed(2)),      ask: parseFloat((ask * 3.5   * purity * COIN_PREMIUM.yarim).toFixed(2)) };
          tryObj['xau_tam']        = { bid: parseFloat((bid * 7     * purity * COIN_PREMIUM.tam).toFixed(2)),        ask: parseFloat((ask * 7     * purity * COIN_PREMIUM.tam).toFixed(2)) };
          tryObj['xau_cumhuriyet'] = { bid: parseFloat((bid * 7.216 * purity * COIN_PREMIUM.cumhuriyet).toFixed(2)), ask: parseFloat((ask * 7.216 * purity * COIN_PREMIUM.cumhuriyet).toFixed(2)) };
          sources.push('bigpara(gold)');
          console.log('bigpara: truncgil fallback — gram gold + coin derivatives calculated');
        }
      }
    } catch (err) {
      console.warn('bigpara gold parse error:', err.message);
    }
  }

  // 5. Last resort: fill missing gold keys from previous JSON (marks as stale)
  let existingTry = {};
  try {
    const existing = JSON.parse(readFileSync('v1/currencies/try-full.json', 'utf8'));
    existingTry = existing.try || {};
  } catch (_) {}

  const goldKeys = ['xau_gram', 'xau_ceyrek', 'xau_yarim', 'xau_tam', 'xau_cumhuriyet', 'xag_gram', 'xpt_gram'];
  let usedStaleGold = false;
  for (const k of goldKeys) {
    if (!tryObj[k] && existingTry[k]) {
      tryObj[k] = existingTry[k];
      usedStaleGold = true;
    }
  }
  if (usedStaleGold) {
    console.warn('truncgil + bigpara both down — using cached gold prices, is_stale: true');
  }

  const bigparaGoldOk = sources.includes('bigpara(gold)');
  const isStale = (!truncgilOk && !bigparaGoldOk) || usedStaleGold;

  // Build try-full.json — rich format with bid/ask and gold
  const tryFull = {
    date: new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
    is_stale: isStale,
    sources,
    try: tryObj
  };

  // Build try.json — fawaz-compatible format (ask-based single rate, currencies only)
  const tryCompat = {
    date: tryFull.date,
    try: Object.fromEntries(
      Object.entries(tryObj)
        .filter(([k]) => !k.startsWith('x'))
        .map(([k, v]) => {
          if (v && typeof v === 'object' && v.ask) {
            return [k, parseFloat((1 / v.ask).toFixed(6))];
          }
          return [k, v];
        })
    )
  };

  // Git: pull before write to avoid race conditions with concurrent runs
  const timeStr = new Date().toISOString().split('T')[1].slice(0, 5);
  const msg = `rates: ${tryFull.date} ${timeStr} UTC`;

  execSync('git config user.email "actions@github.com"', { stdio: 'pipe', timeout: 10_000 });
  execSync('git config user.name "currency-api-bot"', { stdio: 'pipe', timeout: 10_000 });

  try {
    execSync('git pull --rebase origin main', { stdio: 'pipe', timeout: 30_000 });
  } catch (e) {
    console.warn('git pull warning:', e.message);
  }

  writeFileSync('v1/currencies/try-full.json', JSON.stringify(tryFull, null, 2));
  writeFileSync('v1/currencies/try.json', JSON.stringify(tryCompat, null, 2));
  console.log('JSON files written.');

  execSync('git add v1/', { stdio: 'pipe', timeout: 10_000 });
  const diff = execSync('git diff --cached --stat', { stdio: 'pipe', timeout: 10_000 }).toString();
  if (!diff.trim()) {
    console.log('No changes, skip commit');
    process.exit(0);
  }
  execSync(`git commit -m "${msg}"`, { stdio: 'pipe', timeout: 10_000 });

  // Push with retry — on conflict, pull --rebase then push again
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      execSync('git push origin main', { stdio: 'pipe', timeout: 30_000 });
      console.log('Committed:', msg);
      break;
    } catch (e) {
      if (attempt === 3) {
        console.error('Push failed after 3 attempts — marking Actions run as failed');
        process.exit(1);
      }
      console.warn(`Push attempt ${attempt}/3 failed, retrying after rebase:`, e.message);
      await new Promise(r => setTimeout(r, 2000));
      try {
        execSync('git pull --rebase origin main', { stdio: 'pipe', timeout: 30_000 });
      } catch (pullErr) {
        console.warn('Retry pull warning:', pullErr.message);
      }
    }
  }
}

main();
