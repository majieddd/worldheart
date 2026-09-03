import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import { clamp, SIM_RANDOM } from './noise.js';
import { R, terrainHeight } from './world.js';

// Evolution tier, set by the 99 Planets shell and 0 in every other mode.
export const EVO = { tier: 0 };

// How many hits a tier-3 shield soaks before it breaks.
const SHIELD_HITS = 3;
const _mePos = new THREE.Vector3();
const _alPos = new THREE.Vector3();

// Enemy melee. An enemy NEVER walks toward an ally and never holds a target:
// it swings at whatever is already standing inside its own reach, and the only
// thing that stops it is its own wind-up. That is what keeps waves provably
// alive - the worst case is a mite halted 0.25s out of every 1.00s, so it still
// makes 75% of nominal progress toward the heart with no budget, no breakoff
// and no shared clock to get stuck in. Letting enemies chase instead would turn
// every ally into a flow-field attractor and make the commander the tank for
// every wave again, which is the exact failure the frontier-capped post radius
// was added to fix.
const MELEE_SCAN = 0.2;        // seconds between reach checks, staggered per body
// Melee grows with the wave so a garrison does not become free forever, but far
// slower than enemy health does, and it is capped.
const ATK_SCALE_SLOPE = 0.35;
const ATK_SCALE_CAP = 4;
// Deep Freeze holds for this long, then has to let go for this long.
const FREEZE_BUDGET = 4;
const FREEZE_LAPSE = 2.5;

// Each tier adds a trait AND a visual tell, so the swarm changing is legible
// in play rather than only in the numbers.
const EVO_TIERS = [
  { armour: 0, speedMul: 1, shield: false, split: false, tint: null },
  { armour: 2, speedMul: 1, shield: false, split: false, tint: 0x8a97b5 },
  { armour: 2, speedMul: 1.18, shield: false, split: false, tint: 0xc2a15a },
  { armour: 3, speedMul: 1.18, shield: true, split: false, tint: 0x6fe0d0 },
  { armour: 3, speedMul: 1.22, shield: true, split: true, tint: 0xd06fe0 },
];

export function evoTraits() {
  return EVO_TIERS[Math.min(EVO.tier, EVO_TIERS.length - 1)];
}

// Enemy simulation: flow-field steering with turn limits, separation, and
// surface reprojection for walkers; great-circle flight for flyers.
// Rendering is instanced per species. Cosmetic animation state lives in the
// renderer write, never in the simulation.

export const ENEMY_TYPES = {
  mite: {
    name: 'Mite', hp: 26, speed: 3.1, radius: 0.32, bounty: 6, damage: 1,
    armor: 0, flying: false, altitude: 0, score: 10,
    atk: 7, swing: 1.00, wind: 0.25, reach: 1.2,
  },
  husk: {
    name: 'Husk', hp: 85, speed: 1.85, radius: 0.42, bounty: 12, damage: 1,
    armor: 0, flying: false, altitude: 0, score: 25,
    atk: 11, swing: 1.40, wind: 0.40, reach: 1.3,
  },
  aegis: {
    name: 'Aegis', hp: 340, speed: 1.1, radius: 0.55, bounty: 32, damage: 2,
    armor: 6, flying: false, altitude: 0, score: 60,
    atk: 16, swing: 1.60, wind: 0.45, reach: 1.4,
  },
  wisp: {
    name: 'Wisp', hp: 52, speed: 2.5, radius: 0.4, bounty: 14, damage: 1,
    armor: 0, flying: true, altitude: 2.6, score: 30,
    // Short reach for its altitude, so a wisp has to come down to bite and
    // cannot kite a ground unit that has no answer to it.
    atk: 6, swing: 1.10, wind: 0.30, reach: 1.6,
  },
  colossus: {
    name: 'Colossus', hp: 3600, speed: 0.72, radius: 1.05, bounty: 320, damage: 6,
    armor: 10, flying: false, altitude: 0, boss: true, score: 500,
    atk: 90, swing: 2.40, wind: 0.60, reach: 1.5,
  },
};

const _dir = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _des = new THREE.Vector3();
const _sep = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _up = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _mBasis = new THREE.Matrix4();
const _col = new THREE.Color();
const _look = new THREE.Vector3();
const _frame = new THREE.Matrix4();
const _lp = new THREE.Vector3();
const _lq = new THREE.Quaternion();
const _ls = new THREE.Vector3();
const _eul = new THREE.Euler();

