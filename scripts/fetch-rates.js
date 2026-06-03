import { writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { Agent, fetch as uFetch } from 'undici';
import { parseTCMB } from './parse-tcmb.js';

// truncgil SSL sorununu aşmak için undici Agent
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

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
    console.error('truncgil hatası:', err.message);
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
    console.error('fawaz hatası:', err.message);
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
    console.warn('bigpara erişilemedi (opsiyonel):', err.message);
    return null;
  }
}

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
        console.warn(`[Uyari] USD bigpara/TCMB sapma %${(diff * 100).toFixed(1)} — bigpara: ${bpBid}, TCMB: ${tcmbBid}`);
      }
    }
  } catch (err) {
    console.warn('bigpara dogrulama hatasi:', err.message);
  }
}

// TCMB kur kodu → try objesi key mapleme
const TCMB_KEY_MAP = {
  USD: 'usd',
  EUR: 'eur',
  GBP: 'gbp',
  CHF: 'chf',
  JPY: 'jpy',
  SAR: 'sar',
  AED: 'aed',
  AZN: 'azn',
  CNY: 'cny',
  KZT: 'kzt',
  KRW: 'krw',
  QAR: 'qar',
  RUB: 'rub',
  CAD: 'cad',
  AUD: 'aud',
  SEK: 'sek',
  NOK: 'nok',
  DKK: 'dkk',
  RON: 'ron',
  PKR: 'pkr',
  KWD: 'kwd',
  XDR: 'xdr'
};

// truncgil altın key mapleme
const GOLD_KEY_MAP = {
  'gram-altin': 'xau_gram',
  'ceyrek-altin': 'xau_ceyrek',
  'yarim-altin': 'xau_yarim',
  'tam-altin': 'xau_tam',
  'cumhuriyet-altini': 'xau_cumhuriyet'
};

