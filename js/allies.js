import * as THREE from 'three';
import { PALETTE } from './config.js';
import { clamp, SIM_RANDOM } from './noise.js';
import { R, terrainHeight } from './world.js';

// Friendly units. Summoned by warden towers, and the thing the player can take
// direct control of.
//
// They live on the sphere the same way enemies do, a unit direction plus a
// terrain height, so all the existing surface maths applies. Rendering is
// instanced per body part, matching enemies.js, so a full field of them costs a
// handful of draw calls.
//
// Deliberately high health and low damage: a unit is a body that holds ground
// and buys time for towers, not a damage dealer. That is also what keeps
// possession from being a damage upgrade.

export const ALLY_TYPES = {
  warden: {
    name: 'Warden', hp: 220, speed: 2.4, radius: 0.42, dps: 7,
    aggro: 9, reach: 1.15, scale: 1,
  },
  // Commanders are permanent, far stronger, and carry the run: if one dies the
  // run ends, which is what makes taking a party into the fog a real gamble.
  commander: {
    name: 'Commander', hp: 1400, speed: 3.0, radius: 0.6, dps: 26,
    aggro: 13, reach: 1.5, scale: 1.5, commander: true,
  },
};

const MAX_ALLIES = 96;

// Damage per second an enemy deals to a unit it is in contact with, per point
// of that enemy's leak damage. Tuned so a lone warden holds two mites for a
// while and folds to a pack.
const CONTACT_DPS = 5.5;

const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _basis = new THREE.Matrix4();

let nextAllyId = 1;

// Rotate `dir` toward `target` by at most maxAng radians. Both are unit
// vectors on the sphere.
function steerToward(dir, target, maxAng) {
  const ang = Math.acos(clamp(dir.dot(target), -1, 1));
  if (ang < 1e-5) return;
  _axis.crossVectors(dir, target);
  if (_axis.lengthSq() < 1e-12) return;
  _axis.normalize();
  dir.applyAxisAngle(_axis, Math.min(ang, maxAng)).normalize();
}

// Walk `dir` along the great circle toward `target`. Returns true on arrival.
function advanceToward(dir, target, arcDist) {
  const ang = Math.acos(clamp(dir.dot(target), -1, 1));
  if (ang < 1e-6) return true;
  _axis.crossVectors(dir, target);
  if (_axis.lengthSq() < 1e-12) return true;
  _axis.normalize();
  const step = Math.min(ang, arcDist);
  dir.applyAxisAngle(_axis, step).normalize();
  return step >= ang;
}

class Ally {
  constructor() {
    this.dir = new THREE.Vector3();
    this.fwd = new THREE.Vector3();
    this.anchor = new THREE.Vector3();
    this.wander = new THREE.Vector3();
    this.patrol = null;
    this.active = false;
  }

  init(typeKey, type, dirVec, anchorDir, leash) {
    this.id = nextAllyId++;
    this.typeKey = typeKey;
    this.type = type;
    this.dir.copy(dirVec).normalize();
    this.anchor.copy(anchorDir).normalize();
    this.leash = leash;
    this.patrol = null;
    this.hpMax = type.hp;
    this.hp = type.hp;
    this.state = 'roam';
    this.target = null;
    this.swingT = 0;
    this.flashT = 0;
    this.wanderT = 0;
    this.active = true;
    this.dead = false;
    this.possessed = false;
    this.following = null;
    this.phase = SIM_RANDOM.next() * Math.PI * 2;
    this.height = terrainHeight(this.dir.x, this.dir.y, this.dir.z);
    _tmp.set(0, 1, 0);
    if (Math.abs(this.dir.y) > 0.9) _tmp.set(1, 0, 0);
    this.fwd.crossVectors(this.dir, _tmp).normalize();
    this.wander.copy(this.dir);
  }
}

export class AllyManager {
  constructor(scene, enemies) {
    this.scene = scene;
    this.enemies = enemies;
    this.pool = [];
    this.active = [];
    this.time = 0;
    this.onDeath = null;            // (ally) => void
    this.onCommanderLost = null;    // (ally) => void
    this.onPortalDestroyed = null;  // (portal) => void
    this.world = null;              // set by main; needed to siege breaches
    this._build(scene);
  }