let nextId = 1;

class Enemy {
  constructor() {
    this.dir = new THREE.Vector3();
    this.fwd = new THREE.Vector3();
    this.active = false;
  }
  init(typeKey, type, dirVec, node, hpScale) {
    this.id = nextId++;
    this.typeKey = typeKey;
    this.type = type;
    this.hpScaleUsed = hpScale;
    this.dir.copy(dirVec);
    this.node = node;
    this.hpMax = Math.round(type.hp * hpScale);
    this.hp = this.hpMax;
    this.speed = type.speed;
    this.slowFrac = 0;
    this.slowT = 0;
    this.stunT = 0;
    this.flashT = 0;
    this.spawnT = 0;
    this.progress = 1e9;
    this.active = true;
    this.dead = false;
    this.reached = false;
    this.brittle = 0;
    // Evolution state. Reset on every init because enemies come from a pool
    // and a recycled body must not inherit the last one's shield or split flag.
    this.shieldT = 0;
    this.shieldHits = 0;
    this.isSplit = false;
    this.atkCd = 0;
    this.windT = 0;
    this.scanT = 0;
    this.atkVictim = null;
    // These belong to the ally hold budget in js/allies.js but live on the
    // enemy, and enemies come from a pool. Without resetting them a recycled
    // body can spawn already hold-immune, or with a budget so nearly spent
    // that the first unit to reach it cannot hold it at all.
    this._holdT = 0;
    this._holdLapseUntil = -1;
    this._holdStamp = -1;
    this._frzT = 0;
    this._frzLapseUntil = -1;
    this._frzStamp = -1;
    this._frzOk = true;
    this.phase = Math.random() * Math.PI * 2;
    this.hopPrev = 0;
    this.plates = 6;
    // starting forward: any tangent
    _tmp.set(0, 1, 0);
    if (Math.abs(this.dir.y) > 0.9) _tmp.set(1, 0, 0);
    this.fwd.crossVectors(this.dir, _tmp).normalize();
    this.height = terrainHeight(this.dir.x, this.dir.y, this.dir.z);
  }
}

export class EnemyManager {
  constructor(scene, nav) {
    this.scene = scene;
    this.nav = nav;
    this.spaceMode = CONFIG.map.mode === 'space';
    this.zoomScale = 1;
    this.pool = [];
    this.active = [];
    this.onLeak = null;
    this.onKill = null;
    // Set by main.js. Held as a plain reference rather than imported, because
    // allies.js already imports this module and the pair would not resolve.
    this.allies = null;
    this.onMeleeWindUp = null;
    this.onMeleeHit = null;
    this.atkScale = 1;
    this.onDeathFx = null;
    this.onSpawnFx = null;
    this.heartPos = new THREE.Vector3();
    this.time = 0;
    this._buildRenderers(scene);
  }

  setHeart(pos) {
    this.heartPos.copy(pos);
    this.heartDir = pos.clone().normalize();
  }

