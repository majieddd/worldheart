import * as THREE from 'three';
import { Skeleton, slab, box, wedge, cone, merge, mirrorX, shift, spin, grow, easeOut, easeIn, smooth, hump, keyed } from './rig.js';

// The friendly bodies: one humanoid rig, six builds, one pose function.
//
// Before this file a soldier was eight boxes in a table, and a swing was the
// right-arm box sliding forward 0.28 units. The owner's brief was blunt: the
// swing looked terrible and did not show at all in third person. Both were
// the same defect. Nothing had a joint, so nothing could raise a sword over
// its shoulder and bring it across, and nothing HELD a sword in the first
// place: the weapon existed only in the first-person prop.
//
// Now every archetype is built on the same skeleton (pelvis, spine, chest,
// neck, head, two three-joint arms, two three-joint legs, a three-link cape
// and a weapon joint in the right hand), with its own proportions, helmet,
// crest and weapon, and one pose function layers idle, gait, jump, hurt and
// the strike that matches its attack kind. Third person shows the same swing
// first person does, because it is the same swing.
//
// Everything is in BODY space: x right, y up from the soles, and FORWARD IS
// -z, the same convention as Three's cameras and the enemy renderer. The
// first build of this file put forward on +z, and because (right, up,
// forward) is a left-handed triple under Three's conventions, the only
// proper rotation onto the world put the body's +x on its LEFT: every
// soldier held its sword in the wrong hand and every swing crossed the wrong
// way. The renderer's frame matrix carries position, facing and the
// archetype's `type.scale`.

// Body-space rest positions. A body at scale 1 stands 1.2 tall; the
// first-person eye sits at 1.05, which is where the visor is.
const REST = {
  pelvisY: 0.50, spineUp: 0.11, chestUp: 0.15, neckUp: 0.19, headUp: 0.07,
  shoulderX: 0.24, shoulderUp: 0.13, upperArm: 0.21, foreArm: 0.20,
  hipX: 0.105, thigh: 0.24, shin: 0.22,
};

// ---------------------------------------------------------------------------
// Skeleton. Shared shape, per-build widths.

function buildSkeleton(w) {
  const sk = new Skeleton();
  sk.add('ground', null, 0, 0.05, 0);
  sk.add('pelvis', null, 0, REST.pelvisY, 0);
  sk.add('spine', 'pelvis', 0, REST.spineUp, 0);
  sk.add('chest', 'spine', 0, REST.chestUp, 0);
  sk.add('neck', 'chest', 0, REST.neckUp, 0);
  sk.add('head', 'neck', 0, REST.headUp, 0);
  for (const s of ['R', 'L']) {
    const m = s === 'R' ? 1 : -1;
    sk.add('shoulder' + s, 'chest', m * REST.shoulderX * w, REST.shoulderUp, -0.01);
    sk.add('elbow' + s, 'shoulder' + s, 0, -REST.upperArm, 0);
    sk.add('hand' + s, 'elbow' + s, 0, -REST.foreArm, 0);
    sk.add('hip' + s, 'pelvis', m * REST.hipX * Math.max(0.9, w), -0.03, 0);
    sk.add('knee' + s, 'hip' + s, 0, -REST.thigh, 0);
    sk.add('foot' + s, 'knee' + s, 0, -REST.shin, 0);
  }
  sk.add('weaponR', 'handR', 0, -0.03, -0.02);
  sk.add('weaponL', 'handL', 0, -0.03, -0.02);
  sk.add('cape0', 'chest', 0, 0.13, 0.14 * w);
  sk.add('cape1', 'cape0', 0, -0.22, 0);
  sk.add('cape2', 'cape1', 0, -0.22, 0);
  return sk;
}

// ---------------------------------------------------------------------------
// Parts. A part is one geometry, one material, and one or more attachments
// (a joint plus a fixed offset). Symmetric limbs share a geometry across the
// two sides; asymmetric ones (pauldrons) get a mirrored copy, because a
// negative-scale offset would flip the winding and cull the faces.

const _off = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _eul = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();

function offsetMatrix(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  _pos.set(x, y, z);
  _eul.set(rx, ry, rz);
  _quat.setFromEuler(_eul);
  _scl.set(s, s, s);
  return new THREE.Matrix4().compose(_pos, _quat, _scl);
}

class PartList {
  constructor(sk) {
    this.sk = sk;
    this.parts = [];
  }
  // One geometry at one joint.
  one(geo, mat, joint, off = offsetMatrix()) {
    this.parts.push({ geo, mat, at: [{ joint: this.sk.get(joint), off }] });
    return this;
  }
  // The same geometry on both sides, offsets mirrored in x.
  pair(geo, mat, jointBase, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    this.parts.push({
      geo, mat, at: [
        { joint: this.sk.get(jointBase + 'R'), off: offsetMatrix(x, y, z, rx, ry, rz) },
        { joint: this.sk.get(jointBase + 'L'), off: offsetMatrix(-x, y, z, rx, -ry, -rz) },
      ],
    });
    return this;
  }
  // An asymmetric part: the right geometry and its mirror as two parts.
  mirrored(geoR, mat, jointBase, x = 0, y = 0, z = 0) {
    this.one(geoR, mat, jointBase + 'R', offsetMatrix(x, y, z));
    this.one(mirrorX(geoR.clone()), mat, jointBase + 'L', offsetMatrix(-x, y, z));
    return this;
  }
}

