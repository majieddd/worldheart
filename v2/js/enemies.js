import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import { clamp, SIM_RANDOM } from './noise.js';
import { R, terrainHeight } from './world.js';
import { Skeleton, slab, box, wedge, cone, merge, shift, spin, easeOut, hump, keyed } from './rig.js';

// Evolution tier, set by the 99 Planets shell and 0 in every other mode.
export const EVO = { tier: 0 };

// How many hits a tier-3 shield soaks before it breaks.
const SHIELD_HITS = 3;
const _mePos = new THREE.Vector3();
const _alPos = new THREE.Vector3();
const _plPos = new THREE.Vector3();

// Enemy melee. An enemy never holds a target and never walks toward an AI
// ally: it swings at whatever is already standing inside its own reach, and
// the only thing that stops it is its own wind-up. That is what keeps waves
// provably alive - the worst case is a mite halted 0.25s out of every 1.00s,
// so it still makes 75% of nominal progress toward the heart with no budget,
// no breakoff and no shared clock to get stuck in. Chasing every ally would
// turn each one into a flow-field attractor and make the commander the tank
// for every wave again, which is the exact failure the frontier-capped post
// radius was added to fix.
//
// The one exception is the body the PLAYER is inside. The owner asked for mobs
// that come after you when they spot you close by, and that still go for the
// base when the base is right there, so a chase is allowed under bounds that
// keep the guarantee above: only the possessed body is chased, only when it is
// within SPOT of the enemy while the heart is further than VICINITY from it,
// and only on a leash - the chase ends past CHASE_LEASH, after CHASE_MAX
// seconds, or the moment the heart comes inside VICINITY, and the enemy then
// ignores the player for CHASE_REST seconds and walks the field. Bosses never
// chase. A wave therefore still resolves: the worst case is a body diverted
// for nine seconds out of every fifteen, and a body that is never diverted
// once it is near the heart.
const MELEE_SCAN = 0.2;        // seconds between reach checks, staggered per body
const SPOT = 7;
const VICINITY = 10;
const CHASE_LEASH = 11;
const CHASE_MAX = 9;
const CHASE_REST = 6;
// How long a killed body stays on the board collapsing before it is released
// and the shard burst fires. Everything that targets enemies skips e.dead, so
// a dying body is inert; the only cost is that a wave clears this much later.
const DYING_T = 0.42;
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
    // Last frame's heading, kept by the renderer to read the turn rate off.
    // Allocated once per pooled body, never per frame.
    this.prevFwd = new THREE.Vector3();
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
    // Player chase (see the note above SPOT): chaseT is how long the current
    // chase has run, chaseCd how long the player is ignored after one ends.
    this.chaseT = 0;
    this.chaseCd = 0;
    // Seconds left in the death collapse; 0 for a body that is alive. A
    // recycled body that inherited a live countdown would be released a few
    // frames after it spawned.
    this.dying = 0;
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
    // How far the body actually marched this frame, in world units per
    // second. Written by the sim so the renderer can plant feet against real
    // progress instead of a clock: a slowed or held body strides slower
    // because it IS slower, not because someone remembered to scale a sine.
    this.moveV = 0;
    // Renderer-owned integrators. Nothing in the sim reads them, but they
    // live on a pooled body, so they reset here like everything else
    // (invariant 4): a recycled mite would otherwise inherit its predecessor's
    // stride phase and smoothed motion, and start life mid-step.
    this.gaitT = this.phase * 0.159;
    this.moveS = 0;
    this.stunS = 0;
    this.turnS = 0;
    // starting forward: any tangent
    _tmp.set(0, 1, 0);
    if (Math.abs(this.dir.y) > 0.9) _tmp.set(1, 0, 0);
    this.fwd.crossVectors(this.dir, _tmp).normalize();
    this.prevFwd.copy(this.fwd);
    this.height = terrainHeight(this.dir.x, this.dir.y, this.dir.z);
  }
}

// ---------------------------------------------------------------------------
// Bodies.
//
// Every species is a Skeleton from js/rig.js plus a list of parts, and every
// part is one InstancedMesh shared by every enemy of that species: a field of
// two hundred mites is still eight draw calls. A part is attached to a joint
// with a fixed offset matrix, so once the pose has written the joint rotations
// and the skeleton has composed its world matrices, placing an instance is one
// matrix multiply. The pose runs ONCE per enemy per frame. The previous
// renderer placed each part by index in a flat switch, which recomputed shared
// state per part and could not bend anything, because nothing had a parent.
//
// Geometry rules, from DESIGN.md: hand-carved facets, so every mesh here comes
// from the non-indexed helpers in rig.js (slab, wedge, cone, hull) and low
// segment counts. Nothing is smooth on purpose.
//
// Body space: +X is the enemy's right, +Y up, -Z forward. The root of every
// skeleton sits on the ground under the body; the frame matrix carries the
// terrain height, the heading and the body scale, so joint rests are in
// unscaled local units. Limb geometry hangs along -Y from its joint and is
// rotated into place by the pose rather than by a rest rotation, which keeps
// one mesh serving both sides of a symmetric body.
//
// Joint Euler order is XYZ, so a vector is rotated by Z first, then Y, then X.
// For a limb hanging along -Y that reads as: rot.z splays it out to the side,
// rot.y then swings it fore and aft, rot.x pitches it. Positive rot.x on a
// torso tips it BACK; positive rot.x on a forward-pointing plate lifts it.

const TAU = Math.PI * 2;
// How long the strike lunge plays after the blow lands, in seconds of atkCd.
const STRIKE_T = 0.25;
// The cooldown set when a blow lands, chosen so that `swing` in ENEMY_TYPES
// is the blow-to-blow period the roster authors: the next wind-up starts
// `swing - wind` after the blow and the next blow lands exactly `swing`
// after the last. The cooldown used to be the whole swing, with the wind-up
// and a scan throttle added on top, so a mite's "7 per 1.00 s" was measured
// landing every 1.47 s, 4.8 dps. Never shorter than the lunge window, or the
// next wind-up would start with the last lunge still playing.
function blowCd(type) {
  return Math.max(STRIKE_T + 0.05, type.swing - type.wind);
}
// The lunge curve: an instant snap to full extension, then a slower recovery.
const LUNGE = [[0, 0], [0.32, 1], [1, 0]];
// World units of forward progress per gait cycle. A stride matched to the
// body's real speed is what stops feet skating: the foot moves back under the
// body at the rate the body moves forward. Flyers have no stride.
const STRIDE = { mite: 0.4, husk: 1.0, aegis: 1.0, wisp: 0, colossus: 1.25 };
// A shared identity offset for parts that sit exactly on their joint.
const ID = new THREE.Matrix4();

// Per-enemy animation context, filled once per enemy and read by its pose.
// wind runs 0 to 1 across the wind-up, strike runs 0 to 1 across the lunge
// window and is 1 when no strike is playing, lunge is the shaped snap of
// that window, flinch is 1 on the frame a hit lands and decays with flashT.
// dying runs 0 to 1 across the death collapse and is 0 for a living body;
// scale is the frame's body scale, for a pose that has to move the root by a
// WORLD distance (the wisp falls its own altitude).
const _c = {
  t: 0, phase: 0, gait: 0, move: 0, wind: 0, strike: 1, lunge: 0,
  flinch: 0, stun: 0, shield: 0, turn: 0, dying: 0, scale: 1,
};
const _colBody = new THREE.Color();
const _colPlate = new THREE.Color();
const _colGlow = new THREE.Color();
const _plateTint = new THREE.Color();
const _shieldCol = new THREE.Color();
const _tintCol = new THREE.Color();

// An attachment offset, built once at boot. Position, XYZ rotation, scale.
function att(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _eul.set(rx, ry, rz);
  _lq.setFromEuler(_eul);
  _lp.set(x, y, z);
  _ls.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_lp, _lq, _ls);
}

// A faceted lozenge: two frusta meeting at their widest ring, centred on the
// origin. The ring sits at y = 0 and the shape spans -h*mid to h*(1-mid).
// This is the carved-gem read every void body is built on.
function hull(w, d, h, topK = 0.55, botK = 0.5, mid = 0.5) {
  const y0 = -h * mid;
  const y1 = h * (1 - mid);
  return merge([slab(w, d, w * botK, d * botK, y0, 0), slab(w * topK, d * topK, w, d, 0, y1)]);
}

