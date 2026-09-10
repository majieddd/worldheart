import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSwimming, travelFactor, travelCost, climatePermission, terrainTowerStats, elevatedRange } from '../js/traversal.js';

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
test('high-ground spheres reach the valley, grow monotonically and cap horizontal advantage', () => {
  const base = 10;
  assert.equal(elevatedRange(base, -10), base);
  let previous = base;
  for (const h of [1, 5, 15, 30, 60, 96]) {
    const range = elevatedRange(base, h);
    assert.ok(range > previous && range > h);
    const groundReach = Math.sqrt(range * range - h * h);
    assert.ok(groundReach > base && groundReach <= base * 1.6 + 1e-9);
    previous = range;
  }
  assert.equal(elevatedRange(base, NaN), base);
});
test('elevation composes with elements without changing minimum distance or secondary hops', () => {
  const template = { range:10, dmg:100, minRange:2.3, hop:3.6, leash:10 };
  const a = terrainTowerStats(template,'mortar','hot',30);
  assert.ok(a.range>30 && a.dmg>100);assert.equal(a.leash,16);
  assert.equal(a.minRange,2.3);assert.equal(a.hop,3.6);assert.equal(template.range,10);
  assert.deepEqual(terrainTowerStats(template,'mortar','hot',30),a);
});
