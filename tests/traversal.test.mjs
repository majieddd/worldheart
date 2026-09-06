import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSwimming, travelFactor, travelCost, climatePermission, terrainTowerStats } from '../js/traversal.js';

test('shoreline hysteresis prevents repeated state changes and swimming has no downhill boost', () => {
  assert.equal(isSwimming(false, 0.6), false);
  assert.equal(isSwimming(false, 0.7), true);
  assert.equal(isSwimming(true, 0.6), true);
  assert.equal(isSwimming(true, 0.4), false);
  assert.equal(travelFactor(-0.3, true), 0.6);
  assert.equal(travelFactor(0.2), 0.8);
  assert.equal(travelFactor(0.95), 0.65);
});
test('route costs penalize uphill and water and exclude cliffs', () => {
  assert.ok(travelCost(1, 2, 5) > travelCost(2, 1, 5));
  assert.equal(travelCost(1, 20, 5), Infinity);
  assert.ok(travelCost(-1, -1, 5) > travelCost(1, 1, 5));
});
test('whole footprints obey exclusive climate rules, including a mixed boundary', () => {
  for (const type of ['bolt', 'tesla', 'helios', 'warden', 'cryo']) assert.equal(climatePermission(type, ['neutral', 'hot']).ok, false);
  assert.equal(climatePermission('mortar', ['hot', 'cold']).reason, 'mixed');
  assert.equal(climatePermission('cryo', ['neutral', 'cold']).ok, true);
  assert.equal(climatePermission('mortar', ['neutral', 'hot']).ok, true);
  assert.equal(climatePermission('bolt', ['neutral']).ok, true);
});
test('element bonuses cannot mutate templates, stack on repeated reads or exceed slow cap', () => {
  const stats = { dmg: 100, slow: 0.68 };
  assert.ok(Math.abs(terrainTowerStats(stats, 'mortar', 'hot').dmg - 115) < 1e-10);
  assert.equal(terrainTowerStats(stats, 'cryo', 'cold').slow, 0.7);
  assert.deepEqual(stats, { dmg: 100, slow: 0.68 });
  assert.deepEqual(terrainTowerStats(stats, 'mortar', 'hot'), terrainTowerStats(stats, 'mortar', 'hot'));
});
