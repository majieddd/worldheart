import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../../js/run/run.js';
import { HEART_COSTS, HEART_RINGS, THETA_END, frontierTheta } from '../../js/run/schedule.js';

// The Worldheart ladder: the level, the price, the tier cap it buys and the
// rings it lets the frontier hold. Gold is the shell's, so nothing here pays;
// these prove the core's accounting of what a level permits.

function newRun(seed = 7) {
  return createRun({ seed, playerIds: ['solo'] });
}

function clearWave(run) {
  const events = run.completeWave();
  if (run.getDraft()) {
    run.vote('solo', 0);
    return events.concat(run.tick(0));
  }
  return events;
}

test('a new run opens at heart level 0 with the first price and the base cap', () => {
  const run = newRun();
  assert.equal(run.getHeartLevel(), 0);
  assert.equal(run.getHeartCost(), HEART_COSTS[0]);
  assert.equal(run.getTierCap(), 2);
  assert.equal(run.getHeldRings(), 0);
});

test('each upgrade raises the level, quotes the next price and adds a mark to the cap', () => {
  const run = newRun();
  for (let lv = 1; lv <= HEART_COSTS.length; lv++) {
    const events = run.upgradeHeart();
    const up = events.find((e) => e.type === 'heartUpgraded');
    assert.ok(up, 'no heartUpgraded event at level ' + lv);
    assert.equal(up.level, lv);
    assert.equal(up.cost, HEART_COSTS[lv - 1], 'the event carries the price that was paid');
    assert.equal(run.getHeartLevel(), lv);
    assert.equal(run.getTierCap(), 2 + lv);
    assert.equal(run.getHeartCost(), lv < HEART_COSTS.length ? HEART_COSTS[lv] : null);
  }
});

test('the heart cannot be raised past its ceiling', () => {
  const run = newRun();
  while (run.getHeartCost() !== null) run.upgradeHeart();
  assert.equal(run.getHeartLevel(), HEART_COSTS.length);
  assert.deepEqual(run.upgradeHeart(), [], 'a maxed heart must return no events');
  assert.equal(run.getHeartLevel(), HEART_COSTS.length);
});

test('a held wave reports the level and the price of relief', () => {
  const run = newRun();
  clearWave(run);
  const events = clearWave(run);
  const held = events.find((e) => e.type === 'frontierHeld');
  assert.ok(held, 'the second wave on an unraised heart must be held');
  assert.equal(held.level, 0);
  assert.equal(held.cost, HEART_COSTS[0]);
  assert.equal(held.held, 1);
  assert.ok(!events.some((e) => e.type === 'frontierGrew'), 'a held wave must not also grow');
});

test('a wave the heart can hold grows and is not reported as held', () => {
  const run = newRun();
  const events = clearWave(run);
  assert.ok(events.some((e) => e.type === 'frontierGrew'));
  assert.ok(!events.some((e) => e.type === 'frontierHeld'));
});

test('an upgrade never grants rings the waves have not earned', () => {
  // Level 1 permits three rings, but only one wave has cleared, so only one
  // ring exists to hold. Raising the heart early buys the cap, not ground.
  const run = newRun();
  clearWave(run);
  const events = run.upgradeHeart();
  assert.ok(!events.some((e) => e.type === 'frontierGrew'));
  assert.equal(run.getFrontierSteps(), 1);
  clearWave(run);
  assert.equal(run.getFrontierSteps(), 2, 'the next wave grows straight away under the raised heart');
});

test('the frontier at every level matches the rings table', () => {
  for (let lv = 0; lv < HEART_RINGS.length; lv++) {
    const run = newRun();
    for (let i = 0; i < lv; i++) run.upgradeHeart();
    for (let w = 1; w <= 14; w++) clearWave(run);
    assert.equal(run.getFrontierSteps(), HEART_RINGS[lv], 'level ' + lv);
    assert.ok(Math.abs(run.getFrontierTheta() - frontierTheta(HEART_RINGS[lv])) < 1e-12);
  }
});

test('only a fully raised heart reaches the final frontier', () => {
  const held = newRun();
  for (let i = 0; i < HEART_COSTS.length - 1; i++) held.upgradeHeart();
  for (let w = 1; w <= 14; w++) clearWave(held);
  assert.ok(held.getFrontierTheta() < THETA_END - 1e-6, 'level 4 must stop short of the planet');

  const full = newRun();
  while (full.getHeartCost() !== null) full.upgradeHeart();
  for (let w = 1; w <= 14; w++) clearWave(full);
  assert.ok(Math.abs(full.getFrontierTheta() - THETA_END) < 1e-9);
});

test('the boss wave still grants no expansion, even under a full heart', () => {
  const run = newRun();
  while (run.getHeartCost() !== null) run.upgradeHeart();
  for (let w = 1; w <= 14; w++) clearWave(run);
  const before = run.getFrontierSteps();
  const events = run.completeWave();
  assert.equal(run.getPhase(), 'victory');
  assert.equal(run.getFrontierSteps(), before);
  assert.ok(!events.some((e) => e.type === 'frontierGrew' || e.type === 'frontierHeld'));
});

test('an ended run refuses a heart upgrade', () => {
  const run = newRun();
  run.loseRun();
  assert.deepEqual(run.upgradeHeart(), []);
  assert.equal(run.getHeartLevel(), 0);
});

test('the heart survives serialisation', () => {
  const run = newRun();
  run.upgradeHeart();
  for (let w = 1; w <= 4; w++) clearWave(run);
  const s = JSON.parse(run.serialise());
  assert.equal(s.heartLevel, 1);
  assert.equal(s.frontierSteps, 3);
});
