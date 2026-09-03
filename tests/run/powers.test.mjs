import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../js/run/rng.js';
import { foldModifiers } from '../../js/run/modifiers.js';
import { POWERS, POWER_BY_ID, RARITY_WEIGHT, rollOffers } from '../../js/run/powers.js';

test('the catalog has twenty powers with unique ids', () => {
  assert.equal(POWERS.length, 20);
  assert.equal(new Set(POWERS.map((p) => p.id)).size, 20);
});

test('every power has a name, description, known rarity and an apply function', () => {
  for (const p of POWERS) {
    assert.ok(p.name && p.name.length > 0, p.id + ' missing name');
    assert.ok(p.desc && p.desc.length > 0, p.id + ' missing desc');
    assert.ok(RARITY_WEIGHT[p.rarity] > 0, p.id + ' bad rarity');
    assert.equal(typeof p.apply, 'function', p.id + ' missing apply');
  }
});

test('every power actually changes the modifiers', () => {
  const base = JSON.stringify(foldModifiers([]));
  for (const p of POWERS) {
    assert.notEqual(JSON.stringify(foldModifiers([p])), base, p.id + ' is a no-op');
  }
});

test('POWER_BY_ID resolves every catalog entry', () => {
  for (const p of POWERS) assert.equal(POWER_BY_ID[p.id], p);
});

test('rollOffers returns three distinct powers', () => {
  const offers = rollOffers(makeRng(1), []);
  assert.equal(offers.length, 3);
  assert.equal(new Set(offers.map((o) => o.id)).size, 3);
});

test('rollOffers is deterministic for a seed', () => {
  const a = rollOffers(makeRng(42), []).map((o) => o.id);
  const b = rollOffers(makeRng(42), []).map((o) => o.id);
  assert.deepEqual(a, b);
});

test('rollOffers never offers an already-maxed unique power', () => {
  const unique = POWERS.filter((p) => p.unique).map((p) => p.id);
  const offers = rollOffers(makeRng(3), unique);
  for (const o of offers) assert.ok(!unique.includes(o.id), o.id + ' re-offered');
});

test('rollOffers still returns three when most of the pool is excluded', () => {
  const owned = POWERS.slice(0, 17).filter((p) => p.unique).map((p) => p.id);
  const offers = rollOffers(makeRng(9), owned);
  assert.equal(offers.length, 3);
});

test('common powers are offered more often than rare ones', () => {
  let common = 0;
  let rare = 0;
  for (let s = 0; s < 400; s++) {
    for (const o of rollOffers(makeRng(s), [])) {
      if (o.rarity === 'common') common++;
      if (o.rarity === 'rare') rare++;
    }
  }
  assert.ok(common > rare * 2, 'common ' + common + ' vs rare ' + rare);
});