// ---------------------------------------------------------------------------
// Weapons, built in GRIP space: the hand is at the origin and the business
// end runs up +y. The pose turns the hand so a sword points where a sword
// should. Each returns a list of { geo, mat } to attach to the weapon joint.

function swordGeo(mats, big = 1) {
  const gripLen = 0.26 * big;
  const grip = cone(0.028, 0.032, gripLen, 6);
  const pommel = shift(slab(0.05, 0.05, 0.03, 0.03, -0.04, 0.0), 0, -gripLen / 2, 0);
  const guard = shift(slab(0.32 * big, 0.06, 0.26 * big, 0.08, -0.03, 0.03), 0, gripLen / 2 + 0.02, 0);
  const bladeLen = 1.15 * big;
  const y0 = gripLen / 2 + 0.05;
  // A blade is a slab that narrows to a ridge, so the edge catches light.
  const blade = merge([
    slab(0.13 * big, 0.012, 0.17 * big, 0.04, y0, y0 + bladeLen * 0.82),
    slab(0.01, 0.01, 0.13 * big, 0.012, y0 + bladeLen * 0.82, y0 + bladeLen),
  ]);
  const fuller = slab(0.035 * big, 0.046, 0.045 * big, 0.046, y0 + 0.04, y0 + bladeLen * 0.74);
  return [
    { geo: merge([grip]), mat: mats.dark },
    { geo: merge([pommel, guard]), mat: mats.gold },
    { geo: blade, mat: mats.trim },
    { geo: fuller, mat: mats.energy },
  ];
}

function knifeGeo(mats) {
  const grip = cone(0.022, 0.026, 0.2, 6);
  const guard = shift(slab(0.16, 0.05, 0.12, 0.06, -0.02, 0.02), 0, 0.11, 0);
  const blade = merge([
    slab(0.07, 0.01, 0.10, 0.03, 0.14, 0.62),
    slab(0.01, 0.01, 0.07, 0.01, 0.62, 0.78),
  ]);
  const edge = slab(0.02, 0.035, 0.03, 0.035, 0.17, 0.58);
  return [
    { geo: grip, mat: mats.dark },
    { geo: guard, mat: mats.gold },
    { geo: blade, mat: mats.trim },
    { geo: edge, mat: mats.energy },
  ];
}

function spearGeo(mats) {
  const shaft = shift(cone(0.024, 0.028, 1.7, 6), 0, 0.35, 0);
  const head = merge([
    shift(wedge(0.09, 0.05, 0, 0.34), 0, 1.2, 0),
    shift(slab(0.05, 0.05, 0.07, 0.07, -0.03, 0.03), 0, 1.18, 0),
  ]);
  const band = slab(0.04, 0.04, 0.04, 0.04, 0.9, 1.0);
  return [
    { geo: shaft, mat: mats.dark },
    { geo: head, mat: mats.trim },
    { geo: band, mat: mats.energy },
  ];
}

function rifleGeo(mats) {
  // Barrel up +y; the stock hangs back toward -y and the grip is the origin.
  const stock = merge([
    shift(slab(0.08, 0.13, 0.07, 0.11, -0.42, -0.08), 0, 0, -0.02),
    shift(slab(0.06, 0.16, 0.06, 0.14, -0.10, 0.0), 0, 0, 0.0),
  ]);
  const body = merge([
    shift(slab(0.09, 0.11, 0.10, 0.12, 0.0, 0.55), 0, 0, 0.0),
    shift(slab(0.05, 0.05, 0.05, 0.05, 0.25, 0.55), 0, 0, 0.12),   // scope
  ]);
  const barrel = shift(cone(0.024, 0.03, 0.9, 6), 0, 0.98, 0);
  const glow = slab(0.03, 0.03, 0.03, 0.03, 1.30, 1.42);
  return [
    { geo: stock, mat: mats.dark },
    { geo: body, mat: mats.body },
    { geo: barrel, mat: mats.trim },
    { geo: glow, mat: mats.energy },
  ];
}