  _build(scene) {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: PALETTE.techBody, roughness: 0.55, metalness: 0.25, flatShading: true,
      emissive: PALETTE.energy, emissiveIntensity: 0.1,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: PALETTE.techTrim, roughness: 0.4, metalness: 0.35, flatShading: true,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: PALETTE.gold, roughness: 0.35, metalness: 0.5, flatShading: true,
      emissive: PALETTE.gold, emissiveIntensity: 0.5,
    });

    const legGeo = new THREE.BoxGeometry(0.09, 0.34, 0.09);
    legGeo.translate(0, -0.17, 0);

    // Part order matters: the renderer places index 0 as the torso, 1 as the
    // head, 2 as the paired legs, 3 as an optional ring.
    const defs = {
      warden: [
        { geo: new THREE.BoxGeometry(0.38, 0.46, 0.28), mat: bodyMat, per: 1 },
        { geo: new THREE.OctahedronGeometry(0.15), mat: trimMat, per: 1 },
        { geo: legGeo, mat: bodyMat, per: 2 },
      ],
      commander: [
        { geo: new THREE.BoxGeometry(0.46, 0.58, 0.34), mat: bodyMat, per: 1 },
        { geo: new THREE.ConeGeometry(0.2, 0.4, 5), mat: goldMat, per: 1 },
        { geo: legGeo, mat: trimMat, per: 2 },
        { geo: new THREE.TorusGeometry(0.34, 0.03, 6, 16), mat: goldMat, per: 1 },
      ],
    };

    this.species = {};
    for (const key of Object.keys(defs)) {
      this.species[key] = defs[key].map((p) => {
        const mesh = new THREE.InstancedMesh(p.geo, p.mat, MAX_ALLIES * p.per);
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        // Gold trim is emissive; a glowing part casting a hard shadow reads as
        // solid geometry, the same rule the towers follow.
        mesh.castShadow = p.mat !== goldMat;
        mesh.receiveShadow = true;
        scene.add(mesh);
        return { mesh, per: p.per };
      });
    }
  }

  count(typeKey) {
    let n = 0;
    for (const a of this.active) if (a.typeKey === typeKey) n++;
    return n;
  }

  spawn(typeKey, dirVec, anchorDir, leash = 6) {
    const type = ALLY_TYPES[typeKey];
    if (!type || this.active.length >= MAX_ALLIES) return null;
    const a = this.pool.pop() || new Ally();
    a.init(typeKey, type, dirVec, anchorDir || dirVec, leash);
    this.active.push(a);
    return a;
  }

  worldPos(a, out) {
    return out.copy(a.dir).multiplyScalar(R + Math.max(a.height, 0.03) + a.type.radius * 0.9);
  }

  enemyPos(e, out) {
    const h = Math.max(e.height, 0.03);
    return out.copy(e.dir).multiplyScalar(R + h + (e.alt ?? e.type.altitude) + e.type.radius * 0.9);
  }

  _release(a) {
    a.active = false;
    a.possessed = false;
    const i = this.active.indexOf(a);
    if (i >= 0) this.active.splice(i, 1);
    this.pool.push(a);
  }

  damage(a, amount) {
    if (!a.active || a.dead) return 0;
    a.hp -= amount;
    a.flashT = 0.1;
    if (a.hp <= 0) {
      a.dead = true;
      const wasCommander = a.type.commander;
      if (this.onDeath) this.onDeath(a);
      this._release(a);
      // Reported after release so a handler that resets the run does not see a
      // corpse still standing in the active list.
      if (wasCommander && this.onCommanderLost) this.onCommanderLost(a);
    }
    return amount;
  }

  // Nearest living enemy within `range` world units.
  _findEnemy(a, range) {
    let best = null;
    let bestD = range * range;
    this.worldPos(a, _tmp);
    for (const e of this.enemies.active) {
      if (!e.active || e.dead) continue;
      const d2 = this.enemyPos(e, _tmp2).distanceToSquared(_tmp);
      if (d2 < bestD) { bestD = d2; best = e; }
    }
    return best;
  }

  // A fresh wander target inside the leash, around the patrol point if one is
  // set, otherwise around the summoning tower.
  _reroll(a) {
    const centre = a.patrol || a.anchor;
    const leashAng = a.leash / R;
    _tmp.set(SIM_RANDOM.next() - 0.5, SIM_RANDOM.next() - 0.5, SIM_RANDOM.next() - 0.5);
    _tmp.addScaledVector(centre, -_tmp.dot(centre));   // into the tangent plane
    if (_tmp.lengthSq() < 1e-9) _tmp.set(1, 0, 0);
    _tmp.normalize();
    _axis.crossVectors(centre, _tmp);
    if (_axis.lengthSq() < 1e-12) _axis.set(0, 1, 0); else _axis.normalize();
    a.wander.copy(centre)
      .applyAxisAngle(_axis, leashAng * (0.35 + SIM_RANDOM.next() * 0.65))
      .normalize();
    a.wanderT = 2.5 + SIM_RANDOM.next() * 3;
  }

  setPatrol(a, dirVec) {
    a.patrol = dirVec ? dirVec.clone().normalize() : null;
    a.wanderT = 0;   // re-roll immediately so the order takes effect visibly
  }

  update(dt) {
    this.time += dt;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      if (!a.active || a.dead) continue;
      if (a.flashT > 0) a.flashT -= dt;
      if (a.swingT > 0) a.swingT -= dt;

      // A possessed unit is driven entirely by the player.
      if (a.possessed) { this._ground(a); continue; }

      const type = a.type;
      if (a.target && (!a.target.active || a.target.dead)) a.target = null;
      if (!a.target) a.target = this._findEnemy(a, type.aggro);

      if (a.target) {
        const d = this.enemyPos(a.target, _tmp2).distanceTo(this.worldPos(a, _tmp));
        if (d <= type.reach) {
          a.state = 'attack';
          // Holding the enemy in place IS the aggro: a unit that merely traded
          // damage would be walked straight past on the way to the heart. The
          // hold is short and re-applied while engaged, so killing the unit
          // frees the enemy immediately.
          this.enemies.applyStun(a.target, 0.22);
          if (a.swingT <= 0) {
            a.swingT = 0.55;
            this.enemies.damage(a.target, type.dps * 0.55, { armorPierce: 2 });
          }
        } else {
          a.state = 'chase';
          advanceToward(a.dir, a.target.dir, (type.speed * dt) / R);
          steerToward(a.fwd, a.target.dir, dt * 6);
        }
      } else if (this._attackPortal(a, dt)) {
        a.state = 'siege';
      } else if (a.following) {
        const lead = a.following;
        if (!lead.active || lead.dead) {
          a.following = null;
        } else {
          a.state = 'follow';
          const d = this.worldPos(lead, _tmp2).distanceTo(this.worldPos(a, _tmp));
          // A loose formation: close the gap only when it opens, so a party
          // does not jitter on top of its leader.
          if (d > 2.6) advanceToward(a.dir, lead.dir, (type.speed * 1.08 * dt) / R);
        }
      } else {
        a.state = 'roam';
        a.wanderT -= dt;
        if (a.wanderT <= 0) this._reroll(a);
        if (advanceToward(a.dir, a.wander, (type.speed * 0.55 * dt) / R)) this._reroll(a);
      }

      this._takeContactDamage(a, dt);
      if (!a.active || a.dead) continue;
      this._ground(a);
    }
    this._render();
  }

  // Enemies in contact grind the unit down. Continuous rather than swung, so a
  // unit surrounded dies fast and one picking off a straggler survives - which
  // is what makes a party into the fog a real risk.
  _takeContactDamage(a, dt) {
    this.worldPos(a, _tmp);
    const reach = a.type.reach + 0.35;
    let incoming = 0;
    for (const e of this.enemies.active) {
      if (!e.active || e.dead) continue;
      if (this.enemyPos(e, _tmp2).distanceTo(_tmp) <= reach) incoming += e.type.damage;
    }
    if (incoming > 0) this.damage(a, incoming * CONTACT_DPS * dt);
  }

  // Breaches are structures, and units are the only thing that can bring one
  // down: towers cannot reach out to them. This is what gives a party a reason
  // to leave the circle. Returns true if the unit is busy sieging.
  _attackPortal(a, dt) {
    if (!this.world) return false;
    this.worldPos(a, _tmp);
    const reach = a.type.reach + 2.6;   // breaches are large, so a wider reach
    for (const p of this.world.portals) {
      if (p.destroyed) continue;
      if (p.group.position.distanceTo(_tmp) > reach) continue;
      if (a.swingT <= 0) {
        a.swingT = 0.55;
        const felled = this.world.damagePortal(p, a.type.dps * 0.55);
        if (felled && this.onPortalDestroyed) this.onPortalDestroyed(p);
      }
      return true;
    }
    return false;
  }

  _ground(a) {
    a.height = terrainHeight(a.dir.x, a.dir.y, a.dir.z);
  }

  // Player-driven movement in the unit's own tangent frame.
  driveUnit(a, forward, strafe, dt) {
    if (!a.active || a.dead) return;
    _up.copy(a.dir);
    _right.crossVectors(a.fwd, _up).normalize();
    _tmp2.copy(a.fwd).multiplyScalar(forward).addScaledVector(_right, strafe);
    if (_tmp2.lengthSq() < 1e-8) return;
    _tmp2.addScaledVector(_up, -_tmp2.dot(_up));
    if (_tmp2.lengthSq() < 1e-8) return;
    _tmp2.normalize();
    _axis.crossVectors(a.dir, _tmp2);
    if (_axis.lengthSq() < 1e-12) return;
    _axis.normalize();
    a.dir.applyAxisAngle(_axis, (a.type.speed * 1.25 * dt) / R).normalize();
    this._ground(a);
  }

  // Turn a possessed unit. fwd is re-flattened against the surface every time
  // so it cannot drift off the tangent plane and corrupt the render basis.
  turnUnit(a, yawDelta) {
    if (!a.active || a.dead) return;
    a.fwd.applyAxisAngle(a.dir, -yawDelta);
    a.fwd.addScaledVector(a.dir, -a.fwd.dot(a.dir));
    if (a.fwd.lengthSq() < 1e-8) {
      _tmp.set(0, 1, 0);
      if (Math.abs(a.dir.y) > 0.9) _tmp.set(1, 0, 0);
      a.fwd.crossVectors(a.dir, _tmp);
    }
    a.fwd.normalize();
  }

  // A possessed unit swings wider than the AI does: everything in reach is hit.
  playerAttack(a) {
    if (!a.active || a.dead || a.swingT > 0) return 0;
    a.swingT = 0.45;
    let hits = 0;
    this.worldPos(a, _tmp);
    const reach = a.type.reach * 2.2;
    for (const e of this.enemies.active) {
      if (!e.active || e.dead) continue;
      if (this.enemyPos(e, _tmp2).distanceTo(_tmp) <= reach) {
        this.enemies.damage(e, a.type.dps * 1.4, { armorPierce: 4 });
        hits++;
      }
    }
    // The same swing brings down breaches, so clearing one by hand is possible.
    if (this.world) {
      for (const p of this.world.portals) {
        if (p.destroyed) continue;
        if (p.group.position.distanceTo(_tmp) > reach + 2.6) continue;
        const felled = this.world.damagePortal(p, a.type.dps * 1.4);
        if (felled && this.onPortalDestroyed) this.onPortalDestroyed(p);
        hits++;
      }
    }
    return hits;
  }

  gatherParty(leader, radius = 14) {
    if (!leader || !leader.active) return 0;
    let n = 0;
    this.worldPos(leader, _tmp);
    for (const a of this.active) {
      if (a === leader || a.dead || !a.active || a.possessed) continue;
      if (this.worldPos(a, _tmp2).distanceTo(_tmp) <= radius) { a.following = leader; n++; }
    }
    return n;
  }

  dismissParty(leader) {
    let n = 0;
    for (const a of this.active) if (a.following === leader) { a.following = null; n++; }
    return n;
  }

  partySize(leader) {
    let n = 0;
    for (const a of this.active) if (a.following === leader) n++;
    return n;
  }

  // Nearest ally to a world-space point, for click-to-possess.
  nearestTo(point, maxDist = 4) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const a of this.active) {
      if (!a.active || a.dead) continue;
      const d2 = this.worldPos(a, _tmp).distanceToSquared(point);
      if (d2 < bestD) { bestD = d2; best = a; }
    }
    return best;
  }

  _render() {
    for (const key of Object.keys(this.species)) {
      const parts = this.species[key];
      const counts = parts.map(() => 0);
      for (const a of this.active) {
        if (!a.active || a.dead || a.typeKey !== key) continue;
        this.worldPos(a, _tmp);
        _up.copy(a.dir);
        _fwd.copy(a.fwd).addScaledVector(_up, -a.fwd.dot(_up));
        if (_fwd.lengthSq() < 1e-8) _fwd.set(1, 0, 0);
        _fwd.normalize();
        _right.crossVectors(_up, _fwd).normalize();
        _basis.makeBasis(_right, _up, _fwd);
        _q.setFromRotationMatrix(_basis);

        const sc = a.type.scale;
        const bob = Math.sin(this.time * 6 + a.phase) * 0.035;
        const swing = a.swingT > 0 ? Math.sin((1 - a.swingT / 0.55) * Math.PI) * 0.28 : 0;

        for (let p = 0; p < parts.length; p++) {
          const part = parts[p];
          for (let k = 0; k < part.per; k++) {
            let ox = 0;
            let oy = 0;
            let oz = 0;
            if (p === 0) { oy = 0.28 * sc + bob; oz = swing * 0.3; }
            else if (p === 1) { oy = 0.62 * sc + bob; oz = 0.1 + swing; }
            else if (p === 2) {
              ox = (k === 0 ? -0.11 : 0.11) * sc;
              oy = 0.12 * sc;
              oz = Math.sin(this.time * 7 + a.phase + k * Math.PI) * 0.07;
            } else { oy = 0.05 * sc; }

            _tmp2.copy(_tmp)
              .addScaledVector(_up, oy)
              .addScaledVector(_fwd, oz)
              .addScaledVector(_right, ox);
            _s.set(sc, sc, sc);
            _m4.compose(_tmp2, _q, _s);
            part.mesh.setMatrixAt(counts[p]++, _m4);
          }
        }
      }
      for (let p = 0; p < parts.length; p++) {
        parts[p].mesh.count = counts[p];
        parts[p].mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  clearAll() {
    for (let i = this.active.length - 1; i >= 0; i--) this._release(this.active[i]);
    this._render();
  }
}
