import * as THREE from 'three';
import { CONFIG, PALETTE, REDUCED_MOTION } from './config.js';
import { clamp, lerp } from './noise.js';
import { R, orientOnSurface } from './world.js';

// Tower construction, animation, targeting, and projectile simulation.
// Each species has a distinct silhouette and a firing performance; tiers
// change geometry, not just numbers. Cosmetic animation reads sim state,
// never the other way around.

export const TOWER_TYPES = {
  bolt: {
    name: 'Bolt Sentinel', cost: 150, air: true, footprint: 1.3,
    desc: 'Rapid single-target rails. Hits air.',
    flavor: 'Twin rails sing in the dark.',
    tiers: [
      { dmg: 9, rate: 4.6, range: 5.4 },
      { dmg: 15, rate: 5.2, range: 5.9, crit: 0.15 },
      { dmg: 24, rate: 6.0, range: 6.4, crit: 0.25 },
    ],
  },
  cryo: {
    name: 'Cryo Bloom', cost: 200, air: true, footprint: 1.3,
    desc: 'Constant slow aura, ground and air. No damage.',
    flavor: 'Winter kept in a seed.',
    tiers: [
      { slow: 0.38, range: 3.5 },
      { slow: 0.48, range: 4.1 },
      { slow: 0.55, range: 4.7, brittle: true },
    ],
  },
  mortar: {
    name: 'Mortar Bastion', cost: 250, air: false, footprint: 1.4,
    desc: 'Lobbed shells, area damage. Ground only, minimum range.',
    flavor: 'It remembers the siege.',
    tiers: [
      { dmg: 34, rate: 0.48, range: 6.6, minRange: 2.3, aoe: 2.3 },
      { dmg: 56, rate: 0.52, range: 7.2, minRange: 2.3, aoe: 2.7 },
      { dmg: 88, rate: 0.56, range: 7.8, minRange: 2.3, aoe: 3.1, shells: 2 },
    ],
  },
  tesla: {
    name: 'Arc Spire', cost: 300, air: true, footprint: 1.3,
    desc: 'Charges, then chains lightning with a brief stun.',
    flavor: 'The sky owes it a debt.',
    tiers: [
      { dmg: 30, charge: 1.5, chains: 3, range: 4.8, stun: 0.25, hop: 3.6 },
      { dmg: 46, charge: 1.35, chains: 4, range: 5.3, stun: 0.3, hop: 3.9 },
      { dmg: 68, charge: 1.2, chains: 6, range: 5.8, stun: 0.35, hop: 4.2 },
    ],
  },
  helios: {
    name: 'Helios Lance', cost: 500, air: true, footprint: 1.3,
    desc: 'Continuous beam that ramps to triple damage on one target.',
    flavor: 'A patient sliver of the sun.',
    tiers: [
      { dps: 26, ramp: 2.0, rampMax: 3, range: 7.4 },
      { dps: 42, ramp: 1.7, rampMax: 3, range: 7.9 },
      { dps: 64, ramp: 1.4, rampMax: 3.5, range: 8.4 },
    ],
  },
};

// On Space Battlefields there is no ground layer: everything flies, so the
// mortar shells burst at the flight layer instead.
if (CONFIG.map.mode === 'space') {
  TOWER_TYPES.mortar.air = true;
  TOWER_TYPES.mortar.desc = 'Lobbed shells, area damage at the flight layer. Minimum range.';
}

export function tierCost(typeKey, tier) {
  const base = TOWER_TYPES[typeKey].cost;
  return tier === 1 ? Math.round(base * 0.8) : Math.round(base * 1.3);
}

// ---------------------------------------------------------------------------
// Shared materials

