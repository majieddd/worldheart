import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import {
  makeNoise3D, fbm3, ridged3, mulberry32,
  clamp, lerp, smoothstep,
} from './noise.js';

// The planet: analytic terrain field, faceted terrain mesh, shader water,
// atmosphere, sky, clouds, instanced decor, and the two landmark builders
// (Worldheart, breach portals). The same terrainHeight() drives the visual
// mesh, the nav graph, and unit grounding, so they can never disagree.

export const R = CONFIG.planetRadius;
export const SUN_DIR = new THREE.Vector3(0.62, 0.46, 0.58).normalize();

// Frequency plan per map: continental features scale with the map's freqMul,
// meadow/forest features hold roughly constant absolute size, and facet
// relief tracks the mesh's facet size so every world reads equally crafted.
// All formulas resolve to the original pocket-world values at R30 detail 6.
const FQ = CONFIG.map.freqMul;
const FA = R / 30;
const F_CONT = 0.95 * FQ;
const F_WARP = 1.2 * FQ;
const F_ROLL = 4.3 * FA;
const F_MOIST = 4.6 * (1 + (FA - 1) * 0.8);
const F_RIDGE = 2.35 * FQ;
const F_FINE = Math.pow(2, CONFIG.terrainDetail) / 3.048;
const F_FINE2 = F_FINE * 2.476;

// Battlefield cap for section-of-planet maps: null center means the whole
// globe is in play. Set before any mesh building.
export const BATTLEFIELD = { center: null, theta: 0 };
export function setBattlefield(centerDir, theta) {
  BATTLEFIELD.center = centerDir.clone().normalize();
  BATTLEFIELD.theta = theta;
}
export function inBattlefield(dx, dy, dz, margin = 0) {
  if (!BATTLEFIELD.center) return true;
  const c = BATTLEFIELD.center;
  const dot = dx * c.x + dy * c.y + dz * c.z;
  return Math.acos(Math.min(Math.max(dot, -1), 1)) <= BATTLEFIELD.theta + margin;
}

let nWarp, nBase, nDetail, nRidge, nMoist;

// Space Battlefield layout: predetermined, balanced platform positions of
// varying size, regenerated deterministically per seed. Null on ground maps.
export let SPACE = null;

function initSpaceLayout(seed) {
  const rng = mulberry32(seed ^ 0x50ACE);
  const center = new THREE.Vector3();
  for (let t = 0; t < 400; t++) {
    center.set(rng() * 2 - 1, (rng() * 2 - 1) * 0.5, rng() * 2 - 1);
    if (center.lengthSq() > 1 || center.lengthSq() < 0.01) continue;
    center.normalize();
    if (center.dot(SUN_DIR) >= 0.3) break;
  }
  if (center.dot(SUN_DIR) < 0.3) center.copy(SUN_DIR);

  const theta = CONFIG.map.fieldTheta;
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  tangentBasis(center, e1, e2);
  const sites = [];

  // Altitude and attitude are the map's signature: every rock hangs at its
  // own height AND tilts on its own axis (the tilt is baked into the height
  // field, so tower normals, meshes, and grounding all agree). The swarm
  // flies in altitude bands; high rocks command high lanes.
  const finishSite = (d, r, kind, alt) => {
    const az = rng() * Math.PI * 2;
    const tx = e1.clone().multiplyScalar(Math.cos(az)).addScaledVector(e2, Math.sin(az));
    // re-orthogonalize against this site's own direction
    tx.addScaledVector(d, -tx.dot(d)).normalize();
    const tiltMag = kind === 'heart' ? 0.06 : kind === 'portal' ? 0.12 : 0.16 + rng() * 0.3;
    // Floor the sink depth: a rock so deep that no tower can reach even the
    // low flight lane is a trap, not a choice.
    sites.push({ dir: d, r, kind, alt: Math.max(alt, -4.5), tilt: tx, tiltMag });
  };
  const placeAt = (ang, az, r, kind, alt) => {
    const d = center.clone().multiplyScalar(Math.cos(ang))
      .addScaledVector(e1, Math.sin(ang) * Math.cos(az))
      .addScaledVector(e2, Math.sin(ang) * Math.sin(az))
      .normalize();
    finishSite(d, r, kind, alt);
  };

  placeAt(0, 0, 4.8, 'heart', 0);
  const portalAlts = [-4, 1, 6, -2, 3.5];
  for (let i = 0; i < 5; i++) {
    placeAt(theta * (0.38 + rng() * 0.1), (i / 5) * Math.PI * 2 + rng() * 0.4,
      2.7 + rng() * 0.9, 'plat', (rng() - 0.5) * 7);
  }
  for (let i = 0; i < 5; i++) {
    placeAt(theta * (0.85 + rng() * 0.07), (i / 5) * Math.PI * 2 + 0.63 + rng() * 0.25,
      2.5, 'portal', portalAlts[i]);
  }
  // tall spire rocks: small footprint, commanding altitude
  for (let i = 0; i < 4; i++) {
    placeAt(theta * (0.5 + rng() * 0.22), (i / 4) * Math.PI * 2 + 0.4 + rng() * 0.5,
      1.65, 'spire', 6 + rng() * 3.5);
  }
  const tryPlace = (angMin, angMax, r, kind, altSpread, sepPad) => {
    const ang = theta * (angMin + rng() * (angMax - angMin));
    const az = rng() * Math.PI * 2;
    const d = center.clone().multiplyScalar(Math.cos(ang))
      .addScaledVector(e1, Math.sin(ang) * Math.cos(az))
      .addScaledVector(e2, Math.sin(ang) * Math.sin(az)).normalize();
    for (const s of sites) {
      const sep = Math.acos(clamp(d.dot(s.dir), -1, 1)) * R;
      if (sep < s.r + r + sepPad) return;
    }
    finishSite(d, r, kind, (rng() - 0.5) * altSpread);
  };
  let guard = 0;
  while (sites.length < 23 && guard++ < 320) tryPlace(0.52, 0.78, 1.7 + rng() * 1.3, 'plat', 12, 2.2);
  guard = 0;
  while (sites.length < 32 && guard++ < 320) tryPlace(0.16, 0.94, 1.15, 'small', 15, 1.8);

  SPACE = { center, theta, sites };
}

export function initTerrainField(seed) {
  nWarp = makeNoise3D(seed ^ 0x9e3779b9);
  nBase = makeNoise3D(seed);
  nDetail = makeNoise3D(seed ^ 0x51ab3c);
  nRidge = makeNoise3D(seed ^ 0x7f4a7c15);
  nMoist = makeNoise3D(seed ^ 0x2545f4);
  if (CONFIG.map.mode === 'space') initSpaceLayout(seed);
}

// includeFine=false gives the gameplay surface: the same terrain minus the
// cosmetic facet relief, so walkability never fractures on visual noise.
export function terrainHeight(dx, dy, dz, includeFine = true) {
  // Space maps have no continents: a deep void with authored rock platforms
  // hanging at their own altitudes.
  if (SPACE) {
    // Each rock is a slab of finite thickness: the rim drops a fixed amount
    // below its own surface, never all the way to the void floor (blending
    // to the global void stretched every rock into a stone needle).
    let h = -14;
    for (const s of SPACE.sites) {
      const dot = dx * s.dir.x + dy * s.dir.y + dz * s.dir.z;
      const rAng = s.r / R;
      if (dot < Math.cos(rAng * 1.5)) continue;
      const ang = Math.acos(clamp(dot, -1, 1));
      const edge = 1 - smoothstep(rAng * 0.55, rAng * 1.12, ang);
      if (edge <= 0) continue;
      const rock = fbm3(nDetail, dx * 9 + 13, dy * 9, dz * 9, 3);
      const lateral = (dx * s.tilt.x + dy * s.tilt.y + dz * s.tilt.z) * R;
      const surf = 1.3 + s.alt + rock * 0.85 + lateral * s.tiltMag;
      const drop = clamp(s.r * 1.1, 2.2, 4.2);
      h = Math.max(h, surf - Math.pow(1 - edge, 1.6) * drop);
    }
    return h;
  }
  const w = 0.26;
  const wx = dx + nWarp(dx * F_WARP + 7.7, dy * F_WARP, dz * F_WARP) * w;
  const wy = dy + nWarp(dx * F_WARP, dy * F_WARP + 3.1, dz * F_WARP) * w;
  const wz = dz + nWarp(dx * F_WARP, dy * F_WARP, dz * F_WARP + 5.3) * w;
  const c = fbm3(nBase, wx * F_CONT, wy * F_CONT, wz * F_CONT, 4);
  const cont = smoothstep(-0.14, 0.22, c);
  let h = lerp(-1.65 + 0.5 * c, 0.24, cont);
  const rolling = fbm3(nDetail, dx * F_ROLL, dy * F_ROLL, dz * F_ROLL, 3);
  h += cont * (0.3 + rolling * 0.44);
  if (includeFine) {
    const fine = fbm3(nDetail, dx * F_FINE + 53, dy * F_FINE, dz * F_FINE, 2);
    const fine2 = nDetail(dx * F_FINE2 + 17, dy * F_FINE2, dz * F_FINE2);
    h += cont * (fine * 0.17 + fine2 * 0.05);
  }
  // Mountains only in deep continental cores, so ranges read as landmarks
  // instead of bisecting every landmass.
  const mMask = smoothstep(0.44, 0.72, c);
  if (mMask > 0.001) {
    const ridg = ridged3(nRidge, dx * F_RIDGE + 11, dy * F_RIDGE, dz * F_RIDGE, 4);
    h += mMask * Math.pow(Math.max(ridg, 0), 1.5) * 3.4;
  }
  return h;
}

