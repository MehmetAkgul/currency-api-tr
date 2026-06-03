import xml2js from 'xml2js';

const TCMB_URL = 'https://www.tcmb.gov.tr/kurlar/today.xml';

export async function parseTCMB() {
  try {
    const controller = new AbortController();
    const timer = AbortSignal.timeout(8000);
    timer.addEventListener('abort', () => controller.abort());

    const res = await fetch(TCMB_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.error('TCMB HTTP hatası:', res.status);
      return null;
    }
    const xml = await res.text();

    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
    const currencies = parsed?.Tarih_Date?.Currency;
    if (!Array.isArray(currencies)) {
      console.error('TCMB XML yapısı beklenmedik');
      return null;
    }

    const result = {};
    for (const cur of currencies) {
      const code = cur?.$?.CurrencyCode;
      if (!code) continue;

      const bidStr = cur.ForexBuying;
      const askStr = cur.ForexSelling;

      if (!bidStr || !askStr || bidStr === '' || askStr === '') continue;

      const bid = parseFloat(bidStr);
      const ask = parseFloat(askStr);

      if (isNaN(bid) || isNaN(ask)) continue;

      result[code] = { bid, ask };
    }

    return result;
  } catch (err) {
    console.error('TCMB parse hatası:', err.message);
    return null;
  }
}