function mortarGeo(mats) {
  const tube = shift(cone(0.15, 0.13, 0.8, 8), 0, 0.5, 0);
  const mouth = shift(cone(0.17, 0.15, 0.08, 8), 0, 0.92, 0);
  const grip = merge([
    shift(cone(0.03, 0.035, 0.22, 6), 0, 0, 0),
    shift(slab(0.06, 0.08, 0.06, 0.08, 0.1, 0.16), 0, 0, 0),
  ]);
  const shell = shift(cone(0.05, 0.07, 0.16, 6), 0, 0.95, 0);
  return [
    { geo: tube, mat: mats.dark },
    { geo: mouth, mat: mats.trim },
    { geo: grip, mat: mats.dark },
    { geo: shell, mat: mats.gold },
  ];
}

function staffGeo(mats) {
  const shaft = shift(cone(0.024, 0.03, 1.5, 6), 0, 0.35, 0);
  const fork = merge([
    shift(spin(cone(0.02, 0.02, 0.36, 5), 0, 0, 0.55), -0.13, 1.22, 0),
    shift(spin(cone(0.02, 0.02, 0.36, 5), 0, 0, -0.55), 0.13, 1.22, 0),
    shift(slab(0.1, 0.06, 0.08, 0.05, -0.03, 0.03), 0, 1.08, 0),
  ]);
  const core = shift(grow(cone(0.001, 0.11, 0.14, 4), 1, 1, 1), 0, 1.30, 0);
  const core2 = shift(spin(cone(0.001, 0.11, 0.14, 4), Math.PI, 0, 0), 0, 1.30, 0);
  return [
    { geo: shaft, mat: mats.dark },
    { geo: fork, mat: mats.trim },
    { geo: merge([core, core2]), mat: mats.energy },
  ];
}

// ---------------------------------------------------------------------------
// The six builds. Each returns { skeleton, parts, spec }.

export const ARCHETYPES = {
  warden: { w: 0.92, helmet: 'cap', crest: null, cape: false, weapon: 'spear', twoHand: true, pauldron: 'small' },
  commander: { w: 1.18, helmet: 'great', crest: 'plume', cape: true, weapon: 'sword', twoHand: false, pauldron: 'heavy' },
  duelist: { w: 0.82, helmet: 'hood', crest: 'fin', cape: false, weapon: 'twin', twoHand: false, pauldron: 'small' },
  marksman: { w: 0.90, helmet: 'visor', crest: 'antenna', cape: 'half', weapon: 'rifle', twoHand: true, pauldron: 'small' },
  bombardier: { w: 1.30, helmet: 'dome', crest: 'stub', cape: true, weapon: 'mortar', twoHand: true, pauldron: 'heavy' },
  oracle: { w: 0.88, helmet: 'crown', crest: 'gem', cape: true, weapon: 'staff', twoHand: true, pauldron: 'small' },
};