export const MAT = {
  body: new THREE.MeshStandardMaterial({ color: PALETTE.techBody, roughness: 0.62, metalness: 0.28, flatShading: true }),
  trim: new THREE.MeshStandardMaterial({ color: PALETTE.techTrim, roughness: 0.35, metalness: 0.55, flatShading: true }),
  dark: new THREE.MeshStandardMaterial({ color: PALETTE.techDark, roughness: 0.55, metalness: 0.35, flatShading: true }),
  energy: new THREE.MeshStandardMaterial({
    color: PALETTE.energy, roughness: 0.4, metalness: 0,
    emissive: PALETTE.energy, emissiveIntensity: 1.5, flatShading: true,
  }),
  energySoft: new THREE.MeshStandardMaterial({
    color: 0x2f8fa6, roughness: 0.45, metalness: 0,
    emissive: PALETTE.energy, emissiveIntensity: 0.55, flatShading: true,
  }),
  frost: new THREE.MeshStandardMaterial({
    color: 0xbff1ff, roughness: 0.22, metalness: 0,
    emissive: 0x8fd8f2, emissiveIntensity: 0.75, flatShading: true,
    transparent: true, opacity: 0.94,
  }),
  gemGold: new THREE.MeshStandardMaterial({
    color: PALETTE.gold, roughness: 0.3, metalness: 0.2,
    emissive: PALETTE.gold, emissiveIntensity: 0.9, flatShading: true,
  }),
  gemHot: new THREE.MeshStandardMaterial({
    color: PALETTE.energyHot, roughness: 0.3, metalness: 0,
    emissive: PALETTE.energyHot, emissiveIntensity: 2.2, flatShading: true,
  }),
  rock: new THREE.MeshStandardMaterial({ color: PALETTE.rock, roughness: 0.95, metalness: 0, flatShading: true }),
};

export const GHOST_MAT_OK = new THREE.MeshBasicMaterial({
  color: PALETTE.energy, transparent: true, opacity: 0.5, depthWrite: false,
  blending: THREE.AdditiveBlending,
});
export const GHOST_MAT_BAD = new THREE.MeshBasicMaterial({
  color: PALETTE.danger, transparent: true, opacity: 0.55, depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m4 = new THREE.Matrix4();
const _s = new THREE.Vector3();

function box(w, h, d, mat, x = 0, y = 0, z = 0, ry = 0, rz = 0, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}
function cyl(rt, rb, h, seg, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  return m;
}

// ---------------------------------------------------------------------------
// Species builders. Each returns { group, head, pitch, refs } where head yaws
// toward targets, pitch elevates (mortar), refs hold animated parts.

function buildBolt(tier) {
  const g = new THREE.Group();
  const refs = {};
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = box(0.16, 0.5, 0.24, MAT.dark, Math.cos(a) * 0.42, 0.2, Math.sin(a) * 0.42);
    leg.rotation.y = -a + Math.PI / 2;
    leg.rotation.z = 0.28 * Math.cos(a) ? 0 : 0;
    g.add(leg);
  }
  g.add(cyl(0.42, 0.55, 0.3, 6, MAT.body, 0, 0.4, 0));
  g.add(cyl(0.16, 0.2, 0.5 + tier * 0.06, 6, MAT.dark, 0, 0.75, 0));

  const head = new THREE.Group();
  head.position.y = 1.02 + tier * 0.05;
  const housing = box(0.46 + tier * 0.05, 0.3, 0.56, MAT.body);
  head.add(housing);
  head.add(box(0.5 + tier * 0.05, 0.08, 0.3, MAT.trim, 0, 0.19, -0.05));
  head.add(box(0.2, 0.22, 0.24, MAT.dark, 0, 0, -0.36));
  const railL = box(0.07, 0.1, 0.66 + tier * 0.1, MAT.trim, -0.15, 0.02, 0.28);
  const railR = box(0.07, 0.1, 0.66 + tier * 0.1, MAT.trim, 0.15, 0.02, 0.28);
  head.add(railL, railR);
  const tipL = box(0.05, 0.06, 0.1, MAT.energy, -0.15, 0.02, 0.62 + tier * 0.05);
  const tipR = box(0.05, 0.06, 0.1, MAT.energy, 0.15, 0.02, 0.62 + tier * 0.05);
  head.add(tipL, tipR);
  head.add(box(0.05, 0.26, 0.2, MAT.trim, 0, 0.28, -0.18));
  if (tier >= 1) {
    head.add(box(0.1, 0.16, 0.42, MAT.dark, -0.3 - tier * 0.02, 0, 0.05));
    head.add(box(0.1, 0.16, 0.42, MAT.dark, 0.3 + tier * 0.02, 0, 0.05));
  }
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), tier === 1 ? MAT.gemGold : MAT.gemHot);
  gem.position.set(0, 0.32, -0.3);
  if (tier >= 1) head.add(gem);
  g.add(head);

  refs.rails = [railL, railR];
  refs.muzzles = [tipL, tipR];
  return { group: g, head, pitch: null, refs };
}

