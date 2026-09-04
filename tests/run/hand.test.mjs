import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, HAND_CAP, coinsForWave } from '../../js/run/run.js';

function newRun(seed = 1) { return createRun({ seed, playerIds: ['solo'] }); }
function clearWave(run) {
  run.completeWave();
  if (run.getDraft()) { run.vote('solo', 0); run.tick(0); }
}

test('a run opens with exactly one card, the loadout tower', () => {
  const run = newRun();
  assert.equal(run.getHand().length, 1);
  assert.deepEqual(run.getHand(), ['bolt']);
});

test('the loadout chooses the opening card', () => {
  const run = createRun({
    seed: 1, playerIds: ['solo'],
    profile: { towers: ['bolt', 'mortar'], loadout: 'mortar', bonuses: {} },
  });
  assert.deepEqual(run.getHand(), ['mortar']);
});

test('a loadout the profile does not own falls back rather than granting it', () => {
  const run = createRun({
    seed: 1, playerIds: ['solo'],
    profile: { towers: ['bolt'], loadout: 'helios', bonuses: {} },
  });
  assert.deepEqual(run.getHand(), ['bolt']);
  assert.ok(!run.getUnlockedTowers().includes('helios'));
});

test('a profile unlock is available from wave one', () => {
  const run = createRun({
    seed: 1, playerIds: ['solo'],
    profile: { towers: ['bolt', 'tesla', 'helios'], loadout: 'bolt', bonuses: {} },
  });
  assert.deepEqual(run.getUnlockedTowers().sort(), ['bolt', 'helios', 'tesla']);
});

test('the opening hand can only hold the starting tower', () => {
  const hand = newRun().getHand();
  assert.deepEqual([...new Set(hand)], ['bolt']);
});

test('playing a card spends it', () => {
  const run = newRun();
  clearWave(run);
  const before = run.getHand();
  assert.equal(before.length, 2, 'one drawn per wave on top of the loadout');
  const played = run.playCard(1);
  assert.equal(played, before[1]);
  assert.equal(run.getHand().length, 1);
});

test('an out-of-range or stale index plays nothing', () => {
  const run = newRun();
  assert.equal(run.playCard(9), null);
  assert.equal(run.playCard(-1), null);
  assert.equal(run.playCard(1.5), null);
  run.playCard(0);
  assert.equal(run.getHand().length, 0);
  assert.equal(run.playCard(0), null, 'an empty hand must play nothing');
});

test('a card arrives on the odd waves only', () => {
  const run = newRun();
  assert.equal(run.getHand().length, 1, 'the loadout card');
  clearWave(run);                                   // wave 1, odd
  assert.equal(run.getHand().length, 2, 'odd wave pays a card');
  clearWave(run);                                   // wave 2, even
  assert.equal(run.getHand().length, 2, 'even wave pays a power, not a card');
  clearWave(run);                                   // wave 3, odd
  assert.equal(run.getHand().length, 3);
});

test('a power arrives on the even waves only', () => {
  const run = newRun();
  clearWave(run);
  assert.equal(run.getPowers().length, 0, 'odd wave pays no power');
  clearWave(run);
  assert.equal(run.getPowers().length, 1, 'even wave pays a power');
});

test('unplayed cards are kept but never past the cap', () => {
  const run = newRun();
  for (let w = 0; w < 6; w++) clearWave(run);
  assert.equal(run.getHand().length, HAND_CAP,
    'holding should stop at the cap rather than growing without bound');
});

test('a spent hand refills one card at a time', () => {
  const run = newRun();
  run.playCard(0);
  assert.equal(run.getHand().length, 0);
  clearWave(run);
  assert.equal(run.getHand().length, 1);
});

test('the quartermaster bonus raises the cap by one', () => {
  const run = createRun({
    seed: 3, playerIds: ['solo'],
    profile: { towers: ['bolt'], loadout: 'bolt', bonuses: { quartermaster: true } },
  });
  for (let w = 0; w < 8; w++) clearWave(run);
  assert.equal(run.getHand().length, HAND_CAP + 1);
});

test('a cleared wave pays coins, and the boss pays a bonus', () => {
  assert.equal(coinsForWave(1, false), 12);
  assert.equal(coinsForWave(10, false), 30);
  assert.equal(coinsForWave(15, true), 140);
  const run = newRun();
  assert.equal(run.getCoins(), 0);
  clearWave(run);
  assert.equal(run.getCoins(), coinsForWave(1, false));
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
  assert.ok(JSON.parse(run.serialise()).hand.length === 1);
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
  // Wave 1 is odd, so the card arrives in completeWave's own events rather
  // than after a draft resolves.
  const events = run.completeWave();
  const drawn = events.find((e) => e.type === 'handDrawn');
  assert.ok(drawn, 'no handDrawn event');
  assert.equal(drawn.hand.length, 2, 'the loadout card plus the one just drawn');
  assert.ok(drawn.drew, 'the event should name the card that arrived');
});