export function buildSoldier(key, mats) {
  const spec = ARCHETYPES[key];
  const w = spec.w;
  const sk = buildSkeleton(w);
  const P = new PartList(sk);

  // Torso. Three stacked slabs read as hips, waist and a chest that tapers
  // out to the shoulders: the silhouette has a waist, which boxes never did.
  P.one(slab(0.30 * w, 0.22, 0.34 * w, 0.26, -0.11, 0.05), mats.body, 'pelvis');
  P.one(slab(0.05 * w, 0.03, 0.06 * w, 0.03, -0.09, -0.02), mats.gold, 'pelvis', offsetMatrix(0, 0, -0.135));
  P.one(slab(0.36 * w, 0.24, 0.30 * w, 0.22, -0.01, 0.13), mats.body, 'spine');
  P.one(merge([
    slab(0.46 * w, 0.28, 0.38 * w, 0.26, -0.05, 0.19),
    // A collar ring above the chest, and a keel down the front.
    slab(0.26 * w, 0.18, 0.32 * w, 0.22, 0.19, 0.24),
  ]), mats.body, 'chest');
  P.one(slab(0.10 * w, 0.02, 0.14 * w, 0.02, 0.0, 0.16), mats.trim, 'chest', offsetMatrix(0, 0, -0.14));
  P.one(slab(0.04, 0.02, 0.06, 0.02, 0.04, 0.10), mats.energy, 'chest', offsetMatrix(0, 0, -0.155));

  // Pauldrons: the strongest "officer" read at this scale. Heavy ones are a
  // domed slab that overhangs the shoulder; small ones a flat plate.
  if (spec.pauldron === 'heavy') {
    P.mirrored(merge([
      slab(0.16, 0.24, 0.26, 0.32, -0.12, 0.05),
      shift(slab(0.06, 0.20, 0.10, 0.24, 0.05, 0.09), 0.02, 0, 0),
    ]), mats.gold, 'shoulder', 0.05, 0.02, 0);
  } else {
    P.mirrored(slab(0.14, 0.20, 0.20, 0.26, -0.08, 0.03), mats.gold, 'shoulder', 0.04, 0.03, 0);
  }

  // Arms: upper arm on the shoulder, gauntlet on the elbow, fist on the hand.
  P.pair(slab(0.10, 0.11, 0.09, 0.10, -0.21, 0.0), mats.body, 'shoulder');
  P.pair(merge([
    slab(0.115, 0.125, 0.10, 0.11, -0.20, 0.0),
    slab(0.13, 0.14, 0.12, 0.13, -0.04, 0.0),   // the cuff
  ]), mats.trim, 'elbow');
  P.pair(slab(0.08, 0.09, 0.075, 0.085, -0.09, 0.0), mats.dark, 'hand');

  // Neck and head. The helmet changes per archetype; the visor slit glows so
  // the face reads from the board and the eye line is where first person is.
  P.one(cone(0.05, 0.06, 0.08, 6), mats.dark, 'neck', offsetMatrix(0, 0.03, 0));
  P.one(helmetGeo(spec.helmet), mats.body, 'head');
  P.one(slab(0.25, 0.27, 0.26, 0.27, 0.0, 0.035), mats.gold, 'head', offsetMatrix(0, 0.02, 0));
  P.one(slab(0.13, 0.02, 0.15, 0.02, -0.005, 0.02), mats.energy, 'head', offsetMatrix(0, 0.05, -0.135));
  if (spec.crest) P.one(crestGeo(spec.crest), mats.gold, 'head');

  // Legs: thigh on the hip, greave on the knee, boot on the foot.
  P.pair(slab(0.13, 0.14, 0.115, 0.125, -0.24, 0.02), mats.body, 'hip');
  P.pair(merge([
    slab(0.115, 0.125, 0.10, 0.12, -0.21, 0.0),
    shift(slab(0.06, 0.02, 0.09, 0.02, -0.19, -0.02), 0, 0, -0.065),   // shin plate
  ]), mats.trim, 'knee');
  P.pair(slab(0.11, 0.17, 0.12, 0.19, -0.02, 0.06), mats.dark, 'foot', 0, -0.03, -0.03);

  // Cape: three hanging links. A half cape hangs from one shoulder.
  if (spec.cape) {
    const cw = spec.cape === 'half' ? 0.24 : 0.42 * w;
    const cx = spec.cape === 'half' ? -0.10 * w : 0;
    P.one(slab(cw * 0.92, 0.03, cw, 0.03, -0.22, 0.0), mats.trim, 'cape0', offsetMatrix(cx, 0, 0));
    P.one(slab(cw * 0.96, 0.03, cw * 0.92, 0.03, -0.22, 0.0), mats.trim, 'cape1', offsetMatrix(cx, 0, 0));
    P.one(slab(cw, 0.03, cw * 0.96, 0.03, -0.22, 0.0), mats.trim, 'cape2', offsetMatrix(cx, 0, 0));
  }

  // The ground ring shows selection from the board; it never animates with the
  // body, so it hangs off a joint that never moves.
  P.one(ringGeo(0.34), mats.gold, 'ground');

  // Weapons. Twin blades put one in each hand; everything else is the right.
  const weapons = {
    sword: () => swordGeo(mats, 1.0),
    twin: () => knifeGeo(mats),
    spear: () => spearGeo(mats),
    rifle: () => rifleGeo(mats),
    mortar: () => mortarGeo(mats),
    staff: () => staffGeo(mats),
  };
  // Weapons are modelled with the business end up +y (grip space), then
  // turned to run along the hand's -z, its forward. A hanging arm therefore
  // holds a blade pointing ahead, and raising the arm raises the blade with
  // it; built along the forearm instead, a resting sword pointed at the
  // soldier's own elbow and hung behind the body point-down.
  const forward = (g) => spin(g, -Math.PI / 2, 0, 0);
  for (const piece of weapons[spec.weapon]()) P.one(forward(piece.geo), piece.mat, 'weaponR');
  if (spec.weapon === 'twin') for (const piece of knifeGeo(mats)) P.one(forward(piece.geo), piece.mat, 'weaponL');

  return { skeleton: sk, parts: P.parts, spec };
}

function helmetGeo(kind) {
  switch (kind) {
    case 'great':
      // A great helm: tall crown, flared cheek guards.
      return merge([
        slab(0.22, 0.24, 0.26, 0.27, -0.09, 0.15),
        shift(slab(0.30, 0.14, 0.26, 0.20, -0.13, -0.04), 0, 0, 0.02),
      ]);
    case 'hood':
      return merge([
        slab(0.16, 0.18, 0.25, 0.26, -0.08, 0.16),
        shift(wedge(0.20, 0.10, 0.0, 0.10), 0, 0.14, 0.06),
      ]);
    case 'visor':
      return merge([
        slab(0.23, 0.23, 0.24, 0.26, -0.08, 0.12),
        shift(slab(0.30, 0.06, 0.26, 0.10, 0.0, 0.03), 0, 0.07, -0.10),   // a brim
      ]);
    case 'dome':
      return merge([
        slab(0.14, 0.14, 0.27, 0.28, 0.06, 0.16),
        slab(0.27, 0.28, 0.25, 0.26, -0.09, 0.06),
      ]);
    case 'crown':
      return merge([
        slab(0.20, 0.22, 0.24, 0.25, -0.08, 0.13),
        shift(slab(0.26, 0.28, 0.20, 0.22, 0.0, 0.06), 0, 0.13, 0),
      ]);
    default:   // cap
      return slab(0.20, 0.22, 0.24, 0.25, -0.08, 0.11);
  }
}

