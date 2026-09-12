// When each run beat happens. Pure functions of the number of waves cleared,
// with no state of their own, so the shell and the tests agree by construction
// and any of it can be queried out of order.

export const TOTAL_WAVES = 10;
export const BOSS_WAVE = 10;

// Frontier angle in radians. This is the half-angle of the spherical cap the
// player owns; the shell turns it into a confine, a wall and a haze.
// A much tighter opening: the first circle should feel like a foothold, not a
// region. 0.05 rad is about 12 units of surface radius on an R240 world, so a
// handful of towers fills it and the first expansion is dramatic.
export const THETA_START = 0.05;
export const THETA_END = Math.PI;

// Ten paid steps across the complete planet. They are granted
// only by explicit base upgrades; no wave grants a ring.
export const EXPANSIONS = 10;

// A purchase pays its full territory immediately, independently of wave count.
// The shell quotes a mixture of gold and deposited crystal credit. Level zero
// is the original foothold; Forward Scout alters only the initial start.
export const HEART_COSTS = [180, 280, 420, 620, 880, 1200, 1600, 2100, 2700, 3400];
export const HEART_RINGS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
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
  return wave > 0 && wave % BOSS_WAVE === 0;
}

// Accelerating expansion keeps the opening tactical, then makes increasingly
// large regional purchases. The final upgrade includes the antipode. Waves
// never grant territory; steps count paid upgrades (plus Forward Scout).
export function frontierTheta(steps) {
  steps = Math.max(0, Math.min(steps, EXPANSIONS));
  const t = steps / EXPANSIONS;
  const eased = t ** 2.35;
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
