import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunState, serialise, deserialise, STARTING_TOWER } from '../../js/run/state.js';

test('a new run starts before wave 1 with only the starting tower', () => {
  const s = createRunState({ seed: 5, playerIds: ['p1'] });
  assert.equal(s.wavesCleared, 0);
  assert.equal(s.phase, 'building');
  assert.deepEqual(s.unlockedTowers, [STARTING_TOWER]);
  assert.equal(STARTING_TOWER, 'bolt');
  assert.deepEqual(s.powers, []);
  assert.equal(s.heartLevel, 0);
  assert.equal(s.frontierSteps, 0);
});

test('players are always a list, even solo', () => {
  const s = createRunState({ seed: 1, playerIds: ['p1'] });
  assert.ok(Array.isArray(s.players));
  assert.equal(s.players.length, 1);
  assert.equal(s.players[0].id, 'p1');
});

test('gold is per player', () => {
  const s = createRunState({ seed: 1, playerIds: ['p1', 'p2'], startGold: 300 });
  assert.equal(s.players[0].gold, 300);
  assert.equal(s.players[1].gold, 300);
  s.players[0].gold += 50;
  assert.equal(s.players[1].gold, 300);
});

test('powers belong to the run, not to a player', () => {
  const s = createRunState({ seed: 1, playerIds: ['p1', 'p2'] });
  assert.ok(Array.isArray(s.powers));
  assert.equal(s.players[0].powers, undefined);
});

test('state survives a serialise and deserialise round trip', () => {
  const s = createRunState({ seed: 9, playerIds: ['p1', 'p2'] });
  s.wavesCleared = 4;
  s.powers.push('keen-rails');
  s.unlockedTowers.push('cryo');
  s.players[1].gold = 777;
  const back = deserialise(serialise(s));
  assert.deepEqual(back, s);
});

test('serialise produces a plain JSON string with no functions', () => {
  const s = createRunState({ seed: 2, playerIds: ['p1'] });
  const text = serialise(s);
  assert.equal(typeof text, 'string');
  assert.doesNotThrow(() => JSON.parse(text));
});
