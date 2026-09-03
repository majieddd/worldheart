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
    aggro: 9, reach: 1.15, scale: 1, regen: 0.05,
    // 9 per 0.80s is 11.25 dps, against the warden's own AI output of 7. It sits
    // under a wave-1 mite's 26 health by a factor of 2.9, so three swings are
    // always needed, and 1.8 keeps the swing on the ground: a wisp overhead is
    // 2.58 away, which a warden is not meant to answer.
    strike: { dmg: 9, cd: 0.80, radius: 1.8, cleave: 0.5, pierce: 2 },
  },
  // Commanders are permanent, far stronger, and carry the run: if one dies the
  // run ends, which is what makes taking a party into the fog a real gamble.
  commander: {
    name: 'Commander', hp: 1400, speed: 3.0, radius: 0.6, dps: 26,
    aggro: 13, reach: 1.5, scale: 1.5, commander: true, regen: 0.035,
    // A commander never goes looking for a fight on its own. Its death ends the
    // run, so that death has to be the consequence of a decision the PLAYER
    // made - walking it into the fog - not of autopilot wandering it into a
    // wave. It still hits anything that closes on it.
    holdsGround: true,
    // 26 per 0.90s is 28.9 dps, barely above the commander's own 26, so taking
    // the body is a change of vantage rather than a damage upgrade. Radius 2.6
    // clears the 2.42 to a wisp directly overhead by a small margin, which is
    // deliberate: a possessed commander is the only melee answer to flyers in
    // the game.
    strike: { dmg: 26, cd: 0.90, radius: 2.6, cleave: 0.5, pierce: 3 },
  },
};

const MAX_ALLIES = 96;

// A unit that can never heal turns a 15-wave run into pure attrition, and for
// a commander - whose death ends the run - that is a loss with no decision in
// it. Units recover only once nothing has hit them for a while, so healing is
// something you earn by pulling back rather than a passive drip mid-fight.
const REGEN_DELAY = 6;

// The hold is a tactic, never a prison. A unit that can pin an enemy but not
// kill it - a warden against a plated mite, say - would otherwise re-apply the
// stun every frame forever: the enemy stops dead, the wave never clears and the
// run stalls with one immortal straggler standing in a tower's shadow. So a
// hold runs on a budget and then has to lapse, which guarantees every enemy
// keeps moving and a wave always resolves one way or the other.
const HOLD_BUDGET = 3;
const HOLD_LAPSE = 4;

// No single strike may remove more than this fraction of a body's maximum
// health, which is what makes "never a one-shot" a rule rather than a number
// that holds until someone retunes a dps field.
const STRIKE_CAP_FRAC = 0.85;
// Breaches are structures with no health bar to protect, and solo demolition is
// a load-bearing part of the fog loop, so the cap does not apply and the blow
// is scaled to keep that trip about as long as it was.
const STRUCTURE_MUL = 2.5;
// How far from its LEADER a party member will chase. Wide enough that a party
// clears a path in front of itself, tight enough that it stays a party.
const PARTY_LEASH = 13;
const _strikeOrigin = new THREE.Vector3();

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
const _bearing = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _basis = new THREE.Matrix4();

let nextAllyId = 1;

// Rotate `dir` toward `target` by at most maxAng radians. Both are unit
// vectors on the sphere.
// Walk `dir` along the great circle toward `target`. Returns true on arrival.
// `carry` is the unit's forward vector, rotated by the SAME angle so it travels
// with the frame. Rotating dir on its own leaves fwd behind in world space, so
// it tips a little further off the tangent plane with every step: twenty
// seconds of walking in a straight line pitched the first person camera 18
// degrees and slid the horizon off the screen, and every unit's rendered facing
// leaned with it. Applying the same rotation is exact parallel transport on a
// sphere, so both the heading and the right angle survive the move.
function advanceToward(dir, target, arcDist, carry) {
  const ang = Math.acos(clamp(dir.dot(target), -1, 1));
  if (ang < 1e-6) return true;
  _axis.crossVectors(dir, target);
  if (_axis.lengthSq() < 1e-12) return true;
  _axis.normalize();
  const step = Math.min(ang, arcDist);
  dir.applyAxisAngle(_axis, step).normalize();
  if (carry) reflatten(carry.applyAxisAngle(_axis, step), dir);
  return step >= ang;
}

