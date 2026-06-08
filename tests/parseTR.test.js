import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTR } from '../scripts/fetch-rates.js';

describe('parseTR', () => {
  it('binlik nokta + ondalık virgül', () => assert.equal(parseTR('45.823,50'), 45823.50));
  it('sadece virgül', () => assert.equal(parseTR('38,25'), 38.25));
  it('çoklu binlik nokta', () => assert.equal(parseTR('1.200.000,00'), 1200000.00));
  it('boş string → NaN', () => assert.ok(isNaN(parseTR(''))));
  it('null → NaN', () => assert.ok(isNaN(parseTR(null))));
  it('undefined → NaN', () => assert.ok(isNaN(parseTR(undefined))));
  it('letters → NaN', () => assert.ok(isNaN(parseTR('abc'))));
  it('sıfır', () => assert.equal(parseTR('0,00'), 0));
});
