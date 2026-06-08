import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TCMB_KEY_MAP, GOLD_KEY_MAP, CORE_FOREX_KEYS, ESSENTIAL_FOREX } from '../scripts/fetch-rates.js';

describe('TCMB_KEY_MAP', () => {
  it('USD → usd', () => assert.equal(TCMB_KEY_MAP.USD, 'usd'));
  it('EUR → eur', () => assert.equal(TCMB_KEY_MAP.EUR, 'eur'));
  it('tüm value\'lar lowercase string', () => {
    for (const v of Object.values(TCMB_KEY_MAP))
      assert.equal(v, v.toLowerCase());
  });
});

describe('GOLD_KEY_MAP', () => {
  it('gram-altin → xau_gram', () => assert.equal(GOLD_KEY_MAP['gram-altin'], 'xau_gram'));
  it('ceyrek-altin → xau_ceyrek', () => assert.equal(GOLD_KEY_MAP['ceyrek-altin'], 'xau_ceyrek'));
  it('5 entry', () => assert.equal(Object.keys(GOLD_KEY_MAP).length, 5));
});

describe('CORE_FOREX_KEYS', () => {
  it('array', () => assert.ok(Array.isArray(CORE_FOREX_KEYS)));
  it('usd dahil', () => assert.ok(CORE_FOREX_KEYS.includes('usd')));
  it('eur dahil', () => assert.ok(CORE_FOREX_KEYS.includes('eur')));
  it('sar dahil', () => assert.ok(CORE_FOREX_KEYS.includes('sar')));
});

describe('ESSENTIAL_FOREX', () => {
  it('dört element', () => assert.deepEqual(ESSENTIAL_FOREX, ['usd', 'eur', 'gbp', 'chf']));
  it('tamamı CORE_FOREX_KEYS içinde', () => {
    for (const k of ESSENTIAL_FOREX) assert.ok(CORE_FOREX_KEYS.includes(k));
  });
});
