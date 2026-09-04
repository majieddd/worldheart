import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOTAL_WAVES, BOSS_WAVE, THETA_START, THETA_END,
  frontierTheta, unlocksTowerAt, evolutionTierAfter, isBossWave,
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

test('the schedule gates tower upgrades by the heart, not by the wave', async () => {
  // Upgrades used to be locked behind a wave-gated tier cap, which meant a
  // player could not improve a tower for the first two thirds of a run and
  // was never told when that would change. The cap now belongs to the
  // Worldheart, which is bought, so the wave-keyed form must stay gone.
  const mod = await import('../../js/run/schedule.js');
  assert.equal(mod.tierCapAfter, undefined, 'tierCapAfter should not exist');
  assert.equal(mod.tierCapForHeart(0), 2);
  assert.equal(mod.tierCapForHeart(5), 7);
  assert.equal(mod.tierCapForHeart(99), 7, 'the cap must clamp at the top level');
});

test('the heart tables agree with the number of expansions', async () => {
  const { HEART_COSTS, HEART_RINGS, MAX_HEART_LEVEL, heartCost, ringsPermitted } = await import('../../js/run/schedule.js');
  assert.deepEqual(HEART_COSTS, [250, 450, 700, 1000, 1400]);
  assert.deepEqual(HEART_RINGS, [1, 3, 5, 8, 11, 14]);
  assert.equal(MAX_HEART_LEVEL, 5);
  // One ring entry per level 0..5, rising, and the top level holds every
  // expansion or the final frontier could never be reached.
  assert.equal(HEART_RINGS.length, MAX_HEART_LEVEL + 1);
  for (let i = 1; i < HEART_RINGS.length; i++) assert.ok(HEART_RINGS[i] > HEART_RINGS[i - 1]);
  assert.equal(ringsPermitted(MAX_HEART_LEVEL), 14);
  assert.equal(heartCost(0), 250);
  assert.equal(heartCost(MAX_HEART_LEVEL), null, 'no price at the ceiling');
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
