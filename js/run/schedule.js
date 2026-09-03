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

// Fourteen expansions: after waves 1..14. Clearing the boss grants none,
// because the planet itself is that reward.
const EXPANSIONS = 14;

const TOWER_UNLOCK_WAVES = [2, 4, 6, 8];
const TIER_CAP_WAVES = [10, 12];
const EVOLUTION_WAVES = [3, 6, 9, 12];

export function isBossWave(wave) {
  return wave === BOSS_WAVE;
}

// Ease-out so the early expansions read as dramatic and the late ones as
// incremental. A linear ramp made every wave feel the same.
export function frontierTheta(wavesCleared) {
  const steps = Math.max(0, Math.min(wavesCleared, EXPANSIONS));
  const t = steps / EXPANSIONS;
  const eased = 1 - (1 - t) * (1 - t);
  return THETA_START + eased * (THETA_END - THETA_START);
}

export function unlocksTowerAt(wave) {
  return TOWER_UNLOCK_WAVES.includes(wave);
}

export function tierCapAfter(wavesCleared) {
  let cap = 1;
  for (const w of TIER_CAP_WAVES) if (wavesCleared >= w) cap++;
  return cap;
}

export function evolutionTierAfter(wavesCleared) {
  let tier = 0;
  for (const w of EVOLUTION_WAVES) if (wavesCleared >= w) tier++;
  return tier;
}