function octa(r) {
  return new THREE.OctahedronGeometry(r);
}

// Slide z with height, so a wing panel built along Y sweeps back.
function shear(g, zPerY) {
  const m = new THREE.Matrix4().set(
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, zPerY, 1, 0,
    0, 0, 0, 1,
  );
  g.applyMatrix4(m);
  g.computeVertexNormals();
  return g;
}

// MITE. An insect: head with mandibles and an eye cluster, thorax, a bobbing
// abdomen, six two-segment legs on a tripod gait, two antennae. Legs are
// indexed with the sides interleaved (even left, odd right, rows front to
// back) so the tripods are {0, 3, 4} and {1, 2, 5}: front-left, mid-right and
// hind-left move together, which is how a real insect keeps three feet down.
function makeMite(m) {
  const sk = new Skeleton();
  sk.add('root', null, 0, 0.23, 0);
  sk.add('head', 'root', 0, 0.03, -0.14);
  sk.add('mandR', 'head', 0.05, -0.03, -0.1);
  sk.add('mandL', 'head', -0.05, -0.03, -0.1);
  sk.add('antR', 'head', 0.04, 0.06, -0.07);
  sk.add('antL', 'head', -0.04, 0.06, -0.07);
  sk.add('eyes', 'head', 0, 0, 0);
  sk.add('abd', 'root', 0, 0, 0.1);
  const cox = [];
  const tib = [];
  for (let k = 0; k < 6; k++) {
    const side = k % 2 ? 1 : -1;
    const row = k >> 1;
    cox.push(sk.add('cx' + k, 'root', side * 0.09, -0.04, (row - 1) * 0.09));
    tib.push(sk.add('tb' + k, 'cx' + k, 0, -0.16, 0));
  }

  const thorax = merge([
    hull(0.22, 0.28, 0.16, 0.55, 0.5),
    shift(spin(wedge(0.2, 0.08, 0, 0.05), 0, Math.PI / 2, 0), 0, 0.07, 0),
  ]);
  const head = merge([
    shift(hull(0.16, 0.18, 0.13, 0.5, 0.6), 0, 0, -0.05),
    shift(wedge(0.15, 0.06, 0, 0.04), 0, 0.06, -0.07),
  ]);
  const eyes = merge([
    shift(octa(0.03), 0.045, 0.02, -0.12), shift(octa(0.03), -0.045, 0.02, -0.12),
    shift(octa(0.024), 0, 0.05, -0.12),
    shift(octa(0.018), 0.022, -0.02, -0.13), shift(octa(0.018), -0.022, -0.02, -0.13),
  ]);
  // A mandible is a cone laid forward from its hinge; the pose closes the pair.
  const mand = shift(spin(cone(0.004, 0.028, 0.15, 4), -Math.PI / 2, 0, 0), 0, 0, -0.075);
  // An antenna leans forward and up from the brow.
  const ant = shift(spin(cone(0.003, 0.012, 0.22, 4), -0.95, 0, 0), 0, 0.064, -0.089);
  const abd = merge([
    spin(slab(0.07, 0.05, 0.24, 0.17, 0, 0.34), Math.PI / 2, 0, 0),
    shift(wedge(0.17, 0.05, 0, 0.035), 0, 0.06, 0.08),
    shift(wedge(0.12, 0.04, 0, 0.03), 0, 0.045, 0.18),
  ]);
  const coxa = shift(cone(0.032, 0.02, 0.16, 5), 0, -0.08, 0);
  const tibia = shift(cone(0.016, 0.004, 0.22, 4), 0, -0.11, 0);

  const parts = [
    { geo: thorax, mat: m.plate, on: [['root', ID]] },
    { geo: head, mat: m.plate, on: [['head', ID]] },
    { geo: abd, mat: m.plate, on: [['abd', ID]] },
    { geo: eyes, mat: m.glow, on: [['eyes', ID]] },
    { geo: mand, mat: m.body, on: [['mandR', ID], ['mandL', ID]] },
    { geo: ant, mat: m.body, on: [['antR', ID], ['antL', ID]] },
    { geo: coxa, mat: m.body, on: cox.map((j) => [j.name, ID]) },
    { geo: tibia, mat: m.body, on: tib.map((j) => [j.name, ID]) },
  ];

  const J = sk.byName;
  function pose(e, c) {
    const g = c.gait * TAU;
    const breath = Math.sin(c.t * 5 + c.phase);
    const root = J.root;
    root.pos.y += Math.abs(Math.sin(g * 2)) * 0.012 * c.move + 0.004 * breath - 0.05 * c.stun;
    root.pos.z += 0.04 * c.wind - 0.16 * c.lunge + 0.05 * c.flinch;
    root.rot.x = 0.45 * easeOut(c.wind) - 0.25 * c.lunge + 0.3 * c.flinch - 0.12 * c.stun;
    root.rot.y = Math.sin(g) * 0.07 * c.move;
    root.rot.z = Math.sin(g * 2 + 1) * 0.04 * c.move + c.turn * 0.04;
    J.head.rot.x = -0.1 + Math.sin(c.t * 7 + c.phase) * 0.05 + 0.25 * c.wind
      - 0.5 * c.lunge + 0.3 * c.flinch - 0.4 * c.stun;
    // Mandibles spread through the wind-up and snap shut as the lunge lands.
    const open = c.wind > 0 ? 0.15 + 0.85 * easeOut(c.wind)
      : c.strike < 1 ? 0.9 * (1 - c.lunge) : 0.12 + 0.06 * breath;
    J.mandR.rot.y = 0.5 - open * 0.85;
    J.mandL.rot.y = -(0.5 - open * 0.85);
    const wave = Math.sin(c.t * 6 + c.phase) * 0.15;
    J.antR.rot.x = wave + 0.55 * c.wind - 0.7 * c.stun;
    J.antL.rot.x = -wave * 0.7 + 0.55 * c.wind - 0.7 * c.stun;
    J.antR.rot.z = 0.35 + 0.1 * breath;
    J.antL.rot.z = -(0.35 - 0.1 * breath);
    // The abdomen tip points +Z, so positive pitch drops it: it lifts like a
    // wasp's through the wind-up and whips down with the bite.
    J.abd.rot.x = -Math.sin(c.t * 9 + c.phase) * 0.08 * (0.4 + 0.6 * c.move)
      - 0.55 * easeOut(c.wind) + 0.3 * c.lunge + 0.3 * c.stun;
    const gs = 1 + 0.5 * c.shield + 0.4 * c.wind;
    J.eyes.scale.set(gs, gs, gs);
    for (let k = 0; k < 6; k++) {
      const side = k % 2 ? 1 : -1;
      const ph = g + ((k === 0 || k === 3 || k === 4) ? 0 : Math.PI);
      // Forward swing is the rising half of the sine, and that is the half
      // that lifts; the falling half is the stance, foot down, moving back.
      const sw = Math.sin(ph) * 0.5 * c.move;
      const lift = Math.max(0, Math.cos(ph)) * 0.45 * c.move;
      const cx = cox[k];
      cx.rot.z = side * (1.6 + lift + 0.3 * c.stun + 0.2 * c.wind);
      cx.rot.y = side * sw;
      tib[k].rot.z = -side * (1.25 + lift * 0.9 + 0.35 * c.stun);
    }
    if (c.dying > 0) {
      // Collapse: the legs give way and splay flat, the body drops onto its
      // belly and rolls, the head and abdomen droop, the mandibles fall open
      // and the antennae go flat. Ease-out, so it drops fast and settles.
      const d = easeOut(c.dying);
      root.pos.y -= 0.17 * d;
      root.rot.z += 0.55 * d;
      root.rot.x -= 0.2 * d;
      J.head.rot.x -= 0.6 * d;
      J.mandR.rot.y += (-0.35 - J.mandR.rot.y) * d;
      J.mandL.rot.y = -J.mandR.rot.y;
      J.antR.rot.x -= 1.1 * d;
      J.antL.rot.x -= 1.1 * d;
      J.abd.rot.x += 0.5 * d;
      for (let k = 0; k < 6; k++) {
        const side = k % 2 ? 1 : -1;
        cox[k].rot.z += side * 0.4 * d;
        cox[k].rot.y *= 1 - d;
        tib[k].rot.z += side * 0.95 * d;
      }
      J.eyes.scale.multiplyScalar(1 - 0.85 * d);
    }
  }
  return { skel: sk, parts, pose };
}

