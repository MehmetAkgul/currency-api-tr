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

  it('USD sapması %3 → warn yok', (t) => {
    const warns = [];
    const origWarn = console.warn;
    console.warn = (...args) => warns.push(args.join(' '));

    const tcmbBid = 38.5;
    const bpBid = tcmbBid * 1.03; // %3 sapma — eşiğin altında
    const bigparaData = { data: { items: [{ code: 'USD', alis: String(bpBid) }] } };
    validateWithBigpara(bigparaData, { USD: { bid: tcmbBid, ask: 38.7 } });

    console.warn = origWarn;
    const deviationWarns = warns.filter(w => w.includes('deviation'));
    assert.equal(deviationWarns.length, 0);
  });

  it('USD sapması %7 → warn var', (t) => {
    const warns = [];
    const origWarn = console.warn;
    console.warn = (...args) => warns.push(args.join(' '));

    const tcmbBid = 38.5;
    const bpBid = tcmbBid * 1.07; // %7 sapma — eşiğin üzerinde
    const bigparaData = { data: { items: [{ code: 'USD', alis: String(bpBid) }] } };
    validateWithBigpara(bigparaData, { USD: { bid: tcmbBid, ask: 38.7 } });

    console.warn = origWarn;
    const deviationWarns = warns.filter(w => w.includes('deviation'));
    assert.equal(deviationWarns.length, 1);
  });
});
