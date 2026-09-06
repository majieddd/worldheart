// The shared power draft.
//
// One power per wave for the whole team. Every player sees the same three
// offers and casts one vote. It resolves the moment everyone has voted, or
// when the timer runs out, whichever comes first.
//
// The timer is driven by injected dt rather than a clock, so this is testable
// headlessly and behaves identically on a server tick or a render frame.
//
// Ties break on the run's seeded RNG rather than host preference or arrival
// order, so a run still replays identically and every client can compute the
// same winner without a negotiation round trip.

export const DRAFT_SECONDS = 10;

export function openDraft(offers, playerIds, seconds = DRAFT_SECONDS) {
  return {
    offers,
    playerIds: [...playerIds],
    votes: {},
    remaining: seconds,
    resolved: false,
    winnerIndex: -1,
  };
}

export function castVote(draft, playerId, optionIndex) {
  if (draft.resolved) return false;
  if (!draft.playerIds.includes(playerId)) return false;
  if (!Number.isInteger(optionIndex)) return false;
  if (optionIndex < 0 || optionIndex >= draft.offers.length) return false;
  draft.votes[playerId] = optionIndex;
  return true;
}

function tally(draft) {
  const counts = new Array(draft.offers.length).fill(0);
  for (const id of draft.playerIds) {
    const v = draft.votes[id];
    if (Number.isInteger(v)) counts[v]++;
  }
  return counts;
}

// Returns the leaders. With no votes at all every option leads, which is what
// makes the all-absent case fall through to the same RNG tiebreak.
function leaders(counts) {
  const best = Math.max(...counts);
  const out = [];
  for (let i = 0; i < counts.length; i++) if (counts[i] === best) out.push(i);
  return out;
}

function resolve(draft, rng, reason) {
  const tied = leaders(tally(draft));
  const winnerIndex = tied.length === 1
    ? tied[0]
    : tied[Math.floor(rng() * tied.length)];
  draft.resolved = true;
  draft.winnerIndex = winnerIndex;
  return { winnerIndex, winner: draft.offers[winnerIndex], reason };
}

// Returns the resolution event, or null while the draft is still open. Calling
// it again after resolution returns null rather than re-resolving.
export function tickDraft(draft, dt, rng) {
  if (draft.resolved) return null;

  const everyoneVoted = draft.playerIds.every((id) => Number.isInteger(draft.votes[id]));
  if (everyoneVoted) return resolve(draft, rng, 'unanimous');

  // Solo can wait for a deliberate choice; null survives JSON round trips,
  // unlike Infinity. Timed team drafts retain the injected countdown.
  if (draft.remaining === null) return null;

  draft.remaining -= dt;
  if (draft.remaining <= 0) {
    draft.remaining = 0;
    return resolve(draft, rng, 'timeout');
  }
  return null;
}
