// When each run beat happens. Pure functions of the number of waves cleared,
// with no state of their own, so the shell and the tests agree by construction
// and any of it can be queried out of order.

export const TOTAL_WAVES = 15;
export const BOSS_WAVE = 15;

// Frontier angle in radians. This is the half-angle of the spherical cap the
// player owns; the shell turns it into a confine, a wall and a haze.
// A much tighter opening: the first circle should feel like a foothold, not a
// region. 0.05 rad is about 12 units of surface radius on an R240 world, so a
// handful of towers fills it and the first expansion is dramatic.
export const THETA_START = 0.05;
export const THETA_END = 0.52;

// Fourteen expansions: one earned per wave 1..14. Clearing the boss grants
// none, because the planet itself is that reward.
export const EXPANSIONS = 14;

// The Worldheart's own ladder. Clearing a wave EARNS an expansion, but the
// heart decides how many of them can be HELD: the circle used to widen
// fourteen times whether or not the player did anything, and the owner called
// that pacing too fast. Now each heart level permits a number of rings, and a
// wave cleared past that number is banked until the heart is raised.
//
// Costs are paid in run gold by the shell (the core does not hold gold), one
// entry per level 1..5. Rings are indexed by heart level 0..5: level 0 holds
// only the first foothold expansion, level 5 holds all fourteen.
export const HEART_COSTS = [250, 450, 700, 1000, 1400];
export const HEART_RINGS = [1, 3, 5, 8, 11, 14];
export const MAX_HEART_LEVEL = HEART_COSTS.length;

// Towers may climb two marks on an unraised heart, and one more per level. The
// wave-gated cap this replaces locked upgrades for the first two thirds of a
// run and said nothing about when they would open; this one is bought, so the
// player always knows exactly what raises it.
const BASE_TIER_CAP = 2;

export function heartCost(level) {
  return level < MAX_HEART_LEVEL ? HEART_COSTS[level] : null;
}

export function ringsPermitted(level) {
  return HEART_RINGS[Math.max(0, Math.min(level, MAX_HEART_LEVEL))];
}

export function tierCapForHeart(level) {
  return BASE_TIER_CAP + Math.max(0, Math.min(level, MAX_HEART_LEVEL));
}

// Five unlocks for five unlockable towers, so the roster is complete by wave
// 10 and nothing is left permanently undrawable. Adding the Warden Barracks
// without adding this wave meant one tower could never appear in a run.
const TOWER_UNLOCK_WAVES = [2, 4, 6, 8, 10];
const EVOLUTION_WAVES = [3, 6, 9, 12];

// The two rewards ALTERNATE rather than both arriving every wave: a tower card
// on the odd waves and a drafted power on the even ones. Each wave therefore
// gives exactly one thing, which makes the wave you are about to fight carry a
// specific expectation instead of a handful.
export function drawsCardAfter(wave) {
  return wave % 2 === 1;
}

export function draftsPowerAfter(wave) {
  return wave % 2 === 0;
}

export function isBossWave(wave) {
  return wave === BOSS_WAVE;
}

// Ease-out so the early expansions read as dramatic and the late ones as
// incremental. A linear ramp made every wave feel the same. The argument is
// the number of expansions actually APPLIED, which the run tracks separately
// from waves cleared now that the heart can hold some back.
export function frontierTheta(steps) {
  steps = Math.max(0, Math.min(steps, EXPANSIONS));
  const t = steps / EXPANSIONS;
  const eased = 1 - (1 - t) * (1 - t);
  return THETA_START + eased * (THETA_END - THETA_START);
}

export function unlocksTowerAt(wave) {
  return TOWER_UNLOCK_WAVES.includes(wave);
}

export function evolutionTierAfter(wavesCleared) {
  let tier = 0;
  for (const w of EVOLUTION_WAVES) if (wavesCleared >= w) tier++;
  return tier;
}
