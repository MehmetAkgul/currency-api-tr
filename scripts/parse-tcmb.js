import xml2js from 'xml2js';

const TCMB_URL = 'https://www.tcmb.gov.tr/kurlar/today.xml';

// Fetches official bid/ask rates from Turkey's Central Bank (TCMB).
// Returns { USD: { bid, ask }, EUR: { bid, ask }, ... } or null on failure.
// CORS-blocked in browsers — server-side only.
export async function parseTCMB() {
  try {
    const res = await fetch(TCMB_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.error('TCMB HTTP error:', res.status);
      return null;
    }
    const xml = await res.text();

    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
    const currencies = parsed?.Tarih_Date?.Currency;
    if (!Array.isArray(currencies)) {
      console.error('TCMB XML: unexpected structure');
      return null;
    }

    const result = {};
    for (const cur of currencies) {
      const code = cur?.$?.CurrencyCode;
      if (!code) continue;

      const bidStr = cur.ForexBuying;
      const askStr = cur.ForexSelling;

      // Some currencies (e.g. XDR) may have empty ForexBuying/Selling
      if (!bidStr || !askStr || bidStr === '' || askStr === '') continue;

      const bid = parseFloat(bidStr);
      const ask = parseFloat(askStr);

      if (isNaN(bid) || isNaN(ask)) continue;

      result[code] = { bid, ask };
    }

    return result;
  } catch (err) {
    console.error('TCMB parse error:', err.message);
    return null;
  }
}