export function moistureAt(dx, dy, dz) {
  return fbm3(nMoist, dx * F_MOIST + 31, dy * F_MOIST, dz * F_MOIST, 3);
}

export function forestAt(dx, dy, dz) {
  return smoothstep(0.16, 0.30, moistureAt(dx, dy, dz));
}

const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3();
const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3();
const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();

function tangentBasis(dir, outA, outB) {
  if (Math.abs(dir.y) < 0.93) outA.set(0, 1, 0);
  else outA.set(1, 0, 0);
  outB.crossVectors(dir, outA).normalize();
  outA.crossVectors(outB, dir).normalize();
}

// Gradient magnitude of the gameplay height field (base terrain, no cosmetic
// relief), in height units per surface unit.
export function slopeAt(dir) {
  const eps = 0.016;
  tangentBasis(dir, _t1, _t2);
  const h0 = terrainHeight(dir.x, dir.y, dir.z, false);
  _p1.copy(dir).addScaledVector(_t1, eps).normalize();
  _p2.copy(dir).addScaledVector(_t2, eps).normalize();
  const h1 = terrainHeight(_p1.x, _p1.y, _p1.z, false);
  const h2 = terrainHeight(_p2.x, _p2.y, _p2.z, false);
  const d = eps * R;
  return Math.hypot((h1 - h0) / d, (h2 - h0) / d);
}

// Walkability reads only the base gameplay field; the cosmetic facet noise
// must never perforate the coastal ribbons that keep the graph connected.
// The forest threshold matches the tree-scatter threshold exactly, so the
// blocked zone is precisely where the player sees trees standing.
export function isWalkableDir(dir) {
  if (!inBattlefield(dir.x, dir.y, dir.z)) return false;
  const h = terrainHeight(dir.x, dir.y, dir.z, false);
  if (h < 0.05 || h > CONFIG.walkMaxHeight) return false;
  if (forestAt(dir.x, dir.y, dir.z) > 0.78 && h > 0.24 && h < 1.8) return false;
  if (slopeAt(dir) > CONFIG.walkMaxSlope) return false;
  return true;
}

// Coarse "is this land" test for seed scouting. Slope and forest rejection is
// meaningless at scout spacing (it shatters a continent into islands that do
// not exist at play resolution), so seed selection only asks about landmass.
export function isLandDir(dir) {
  if (!inBattlefield(dir.x, dir.y, dir.z)) return false;
  const h = terrainHeight(dir.x, dir.y, dir.z, false);
  return h >= 0.05 && h <= CONFIG.walkMaxHeight + 1.2;
}

// Where towers may stand. On ground maps this is walkability; on space maps
// it is any rock surface, sides included (towers align to the local normal,
// so building on a spire's flank is the point, not an accident).
export function isBuildableDir(dir) {
  if (!SPACE) return isWalkableDir(dir);
  if (!inBattlefield(dir.x, dir.y, dir.z)) return false;
  let onRock = false;
  for (const s of SPACE.sites) {
    const dot = dir.x * s.dir.x + dir.y * s.dir.y + dir.z * s.dir.z;
    if (Math.acos(clamp(dot, -1, 1)) < (s.r * 0.86) / R) { onRock = true; break; }
  }
  if (!onRock) return false;
  // Rock faces steeper than ~45 degrees are cliffs: a tower planted there
  // leans into the stone instead of standing on it.
  groundNormal(dir, _bn);
  return _bn.dot(dir) > 0.71;
}
const _bn = new THREE.Vector3();

// Analytic ray-to-surface intersection: enter the terrain shell, march, then
// bisect. Exact at any planet scale and free of the tessellation error a mesh
// proxy carries (a coarse proxy on a huge world lands clicks units away from
// where the player aimed).
const _rp = new THREE.Vector3();
export function raycastTerrain(origin, dir, out) {
  const isSpace = !!SPACE;
  const rMax = R + (isSpace ? 13 : 6.5);
  const rMin = R - (isSpace ? 13 : 0.5);
  const floor = isSpace ? -1e9 : 0.03;

  const b = origin.dot(dir);
  const oo = origin.lengthSq();
  const discOut = b * b - (oo - rMax * rMax);
  if (discOut <= 0) return false;
  const sOut = Math.sqrt(discOut);
  let t0 = -b - sOut;
  let t1 = -b + sOut;
  if (t1 <= 0) return false;
  if (t0 < 0) t0 = 0;
  const discIn = b * b - (oo - rMin * rMin);
  if (discIn > 0) {
    const tIn = -b - Math.sqrt(discIn);
    if (tIn > t0) t1 = Math.min(t1, tIn);
  }
  if (t1 <= t0) return false;

  const depthAt = (t) => {
    _rp.copy(dir).multiplyScalar(t).add(origin);
    const len = _rp.length();
    if (len < 1e-6) return 1;
    const inv = 1 / len;
    const h = terrainHeight(_rp.x * inv, _rp.y * inv, _rp.z * inv);
    return len - (R + Math.max(h, floor));
  };

  const span = t1 - t0;
  const steps = Math.min(512, Math.max(16, Math.ceil(span / 0.45)));
  const step = span / steps;
  if (depthAt(t0) <= 0) { out.copy(dir).multiplyScalar(t0).add(origin); return true; }
  let prev = t0;
  for (let i = 1; i <= steps; i++) {
    const t = t0 + i * step;
    if (depthAt(t) <= 0) {
      let lo = prev, hi = t;
      for (let k = 0; k < 22; k++) {
        const mid = (lo + hi) * 0.5;
        if (depthAt(mid) <= 0) hi = mid; else lo = mid;
      }
      out.copy(dir).multiplyScalar(hi).add(origin);
      return true;
    }
    prev = t;
  }
  return false;
}

export function surfacePoint(dir, out) {
  // Ground maps clamp to the waterline; space maps follow the true rock
  // surface so sunken platforms actually sink (only the void floor clamps).
  const floor = SPACE ? -12 : 0.03;
  const h = Math.max(terrainHeight(dir.x, dir.y, dir.z), floor);
  return out.copy(dir).multiplyScalar(R + h);
}

export function groundNormal(dir, out) {
  const eps = 0.015;
  tangentBasis(dir, _e1, _e2);
  surfacePoint(dir, _p0);
  _t1.copy(dir).addScaledVector(_e1, eps).normalize();
  surfacePoint(_t1, _p1);
  _t2.copy(dir).addScaledVector(_e2, eps).normalize();
  surfacePoint(_t2, _p2);
  _p1.sub(_p0); _p2.sub(_p0);
  out.crossVectors(_p1, _p2).normalize();
  if (out.dot(dir) < 0) out.negate();
  return out;
}

// ---------------------------------------------------------------------------

const C = {};
for (const k of Object.keys(PALETTE)) C[k] = new THREE.Color(PALETTE[k]);
const SEABED = new THREE.Color(0x2e4a66);
const MOSS = new THREE.Color(0x2a7d58);

const SPACE_ROCK = new THREE.Color(0x8b8f9c);
const SPACE_RUST = new THREE.Color(0xa08d76);
const SPACE_UNDER = new THREE.Color(0x474c5c);

