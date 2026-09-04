import * as THREE from 'three';

// Procedural skeletons for the instanced creatures.
//
// Every body in this game is drawn with instanced meshes, one InstancedMesh per
// body part per species, so a field of ninety soldiers or two hundred mites is
// a few dozen draw calls. The first generation placed each part with a flat
// table of offsets and a hand-written sine per part, which is why a swing
// looked like an arm sliding forward and a walk looked like two boxes
// alternating. Nothing could bend, because nothing had a parent.
//
// A Skeleton is a list of joints in parent-first order. Each joint carries a
// rest position in its parent's space, a live rotation, and a world matrix
// composed from its parent's. A part is attached to a joint with a fixed
// offset, so rotating a shoulder carries the upper arm, the forearm, the hand
// and the weapon with it, and a knee bends the shin under the thigh. That is
// the whole trick: hierarchy, not more sine waves.
//
// Nothing here allocates per frame. Joints are created once per species at
// boot; posing writes into vectors and eulers that already exist.

const _q = new THREE.Quaternion();

export class Joint {
  constructor(name, parent, x, y, z) {
    this.name = name;
    this.parent = parent;
    this.rest = new THREE.Vector3(x, y, z);
    this.pos = new THREE.Vector3(x, y, z);
    // XYZ order reads naturally for limbs: pitch first, then the roll that
    // splays a leg or shoulder out from the body, then any twist.
    this.rot = new THREE.Euler(0, 0, 0, 'XYZ');
    this.scale = new THREE.Vector3(1, 1, 1);
    this.local = new THREE.Matrix4();
    this.world = new THREE.Matrix4();
  }
}

export class Skeleton {
  constructor() {
    this.joints = [];
    this.byName = Object.create(null);
  }

  // Add a joint under `parentName` (null for the root) at a rest offset in the
  // parent's space. Parents must be added before children, which is also the
  // order compute() relies on.
  add(name, parentName, x = 0, y = 0, z = 0) {
    const parent = parentName ? this.byName[parentName] : null;
    if (parentName && !parent) throw new Error(`rig: no joint named ${parentName}`);
    const j = new Joint(name, parent, x, y, z);
    this.joints.push(j);
    this.byName[name] = j;
    return j;
  }

  get(name) {
    const j = this.byName[name];
    if (!j) throw new Error(`rig: no joint named ${name}`);
    return j;
  }

  // Back to the rest pose. Called at the top of every pose so an animation
  // only has to write the joints it moves.
  reset() {
    for (const j of this.joints) {
      j.pos.copy(j.rest);
      j.rot.set(0, 0, 0);
      j.scale.set(1, 1, 1);
    }
  }

  // Compose every world matrix under `frame`, the body's own world transform.
  // One pass, because parents precede children in the list.
  compute(frame) {
    const js = this.joints;
    for (let i = 0; i < js.length; i++) {
      const j = js[i];
      _q.setFromEuler(j.rot);
      j.local.compose(j.pos, _q, j.scale);
      if (j.parent) j.world.multiplyMatrices(j.parent.world, j.local);
      else j.world.multiplyMatrices(frame, j.local);
    }
  }
}

// ---------------------------------------------------------------------------
// Low-poly geometry helpers. Flat-shaded materials take their normal from the
// face, so every helper returns NON-INDEXED geometry: shared vertices would
// smooth the very facets the art direction depends on. Each returns a fresh
// BufferGeometry that the caller owns.

