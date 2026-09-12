import {TERRAIN_PACKS} from '../run/world-catalogue.js';
import {ADDITIONAL_RECIPES} from './additional-formations.js';
// Authored geometry vocabulary, independent of temperature, material and foliage.
// A planet mixes these groups; any group can carry any biome's surface rules.
// Dimensions are world metres. Change the version when the seeded layout changes.
import {EXOTIC_RECIPES} from './exotic-formations.js';
export const LANDFORM_VERSION = 8;
export const LANDFORM_RECIPES = Object.freeze({
  range: Object.freeze({ label: 'Ridge chain', relief: 'range', gain: 1.18, roughness: .28 }),
  canyon: Object.freeze({ label: 'Winding Valley', relief: 'canyon', gain: 1.65, roughness: .1 }),
  basin: Object.freeze({ label: 'Open basin', relief: 'range', gain: .42, roughness: .08 }),
  hills: Object.freeze({ label: 'Rolling foothills', relief: 'range', gain: .18, roughness: .12 }),
  mesa: Object.freeze({ label: 'Plateau', relief: 'canyon', gain: 1, roughness: .04 }),
  plateau: Object.freeze({ label: 'Terraced plateau', relief: 'canyon', gain: .8, roughness: .06 }),
  ravine: Object.freeze({ label: 'Branching ravine', relief: 'canyon', gain: 1.2, roughness: .14 }),
  crevice: Object.freeze({ label: 'Fault crevices', relief: 'canyon', gain: .65, roughness: .18 }),
  buttes: Object.freeze({ label: 'Eroded butte cluster', relief: 'canyon', gain: 1.15, roughness: .12 }),
  caldera: Object.freeze({ label: 'Breached caldera', relief: 'range', gain: .7, roughness: .14 }),
  dunes: Object.freeze({ label: 'Hill Fields', relief: 'range', gain: .16, roughness: .1 }),
  gorge: Object.freeze({ label: 'Winding Canyon', relief: 'canyon', gain: .6, roughness: .12 }),
  escarpment: Object.freeze({ label: 'Staircase escarpment', relief: 'canyon', gain: 1.05, roughness: .08 }),
  valley: Object.freeze({ label: 'Glacial trough', relief: 'range', gain: .48, roughness: .14 }),
  grand: Object.freeze({ label: 'Great continental rift', relief: 'canyon', gain: 1.15, roughness: .1 }),
  labyrinth: Object.freeze({ label: 'Noctis labyrinth', relief: 'canyon', gain: .95, roughness: .12 }),
  chaos: Object.freeze({ label: 'Rafted crust blocks', relief: 'canyon', gain: .85, roughness: .08 }),
  spine: Object.freeze({ label: 'Razorback ridge', relief: 'range', gain: .92, roughness: .1 }),
  volcano: Object.freeze({ label: 'Lava spill volcano', relief: 'range', gain: 1.02, roughness: .1 }),
  forest: Object.freeze({ label: 'Canopy highlands', relief: 'range', gain: .55, roughness: .08 }),
  ...EXOTIC_RECIPES,
  ...ADDITIONAL_RECIPES,
});

export function formationHeightLimit(profile,composition) {
  const pack=TERRAIN_PACKS[composition?.pack];
  return Math.max(...Object.values(LANDFORM_RECIPES).map(r => Math.max(profile[r.relief],pack?.[r.relief]||0) * r.gain * 1.22),
    ...(profile.formations?.groups || []).map(g => g.height || 0)) + 24;
}
export function formationDepthLimit(profile,composition) {
  return Math.max(...Object.values(LANDFORM_RECIPES).filter(r=>r.relief==='canyon').map(r=>Math.max(profile.canyon,TERRAIN_PACKS[composition?.pack]?.canyon||0)*r.gain*1.22),
    // A height-only override can resolve to a crevice through its seeded mix.
    ...(profile.formations?.groups || []).map(g => g.height || 0)) + 2;
}
export const LANDFORM_MIXES = Object.freeze(Object.fromEntries(Object.entries(TERRAIN_PACKS).map(([key,p])=>[key,{spacing:p.spacing,valley:p.valley,weights:p.weights}])));

export function landformSettings(key = 'varied', overrides = {}) {
  if (!Object.hasOwn(LANDFORM_MIXES, key)) throw new Error(`Unknown landform mix: ${key}`);
  const base = LANDFORM_MIXES[key], result = { ...base, groups: [], ...overrides, weights: { ...base.weights, ...overrides.weights } };
  for (const k of Object.keys(overrides)) if (!['spacing', 'valley', 'weights', 'groups', 'composition'].includes(k)) throw new Error(`Unknown landform setting: ${k}`);
  if(result.composition){
    const c=result.composition;
    if(!Object.hasOwn(TERRAIN_PACKS,c.pack)||!Number.isFinite(c.coverage)||c.coverage<0||c.coverage>1)throw new Error('Invalid terrain composition');
    for(const [key,weight]of Object.entries(c.weights||{}))if(!Object.hasOwn(LANDFORM_RECIPES,key)||!Number.isFinite(weight)||weight<0)throw new Error('Invalid composition weight');
    result.composition={...c,weights:{...c.weights}};
  }
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