function buildMortar(tier) {
  const g = new THREE.Group();
  const refs = {};
  g.add(cyl(0.85, 1.02, 0.36, 6, MAT.dark, 0, 0.16, 0));
  g.add(cyl(0.66, 0.85, 0.4, 6, MAT.body, 0, 0.5, 0));
  g.add(cyl(0.72, 0.72, 0.07, 6, MAT.trim, 0, 0.72, 0));
  if (tier >= 1) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      g.add(box(0.34, 0.3, 0.1, MAT.trim, Math.cos(a) * 0.86, 0.42, Math.sin(a) * 0.86, -a));
    }
  }
  // visible shell rack
  for (let i = 0; i < 3; i++) {
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), MAT.energy);
    sh.position.set(-0.55 + i * 0.2, 0.8, -0.52);
    g.add(sh);
  }

  const head = new THREE.Group();
  head.position.y = 0.78;
  const pitch = new THREE.Group();
  head.add(pitch);
  const tube = cyl(0.17 + tier * 0.02, 0.22 + tier * 0.02, 0.85 + tier * 0.1, 8, MAT.body, 0, 0.42, 0);
  const mouth = cyl(0.21 + tier * 0.02, 0.21 + tier * 0.02, 0.1, 8, MAT.trim, 0, 0.85 + tier * 0.05, 0);
  const breech = box(0.34, 0.3, 0.34, MAT.dark, 0, 0.05, 0);
  pitch.add(tube, mouth, breech);
  if (tier >= 2) {
    const tube2 = cyl(0.12, 0.15, 0.7, 8, MAT.body, 0.26, 0.36, 0);
    pitch.add(tube2);
  }
  pitch.rotation.x = -0.9;
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), tier === 1 ? MAT.gemGold : MAT.gemHot);
  gem.position.set(0.5, 0.9, 0.3);
  if (tier >= 1) g.add(gem);
  g.add(head);

  refs.tube = pitch;
  refs.recoil = 0;
  return { group: g, head, pitch, refs };
}

function buildTesla(tier) {
  const g = new THREE.Group();
  const refs = {};
  const seg = 3 + tier;
  for (let i = 0; i < seg; i++) {
    const s = 0.52 - i * (0.3 / seg);
    const b = box(s, 0.34, s, MAT.dark, 0, 0.18 + i * 0.3, 0, (i % 2) * 0.5 + i * 0.16);
    g.add(b);
    if (i > 0) g.add(box(s * 0.6, 0.05, s * 1.08, MAT.energySoft, 0, 0.04 + i * 0.3, 0, (i % 2) * 0.5 + i * 0.16));
  }
  const topY = 0.34 + seg * 0.3;
  const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), MAT.energy);
  tip.position.y = topY + 0.1;
  g.add(tip);

  const rings = [];
  const ringCount = tier >= 2 ? 3 : 2;
  for (let i = 0; i < ringCount; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4 - i * 0.08, 0.045, 6, 18), MAT.energySoft);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = topY - 0.5 + i * 0.26;
    g.add(ring);
    rings.push({ mesh: ring, baseY: ring.position.y, speed: 1.2 + i * 0.9 });
  }
  refs.rings = rings;
  refs.tip = tip;
  refs.topY = topY;
  return { group: g, head: null, pitch: null, refs };
}

function buildCryo(tier) {
  const g = new THREE.Group();
  const refs = {};
  const ped = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), MAT.rock);
  ped.scale.set(1.15, 0.5, 1.15);
  ped.position.y = 0.2;
  g.add(ped);

  const petals = [];
  const count = 5 + tier;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const h = 0.85 + (i % 2) * 0.25 + tier * 0.15;
    const petal = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), MAT.frost);
    petal.scale.set(0.62, h * 2.1, 0.62);
    petal.position.set(Math.cos(a) * 0.34, 0.55 + h * 0.35, Math.sin(a) * 0.34);
    petal.rotation.set(Math.sin(a) * 0.42, 0, -Math.cos(a) * 0.42);
    g.add(petal);
    petals.push({ mesh: petal, phase: i * 1.3, baseScaleY: petal.scale.y });
  }
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.2 + tier * 0.04, 10, 8), MAT.energy);
  orb.position.y = 0.85 + tier * 0.1;
  g.add(orb);
  refs.petals = petals;
  refs.orb = orb;
  return { group: g, head: null, pitch: null, refs };
}

