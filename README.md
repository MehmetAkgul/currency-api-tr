# currency-api-tr

Free TR currency & gold API — TCMB + truncgil sources, updated every 5 minutes via GitHub Actions.

No API key required. No rate limits. Served via jsDelivr CDN.

---

## Endpoints

### Tam veri (bid/ask + altın)

```
https://cdn.jsdelivr.net/gh/MehmetAkgul/currency-api-tr@main/v1/currencies/try-full.json
```

### Uyumluluk formatı (tek değer, döviz kuru)

```
https://cdn.jsdelivr.net/gh/MehmetAkgul/currency-api-tr@main/v1/currencies/try.json
```

---

## JSON Formatı

### try-full.json

```json
{
  "date": "2026-06-03",
  "updated_at": "2026-06-03T10:25:00.000Z",
  "is_stale": false,
  "sources": ["tcmb", "truncgil", "fawaz"],
  "try": {
    "usd": { "bid": 38.42, "ask": 38.58 },
    "eur": { "bid": 41.85, "ask": 42.05 },
    "xau_gram": { "bid": 3620.00, "ask": 3650.00 },
    "xau_ceyrek": { "bid": 5870.00, "ask": 5920.00 },
    "xag_gram": { "bid": 41.20, "ask": 41.20 },
    "uzs": { "bid": 0.003012, "ask": 0.003012 }
  }
}
```

### try.json (fawaz uyumlu)

```json
{
  "date": "2026-06-03",
  "try": {
    "usd": 0.025919,
    "eur": 0.023781,
    "gbp": 0.020325
  }
}
```

`try.json` içindeki değerler: `1 / ask` hesabıyla elde edilen TRY/birim oran.

---

## Veri Kaynakları

| Kaynak | Veri | Güncelleme |
|--------|------|------------|
| [TCMB](https://www.tcmb.gov.tr) | Resmi alış/satış kurları (22 döviz) | Günlük (iş günü) |
| [truncgil](https://finans.truncgil.com) | Gram altın, çeyrek, yarım, tam, Cumhuriyet | Canlı |
| [fawaz](https://github.com/fawazahmed0/exchange-api) | UZS, XAG (gümüş), XPT (platin) | Günlük |

---

## Desteklenen Kurlar

### Dövizler
`usd` `eur` `gbp` `chf` `jpy` `sar` `aed` `azn` `cny` `kzt` `krw` `qar` `rub` `cad` `aud` `sek` `nok` `dkk` `ron` `pkr` `kwd` `xdr` `uzs`

### Altın & Metaller
`xau_gram` `xau_ceyrek` `xau_yarim` `xau_tam` `xau_cumhuriyet` `xag_gram` `xpt_gram`

---

## `is_stale` Alanı

`is_stale: true` — seed verisi veya güncelleme başarısız. Gerçek zamanlı veri değil.

`is_stale: false` — son 10 dakika içinde başarıyla çekilmiş veri.

---

## Güncelleme Sıklığı

GitHub Actions cron: `*/5 * * * *` — her 5 dakikada bir çalışır.

jsDelivr CDN cache süresi 10 dakikadır. Gerçek dünyada gecikme ~0–15 dakika arası olabilir.

---

## Production Kullanımı

Bu API aktif olarak [kurpanel.com](https://kurpanel.com) tarafından kullanılmaktadır.

---

## Kullanım

```js
const res = await fetch('https://cdn.jsdelivr.net/gh/MehmetAkgul/currency-api-tr@main/v1/currencies/try-full.json');
const data = await res.json();

const usdAsk = data.try.usd.ask;       // USD satış kuru
const altinGram = data.try.xau_gram.bid; // Gram altın alış
```

---

## Lisans

MIT — Free to use, no API key required.
