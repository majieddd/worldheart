import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseModifiers, foldModifiers } from '../../js/run/modifiers.js';

test('base modifiers are neutral', () => {
  const m = baseModifiers();
  assert.equal(m.dmgMul, 1);
  assert.equal(m.rateMul, 1);
  assert.equal(m.rangeMul, 1);
  assert.equal(m.goldMul, 1);
  assert.equal(m.costMul, 1);
  assert.equal(m.critAdd, 0);
  assert.equal(m.chainAdd, 0);
  assert.equal(m.livesAdd, 0);
  assert.equal(m.pierce, false);
});

test('base modifiers are a fresh object each call', () => {
  const a = baseModifiers();
  a.dmgMul = 99;
  assert.equal(baseModifiers().dmgMul, 1);
});

test('folding no powers leaves the base untouched', () => {
  assert.deepEqual(foldModifiers([]), baseModifiers());
});

test('a single numeric power applies its delta', () => {
  const m = foldModifiers([{ id: 'x', apply: (mm) => { mm.dmgMul += 0.12; } }]);
  assert.ok(Math.abs(m.dmgMul - 1.12) < 1e-9);
});

test('duplicate powers stack additively, not multiplicatively', () => {
  const p = { id: 'x', apply: (mm) => { mm.dmgMul += 0.12; } };
  const m = foldModifiers([p, p, p]);
  assert.ok(Math.abs(m.dmgMul - 1.36) < 1e-9, `got ${m.dmgMul}`);
});

test('boolean powers latch true', () => {
  const m = foldModifiers([{ id: 'p', apply: (mm) => { mm.pierce = true; } }]);
  assert.equal(m.pierce, true);
});

test('fold order does not change the result', () => {
  const a = { id: 'a', apply: (mm) => { mm.dmgMul += 0.2; } };
  const b = { id: 'b', apply: (mm) => { mm.rateMul += 0.1; } };
  assert.deepEqual(foldModifiers([a, b]), foldModifiers([b, a]));
});

test('cost multiplier is floored so towers can never be free', () => {
  const cheap = { id: 'c', apply: (mm) => { mm.costMul -= 0.5; } };
  const m = foldModifiers([cheap, cheap, cheap]);
  assert.ok(m.costMul >= 0.25, `costMul fell to ${m.costMul}`);
});
