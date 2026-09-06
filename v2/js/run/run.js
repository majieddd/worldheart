// The run state machine.
//
// This is the only module that composes the others, and it is still pure: it
// imports nothing outside js/run/, touches no renderer, and takes its time in
// injected dt. It reports what happened by RETURNING events. The shell decides
// what a frontier or an unlock looks like; the run only decides that one
// happened.

import { makeRng, pick } from './rng.js';
import {
  TOTAL_WAVES, EXPANSIONS, frontierTheta, unlocksTowerAt,
  evolutionTierAfter, isBossWave, drawsCardAfter, draftsPowerAfter,
  heartCost, ringsPermitted, tierCapForHeart, MAX_HEART_LEVEL,
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

export function createRun({ seed, playerIds, startGold, profile, draftSeconds = 10 }) {
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
  state.frontierSteps = prof.bonuses?.scout ? 1 : 0;
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

  // How many rings the run has EARNED: one per cleared wave, never more than
  // there are expansions, because the boss wave is not one.
  function ringsEarned() {
    return Math.min(state.wavesCleared, EXPANSIONS);
  }

  // Applies every expansion that is both earned and permitted by the heart,
  // one frontierGrew per ring so the shell can seed each new band of ground.
  // Called on a cleared wave, where it can add at most one ring, and on a
  // heart upgrade, where it pays out everything the wave count had banked.
  function growFrontier(events) {
    const allowed = Math.min(ringsEarned(), ringsPermitted(state.heartLevel));
    while (state.frontierSteps < allowed) {
      state.frontierSteps += 1;
      events.push({ type: 'frontierGrew', theta: frontierTheta(state.frontierSteps) });
    }
  }

  // Applied once the draft settles, which is also when the wave number moves.
  function advanceAfterDraft(events) {
    const cleared = state.wavesCleared;

    if (unlocksTowerAt(cleared)) unlockRandomTower(events);

    const evo = evolutionTierAfter(cleared);
    if (evo !== evolutionTierAfter(cleared - 1)) {
      events.push({ type: 'enemiesEvolved', tier: evo });
    }

    // A card only on the ODD waves. The even ones pay a power instead, so each
    // wave hands over exactly one thing and the next wave has a shape.
    if (drawsCardAfter(cleared)) {
      // Drawn after the unlock above, so a tower won this wave can appear in
      // the very card the player is handed for it.
      const drew = drawCard();
      events.push({ type: 'handDrawn', hand: [...state.hand], drew });
    }

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
    // The frontier is what has been APPLIED, not what has been cleared: the
    // two differ by however many rings the heart is holding back.
    getFrontierTheta: () => frontierTheta(state.frontierSteps),
    getFrontierSteps: () => state.frontierSteps,
    // Rings earned by waves that the heart cannot yet hold. The HUD shows this
    // so a held frontier reads as a debt the next upgrade pays, not a stall.
    getHeldRings: () => Math.max(0, ringsEarned() - state.frontierSteps),
    getHeartLevel: () => state.heartLevel,
    getHeartCost: () => heartCost(state.heartLevel),
    getTierCap: () => tierCapForHeart(state.heartLevel),
    getUnlockedTowers: () => [...state.unlockedTowers],
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

      // The circle only widens if the heart can hold the new ring. When it
      // cannot, the shell is told so, with the price, because a wave that
      // silently paid nothing was the complaint that made the hand draw loud.
      growFrontier(events);
      if (state.frontierSteps < ringsEarned()) {
        events.push({
          type: 'frontierHeld',
          level: state.heartLevel,
          cost: heartCost(state.heartLevel),
          held: ringsEarned() - state.frontierSteps,
        });
      }

      if (draftsPowerAfter(wave)) {
        draft = openDraft(rollOffers(rng, state.powers), state.players.map((p) => p.id), draftSeconds);
        state.phase = 'drafting';
        events.push({ type: 'draftOpened', offers: draft.offers });
        return events;
      }
      // No draft this wave, so nothing is going to arrive later to advance the
      // run. It has to advance right here or the wave beats - the unlocks, the
      // tier caps, the evolution and the card - would simply never fire on an
      // odd wave.
      advanceAfterDraft(events);
      return events;
    },

    // Raises the Worldheart one level. Gold lives in the shell, so the shell
    // checks the price and deducts it BEFORE calling this; the core only
    // records the level and pays out whatever rings the waves had banked. An
    // ended run or a heart already at its ceiling changes nothing and says so
    // by returning no events, which is what lets the shell refund safely.
    upgradeHeart() {
      if (state.phase === 'defeat' || state.phase === 'victory') return [];
      if (state.heartLevel >= MAX_HEART_LEVEL) return [];
      const cost = heartCost(state.heartLevel);
      state.heartLevel += 1;
      const events = [{ type: 'heartUpgraded', level: state.heartLevel, cost }];
      growFrontier(events);
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
