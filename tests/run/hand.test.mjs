import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, HAND_SIZE } from '../../js/run/run.js';

function newRun(seed = 1) { return createRun({ seed, playerIds: ['solo'] }); }
function clearWave(run) {
  run.completeWave();
  if (run.getDraft()) { run.vote('solo', 0); run.tick(0); }
}

test('the hand is always three cards', () => {
  assert.equal(HAND_SIZE, 3);
  assert.equal(newRun().getHand().length, 3);
});

test('the opening hand can only hold the starting tower', () => {
  const hand = newRun().getHand();
  assert.deepEqual([...new Set(hand)], ['bolt']);
});

test('playing a card spends it', () => {
  const run = newRun();
  const before = run.getHand();
  const played = run.playCard(1);
  assert.equal(played, before[1]);
  assert.equal(run.getHand().length, 2);
});

test('an out-of-range or stale index plays nothing', () => {
  const run = newRun();
  assert.equal(run.playCard(9), null);
  assert.equal(run.playCard(-1), null);
  assert.equal(run.playCard(1.5), null);
  run.playCard(0); run.playCard(0); run.playCard(0);
  assert.equal(run.getHand().length, 0);
  assert.equal(run.playCard(0), null, 'an empty hand must play nothing');
});

test('the hand refills to three every wave', () => {
  const run = newRun();
  run.playCard(0); run.playCard(0);
  assert.equal(run.getHand().length, 1);
  clearWave(run);
  assert.equal(run.getHand().length, 3);
});

test('a spent hand still refills', () => {
  const run = newRun();
  run.playCard(0); run.playCard(0); run.playCard(0);
  clearWave(run);
  assert.equal(run.getHand().length, 3);
});

test('unlocked towers can appear in later hands', () => {
  const run = newRun(4);
  for (let w = 1; w <= 10; w++) clearWave(run);
  assert.equal(run.getUnlockedTowers().length, 6);
  const seen = new Set();
  for (let w = 11; w <= 14; w++) { run.getHand().forEach((c) => seen.add(c)); clearWave(run); }
  assert.ok(seen.size > 1, `only ever drew ${[...seen]}`);
  for (const c of seen) assert.ok(run.getUnlockedTowers().includes(c), `drew locked ${c}`);
});

test('a hand never contains a locked tower', () => {
  for (let seed = 0; seed < 40; seed++) {
    const run = createRun({ seed, playerIds: ['solo'] });
    for (let w = 1; w <= 14; w++) {
      for (const card of run.getHand()) {
        assert.ok(run.getUnlockedTowers().includes(card), `seed ${seed} wave ${w} drew ${card}`);
      }
      clearWave(run);
    }
  }
});

test('the hand is part of serialised state', () => {
  const run = newRun();
  assert.ok(JSON.parse(run.serialise()).hand.length === 3);
});

test('the same seed draws the same hands', () => {
  const hands = (seed) => {
    const run = createRun({ seed, playerIds: ['solo'] });
    const out = [];
    for (let w = 1; w <= 6; w++) { out.push(run.getHand().join('/')); clearWave(run); }
    return out.join('|');
  };
  assert.equal(hands(2026), hands(2026));
});

test('a wave clear emits handDrawn', () => {
  const run = newRun();
  run.completeWave();
  run.vote('solo', 0);
  const events = run.tick(0);
  const drawn = events.find((e) => e.type === 'handDrawn');
  assert.ok(drawn, 'no handDrawn event');
  assert.equal(drawn.hand.length, 3);
});