function faceColor(dir, h, slope, jrand, out) {
  if (SPACE) {
    const roll = fbm3(nDetail, dir.x * 7 + 5, dir.y * 7, dir.z * 7, 2);
    if (h < 0.75) {
      out.copy(SPACE_UNDER);
    } else {
      out.copy(SPACE_ROCK).lerp(SPACE_RUST, clamp(0.5 + roll * 0.9, 0, 1));
      if (slope > 0.8) out.lerp(SPACE_UNDER, 0.45);
    }
    const j = 1 + (jrand - 0.5) * 0.2;
    out.multiplyScalar(j);
    return out;
  }
  if (h < 0) {
    out.copy(C.sand).lerp(SEABED, smoothstep(-0.03, -1.25, h));
  } else if (h < 0.13) {
    out.copy(C.sand);
    out.lerp(C.meadowLow, smoothstep(0.06, 0.13, h) * 0.6);
  } else {
    const forest = forestAt(dir.x, dir.y, dir.z);
    const roll = fbm3(nDetail, dir.x * 6.5, dir.y * 6.5, dir.z * 6.5, 2);
    out.copy(C.meadowLow).lerp(C.meadowHigh, clamp(0.5 + roll * 0.9, 0, 1));
    if (forest > 0.55) out.lerp(MOSS, smoothstep(0.55, 0.75, forest) * 0.75);
    const cliff = smoothstep(0.62, 1.0, slope) * smoothstep(0.24, 0.5, h) + smoothstep(1.75, 2.45, h) * 0.75;
    if (cliff > 0) {
      _cliffCol.copy(C.cliffLow).lerp(C.cliffHigh, smoothstep(1.2, 3.2, h));
      out.lerp(_cliffCol, clamp(cliff, 0, 1));
    }
    const snow = smoothstep(2.45, 2.95, h + jrand * 0.25) +
      smoothstep(0.945, 0.985, Math.abs(dir.y)) * smoothstep(0.25, 0.6, h);
    if (snow > 0) out.lerp(C.snow, clamp(snow, 0, 1));
  }
  const j = 1 + (jrand - 0.5) * 0.17;
  out.r = clamp(out.r * j, 0, 1);
  out.g = clamp(out.g * (1 + (jrand - 0.5) * 0.11), 0, 1);
  out.b = clamp(out.b * j, 0, 1);
  // Beyond the battlefield wall the world fades toward pale atmospheric haze.
  // It must LIFT, never darken: darkening plus the night side reads as a
  // black moat around the lit battlefield.
  if (BATTLEFIELD.center) {
    const c = BATTLEFIELD.center;
    const ang = Math.acos(clamp(dir.x * c.x + dir.y * c.y + dir.z * c.z, -1, 1));
    const outside = smoothstep(BATTLEFIELD.theta + 0.01, BATTLEFIELD.theta + 0.2, ang);
    if (outside > 0) {
      const gray = (out.r + out.g + out.b) / 3;
      _outsideCol.setRGB(
        Math.min(1, gray * 0.85 + 0.3),
        Math.min(1, gray * 0.9 + 0.33),
        Math.min(1, gray * 1.0 + 0.4),
      );
      out.lerp(_outsideCol, outside * 0.55);
    }
  }
  return out;
}
const _cliffCol = new THREE.Color();
const _outsideCol = new THREE.Color();

// Recursive icosphere with true 4^detail subdivision. THREE's
// IcosahedronGeometry treats detail as edge segments (20*(d+1)^2 faces),
// which is far too coarse here and lets face chords sag below the analytic
// surface, which in turn poisons shore-depth water into dark rings.
function buildIcoGeometry(detail) {
  const t = (1 + Math.sqrt(5)) / 2;
  let verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map((v) => {
    const l = Math.hypot(...v);
    return [v[0] / l, v[1] / l, v[2] / l];
  });
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  for (let d = 0; d < detail; d++) {
    const cache = new Map();
    const mid = (a, b) => {
      const key = a < b ? a * 2097152 + b : b * 2097152 + a;
      let m = cache.get(key);
      if (m !== undefined) return m;
      const va = verts[a], vb = verts[b];
      const v = [va[0] + vb[0], va[1] + vb[1], va[2] + vb[2]];
      const l = Math.hypot(...v);
      m = verts.length;
      verts.push([v[0] / l, v[1] / l, v[2] / l]);
      cache.set(key, m);
      return m;
    };
    const next = [];
    for (const [a, b, c] of faces) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  const pos = new Float32Array(faces.length * 9);
  let o = 0;
  for (const [a, b, c] of faces) {
    for (const vi of [a, b, c]) {
      const v = verts[vi];
      pos[o] = v[0]; pos[o + 1] = v[1]; pos[o + 2] = v[2];
      o += 3;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return geo;
}

function displaceGeometry(geo) {
  const pos = geo.attributes.position;
  const cache = new Map();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const key = ((v.x * 8191.5 + 8192) | 0) * 268435456 + ((v.y * 8191.5 + 8192) | 0) * 16384 + ((v.z * 8191.5 + 8192) | 0);
    let h = cache.get(key);
    if (h === undefined) {
      h = terrainHeight(v.x, v.y, v.z);
      cache.set(key, h);
    }
    pos.setXYZ(i, v.x * (R + h), v.y * (R + h), v.z * (R + h));
  }
  return geo;
}

function buildTerrainMesh() {
  const geo = displaceGeometry(buildIcoGeometry(CONFIG.terrainDetail));
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c3 = new THREE.Vector3();
  const cen = new THREE.Vector3(), n = new THREE.Vector3(), col = new THREE.Color();
  const rng = mulberry32(CONFIG.seed ^ 0xC0FFEE);

  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c3.fromBufferAttribute(pos, i + 2);
    cen.copy(a).add(b).add(c3).multiplyScalar(1 / 3);
    const len = cen.length();
    const h = len - R;
    _p1.copy(b).sub(a); _p2.copy(c3).sub(a);
    n.crossVectors(_p1, _p2).normalize();
    cen.divideScalar(len);
    const slope = 1 - Math.abs(n.dot(cen));
    faceColor(cen, h, slope * 3.2, rng(), col);
    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = col.r;
      colors[(i + k) * 3 + 1] = col.g;
      colors[(i + k) * 3 + 2] = col.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Space maps render only the rock: cull faces that sit in the void so the
  // starfield shows through between platforms.
  if (SPACE) {
    const src = geo.attributes.position;
    const keepPos = [];
    const keepCol = [];
    const a2 = new THREE.Vector3(), b2 = new THREE.Vector3(), c2 = new THREE.Vector3();
    for (let i = 0; i < src.count; i += 3) {
      a2.fromBufferAttribute(src, i);
      b2.fromBufferAttribute(src, i + 1);
      c2.fromBufferAttribute(src, i + 2);
      const la = a2.length() - R, lb = b2.length() - R, lc = c2.length() - R;
      const hC = (la + lb + lc) / 3;
      if (hC < -9.6) continue;
      // seam faces bridging a rock bottom to the void stretch into needles
      if (Math.max(la, lb, lc) - Math.min(la, lb, lc) > 4.5) continue;
      for (let k = 0; k < 3; k++) {
        const vi = i + k;
        keepPos.push(src.getX(vi), src.getY(vi), src.getZ(vi));
        keepCol.push(colors[vi * 3], colors[vi * 3 + 1], colors[vi * 3 + 2]);
      }
    }
    geo.dispose();
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(keepPos), 3));
    g2.setAttribute('color', new THREE.BufferAttribute(new Float32Array(keepCol), 3));
    g2.computeVertexNormals();
    const mat2 = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.05 });
    const mesh2 = new THREE.Mesh(g2, mat2);
    mesh2.name = 'terrain';
    return mesh2;
  }

  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain';
  return mesh;
}

// Rough undersides so each platform reads as a floating asteroid chunk.
function buildAsteroidBellies(rng) {
  const parts = [];
  const col = new THREE.Color(0x565b6b);
  for (const s of SPACE.sites) {
    const p = new THREE.Vector3();
    surfacePoint(s.dir, p);
    const depth = s.kind === 'spire' ? s.r * (1.9 + rng() * 0.5) : s.r * (0.7 + rng() * 0.35);
    // anchored to the rock's actual surface, hanging just beneath it
    p.addScaledVector(s.dir, -(depth * 0.55 + 0.6));
    const m = new THREE.Matrix4()
      .makeTranslation(p.x, p.y, p.z)
      .multiply(new THREE.Matrix4().makeRotationY(rng() * 6.28))
      .multiply(new THREE.Matrix4().makeScale(s.r * 1.02, depth, s.r * 1.02));
    parts.push({ geo: new THREE.IcosahedronGeometry(1, 1), matrix: m, color: col });
  }
  const geo = mergeGeoms(parts);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0.05, flatShading: true,
  }));
  mesh.name = 'bellies';
  return mesh;
}