function crestGeo(kind) {
  switch (kind) {
    case 'plume':
      return merge([
        shift(wedge(0.04, 0.30, 0.0, 0.26), 0, 0.15, 0.04),
        shift(slab(0.05, 0.08, 0.06, 0.10, 0.0, 0.04), 0, 0.14, 0),
      ]);
    case 'fin':
      return shift(wedge(0.03, 0.22, 0.0, 0.18), 0, 0.15, 0.02);
    case 'antenna':
      return merge([
        shift(cone(0.008, 0.02, 0.22, 5), 0.09, 0.22, 0.04),
        shift(slab(0.04, 0.04, 0.05, 0.05, 0.0, 0.03), 0.09, 0.32, 0.04),
      ]);
    case 'stub':
      return shift(slab(0.08, 0.08, 0.10, 0.10, 0.0, 0.08), 0, 0.15, 0);
    case 'gem':
      return merge([
        shift(cone(0.001, 0.07, 0.10, 4), 0, 0.27, 0),
        shift(spin(cone(0.001, 0.07, 0.10, 4), Math.PI, 0, 0), 0, 0.27, 0),
      ]);
    default:
      return slab(0.02, 0.02, 0.02, 0.02, 0, 0.02);
  }
}

function ringGeo(r) {
  const g = new THREE.TorusGeometry(r, 0.03, 5, 16);
  g.rotateX(Math.PI / 2);
  const n = g.toNonIndexed();
  g.dispose();
  n.computeVertexNormals();
  return n;
}

// ---------------------------------------------------------------------------
// Posing. One function, five layers, written in the order they stack:
// weapon hold, idle, gait, air, strike, hurt. Later layers add to earlier.
//
// `st` is the cosmetic state the renderer keeps per unit: gait phase, smoothed
// speed and strafe, landing timer. The sim fields read here are swingT,
// swingDur, swingSide, flashT, airT, hop, vertVel, beamOn, heat, aim pitch.

const SPEED_LEG = 0.78;     // hip amplitude at full stride, radians
const SPEED_ARM = 0.5;

// Where along the swing the blade connects, per kind. allies.js resolves the
// hit at the same fraction, so the number is here once and read there.
export const STRIKE_AT = { melee: 0.40, twin: 0.34, hitscan: 0.05, lob: 0.42, beam: 0 };

