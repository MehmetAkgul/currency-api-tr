# currency-api-tr

**Free, open-source Turkish currency & gold API — updated every 5 minutes via GitHub Actions.**

No API key. No rate limits. No server needed. Served via jsDelivr CDN with `Access-Control-Allow-Origin: *`.

> Built as a transparent alternative to opaque currency APIs. All data sources are public and documented below.

---

## Endpoints

### Full format — bid/ask spreads + gold

```
https://cdn.jsdelivr.net/gh/MehmetAkgul/currency-api-tr@main/v1/currencies/try-full.json
```

### Compatibility format — single rate per currency (fawaz-compatible)

```
https://cdn.jsdelivr.net/gh/MehmetAkgul/currency-api-tr@main/v1/currencies/try.json
```

---

## Response Format

### try-full.json

```json
{
  "date": "2026-06-03",
  "updated_at": "2026-06-03T10:25:00.000Z",
  "is_stale": false,
  "sources": ["tcmb", "truncgil", "fawaz"],
  "try": {
    "usd": { "bid": 45.84, "ask": 45.92 },
    "eur": { "bid": 53.38, "ask": 53.48 },
    "xau_gram": { "bid": 6582.84, "ask": 6583.76 },
    "xau_ceyrek": { "bid": 10654.34, "ask": 10899.69 },
    "xag_gram": { "bid": 111.82, "ask": 111.82 },
    "uzs": { "bid": 0.003841, "ask": 0.003841 },
    "huf": { "bid": 0.1502, "ask": 0.1502 }
  }
}
```

`bid` = buying rate (what you get when selling TRY)  
`ask` = selling rate (what you pay when buying the currency)

`is_stale: true` means gold data is from a previous run (truncgil + bigpara both temporarily unavailable).

### try.json

```json
{
  "date": "2026-06-03",
  "try": {
    "usd": 0.021775,
    "eur": 0.018699
  }
}
```

Values represent `1 / ask` — how many units of TRY equal 1 unit of each currency.

---

## Supported Currencies

### Forex (23 currencies — official TCMB bid/ask)
`usd` `eur` `gbp` `chf` `jpy` `sar` `aed` `azn` `cny` `kzt` `krw` `qar` `rub` `cad` `aud` `sek` `nok` `dkk` `ron` `pkr` `kwd` `xdr`

### Additional (fawaz CDN — single rate)
`uzs` `huf`

### Gold & Metals
`xau_gram` `xau_ceyrek` `xau_yarim` `xau_tam` `xau_cumhuriyet` `xag_gram` `xpt_gram`

---

## Data Sources

| Source | Data | Update frequency |
|--------|------|-----------------|
| [TCMB](https://www.tcmb.gov.tr) (Turkey's Central Bank) | Official bid/ask rates for 22 currencies | Business days ~15:30 TST |
| [truncgil](https://finans.truncgil.com) | Gram gold, quarter/half/full/republic coins — bid/ask | Live (primary) |
| [BigPara](https://bigpara.hurriyet.com.tr) | Gram gold fallback when truncgil is down | Live |
| [fawazahmed0](https://github.com/fawazahmed0/exchange-api) | UZS, HUF, XAG (silver), XPT (platinum) | Daily |

### Gold fallback chain
`truncgil` → `bigpara` → previous JSON (`is_stale: true`)

---

## Usage

```js
const res = await fetch(
  'https://cdn.jsdelivr.net/gh/MehmetAkgul/currency-api-tr@main/v1/currencies/try-full.json'
);
const data = await res.json();

const usdAsk     = data.try.usd.ask;         // USD sell rate in TRY
const goldGramBid = data.try.xau_gram.bid;   // Gold gram buy price in TRY
const isStale    = data.is_stale;             // true if gold data is from cache
```

---

## Update Frequency

GitHub Actions cron: `*/5 * * * *` — runs every 5 minutes.  
jsDelivr CDN cache: ~5–10 minutes.  
Effective data freshness: **0–15 minutes**.

---

## Why This Exists

Most currency APIs for Turkey either:
- Require an API key and have strict rate limits
- Don't provide bid/ask spreads
- Don't include Turkish gold coins (çeyrek, yarım, tam, Cumhuriyet)
- Use opaque, undisclosed data sources

This project aggregates TCMB's official rates (legally mandated transparency under Law No. 1211) with live Istanbul gold market prices, served free via CDN.

---

## Production Usage

Actively used by [kurpanel.com](https://kurpanel.com) — a Turkish currency & gold portfolio calculator.

---

## License

MIT
