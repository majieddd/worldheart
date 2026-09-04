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

// Commander archetypes. The whole point is that they do not play the same: a
// Bulwark plants and swings through a crowd, a Twinfang darts and cuts, a
// Longsight holds ground and shoots, a Kettle lobs over cover, an Emberline
// burns a line down. Each `strike` carries its own KIND, which is what
// playerAttack dispatches on, and their sustained damage is deliberately kept
// inside one band so the choice is a question of how you want to fight rather
// than which one is strongest.
//
// Bodies differ too - a Bulwark is slow and thick, a Twinfang fast and thin -
// so the archetype changes how the whole trip into the fog feels, not just the
// button.
export const ALLY_TYPES = {
  warden: {
    name: 'Warden', hp: 220, speed: 2.4, radius: 0.42, dps: 7,
    aggro: 9, reach: 1.15, scale: 1, regen: 0.05,
    // 9 per 0.80s is 11.25 dps, against the warden's own AI output of 7. It sits
    // under a wave-1 mite's 26 health by a factor of 2.9, so three swings are
    // always needed, and 1.8 keeps the swing on the ground: a wisp overhead is
    // 2.58 away, which a warden is not meant to answer.
    strike: { kind: 'melee', dmg: 9, cd: 0.80, radius: 1.8, cleave: 0.5,
      pierce: 2, arcDeg: 120, kick: 0.10, trauma: 0.06, fov: 80 },
  },
  // Commanders are permanent, far stronger, and carry the run: if one dies the
  // run ends, which is what makes taking a party into the fog a real gamble.
  commander: {
    name: 'Bulwark', hp: 1400, speed: 2.6, radius: 0.66, dps: 26,
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
    // A heavy cleave: slow, wide, and it shoves what it hits. The wind-up is
    // long enough to read, which is the trade for hitting a whole crowd.
    strike: { kind: 'melee', dmg: 44, cd: 0.85, radius: 3.0, cleave: 0.75,
      pierce: 5, arcDeg: 160, knockback: 1.1, kick: 0.34, trauma: 0.30, fov: 74 },
  },

  duelist: {
    name: 'Twinfang', hp: 1050, speed: 3.6, radius: 0.5, dps: 26,
    aggro: 13, reach: 1.4, scale: 1.35, commander: true, regen: 0.05,
    holdsGround: true,
    // Two quick cuts instead of one heavy one: half the damage per hit at more
    // than twice the rate, a narrow arc, and the best armour pierce in the
    // roster. Thin body, so the speed is the defence.
    strike: { kind: 'melee', dmg: 17, cd: 0.34, radius: 2.4, cleave: 0.4,
      pierce: 6, arcDeg: 70, kick: 0.13, trauma: 0.10, fov: 84 },
  },

  marksman: {
    name: 'Longsight', hp: 900, speed: 3.0, radius: 0.48, dps: 26,
    aggro: 16, reach: 1.4, scale: 1.4, commander: true, regen: 0.04,
    holdsGround: true,
    // Hitscan down the crosshair. It is the only archetype that answers a
    // breach or a flyer from outside its own reach, and the only one that can
    // miss, which is the trade.
    strike: { kind: 'hitscan', dmg: 34, cd: 0.55, range: 34, corridor: 0.8,
      pierce: 3, falloffFrom: 22, falloffMul: 0.55,
      kick: 0.26, trauma: 0.14, fov: 78, cross: 'ranged' },
  },

  bombardier: {
    name: 'Kettle', hp: 1150, speed: 2.9, radius: 0.56, dps: 26,
    aggro: 14, reach: 1.5, scale: 1.45, commander: true, regen: 0.04,
    holdsGround: true,
    // An arcing shell that bursts where it lands. Splash ignores armour, which
    // makes it the answer to a packed lane, and the arc means it can be thrown
    // over a ridge at something the others have to walk to.
    // Launch speed and lift are tuned together so a shell lands around 13 units
    // out, which is where fighting actually happens. The first pass fired at
    // 26 u/s and every shell sailed 35 units downrange, so the archetype could
    // only hit things nobody was standing near.
    strike: { kind: 'lob', dmg: 40, cd: 1.15, speed: 16, lift: 0.42, gravity: 16,
      aoe: 3.4, pierce: 99, fuse: 2.6,
      kick: 0.30, trauma: 0.22, fov: 80, cross: 'ranged' },
  },

  oracle: {
    name: 'Emberline', hp: 1000, speed: 3.0, radius: 0.52, dps: 26,
    aggro: 15, reach: 1.4, scale: 1.4, commander: true, regen: 0.045,
    holdsGround: true,
    // A held beam that ramps the longer it stays on one body, so it rewards
    // tracking rather than clicking. It runs on heat instead of a cooldown:
    // hold it too long and it locks.
    strike: { kind: 'beam', dps: 52, cd: 0.06, range: 17, corridor: 0.6,
      pierce: 4, ramp: 1.9, rampTime: 2.2, heatUp: 1.0, heatDown: 0.75,
      kick: 0, trauma: 0.04, fov: 80, cross: 'ranged' },
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
// Jump. Apex is v^2/2g = 1.269 units, deliberately just under the 1.41 needed
// to break the nearest enemy's contact grind: a hop dodges a telegraphed swing
// without making a body untouchable in a crowd.
const JUMP_GRAVITY = 19.3;
const JUMP_FALL_MUL = 1.15;
// How long an order may take before it is abandoned. Long enough to cross the
// widest frontier at the slowest commander's pace, short enough that a body
// stuck against geometry does not stay stuck for the rest of the run.
const ORDER_MAX = 45;
// How far a hold-ground unit will step from its post to meet something. Wide
// enough that a commander actually fights what walks past, tight enough that it
// cannot be baited away from the ground it guards.
const GUARD_STEP = 9;
const _strikeOrigin = new THREE.Vector3();
const _strikeBearing = new THREE.Vector3();
const _aimV = new THREE.Vector3();

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
    this.heat = 0;
    this.heatLock = 0;
    this.selected = false;
    this.order = null;   // a place this unit was told to walk to
    this.orderUntil = 0;
    this.hidden = false;
    this.hop = 0;        // metres above the ground while airborne
    this.vertVel = 0;
    this.airT = 0;
    this.beamRamp = 0;
    this.beamOn = null;
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
    // A small pool of shells for the bombardier. Preallocated because a burst
    // fires on a 1.15s cooldown and allocating a vector pair per shot would
    // churn for no reason.
    this._shells = Array.from({ length: 12 }, () => ({
      live: false, t: 0, spec: null,
      pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    }));
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

    // A commander is a SOLDIER, not a box with a cone on top. Each part carries
    // its own offsets and its own animation role, so the renderer no longer
    // hardcodes an anatomy by array index and an archetype can be shaped
    // however it likes.
    //
    // `off` is one offset per instance, in body space: x is right, y is up from
    // the feet, z is forward. `anim` says how the part moves - 'bob' rides the
    // idle breath, 'swing' also drives with the weapon arc, 'stride' alternates
    // like a walking leg, and 'ring' is the ground marker that shows selection.
    function soldier(body, trim, gold, legGeo, extra = {}) {
      const parts = [
        // hips and a tapered chest, so the silhouette has a waist
        { geo: new THREE.BoxGeometry(0.34, 0.2, 0.26), mat: trim, per: 1,
          off: [[0, 0.42, 0]], anim: 'bob' },
        { geo: new THREE.BoxGeometry(0.44, 0.42, 0.3), mat: body, per: 1,
          off: [[0, 0.74, 0]], anim: 'bob' },
        // pauldrons: the single strongest read of "officer" at this scale
        { geo: new THREE.BoxGeometry(0.16, 0.14, 0.28), mat: gold, per: 2,
          off: [[-0.29, 0.9, 0], [0.29, 0.9, 0]], anim: 'bob' },
        // arms, the right one carrying the weapon and driving the swing
        { geo: new THREE.BoxGeometry(0.11, 0.36, 0.12), mat: body, per: 2,
          off: [[-0.28, 0.66, 0.02], [0.28, 0.66, 0.02]], anim: 'arms' },
        // a helmet with a brow band rather than a bare cone
        { geo: new THREE.BoxGeometry(0.24, 0.2, 0.24), mat: body, per: 1,
          off: [[0, 1.06, 0]], anim: 'bob' },
        { geo: new THREE.BoxGeometry(0.26, 0.05, 0.26), mat: gold, per: 1,
          off: [[0, 1.0, 0.01]], anim: 'bob' },
        { geo: legGeo, mat: trim, per: 2,
          off: [[-0.11, 0.32, 0], [0.11, 0.32, 0]], anim: 'stride' },
        { geo: new THREE.TorusGeometry(0.34, 0.03, 6, 16), mat: gold, per: 1,
          off: [[0, 0.05, 0]], anim: 'ring' },
      ];
      if (extra.crest) {
        parts.push({ geo: extra.crest, mat: gold, per: 1,
          off: [[0, 1.28, 0]], anim: 'bob' });
      }
      if (extra.cape) {
        parts.push({ geo: extra.cape, mat: trim, per: 1,
          off: [[0, 0.76, -0.19]], anim: 'cape' });
      }
      return parts;
    }

    // Part order matters for the simple bodies: index 0 torso, 1 head, 2 legs,
    // 3 an optional ring.
    const defs = {
      warden: [
        { geo: new THREE.BoxGeometry(0.38, 0.46, 0.28), mat: bodyMat, per: 1 },
        { geo: new THREE.OctahedronGeometry(0.15), mat: trimMat, per: 1 },
        { geo: legGeo, mat: bodyMat, per: 2 },
      ],
      commander: soldier(bodyMat, trimMat, goldMat, legGeo, {
        crest: new THREE.ConeGeometry(0.055, 0.34, 4),
        cape: new THREE.BoxGeometry(0.42, 0.52, 0.045),
      }),
      // One silhouette per archetype. Without these four the renderer had no
      // mesh set for them at all - it iterates the keys of `species`, so a
      // Twinfang, a Longsight, a Kettle and an Emberline were simulated,
      // damaged, killed and possessed while never being drawn once. Nothing
      // reported it because an absent key is not an error, it is just a body
      // that never appears.
      duelist: soldier(bodyMat, trimMat, goldMat, legGeo, { crest: new THREE.ConeGeometry(0.04, 0.24, 4) }),
      marksman: soldier(bodyMat, trimMat, goldMat, legGeo, { crest: new THREE.CylinderGeometry(0.03, 0.05, 0.2, 5) }),
      bombardier: soldier(bodyMat, trimMat, goldMat, legGeo, { crest: new THREE.BoxGeometry(0.1, 0.12, 0.1), cape: new THREE.BoxGeometry(0.4, 0.4, 0.045) }),
      oracle: soldier(bodyMat, trimMat, goldMat, legGeo, { crest: new THREE.OctahedronGeometry(0.09), cape: new THREE.BoxGeometry(0.36, 0.5, 0.04) }),
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
        // Carry the anatomy through. Dropping `off` and `anim` here meant the
        // renderer fell back to the old torso/head/legs indexing and the new
        // soldier bodies were placed as though they were still three boxes.
        return { mesh, per: p.per, off: p.off, anim: p.anim };
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
    // The hop is added HERE rather than in each caller, which is what makes a
    // jump mean something to every system at once: enemy melee acquisition, the
    // landing re-check that lets you dodge a telegraphed swing, the contact
    // grind, the instanced renderer and the strike origin all read this.
    return out.copy(a.dir).multiplyScalar(
      R + Math.max(a.height, 0.03) + (a.hop || 0) + a.type.radius * 0.9);
  }

  enemyPos(e, out) {
    const h = Math.max(e.height, 0.03);
    return out.copy(e.dir).multiplyScalar(R + h + (e.alt ?? e.type.altitude) + e.type.radius * 0.9);
  }

  _release(a) {
    a.active = false;
    a.possessed = false;
    a.following = null;
    a.selected = false;
    a.order = null;
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
    this._updateShells(dt);
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      if (!a.active || a.dead) continue;
      if (a.flashT > 0) a.flashT -= dt;
      if (a.swingT > 0) a.swingT -= dt;
      if (a.airT > 0) this._fall(a, dt);
      if (a.heatLock > 0) { a.heatLock -= dt; if (a.heatLock <= 0) a.heat = 0; }
      else if (a.heat > 0 && a.type.strike?.heatDown) {
        a.heat = Math.max(0, a.heat - a.type.strike.heatDown * dt);
      }

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
      // A hold-ground unit does not CHASE, but it does step out to meet what
      // comes near its post. Refusing anything past arm's length meant a
      // commander stood still while enemies walked by a couple of metres away
      // and only ever swung at what blundered into it, which is why it read as
      // barely fighting. The engagement is bounded from the POST, not from the
      // body, so it can close on something without ever being walked off the
      // ground it is guarding.
      if (a.target && (type.holdsGround || a.order)) {
        const post = a.patrol || a.anchor;
        const fromPost = Math.acos(Math.max(-1, Math.min(1, a.target.dir.dot(post)))) * R;
        if (fromPost > GUARD_STEP) a.target = null;
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
          // A guard closes the last few metres itself, but never steps past its
          // guard radius - so it fights what comes to its ground and nothing
          // can bait it away from it.
          let mayStep = true;
          if (type.holdsGround) {
            const post = a.patrol || a.anchor;
            mayStep = Math.acos(Math.max(-1, Math.min(1, a.dir.dot(post)))) * R < GUARD_STEP;
          }
          if (mayStep) advanceToward(a.dir, a.target.dir, (type.speed * dt) / R, a.fwd);
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
      } else if (a.order) {
        // Ordered to a place. Sits BELOW targeting on purpose: the owner asked
        // that an ordered commander still fight, so anything in reach is dealt
        // with first and the walk resumes when the fight is over.
        a.state = 'order';
        if (this.time > a.orderUntil) {
          // An absolute deadline rather than a spend-down budget, because a
          // budget that only ticks while walking can be left half-spent for
          // ever - the same shape as the hold bug. Cancelling is also the right
          // failure: a body that walks away from a fight it is losing, while
          // being hit, is a gamble the player did not choose to take.
          this.clearOrder(a);
          if (this.onOrderFailed) this.onOrderFailed(a);
        } else if (advanceToward(a.dir, a.order, (type.speed * dt) / R, a.fwd)) {
          this._finishOrder(a);
        } else {
          faceToward(a.fwd, a.dir, a.order, dt * 6);
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

  // Ballistic hop along the surface normal. The angular walk underneath it is
  // untouched, so running off a slope mid-jump behaves the way it should: the
  // ground moves under you and you land on whatever is there.
  _fall(a, dt) {
    const g = JUMP_GRAVITY * (a.vertVel < 0 ? JUMP_FALL_MUL : 1);
    a.vertVel -= g * dt;
    a.hop += a.vertVel * dt;
    if (a.hop <= 0) {
      a.hop = 0;
      a.vertVel = 0;
      a.airT = 0;
      if (this.onLand) this.onLand(a);
    } else {
      a.airT += dt;
    }
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
  playerAttack(a, dt = 0) {
    if (!a.active || a.dead) return 0;
    const s = a.type.strike;
    if (s.kind === 'beam') return this._beamStrike(a, s, dt);
    if (a.swingT > 0) return 0;
    a.swingT = s.cd;
    a.swingDur = s.cd;
    if (s.kind === 'hitscan') return this._hitscanStrike(a, s);
    if (s.kind === 'lob') return this._lobStrike(a, s);
    let hits = 0;
    _strikeOrigin.copy(this.worldPos(a, _tmp));

    // Nearest first, so the target the player is actually looking at takes the
    // full blow and the cleave is the bonus rather than the point.
    let primary = null;
    let primaryD = Infinity;
    for (const e of this.enemies.active) {
      if (!e.active || e.dead) continue;
      const d = this.enemyPos(e, _tmp2).distanceTo(_strikeOrigin);
      if (d <= s.radius && d < primaryD && this._inArc(a, _tmp2, s.arcDeg)) { primaryD = d; primary = e; }
    }
    for (const e of this.enemies.active) {
      if (!e.active || e.dead) continue;
      if (this.enemyPos(e, _tmp2).distanceTo(_strikeOrigin) > s.radius) continue;
      if (!this._inArc(a, _tmp2, s.arcDeg)) continue;
      const amount = e === primary ? s.dmg : s.dmg * s.cleave;
      const landed = this.enemies.damage(e, amount, {
        armorPierce: s.pierce,
        capFrac: STRIKE_CAP_FRAC,
      });
      if (this.onStrikeHit) this.onStrikeHit(e, landed, e === primary);
      if (s.knockback && e.active && !e.dead) {
        // Shove the body back along the surface. A heavy swing that does not
        // move anything does not read as heavy.
        _axis.crossVectors(a.dir, e.dir);
        if (_axis.lengthSq() > 1e-12) {
          _axis.normalize();
          e.dir.applyAxisAngle(_axis, s.knockback / R).normalize();
        }
      }
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

  // Is `worldPoint` inside the unit's facing arc? Measured in the tangent plane,
  // with the degenerate directly-on-top case counted as in front, because the
  // tangent projection of something standing on your head is near zero length
  // and would otherwise silently drop out of every swing.
  // Where this body is AIMING. A possessed unit is looking down a pitched view
  // that its tangent facing knows nothing about, and a marksman that fires
  // along its facing can never hit a flyer overhead - a.aim is written by
  // js/possess.js each frame. Anything unpossessed just aims where it faces.
  _aimOf(a, out) {
    return a.aim ? out.copy(a.aim) : out.copy(a.fwd);
  }

  _inArc(a, worldPoint, arcDeg) {
    if (!arcDeg || arcDeg >= 359) return true;
    _strikeBearing.copy(worldPoint).sub(_strikeOrigin);
    _strikeBearing.addScaledVector(a.dir, -_strikeBearing.dot(a.dir));
    if (_strikeBearing.lengthSq() < 1e-8) return true;
    _strikeBearing.normalize();
    return _strikeBearing.dot(a.fwd) >= Math.cos((arcDeg * 0.5) * Math.PI / 180);
  }

  // A shot straight down the crosshair. Everything inside a thin corridor along
  // the aim is a candidate and the nearest one is hit, so a marksman can miss -
  // which is the trade for being the only archetype that reaches past its own
  // arm's length.
  _hitscanStrike(a, s) {
    _strikeOrigin.copy(this.worldPos(a, _tmp));
    this._aimOf(a, _aimV);
    let best = null;
    let bestAlong = Infinity;
    for (const e of this.enemies.active) {
      if (!e.active || e.dead) continue;
      this.enemyPos(e, _tmp2).sub(_strikeOrigin);
      const along = _tmp2.dot(_aimV);
      if (along <= 0 || along > s.range) continue;
      const off = Math.sqrt(Math.max(0, _tmp2.lengthSq() - along * along));
      if (off > s.corridor + (e.type.radius || 0.3)) continue;
      if (along < bestAlong) { bestAlong = along; best = e; }
    }
    let hits = 0;
    if (best) {
      const fall = bestAlong > s.falloffFrom
        ? 1 - (1 - s.falloffMul) * Math.min(1, (bestAlong - s.falloffFrom) / (s.range - s.falloffFrom))
        : 1;
      const landed = this.enemies.damage(best, s.dmg * fall, {
        armorPierce: s.pierce, capFrac: STRIKE_CAP_FRAC,
      });
      if (this.onStrikeHit) this.onStrikeHit(best, landed, true);
      hits++;
    }
    if (this.world) {
      for (const p of this.world.portals) {
        if (p.destroyed) continue;
        _tmp2.copy(p.group.position).sub(_strikeOrigin);
        const along = _tmp2.dot(_aimV);
        if (along <= 0 || along > s.range) continue;
        if (Math.sqrt(Math.max(0, _tmp2.lengthSq() - along * along)) > 2.6) continue;
        const felled = this.world.damagePortal(p, s.dmg * STRUCTURE_MUL);
        if (felled && this.onPortalDestroyed) this.onPortalDestroyed(p);
        hits++;
        break;
      }
    }
    if (this.onShotFired) this.onShotFired(a, _strikeOrigin, best, bestAlong);
    return hits;
  }

  // Lob a shell along the aim with lift and let gravity bring it down. The arc
  // is the whole point: it goes over the ridge the others have to walk around.
  _lobStrike(a, s) {
    const sh = this._shells.find((x) => !x.live) || this._shells[0];
    sh.live = true;
    sh.t = 0;
    sh.spec = s;
    this.worldPos(a, sh.pos);
    sh.pos.addScaledVector(a.dir, 0.6);
    this._aimOf(a, _aimV);
    sh.vel.copy(_aimV).multiplyScalar(s.speed).addScaledVector(a.dir, s.speed * s.lift);
    return 1;
  }

  _updateShells(dt) {
    for (const sh of this._shells) {
      if (!sh.live) continue;
      sh.t += dt;
      // Gravity points at the planet centre, so the arc bends the way the
      // ground curves rather than toward some fixed idea of down.
      _tmp.copy(sh.pos).normalize();
      sh.vel.addScaledVector(_tmp, -sh.spec.gravity * dt);
      sh.pos.addScaledVector(sh.vel, dt);
      _tmp2.copy(sh.pos).normalize();
      const ground = R + Math.max(terrainHeight(_tmp2.x, _tmp2.y, _tmp2.z), 0);
      if (sh.pos.length() <= ground + 0.2 || sh.t > sh.spec.fuse) this._burst(sh);
    }
  }

  _burst(sh) {
    sh.live = false;
    const s = sh.spec;
    let hits = 0;
    for (const e of this.enemies.active) {
      if (!e.active || e.dead) continue;
      const d = this.enemyPos(e, _tmp2).distanceTo(sh.pos);
      if (d > s.aoe) continue;
      const landed = this.enemies.damage(e, s.dmg * (1 - 0.5 * Math.min(1, d / s.aoe)), {
        armorPierce: s.pierce, capFrac: STRIKE_CAP_FRAC,
      });
      if (this.onStrikeHit) this.onStrikeHit(e, landed, hits === 0);
      hits++;
    }
    if (this.world) {
      for (const p of this.world.portals) {
        if (p.destroyed) continue;
        if (p.group.position.distanceTo(sh.pos) > s.aoe + 2.2) continue;
        const felled = this.world.damagePortal(p, s.dmg * STRUCTURE_MUL);
        if (felled && this.onPortalDestroyed) this.onPortalDestroyed(p);
      }
    }
    if (this.onShellBurst) this.onShellBurst(sh, hits);
  }

  // A held beam. Damage is per SECOND, and it ramps the longer it stays on the
  // same body, so tracking is the skill rather than clicking. Heat replaces the
  // cooldown: it climbs while firing and locks the weapon if it tops out.
  _beamStrike(a, s, dt) {
    if (a.heatLock > 0) return 0;
    _strikeOrigin.copy(this.worldPos(a, _tmp));
    this._aimOf(a, _aimV);
    let best = null;
    let bestAlong = Infinity;
    for (const e of this.enemies.active) {
      if (!e.active || e.dead) continue;
      this.enemyPos(e, _tmp2).sub(_strikeOrigin);
      const along = _tmp2.dot(_aimV);
      if (along <= 0 || along > s.range) continue;
      const off = Math.sqrt(Math.max(0, _tmp2.lengthSq() - along * along));
      if (off > s.corridor + (e.type.radius || 0.3)) continue;
      if (along < bestAlong) { bestAlong = along; best = e; }
    }
    a.heat = Math.min(1, a.heat + s.heatUp * dt);
    if (a.heat >= 1) { a.heatLock = 1.8; }
    if (!best) { a.beamRamp = 0; a.beamOn = null; return 0; }
    if (a.beamOn !== best) { a.beamRamp = 0; a.beamOn = best; }
    a.beamRamp = Math.min(s.rampTime, a.beamRamp + dt);
    const ramp = 1 + (s.ramp - 1) * (a.beamRamp / s.rampTime);
    const landed = this.enemies.damage(best, s.dps * ramp * dt, {
      armorPierce: s.pierce, capFrac: STRIKE_CAP_FRAC,
    });
    if (this.onBeam) this.onBeam(a, best, landed, _strikeOrigin, bestAlong);
    return 1;
  }

  // Send a unit to a place. The destination becomes its new post on arrival,
  // so an ordered garrison holds the ground it was sent to rather than walking
  // straight back to the barracks door.
  orderMove(a, dir) {
    if (!a || !a.active || a.dead || a.possessed) return false;
    if (!a.order) a.order = new THREE.Vector3();
    a.order.copy(dir).normalize();
    a.orderUntil = this.time + ORDER_MAX;
    a.following = null;
    a.target = null;
    return true;
  }

  clearOrder(a) {
    a.order = null;
    a.orderUntil = 0;
  }

  _finishOrder(a) {
    // Arriving transfers the post, which is what stops the leash dragging the
    // unit home the moment it gets there.
    this.setPatrol(a, a.order);
    this.clearOrder(a);
    if (this.onOrderDone) this.onOrderDone(a);
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
        // The body you are looking out of is not drawn. From the inside the
        // eye sits inside its own head; from behind, on a third-person boom,
        // it is exactly what you want to see.
        if (a.hidden) continue;
        this.worldPos(a, _tmp);
        _up.copy(a.dir);
        _fwd.copy(a.fwd).addScaledVector(_up, -a.fwd.dot(_up));
        if (_fwd.lengthSq() < 1e-8) _fwd.set(1, 0, 0);
        _fwd.normalize();
        _right.crossVectors(_up, _fwd).normalize();
        _basis.makeBasis(_right, _up, _fwd);
        _q.setFromRotationMatrix(_basis);

        const sc = a.type.scale;
        // A selected unit brightens. The marquee has been writing `selected`
        // since it shipped and nothing read it, so box-selecting a commander
        // gave no on-unit feedback at all - the player could not see who was
        // about to receive a right-click order.
        const selGlow = a.selected ? 1 : 0;
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
            if (part.off) {
              // Data-driven anatomy. The offsets live with the part so a body
              // can be shaped like a soldier instead of like whatever index 0,
              // 1 and 2 happened to mean.
              const o = part.off[Math.min(k, part.off.length - 1)];
              ox = o[0] * sc; oy = o[1] * sc; oz = o[2] * sc;
              const anim = part.anim;
              if (anim === 'bob') { oy += bob; }
              else if (anim === 'arms') {
                // The right arm carries the weapon and drives the whole swing;
                // the left counter-swings a little so the body reads as one
                // thing moving rather than a limb flapping on a statue.
                oy += bob;
                const lead = k === 1 ? 1 : -0.35;
                oz += swing * 1.5 * lead;
                oy -= Math.abs(swing) * 0.35 * (k === 1 ? 1 : 0);
              } else if (anim === 'stride') {
                oz += Math.sin(this.time * 7 + a.phase + k * Math.PI) * 0.07;
              } else if (anim === 'cape') {
                // Trails with the stride and lifts when the body swings.
                oz -= 0.06 + Math.abs(Math.sin(this.time * 3.5 + a.phase)) * 0.05 + swing * 0.4;
                oy += bob * 0.6;
              }
            } else if (p === 0) { oy = 0.28 * sc + bob; oz = swing * 0.3; }
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
            // Part 3 is the ground ring, which is exactly the right place to
            // show selection: it swells and lifts so a boxed unit is obvious
            // from the board without adding a mesh or a draw call.
            const isRing = part.anim === 'ring' || (!part.off && p === 3);
            const ringSel = (isRing && selGlow) ? 1.45 + Math.sin(this.time * 5) * 0.12 : 1;
            if (isRing && selGlow) _tmp2.addScaledVector(_up, 0.04);
            _s.set(sc * ringSel, sc * ringSel, sc * ringSel);
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
