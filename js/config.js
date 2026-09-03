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
    zoomDamp: 5.5,       // lower glides further; the wheel should feel eased
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
/* LIGHTING. Two gaps a 2026-08-31 render audit found, both silent:

   1. Every metal in the game was paying for a reflection it never received.
      `scene.environment` was never set, yet towers.js carries metalness up to
      0.55 and the heart trim 0.35. In the standard BRDF metalness drives
      diffuse albedo toward zero and routes that energy into a specular lobe,
      so metal with nothing to reflect renders DARKER AND FLATTER than
      metalness:0 would. The sky is already a full procedural dome, so the fix
      is one PMREM render at boot and nothing per frame.
   2. Nothing cast a shadow anywhere: a grep for castShadow/receiveShadow/
      shadowMap across all 14 modules returned nothing. DESIGN.md asks for a
      hand-carved museum diorama, and the diorama read is mostly contact shadow.

   envIntensity stays below 1 on purpose. A full-strength environment washes
   out the flat facet shading the dioramic look depends on; this is a metal
   fix, not an ambient-light fix.

   The shadow camera is FOCUS-FITTED, and it has to be. Terrain at detail 7 is
   327,680 triangles: making it a caster means re-rendering all of it into the
   map every frame on a colossal world. Terrain RECEIVES but never CASTS, the
   casters are towers, creatures, decor, heart and portals, and the orthographic
   box tracks rig.lon/lat, which is already the point pinned to screen centre.
   Radius scales with camera altitude so the box stays tight when zoomed in and
   still covers what is visible from orbit. */
export const LIGHTING = {
  envIntensity: 0.62,
  shadows: {
    enabled: true,
    mapSize: 2048,       // 1024 on the low tier, set in main.js
    // Half-width of the ortho shadow box in world units, lerped across zoom.
    radiusNear: 26,
    radiusFar: Math.min(R0 * 0.55, 150),
    depth: Math.max(140, R0 * 0.9),   // ortho near/far span, must clear terrain relief
    bias: -0.0009,
    // normalBias is in WORLD UNITS, and this world's casters are small: a tree
    // is 1-2 units and a tower 2-3. A first pass set this to 0.55 by analogy
    // with scenes built at human scale, which offset the shadow lookup by a
    // third of a tree and erased most of the coverage. Measured under a 12deg
    // raking light, dark pixels in the play area went 639 at 0.55 to 1,414 at
    // 0, i.e. the bias alone was suppressing more than half the shadow. 0.02
    // keeps enough offset to stop facet acne without eating the shadow itself.
    normalBias: 0.02,
  },
};

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
  // Playtested defaults, chosen by the owner 2026-09-03. Do not "correct"
  // these toward earlier values without asking: several of them deliberately
  // reverse an earlier rationale.
  //
  // The lens WIDENS as you close in. A narrow lens up close is a telephoto:
  // it compresses depth, flattens the ground into a map, and reads as
  // "zoomed in" rather than "standing there". The narrower orbit lens keeps
  // the telescope-on-a-ball look that makes the planet read as a sphere.
  fovNear: { min: 5, max: 170, step: 1, def: 83, label: 'Lens · close', unit: '°' },
  fovFar: { min: 5, max: 170, step: 1, def: 37, label: 'Lens · orbit', unit: '°' },
  // How high the camera sits above the ground it is looking at, measured at
  // that point rather than at the camera. Low is a grounded view that just
  // catches the horizon; high looks down like a map. Measuring it at the
  // ground is what makes it independent of world size: the pitch at the
  // camera has to be solved per planet to hold the same angle, because
  // sin(pitch) = (R/Rc)*cos(view) carries the planet radius in it.
  // Renamed from tiltNear/tiltFar so tunings saved under the old, differently
  // meaning keys are not read back inverted.
  //
  // Both ends now sit well clear of the horizon, which also keeps them clear
  // of the pitch solve's degenerate edge: as the view angle flattens onto the
  // horizon, tilt approaches asin(R/Rc) and _placeCamera's clamp starts doing
  // the framing instead of the tuning. camTest floors the flattest view angle
  // at 0.14 rad (8.02 deg) to catch that; 48 is nowhere near it.
  viewNear: { min: 6, max: 88, step: 1, def: 48, label: 'View angle · close', unit: '°' },
  viewFar: { min: 6, max: 88, step: 1, def: 66, label: 'View angle · orbit', unit: '°' },
  // Camera height above the ground, in planet radii, so one setting frames a
  // planetoid and a colossal planet the same way.
  //
  // This number IS the horizon: dip below horizontal is acos(R/(R+h)), which
  // depends only on h/R. 0.04R dips 15.9 degrees, sitting the horizon in
  // frame with a slight, believable curve.
  minAlt: { min: 0.01, max: 4, step: 0.01, def: 0.04, label: 'Min height', unit: '×R' },
  // Deliberately NOT far enough to frame the whole ball. At 0.47R the
  // planet's angular radius is 42.9 degrees against an 18.5 degree
  // half-frame, so the globe overflows the edges and orbit reads as a
  // regional command view rather than a body in space. That is the intent:
  // an earlier default of 4.0R framed the entire sphere and was rejected as
  // too far to play from.
  maxAlt: { min: 0.02, max: 14, step: 0.05, def: 0.47, label: 'Max height', unit: '×R' },
  panMul: { min: 10, max: 400, step: 5, def: 100, label: 'Pan speed', unit: '%' },
  zoomSpeed: { min: 5, max: 400, step: 5, def: 10, label: 'Zoom speed', unit: '%' },
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