// A square frustum: bottom face at y0 with width wb and depth db, top face at
// y1 with width wt and depth dt, centred on x and z. Eight vertices, twelve
// triangles. This is the workhorse for limbs, torsos and helmets: a box that
// tapers reads as carved, a box that does not reads as a crate.
export function slab(wt, dt, wb, db, y0, y1) {
  const hx1 = wt / 2, hz1 = dt / 2, hx0 = wb / 2, hz0 = db / 2;
  // Corners: bottom ring then top ring, counter-clockwise seen from above.
  const b = [
    [-hx0, y0, -hz0], [hx0, y0, -hz0], [hx0, y0, hz0], [-hx0, y0, hz0],
  ];
  const t = [
    [-hx1, y1, -hz1], [hx1, y1, -hz1], [hx1, y1, hz1], [-hx1, y1, hz1],
  ];
  const tri = [];
  // Counter-clockwise seen from OUTSIDE each face, which is what Three culls
  // against. The first cut of this wound every face the other way: the near
  // faces of every limb and blade were culled and the far walls drew in their
  // place, so a soldier read as hollow, "seeing through the solid block", and
  // the first-person gauntlet showed as a stray rectangle. Verified by
  // crossing each triangle's edges and checking the normal points away from
  // the centroid: 12 of 12 outward.
  const quad = (a, bb, c, d) => { tri.push(a, c, bb, a, d, c); };
  quad(b[0], b[1], t[1], t[0]);   // -z
  quad(b[1], b[2], t[2], t[1]);   // +x
  quad(b[2], b[3], t[3], t[2]);   // +z
  quad(b[3], b[0], t[0], t[3]);   // -x
  quad(t[0], t[1], t[2], t[3]);   // top
  quad(b[3], b[2], b[1], b[0]);   // bottom
  const pos = new Float32Array(tri.length * 3);
  for (let i = 0; i < tri.length; i++) {
    pos[i * 3] = tri[i][0]; pos[i * 3 + 1] = tri[i][1]; pos[i * 3 + 2] = tri[i][2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// A plain box, non-indexed, centred at the origin.
export function box(w, h, d) {
  return slab(w, d, w, d, -h / 2, h / 2);
}

// A wedge: a slab whose top edge has collapsed to a ridge along x. Good for
// blades, brows, fins and armour edges.
export function wedge(w, d, y0, y1, ridgeW = 0.02) {
  return slab(w, ridgeW, w, d, y0, y1);
}

// A tapered cylinder, non-indexed. `seg` low (5 to 8) keeps it faceted.
export function cone(rt, rb, h, seg = 6) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, false);
  const n = g.toNonIndexed();
  g.dispose();
  n.computeVertexNormals();
  return n;
}

// Move and turn a geometry in place, and return it, so a part can be built as
// `shift(spin(slab(...), 0, 0.3, 0), 0, -0.2, 0)` in one expression.
export function shift(g, x, y, z) { g.translate(x, y, z); return g; }
export function spin(g, rx, ry, rz) {
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  return g;
}
export function grow(g, sx, sy = sx, sz = sx) { g.scale(sx, sy, sz); return g; }

// Weld several geometries into one. Each input is consumed. Non-indexed in,
// non-indexed out, so the facets survive; normals are recomputed flat.
export function merge(geos) {
  let total = 0;
  const parts = [];
  for (const g of geos) {
    const n = g.index ? g.toNonIndexed() : g;
    if (n !== g) g.dispose();
    parts.push(n);
    total += n.attributes.position.count;
  }
  const pos = new Float32Array(total * 3);
  let at = 0;
  for (const n of parts) {
    pos.set(n.attributes.position.array, at);
    at += n.attributes.position.array.length;
    n.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

// Mirror a geometry across the YZ plane, for the left copy of a right-side
// part. Winding is flipped back so the faces still point outward.
export function mirrorX(g) {
  const src = g.index ? g.toNonIndexed() : g;
  const a = src.attributes.position.array;
  const pos = new Float32Array(a.length);
  for (let i = 0; i < a.length; i += 9) {
    // Reverse each triangle's vertex order while negating x.
    for (let v = 0; v < 3; v++) {
      const from = i + (2 - v) * 3;
      const to = i + v * 3;
      pos[to] = -a[from]; pos[to + 1] = a[from + 1]; pos[to + 2] = a[from + 2];
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.computeVertexNormals();
  if (src !== g) src.dispose();
  return out;
}

// ---------------------------------------------------------------------------
// Animation curves. All take a phase in 0..1 and return 0..1 or -1..1.

// Ease-out cubic: fast start, soft landing.
export const easeOut = (p) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
// Ease-in cubic: slow start, fast finish. Anticipation uses this.
export const easeIn = (p) => Math.pow(Math.min(1, Math.max(0, p)), 3);
// Smoothstep.
export const smooth = (p) => { const t = Math.min(1, Math.max(0, p)); return t * t * (3 - 2 * t); };
// A single hump, 0 at both ends and 1 in the middle.
export const hump = (p) => Math.sin(Math.PI * Math.min(1, Math.max(0, p)));

// Piecewise linear over keyframes [[t, v], ...] sorted by t. Used for the
// strike arcs, where a single sine cannot give an anticipation, a snap and a
// slow recovery different speeds.
export function keyed(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      const u = (t - t0) / Math.max(1e-6, t1 - t0);
      return v0 + (v1 - v0) * smooth(u);
    }
  }
  return keys[keys.length - 1][1];
}
