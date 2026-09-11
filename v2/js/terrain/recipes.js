// Authored geometry vocabulary, independent of temperature, material and foliage.
// A planet mixes these groups; any group can carry any biome's surface rules.
// Dimensions are world metres. Change the version when the seeded layout changes.
export const LANDFORM_VERSION = 2;
export const LANDFORM_RECIPES = Object.freeze({
  range: Object.freeze({ label: 'Ridge chain', relief: 'range', gain: 1.18, roughness: .28 }),
  canyon: Object.freeze({ label: 'Winding canyon', relief: 'canyon', gain: 1.65, roughness: .1 }),
  basin: Object.freeze({ label: 'Open basin', relief: 'range', gain: .42, roughness: .08 }),
  hills: Object.freeze({ label: 'Rolling foothills', relief: 'range', gain: .16, roughness: .04 }),
  mesa: Object.freeze({ label: 'Eroded tableland', relief: 'canyon', gain: 1, roughness: .04 }),
});

export function formationHeightLimit(profile) {
  return Math.max(...Object.values(LANDFORM_RECIPES).map(r => profile[r.relief] * r.gain * 1.22),
    ...(profile.formations?.groups || []).map(g => g.height || 0)) + 2;
}
export const LANDFORM_MIXES = Object.freeze({
  varied: Object.freeze({ spacing: 104, valley: 6, weights: { range: 4, canyon: 2, basin: 1, hills: 3, mesa: 1 } }),
  alpine: Object.freeze({ spacing: 158, valley: 8, weights: { range: 7, canyon: 2, basin: 1, hills: 1, mesa: 1 } }),
  canyon: Object.freeze({ spacing: 116, valley: 6, weights: { range: 2, canyon: 6, basin: 1, hills: 1, mesa: 3 } }),
  ocean: Object.freeze({ spacing: 88, valley: 6, weights: { range: 3, canyon: 2, basin: 2, hills: 4, mesa: 1 } }),
});

export function landformSettings(key = 'varied', overrides = {}) {
  if (!Object.hasOwn(LANDFORM_MIXES, key)) throw new Error(`Unknown landform mix: ${key}`);
  const base = LANDFORM_MIXES[key], result = { ...base, groups: [], ...overrides, weights: { ...base.weights, ...overrides.weights } };
  for (const k of Object.keys(overrides)) if (!['spacing', 'valley', 'weights', 'groups'].includes(k)) throw new Error(`Unknown landform setting: ${k}`);
  if (!Array.isArray(result.groups)) throw new Error('Landform groups must be an array');
  const used = new Set();
  result.groups = result.groups.map(g => {
    if (!g || !Number.isInteger(g.id) || g.id < 0 || used.has(g.id)) throw new Error('Invalid or duplicate landform group id');
    used.add(g.id);
    for (const k of Object.keys(g)) if (!['id', 'dir', 'type', 'height', 'size', 'disabled'].includes(k)) throw new Error(`Unknown group setting: ${k}`);
    if (g.type !== undefined && !Object.hasOwn(LANDFORM_RECIPES, g.type)) throw new Error('Invalid group type');
    if (g.height !== undefined && (!Number.isFinite(g.height) || g.height < 0 || g.height > 160)) throw new Error('Group height must be 0..160 metres');
    if (g.size !== undefined && (!Number.isFinite(g.size) || g.size < .5 || g.size > 1.5)) throw new Error('Group size must be 0.5..1.5');
    if (g.disabled !== undefined && typeof g.disabled !== 'boolean') throw new Error('Invalid group exclusion');
    if (g.dir !== undefined && (!Array.isArray(g.dir) || g.dir.length !== 3 || !g.dir.every(Number.isFinite) || Math.hypot(...g.dir) < .01)) throw new Error('Invalid group direction');
    return { ...g, ...(g.dir ? { dir: [...g.dir] } : {}) };
  });
  if (!Number.isFinite(result.spacing) || result.spacing < 64 || result.spacing > 200) throw new Error('Landform spacing must be 64..200 metres');
  if (!Number.isFinite(result.valley) || result.valley < 4 || result.valley > result.spacing * .12) throw new Error('Invalid valley half-width');
  let total = 0;
  for (const [k, weight] of Object.entries(result.weights)) {
    if (!Object.hasOwn(LANDFORM_RECIPES, k) || !Number.isFinite(weight) || weight < 0) throw new Error(`Invalid landform weight: ${k}`);
    total += weight;
  }
  if (!total) throw new Error('At least one landform must be enabled');
  return result;
}