// Free-floating tumble rocks at arbitrary radii: pure scenery that breaks
// any residual read of a shell the platforms might sit on.
function buildDrifters(rng) {
  const N = 34;
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6a7080, roughness: 0.95, metalness: 0.05, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  tangentBasis(SPACE.center, e1, e2);
  const items = [];
  for (let i = 0; i < N; i++) {
    const ang = SPACE.theta * (0.1 + Math.sqrt(rng()) * 0.92);
    const az = rng() * Math.PI * 2;
    const pos = SPACE.center.clone().multiplyScalar(Math.cos(ang))
      .addScaledVector(e1, Math.sin(ang) * Math.cos(az))
      .addScaledVector(e2, Math.sin(ang) * Math.sin(az))
      .normalize()
      .multiplyScalar(R + (rng() - 0.4) * 15);
    items.push({
      pos,
      quat: new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(), rng() * 6.28),
      axis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
      speed: (rng() - 0.5) * 0.5,
      scale: new THREE.Vector3(0.4 + rng() * 0.7, 0.3 + rng() * 0.5, 0.4 + rng() * 0.7),
    });
  }
  return { mesh, items };
}

// Faint drifting dust motes through the battlefield volume.
function buildSpaceDust(rng) {
  const N = 420;
  const pos = new Float32Array(N * 3);
  const phase = new Float32Array(N);
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  tangentBasis(SPACE.center, e1, e2);
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const ang = SPACE.theta * Math.sqrt(rng());
    const az = rng() * Math.PI * 2;
    v.copy(SPACE.center).multiplyScalar(Math.cos(ang))
      .addScaledVector(e1, Math.sin(ang) * Math.cos(az))
      .addScaledVector(e2, Math.sin(ang) * Math.sin(az))
      .normalize()
      .multiplyScalar(R + 0.5 + rng() * 7);
    pos.set([v.x, v.y, v.z], i * 3);
    phase[i] = rng() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      varying float vA;
      uniform float uTime;
      void main() {
        vec3 p = position + vec3(sin(uTime * 0.21 + aPhase), sin(uTime * 0.17 + aPhase * 2.0), cos(uTime * 0.19 + aPhase)) * 0.6;
        vA = 0.35 + 0.3 * sin(uTime * 0.6 + aPhase * 3.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 2.2;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float m = smoothstep(0.5, 0.1, length(d));
        gl_FragColor = vec4(vec3(0.55, 0.72, 0.85) * m, m * vA * 0.4);
      }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 7;
  return { pts, mat };
}

// Planet-wide cloud deck with a clearing over the battlefield. From orbit
// the whole world reads as weathered; only the war zone is open sky. Gaps in
// the deck let hazy terrain show through so the planet stays a planet.
export function buildCloudDeck(centerDir, theta) {
  const geo = new THREE.SphereGeometry(R + 5.4, 128, 88);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uCenter: { value: centerDir.clone() },
      uTheta: { value: theta },
      uSun: { value: SUN_DIR },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform float uTime, uTheta;
      uniform vec3 uCenter, uSun;
      void main() {
        vec3 d = normalize(vDir);
        float ang = acos(clamp(dot(d, uCenter), -1.0, 1.0));
        float outside = smoothstep(uTheta + 0.015, uTheta + 0.2, ang);
        if (outside <= 0.001) discard;

        // layered drifting puffs
        float n1 = sin(d.x * 21.0 + uTime * 0.016 + sin(d.z * 13.0)) *
                   sin(d.y * 17.0 - uTime * 0.011 + sin(d.x * 11.0));
        float n2 = sin(d.z * 33.0 - uTime * 0.021 + sin(d.y * 19.0)) *
                   sin(d.x * 27.0 + uTime * 0.013);
        float puff = smoothstep(-0.5, 0.55, n1 * 0.65 + n2 * 0.35);

        float light = clamp(dot(d, uSun) * 0.55 + 0.62, 0.3, 1.05);
        vec3 col = mix(vec3(0.3, 0.34, 0.46), vec3(0.94, 0.96, 1.0), light * (0.55 + puff * 0.45));

        float a = outside * (0.3 + puff * 0.62);
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.92));
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 5;
  return { mesh, mat };
}

function buildPickProxy() {
  const geo = displaceGeometry(buildIcoGeometry(CONFIG.map.pickDetail));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
  mesh.name = 'pickProxy';
  return mesh;
}

// ---------------------------------------------------------------------------