export function poseSoldier(sk, spec, a, st, t) {
  sk.reset();
  const J = sk.byName;
  const kind = a.type.strike?.kind || 'melee';
  const twin = spec.weapon === 'twin';
  const pitch = a.possessed && a.aimPitch ? a.aimPitch : 0;

  // ---- hold ---------------------------------------------------------------
  // How the weapon is carried when nothing else is happening. This is the
  // pose every other layer is added to, so it is also what a soldier reads
  // as from the board.
  hold(J, spec, kind, pitch, a);

  // ---- idle ---------------------------------------------------------------
  const ph = a.phase;
  const breath = Math.sin(t * 1.7 + ph);
  J.chest.rot.x += -(breath * 0.02);
  J.spine.pos.y += breath * 0.006;
  J.head.rot.y += -(Math.sin(t * 0.43 + ph) * 0.12);
  J.head.rot.x += -(Math.sin(t * 0.61 + ph * 2) * 0.04);
  J.pelvis.rot.z += Math.sin(t * 0.5 + ph) * 0.02;

  // ---- gait ---------------------------------------------------------------
  const mv = st.moveT;
  if (mv > 0.001) {
    const g = st.gaitT;
    const s = Math.sin(g), c = Math.cos(g);
    const legA = SPEED_LEG * mv * (st.sprint ? 1.15 : 1);
    // Legs. Positive x rotation carries a limb forward; the knee flexes most
    // while the leg swings through, and stays nearly straight in stance.
    J.hipR.rot.x += -(-legA * s);
    J.hipL.rot.x += -(legA * s);
    J.kneeR.rot.x += -((0.15 + 0.95 * Math.max(0, c)) * mv);
    J.kneeL.rot.x += -((0.15 + 0.95 * Math.max(0, -c)) * mv);
    J.footR.rot.x += -(0.25 * Math.max(0, -s) * mv);
    J.footL.rot.x += -(0.25 * Math.max(0, s) * mv);
    // Hips sway with the planted leg, the chest counter-rotates, the whole
    // body rises on every stance and leans into the run.
    J.pelvis.rot.z += s * 0.05 * mv;
    J.pelvis.rot.y += -(-s * 0.06 * mv);
    J.chest.rot.y += -(s * 0.10 * mv);
    J.pelvis.pos.y += -Math.abs(c) * 0.035 * mv + 0.01 * mv;
    J.spine.rot.x += -(0.10 * mv + (st.sprint ? 0.08 : 0));
    // Strafing leans the body into the direction of travel.
    J.pelvis.rot.z += -st.strafeT * 0.08;
    J.chest.rot.z += -st.strafeT * 0.05;
    // Arms counter-swing, damped on whichever hand holds the weapon.
    const armA = SPEED_ARM * mv;
    J.shoulderL.rot.x += -((twin ? 0.35 : 1) * armA * s);
    J.shoulderR.rot.x += -((spec.twoHand ? 0.15 : 0.4) * -armA * s);
    if (!spec.twoHand) J.elbowL.rot.x += -0.4 * mv * Math.max(0, s);
  }

  // ---- air ----------------------------------------------------------------
  if (a.airT > 0) {
    const rising = a.vertVel > 0;
    const k = rising ? Math.min(1, a.airT / 0.15) : 1;
    // Tuck on the way up, reach for the ground on the way down.
    const tuck = rising ? 0.9 * k : 0.45;
    J.hipR.rot.x += tuck * 0.7; J.hipL.rot.x += tuck * 0.9;
    J.kneeR.rot.x += -tuck * 1.3; J.kneeL.rot.x += -tuck * 1.5;
    J.spine.rot.x += -(rising ? -0.12 : 0.18);
    J.shoulderL.rot.z += -0.5 * k;
    if (!spec.twoHand) J.shoulderR.rot.z += 0.25 * k;
    J.cape0.rot.x += -(rising ? 0.6 : -0.3);
  } else if (st.landT > 0) {
    // Landing squash: knees take it, the chest folds, then it all recovers.
    const p = 1 - st.landT / 0.28;
    const sq = hump(p) * st.landHard;
    J.pelvis.pos.y += -0.14 * sq;
    J.hipR.rot.x += 0.55 * sq; J.hipL.rot.x += 0.55 * sq;
    J.kneeR.rot.x += -1.1 * sq; J.kneeL.rot.x += -1.1 * sq;
    J.spine.rot.x += -(0.35 * sq);
    J.shoulderL.rot.x += -(-0.3 * sq);
  }

  // ---- strike -------------------------------------------------------------
  const dur = a.swingDur || 0.55;
  const p = a.swingT > 0 ? 1 - a.swingT / dur : -1;
  if (p >= 0) {
    if (kind === 'melee' && twin) twinCut(J, p, a.swingSide || 1);
    else if (kind === 'melee' && spec.weapon === 'spear') thrust(J, p);
    else if (kind === 'melee') cleave(J, p, a.swingSide || 1);
    else if (kind === 'hitscan') recoil(J, p);
    else if (kind === 'lob') overhand(J, p);
  }
  if (kind === 'beam') brace(J, a, t);

  // ---- cape ---------------------------------------------------------------
  if (spec.cape) {
    const back = 0.15 + mv * 0.9 + (st.sprint ? 0.3 : 0);
    const flutter = Math.sin(t * 3.7 + ph) * 0.06 + Math.sin(st.gaitT * 2) * 0.08 * mv;
    J.cape0.rot.x += -(back * 0.5 + flutter);
    J.cape1.rot.x += -(back * 0.35 + flutter * 1.4);
    J.cape2.rot.x += -(back * 0.25 + flutter * 1.8);
    if (p >= 0 && kind === 'melee') J.cape1.rot.x += hump(p) * 0.5;
  }

  // ---- hurt ---------------------------------------------------------------
  if (a.flashT > 0) {
    const f = a.flashT / 0.1;
    J.chest.rot.x += -(-0.22 * f);
    J.head.rot.x += -(-0.25 * f);
    J.pelvis.pos.z += -(-0.04 * f);
  }
}