// HUSK. A segmented worm: a head with a hinged jaw, five body segments that
// trail on a chain of relative yaws so the undulation is a real S-curve, a
// dorsal fin per segment, and a glowing core in every gap between plates.
function makeHusk(m) {
  const sk = new Skeleton();
  sk.add('root', null, 0, 0.27, 0);
  sk.add('head', 'root', 0, 0.02, -0.14);
  sk.add('jawT', 'head', 0, -0.01, -0.16);
  sk.add('jawB', 'head', 0, -0.06, -0.15);
  sk.add('eye', 'head', 0, 0.04, -0.2);
  const segs = [];
  const cores = [];
  let parent = 'root';
  for (let i = 1; i <= 5; i++) {
    const k = Math.pow(0.9, i - 1);
    segs.push(sk.add('s' + i, parent, 0, 0, (i === 1 ? 0.2 : 0.3) * k));
    cores.push(sk.add('c' + i, 's' + i, 0, 0.03 * k, -0.14 * k));
    parent = 's' + i;
  }

  const head = merge([
    shift(hull(0.32, 0.34, 0.26, 0.5, 0.55), 0, 0, -0.06),
    shift(wedge(0.26, 0.1, 0, 0.06), 0, 0.12, -0.1),
  ]);
  // Jaw plates lie forward from their hinge, thickness up; fangs hang from
  // the upper one so an open jaw shows teeth.
  const jawT = merge([
    spin(slab(0.14, 0.03, 0.24, 0.03, 0, 0.2), -Math.PI / 2, 0, 0),
    shift(spin(cone(0.002, 0.014, 0.06, 4), Math.PI, 0, 0), 0.07, -0.035, -0.16),
    shift(spin(cone(0.002, 0.014, 0.06, 4), Math.PI, 0, 0), -0.07, -0.035, -0.16),
    shift(spin(cone(0.002, 0.012, 0.05, 4), Math.PI, 0, 0), 0, -0.03, -0.19),
  ]);
  const jawB = merge([
    spin(slab(0.12, 0.03, 0.2, 0.03, 0, 0.19), -Math.PI / 2, 0, 0),
    shift(wedge(0.16, 0.05, 0, 0.04), 0, 0.015, -0.1),
  ]);
  const seg = hull(0.3, 0.34, 0.26, 0.55, 0.5);
  // A dorsal fin runs fore-aft and leans back: rotate into line first, then
  // tilt, or the sweep ends up sideways.
  const fin = shift(spin(spin(wedge(0.18, 0.05, 0, 0.15), 0, Math.PI / 2, 0), 0.35, 0, 0), 0, 0.1, 0);
  const core = octa(0.085);

  const parts = [
    { geo: head, mat: m.plate, on: [['head', ID]] },
    { geo: jawT, mat: m.plate, on: [['jawT', ID]] },
    { geo: jawB, mat: m.plate, on: [['jawB', ID]] },
    { geo: seg, mat: m.body, on: segs.map((j, i) => [j.name, att(0, 0, 0, 0, 0, 0, Math.pow(0.9, i + 1))]) },
    { geo: fin, mat: m.plate, on: [
      ['head', att(0, 0.04, 0.02, 0, 0, 0, 0.8)],
      ...segs.map((j, i) => [j.name, att(0, 0, 0, 0, 0, 0, Math.pow(0.9, i + 1))]),
    ] },
    { geo: core, mat: m.glow, on: [
      ['eye', att(0, 0, 0, 0, 0, 0, 1.5, 0.45, 0.5)],
      ...cores.map((j, i) => [j.name, att(0, 0, 0, 0, 0, 0, Math.pow(0.9, i + 1))]),
    ] },
  ];

  const J = sk.byName;
  function pose(e, c) {
    const g = c.gait * TAU;
    // Undulation follows real progress; a little sway survives standing still
    // so a planted husk still reads as alive, and a stunned one goes slack.
    const amp = (0.15 + 0.85 * c.move) * (1 - 0.7 * c.stun);
    const breath = Math.sin(c.t * 4.2 + c.phase);
    const root = J.root;
    // The strike is a rear and a bite: the whole front of the body lifts and
    // tips back through the wind-up, the jaw gapes, and the lunge throws it
    // forward and down onto the victim with the jaw snapping shut.
    const rear = easeOut(c.wind);
    root.pos.y += breath * 0.015 - 0.06 * c.stun + 0.08 * rear;
    root.pos.z += 0.08 * c.wind - 0.3 * c.lunge + 0.06 * c.flinch;
    root.rot.x = 0.3 * rear - 0.1 * c.lunge + 0.2 * c.flinch;
    root.rot.y = Math.sin(g) * 0.1 * c.move;
    root.rot.z = c.turn * 0.04;
    J.head.rot.x = breath * 0.04 + 0.6 * rear - 0.7 * c.lunge + 0.35 * c.flinch - 0.5 * c.stun;
    J.head.rot.y = Math.sin(g + 0.6) * 0.14 * c.move + c.turn * 0.08;
    const open = c.wind > 0 ? 0.1 + 0.9 * easeOut(c.wind)
      : c.strike < 1 ? 0.95 * (1 - c.lunge) : 0.08 + 0.05 * Math.sin(c.t * 3 + c.phase);
    J.jawT.rot.x = open * 0.5;
    J.jawB.rot.x = -open * 0.75;
    const gs = 1 + 0.5 * c.shield + 0.45 * c.wind;
    J.eye.scale.set(gs, gs, gs);
    for (let i = 0; i < 5; i++) {
      const n = i + 1;
      const s = segs[i];
      let yaw = 0.36 * amp * Math.sin(g - n * 1.05);
      // The last two segments are the tail, and a tail whips: fastest while
      // the body is planted or winding up, when the rest of it is still.
      if (n >= 4) yaw += Math.sin(c.t * 7 + c.phase - n) * 0.28 * (0.35 + 0.65 * (1 - c.move) + c.wind);
      s.rot.y = yaw;
      s.rot.x = 0.07 * amp * Math.sin(2 * g - n * 1.05) + 0.1 * c.lunge - 0.05 * c.stun;
      cores[i].scale.set(gs, gs, gs);
    }
    if (c.dying > 0) {
      // Collapse: the head drops and the jaw falls slack, the body sinks and
      // rolls, and each segment sags a little further than the one before it
      // so the chain flattens from the head back.
      const d = easeOut(c.dying);
      root.pos.y -= 0.2 * d;
      root.rot.z += 0.5 * d;
      root.rot.x -= 0.15 * d;
      J.head.rot.x -= 0.7 * d;
      J.head.rot.y *= 1 - d;
      J.jawT.rot.x += (0.3 - J.jawT.rot.x) * d;
      J.jawB.rot.x += (-0.55 - J.jawB.rot.x) * d;
      const gd = 1 - 0.85 * d;
      J.eye.scale.multiplyScalar(gd);
      for (let i = 0; i < 5; i++) {
        const s = segs[i];
        s.rot.x += 0.09 * d;
        s.rot.y += Math.sin(c.phase + i * 1.9) * 0.18 * d;
        cores[i].scale.multiplyScalar(gd);
      }
    }
  }
  return { skel: sk, parts, pose };
}