function buildHelios(tier) {
  const g = new THREE.Group();
  const refs = {};
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = box(0.14, 0.7, 0.2, MAT.dark, Math.cos(a) * 0.4, 0.3, Math.sin(a) * 0.4);
    leg.rotation.y = -a;
    g.add(leg);
  }
  g.add(cyl(0.3, 0.42, 0.25, 6, MAT.trim, 0, 0.68, 0));
  g.add(cyl(0.14, 0.2, 1.0 + tier * 0.15, 6, MAT.body, 0, 1.28, 0));

  const head = new THREE.Group();
  head.position.y = 1.85 + tier * 0.12;
  const rings = [];
  const ringCount = tier >= 2 ? 4 : 3;
  for (let i = 0; i < ringCount; i++) {
    const holder = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3 - i * 0.05, 0.05, 6, 16), i === 0 ? MAT.trim : MAT.energy);
    holder.add(ring);
    holder.position.y = i * 0.26;
    head.add(holder);
    rings.push({ holder, base: i * 0.26, phase: i * 2.1 });
  }
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 6), MAT.energy);
  crown.position.y = ringCount * 0.26 + 0.1;
  head.add(crown);
  g.add(head);
  refs.rings = rings;
  refs.crown = crown;
  refs.headBaseY = head.position.y;
  return { group: g, head, pitch: null, refs };
}

const BUILDERS = { bolt: buildBolt, mortar: buildMortar, tesla: buildTesla, cryo: buildCryo, helios: buildHelios };

// Stylized oversize: towers read as landmarks against the small planet.
export const TOWER_SCALE = 1.45;

export function buildTowerVisual(typeKey, tier) {
  return BUILDERS[typeKey](tier);
}

// ---------------------------------------------------------------------------

let towerSeq = 1;

export class Tower {
  constructor(typeKey, pos, manager) {
    this.id = towerSeq++;
    this.typeKey = typeKey;
    this.def = TOWER_TYPES[typeKey];
    this.tier = 0;
    this.pos = pos.clone();
    this.manager = manager;
    this.invested = this.def.cost;
    this.damageDealt = 0;
    this.kills = 0;
    this.cooldown = 0;
    this.charge = 0;
    this.target = null;
    this.beamOn = false;
    this.rampT = 0;
    this.buildT = 0;
    this.yaw = Math.random() * Math.PI * 2;
    this.muzzleFlip = 0;
    this.recoil = 0;
    this.pulseT = 0;
    this._buildVisual();
  }

  _buildVisual() {
    if (this.group) {
      this.holder.remove(this.group);
      this.group.traverse((o) => o.geometry?.dispose());
    }
    const built = buildTowerVisual(this.typeKey, this.tier);
    this.group = built.group;
    this.head = built.head;
    this.pitch = built.pitch;
    this.refs = built.refs;
    if (!this.holder) {
      this.holder = new THREE.Group();
      orientOnSurface(this.holder, this.pos);
    }
    this.holder.add(this.group);
    this.buildT = 0;
  }

  get stats() { return this.def.tiers[this.tier]; }
  get range() { return this.stats.range; }

  upgrade() {
    if (this.tier >= 2) return false;
    this.tier++;
    this.invested += tierCost(this.typeKey, this.tier);
    this._buildVisual();
    return true;
  }

  sellValue(refundFrac) { return Math.round(this.invested * refundFrac); }

  // -- targeting ------------------------------------------------------------

  _acquire(enemies) {
    const st = this.stats;
    const r2 = st.range * st.range;
    const min2 = (st.minRange || 0) * (st.minRange || 0);
    // keep a valid current target (with hysteresis)
    if (this.target && this.target.active && !this.target.dead) {
      const d2 = this.target.renderPos ? 0 : 0;
      _v.copy(this.target.dir).multiplyScalar(this.target.type.flying ? 0 : 0);
      const dd = this._dist2(this.target);
      if (dd < r2 * 1.1 && dd > min2 && (this.def.air || !this.target.type.flying)) return this.target;
    }
    let best = null, bestProgress = Infinity;
    for (const e of enemies) {
      if (!e.active || e.dead) continue;
      if (!this.def.air && e.type.flying) continue;
      const d2 = this._dist2(e);
      if (d2 > r2 || d2 < min2) continue;
      if (e.progress < bestProgress) { bestProgress = e.progress; best = e; }
    }
    this.target = best;
    return best;
  }