// The carry pose per weapon. Angles are radians on the joint's local axes:
// positive x brings a limb forward, positive z swings the RIGHT arm out.
function hold(J, spec, kind, pitch, a) {
  switch (spec.weapon) {
    // The weapon runs along the hand's -z, so the x rotations down the chain
    // (shoulder, elbow, hand) sum to where it points: 0 is straight ahead,
    // +pi/2 straight up.
    case 'sword':
      // Blade resting up over the right shoulder, left arm loose.
      J.shoulderR.rot.set(0.35, 0, 0.30);
      J.elbowR.rot.set(2.25, 0, 0);
      J.handR.rot.set(-0.35, 0, 0);
      J.shoulderL.rot.set(-0.1, 0, -0.18);
      J.elbowL.rot.set(0.35, 0, 0);
      break;
    case 'twin':
      // Both blades low and reversed, the way a knife fighter stands: the
      // blade lies back along the forearm.
      J.shoulderR.rot.set(0.3, 0, 0.35);
      J.elbowR.rot.set(1.2, 0, 0);
      J.handR.rot.set(1.55, 0, 0);
      J.shoulderL.rot.set(0.3, 0, -0.35);
      J.elbowL.rot.set(1.2, 0, 0);
      J.handL.rot.set(1.55, 0, 0);
      J.spine.rot.x = -0.12;
      break;
    case 'spear':
      // Spear upright at the side, both hands on it.
      J.shoulderR.rot.set(0.25, 0, 0.2);
      J.elbowR.rot.set(1.4, 0, 0);
      J.handR.rot.set(-0.08, 0, 0);
      J.shoulderL.rot.set(0.6, -0.2, -0.25);
      J.elbowL.rot.set(1.0, 0, 0);
      break;
    case 'rifle':
      // Shouldered: the barrel forward along the aim, the left hand under it.
      J.chest.rot.y = 0.35;
      J.shoulderR.rot.set(-(-1.35 - pitch * 0.8), 0.35, 0.35);
      J.elbowR.rot.set(1.15, 0, 0);
      J.handR.rot.set(-2.5, 0, 0);
      J.shoulderL.rot.set(-(-1.75 - pitch * 0.8), -0.5, -0.35);
      J.elbowL.rot.set(0.7, 0, 0);
      J.head.rot.y = 0.2;
      break;
    case 'mortar':
      // Tube braced on the hip, angled up, both hands on it.
      J.shoulderR.rot.set(-(-0.7 - pitch * 0.5), 0.2, 0.4);
      J.elbowR.rot.set(1.6, 0, 0);
      J.handR.rot.set(-1.5, 0, 0);
      J.shoulderL.rot.set(-(-1.2 - pitch * 0.5), -0.5, -0.4);
      J.elbowL.rot.set(0.9, 0, 0);
      J.spine.rot.x = 0.06;
      break;
    case 'staff':
      // Held forward in both hands, the core out front.
      J.shoulderR.rot.set(-(-1.1 - pitch * 0.7), 0.15, 0.25);
      J.elbowR.rot.set(0.6, 0, 0);
      J.handR.rot.set(-1.4, 0, 0);
      J.shoulderL.rot.set(-(-1.3 - pitch * 0.7), -0.4, -0.3);
      J.elbowL.rot.set(0.7, 0, 0);
      break;
  }
}

// The heavy cleave: the blade rises back over the shoulder, then sweeps down
// and across the body with the chest turning into it, overshoots, and
// recovers slowly. `side` mirrors the sweep so consecutive swings alternate.
function cleave(J, p, side) {
  const s = side;
  // Anticipation ends at 0.24, the snap runs to 0.46, the follow-through to
  // 0.60, and the rest is recovery. The strike frame is 0.40.
  const raise = keyed([[0, 0], [0.24, 1], [0.46, 0], [1, 0]], p);
  const sweep = keyed([[0, 0], [0.24, 0], [0.40, 1], [0.58, 1.25], [1, 0]], p);
  const twist = keyed([[0, 0], [0.24, -0.45], [0.42, 0.55], [0.6, 0.5], [1, 0]], p) * s;
  J.chest.rot.y += -(twist);
  J.pelvis.rot.y += -(twist * 0.5);
  J.spine.rot.x += -(sweep * 0.30 - raise * 0.12);
  J.head.rot.y += -(-twist * 0.5);
  // Arm: up and back, then down and across the front.
  J.shoulderR.rot.x += -(-2.4 * raise - 1.6 * sweep);
  J.shoulderR.rot.y += -((0.35 * raise - 1.15 * sweep) * s);
  J.shoulderR.rot.z += 0.6 * raise + 0.3 * sweep;
  J.elbowR.rot.x += -(1.5 * raise + 1.9 * sweep);
  J.handR.rot.x += -(-0.5 * raise + 0.5 * sweep);
  // The off hand braces and the weight shifts to the front foot.
  J.shoulderL.rot.x += -(-0.6 * sweep);
  J.shoulderL.rot.z += -0.5 * raise;
  J.hipR.rot.x += 0.25 * sweep; J.kneeR.rot.x += -0.45 * sweep;
  J.hipL.rot.x += -(0.2 * sweep);
}