function buildWater() {
  const geo = new THREE.SphereGeometry(R + 0.05, CONFIG.map.waterSegs[0], CONFIG.map.waterSegs[1]);
  const pos = geo.attributes.position;
  const depth = new Float32Array(pos.count);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    depth[i] = Math.max(0, -terrainHeight(v.x, v.y, v.z));
  }
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: SUN_DIR },
      uDeep: { value: C.oceanDeep },
      uShore: { value: new THREE.Color(0x2fb4ae) },
      uFoam: { value: C.foam },
      uSunCol: { value: C.sunlight },
      uSky: { value: C.skyGlow },
    },
    vertexShader: /* glsl */ `
      attribute float aDepth;
      varying vec3 vPos;
      varying vec3 vNormal;
      varying float vDepth;
      uniform float uTime;
      void main() {
        vNormal = normalize(position);
        vDepth = aDepth;
        vec3 p = position + vNormal * (
          sin(uTime * 1.05 + position.x * 1.4 + position.z * 1.1) * 0.024 +
          sin(uTime * 0.72 + position.y * 2.1 + position.x * 0.8) * 0.02
        );
        vPos = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vPos;
      varying vec3 vNormal;
      varying float vDepth;
      uniform float uTime;
      uniform vec3 uSun, uDeep, uShore, uFoam, uSunCol, uSky;
      void main() {
        vec3 view = normalize(cameraPosition - vPos);
        vec3 n = normalize(vNormal
          + 0.055 * vec3(sin(vPos.x * 2.9 + uTime * 1.5), sin(vPos.y * 2.6 + uTime * 1.2), sin(vPos.z * 3.2 + uTime * 1.7))
          + 0.03 * vec3(sin(vPos.z * 7.1 + uTime * 2.4), sin(vPos.x * 6.3 - uTime * 2.1), sin(vPos.y * 7.7 + uTime * 2.7)));

        vec3 base = mix(uShore, uDeep, smoothstep(0.02, 0.75, vDepth));
        base = mix(base, uDeep * 0.74, smoothstep(1.0, 2.1, vDepth));
        float d = clamp(dot(n, uSun) * 0.55 + 0.5, 0.0, 1.0);
        vec3 col = base * (0.38 + 0.72 * d);

        vec3 h = normalize(uSun + view);
        col += uSunCol * pow(max(dot(n, h), 0.0), 130.0) * 1.35;

        float fres = pow(1.0 - max(dot(n, view), 0.0), 3.4);
        col = mix(col, uSky * 0.5, fres * 0.22);

        float band = smoothstep(0.1, 0.025, vDepth) * step(0.004, vDepth);
        float fn = sin(vPos.x * 5.1 + vPos.y * 4.3 + uTime * 1.4) * sin(vPos.z * 5.7 - uTime * 1.1);
        float foam = band * smoothstep(0.1, 0.8, fn * 0.5 + 0.5);
        foam += smoothstep(0.016, 0.0, vDepth) * 0.42;
        col = mix(col, uFoam, clamp(foam, 0.0, 1.0) * 0.85);

        float alpha = mix(0.86, 0.985, smoothstep(0.05, 1.0, vDepth));
        alpha = max(alpha, foam * 0.9);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  mesh.name = 'water';
  return mesh;
}

function buildAtmosphere() {
  const geo = new THREE.SphereGeometry(R * 1.17, 64, 48);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(0x3f9fdd) } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vP;
      void main() {
        vN = normalize(position);
        vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vN; varying vec3 vP;
      uniform vec3 uColor;
      void main() {
        vec3 view = normalize(cameraPosition - vP);
        float f = 1.0 - abs(dot(view, vN));
        float glow = pow(f, 4.6);
        gl_FragColor = vec4(uColor * glow * 0.85, glow * 0.6);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  return mesh;
}

// ---------------------------------------------------------------------------

function buildSky(rng) {
  const group = new THREE.Group();
  group.name = 'sky';
  // Vista distances scale with the planet so the backdrop never crowds a
  // colossal world (a fixed 1250-unit gas giant would sit in orbit of one).
  const VIS = Math.max(1, R / 60);

  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSun: { value: SUN_DIR },
      uSpace: { value: C.space },
      uHorizon: { value: C.horizon },
      uWarm: { value: C.sunlight },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uSun, uSpace, uHorizon, uWarm;
      void main() {
        vec3 d = normalize(vDir);
        float band = 1.0 - abs(d.y);
        vec3 col = mix(uSpace, uHorizon, pow(band, 2.6) * 0.85);
        float s = max(dot(d, uSun), 0.0);
        col += uWarm * (pow(s, 10.0) * 0.16 + pow(s, 90.0) * 0.5);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1600 * VIS, 32, 20), domeMat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  group.add(dome);

  // Stars
  const N = 1400;
  const sp = new Float32Array(N * 3);
  const sPhase = new Float32Array(N);
  const sSize = new Float32Array(N);
  const sTint = new Float32Array(N * 3);
  const tv = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    tv.set(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize().multiplyScalar(1500 * VIS);
    sp.set([tv.x, tv.y, tv.z], i * 3);
    sPhase[i] = rng() * Math.PI * 2;
    sSize[i] = 0.8 + Math.pow(rng(), 2.6) * 1.2;
    const t = rng();
    let cr = 1, cg = 1, cb = 1;
    if (t < 0.05) { cr = 1; cg = 0.9; cb = 0.78; }
    else if (t < 0.1) { cr = 0.82; cg = 0.92; cb = 1; }
    sTint.set([cr, cg, cb], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(sPhase, 1));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
  starGeo.setAttribute('aTint', new THREE.BufferAttribute(sTint, 3));
  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aSize;
      attribute vec3 aTint;
      varying float vTw;
      varying vec3 vTint;
      uniform float uTime;
      void main() {
        vTw = 0.62 + 0.38 * sin(uTime * (0.6 + aPhase * 0.23) + aPhase * 7.0);
        vTint = aTint;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * 2.1;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vTw;
      varying vec3 vTint;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float m = smoothstep(0.5, 0.05, length(d));
        gl_FragColor = vec4(vTint * vTw * m, m * vTw);
      }
    `,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  group.add(stars);

  // Ringed gas giant vista
  const giant = new THREE.Group();
  const gMat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vLocal;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vN; varying vec3 vLocal;
      uniform vec3 uSun;
      void main() {
        float y = vLocal.y / 130.0;
        float warp = sin(vLocal.x * 0.045 + vLocal.z * 0.03) * 0.35;
        float bands = sin(y * 16.0 + warp * 3.0) * 0.5 + 0.5;
        float bands2 = sin(y * 5.0 - warp * 2.0 + 1.7) * 0.5 + 0.5;
        vec3 a = vec3(0.24, 0.31, 0.50);
        vec3 b = vec3(0.42, 0.50, 0.70);
        vec3 c = vec3(0.55, 0.48, 0.58);
        vec3 col = mix(a, b, bands);
        col = mix(col, c, bands2 * 0.35);
        float l = clamp(dot(normalize(vN), uSun) * 0.9 + 0.34, 0.16, 1.0);
        gl_FragColor = vec4(col * l, 1.0);
      }
    `,
  });
  const gSphere = new THREE.Mesh(new THREE.SphereGeometry(130 * VIS, 48, 32), gMat);
  giant.add(gSphere);
  const ringMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms: { uSun: { value: SUN_DIR } },
    vertexShader: /* glsl */ `
      varying vec2 vXY;
      varying vec3 vN;
      void main() {
        vXY = position.xy;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vXY;
      varying vec3 vN;
      uniform vec3 uSun;
      void main() {
        float r = length(vXY);
        float t = smoothstep(150.0, 165.0, r) * smoothstep(275.0, 245.0, r);
        float bands = 0.55 + 0.45 * sin(r * 0.55) * sin(r * 0.17 + 2.0);
        float l = clamp(abs(dot(normalize(vN), uSun)) + 0.25, 0.0, 1.0);
        vec3 col = vec3(0.62, 0.68, 0.82) * l;
        gl_FragColor = vec4(col, t * bands * 0.5);
      }
    `,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(150 * VIS, 275 * VIS, 96), ringMat);
  ring.rotation.x = Math.PI / 2 - 0.32;
  giant.add(ring);
  giant.position.set(-0.92, 0.24, 0.18).normalize().multiplyScalar(1250 * VIS);
  giant.lookAt(0, 0, 0);
  giant.rotateZ(0.35);
  giant.renderOrder = -8;
  gSphere.renderOrder = -8;
  ring.renderOrder = -7;
  group.add(giant);

  // Sun disc sprite
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 246, 224, 1)');
  grad.addColorStop(0.22, 'rgba(255, 235, 190, 0.9)');
  grad.addColorStop(0.55, 'rgba(255, 214, 150, 0.28)');
  grad.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const sunTex = new THREE.CanvasTexture(cv);
  sunTex.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
  }));
  sun.position.copy(SUN_DIR).multiplyScalar(1480 * VIS);
  sun.scale.setScalar(190 * VIS);
  sun.renderOrder = -6;
  group.add(sun);

  return { group, stars, starMat };
}

// ---------------------------------------------------------------------------

function mergeGeoms(list) {
  const converted = list.map(({ geo, matrix, color }) => ({
    geo, g: geo.index ? geo.toNonIndexed() : geo, matrix, color,
  }));
  let count = 0;
  for (const { g } of converted) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  let off = 0;
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const { geo, g, matrix, color } of converted) {
    const p = g.attributes.position, n = g.attributes.normal;
    nm.getNormalMatrix(matrix);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      pos.set([v.x, v.y, v.z], (off + i) * 3);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      nor.set([v.x, v.y, v.z], (off + i) * 3);
      col.set([color.r, color.g, color.b], (off + i) * 3);
    }
    off += p.count;
    if (g !== geo) g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3();
const _pos = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function makePineGeometry() {
  const trunkC = new THREE.Color(PALETTE.trunk);
  const p1 = new THREE.Color(PALETTE.pineDark);
  const p2 = new THREE.Color(PALETTE.pine);
  return mergeGeoms([
    { geo: new THREE.CylinderGeometry(0.055, 0.09, 0.5, 5), matrix: _m4.clone().makeTranslation(0, 0.24, 0), color: trunkC },
    { geo: new THREE.ConeGeometry(0.44, 0.72, 6), matrix: _m4.clone().makeTranslation(0, 0.72, 0), color: p1 },
    { geo: new THREE.ConeGeometry(0.33, 0.64, 6), matrix: _m4.clone().makeTranslation(0, 1.08, 0), color: p2 },
    { geo: new THREE.ConeGeometry(0.21, 0.55, 6), matrix: _m4.clone().makeTranslation(0, 1.42, 0), color: p2 },
  ]);
}

function makeBroadleafGeometry() {
  const trunkC = new THREE.Color(PALETTE.trunk);
  const leaf = new THREE.Color(PALETTE.leaf);
  const leaf2 = new THREE.Color(PALETTE.pine);
  const m1 = new THREE.Matrix4().makeTranslation(0.16, 0.86, 0.05).multiply(new THREE.Matrix4().makeScale(1.15, 0.95, 1.1));
  const m2 = new THREE.Matrix4().makeTranslation(-0.2, 0.72, -0.08).multiply(new THREE.Matrix4().makeScale(0.85, 0.8, 0.85));
  return mergeGeoms([
    { geo: new THREE.CylinderGeometry(0.06, 0.1, 0.65, 5), matrix: _m4.clone().makeTranslation(0, 0.3, 0), color: trunkC },
    { geo: new THREE.IcosahedronGeometry(0.4, 1), matrix: m1, color: leaf },
    { geo: new THREE.IcosahedronGeometry(0.34, 1), matrix: m2, color: leaf2 },
  ]);
}

function makeRockGeometry() {
  return mergeGeoms([
    { geo: new THREE.IcosahedronGeometry(0.32, 0), matrix: _m4.clone().makeScale(1.25, 0.8, 1), color: new THREE.Color(PALETTE.rock) },
  ]);
}

function makeCrystalGeometry() {
  const c = new THREE.Color(PALETTE.crystal);
  const m1 = new THREE.Matrix4().makeTranslation(0, 0.42, 0).multiply(new THREE.Matrix4().makeScale(0.75, 2.4, 0.75));
  const m2 = new THREE.Matrix4().makeTranslation(0.2, 0.2, 0.1)
    .multiply(new THREE.Matrix4().makeRotationZ(-0.5))
    .multiply(new THREE.Matrix4().makeScale(0.45, 1.3, 0.45));
  return mergeGeoms([
    { geo: new THREE.OctahedronGeometry(0.22), matrix: m1, color: c },
    { geo: new THREE.OctahedronGeometry(0.2), matrix: m2, color: c },
  ]);
}

function applySway(mat) {
  mat.customProgramCacheKey = () => 'worldheart-sway';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float swPh = dot(iPos, vec3(12.9898, 78.233, 37.719));
        float sw = sin(uTime * 1.35 + swPh) * 0.045 * smoothstep(0.2, 1.5, transformed.y);
        transformed.x += sw;
        transformed.z += sw * 0.6;
      #endif`,
    );
    mat.userData.shader = shader;
  };
}