  _dist2(e) {
    this.manager.enemyWorldPos(e, _v3);
    return _v3.distanceToSquared(this.pos);
  }

  _aimHead(dt, targetPos, rate = 9) {
    if (!this.head) return true;
    _v.copy(targetPos);
    this.holder.worldToLocal(_v);
    const desired = Math.atan2(_v.x, _v.z);
    let d = desired - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const step = clamp(d, -rate * dt, rate * dt);
    this.yaw += step;
    this.head.rotation.y = this.yaw;
    return Math.abs(d) < 0.15;
  }

  update(dt, enemies, fx) {
    this.buildT = Math.min(1, this.buildT + dt * 2.4);
    const rise = 1 - Math.pow(1 - this.buildT, 3);
    // zoomScale swells models at strategic zoom so they stay readable.
    this.group.scale.setScalar(TOWER_SCALE * this.manager.zoomScale * (0.35 + rise * 0.65));
    this.group.position.y = (rise - 1) * 0.6;

    const st = this.stats;
    this.cooldown -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 6);

    switch (this.typeKey) {
      case 'bolt': this._updateBolt(dt, enemies, fx, st); break;
      case 'mortar': this._updateMortar(dt, enemies, fx, st); break;
      case 'tesla': this._updateTesla(dt, enemies, fx, st); break;
      case 'cryo': this._updateCryo(dt, enemies, fx, st); break;
      case 'helios': this._updateHelios(dt, enemies, fx, st); break;
    }
  }

  _updateBolt(dt, enemies, fx, st) {
    const t = this._acquire(enemies);
    // rail recoil animation
    for (let i = 0; i < 2; i++) {
      const rail = this.refs.rails[i];
      const k = (this.muzzleFlip === i) ? this.recoil : 0;
      rail.position.z = 0.28 - k * 0.14;
    }
    if (!t) {
      this.yaw += dt * 0.3;
      if (this.head) this.head.rotation.y = this.yaw;
      return;
    }
    this.manager.enemyWorldPos(t, _v2);
    const aimed = this._aimHead(dt, _v2);
    if (aimed && this.cooldown <= 0) {
      this.cooldown = 1 / st.rate;
      this.muzzleFlip = 1 - this.muzzleFlip;
      this.recoil = 1;
      const muzzle = this.refs.muzzles[this.muzzleFlip];
      muzzle.getWorldPosition(_v);
      let dmg = st.dmg;
      let crit = false;
      if (st.crit && Math.random() < st.crit) { dmg *= 2.2; crit = true; }
      this.manager.fireBolt(this, _v, t, dmg, crit);
      fx.glow.emit(_v.x, _v.y, _v.z, 0, 0, 0, PALETTE.energy, 2.6, 0.12, 0.55, 0);
      this.manager.audio?.play('shot');
    }
  }

  _updateMortar(dt, enemies, fx, st) {
    const t = this._acquire(enemies);
    if (this.refs.tube) {
      this.refs.tube.position.z = -this.recoil * 0.14;
    }
    if (!t) return;
    this.manager.enemyWorldPos(t, _v2);
    const aimed = this._aimHead(dt, _v2, 5);
    if (aimed && this.cooldown <= 0) {
      this.cooldown = 1 / st.rate;
      this.recoil = 1;
      const shells = st.shells || 1;
      for (let s = 0; s < shells; s++) {
        this.manager.fireShell(this, _v2, st, s * 0.16);
      }
      this.head.getWorldPosition(_v);
      _v.addScaledVector(_v3.copy(this.pos).normalize(), 0.8);
      fx.burstGlow(_v, 0x8f96a8, 5, 1.6, 0.5, 0.5, 0.8);
      this.manager.audio?.play('mortar');
    }
  }

  _updateTesla(dt, enemies, fx, st) {
    const t = this._acquire(enemies);
    const rings = this.refs.rings;
    if (t) this.charge = Math.min(st.charge, this.charge + dt);
    else this.charge = Math.max(0, this.charge - dt * 2);
    const cf = this.charge / st.charge;

    const time = this.manager.time;
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      r.mesh.rotation.z = time * r.speed;
      const lift = cf * (0.35 + i * 0.12);
      r.mesh.position.y = r.baseY + Math.sin(time * 2 + i) * 0.03 + lift;
    }
    MAT.energy.emissiveIntensity = 1.5; // shared; per-tower glow via tip scale
    this.refs.tip.scale.setScalar(1 + cf * 0.9);

    if (t && cf >= 1 && this.cooldown <= 0) {
      this.cooldown = 0.25;
      this.charge = 0;
      this.manager.audio?.play('zap');
      // chain
      let current = t;
      let from = _v.copy(this.pos).addScaledVector(_v3.copy(this.pos).normalize(), (this.refs.topY + 0.15) * TOWER_SCALE);
      const hit = new Set();
      let dmg = st.dmg;
      for (let c = 0; c < st.chains && current; c++) {
        this.manager.enemyWorldPos(current, _v2);
        fx.zaps.fire(from, _v2, PALETTE.energy, 0.16, 0.1);
        const dealt = this.manager.applyDamage(this, current, dmg, { armorPierce: 3 });
        this.manager.enemies.applyStun(current, st.stun);
        fx.impactSpark(_v2, PALETTE.energy);
        hit.add(current.id);
        from = _v.copy(_v2);
        dmg *= 0.75;
        // next hop
        let next = null, nd = st.hop * st.hop;
        for (const e of this.manager.enemies.active) {
          if (!e.active || e.dead || hit.has(e.id)) continue;
          if (!this.def.air && e.type.flying) continue;
          this.manager.enemyWorldPos(e, _v3);
          const d2 = _v3.distanceToSquared(_v2);
          if (d2 < nd) { nd = d2; next = e; }
        }
        current = next;
      }
    }
  }

  _updateCryo(dt, enemies, fx, st) {
    const time = this.manager.time;
    for (const p of this.refs.petals) {
      p.mesh.scale.y = p.baseScaleY * (1 + Math.sin(time * 1.7 + p.phase) * 0.055);
    }
    this.refs.orb.position.y = 0.85 + this.tier * 0.1 + Math.sin(time * 2.1) * 0.05;

    this.pulseT -= dt;
    if (this.pulseT <= 0) {
      this.pulseT = 2.2;
      fx.rings.spawn(this.pos, 0x9fe8f2, st.range, 1.1);
    }
    const r2 = st.range * st.range;
    for (const e of enemies) {
      if (!e.active || e.dead) continue;
      if (this._dist2(e) < r2) {
        this.manager.enemies.applySlow(e, st.slow, 0.35);
        if (st.brittle) this.manager.enemies.applyBrittle(e, 0.4);
      }
    }
  }

  _updateHelios(dt, enemies, fx, st) {
    const time = this.manager.time;
    const rings = this.refs.rings;
    const prevTarget = this.target;
    const t = this._acquire(enemies);
    if (t !== prevTarget) {
      this.rampT = 0;
      if (t) this.manager.audio?.play('beam');
    }

    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      const idleTilt = Math.sin(time * (0.7 + i * 0.3) + r.phase) * 0.35;
      const targetTilt = t ? 0 : idleTilt;
      r.holder.rotation.x = lerp(r.holder.rotation.x, targetTilt, Math.min(1, dt * 5));
      r.holder.rotation.z = lerp(r.holder.rotation.z, t ? 0 : idleTilt * 0.7, Math.min(1, dt * 5));
    }

    if (t) {
      this.rampT = Math.min(st.ramp, this.rampT + dt);
      const mult = 1 + (st.rampMax - 1) * (this.rampT / st.ramp);
      const dps = st.dps * mult;
      this.manager.enemyWorldPos(t, _v2);
      this.refs.crown.getWorldPosition(_v);
      this.manager.setBeam(this, _v, _v2, mult);
      const dealt = dps * dt;
      this.heatAcc = (this.heatAcc || 0) + dealt;
      this.manager.applyDamage(this, t, dealt, { trueDamage: true, silent: true });
      if (this.heatAcc > 14) {
        fx.floaters.spawn(_v2, String(Math.round(this.heatAcc)), '#bdfaff', 12);
        this.heatAcc = 0;
      }
      if (Math.random() < dt * 14) fx.impactSpark(_v2, 0xffd9a0);
    } else {
      this.manager.setBeam(this, null);
      this.rampT = 0;
    }
  }

  dispose() {
    this.manager.setBeam(this, null);
    this.holder.parent?.remove(this.holder);
    this.group.traverse((o) => o.geometry?.dispose());
  }
}