// Two quick cuts, alternating hands: the striking arm snaps forward from the
// low guard and returns, the other hand guards.
function twinCut(J, p, side) {
  const R = side > 0;
  const sh = R ? J.shoulderR : J.shoulderL;
  const el = R ? J.elbowR : J.elbowL;
  const hd = R ? J.handR : J.handL;
  const m = R ? 1 : -1;
  const back = keyed([[0, 0], [0.16, 1], [0.34, 0], [1, 0]], p);
  const cut = keyed([[0, 0], [0.16, 0], [0.34, 1], [0.5, 0.8], [1, 0]], p);
  sh.rot.x += -(0.5 * back - 1.9 * cut);
  sh.rot.y += -((-0.5 * back + 0.9 * cut) * m);
  sh.rot.z += -0.2 * back * m + 0.15 * cut * m;
  el.rot.x += -(-0.3 * back + 1.1 * cut);
  hd.rot.x += -(0.9 * back + 1.5 * cut);
  J.chest.rot.y += -((0.35 * back - 0.55 * cut) * m);
  J.spine.rot.x += -(0.25 * cut);
  J.pelvis.pos.z += -(0.06 * cut);
}

// A spear thrust: pulled back to the hip, driven forward at full arm.
function thrust(J, p) {
  const back = keyed([[0, 0], [0.22, 1], [0.42, 0], [1, 0]], p);
  const drive = keyed([[0, 0], [0.22, 0], [0.42, 1], [0.6, 0.9], [1, 0]], p);
  J.shoulderR.rot.x += -(0.5 * back - 1.7 * drive);
  J.elbowR.rot.x += -(0.8 * back + 1.2 * drive);
  J.handR.rot.x += -(-0.3 * back - 1.5 * drive);
  J.shoulderL.rot.x += -(0.3 * back - 1.2 * drive);
  J.elbowL.rot.x += -(0.4 * back + 0.9 * drive);
  J.chest.rot.y += -(0.4 * back - 0.5 * drive);
  J.spine.rot.x += -(0.25 * drive);
  J.pelvis.pos.z += -(0.08 * drive);
}

// Rifle recoil: a short kick back into the shoulder, decaying fast.
function recoil(J, p) {
  const k = Math.exp(-p * 9);
  J.chest.rot.x += -(-0.12 * k);
  J.shoulderR.rot.x += -(0.25 * k);
  J.shoulderL.rot.x += -(0.2 * k);
  J.head.rot.x += -(-0.1 * k);
}

// Overhand lob: the tube swings back over the shoulder and pitches forward.
function overhand(J, p) {
  const back = keyed([[0, 0], [0.3, 1], [0.5, 0], [1, 0]], p);
  const fwd = keyed([[0, 0], [0.3, 0], [0.5, 1], [0.7, 0.7], [1, 0]], p);
  J.shoulderR.rot.x += -(-1.4 * back - 0.6 * fwd);
  J.shoulderL.rot.x += -(-1.2 * back - 0.5 * fwd);
  J.elbowR.rot.x += -(0.4 * back - 0.8 * fwd);
  J.spine.rot.x += -(-0.2 * back + 0.3 * fwd);
  J.chest.rot.x += -(-0.1 * back + 0.15 * fwd);
}

// Beam brace: the staff shakes while it channels and sags as heat builds.
function brace(J, a, t) {
  const on = a.beamOn ? 1 : 0;
  const heat = a.heat || 0;
  J.shoulderR.rot.x += -(Math.sin(t * 31) * 0.03 * on + heat * 0.25);
  J.shoulderL.rot.x += -(Math.sin(t * 27) * 0.03 * on + heat * 0.25);
  J.spine.rot.x += -(0.08 * on);
  J.chest.rot.x += -(-0.05 * on);
}

// The cosmetic per-unit state the renderer owns. Kept off the sim fields so
// a pooled body cannot inherit a stride from the last occupant.
export function freshSoldierState() {
  return { gaitT: 0, moveT: 0, strafeT: 0, landT: 0, landHard: 1, sprint: false, wasAir: false, lastVert: 0 };
}

// Advance the cosmetic state from what the body did this frame. `moved` is
// the arc the body covered in world units, `strafe` its lateral component.
export function advanceSoldierState(st, a, dt, moved, strafe, sprint) {
  const speed = moved / Math.max(dt, 1e-4);
  const full = a.type.speed * 1.25 * (sprint ? 1.45 : 1);
  const want = Math.min(1, speed / Math.max(full, 0.1));
  st.moveT += (want - st.moveT) * Math.min(1, dt * 12);
  st.strafeT += (strafe - st.strafeT) * Math.min(1, dt * 8);
  st.sprint = sprint;
  // Stride frequency follows the body's real speed so a slowed unit strides
  // slower, and the phase never runs while standing still.
  const hz = (a.type.strike?.strideHz || 2) * (sprint ? 1.25 : 1);
  st.gaitT += dt * hz * Math.PI * 2 * st.moveT;
  if (st.landT > 0) st.landT -= dt;
  if (st.wasAir && !(a.airT > 0)) {
    st.landT = 0.28;
    st.landHard = Math.min(1.4, 0.5 + Math.abs(st.lastVert) / 8);
  }
  st.wasAir = a.airT > 0;
  st.lastVert = a.vertVel || 0;
}
