import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOTAL_WAVES, BOSS_WAVE, THETA_START, THETA_END,
  frontierTheta, unlocksTowerAt, tierCapAfter, evolutionTierAfter, isBossWave,
} from '../../js/run/schedule.js';

test('the run is 15 waves and the boss is the last', () => {
  assert.equal(TOTAL_WAVES, 15);
  assert.equal(BOSS_WAVE, 15);
  assert.ok(isBossWave(15));
  assert.ok(!isBossWave(14));
});

test('frontier starts at THETA_START before any wave clears', () => {
  assert.equal(frontierTheta(0), THETA_START);
});

test('frontier reaches THETA_END after wave 14 clears', () => {
  assert.ok(Math.abs(frontierTheta(14) - THETA_END) < 1e-9);
});

test('frontier never shrinks and never exceeds the end', () => {
  let prev = -Infinity;
  for (let cleared = 0; cleared <= 15; cleared++) {
    const t = frontierTheta(cleared);
    assert.ok(t >= prev, `shrank at ${cleared}`);
    assert.ok(t <= THETA_END + 1e-9, `overshot at ${cleared}`);
    prev = t;
  }
});

test('the boss wave adds no expansion', () => {
  assert.equal(frontierTheta(15), frontierTheta(14));
});

test('expansion eases out: the first step is larger than the last', () => {
  const first = frontierTheta(1) - frontierTheta(0);
  const last = frontierTheta(14) - frontierTheta(13);
  assert.ok(first > last, `first ${first} should exceed last ${last}`);
});

test('towers unlock on waves 2, 4, 6, 8, 10 only', () => {
  const unlockWaves = [];
  for (let w = 1; w <= 15; w++) if (unlocksTowerAt(w)) unlockWaves.push(w);
  assert.deepEqual(unlockWaves, [2, 4, 6, 8, 10]);
});

test('every unlockable tower gets a wave', () => {
  // Five unlockable towers behind Bolt, so five unlock waves. If a tower is
  // added without a wave it can never be drawn, which is silent and nasty.
  let n = 0;
  for (let w = 1; w <= 15; w++) if (unlocksTowerAt(w)) n++;
  assert.equal(n, 5);
});

test('tier cap starts at 1, becomes 2 after wave 11 and 3 after wave 13', () => {
  assert.equal(tierCapAfter(0), 1);
  assert.equal(tierCapAfter(10), 1);
  assert.equal(tierCapAfter(11), 2);
  assert.equal(tierCapAfter(12), 2);
  assert.equal(tierCapAfter(13), 3);
  assert.equal(tierCapAfter(15), 3);
});

test('evolution tier increments on waves 3, 6, 9, 12', () => {
  assert.equal(evolutionTierAfter(0), 0);
  assert.equal(evolutionTierAfter(2), 0);
  assert.equal(evolutionTierAfter(3), 1);
  assert.equal(evolutionTierAfter(5), 1);
  assert.equal(evolutionTierAfter(6), 2);
  assert.equal(evolutionTierAfter(9), 3);
  assert.equal(evolutionTierAfter(12), 4);
  assert.equal(evolutionTierAfter(15), 4);
});