// ---------------------------------------------------------------------------

const MAX_BOLTS = 80;
const MAX_SHELLS = 24;

export class TowerManager {
  constructor(scene, enemies, effects, nav) {
    this.scene = scene;
    this.enemies = enemies;
    this.fx = effects;
    this.nav = nav;
    this.towers = [];
    this.time = 0;
    this.zoomScale = 1;
    this.onKillReward = null;

    // bolt tracers
    const boltGeo = new THREE.CylinderGeometry(0.03, 0.05, 1, 5, 1);
    boltGeo.translate(0, 0.5, 0);
    boltGeo.rotateX(Math.PI / 2); // +Z aligned
    const boltMat = new THREE.MeshBasicMaterial({
      color: PALETTE.energyHot, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.boltMesh = new THREE.InstancedMesh(boltGeo, boltMat, MAX_BOLTS);
    this.boltMesh.count = 0;
    this.boltMesh.frustumCulled = false;
    this.boltMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.boltMesh.renderOrder = 7;
    scene.add(this.boltMesh);
    this.bolts = Array.from({ length: MAX_BOLTS }, () => ({
      active: false, from: new THREE.Vector3(), t: 0, dur: 1, target: null, dmg: 0, crit: false, tower: null,
    }));

    // mortar shells
    const shellGeo = new THREE.SphereGeometry(0.13, 8, 6);
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0x2f3644, roughness: 0.5, metalness: 0.4,
      emissive: PALETTE.energy, emissiveIntensity: 0.7,
    });
    this.shellMesh = new THREE.InstancedMesh(shellGeo, shellMat, MAX_SHELLS);
    this.shellMesh.count = 0;
    this.shellMesh.frustumCulled = false;
    this.shellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.shellMesh);
    this.shells = Array.from({ length: MAX_SHELLS }, () => ({
      active: false, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, dur: 1, st: null, tower: null, delay: 0,
    }));

