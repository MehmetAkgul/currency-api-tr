import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeIsStale } from '../scripts/fetch-rates.js';

const base = { truncgilOk: true, bigparaGoldOk: true, usedStaleGold: false, usedStaleForex: false, forexMissing: false };

describe('computeIsStale', () => {
  it('tüm OK → false', () => assert.equal(computeIsStale(base), false));
  it('truncgil ve bigpara gold ikisi down → true', () =>
    assert.equal(computeIsStale({ ...base, truncgilOk: false, bigparaGoldOk: false }), true));
  it('truncgil down ama bigpara gold OK → false', () =>
    assert.equal(computeIsStale({ ...base, truncgilOk: false, bigparaGoldOk: true }), false));
  it('usedStaleGold → true', () =>
    assert.equal(computeIsStale({ ...base, usedStaleGold: true }), true));
  it('usedStaleForex → true', () =>
    assert.equal(computeIsStale({ ...base, usedStaleForex: true }), true));
  it('forexMissing → true', () =>
    assert.equal(computeIsStale({ ...base, forexMissing: true }), true));
  it('tüm flag true → true', () =>
    assert.equal(computeIsStale({ truncgilOk: false, bigparaGoldOk: false, usedStaleGold: true, usedStaleForex: true, forexMissing: true }), true));
});