  _buildRenderers(scene) {
    // Articulated species: each species is a set of instanced parts; every
    // enemy contributes one instance per part with a per-frame local
    // transform driven by time, phase, and motion state. All animation here
    // is cosmetic and reads sim state only.
    const bodyMat = new THREE.MeshStandardMaterial({
      color: PALETTE.voidBody, roughness: 0.5, metalness: 0.2, flatShading: true,
      emissive: PALETTE.voidEmissive, emissiveIntensity: 0.12,
    });
    const plateMat = new THREE.MeshStandardMaterial({
      color: PALETTE.voidPlate, roughness: 0.62, metalness: 0.15, flatShading: true,
      emissive: PALETTE.voidEmissive, emissiveIntensity: 0.06,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: PALETTE.voidEmissive, roughness: 0.4, metalness: 0, flatShading: true,
      emissive: PALETTE.voidEmissive, emissiveIntensity: 2.1,
    });
    this.materials = { bodyMat, plateMat, glowMat };

    const legGeo = new THREE.ConeGeometry(0.05, 0.3, 4);
    legGeo.translate(0, -0.15, 0);
    const wingGeo = new THREE.TetrahedronGeometry(0.4);
    wingGeo.scale(1.35, 0.09, 0.8);
    const tailGeo = new THREE.ConeGeometry(0.08, 0.62, 4);
    tailGeo.rotateX(Math.PI / 2);

    const defs = {
      mite: [
        { geo: new THREE.OctahedronGeometry(0.26).scale(0.85, 0.62, 1.35), mat: plateMat, per: 1 },
        { geo: new THREE.OctahedronGeometry(0.1).scale(0.8, 0.5, 1), mat: glowMat, per: 1 },
        { geo: legGeo, mat: bodyMat, per: 6 },
      ],
      husk: [
        { geo: new THREE.OctahedronGeometry(0.34).scale(1, 0.78, 1.25), mat: plateMat, per: 1 },
        { geo: new THREE.OctahedronGeometry(0.12).scale(1.4, 0.5, 0.8), mat: glowMat, per: 1 },
        { geo: new THREE.OctahedronGeometry(0.26).scale(1, 0.82, 0.9), mat: bodyMat, per: 4 },
      ],
      aegis: [
        { geo: new THREE.CylinderGeometry(0.3, 0.46, 1.15, 5), mat: bodyMat, per: 1 },
        { geo: new THREE.CylinderGeometry(0.34, 0.34, 0.1, 5), mat: glowMat, per: 1 },
        { geo: new THREE.BoxGeometry(0.16, 0.72, 0.5), mat: plateMat, per: 2 },
        { geo: new THREE.OctahedronGeometry(0.14), mat: glowMat, per: 1 },
      ],
      wisp: [
        { geo: new THREE.OctahedronGeometry(0.26).scale(0.9, 0.62, 1.5), mat: plateMat, per: 1 },
        { geo: new THREE.OctahedronGeometry(0.09), mat: glowMat, per: 2 },
        { geo: wingGeo, mat: bodyMat, per: 2 },
        { geo: tailGeo, mat: bodyMat, per: 1 },
      ],
      colossus: [
        { geo: new THREE.IcosahedronGeometry(0.62, 1), mat: glowMat, per: 1 },
        { geo: new THREE.BoxGeometry(0.6, 0.95, 0.16), mat: plateMat, per: 6 },
        { geo: new THREE.OctahedronGeometry(0.2), mat: bodyMat, per: 3 },
      ],
    };

    this.species = {};
    for (const key of Object.keys(defs)) {
      const parts = defs[key].map((p) => {
        const mesh = new THREE.InstancedMesh(p.geo, p.mat, CONFIG.limits.maxEnemies * p.per);
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        // Instanced, so the whole swarm costs one shadow draw per body part.
        // Glow parts stay out of the map for the same reason tower energy does:
        // a shadow cast by a light source reads as a modelling error.
        mesh.castShadow = p.mat !== glowMat;
        mesh.receiveShadow = true;
        scene.add(mesh);
        return { mesh, per: p.per, glow: p.mat === glowMat };
      });
      this.species[key] = parts;
    }
  }

  spawn(typeKey, portalNode, hpScale = 1) {
    if (this.active.length >= CONFIG.limits.maxEnemies) return null;
    const type = ENEMY_TYPES[typeKey];
    // A mode may pull the spawn point inward. 99 Planets does: its breach
    // sites are authored across the FINAL cap, so at wave 1 an unremapped
    // spawn appears ~125 units outside a ~12 unit circle and the walk in is
    // most of the wave.
    if (this.spawnNodeOverride) {
      const remapped = this.spawnNodeOverride(portalNode);
      if (remapped >= 0) portalNode = remapped;
    }
    const e = this.pool.pop() || new Enemy();
    this.nav.nodeDir(portalNode, _dir);
    // slight scatter around the portal
    _tmp.set(SIM_RANDOM.next() - 0.5, SIM_RANDOM.next() - 0.5, SIM_RANDOM.next() - 0.5).multiplyScalar(0.02);
    _dir.add(_tmp).normalize();
    e.init(typeKey, type, _dir, portalNode, hpScale);
    // Space waves fly in three altitude bands; high rocks command high
    // lanes, low rocks guard the deep drifts. Flyers ride slightly higher.
    e.alt = this.spaceMode
      ? 1.7 + (e.id % 3) * 1.8 + (type.flying ? 0.7 : 0)
      : type.altitude;
    this.active.push(e);
    if (this.onSpawnFx) this.onSpawnFx(e);
    return e;
  }