// AEGIS. A hunched bipedal brute: two shield-arms held forward, a squat torso
// with a hump, a head sunk between the shoulders with a glowing slit, and two
// thick legs that crouch and extend through the hop. The strike is a shield
// bash: one shield goes up and back over the shoulder while the other holds
// the guard, and it slams down on the blow. The colossus raises a fist, so
// the two brutes' telegraphs read differently at a glance.
const SLAM_SH = [[0, 2.7], [0.3, 0.35], [1, 1.2]];
const SLAM_EL = [[0, 0.5], [0.3, -0.2], [1, -1.1]];
function makeAegis(m, mgr) {
  const sk = new Skeleton();
  sk.add('root', null, 0, 0.7, 0);
  sk.add('chest', 'root', 0, 0.14, 0);
  sk.add('head', 'chest', 0, 0.38, -0.12);
  sk.add('slit', 'head', 0, 0, 0);
  sk.add('shR', 'chest', 0.33, 0.36, -0.02);
  sk.add('shL', 'chest', -0.33, 0.36, -0.02);
  sk.add('elR', 'shR', 0, -0.28, 0);
  sk.add('elL', 'shL', 0, -0.28, 0);
  sk.add('hipR', 'root', 0.16, -0.08, 0);
  sk.add('hipL', 'root', -0.16, -0.08, 0);
  sk.add('knR', 'hipR', 0, -0.28, 0);
  sk.add('knL', 'hipL', 0, -0.28, 0);

  const pelvis = hull(0.38, 0.3, 0.22, 0.65, 0.5);
  const torso = merge([
    slab(0.56, 0.4, 0.36, 0.28, 0, 0.44),
    shift(hull(0.4, 0.26, 0.26, 0.5, 0.6), 0, 0.36, 0.14),
  ]);
  const head = merge([
    hull(0.26, 0.28, 0.22, 0.5, 0.7),
    shift(wedge(0.24, 0.1, 0, 0.06), 0, 0.08, -0.08),
  ]);
  const slit = box(0.16, 0.024, 0.05);
  const pad = merge([
    hull(0.22, 0.24, 0.16, 0.45, 0.7),
    shift(spin(wedge(0.2, 0.06, 0, 0.06), 0, Math.PI / 2, 0), 0, 0.07, 0),
  ]);
  const uarm = shift(cone(0.075, 0.06, 0.28, 6), 0, -0.14, 0);
  // The forearm IS the shield: a tall slab with a boss on its face.
  const shield = merge([
    slab(0.36, 0.09, 0.3, 0.09, -0.52, 0.04),
    shift(hull(0.18, 0.06, 0.34, 0.5, 0.5), 0, -0.24, -0.07),
  ]);
  const thigh = shift(cone(0.1, 0.08, 0.28, 6), 0, -0.14, 0);
  const shin = merge([
    shift(cone(0.075, 0.065, 0.3, 6), 0, -0.15, 0),
    shift(slab(0.15, 0.24, 0.13, 0.2, -0.38, -0.29), 0, 0, -0.05),
  ]);

  const parts = [
    { geo: pelvis, mat: m.body, on: [['root', ID]] },
    { geo: torso, mat: m.body, on: [['chest', ID]] },
    { geo: head, mat: m.body, on: [['head', ID]] },
    { geo: slit, mat: m.glow, on: [['slit', att(0, 0, -0.135)], ['chest', att(0, 0.3, 0.2, 0, 0, 0, 1.3, 1, 1)]] },
    { geo: pad, mat: m.plate, on: [['shR', att(0.02, 0.06, 0)], ['shL', att(-0.02, 0.06, 0)]] },
    { geo: uarm, mat: m.body, on: [['shR', ID], ['shL', ID]] },
    { geo: shield, mat: m.plate, on: [['elR', ID], ['elL', ID]] },
    { geo: thigh, mat: m.body, on: [['hipR', ID], ['hipL', ID]] },
    { geo: shin, mat: m.body, on: [['knR', ID], ['knL', ID]] },
  ];

  const J = sk.byName;
  function pose(e, c) {
    // The hop rides the gait phase, so a held or stunned aegis stays down and
    // a slowed one hops slower. Fire the landing ONCE per hop: the pose runs
    // once per enemy per frame now, which is the guarantee the old per-part
    // placer lacked (five parts, five rings, a twenty-slot pool gone).
    const hp = c.gait - Math.floor(c.gait);
    if (hp < e.hopPrev) mgr.onLandFx?.(e);
    e.hopPrev = hp;
    const air = hump(hp);
    const rise = Math.pow(air, 0.9) * 0.42 * c.move;
    const land = Math.pow(Math.max(0, Math.cos(Math.PI * hp)), 2) * c.move;
    const tuck = air * air * air * c.move;
    const bend = 0.3 + 0.7 * land + 0.45 * tuck + 0.35 * c.stun;
    const root = J.root;
    const w = easeOut(c.wind);
    // The wind-up coils the body down and twists it toward the raised arm,
    // and the blow unwinds it, so the bash reads from the torso as well as
    // from the shield.
    root.pos.y += rise - 0.14 * land - 0.12 * c.stun - 0.1 * w - 0.06 * c.lunge;
    root.pos.z += 0.06 * c.wind - 0.22 * c.lunge + 0.06 * c.flinch;
    root.rot.x = 0.2 * w - 0.15 * c.lunge + 0.2 * c.flinch;
    root.rot.z = c.turn * 0.05;
    J.hipR.rot.x = bend * 0.85 + 0.03;
    J.hipL.rot.x = bend * 0.85 - 0.03;
    J.knR.rot.x = -bend * 1.6;
    J.knL.rot.x = -bend * 1.6;
    const chest = J.chest;
    chest.rot.x = -0.3 - 0.12 * land + 0.4 * w - 0.45 * c.lunge + 0.25 * c.flinch - 0.3 * c.stun;
    chest.rot.y = 0.35 * w - 0.3 * c.lunge;
    chest.scale.y = 1 - 0.08 * land;
    J.head.rot.x = 0.15 + 0.2 * land - 0.35 * c.lunge + 0.3 * c.flinch - 0.5 * c.stun;
    J.head.rot.y = c.turn * 0.08;
    let shR;
    let shL;
    let elR;
    let elL;
    if (c.wind > 0) {
      // The right shield goes up and back over the shoulder; the left stays
      // forward as the guard and tucks in a little.
      shR = 1.2 + 1.5 * w;
      elR = -1.1 + 1.6 * w;
      shL = 1.2 - 0.3 * w;
      elL = -1.1 - 0.15 * w;
    } else if (c.strike < 1) {
      shR = keyed(SLAM_SH, c.strike);
      elR = keyed(SLAM_EL, c.strike);
      shL = 0.9 + 0.3 * c.strike;
      elL = -1.25 + 0.15 * c.strike;
    } else {
      shR = 1.2 - 0.15 * land;
      shL = shR;
      elR = -1.1;
      elL = -1.1;
    }
    J.shR.rot.x = shR;
    J.shL.rot.x = shL;
    J.shR.rot.z = 0.15 + 0.3 * c.wind - 0.25 * c.stun;
    J.shL.rot.z = -(0.15 + 0.1 * c.wind - 0.25 * c.stun);
    J.elR.rot.x = elR;
    J.elL.rot.x = elL;
    const gs = 1 + 0.5 * c.shield + 0.5 * c.wind;
    J.slit.scale.set(gs, gs, gs);
    if (c.dying > 0) {
      // Collapse: the knees give, the body drops onto them and folds forward,
      // the shields fall open to the sides and the head hangs.
      const d = easeOut(c.dying);
      root.pos.y -= 0.42 * d;
      root.rot.x -= 0.2 * d;
      J.hipR.rot.x += (0.2 - J.hipR.rot.x) * d;
      J.hipL.rot.x += (0.2 - J.hipL.rot.x) * d;
      J.knR.rot.x += (-2.3 - J.knR.rot.x) * d;
      J.knL.rot.x += (-2.3 - J.knL.rot.x) * d;
      chest.rot.x -= 0.6 * d;
      chest.rot.y *= 1 - d;
      J.head.rot.x -= 0.5 * d;
      J.shR.rot.x += (0.3 - J.shR.rot.x) * d;
      J.shL.rot.x += (0.3 - J.shL.rot.x) * d;
      J.shR.rot.z += 0.9 * d;
      J.shL.rot.z -= 0.9 * d;
      J.elR.rot.x *= 1 - d;
      J.elL.rot.x *= 1 - d;
      J.slit.scale.multiplyScalar(1 - 0.85 * d);
    }
  }
  return { skel: sk, parts, pose };
}