// Force `v` back into the tangent plane at `dir`. Parallel transport keeps the
// right angle in exact arithmetic; this removes the float drift that would
// otherwise accumulate over a fifteen wave run.
function reflatten(v, dir) {
  v.addScaledVector(dir, -v.dot(dir));
  if (v.lengthSq() < 1e-8) {
    _tmp.set(0, 1, 0);
    if (Math.abs(dir.y) > 0.9) _tmp.set(1, 0, 0);
    v.crossVectors(dir, _tmp);
  }
  return v.normalize();
}

// Turn `fwd` to face `targetPos` while staying tangent. steerToward used to be
// handed the target's POSITION as if it were a direction, which pulled fwd
// toward the planet centre instead of along the ground: the closer a unit got
// to what it was chasing, the further its facing tipped out of the tangent
// plane. The bearing has to be built by projecting the target onto the tangent
// plane first.
function faceToward(fwd, dir, targetPos, maxAng) {
  _bearing.copy(targetPos);
  _bearing.addScaledVector(dir, -_bearing.dot(dir));
  if (_bearing.lengthSq() < 1e-10) return;
  _bearing.normalize();
  const ang = Math.acos(clamp(fwd.dot(_bearing), -1, 1));
  if (ang < 1e-5) return;
  _axis.crossVectors(fwd, _bearing);
  if (_axis.lengthSq() < 1e-12) return;
  _axis.normalize();
  fwd.applyAxisAngle(_axis, Math.min(ang, maxAng));
  reflatten(fwd, dir);
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
    this.swingDur = 0.55;
    this.flashT = 0;
    this.wanderT = 0;
    this.hurtT = 0;
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
    a.following = null;
    // Anything that was following this body is now following a pool object that
    // is about to be handed to a different unit.
    this._severFollowers(a);
    const i = this.active.indexOf(a);
    if (i >= 0) this.active.splice(i, 1);
    this.pool.push(a);
  }

  damage(a, amount) {
    if (!a.active || a.dead) return 0;
    a.hp -= amount;
    a.flashT = 0.1;
    a.hurtT = REGEN_DELAY;
    if (this.onHurt) this.onHurt(a, amount);
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
      // No ally reach is longer than 1.5 and a wisp rides at altitude 2.6, so a
      // ground unit that targets one just walks under it forever while the wisp
      // bites back. Flyers are the towers' problem.
      if (e.type.flying && !a.type.commander) continue;
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

  // Spends the shared hold budget on an enemy and reports whether it may still
  // be pinned. Charged once per update no matter how many units are engaged, so
  // a bigger group holds for the same time rather than burning the budget
  // faster.
  _mayHold(e, dt) {
    if (e._holdStamp !== this.time) {
      // A budget half spent in a fight that ended minutes ago is not a budget.
      if (this.time - (e._holdStamp ?? -1) > HOLD_LAPSE) e._holdT = 0;
      e._holdStamp = this.time;
      if (!(e._holdLapseUntil > this.time)) {
        e._holdT = (e._holdT || 0) + dt;
        // An ABSOLUTE deadline, not a countdown. The countdown was only ever
        // decremented from here, so an enemy whose last holder died mid-lapse
        // had nothing left to tick it down and stayed hold-immune for the rest
        // of the run - the same shape as the permanent-hold bug this budget
        // was added to fix.
        if (e._holdT > HOLD_BUDGET) { e._holdT = 0; e._holdLapseUntil = this.time + HOLD_LAPSE; }
      }
    }
    return !(e._holdLapseUntil > this.time);
  }

  // True when a target sits outside the leash measured from the unit's post -
  // its patrol point when one is set, otherwise where it was summoned.
  _beyondPost(a, target) {
    // Following a leader moves the post to the leader and widens it, so a party
    // fights what is near the party and still arrives together.
    if (a.following && a.following.active && !a.following.dead) {
      const lead = Math.acos(Math.max(-1, Math.min(1, target.dir.dot(a.following.dir))));
      return lead > (PARTY_LEASH + a.type.reach) / R;
    }
    const post = a.patrol || a.anchor;
    const ang = Math.acos(Math.max(-1, Math.min(1, target.dir.dot(post))));
    // A margin of one reach so a unit already trading blows at the very edge
    // does not drop its target and immediately re-acquire it.
    return ang > (a.leash + a.type.reach) / R;
  }

  update(dt) {
    this.time += dt;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      if (!a.active || a.dead) continue;
      if (a.flashT > 0) a.flashT -= dt;
      if (a.swingT > 0) a.swingT -= dt;

      const type = a.type;
      if (a.hurtT > 0) a.hurtT -= dt;
      else if (a.hp < a.hpMax && type.regen) {
        a.hp = Math.min(a.hpMax, a.hp + a.hpMax * type.regen * dt);
      }

      // A possessed unit is driven entirely by the player, but it still bleeds
      // and still heals. The early return used to sit ABOVE both, which made
      // possession total invulnerability: the one moment the player is exposed
      // was the one moment nothing could touch them.
      if (a.possessed) { this._takeContactDamage(a, dt); this._ground(a); continue; }

      if (a.target && (!a.target.active || a.target.dead)) a.target = null;
      if (!a.target) a.target = this._findEnemy(a, type.aggro);
      // A chase is leashed to the post. Without this a unit walks after
      // whatever it can see, arbitrarily far, which drags a garrison off the
      // ground it was summoned to hold and can pull a commander into the fog
      // on its own. A follower's post is its LEADER: exempting followers
      // entirely, as this once did, left a rallied warden with no tether at all,
      // so the first enemy it saw took it across the planet and the party
      // dissolved the moment it met anything.
      if (a.target && this._beyondPost(a, a.target)) a.target = null;
      // Hold-ground units accept only what is already on top of them, so they
      // defend without ever walking into a swarm.
      // Measured against the LONGER of the two reaches. An enemy that outreaches
      // the unit could otherwise stand off, swing freely and never be answered,
      // which against a commander is an unanswerable kill and the end of a run.
      if (a.target && type.holdsGround
          && this.enemyPos(a.target, _tmp2).distanceTo(this.worldPos(a, _tmp))
             > Math.max(type.reach, a.target.type.reach || 0) + 0.1) {
        a.target = null;
      }

      if (a.target) {
        const d = this.enemyPos(a.target, _tmp2).distanceTo(this.worldPos(a, _tmp));
        if (d <= type.reach) {
          a.state = 'attack';
          // Holding the enemy in place IS the aggro: a unit that merely traded
          // damage would be walked straight past on the way to the heart. The
          // hold is short and re-applied while engaged, so killing the unit
          // frees the enemy immediately - but it runs on a budget, so it can
          // never become permanent. See HOLD_BUDGET.
          // An enemy standing inside its OWN strike range has already stopped to
          // fight; holding it as well spends the budget for no extra effect and
          // stunlocks it out of ever swinging back.
          const enemyReach = a.target.type.reach || 0;
          if (d > enemyReach && this._mayHold(a.target, dt)) this.enemies.applyStun(a.target, 0.22);
          if (a.swingT <= 0) {
            a.swingT = 0.55;
            a.swingDur = 0.55;
            this.enemies.damage(a.target, type.dps * 0.55, { armorPierce: 2 });
          }
        } else {
          a.state = 'chase';
          advanceToward(a.dir, a.target.dir, (type.speed * dt) / R, a.fwd);
          faceToward(a.fwd, a.dir, a.target.dir, dt * 6);
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
          // does not jitter on top of its leader. The catch-up speed is derived
          // from the LEADER's real speed rather than a fixed multiplier, because
          // a possessed commander is driven at 1.25x and a flat 1.08 left every
          // member losing ground for ever: the party became a string of units
          // that never arrived and never fought.
          if (d > 2.6) {
            const leadSpeed = lead.type.speed * (lead.possessed ? 1.25 : 1);
            const catchup = Math.min(type.speed * 2, Math.max(type.speed * 1.15, leadSpeed * 1.15));
            advanceToward(a.dir, lead.dir, (catchup * dt) / R, a.fwd);
          }
        }
      } else {
        a.state = 'roam';
        a.wanderT -= dt;
        if (a.wanderT <= 0) this._reroll(a);
        if (advanceToward(a.dir, a.wander, (type.speed * 0.55 * dt) / R, a.fwd)) this._reroll(a);
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
    const step = (a.type.speed * 1.25 * dt) / R;
    a.dir.applyAxisAngle(_axis, step).normalize();
    reflatten(a.fwd.applyAxisAngle(_axis, step), a.dir);
    this._ground(a);
  }

  // Turn a possessed unit. fwd is re-flattened against the surface every time
  // so it cannot drift off the tangent plane and corrupt the render basis.
  turnUnit(a, yawDelta) {
    if (!a.active || a.dead) return;
    reflatten(a.fwd.applyAxisAngle(a.dir, -yawDelta), a.dir);
  }

  // A player swing. Damage is a FLAT per-archetype number rather than a
  // multiple of dps, so tuning a unit's sustained output can never silently
  // move the one-shot line, and the whole hit is capped at a fraction of the
  // victim's maximum health so a strike can never delete a healthy enemy
  // outright. The old form was dps*1.4 every 0.45s, which was 3.1x the unit's
  // own AI throughput and killed a wave-1 mite in a single tap.
  playerAttack(a) {
    if (!a.active || a.dead || a.swingT > 0) return 0;
    const s = a.type.strike;
    a.swingT = s.cd;
    a.swingDur = s.cd;
    let hits = 0;
    _strikeOrigin.copy(this.worldPos(a, _tmp));

    // Nearest first, so the target the player is actually looking at takes the
    // full blow and the cleave is the bonus rather than the point.
    let primary = null;
    let primaryD = Infinity;
    for (const e of this.enemies.active) {
      if (!e.active || e.dead) continue;
      const d = this.enemyPos(e, _tmp2).distanceTo(_strikeOrigin);
      if (d <= s.radius && d < primaryD) { primaryD = d; primary = e; }
    }
    for (const e of this.enemies.active) {
      if (!e.active || e.dead) continue;
      if (this.enemyPos(e, _tmp2).distanceTo(_strikeOrigin) > s.radius) continue;
      const amount = e === primary ? s.dmg : s.dmg * s.cleave;
      const landed = this.enemies.damage(e, amount, {
        armorPierce: s.pierce,
        capFrac: STRIKE_CAP_FRAC,
      });
      if (this.onStrikeHit) this.onStrikeHit(e, landed, e === primary);
      hits++;
    }
    // The same swing brings down breaches, and a structure has no health bar to
    // one-shot, so it takes the uncapped blow at a multiplier that keeps a solo
    // demolition roughly as long as it used to be.
    if (this.world) {
      for (const p of this.world.portals) {
        if (p.destroyed) continue;
        if (p.group.position.distanceTo(_strikeOrigin) > s.radius + 2.6) continue;
        const felled = this.world.damagePortal(p, s.dmg * STRUCTURE_MUL);
        if (felled && this.onPortalDestroyed) this.onPortalDestroyed(p);
        hits++;
      }
    }
    return hits;
  }

  // Rally. Loose bodies nearby join, and so does the whole garrison of any
  // barracks within the wider radius - which is the point of the order: a
  // commander should be able to collect troops from their post without having
  // to walk each one out of its door.
  gatherParty(leader, radius = 16, barracksRadius = 40) {
    if (!leader || !leader.active) return 0;
    let n = 0;
    this.worldPos(leader, _tmp);
    const rallied = new Set();
    if (this.towers) {
      for (const t of this.towers.towers) {
        if (t.typeKey !== 'warden') continue;
        if (t.pos.distanceTo(_tmp) <= barracksRadius) rallied.add(t.id);
      }
    }
    for (const a of this.active) {
      if (a === leader || a.dead || !a.active || a.possessed) continue;
      if (a.following === leader) continue;
      const near = this.worldPos(a, _tmp2).distanceTo(_tmp) <= radius;
      if (near || rallied.has(a.homeTower)) { a.following = leader; n++; }
    }
    return n;
  }

  // Sever anything following this unit. Called when a body leaves play, so a
  // party is never left following a corpse or a recycled pool object.
  _severFollowers(leader) {
    for (const a of this.active) if (a.following === leader) a.following = null;
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
        // Normalised against the duration this particular swing was given. The
      // 0.55 here was hardcoded while a player strike set 0.45, so a strike
      // rendered starting a fifth of the way into its own arc and snapped.
      const dur = a.swingDur || 0.55;
      const swing = a.swingT > 0 ? Math.sin((1 - a.swingT / dur) * Math.PI) * 0.28 : 0;

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
