import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, pick, weightedPick } from '../../js/run/rng.js';

test('same seed produces the same sequence', () => {
  const a = makeRng(1234);
  const b = makeRng(1234);
  const seqA = [a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test('different seeds diverge', () => {
  const a = makeRng(1);
  const b = makeRng(2);
  assert.notEqual(a(), b());
});

test('values stay in [0, 1)', () => {
  const r = makeRng(99);
  for (let i = 0; i < 500; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('pick returns a member of the list and is deterministic', () => {
  const list = ['a', 'b', 'c', 'd'];
  assert.equal(pick(makeRng(7), list), pick(makeRng(7), list));
  assert.ok(list.includes(pick(makeRng(7), list)));
});

test('pick on a single-item list returns that item', () => {
  assert.equal(pick(makeRng(3), ['only']), 'only');
});

test('weightedPick respects weight zero', () => {
  const items = [{ v: 'never', w: 0 }, { v: 'always', w: 10 }];
  const r = makeRng(5);
  for (let i = 0; i < 100; i++) {
    assert.equal(weightedPick(r, items, (i2) => i2.w).v, 'always');
  }
});

test('weightedPick favours the heavier item', () => {
  const items = [{ v: 'rare', w: 1 }, { v: 'common', w: 99 }];
  const r = makeRng(11);
  let common = 0;
  for (let i = 0; i < 1000; i++) {
    if (weightedPick(r, items, (i2) => i2.w).v === 'common') common++;
  }
  assert.ok(common > 900, `expected >900 common, got ${common}`);
});