function scatterDecor(rng) {
  const pineGeo = makePineGeometry();
  const leafGeo = makeBroadleafGeometry();
  const rockGeo = makeRockGeometry();
  const crysGeo = makeCrystalGeometry();

  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  applySway(treeMat);
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const crysMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.3, metalness: 0.1,
    emissive: new THREE.Color(PALETTE.crystal), emissiveIntensity: 0.9,
    transparent: true, opacity: 0.92,
  });

  const spots = { pine: [], leaf: [], rock: [], crys: [] };
  const dir = new THREE.Vector3();
  const mul = CONFIG.map.decorMul;
  const caps = {
    pine: Math.round(820 * mul), leaf: Math.round(130 * mul),
    rock: Math.round(210 * mul), crys: Math.round(64 * mul),
  };
  // With a battlefield cap, decor concentrates in and just beyond the wall;
  // the far side of a titan is scenery nobody lands on.
  const capC = BATTLEFIELD.center;
  const capMax = BATTLEFIELD.theta * 1.5;
  let attempts = 0;
  const maxAttempts = 26000 * Math.max(mul, 1);
  while (attempts++ < maxAttempts && (spots.pine.length < caps.pine || spots.rock.length < caps.rock)) {
    if (capC) {
      const cosMax = Math.cos(capMax);
      const cz = 1 - rng() * (1 - cosMax);
      const sz = Math.sqrt(Math.max(0, 1 - cz * cz));
      const az = rng() * Math.PI * 2;
      tangentBasis(capC, _t1, _t2);
      dir.copy(capC).multiplyScalar(cz)
        .addScaledVector(_t1, sz * Math.cos(az))
        .addScaledVector(_t2, sz * Math.sin(az));
    } else {
      dir.set(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
      if (dir.lengthSq() > 1 || dir.lengthSq() < 0.01) continue;
    }
    dir.normalize();
    const h = terrainHeight(dir.x, dir.y, dir.z);
    if (h < 0.12) continue;
    const forest = forestAt(dir.x, dir.y, dir.z);
    const slope = slopeAt(dir);
    if (!SPACE && forest > 0.78 && h > 0.24 && h < 2.0 && slope < 0.9 && spots.pine.length < caps.pine) {
      spots.pine.push({ dir: dir.clone(), h, s: 0.85 + rng() * 0.75 });
    } else if (!SPACE && forest > 0.34 && forest < 0.55 && h > 0.2 && h < 1.6 && slope < 0.4 && rng() < 0.05 && spots.leaf.length < caps.leaf) {
      spots.leaf.push({ dir: dir.clone(), h, s: 0.8 + rng() * 0.6 });
    } else if (h > 0.14 && h < 2.7 && slope > 0.18 && rng() < 0.16 && spots.rock.length < caps.rock) {
      spots.rock.push({ dir: dir.clone(), h: h - 0.1, s: 0.5 + rng() * 1.1 });
    } else if (h > 1.35 && h < 2.75 && rng() < 0.1 && spots.crys.length < caps.crys) {
      spots.crys.push({ dir: dir.clone(), h, s: 0.7 + rng() * 0.9 });
    }
  }

  function makeInstanced(geo, mat, list, tiltToNormal, colorJitter) {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(list.length, 1));
    const col = new THREE.Color();
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      groundNormal(it.dir, _up).lerp(it.dir, tiltToNormal).normalize();
      _q.setFromUnitVectors(Y_AXIS, _up);
      _q.multiply(new THREE.Quaternion().setFromAxisAngle(Y_AXIS, rng() * Math.PI * 2));
      _pos.copy(it.dir).multiplyScalar(R + it.h - 0.05);
      _s.setScalar(it.s);
      _m4.compose(_pos, _q, _s);
      mesh.setMatrixAt(i, _m4);
      const j = 1 + (rng() - 0.5) * colorJitter;
      col.setRGB(j, j * (1 + (rng() - 0.5) * 0.06), j);
      mesh.setColorAt(i, col);
      it.alive = true;
    }
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  const pines = makeInstanced(pineGeo, treeMat, spots.pine, 0.72, 0.16);
  const leafs = makeInstanced(leafGeo, treeMat, spots.leaf, 0.6, 0.14);
  const rocks = makeInstanced(rockGeo, rockMat, spots.rock, 0.25, 0.2);
  const crys = makeInstanced(crysGeo, crysMat, spots.crys, 0.55, 0.1);

  return { treeMat, crysMat, sets: [
    { mesh: pines, list: spots.pine, crushable: true },
    { mesh: leafs, list: spots.leaf, crushable: true },
    { mesh: rocks, list: spots.rock, crushable: true },
    { mesh: crys, list: spots.crys, crushable: false },
  ] };
}

// ---------------------------------------------------------------------------

function buildClouds(rng) {
  // Opaque with depth, drawn before the water pass: far-side clouds then sit
  // correctly behind the transparent ocean instead of compositing over it.
  // Fully self-lit with a baked vertical gradient: any real lighting model
  // eventually shows a black backside against the sky. Per-cloud materials
  // let the night side dim to slate instead of vanishing, so cover reads
  // planet-wide from orbit.
  const baseMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const cloudTop = new THREE.Color(0xeff4fc);
  const cloudBot = new THREE.Color(0xaebdd8);
  const clouds = [];
  const group = new THREE.Group();
  const cloudCount = Math.min(16, Math.round(9 * Math.sqrt(R / 30)));
  for (let i = 0; i < cloudCount; i++) {
    const blobs = [];
    const nb = 3 + (rng() * 4 | 0);
    const col = new THREE.Color(1, 1, 1);
    for (let b = 0; b < nb; b++) {
      const m = new THREE.Matrix4()
        .makeTranslation((rng() - 0.5) * 2.6, (rng() - 0.5) * 0.45, (rng() - 0.5) * 1.5)
        .multiply(new THREE.Matrix4().makeScale(0.65 + rng() * 1.2, 0.3 + rng() * 0.22, 0.55 + rng() * 0.65));
      blobs.push({ geo: new THREE.IcosahedronGeometry(1, 1), matrix: m, color: col });
    }
    const geo = mergeGeoms(blobs);
    {
      const p = geo.attributes.position, c = geo.attributes.color;
      for (let vi = 0; vi < p.count; vi++) {
        const t = clamp(p.getY(vi) * 0.9 + 0.55, 0, 1);
        _cliffCol.copy(cloudBot).lerp(cloudTop, t);
        c.setXYZ(vi, _cliffCol.r, _cliffCol.g, _cliffCol.b);
      }
    }
    const mesh = new THREE.Mesh(geo, baseMat.clone());
    mesh.renderOrder = 1;
    const holder = new THREE.Group();
    const dir2 = new THREE.Vector3(rng() * 2 - 1, (rng() - 0.5) * 1.2, rng() * 2 - 1).normalize();
    const cloudAlt = Math.max(6.6, R * 0.2);
    mesh.position.copy(dir2).multiplyScalar(R + cloudAlt + rng() * 2.2);
    mesh.lookAt(0, 0, 0);
    holder.add(mesh);
    const axis = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize();
    clouds.push({ holder, mesh, axis, speed: (0.05 + rng() * 0.06) * (rng() < 0.5 ? 1 : -1) * 0.09 });
    group.add(holder);
  }
  return { group, clouds };
}