  // Returns true while the body is planted mid-wind-up. Never acquires, never
  // steers: it only asks whether something is already close enough to hit.
  _melee(e, dt) {
    const type = e.type;
    if (!type.atk || !this.allies) return false;
    if (e.atkCd > 0) e.atkCd -= dt;

    if (e.windT > 0) {
      e.windT -= dt;
      if (e.windT > 0) return true;
      // The blow lands only if the victim is still there and still in reach,
      // so stepping out of a telegraphed swing beats it.
      const v = e.atkVictim;
      e.atkVictim = null;
      e.atkCd = type.swing;
      if (v && v.active && !v.dead) {
        this.enemyPos(e, _mePos);
        this.allies.worldPos(v, _alPos);
        if (_alPos.distanceTo(_mePos) <= type.reach + 0.35) {
          this.allies.damage(v, type.atk * this.atkScale);
          if (this.onMeleeHit) this.onMeleeHit(e, v);
        }
      }
      return false;
    }

    if (e.atkCd > 0) return false;
    e.scanT -= dt;
    if (e.scanT > 0) return false;
    e.scanT = MELEE_SCAN;

    this.enemyPos(e, _mePos);
    let best = null;
    let bestD = type.reach;
    for (const a of this.allies.active) {
      if (!a.active || a.dead) continue;
      const d = this.allies.worldPos(a, _alPos).distanceTo(_mePos);
      if (d <= bestD) { bestD = d; best = a; }
    }
    if (!best) return false;
    e.atkVictim = best;
    e.windT = type.wind;
    if (this.onMeleeWindUp) this.onMeleeWindUp(e, best);
    return true;
  }

  enemyPos(e, out) {
    const h = Math.max(e.height, 0.03);
    return out.copy(e.dir).multiplyScalar(R + h + (e.alt ?? e.type.altitude) + e.type.radius * 0.9);
  }

  // Deep Freeze is a hold with no damage attached, so it needs the same
  // guarantee the ally hold has: it may pin a body for a while and must then
  // let it walk, or a cryo field is a wave that never resolves.
  mayFreeze(e, dt) {
    if (e._frzStamp === this.time) return e._frzOk;
    if (this.time - (e._frzStamp ?? -1) > FREEZE_LAPSE) e._frzT = 0;
    e._frzStamp = this.time;
    if (!(e._frzLapseUntil > this.time)) {
      e._frzT = (e._frzT || 0) + dt;
      if (e._frzT > FREEZE_BUDGET) { e._frzT = 0; e._frzLapseUntil = this.time + FREEZE_LAPSE; }
    }
    e._frzOk = !(e._frzLapseUntil > this.time);
    return e._frzOk;
  }

