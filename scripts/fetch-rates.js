import { writeFileSync } from 'fs';
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
  if (truncgilData) {
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

    console.log('fawaz: UZS, XAG, XPT alındı');
  } else {
    console.warn('fawaz başarısız — xag/xpt/uzs eksik kalacak');
  }

  // try-full.json
  const tryFull = {
    date: new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
    is_stale: false,
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

  writeFileSync('v1/currencies/try-full.json', JSON.stringify(tryFull, null, 2));
  writeFileSync('v1/currencies/try.json', JSON.stringify(tryCompat, null, 2));
  console.log('JSON dosyaları yazıldı: v1/currencies/try-full.json, v1/currencies/try.json');

  // Git commit
  try {
    execSync('git config user.email "actions@github.com"', { stdio: 'pipe' });
    execSync('git config user.name "currency-api-bot"', { stdio: 'pipe' });
    execSync('git add v1/', { stdio: 'pipe' });
    const diff = execSync('git diff --cached --stat', { stdio: 'pipe' }).toString();
    if (!diff.trim()) {
      console.log('No changes, skip commit');
      process.exit(0);
    }
    const timeStr = new Date().toISOString().split('T')[1].slice(0, 5);
    const msg = `rates: ${tryFull.date} ${timeStr} UTC`;
    execSync(`git commit -m "${msg}"`, { stdio: 'pipe' });
    execSync('git pull --rebase origin main', { stdio: 'pipe' });
    execSync('git push origin main', { stdio: 'pipe' });
    console.log('Committed:', msg);
  } catch (e) {
    console.error('Git işlemi başarısız:', e.message);
    // push hatası olsa da JSON dosyası yazıldı — bir sonraki run düzeltir
  }
}

main();
