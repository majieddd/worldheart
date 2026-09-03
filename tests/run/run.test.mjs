import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../../js/run/run.js';
import { THETA_START, THETA_END } from '../../js/run/schedule.js';

function newRun(seed = 1, playerIds = ['p1']) {
  return createRun({ seed, playerIds });
}

// Clear a wave and immediately settle the draft by voting for option 0.
function clearWaveChoosingFirst(run) {
  const events = run.completeWave();
  const draft = run.getDraft();
  if (draft) {
    run.vote('p1', 0);
    return events.concat(run.tick(0));
  }
  return events;
}

test('a new run opens at the starting frontier with one tower', () => {
  const run = newRun();
  assert.equal(run.getFrontierTheta(), THETA_START);
  assert.deepEqual(run.getUnlockedTowers(), ['bolt']);
  assert.equal(run.getTierCap(), 1);
  assert.equal(run.getEvolutionTier(), 0);
  assert.equal(run.getWave(), 1);
});

test('clearing a wave opens a draft of three', () => {
  const run = newRun();
  run.completeWave();
  const draft = run.getDraft();
  assert.ok(draft, 'expected a draft');
  assert.equal(draft.offers.length, 3);
});

test('a wave does not advance until its draft resolves', () => {
  const run = newRun();
  run.completeWave();
  assert.equal(run.getWave(), 1, 'wave should hold while drafting');
  run.vote('p1', 0);
  run.tick(0);
  assert.equal(run.getWave(), 2);
});

test('the drafted power is added to the run and reaches the modifiers', () => {
  const run = newRun();
  const before = JSON.stringify(run.getModifiers());
  run.completeWave();
  const chosen = run.getDraft().offers[0];
  run.vote('p1', 0);
  run.tick(0);
  assert.ok(run.getPowers().includes(chosen.id), 'power not recorded');
  assert.notEqual(JSON.stringify(run.getModifiers()), before, 'modifiers unchanged');
});

test('the frontier grows every cleared wave', () => {
  const run = newRun();
  let prev = run.getFrontierTheta();
  for (let i = 0; i < 5; i++) {
    clearWaveChoosingFirst(run);
    const now = run.getFrontierTheta();
    assert.ok(now > prev, 'frontier did not grow on wave ' + (i + 1));
    prev = now;
  }
});

test('towers unlock on waves 2, 4, 6 and 8', () => {
  const run = newRun();
  const counts = [];
  for (let w = 1; w <= 8; w++) {
    clearWaveChoosingFirst(run);
    counts.push(run.getUnlockedTowers().length);
  }
  assert.deepEqual(counts, [1, 2, 2, 3, 3, 4, 4, 5]);
});

test('all five towers are owned once wave 8 clears, with no duplicates', () => {
  const run = newRun();
  for (let w = 1; w <= 8; w++) clearWaveChoosingFirst(run);
  const owned = run.getUnlockedTowers();
  assert.equal(owned.length, 5);
  assert.equal(new Set(owned).size, 5);
});

test('the tier cap rises after waves 10 and 12', () => {
  const run = newRun();
  for (let w = 1; w <= 9; w++) clearWaveChoosingFirst(run);
  assert.equal(run.getTierCap(), 1);
  clearWaveChoosingFirst(run);
  assert.equal(run.getTierCap(), 2);
  clearWaveChoosingFirst(run);
  assert.equal(run.getTierCap(), 2);
  clearWaveChoosingFirst(run);
  assert.equal(run.getTierCap(), 3);
});

test('the evolution tier reaches 4 by wave 12', () => {
  const run = newRun();
  for (let w = 1; w <= 12; w++) clearWaveChoosingFirst(run);
  assert.equal(run.getEvolutionTier(), 4);
});

test('a full run reaches the boss and then victory', () => {
  const run = newRun();
  for (let w = 1; w <= 14; w++) clearWaveChoosingFirst(run);
  assert.equal(run.getWave(), 15);
  assert.ok(run.isBossWave());
  const events = run.completeWave();
  assert.equal(run.getPhase(), 'victory');
  assert.ok(events.some((e) => e.type === 'runWon'));
  assert.equal(run.getDraft(), null, 'the boss wave grants no draft');
  assert.ok(Math.abs(run.getFrontierTheta() - THETA_END) < 1e-9);
});

test('completeWave emits the beats the shell needs', () => {
  const run = newRun();
  const types = run.completeWave().map((e) => e.type);
  assert.ok(types.includes('waveCleared'));
  assert.ok(types.includes('frontierGrew'));
  assert.ok(types.includes('draftOpened'));
});

test('losing the run ends it', () => {
  const run = newRun();
  run.loseRun();
  assert.equal(run.getPhase(), 'defeat');
  assert.deepEqual(run.completeWave(), []);
});

test('the same seed replays identically', () => {
  const ids = (seed) => {
    const run = newRun(seed);
    for (let w = 1; w <= 6; w++) clearWaveChoosingFirst(run);
    return run.getPowers().join(',');
  };
  assert.equal(ids(2026), ids(2026));
});

test('different seeds give different power sequences', () => {
  const ids = (seed) => {
    const run = newRun(seed);
    for (let w = 1; w <= 8; w++) clearWaveChoosingFirst(run);
    return run.getPowers().join(',');
  };
  assert.notEqual(ids(1), ids(999));
});

test('run state serialises at any point', () => {
  const run = newRun();
  for (let w = 1; w <= 3; w++) clearWaveChoosingFirst(run);
  assert.doesNotThrow(() => JSON.parse(run.serialise()));
});