  damage(e, amount, opts = {}) {
    if (!e.active || e.dead) return 0;
    let dmg = amount;
    const evo = evoTraits();
    if (!opts.trueDamage) {
      const armor = Math.max(0, e.type.armor + evo.armour - (opts.armorPierce || 0));
      dmg = Math.max(1, amount - armor);
    }
    if (e.brittle > 0) dmg *= 1.12;
    // A player strike passes a cap so that no single blow can delete a healthy
    // body. Applied after armour and brittle, before the shield, so it bounds
    // what actually lands rather than what was asked for.
    if (opts.capFrac) dmg = Math.min(dmg, e.hpMax * opts.capFrac);
    // Tier 3 shield: it soaks a few hits and then breaks, and only recharges
    // after three seconds without being touched. So sustained fire beats it and
    // poking at it does not.
    //
    // The previous form re-armed a blanket 3-second immunity on EVERY hit,
    // which inverted the whole intent: continuous fire could never land a
    // second hit, so from evolution tier 3 onward every enemy - the wave-15
    // boss included - was effectively immortal and the wave never cleared.
    if (evo.shield) {
      if (e.shieldT <= 0) e.shieldHits = SHIELD_HITS;   // left alone: recharged
      e.shieldT = 3;                                    // this hit resets the recharge
      if (e.shieldHits > 0) { e.shieldHits--; dmg = 0; }
    } else {
      e.shieldT = 0;
      e.shieldHits = 0;
    }
    e.hp -= dmg;
    e.flashT = 0.09;
    // Boss armor plates shed at HP thresholds and each births escorts.
    if (e.type.boss && e.hp > 0) {
      const target = Math.max(1, Math.ceil(6 * e.hp / e.hpMax));
      while (e.plates > target) {
        e.plates--;
        if (this.onShedFx) this.onShedFx(e);
        this.spawn('mite', e.node, e.hpScaleUsed);
        this.spawn('mite', e.node, e.hpScaleUsed);
      }
    }
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      // Tier 4: mites divide. isSplit stops the cascade being infinite.
      if (evo.split && e.typeKey === 'mite' && !e.isSplit) {
        for (let i = 0; i < 2; i++) {
          const child = this.spawn('mite', e.node, e.hpScaleUsed);
          if (child) { child.isSplit = true; child.hp = Math.max(1, child.hp * 0.4); }
        }
      }
      if (this.onKill) this.onKill(e);
      if (this.onDeathFx) this.onDeathFx(e);
      this._release(e);
    }
    return dmg;
  }

  applySlow(e, frac, dur) {
    if (!e.active) return;
    e.slowFrac = Math.max(e.slowFrac, frac);
    e.slowT = Math.max(e.slowT, dur);
  }

  applyStun(e, dur) {
    if (!e.active) return;
    e.stunT = Math.max(e.stunT, dur);
  }

  applyBrittle(e, dur) {
    if (!e.active) return;
    e.brittle = Math.max(e.brittle, dur);
  }

  _release(e) {
    e.active = false;
    const i = this.active.indexOf(e);
    if (i >= 0) this.active.splice(i, 1);
    this.pool.push(e);
  }

  update(dt) {
    this.time += dt;
    const heartR2 = 2.1 * 2.1;

    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.spawnT += dt;
      e.flashT = Math.max(0, e.flashT - dt);
      e.brittle = Math.max(0, e.brittle - dt);
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowFrac = 0; }
      // Melee is resolved BEFORE the stun guard. An ally holds an enemy the
      // instant it engages, so leaving this below the guard meant a held enemy
      // could never even register that something was standing in front of it,
      // and it was stunlocked for the whole hold budget without ever swinging.
      // Only movement is stopped by a stun; the swing clock keeps running.
      const swinging = this._melee(e, dt);
      if (e.stunT > 0) { e.stunT -= dt; continue; }

      const type = e.type;
      if (e.shieldT > 0) e.shieldT -= dt;
      let stepSpeed = e.speed * (1 - e.slowFrac) * evoTraits().speedMul;
      if (e.spawnT < 0.5) stepSpeed *= e.spawnT * 2;
      // Planted for the wind-up so the blow reads as a blow. This is the ONLY
      // thing an ally can do to slow an enemy's march other than the bounded
      // hold, which is what keeps the wave guaranteed to resolve.
      if (swinging) stepSpeed = 0;

      // Flyers ride the same corridors as walkers (the flow field ignores
      // nothing for them: tower blocks do not enter their steering) but the
      // field itself routes them over the defended lanes, which keeps
      // anti-air placement meaningful. sampleFlow falls back to a great
      // circle wherever the field is undefined.
      e.node = this.nav.descendNode(e.node, e.dir);
      e.progress = this.nav.sampleFlow(e.node, e.dir, _des);

      // Separation from nearby enemies of the same plane (walkers vs flyers).
      _sep.set(0, 0, 0);
      for (let k = 0; k < this.active.length; k++) {
        if (k === i) continue;
        const o = this.active[k];
        if (!this.spaceMode && o.type.flying !== type.flying) continue;
        _tmp.copy(e.dir).sub(o.dir);
        const d2 = _tmp.lengthSq();
        const rad = (type.radius + o.type.radius) * 1.25 / R;
        if (d2 < rad * rad && d2 > 1e-9) {
          _tmp.multiplyScalar(1 / Math.sqrt(d2) * (1 - Math.sqrt(d2) / rad));
          _sep.add(_tmp);
        }
      }
      if (_sep.lengthSq() > 0) {
        const sd = _sep.dot(e.dir);
        _sep.addScaledVector(e.dir, -sd);
        _des.addScaledVector(_sep, 34).normalize();
      }

      // Turn-rate limited steering
      const turn = type.flying ? 2.6 : 3.4;
      e.fwd.lerp(_des, Math.min(1, turn * dt)).normalize();
      const fd = e.fwd.dot(e.dir);
      e.fwd.addScaledVector(e.dir, -fd).normalize();

      // Advance along the sphere
      const ang = (stepSpeed * dt) / R;
      e.dir.addScaledVector(e.fwd, ang).normalize();
      e.height = terrainHeight(e.dir.x, e.dir.y, e.dir.z);

      // Heart contact. In space the bands dive on arrival, so contact is
      // measured along the surface rather than in 3D (a low-band drifter
      // must still be able to reach a heart on a tall rock).
      if (this.spaceMode) {
        const dot = e.dir.dot(this.heartDir);
        const lateral = Math.acos(clamp(dot, -1, 1)) * R;
        if (lateral < 3.4) {
          e.reached = true;
          if (this.onLeak) this.onLeak(e);
          this._release(e);
        }
      } else {
        _tmp.copy(e.dir).multiplyScalar(R + Math.max(e.height, 0.03) + e.alt);
        if (_tmp.distanceToSquared(this.heartPos) < heartR2 + e.alt * e.alt) {
          e.reached = true;
          if (this.onLeak) this.onLeak(e);
          this._release(e);
        }
      }
    }

    this._render(dt);
  }

  // Local-space placers per species part. Enemy local frame: -Z forward,
  // +Y up. Each returns false to hide the instance (shed plates).
  _placePart(e, key, partIdx, k, t) {
    const φ = e.phase;
    _lp.set(0, 0, 0); _lq.identity(); _ls.set(1, 1, 1);
    switch (key) {
      case 'mite': {
        const skitter = Math.sin(t * 15 + φ);
        if (partIdx === 0) {
          _lp.set(0, 0.24 + Math.abs(skitter) * 0.05, 0);
          _lq.setFromEuler(_eul.set(0.08, Math.sin(t * 11 + φ) * 0.16, skitter * 0.08));
        } else if (partIdx === 1) {
          _lp.set(0, 0.3, -0.28);
        } else {
          const side = k < 3 ? -1 : 1;
          const idx = k % 3;
          const swing = Math.sin(t * 24 + φ + idx * 2.1 + (side > 0 ? Math.PI : 0));
          _lp.set(side * 0.2, 0.26, (idx - 1) * 0.15);
          _lq.setFromEuler(_eul.set(swing * 0.35, 0, side * (0.85 + swing * 0.25)));
        }
        break;
      }
      case 'husk': {
        if (partIdx === 0) {
          _lp.set(0, 0.32 + Math.sin(t * 4.2 + φ) * 0.03, 0);
          _lq.setFromEuler(_eul.set(Math.sin(t * 4.2 + φ) * 0.06, 0, 0));
        } else if (partIdx === 1) {
          _lp.set(0, 0.4, -0.3);
        } else {
          const i = k + 1;
          const sway = Math.sin(t * 3.4 + φ - i * 1.15);
          _lp.set(sway * 0.09 * i, 0.26 + Math.sin(t * 4.2 + φ - i * 0.9) * 0.045, i * 0.4);
          _lq.setFromEuler(_eul.set(0, sway * 0.22, 0));
          const s = Math.pow(0.88, i) * (1 + (e.flashT > 0 ? 0.12 : 0));
          _ls.setScalar(s);
        }
        break;
      }
      case 'aegis': {
        const hp = (t * 1.05 + φ * 0.3) % 1;
        const rise = Math.pow(Math.max(Math.sin(Math.PI * hp), 0), 0.9) * 0.42;
        if (hp < e.hopPrev) this.onLandFx?.(e);
        if (partIdx === 3) e.hopPrev = hp;
        if (partIdx === 0) {
          _lp.set(0, 0.6 + rise, 0);
          _ls.set(1, 1 - Math.sin(2 * Math.PI * hp) * 0.1, 1);
        } else if (partIdx === 1) {
          _lp.set(0, 0.1 + rise * 0.4, 0);
        } else if (partIdx === 2) {
          const side = k === 0 ? -1 : 1;
          _lp.set(side * 0.44, 0.62 + rise, 0);
          _lq.setFromEuler(_eul.set(0, 0, side * (0.12 + rise * 0.2)));
        } else {
          _lp.set(0, 1.34 + rise, 0);
          _lq.setFromEuler(_eul.set(0, t * 2.2 + φ, 0));
        }
        break;
      }
      case 'wisp': {
        if (partIdx === 0) {
          _lp.set(0, 0, 0);
          _lq.setFromEuler(_eul.set(Math.sin(t * 3.1 + φ) * 0.1, 0, Math.sin(t * 1.7 + φ) * 0.16));
        } else if (partIdx === 1) {
          const side = k === 0 ? -1 : 1;
          _lp.set(side * 0.14, 0.06, -0.3);
        } else if (partIdx === 2) {
          const side = k === 0 ? -1 : 1;
          const flap = Math.sin(t * 9.5 + φ) * 0.75;
          _lp.set(side * 0.34, 0.02, 0.06);
          _lq.setFromEuler(_eul.set(0, side * -0.18, side * (0.25 + flap)));
        } else {
          _lp.set(0, 0, 0.5);
          _lq.setFromEuler(_eul.set(Math.sin(t * 6 + φ + 1.5) * 0.3, 0, 0));
        }
        break;
      }
      case 'colossus': {
        const stomp = Math.sin(t * 2.2 + φ);
        if (partIdx === 0) {
          _lp.set(0, 1.05 + stomp * 0.08, 0);
          const pulse = 1 + Math.sin(t * 3.4) * 0.05;
          _ls.setScalar(pulse);
        } else if (partIdx === 1) {
          if (k >= e.plates) return false;
          const a = t * 0.55 + (k / 6) * Math.PI * 2;
          _lp.set(Math.cos(a) * 1.05, 1.0 + Math.sin(t * 1.3 + k * 1.9) * 0.12, Math.sin(a) * 1.05);
          _lq.setFromEuler(_eul.set(0, -a + Math.PI / 2, Math.sin(t * 0.9 + k) * 0.1));
        } else {
          const a = -t * 0.85 + (k / 3) * Math.PI * 2;
          _lp.set(Math.cos(a) * 0.65, 1.8 + Math.sin(t * 1.6 + k * 2.3) * 0.1, Math.sin(a) * 0.65);
          _lq.setFromEuler(_eul.set(t * 1.3 + k, t * 1.7, 0));
        }
        break;
      }
    }
    return true;
  }

  _render() {
    const t = this.time;
    const counters = this._counters || (this._counters = {});
    for (const key of Object.keys(this.species)) {
      const parts = this.species[key];
      for (const p of parts) p._n = 0;
    }

    for (const e of this.active) {
      const type = e.type;
      const parts = this.species[e.typeKey];
      const hRaw = Math.max(e.height, 0.03);
      const bob = (type.flying || this.spaceMode) ? Math.sin(t * 3.1 + e.phase) * 0.2 : 0;
      _tmp.copy(e.dir).multiplyScalar(R + hRaw + e.alt + bob);
      _up.copy(e.dir);
      _look.copy(_tmp).add(e.fwd);
      _mBasis.lookAt(_tmp, _look, _up);
      _q.setFromRotationMatrix(_mBasis);
      const pop = e.spawnT < 0.35 ? 0.25 + 0.75 * (e.spawnT / 0.35) : 1;
      const bodyScale = pop * (type.boss ? 1.55 : 1.28) * this.zoomScale;
      _s.set(bodyScale, bodyScale, bodyScale);
      _frame.compose(_tmp, _q, _s);

      const flash = e.flashT > 0 ? 1 : 0;
      const slowT = e.slowFrac > 0 ? 1 : 0;

      for (let pi = 0; pi < parts.length; pi++) {
        const part = parts[pi];
        for (let k = 0; k < part.per; k++) {
          if (!this._placePart(e, e.typeKey, pi, k, t)) continue;
          _m4.compose(_lp, _lq, _ls);
          _m4.premultiply(_frame);
          part.mesh.setMatrixAt(part._n, _m4);
          if (part.glow) {
            _col.setRGB(1 + flash * 2, 1 + flash * 2 + slowT * 0.5, 1 + flash * 2 + slowT * 1);
          } else {
            _col.setRGB(1 + flash * 5 + slowT * 0.1, 1 + flash * 5 + slowT * 0.9, 1 + flash * 5 + slowT * 2.2);
          }
          part.mesh.setColorAt(part._n, _col);
          part._n++;
        }
      }
    }

    for (const key of Object.keys(this.species)) {
      for (const part of this.species[key]) {
        part.mesh.count = part._n;
        part.mesh.instanceMatrix.needsUpdate = true;
        if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  clearAll() {
    for (let i = this.active.length - 1; i >= 0; i--) this._release(this.active[i]);
  }
}