// WISP. A manta: a head with twin eyes, two membrane wings that bend at the
// wrist so the flap curls at the tip, a tail that forks into two feelers, and
// a body that banks into its turns.
function makeWisp(m) {
  const sk = new Skeleton();
  sk.add('root', null, 0, 0, 0);
  sk.add('head', 'root', 0, 0.02, -0.24);
  sk.add('eyes', 'head', 0, 0, 0);
  sk.add('shR', 'root', 0.1, 0, -0.04);
  sk.add('shL', 'root', -0.1, 0, -0.04);
  sk.add('wrR', 'shR', 0.3, 0, 0.084);
  sk.add('wrL', 'shL', -0.3, 0, 0.084);
  sk.add('tail', 'root', 0, 0, 0.24);
  sk.add('tip', 'tail', 0, 0, 0.3);

  const body = merge([
    spin(slab(0.08, 0.05, 0.26, 0.13, 0, 0.32), Math.PI / 2, 0, 0),
    spin(slab(0.16, 0.08, 0.26, 0.13, 0, 0.14), -Math.PI / 2, 0, 0),
    shift(spin(wedge(0.2, 0.05, 0, 0.06), 0, Math.PI / 2, 0), 0, 0.06, 0.06),
  ]);
  const head = merge([
    shift(hull(0.17, 0.2, 0.12, 0.45, 0.6), 0, 0, -0.04),
    shift(wedge(0.16, 0.05, 0, 0.035), 0, 0.055, -0.06),
  ]);
  const eye = octa(0.035);
  // Wing panels are built along Y, sheared back, then laid along +X. The
  // left copy is the same mesh spun half a turn about Z in its offset, which
  // mirrors x and keeps the sweep, so one draw call serves both wings.
  const wingIn = spin(shear(slab(0.03, 0.32, 0.03, 0.44, 0, 0.3), 0.28), 0, 0, -Math.PI / 2);
  const wingOut = spin(shear(slab(0.03, 0.06, 0.03, 0.32, 0, 0.3), 0.4), 0, 0, -Math.PI / 2);
  const tail = shift(spin(cone(0.02, 0.05, 0.3, 5), Math.PI / 2, 0, 0), 0, 0, 0.15);
  const tip = merge([
    shift(spin(cone(0.003, 0.014, 0.28, 4), Math.PI / 2, 0.35, 0), -0.048, 0, 0.13),
    shift(spin(cone(0.003, 0.014, 0.28, 4), Math.PI / 2, -0.35, 0), 0.048, 0, 0.13),
  ]);

  const parts = [
    { geo: body, mat: m.plate, on: [['root', ID]] },
    { geo: head, mat: m.plate, on: [['head', ID]] },
    { geo: eye, mat: m.glow, on: [['eyes', att(0.05, 0.01, -0.1)], ['eyes', att(-0.05, 0.01, -0.1)]] },
    { geo: wingIn, mat: m.body, on: [['shR', ID], ['shL', att(0, 0, 0, 0, 0, Math.PI)]] },
    { geo: wingOut, mat: m.body, on: [['wrR', ID], ['wrL', att(0, 0, 0, 0, 0, Math.PI)]] },
    { geo: tail, mat: m.body, on: [['tail', ID]] },
    { geo: tip, mat: m.body, on: [['tip', ID]] },
  ];

  const J = sk.byName;
  function pose(e, c) {
    const f = Math.sin(c.t * 7.5 + c.phase);
    const fl = Math.sin(c.t * 7.5 + c.phase - 1.1);
    const w = easeOut(c.wind);
    const root = J.root;
    // Bank into the turn: a positive yaw rate is a left turn, and a positive
    // roll raises the right wing, which is the left bank a flier makes.
    root.rot.z = clamp(c.turn * 0.45, -0.7, 0.7) + f * 0.05;
    // The strike is a dive: the body rises and rears through the wind-up,
    // then pitches over and drops onto the victim.
    root.rot.x = -0.08 + 0.55 * w - 0.7 * c.lunge + 0.3 * c.flinch - 0.3 * c.stun;
    root.pos.z += -0.3 * c.lunge + 0.05 * c.flinch;
    root.pos.y += 0.2 * w - 0.35 * c.lunge - 0.1 * c.stun;
    // Wings rise through the wind-up and beat down hard on the strike; a
    // stunned wisp lets them droop.
    const up = -0.1 + 0.5 * f + 0.5 * w - 0.6 * c.lunge - 0.5 * c.stun;
    J.shR.rot.z = up;
    J.shL.rot.z = -up;
    const curl = 0.55 * fl - 0.3 * c.stun;
    J.wrR.rot.z = curl;
    J.wrL.rot.z = -curl;
    J.head.rot.x = -0.1 + Math.sin(c.t * 3 + c.phase) * 0.06 - 0.3 * c.lunge + 0.2 * w - 0.3 * c.stun;
    J.head.rot.y = c.turn * 0.15;
    // The tail curls up through the wind-up and whips down through the dive:
    // the wisp comes down onto its victim tail-first, which is the part of
    // the strike that reads from below.
    J.tail.rot.y = Math.sin(c.t * 4 + c.phase) * 0.18 + c.turn * 0.35;
    J.tail.rot.x = -f * 0.12 - 0.5 * w + 0.8 * c.lunge;
    J.tip.rot.y = Math.sin(c.t * 4 + c.phase - 0.9) * 0.3 + c.turn * 0.3;
    J.tip.rot.x = -0.4 * w + 0.9 * c.lunge;
    const gs = 1 + 0.5 * c.shield + 0.4 * c.wind;
    J.eyes.scale.set(gs, gs, gs);
    if (c.dying > 0) {
      // Collapse: a flyer falls. The wings fold up over the back, the body
      // rolls and noses down, and the root drops the body's whole altitude
      // over the collapse - a world distance, hence the frame scale - so the
      // burst fires on the ground where it lands.
      const d = easeOut(c.dying);
      root.pos.y -= (e.alt / c.scale) * c.dying * c.dying;
      root.rot.z += 1.1 * d;
      root.rot.x -= 0.6 * d;
      J.shR.rot.z += 1.3 * d;
      J.shL.rot.z -= 1.3 * d;
      J.wrR.rot.z += 0.8 * d;
      J.wrL.rot.z -= 0.8 * d;
      J.tail.rot.x += 0.5 * d;
      J.eyes.scale.multiplyScalar(1 - 0.85 * d);
    }
  }
  return { skel: sk, parts, pose };
}

