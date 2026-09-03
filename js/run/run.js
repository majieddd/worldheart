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
// what you can build this wave is itself part of the run.
//
// A run OPENS with exactly one card - the tower chosen in the loadout - and
// earns exactly one more per wave, drawn at random from what is unlocked. That
// is the roguelite draw the owner asked for. Unplayed cards are kept rather
// than binned, up to a cap, which is what reconciles it with the earlier
// instruction that the hand should be three: three is the ceiling you hold, one
// is what arrives.
export const HAND_CAP = 3;
// Kept as an alias because it is part of the module's published surface.
export const HAND_SIZE = HAND_CAP;

// What a cleared wave is worth toward permanent unlocks. Flat plus a slope, so
// reaching wave 12 once is worth more than reaching wave 3 four times, and a
// boss pays a real bonus for finishing.
export function coinsForWave(wave, isBoss) {
  return 10 + wave * 2 + (isBoss ? 100 : 0);
}

export function createRun({ seed, playerIds, startGold, profile }) {
  const state = createRunState({ seed, playerIds, startGold });
  const rng = makeRng(seed);
  // The profile is injected, never read from storage: this module may not know
  // that storage exists. An absent profile means a default run, which is what
  // the tests use.
  const prof = profile || { towers: ['bolt'], loadout: 'bolt', bonuses: {} };
  const handCap = HAND_CAP + (prof.bonuses?.quartermaster ? 1 : 0);
  // Everything the profile owns is available from wave one. The in-run unlocks
  // then add whatever is left, so a player who has bought half the roster
  // spends their run unlocking the other half rather than re-earning what they
  // already own.
  if (Array.isArray(prof.towers) && prof.towers.length) {
    state.unlockedTowers = [...new Set(prof.towers)];
  }
  state.coins = 0;
  let draft = null;
  let modifiers = foldModifiers([]);

  // One card per wave, added to what is already in hand. Duplicates are allowed
  // on purpose: with only Bolt unlocked, drawing another Bolt is the correct
  // roll rather than a bug.
  function drawCard() {
    if (state.hand.length >= handCap) return null;
    const tower = pick(rng, state.unlockedTowers);
    state.hand.push(tower);
    return tower;
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
    // very card the player is handed for it.
    const drew = drawCard();
    events.push({ type: 'handDrawn', hand: [...state.hand], drew });

    state.phase = 'building';
  }

  // A run opens with the loadout tower and nothing else.
  state.hand = [prof.loadout && state.unlockedTowers.includes(prof.loadout)
    ? prof.loadout : state.unlockedTowers[0]];

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
    getCoins: () => state.coins,
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
      const coins = coinsForWave(wave, isBossWave(wave));
      state.coins += coins;
      events.push({ type: 'waveCleared', wave, coins });

      if (isBossWave(wave)) {
        state.phase = 'victory';
        events.push({ type: 'runWon', wave, coins: state.coins });
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
