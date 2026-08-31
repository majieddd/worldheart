// WORLDHEART: single source of tuning. Scene palette here is canonical for WebGL;
// css/style.css :root is canonical for the DOM HUD. Keep the two in sync with DESIGN.md.

const url = new URLSearchParams(location.search);

function stored(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function storeLocal(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

// The worlds, each tagged with its map type. The taxonomy the layouts are
// designed against:
//   planetary   Planetary Battlefield: the entire globe is in play.
//   battlefield Battlefield: one walled zone on a planet's surface, scaled
//               so play inside feels identical to a planetary map; the
//               camera is confined, the outside grays into fog.
//   space       Space Battlefield: floating rock platforms over open void,
//               predetermined balanced positions of varying size; placement
//               stays freeform on each rock, enemies fly the lanes.
// `fieldTheta` confines the battlefield to a spherical cap.
export const MAPS = {
  pocket: {
    name: 'Pocket World',
    mode: 'planetary', modeLabel: 'planetary battlefield',
    tag: 'The classic: a whole globe at war.',
    chip: 'planetoid · 4 breaches',
    radius: 30, terrainDetail: 6, navDetail: 5, pickDetail: 4,
    freqMul: 1, fineAbsolute: true,
    portalWakes: [1, 4, 9, 14],
    fieldTheta: null,
    startGold: 400,
    waterSegs: [168, 112],
    decorMul: 1,
  },
  giant: {
    name: 'Giant World',
    mode: 'planetary', modeLabel: 'planetary battlefield',
    tag: 'A full planet at war. Continents past counting, marches that cross oceans.',
    chip: 'planet · 5 breaches',
    radius: 240, terrainDetail: 7, navDetail: 7, pickDetail: 5,
    freqMul: 1.7, fineAbsolute: true,
    portalWakes: [1, 3, 7, 11, 15],
    fieldTheta: null,
    startGold: 500,
    waterSegs: [320, 214],
    decorMul: 9,
  },
  titan: {
    name: "Titan's Brow",
    mode: 'battlefield', modeLabel: 'battlefield',
    tag: 'One walled front on a full planet. The world rolls on past the horizon.',
    chip: 'planet · walled front · 5 breaches',
    // Same planet class as Giant World: a Battlefield is a section of a real
    // planet, so a campaign can fight several fronts on one world and later
    // play the whole globe with those regions still in place.
    // navDetail 9 is affordable because the graph is pruned to the cap: a
    // walled front needs corridors many nodes wide or every tower severs them.
    radius: 240, terrainDetail: 7, navDetail: 9, pickDetail: 5,
    freqMul: 1.7, fineAbsolute: true,
    portalWakes: [1, 3, 7, 11, 15],
    fieldTheta: 0.28,
    startGold: 450,
    waterSegs: [320, 214],
    decorMul: 1.15,
  },
  reach: {
    name: 'Shattered Reach',
    mode: 'space', modeLabel: 'space battlefield',
    tag: 'Rock platforms adrift over open void. The swarm flies; you hold the stones you choose.',
    chip: 'asteroid field · 5 breaches',
    radius: 70, terrainDetail: 6, navDetail: 7, pickDetail: 5,
    freqMul: 1, fineAbsolute: true,
    portalWakes: [1, 3, 7, 11, 15],
    fieldTheta: 0.5,
    startGold: 450,
    waterSegs: [8, 6],
    decorMul: 0.4,
  },
};

const mapKey = (() => {
  const q = url.get('map');
  if (q && MAPS[q]) return q;
  const s = stored('whMap');
  return s && MAPS[s] ? s : 'pocket';
})();
const MAP = MAPS[mapKey];
const R0 = MAP.radius;

export const CONFIG = {
  seed: Number(url.get('seed')) || Number(stored('whSeed')) || 20260830,
  mapKey,
  map: MAP,
  planetRadius: R0,
  terrainDetail: MAP.terrainDetail,
  navDetail: MAP.navDetail,
  seaLevel: 0,           // terrain height at the waterline
  walkMaxHeight: 2.05,   // above this the ground is cliff and unwalkable
  walkMaxSlope: 0.95,    // height units per surface unit; above this is cliff

  camera: {
    fov: 50,
    // Near scales with the world so the depth buffer keeps precision when the
    // far plane has to reach a colossal planet's vista.
    near: Math.max(2, R0 / 60),
    far: Math.max(2600, R0 * 30),
    distMin: R0 + 4.8,
    // The orbit lens is telephoto, so max distance carries extra headroom to
    // keep the full planet in frame at 30 degrees.
    distMax: Math.min(R0 * 4.6, 620),
    distStart: R0 * 2.15,
    latClamp: 1.42,      // radians, keeps the orbit off the exact poles
    rotSpeed: 0.0052,
    inertia: 6.5,        // exponential damping rate for released drags
    zoomDamp: 8,
    shakeMax: 0.55 * Math.max(1, R0 / 42),
  },

  waves: {
    count: 30,
    prepTime: 22,        // seconds between waves
    firstPrep: 30,
    earlyBonusPerSec: 2,
  },

  economy: {
    startGold: MAP.startGold,
    startLives: 20,
    sellRefund: 0.7,
  },

  limits: {
    maxParticles: 1600,
    maxDamageNumbers: 48,
    maxEnemies: 220,
    maxTransientLights: 3,
  },
};

// All hexes are sRGB. Three converts to linear internally.
export const PALETTE = {
  space: 0x0a0e21,
  horizon: 0x2a3670,
  sunlight: 0xffe9c4,
  sunDisc: 0xfff3d8,
  skyGlow: 0x59d8ff,

  oceanDeep: 0x17578f,
  oceanShore: 0x37c9c0,
  foam: 0xd9fbf4,

  sand: 0xe8d29a,
  meadowLow: 0x4ec98a,
  meadowHigh: 0x7fdd9e,
  forest: 0x2e8f6a,
  cliffLow: 0x6b7a8f,
  cliffHigh: 0x93a3ba,
  snow: 0xe9f1fb,
  soil: 0x8a6a4f,

  trunk: 0x6d5140,
  pine: 0x2e8f6a,
  pineDark: 0x257a5c,
  leaf: 0x5ed494,
  rock: 0x7c8aa0,
  crystal: 0xa9f0ff,

  techBody: 0x3d4757,
  techTrim: 0xcdd8e6,
  techDark: 0x2a3140,
  energy: 0x59f2ff,
  energyHot: 0xbdfaff,
  gold: 0xffc857,

  voidBody: 0x241a38,
  voidPlate: 0x342750,
  voidEmissive: 0xd84dff,
  voidHot: 0xff3fa6,

  heartStone: 0x6a7a96,
  heartCrystal: 0x8ff7ff,

  danger: 0xff5470,
  cloud: 0xe8f0fb,
};

export const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Player-tunable camera feel. The rig reads these every frame, the settings
// panel writes them, and they persist per browser. Ranges double as the
// slider bounds and the load-time sanity clamp.
export const CAM_RANGES = {
  fovNear: { min: 15, max: 170, step: 1, def: 100, label: 'Lens · close', unit: '°' },
  fovFar: { min: 8, max: 170, step: 1, def: 30, label: 'Lens · orbit', unit: '°' },
  tiltNear: { min: -25, max: 85, step: 1, def: 42, label: 'Tilt · close', unit: '°' },
  tiltFar: { min: -25, max: 85, step: 1, def: 2, label: 'Tilt · orbit', unit: '°' },
  minAlt: { min: 1, max: 90, step: 0.5, def: 7, label: 'Min height', unit: '' },
  maxAlt: { min: 0.02, max: 14, step: 0.02, def: 3.6, label: 'Max height', unit: '×R' },
  panMul: { min: 10, max: 400, step: 5, def: 100, label: 'Pan speed', unit: '%' },
  zoomSpeed: { min: 10, max: 400, step: 5, def: 100, label: 'Zoom speed', unit: '%' },
};

export const CAM_TUNE = (() => {
  const out = {};
  let saved = null;
  try { saved = JSON.parse(stored('whCamTune') || 'null'); } catch { saved = null; }
  for (const k of Object.keys(CAM_RANGES)) {
    const r = CAM_RANGES[k];
    const v = saved && typeof saved[k] === 'number' ? saved[k] : r.def;
    out[k] = Math.min(r.max, Math.max(r.min, v));
  }
  return out;
})();

export function saveCamTune() {
  storeLocal('whCamTune', JSON.stringify(CAM_TUNE));
}

export function resetCamTune() {
  for (const k of Object.keys(CAM_RANGES)) CAM_TUNE[k] = CAM_RANGES[k].def;
  saveCamTune();
}
