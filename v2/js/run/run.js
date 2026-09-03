// The run state machine.
//
// This is the only module that composes the others, and it is still pure: it
// imports nothing outside js/run/, touches no renderer, and takes its time in
// injected dt. It reports what happened by RETURNING events. The shell decides
// what a frontier or an unlock looks like; the run only decides that one
// happened.

import { makeRng, pick } from './rng.js';
import {
  TOTAL_WAVES, frontierTheta, unlocksTowerAt, tierCapAfter,
  evolutionTierAfter, isBossWave,
} from './schedule.js';
import { foldModifiers } from './modifiers.js';
import { POWER_BY_ID, rollOffers } from './powers.js';
import { openDraft, castVote, tickDraft } from './draft.js';
import { createRunState, serialise, STARTING_TOWER } from './state.js';

// Everything unlockable, minus the tower the run is granted at the start.
const UNLOCKABLE_TOWERS = ['cryo', 'mortar', 'tesla', 'helios', 'warden'];

// Towers arrive as a hand of cards rather than an always-available shop, so
// what you can build this wave is itself part of the run. Always exactly three.
export const HAND_SIZE = 3;

export function createRun({ seed, playerIds, startGold }) {
  const state = createRunState({ seed, playerIds, startGold });
  const rng = makeRng(seed);
  let draft = null;
  let modifiers = foldModifiers([]);

  // Duplicates are allowed on purpose: with only Bolt unlocked a hand of three
  // Bolts is the correct offer, and a later hand of two Mortars is a real roll
  // rather than a bug.
  function drawHand() {
    state.hand = [];
    for (let i = 0; i < HAND_SIZE; i++) {
      state.hand.push(pick(rng, state.unlockedTowers));
    }
  }

  function refreshModifiers() {
    modifiers = foldModifiers(state.powers.map((id) => POWER_BY_ID[id]));
  }

  function unlockRandomTower(events) {
    const remaining = UNLOCKABLE_TOWERS.filter((t) => !state.unlockedTowers.includes(t));
    if (remaining.length === 0) return;
    const tower = pick(rng, remaining);
    state.unlockedTowers.push(tower);
    events.push({ type: 'towerUnlocked', tower });
  }

  // Applied once the draft settles, which is also when the wave number moves.
  function advanceAfterDraft(events) {
    const cleared = state.wavesCleared;

    if (unlocksTowerAt(cleared)) unlockRandomTower(events);

    const cap = tierCapAfter(cleared);
    if (cap !== tierCapAfter(cleared - 1)) {
      events.push({ type: 'tierCapRaised', cap });
    }

    const evo = evolutionTierAfter(cleared);
    if (evo !== evolutionTierAfter(cleared - 1)) {
      events.push({ type: 'enemiesEvolved', tier: evo });
    }

    // Drawn after the unlock above, so a tower won this wave can appear in the
    // very hand the player uses next.
    drawHand();
    events.push({ type: 'handDrawn', hand: [...state.hand] });

    state.phase = 'building';
  }

  drawHand();

  return {
    // ---- queries ----
    // While a draft is open the wave has been cleared but not left behind, so
    // the HUD must keep showing the wave just survived rather than jumping ahead.
    getWave: () => (state.phase === 'drafting'
      ? state.wavesCleared
      : Math.min(state.wavesCleared + 1, TOTAL_WAVES)),
    getPhase: () => state.phase,
    getFrontierTheta: () => frontierTheta(state.wavesCleared),
    getUnlockedTowers: () => [...state.unlockedTowers],
    getTierCap: () => tierCapAfter(state.wavesCleared),
    getEvolutionTier: () => evolutionTierAfter(state.wavesCleared),
    getPowers: () => [...state.powers],
    getHand: () => [...state.hand],
    // Spends a card. Returns the tower key played, or null if the index is not
    // a live card - the shell must not be able to build off a stale hand.
    playCard(index) {
      if (!Number.isInteger(index) || index < 0 || index >= state.hand.length) return null;
      return state.hand.splice(index, 1)[0];
    },
    getModifiers: () => modifiers,
    getPlayers: () => state.players,
    getDraft: () => draft,
    isBossWave: () => isBossWave(Math.min(state.wavesCleared + 1, TOTAL_WAVES)),
    serialise: () => serialise(state),

    // ---- transitions ----

    // Called by the shell when the current wave has been survived.
    completeWave() {
      if (state.phase === 'defeat' || state.phase === 'victory') return [];

      const wave = Math.min(state.wavesCleared + 1, TOTAL_WAVES);
      const events = [];
      state.wavesCleared += 1;
      events.push({ type: 'waveCleared', wave });

      if (isBossWave(wave)) {
        state.phase = 'victory';
        events.push({ type: 'runWon', wave });
        return events;
      }

      events.push({ type: 'frontierGrew', theta: frontierTheta(state.wavesCleared) });

      draft = openDraft(rollOffers(rng, state.powers), state.players.map((p) => p.id));
      state.phase = 'drafting';
      events.push({ type: 'draftOpened', offers: draft.offers });
      return events;
    },

    vote(playerId, optionIndex) {
      if (!draft) return false;
      return castVote(draft, playerId, optionIndex);
    },

    // Drives the draft timer. dt is injected; the core never reads a clock.
    tick(dt) {
      if (!draft) return [];
      const result = tickDraft(draft, dt, rng);
      if (!result) return [];

      const events = [];
      state.powers.push(result.winner.id);
      refreshModifiers();
      events.push({
        type: 'powerTaken',
        power: result.winner,
        reason: result.reason,
      });
      draft = null;
      advanceAfterDraft(events);
      return events;
    },

    loseRun() {
      state.phase = 'defeat';
      draft = null;
    },
  };
}

export { STARTING_TOWER };
