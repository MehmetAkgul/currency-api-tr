import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { validateWithBigpara } from '../scripts/fetch-rates.js';

describe('validateWithBigpara', () => {
  it('bigparaData null → erken çıkar, hata atmaz', () => {
    assert.doesNotThrow(() => validateWithBigpara(null, { USD: { bid: 38.5, ask: 38.7 } }));
  });

  it('tcmbRates null → erken çıkar, hata atmaz', () => {
    assert.doesNotThrow(() => validateWithBigpara({ data: { items: [] } }, null));
  });

  it('tcmbRates USD eksik → erken çıkar, hata atmaz', () => {
    assert.doesNotThrow(() => validateWithBigpara({ data: { items: [] } }, { EUR: { bid: 40.0, ask: 40.5 } }));
  });

  it('USD sapması %3 → warn yok', () => {
    const warns = [];
    const origWarn = console.warn;
    console.warn = (...args) => warns.push(args.join(' '));
    try {
      const tcmbBid = 38.5;
      const bpBid = tcmbBid * 1.03;
      validateWithBigpara(
        { data: { items: [{ code: 'USD', alis: String(bpBid) }] } },
        { USD: { bid: tcmbBid, ask: 38.7 } }
      );
      assert.equal(warns.filter(w => w.includes('deviation')).length, 0);
    } finally { console.warn = origWarn; }
  });

  it('USD sapması %7 → warn var', () => {
    const warns = [];
    const origWarn = console.warn;
    console.warn = (...args) => warns.push(args.join(' '));
    try {
      const tcmbBid = 38.5;
      const bpBid = tcmbBid * 1.07;
      validateWithBigpara(
        { data: { items: [{ code: 'USD', alis: String(bpBid) }] } },
        { USD: { bid: tcmbBid, ask: 38.7 } }
      );
      assert.equal(warns.filter(w => w.includes('deviation')).length, 1);
    } finally { console.warn = origWarn; }
  });
});