async function main() {
  console.log('Kur verisi çekiliyor...');

  const [tcmbRates, truncgilData, fawazData, bigparaData] = await Promise.all([
    parseTCMB(),
    fetchTruncgil(),
    fetchFawaz(),
    fetchBigpara()
  ]);

  // Birincil kaynak kontrolü
  if (!tcmbRates && !truncgilData) {
    console.error('Tüm birincil kaynaklar başarısız, JSON güncellenmedi');
    process.exit(0);
  }

  // Bigpara doğrulama (opsiyonel, veri akışını etkilemez)
  validateWithBigpara(bigparaData, tcmbRates);

  const sources = [];
  const tryObj = {};

  // 1. TCMB dövizleri
  if (tcmbRates) {
    sources.push('tcmb');
    for (const [tcmbCode, key] of Object.entries(TCMB_KEY_MAP)) {
      if (tcmbRates[tcmbCode]) {
        tryObj[key] = tcmbRates[tcmbCode];
      }
    }
    console.log(`TCMB: ${Object.keys(tcmbRates).length} kur alındı`);
  }

  // 2. truncgil altın verileri
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
    console.log('truncgil: altın verileri alındı');
  }

  // 3. fawaz — UZS, XAG, XPT
  if (fawazData?.try) {
    sources.push('fawaz');
    const ft = fawazData.try;

    // UZS
    if (ft.uzs && ft.uzs > 0) {
      const uzsRate = 1 / ft.uzs;
      tryObj['uzs'] = { bid: parseFloat(uzsRate.toFixed(6)), ask: parseFloat(uzsRate.toFixed(6)) };
    }

    // XAG gram (troy ons → gram dönüşümü: 1 troy ons = 31.1035 gram)
    if (ft.xag && ft.xag > 0) {
      const xagGramTRY = (1 / ft.xag) / 31.1035;
      tryObj['xag_gram'] = {
        bid: parseFloat(xagGramTRY.toFixed(4)),
        ask: parseFloat(xagGramTRY.toFixed(4))
      };
    }

    // XPT gram
    if (ft.xpt && ft.xpt > 0) {
      const xptGramTRY = (1 / ft.xpt) / 31.1035;
      tryObj['xpt_gram'] = {
        bid: parseFloat(xptGramTRY.toFixed(4)),
        ask: parseFloat(xptGramTRY.toFixed(4))
      };
    }

    // HUF — TCMB listesinde yok, tek kaynak fawaz
    if (ft.huf && ft.huf > 0) {
      const hufRate = 1 / ft.huf;
      tryObj['huf'] = { bid: parseFloat(hufRate.toFixed(4)), ask: parseFloat(hufRate.toFixed(4)) };
    }

    console.log('fawaz: UZS, XAG, XPT, HUF alındı');
  } else {
    console.warn('fawaz başarısız — xag/xpt/uzs eksik kalacak');
  }

  // Mevcut try-full.json'u oku — truncgil down olduğunda eski altın verilerini koru
  let existingTry = {};
  try {
    const existing = JSON.parse(readFileSync('v1/currencies/try-full.json', 'utf8'));
    existingTry = existing.try || {};
  } catch (_) {}

  // Altın anahtarları eksikse eski veriden tamamla ve stale işaretle
  const goldKeys = ['xau_gram', 'xau_ceyrek', 'xau_yarim', 'xau_tam', 'xau_cumhuriyet', 'xag_gram', 'xpt_gram'];
  let usedStaleGold = false;
  for (const k of goldKeys) {
    if (!tryObj[k] && existingTry[k]) {
      tryObj[k] = existingTry[k];
      usedStaleGold = true;
    }
  }
  if (usedStaleGold) {
    console.warn('truncgil down — eski altın verileri kullanıldı, is_stale: true');
  }

  const isStale = !truncgilOk || usedStaleGold;

  // try-full.json
  const tryFull = {
    date: new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
    is_stale: isStale,
    sources,
    try: tryObj
  };

  // try.json (fawaz-compat: sadece dövizler, bid/ask yerine ask bazlı tek değer)
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

  // Git commit — önce pull, sonra yaz, sonra push (race condition önlemi)
  const timeStr = new Date().toISOString().split('T')[1].slice(0, 5);
  const msg = `rates: ${tryFull.date} ${timeStr} UTC`;

  execSync('git config user.email "actions@github.com"', { stdio: 'pipe', timeout: 10_000 });
  execSync('git config user.name "currency-api-bot"', { stdio: 'pipe', timeout: 10_000 });

  // Remote'u çek — JSON yazmadan önce (unstaged changes olmadan pull)
  try {
    execSync('git pull --rebase origin main', { stdio: 'pipe', timeout: 30_000 });
  } catch (e) {
    console.warn('git pull uyarısı (remote yok veya up-to-date):', e.message);
  }

  // JSON dosyalarını yaz
  writeFileSync('v1/currencies/try-full.json', JSON.stringify(tryFull, null, 2));
  writeFileSync('v1/currencies/try.json', JSON.stringify(tryCompat, null, 2));
  console.log('JSON dosyaları yazıldı.');

  execSync('git add v1/', { stdio: 'pipe', timeout: 10_000 });
  const diff = execSync('git diff --cached --stat', { stdio: 'pipe', timeout: 10_000 }).toString();
  if (!diff.trim()) {
    console.log('No changes, skip commit');
    process.exit(0);
  }
  execSync(`git commit -m "${msg}"`, { stdio: 'pipe', timeout: 10_000 });

  // Push retry — sadece push çakışırsa pull + push tekrarla
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      execSync('git push origin main', { stdio: 'pipe', timeout: 30_000 });
      console.log('Committed:', msg);
      break;
    } catch (e) {
      if (attempt === 3) {
        console.error('Push 3 denemede başarısız — Actions kırmızı işaretleniyor');
        process.exit(1);
      }
      console.warn(`Push attempt ${attempt}/3 başarısız, rebase ile tekrar:`, e.message);
      await new Promise(r => setTimeout(r, 2000));
      try {
        execSync('git pull --rebase origin main', { stdio: 'pipe', timeout: 30_000 });
      } catch (pullErr) {
        console.warn('Retry pull uyarısı:', pullErr.message);
      }
    }
  }
}

main();