// ---------------------------------------------------------------------------
// Landmarks

export function buildHeart(pos) {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: PALETTE.heartStone, roughness: 0.9, flatShading: true });
  const trim = new THREE.MeshStandardMaterial({ color: PALETTE.techTrim, roughness: 0.55, metalness: 0.35, flatShading: true });

  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 2.15, 0.55, 7), stone);
  basin.position.y = 0.22;
  group.add(basin);
  const step = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.7, 0.3, 7), stone);
  step.position.y = -0.02;
  group.add(step);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.09, 6, 7), trim);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.62;
  group.add(collar);

  const crysMat = new THREE.MeshStandardMaterial({
    color: PALETTE.heartCrystal, roughness: 0.2, metalness: 0,
    emissive: PALETTE.heartCrystal, emissiveIntensity: 1.9,
    transparent: true, opacity: 0.96, flatShading: true,
  });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.85), crysMat);
  crystal.scale.set(0.95, 1.9, 0.95);
  crystal.position.y = 2.4;
  group.add(crystal);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xeafcff });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), coreMat);
  core.scale.set(0.7, 1.4, 0.7);
  crystal.add(core);

  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(PALETTE.heartCrystal) }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform vec3 uColor; uniform float uTime;
      void main() {
        float edge = sin(vUv.x * 3.14159);
        float fade = pow(1.0 - vUv.y, 1.6);
        float ripple = 0.85 + 0.15 * sin(vUv.y * 24.0 - uTime * 3.0);
        gl_FragColor = vec4(uColor, edge * fade * ripple * 0.5);
      }
    `,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 9, 12, 1, true), beamMat);
  beam.position.y = 5.5;
  beam.renderOrder = 5;
  group.add(beam);

  const light = new THREE.PointLight(PALETTE.heartCrystal, 26, 15, 1.8);
  light.position.y = 2.3;
  group.add(light);

  orientOnSurface(group, pos);

  // Ring stones grounded individually so they never float over the slope.
  const stones = [];
  tangentBasis(_up.copy(pos).normalize(), _t1, _t2);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9 + (i % 3) * 0.3, 4), stone);
    _p0.copy(pos).addScaledVector(_t1, Math.cos(a) * 3.1).addScaledVector(_t2, Math.sin(a) * 3.1)
      .normalize();
    surfacePoint(_p0, _p1);
    orientOnSurface(st, _p1, a);
    st.position.addScaledVector(_p0, 0.28);
    stones.push(st);
  }
  return { group, stones, crystal, crysMat, core, beamMat, light, baseIntensity: 1.9, healthFrac: 1 };
}

export function buildPortal(pos) {
  const group = new THREE.Group();
  const plateMat = new THREE.MeshStandardMaterial({
    color: PALETTE.voidPlate, roughness: 0.7, metalness: 0.15, flatShading: true,
    emissive: PALETTE.voidEmissive, emissiveIntensity: 0.06,
  });
  const spikes = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.2;
    const h = 0.8 + ((i * 37) % 5) * 0.22;
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.26, h, 4), plateMat);
    sp.position.set(Math.cos(a) * 1.75, h * 0.32, Math.sin(a) * 1.75);
    sp.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    spikes.push(sp);
    group.add(sp);
  }

  const swirlMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uActive: { value: 0 },
      uFlash: { value: 0 },
      uCol: { value: new THREE.Color(PALETTE.voidEmissive) },
      uHot: { value: new THREE.Color(PALETTE.voidHot) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv - 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime, uActive, uFlash;
      uniform vec3 uCol, uHot;
      void main() {
        float r = length(vUv) * 2.0;
        // atan(0,0) at the disc center is NaN on some GPUs, and one NaN
        // pixel poisons the whole bloom pyramid into black smears.
        float a = atan(vUv.y, vUv.x + 1e-5);
        float speed = mix(0.35, 1.6, uActive);
        float swirl = sin(a * 3.0 - uTime * speed * 3.2 + r * 7.0);
        float swirl2 = sin(a * 5.0 + uTime * speed * 2.1 - r * 11.0);
        float m = smoothstep(1.0, 0.72, r) * (0.42 + 0.3 * swirl + 0.2 * swirl2);
        float coreGlow = smoothstep(0.5, 0.0, r) * (0.5 + uActive * 0.7);
        vec3 col = mix(uCol, uHot, coreGlow + uFlash * 0.8);
        float inten = (m * mix(0.35, 1.15, uActive) + coreGlow) * (1.0 + uFlash * 2.4);
        gl_FragColor = vec4(col * inten, clamp(inten, 0.0, 1.0));
      }
    `,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.55, 40), swirlMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.09;
  disc.renderOrder = 4;
  group.add(disc);

  orientOnSurface(group, pos);
  return { group, swirlMat, plateMat, spikes, active: false, flash: 0 };
}