// COLOSSUS. A titan on two legs: pelvis, belly, chest with a glowing heart
// cavity, a horned head, two arms ending in club fists, a slow stomping gait
// that sinks the body on every footfall. Its six armour plates sit ON the
// body - shoulders, belly, back, thighs - and are shed from the highest index
// down as its health drops, so the legs bare first and the shoulders last.
// Three shards still orbit the chest as a small halo. The strike is a hammer
// stroke: the right fist goes overhead while the spine winds and the left arm
// swings back as the counterweight, and the blow unwinds the whole body.
const TITAN_SH = [[0, 2.85], [0.28, -0.9], [1, -0.25]];
function makeColossus(m) {
  const sk = new Skeleton();
  sk.add('root', null, 0, 1.05, 0);
  sk.add('spine', 'root', 0, 0.22, 0);
  sk.add('chest', 'spine', 0, 0.3, 0);
  sk.add('neck', 'chest', 0, 0.44, -0.04);
  sk.add('eyes', 'neck', 0, 0, 0);
  sk.add('heart', 'chest', 0, 0.22, -0.27);
  sk.add('halo', 'chest', 0, 0.5, 0);
  sk.add('shR', 'chest', 0.6, 0.36, 0);
  sk.add('shL', 'chest', -0.6, 0.36, 0);
  sk.add('elR', 'shR', 0, -0.54, 0);
  sk.add('elL', 'shL', 0, -0.54, 0);
  sk.add('fistR', 'elR', 0, -0.48, 0);
  sk.add('fistL', 'elL', 0, -0.48, 0);
  sk.add('hipR', 'root', 0.27, -0.1, 0);
  sk.add('hipL', 'root', -0.27, -0.1, 0);
  sk.add('knR', 'hipR', 0, -0.44, 0);
  sk.add('knL', 'hipL', 0, -0.44, 0);

  const pelvis = hull(0.62, 0.46, 0.34, 0.65, 0.6);
  const belly = slab(0.64, 0.46, 0.56, 0.4, 0, 0.32);
  const torso = merge([
    slab(0.92, 0.52, 0.64, 0.44, 0, 0.46),
    shift(hull(0.52, 0.32, 0.32, 0.5, 0.6), 0, 0.34, 0.2),
    // A rim around the heart cavity, so the glow reads as set INTO the chest.
    shift(box(0.4, 0.05, 0.06), 0, 0.42, -0.26),
    shift(box(0.4, 0.05, 0.06), 0, 0.03, -0.25),
    shift(box(0.05, 0.36, 0.06), 0.19, 0.22, -0.26),
    shift(box(0.05, 0.36, 0.06), -0.19, 0.22, -0.26),
  ]);
  const head = merge([
    hull(0.34, 0.36, 0.3, 0.55, 0.65),
    shift(wedge(0.3, 0.12, 0, 0.07), 0, 0.09, -0.12),
    shift(slab(0.24, 0.2, 0.18, 0.16, -0.12, 0), 0, -0.1, -0.06),
    shift(spin(cone(0.012, 0.055, 0.4, 5), 0.35, 0, -0.6), 0.2, 0.26, 0.05),
    shift(spin(cone(0.012, 0.055, 0.4, 5), 0.35, 0, 0.6), -0.2, 0.26, 0.05),
  ]);
  const glow = octa(0.15);
  const uarm = shift(cone(0.13, 0.11, 0.54, 6), 0, -0.27, 0);
  const farm = shift(cone(0.11, 0.13, 0.48, 6), 0, -0.24, 0);
  const fist = shift(hull(0.34, 0.32, 0.34, 0.55, 0.55), 0, -0.14, 0);
  const thigh = shift(cone(0.17, 0.13, 0.44, 6), 0, -0.22, 0);
  const shin = merge([
    shift(cone(0.12, 0.11, 0.4, 6), 0, -0.2, 0),
    shift(slab(0.26, 0.4, 0.24, 0.34, -0.5, -0.4), 0, 0, -0.06),
  ]);
  const plate = merge([
    slab(0.36, 0.1, 0.44, 0.14, -0.3, 0.06),
    shift(spin(wedge(0.3, 0.06, 0, 0.06), 0, Math.PI / 2, 0), 0, 0.05, -0.06),
  ]);
  const shard = octa(0.12);
  shard.scale(1, 1.8, 1);

  const parts = [
    { geo: pelvis, mat: m.body, on: [['root', ID]] },
    { geo: belly, mat: m.body, on: [['spine', ID]] },
    { geo: torso, mat: m.body, on: [['chest', ID]] },
    { geo: head, mat: m.body, on: [['neck', ID]] },
    { geo: glow, mat: m.glow, on: [
      ['heart', att(0, 0, 0, 0, 0, 0, 1, 1.25, 0.6)],
      ['eyes', att(0.09, 0.03, -0.17, 0, 0, 0, 0.3)],
      ['eyes', att(-0.09, 0.03, -0.17, 0, 0, 0, 0.3)],
    ] },
    { geo: uarm, mat: m.body, on: [['shR', ID], ['shL', ID]] },
    { geo: farm, mat: m.body, on: [['elR', ID], ['elL', ID]] },
    { geo: fist, mat: m.plate, on: [['fistR', ID], ['fistL', ID]] },
    { geo: thigh, mat: m.body, on: [['hipR', ID], ['hipL', ID]] },
    { geo: shin, mat: m.body, on: [['knR', ID], ['knL', ID]] },
    { geo: plate, mat: m.plate, hide: (e, k) => k >= e.plates, on: [
      ['shR', att(0.08, 0.14, 0, 0, 0, -0.55, 1.1)],
      ['shL', att(-0.08, 0.14, 0, 0, 0, 0.55, 1.1)],
      ['spine', att(0, 0.28, -0.25, -0.15, 0, 0)],
      ['chest', att(0, 0.3, 0.32, 0, Math.PI, 0)],
      ['hipR', att(0.06, -0.06, -0.12, -0.2, 0, 0, 0.9)],
      ['hipL', att(-0.06, -0.06, -0.12, -0.2, 0, 0, 0.9)],
    ] },
    { geo: shard, mat: m.body, on: [
      ['halo', att(0.9, 0, 0, 0.3, 0, 0.4)],
      ['halo', att(-0.45, 0.1, 0.78, 0, 2.1, 0.5)],
      ['halo', att(-0.45, -0.05, -0.78, 0.5, 4.2, 0.3)],
    ] },
  ];

  const J = sk.byName;
  function pose(e, c) {
    const s = c.gait * TAU;
    const mv = c.move;
    const w = easeOut(c.wind);
    // Each footfall lands where the leading leg reaches full reach, and the
    // whole body sinks onto it.
    const sink = Math.max(0, -Math.cos(2 * s)) * 0.08 * mv;
    const root = J.root;
    root.pos.y += -sink - 0.12 * c.lunge - 0.1 * c.stun;
    root.pos.z += 0.06 * c.wind - 0.22 * c.lunge + 0.04 * c.flinch;
    root.rot.z = Math.sin(s) * 0.04 * mv + c.turn * 0.03;
    root.rot.y = -Math.sin(s) * 0.06 * mv;
    const swing = Math.sin(s) * mv;
    J.hipR.rot.x = 0.42 * swing + 0.15;
    J.hipL.rot.x = -0.42 * swing + 0.15;
    // A leg bends its knee on the forward swing and locks for the stance.
    J.knR.rot.x = -(0.35 + 0.6 * Math.max(0, Math.cos(s)) * mv + 0.3 * c.stun);
    J.knL.rot.x = -(0.35 + 0.6 * Math.max(0, -Math.cos(s)) * mv + 0.3 * c.stun);
    J.spine.rot.x = -0.1 + 0.3 * w - 0.45 * c.lunge + 0.15 * c.flinch - 0.35 * c.stun;
    J.spine.rot.y = Math.sin(s) * 0.08 * mv + 0.4 * w - 0.35 * c.lunge;
    J.chest.rot.x = -0.05 + 0.15 * w - 0.2 * c.lunge;
    J.chest.rot.y = 0.2 * w - 0.2 * c.lunge;
    J.neck.rot.x = 0.05 + 0.25 * w - 0.35 * c.lunge + 0.3 * c.flinch - 0.45 * c.stun;
    J.neck.rot.y = c.turn * 0.1;
    // The right fist goes overhead through the wind-up; the left swings back
    // as the counterweight and comes forward again as the blow lands.
    let armR;
    let armL;
    let el;
    if (c.wind > 0) {
      armR = -0.25 + 3.1 * w;
      armL = -0.25 - 0.7 * w;
      el = 0.5 + 0.6 * w;
    } else if (c.strike < 1) {
      armR = keyed(TITAN_SH, c.strike);
      armL = -0.95 + 0.7 * c.strike;
      el = 0.5 + 0.3 * c.lunge;
    } else {
      armR = -0.25 - 0.3 * swing;
      armL = -0.25 + 0.3 * swing;
      el = 0.5;
    }
    J.shR.rot.x = armR;
    J.shL.rot.x = armL;
    J.shR.rot.z = 0.25 + 0.35 * w - 0.2 * c.stun;
    J.shL.rot.z = -(0.25 + 0.1 * w - 0.2 * c.stun);
    J.elR.rot.x = el;
    J.elL.rot.x = 0.5;
    const beat = 1 + Math.sin(c.t * 3.4) * 0.07 + 0.5 * c.shield + 0.5 * c.wind;
    J.heart.scale.set(beat, beat, beat);
    const gs = 1 + 0.4 * c.shield + 0.4 * c.wind;
    J.eyes.scale.set(gs, gs, gs);
    J.halo.rot.y = c.t * 0.85;
    J.halo.rot.x = Math.sin(c.t * 0.9) * 0.15;
    if (c.dying > 0) {
      // Collapse: the knees buckle, the titan drops to them and folds at the
      // spine, the arms hang, the horns come down, and the heart gutters
      // while the halo falls in on it.
      const d = easeOut(c.dying);
      root.pos.y -= 0.55 * d;
      root.rot.x -= 0.15 * d;
      J.hipR.rot.x += (0.1 - J.hipR.rot.x) * d;
      J.hipL.rot.x += (0.1 - J.hipL.rot.x) * d;
      J.knR.rot.x += (-2.2 - J.knR.rot.x) * d;
      J.knL.rot.x += (-2.2 - J.knL.rot.x) * d;
      J.spine.rot.x -= 0.55 * d;
      J.spine.rot.y *= 1 - d;
      J.chest.rot.x -= 0.3 * d;
      J.chest.rot.y *= 1 - d;
      J.neck.rot.x -= 0.5 * d;
      J.shR.rot.x += (0.15 - J.shR.rot.x) * d;
      J.shL.rot.x += (0.15 - J.shL.rot.x) * d;
      J.shR.rot.z += 0.35 * d;
      J.shL.rot.z -= 0.35 * d;
      J.elR.rot.x *= 1 - d;
      J.elL.rot.x *= 1 - d;
      const gd = 1 - 0.85 * d;
      J.heart.scale.multiplyScalar(gd);
      J.eyes.scale.multiplyScalar(gd);
      J.halo.scale.setScalar(1 - 0.9 * d);
      J.halo.pos.y -= 0.6 * d;
    }
  }
  return { skel: sk, parts, pose };
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
    // How fast bodies MARCH, as opposed to how hard they hit. 99 Planets spawns
    // at the frontier edge and the frontier widens every wave, so the walk in
    // gets longer all run - by the end it is most of the wave's clock. The mode
    // scales this so the approach stays roughly the same length however wide
    // the circle has grown, which is a pacing knob rather than a difficulty one:
    // the same bodies with the same health arrive, they just stop dawdling.
    this.marchMul = 1;
    this.onDeathFx = null;
    this.onSpawnFx = null;
    this.heartPos = new THREE.Vector3();
    this.time = 0;
    // The evolution tint last baked into the plate colours; undefined so the
    // first frame bakes tier 0.
    this._tintKey = undefined;
    this._buildRenderers(scene);
  }

  setHeart(pos) {
    this.heartPos.copy(pos);
    this.heartDir = pos.clone().normalize();
  }

  _buildRenderers(scene) {
    // Articulated species: each species is a skeleton and a set of instanced
    // parts; every enemy contributes one instance per part placement with a
    // per-frame transform composed from its pose. All animation here is
    // cosmetic and reads sim state only.
    const bodyMat = new THREE.MeshStandardMaterial({
      color: PALETTE.voidBody, roughness: 0.5, metalness: 0.2, flatShading: true,
      emissive: PALETTE.voidEmissive, emissiveIntensity: 0.12,
    });
    // The plate colour lives in the INSTANCE colour, not the material, so the
    // material base is white. An instance colour can only multiply, and a
    // multiplier cannot push a near-black purple toward the gold or teal of
    // an evolution tier; carrying the whole colour per instance can. Tier 0
    // writes exactly PALETTE.voidPlate, so nothing changes until it evolves.
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.62, metalness: 0.15, flatShading: true,
      emissive: PALETTE.voidEmissive, emissiveIntensity: 0.06,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: PALETTE.voidEmissive, roughness: 0.4, metalness: 0, flatShading: true,
      emissive: PALETTE.voidEmissive, emissiveIntensity: 2.1,
    });
    this.materials = { bodyMat, plateMat, glowMat };
    const mats = { body: bodyMat, plate: plateMat, glow: glowMat };

    const defs = {
      mite: makeMite(mats),
      husk: makeHusk(mats),
      aegis: makeAegis(mats, this),
      wisp: makeWisp(mats),
      colossus: makeColossus(mats),
    };

    // `species[key]` stays the flat parts list it has always been; the
    // skeleton and pose sit beside it in `_rigs`, and `_speciesList` is the
    // same thing as an array so the frame loop never calls Object.keys.
    this.species = {};
    this._rigs = {};
    this._speciesList = [];
    for (const key of Object.keys(defs)) {
      const def = defs[key];
      const parts = def.parts.map((p) => {
        const per = p.on.length;
        const mesh = new THREE.InstancedMesh(p.geo, p.mat, CONFIG.limits.maxEnemies * per);
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        // Instanced, so the whole swarm costs one shadow draw per body part.
        // Glow parts stay out of the map for the same reason tower energy does:
        // a shadow cast by a light source reads as a modelling error.
        mesh.castShadow = p.mat !== glowMat;
        mesh.receiveShadow = true;
        scene.add(mesh);
        const kind = p.mat === glowMat ? 2 : p.mat === plateMat ? 1 : 0;
        const inst = p.on.map(([joint, off]) => ({ j: def.skel.get(joint), off }));
        return { mesh, per, glow: kind === 2, kind, inst, hide: p.hide || null, _n: 0 };
      });
      this.species[key] = parts;
      this._rigs[key] = {
        skel: def.skel, pose: def.pose, parts,
        strideInv: STRIDE[key] > 0 ? 1 / STRIDE[key] : 0,
      };
      this._speciesList.push(this._rigs[key]);
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
      e.atkCd = blowCd(type);
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

    this.enemyPos(e, _mePos);
    let best = null;
    let bestD = type.reach;
    for (const a of this.allies.active) {
      if (!a.active || a.dead) continue;
      const d = this.allies.worldPos(a, _alPos).distanceTo(_mePos);
      if (d <= bestD) { bestD = d; best = a; }
    }
    // The scan throttle is for IDLE bodies. It used to be re-armed on a
    // successful scan as well, which put its 0.2 s dead time into every
    // swing cycle on top of the wind-up (see blowCd).
    if (!best) { e.scanT = MELEE_SCAN; return false; }
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
      // The body is NOT released here. It stays on the board, inert to every
      // targeting pass (all of them skip e.dead), and collapses for DYING_T;
      // update() releases it and fires the shard burst when the collapse
      // completes, so the burst caps the fall instead of replacing it. The
      // bounty above is still paid at the moment of death. A swing or a chase
      // in progress dies with the body: a corpse's blow must never land.
      e.dying = DYING_T;
      e.windT = 0;
      e.atkVictim = null;
      e.chaseT = 0;
    }
    return dmg;
  }

  // Steer toward the possessed body when the rules above SPOT allow it. On a
  // chase frame the bearing to the body is written into _des in place of the
  // field's direction and true is returned; otherwise _des is left alone. The
  // separation and turn-rate limits downstream apply to both, which is what
  // keeps a chasing pack from stacking into one body.
  _chase(e, dt, player) {
    if (e.chaseCd > 0) { e.chaseCd -= dt; return false; }
    if (!player || e.type.boss) { e.chaseT = 0; return false; }
    this.enemyPos(e, _mePos);
    const dPlayer = _mePos.distanceTo(_plPos);
    const dHeart = _mePos.distanceTo(this.heartPos);
    if (e.chaseT > 0) {
      // Mid-chase: the leash, the clock, and the base pulling rank. Every
      // ending starts the rest, so an enemy the player dances around the
      // VICINITY line cannot be re-hooked frame after frame.
      if (dPlayer > CHASE_LEASH || dHeart <= VICINITY || e.chaseT >= CHASE_MAX) {
        e.chaseT = 0;
        e.chaseCd = CHASE_REST;
        return false;
      }
    } else if (dPlayer > SPOT || dHeart <= VICINITY) {
      return false;
    }
    _tmp.copy(player.dir).addScaledVector(e.dir, -player.dir.dot(e.dir));
    // Standing on top of the body leaves no bearing; the field decides.
    if (_tmp.lengthSq() < 1e-10) return false;
    e.chaseT += dt;
    _des.copy(_tmp).normalize();
    return true;
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

    // The possessed body, found once per frame rather than once per enemy.
    // Only this body is ever chased; the AI units are not, so a wave cannot
    // be held up by a garrison.
    let player = null;
    if (this.allies) {
      for (const a of this.allies.active) {
        if (a.possessed && a.active && !a.dead) { player = a; break; }
      }
      if (player) this.allies.worldPos(player, _plPos);
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.spawnT += dt;
      e.flashT = Math.max(0, e.flashT - dt);
      e.brittle = Math.max(0, e.brittle - dt);
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowFrac = 0; }
      // Cleared before any early exit below, so a held or stunned body reports
      // no progress and its gait freezes with it.
      e.moveV = 0;
      // A dying body only counts down. No melee, no steering and, below, no
      // separation pull on its neighbours: it is scenery until it is released,
      // and the release is what fires the shard burst.
      if (e.dying > 0) {
        e.dying -= dt;
        if (e.dying <= 0) {
          e.dying = 0;
          if (this.onDeathFx) this.onDeathFx(e);
          this._release(e);
        }
        continue;
      }
      // Melee is resolved BEFORE the stun guard. An ally holds an enemy the
      // instant it engages, so leaving this below the guard meant a held enemy
      // could never even register that something was standing in front of it,
      // and it was stunlocked for the whole hold budget without ever swinging.
      // Only movement is stopped by a stun; the swing clock keeps running.
      const swinging = this._melee(e, dt);
      if (e.stunT > 0) { e.stunT -= dt; continue; }

      const type = e.type;
      if (e.shieldT > 0) e.shieldT -= dt;
      let stepSpeed = e.speed * (1 - e.slowFrac) * evoTraits().speedMul * this.marchMul;
      if (e.spawnT < 0.5) stepSpeed *= e.spawnT * 2;
      // Planted for the wind-up so the blow reads as a blow. This is the ONLY
      // thing an ally can do to slow an enemy's march other than the bounded
      // hold, which is what keeps the wave guaranteed to resolve.
      if (swinging) stepSpeed = 0;
      e.moveV = stepSpeed;

      // Flyers ride the same corridors as walkers (the flow field ignores
      // nothing for them: tower blocks do not enter their steering) but the
      // field itself routes them over the defended lanes, which keeps
      // anti-air placement meaningful. sampleFlow falls back to a great
      // circle wherever the field is undefined.
      e.node = this.nav.descendNode(e.node, e.dir);
      e.progress = this.nav.sampleFlow(e.node, e.dir, _des);
      // The chase overrides the field's direction, never the node tracking
      // above it, so a body that gives up the chase resumes the field from
      // wherever it actually stands.
      this._chase(e, dt, player);

      // Separation from nearby enemies of the same plane (walkers vs flyers).
      _sep.set(0, 0, 0);
      for (let k = 0; k < this.active.length; k++) {
        if (k === i) continue;
        const o = this.active[k];
        if (o.dying > 0) continue;
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

      // Turn-rate limited steering: the heading closes a fixed fraction of
      // the remaining angle every frame. This used to lerp the two unit
      // vectors, which is the same thing for small angles and nothing at all
      // for a reversal: a lerp between opposite vectors shrinks through zero
      // and normalises back to where it started, so an enemy that spotted
      // the player behind it walked AWAY at full speed with chaseT climbing.
      // Measured: fwd dot bearing pinned at -1.00 for 90 frames. Rotating by
      // angle has no such hole, and when the headings are exactly opposite
      // the body's up is the axis, so a reversal is a turn rather than a
      // stall.
      const turn = type.flying ? 2.6 : 3.4;
      const off = Math.acos(clamp(e.fwd.dot(_des), -1, 1));
      if (off > 1e-4) {
        _tmp.crossVectors(e.fwd, _des);
        if (_tmp.lengthSq() < 1e-10) _tmp.copy(e.dir); else _tmp.normalize();
        e.fwd.applyAxisAngle(_tmp, off * Math.min(1, turn * dt));
      }
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

  // Bake the plate colours for the current evolution tier. Runs once per
  // frame and only rebuilds when the tier changes. The tint is pulled toward
  // the base plate rather than used raw so the plate still reads as obsidian
  // with a coloured sheen, not as a repaint; the shield colour is the same
  // tint pushed bright, or the void magenta when there is no tint.
  _syncTint() {
    const tint = evoTraits().tint;
    if (tint === this._tintKey) return;
    this._tintKey = tint;
    _plateTint.setHex(PALETTE.voidPlate);
    if (tint) {
      _tintCol.setHex(tint).multiplyScalar(0.5);
      _plateTint.lerp(_tintCol, 0.72);
      _shieldCol.setHex(tint).multiplyScalar(1.6);
    } else {
      _shieldCol.setHex(PALETTE.voidEmissive).multiplyScalar(0.9);
    }
  }

  _render(dt) {
    const t = this.time;
    const list = this._speciesList;
    for (let i = 0; i < list.length; i++) {
      const parts = list[i].parts;
      for (let p = 0; p < parts.length; p++) parts[p]._n = 0;
    }
    this._syncTint();
    const evo = evoTraits();
    const inv = dt > 1e-6 ? 1 / dt : 0;
    const kMove = Math.min(1, dt * 10);
    const kStun = Math.min(1, dt * 14);
    const kTurn = Math.min(1, dt * 6);

    for (let i = 0; i < this.active.length; i++) {
      const e = this.active[i];
      const type = e.type;
      const rig = this._rigs[e.typeKey];
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

      // Cosmetic integrators. The gait advances by real progress over the
      // species' stride so feet plant; the motion fraction and stun ease so
      // a body settles into a stop or a sag instead of snapping; the turn
      // rate is read off how far the heading swung since last frame.
      e.gaitT += dt * e.moveV * rig.strideInv;
      const nominal = type.speed * evo.speedMul * this.marchMul * 0.55 + 1e-6;
      e.moveS += (Math.min(1, e.moveV / nominal) - e.moveS) * kMove;
      e.stunS += ((e.stunT > 0 ? 1 : 0) - e.stunS) * kStun;
      _tmp.crossVectors(e.prevFwd, e.fwd);
      e.turnS += (clamp(_tmp.dot(e.dir) * inv, -3, 3) - e.turnS) * kTurn;
      e.prevFwd.copy(e.fwd);

      // A dying body plays nothing but its collapse: the swing it was in the
      // middle of was cancelled by damage(), and the lunge window that atkCd
      // would otherwise report is suppressed here so a body killed on the
      // frame its blow landed does not lunge while it falls.
      const dying = e.dying > 0 ? 1 - e.dying / DYING_T : 0;
      _c.t = t;
      _c.phase = e.phase;
      _c.gait = e.gaitT;
      _c.move = e.moveS;
      _c.stun = e.stunS;
      _c.turn = e.turnS;
      _c.dying = dying;
      _c.scale = bodyScale;
      _c.wind = e.windT > 0 ? 1 - e.windT / type.wind : 0;
      // The blow lands the frame windT runs out and atkCd is set to blowCd,
      // so the lunge window is the first STRIKE_T seconds of that cooldown.
      _c.strike = (dying === 0 && e.windT <= 0 && e.atkCd > 0) ? clamp((blowCd(type) - e.atkCd) / STRIKE_T, 0, 1) : 1;
      _c.lunge = _c.strike < 1 ? keyed(LUNGE, _c.strike) : 0;
      _c.flinch = e.flashT > 0 ? Math.min(1, e.flashT / 0.09) : 0;
      _c.shield = (e.shieldT > 0 && e.shieldHits > 0) ? 1 : 0;

      const skel = rig.skel;
      skel.reset();
      rig.pose(e, _c);
      skel.compute(_frame);

      // Colours, once per enemy. Hit flash and slow tint are the ones that
      // shipped; the wind-up brightens the glow so the tell reads from the
      // board, and an armed shield pulses the plates toward the tier colour
      // so a blocked hit reads as a shield rather than as a miss.
      const flash = e.flashT > 0 ? 1 : 0;
      const slow = e.slowFrac > 0 ? 1 : 0;
      const wg = _c.wind;
      const sh = _c.shield ? 0.55 + 0.45 * Math.sin(t * 16) : 0;
      _colGlow.setRGB(
        1 + flash * 2 + wg * 1.6 + sh * 0.5,
        1 + flash * 2 + slow * 0.5 + wg * 0.5 + sh * 0.5,
        1 + flash * 2 + slow + wg * 1.2 + sh * 0.5,
      );
      _colBody.setRGB(1 + flash * 5 + slow * 0.1, 1 + flash * 5 + slow * 0.9, 1 + flash * 5 + slow * 2.2);
      _colPlate.copy(_plateTint);
      if (sh > 0) _colPlate.lerp(_shieldCol, sh * 0.7);
      _colPlate.r *= 1 + flash * 5 + slow * 0.1;
      _colPlate.g *= 1 + flash * 5 + slow * 0.9;
      _colPlate.b *= 1 + flash * 5 + slow * 2.2;
      if (dying > 0) {
        // The glow gutters out and the body darkens through the collapse, so
        // it reads as a light going out rather than as a pose change. The
        // instance colour only scales the lit diffuse, not the emissive, so
        // each pose also shrinks its glow joints toward nothing.
        const k = 1 - dying;
        _colGlow.multiplyScalar(k * k);
        _colBody.multiplyScalar(0.3 + 0.7 * k);
        _colPlate.multiplyScalar(0.3 + 0.7 * k);
      }

      const parts = rig.parts;
      for (let p = 0; p < parts.length; p++) {
        const part = parts[p];
        const inst = part.inst;
        const mesh = part.mesh;
        const col = part.kind === 2 ? _colGlow : part.kind === 1 ? _colPlate : _colBody;
        for (let k = 0; k < inst.length; k++) {
          if (part.hide !== null && part.hide(e, k)) continue;
          const ins = inst[k];
          _m4.multiplyMatrices(ins.j.world, ins.off);
          mesh.setMatrixAt(part._n, _m4);
          mesh.setColorAt(part._n, col);
          part._n++;
        }
      }
    }

    for (let i = 0; i < list.length; i++) {
      const parts = list[i].parts;
      for (let p = 0; p < parts.length; p++) {
        const part = parts[p];
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