    // helios beams
    this.beams = new Map();
    this.beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
    this.beamGeo.translate(0, 0.5, 0);
  }

  enemyWorldPos(e, out) {
    const h = Math.max(e.height, 0.03);
    return out.copy(e.dir).multiplyScalar(R + h + (e.alt ?? e.type.altitude) + e.type.radius * 0.9);
  }

  place(typeKey, pos) {
    const tower = new Tower(typeKey, pos, this);
    this.towers.push(tower);
    this.scene.add(tower.holder);
    return tower;
  }

  remove(tower) {
    const i = this.towers.indexOf(tower);
    if (i >= 0) this.towers.splice(i, 1);
    tower.dispose();
    const beam = this.beams.get(tower.id);
    if (beam) {
      this.scene.remove(beam.mesh);
      beam.mat.dispose();
      this.beams.delete(tower.id);
    }
  }

  applyDamage(tower, enemy, amount, opts = {}) {
    const wasDead = enemy.dead;
    const dealt = this.enemies.damage(enemy, amount, opts);
    tower.damageDealt += dealt;
    if (!opts.silent && dealt > 0) {
      this.enemyWorldPos(enemy, _v3);
      this.fx.floaters.spawn(_v3, String(Math.round(dealt)), opts.crit ? '#ffc857' : '#e8ecf8', opts.crit ? 15 : 12);
    }
    if (!wasDead && enemy.dead) {
      tower.kills++;
      if (this.onKillReward) this.onKillReward(enemy, tower);
    }
    return dealt;
  }

  fireBolt(tower, from, target, dmg, crit) {
    const b = this.bolts.find((x) => !x.active);
    if (!b) return;
    b.active = true;
    b.from.copy(from);
    b.target = target;
    b.dmg = dmg;
    b.crit = crit;
    b.tower = tower;
    this.enemyWorldPos(target, _v3);
    b.dur = Math.max(0.05, _v3.distanceTo(from) / 46);
    b.t = 0;
  }

  fireShell(tower, targetPos, st, delay) {
    const s = this.shells.find((x) => !x.active);
    if (!s) return;
    s.active = true;
    tower.refs.tube?.getWorldPosition ? tower.refs.tube.getWorldPosition(s.from) : s.from.copy(tower.pos);
    s.from.addScaledVector(_v3.copy(tower.pos).normalize(), 0.5);
    s.to.copy(targetPos);
    // slight scatter
    _v3.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.7);
    s.to.add(_v3);
    const dist = s.from.distanceTo(s.to);
    s.dur = clamp(dist / 9, 0.7, 1.5);
    s.t = -delay;
    s.st = st;
    s.tower = tower;
  }

  setBeam(tower, from, to, heat = 1) {
    let beam = this.beams.get(tower.id);
    if (!from) {
      if (beam) beam.mesh.visible = false;
      return;
    }
    if (!beam) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uHeat: { value: 1 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform float uTime, uHeat;
          void main() {
            float pulse = 0.82 + 0.18 * sin(vUv.y * 40.0 - uTime * 26.0);
            vec3 core = mix(vec3(1.0, 0.83, 0.5), vec3(1.0, 0.98, 0.9), uHeat - 1.0);
            float edge = sin(vUv.x * 3.14159);
            gl_FragColor = vec4(core * (0.7 + uHeat * 0.5) * pulse, edge * 0.85);
          }
        `,
      });
      beam = { mesh: new THREE.Mesh(this.beamGeo, mat), mat };
      beam.mesh.frustumCulled = false;
      beam.mesh.renderOrder = 8;
      this.scene.add(beam.mesh);
      this.beams.set(tower.id, beam);
    }
    beam.mesh.visible = true;
    beam.mat.uniforms.uTime.value = this.time;
    beam.mat.uniforms.uHeat.value = heat;
    const len = _v3.copy(to).sub(from).length();
    beam.mesh.position.copy(from);
    _q.setFromUnitVectors(_v.set(0, 1, 0), _v3.normalize());
    beam.mesh.quaternion.copy(_q);
    const w = 0.05 + heat * 0.035;
    beam.mesh.scale.set(w, len, w);
  }

  update(dt) {
    this.time += dt;
    const enemyList = this.enemies.active;
    for (const t of this.towers) t.update(dt, enemyList, this.fx);

    // bolts
    let bi = 0;
    for (const b of this.bolts) {
      if (!b.active) continue;
      b.t += dt / b.dur;
      const dead = !b.target.active || b.target.dead;
      if (b.t >= 1) {
        b.active = false;
        if (!dead) {
          this.enemyWorldPos(b.target, _v3);
          this.applyDamage(b.tower, b.target, b.dmg, { crit: b.crit });
          this.fx.impactSpark(_v3, PALETTE.energy);
        }
        continue;
      }
      const to = dead ? _v2.copy(b.from) : this.enemyWorldPos(b.target, _v2);
      _v.lerpVectors(b.from, to, b.t);
      const len = Math.max(0.35, _v3.copy(to).sub(b.from).length() * 0.09);
      _q.setFromUnitVectors(_s.set(0, 0, 1), _v3.normalize());
      _m4.compose(_v, _q, _s.set(1, 1, len));
      this.boltMesh.setMatrixAt(bi++, _m4);
      if (bi >= MAX_BOLTS) break;
    }
    this.boltMesh.count = bi;
    this.boltMesh.instanceMatrix.needsUpdate = true;

    // shells
    let si = 0;
    for (const s of this.shells) {
      if (!s.active) continue;
      s.t += dt / s.dur;
      if (s.t < 0) continue;
      if (s.t >= 1) {
        s.active = false;
        this.fx.explosion(s.to, s.st.aoe);
        this.audio?.play('explosion');
        const r2 = s.st.aoe * s.st.aoe;
        for (const e of this.enemies.active) {
          if (!e.active || e.dead || e.type.flying) continue;
          this.enemyWorldPos(e, _v3);
          if (_v3.distanceToSquared(s.to) < r2) {
            const fall = 1 - 0.5 * Math.sqrt(_v3.distanceToSquared(s.to) / r2);
            this.applyDamage(s.tower, e, s.st.dmg * fall, { armorPierce: 99 });
          }
        }
        continue;
      }
      const tt = s.t;
      _v.lerpVectors(s.from, s.to, tt);
      const arcH = s.from.distanceTo(s.to) * 0.4;
      _v3.copy(_v).normalize();
      _v.addScaledVector(_v3, Math.sin(tt * Math.PI) * arcH);
      _q.identity();
      _m4.compose(_v, _q, _s.set(1, 1, 1));
      this.shellMesh.setMatrixAt(si++, _m4);
      if (si >= MAX_SHELLS) break;
      if (Math.random() < dt * 30) {
        this.fx.glow.emit(_v.x, _v.y, _v.z, 0, 0, 0, 0x9aa4c4, 0.7, 0.35, 0.3, 0);
      }
    }
    this.shellMesh.count = si;
    this.shellMesh.instanceMatrix.needsUpdate = true;
  }
}