// Containment perimeter for capped battlefields: a terrain-hugging ribbon of
// player-tech energy, quiet enough to read as a boundary, not a spectacle.
export function buildFieldWall(centerDir, theta) {
  const SEG = 200;
  // The curtain has to read as a wall from across the field, so it grows with
  // the field rather than staying a fixed 3.4 units, which on a colossal
  // world's front was 2% of the width and vanished into the terrain.
  const HEIGHT = Math.min(Math.max(CONFIG.planetRadius * theta * 0.1, 3.4), 16);
  // Sunk below the surface so undulating terrain never opens a gap under the
  // curtain. uGround tells the shader where that buried section ends, so the
  // bright seam lands on the visible ground line instead of underneath it.
  const BURY = 1.6;
  const GROUND_UV = BURY / (BURY + HEIGHT);
  const pos = new Float32Array(SEG * 2 * 3);
  const uv = new Float32Array(SEG * 2 * 2);
  const dir = new THREE.Vector3();
  const pt = new THREE.Vector3();
  tangentBasis(centerDir, _t1, _t2);
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    dir.copy(centerDir).multiplyScalar(Math.cos(theta))
      .addScaledVector(_t1, Math.sin(theta) * Math.cos(a))
      .addScaledVector(_t2, Math.sin(theta) * Math.sin(a))
      .normalize();
    surfacePoint(dir, pt);
    pt.addScaledVector(dir, -BURY);
    pos.set([pt.x, pt.y, pt.z], (i * 2) * 3);
    pt.addScaledVector(dir, HEIGHT + BURY);
    pos.set([pt.x, pt.y, pt.z], (i * 2 + 1) * 3);
    uv[(i * 2) * 2] = i / SEG * 40; uv[(i * 2) * 2 + 1] = 0;
    uv[(i * 2 + 1) * 2] = i / SEG * 40; uv[(i * 2 + 1) * 2 + 1] = 1;
  }
  const idx = [];
  for (let i = 0; i < SEG; i++) {
    const j = (i + 1) % SEG;
    idx.push(i * 2, i * 2 + 1, j * 2, i * 2 + 1, j * 2 + 1, j * 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uCol: { value: new THREE.Color(PALETTE.energy) },
      uGround: { value: GROUND_UV },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uCol;
      uniform float uGround;
      void main() {
        // Height above the ground line, 0 at the surface and 1 at the top.
        float y = clamp((vUv.y - uGround) / max(1.0 - uGround, 0.001), 0.0, 1.0);
        float fade = pow(1.0 - y, 1.7);
        float lattice = 0.5 + 0.5 * sin(vUv.x * 14.0 + uTime * 0.6) * sin(y * 9.0 - uTime * 0.9);
        float scan = smoothstep(0.02, 0.0, abs(fract(y - uTime * 0.07) - 0.5) - 0.46);
        // A hot seam sitting on the ground line: the thing the player reads as
        // "the field stops here" even across bright sunlit terrain.
        // Close in, this curtain covers half the screen, so the body stays
        // near-transparent and the boundary is carried by a tight hot line on
        // the ground. A bright curtain reads as a wash over the battlefield.
        float seam = smoothstep(0.05, 0.0, y);
        float a = fade * (0.05 + lattice * 0.06) + scan * 0.14 * fade + seam * 0.85;
        gl_FragColor = vec4(uCol * (0.7 + fade * 0.4 + seam * 1.6), a);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  return { mesh, mat };
}

const _orientQ = new THREE.Quaternion();
export function orientOnSurface(obj, pos, yaw = 0) {
  _up.copy(pos).normalize();
  // Ground maps keep structures mostly upright; space rocks let them cling
  // to the local surface so tilted placements read intentional.
  groundNormal(_up, _t1).lerp(_up, SPACE ? 0.22 : 0.65).normalize();
  _orientQ.setFromUnitVectors(Y_AXIS, _t1);
  obj.quaternion.copy(_orientQ);
  if (yaw) obj.rotateY(yaw);
  obj.position.copy(pos);
  // Seat structures into the rock: the faceted mesh sags below the analytic
  // surface between vertices, and a hair of sink beats a visible gap.
  if (SPACE) obj.position.addScaledVector(_up, -0.3);
}

// ---------------------------------------------------------------------------

export class World {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this.heart = null;
    this.portals = [];
    this.rng = mulberry32(CONFIG.seed ^ 0xDECAF);
  }

  buildStep(step) {
    switch (step) {
      case 0:
        initTerrainField(CONFIG.seed);
        break;
      case 1:
        this.terrain = buildTerrainMesh();
        // Terrain RECEIVES but never CASTS. At terrainDetail 7 the globe is
        // 327,680 triangles, so making it a caster re-renders all of it into
        // the shadow map every frame; and it has no self-shadowing to show at
        // gameplay zoom anyway. Everything that stands ON it casts instead.
        this.terrain.receiveShadow = true;
        this.scene.add(this.terrain);
        break;
      case 2:
        if (!SPACE) {
          this.water = buildWater();
          this.scene.add(this.water);
        }
        break;
      case 3: {
        if (!SPACE) this.scene.add(buildAtmosphere());
        const sky = buildSky(this.rng);
        this.sky = sky.group;
        this.starMat = sky.starMat;
        this.scene.add(this.sky);
        break;
      }
      case 4: {
        this.decor = scatterDecor(this.rng);
        // Decor is instanced, so casting costs one shadow draw per set rather
        // than one per tree. This is most of what sells the diorama read.
        for (const s of this.decor.sets) {
          s.mesh.castShadow = true;
          s.mesh.receiveShadow = true;
          this.scene.add(s.mesh);
        }
        if (!SPACE) {
          const cl = buildClouds(this.rng);
          this.clouds = cl.clouds;
          this.scene.add(cl.group);
        } else {
          this.scene.add(buildAsteroidBellies(this.rng));
          this.dust = buildSpaceDust(this.rng);
          this.scene.add(this.dust.pts);
          this.drifters = buildDrifters(this.rng);
          this.scene.add(this.drifters.mesh);
        }
        break;
      }
      case 5: {
        const hemi = new THREE.HemisphereLight(0x8fb4ff, 0x3d6b52, 0.52);
        this.scene.add(hemi);
        const sun = new THREE.DirectionalLight(PALETTE.sunlight, 2.35);
        sun.position.copy(SUN_DIR).multiplyScalar(120);
        // Kept on the World so main.js can fit its shadow camera to the focus
        // point each frame. A directional light's shadow box is world-sized by
        // default, which on an R240 planet means a 2048 map spread over the
        // whole globe: correct, and far too coarse to show a tower's footing.
        this.sun = sun;
        this.scene.add(sun);
        this.scene.add(sun.target);
        const rim = new THREE.DirectionalLight(0x3f6bff, 0.85);
        rim.position.set(-SUN_DIR.x, SUN_DIR.y * 0.3, -SUN_DIR.z).multiplyScalar(120);
        this.scene.add(rim);
        break;
      }
    }
  }

  get buildStepCount() { return 6; }

  addHeart(pos) {
    this.heart = buildHeart(pos);
    this.scene.add(this.heart.group);
    for (const st of this.heart.stones) this.scene.add(st);
    return this.heart;
  }

  addFieldWall(centerDir, theta) {
    this.fieldWall = buildFieldWall(centerDir, theta);
    this.scene.add(this.fieldWall.mesh);
    return this.fieldWall;
  }

  addCloudDeck(centerDir, theta) {
    this.cloudDeck = buildCloudDeck(centerDir, theta);
    this.scene.add(this.cloudDeck.mesh);
    return this.cloudDeck;
  }

  addPortal(pos) {
    const p = buildPortal(pos);
    this.scene.add(p.group);
    this.portals.push(p);
    return p;
  }

  // The fraction drives emissive intensity, so it has to stay in range: a
  // value above 1 scales the crystal's brightness without bound and the bloom
  // pyramid smears it across the whole frame as flat white.
  setHeartHealth(frac) {
    if (this.heart) this.heart.healthFrac = clamp(frac, 0, 1);
  }

  crushDecorNear(point, radius) {
    let crushed = 0;
    const r2 = radius * radius;
    for (const set of this.decor.sets) {
      if (!set.crushable) continue;
      let dirty = false;
      for (let i = 0; i < set.list.length; i++) {
        const it = set.list[i];
        if (!it.alive) continue;
        _pos.copy(it.dir).multiplyScalar(R + it.h);
        if (_pos.distanceToSquared(point) < r2) {
          it.alive = false;
          _m4.makeScale(0.0001, 0.0001, 0.0001);
          _m4.setPosition(_pos);
          set.mesh.setMatrixAt(i, _m4);
          dirty = true;
          crushed++;
        }
      }
      if (dirty) set.mesh.instanceMatrix.needsUpdate = true;
    }
    return crushed;
  }

  update(dt, cameraPos) {
    this.time += dt;
    const t = this.time;

    if (this.water) this.water.material.uniforms.uTime.value = t;
    if (this.starMat) this.starMat.uniforms.uTime.value = t;
    if (this.sky) {
      this.sky.position.copy(cameraPos);
      this.sky.rotation.y = t * 0.0035;
    }
    const swayShader = this.decor?.treeMat.userData.shader;
    if (swayShader) swayShader.uniforms.uTime.value = t;
    if (this.fieldWall) this.fieldWall.mat.uniforms.uTime.value = t;
    if (this.cloudDeck) this.cloudDeck.mat.uniforms.uTime.value = t;
    if (this.dust) this.dust.mat.uniforms.uTime.value = t;
    if (this.drifters) {
      for (let i = 0; i < this.drifters.items.length; i++) {
        const d = this.drifters.items[i];
        _orientQ.setFromAxisAngle(d.axis, d.speed * dt);
        d.quat.premultiply(_orientQ);
        _m4.compose(d.pos, d.quat, d.scale);
        this.drifters.mesh.setMatrixAt(i, _m4);
      }
      this.drifters.mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.clouds) {
      // Cover stays planet-wide: night-side clouds dim to slate rather than
      // vanishing, so orbit views never show a bald hemisphere.
      for (const c of this.clouds) {
        c.holder.rotateOnAxis(c.axis, c.speed * dt);
        c.mesh.getWorldPosition(_pos).normalize();
        const day = smoothstep(-0.4, 0.42, _pos.dot(SUN_DIR));
        c.mesh.material.color.setRGB(
          0.32 + day * 0.68,
          0.36 + day * 0.64,
          0.48 + day * 0.52,
        );
      }
    }

    if (this.heart) {
      const h = this.heart;
      const wound = 1 - h.healthFrac;
      h.crystal.rotation.y += dt * (0.5 + wound * 1.1);
      h.crystal.position.y = 2.15 + Math.sin(t * (1.1 + wound)) * 0.14;
      const pulse = 1 + Math.sin(t * (1.8 + wound * 3)) * 0.22;
      h.crysMat.emissiveIntensity = h.baseIntensity * pulse * (0.55 + 0.45 * h.healthFrac);
      h.crysMat.emissive.lerpColors(C.danger, C.heartCrystal, Math.min(1, h.healthFrac * 1.4));
      h.crysMat.color.copy(h.crysMat.emissive);
      h.light.intensity = 20 * (0.4 + 0.6 * h.healthFrac) * pulse;
      h.beamMat.uniforms.uTime.value = t;
    }

    for (const p of this.portals) {
      p.flash = Math.max(0, p.flash - dt * 3.2);
      const u = p.swirlMat.uniforms;
      u.uTime.value = t;
      u.uFlash.value = p.flash;
      const target = p.active ? 1 : 0;
      u.uActive.value += (target - u.uActive.value) * Math.min(1, dt * 3);
      p.plateMat.emissiveIntensity = 0.06 + u.uActive.value * 0.5 + p.flash * 1.2;
    }
  }
}
