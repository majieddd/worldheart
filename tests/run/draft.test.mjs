import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../js/run/rng.js';
import { openDraft, castVote, tickDraft, DRAFT_SECONDS } from '../../js/run/draft.js';

const OFFERS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test('a fresh draft is unresolved and holds the full timer', () => {
  const d = openDraft(OFFERS, ['p1']);
  assert.equal(d.resolved, false);
  assert.equal(d.remaining, DRAFT_SECONDS);
  assert.equal(DRAFT_SECONDS, 10);
});

test('a solo draft resolves immediately once the only player votes', () => {
  const d = openDraft(OFFERS, ['p1']);
  castVote(d, 'p1', 2);
  const ev = tickDraft(d, 0, makeRng(1));
  assert.equal(d.resolved, true);
  assert.equal(ev.winnerIndex, 2);
  assert.equal(ev.reason, 'unanimous');
});

test('it does not resolve while a player has not voted', () => {
  const d = openDraft(OFFERS, ['p1', 'p2']);
  castVote(d, 'p1', 0);
  assert.equal(tickDraft(d, 1, makeRng(1)), null);
  assert.equal(d.resolved, false);
});

test('it resolves early once every player has voted', () => {
  const d = openDraft(OFFERS, ['p1', 'p2']);
  castVote(d, 'p1', 1);
  castVote(d, 'p2', 1);
  const ev = tickDraft(d, 0, makeRng(1));
  assert.equal(ev.winnerIndex, 1);
  assert.ok(d.remaining > 0, 'should not have waited out the clock');
});

test('plurality wins', () => {
  const d = openDraft(OFFERS, ['p1', 'p2', 'p3']);
  castVote(d, 'p1', 0);
  castVote(d, 'p2', 2);
  castVote(d, 'p3', 2);
  assert.equal(tickDraft(d, 0, makeRng(1)).winnerIndex, 2);
});

test('a player may change their vote before resolution', () => {
  const d = openDraft(OFFERS, ['p1', 'p2']);
  castVote(d, 'p1', 0);
  castVote(d, 'p1', 2);
  castVote(d, 'p2', 2);
  assert.equal(tickDraft(d, 0, makeRng(1)).winnerIndex, 2);
});

test('an unknown player cannot vote', () => {
  const d = openDraft(OFFERS, ['p1']);
  assert.equal(castVote(d, 'intruder', 0), false);
  assert.equal(tickDraft(d, 0, makeRng(1)), null);
});

test('an out-of-range option is rejected', () => {
  const d = openDraft(OFFERS, ['p1']);
  assert.equal(castVote(d, 'p1', 7), false);
  assert.equal(castVote(d, 'p1', -1), false);
  assert.equal(d.resolved, false);
});

test('the timer expiring resolves the draft', () => {
  const d = openDraft(OFFERS, ['p1', 'p2']);
  castVote(d, 'p1', 1);
  const ev = tickDraft(d, DRAFT_SECONDS + 0.1, makeRng(1));
  assert.equal(d.resolved, true);
  assert.equal(ev.winnerIndex, 1);
  assert.equal(ev.reason, 'timeout');
});

test('nobody voting still yields a winner on timeout', () => {
  const d = openDraft(OFFERS, ['p1', 'p2']);
  const ev = tickDraft(d, DRAFT_SECONDS, makeRng(5));
  assert.equal(d.resolved, true);
  assert.ok(ev.winnerIndex >= 0 && ev.winnerIndex < 3);
  assert.equal(ev.reason, 'timeout');
});

test('a tie breaks on the seeded rng, identically for the same seed', () => {
  const runOnce = () => {
    const d = openDraft(OFFERS, ['p1', 'p2']);
    castVote(d, 'p1', 0);
    castVote(d, 'p2', 1);
    return tickDraft(d, 0, makeRng(77)).winnerIndex;
  };
  const first = runOnce();
  assert.equal(runOnce(), first);
  assert.ok(first === 0 || first === 1, 'tiebreak must pick a tied option');
});

test('resolving twice does not change the outcome', () => {
  const d = openDraft(OFFERS, ['p1']);
  castVote(d, 'p1', 1);
  const a = tickDraft(d, 0, makeRng(1));
  assert.equal(tickDraft(d, 5, makeRng(2)), null);
  assert.equal(a.winnerIndex, 1);
});
