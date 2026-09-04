import * as THREE from 'three';
import { PALETTE } from './config.js';
import { slab, cone, merge, shift, spin, keyed, hump } from './rig.js';

// The thing in your hands.
//
// First person had nothing drawn in front of the camera at all: no weapon, no
// arm, no swing. You could not tell a Bulwark from a Longsight from the inside,
// and a strike was a number appearing in the world with no gesture attached.
//
// It renders in its OWN scene with its OWN camera, composited after the world
// with the depth buffer cleared. That is what keeps a weapon held half a metre
// from the eye out of the terrain: no near-plane tuning on the shared camera
// can make a world-space object at that distance safe on a slope, because the
// ground can always be closer than the weapon. A separate pass sidesteps the
// question entirely, which is also how most first-person games do it.
//
// The second version of this file is the answer to "the sword swing looks
// terrible". The first swing was Minecraft's nudge: the prop dipped down and
// right and came back, sized at 15% and parked in the corner, with no arm
// holding it. Now the weapon is held by a gauntleted arm, sits large and
// diagonal across the lower right of the frame, and a melee swing has an
// anticipation over the shoulder, a snap across the whole screen, an
// overshoot and a slow recovery, alternating direction, with a light trail
// off the blade. The strike frame of the swing (js/soldier.js STRIKE_AT) is
// where the blade crosses the centre of the screen, and it is also the frame
// the damage lands on.
//
// The models are built from primitives, like everything else in this project -
// there are no imported art assets anywhere in the codebase.

const MAT = {
  steel: new THREE.MeshStandardMaterial({ color: 0xcdd8e6, roughness: 0.4, metalness: 0.5, flatShading: true }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.8, metalness: 0.15, flatShading: true }),
  grip: new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 0.9, metalness: 0.05, flatShading: true }),
  body: new THREE.MeshStandardMaterial({
    color: PALETTE.techBody, roughness: 0.55, metalness: 0.25, flatShading: true,
    emissive: PALETTE.energy, emissiveIntensity: 0.08,
  }),
  energy: new THREE.MeshStandardMaterial({
    color: PALETTE.energy, emissive: PALETTE.energy, emissiveIntensity: 1.5,
    roughness: 0.3, metalness: 0.2, flatShading: true,
  }),
  gold: new THREE.MeshStandardMaterial({
    color: 0xffc857, emissive: 0xffc857, emissiveIntensity: 0.5,
    roughness: 0.35, metalness: 0.8, flatShading: true,
  }),
};

// How far the weapon sits from the eye, per archetype. A Bulwark's slab needs
// more room than a Twinfang's knives.
const GRIP = {
  warden: 0.62, commander: 0.70, duelist: 0.56,
  marksman: 0.62, bombardier: 0.68, oracle: 0.60,
};

// Rest pose in camera space: right, up, forward, and the tilt that lays a
// blade diagonally across the frame instead of pointing it at the horizon,
// where it foreshortened to a stub.
const REST = { x: 0.34, y: -0.30, z: 0.78, rx: 0.55, ry: -0.42, rz: 0.10 };
// Ranged weapons point down the aim, so they sit lower and straighter.
const REST_RANGED = { x: 0.26, y: -0.27, z: 0.72, rx: 0.06, ry: -0.06, rz: 0.02 };

// Everything is modelled at world scale - a sword really is 1.4 units long -
// and a world-scale weapon held half a metre from the eye fills the screen. The
// overlay is drawn at a fraction of that, which is the same trick a real view
// model uses: it is a prop sized for the frame, not the world.
const VM_SCALE = 0.19;

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _lq = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();
const _base = new THREE.Vector3();
const _tip = new THREE.Vector3();

function mesh(geo, mat) { return new THREE.Mesh(geo, mat); }

// The right arm that holds the grip: a forearm running back and down toward
// the viewer's shoulder, a gauntlet cuff, and a fist around the grip. Built
// once per weapon so the hand sits on the actual grip.
function arm(g, side = 1, ex = 0, ey = 0, ez = 0) {
  const a = new THREE.Group();
  const fist = mesh(slab(0.11, 0.12, 0.10, 0.11, -0.07, 0.07), MAT.dark);
  const cuff = mesh(slab(0.15, 0.16, 0.13, 0.14, -0.06, 0.06), MAT.steel);
  cuff.position.set(0.02 * side, -0.05, 0.14);
  const fore = mesh(slab(0.12, 0.13, 0.16, 0.17, -0.02, 0.62), MAT.steel);
  const under = mesh(slab(0.11, 0.12, 0.13, 0.14, 0.60, 0.95), MAT.body);
  // The forearm leans back toward the shoulder: rotate so its +y runs to
  // camera-right (for the right arm), down and toward the viewer.
  const forearm = new THREE.Group();
  forearm.add(fore, under);
  forearm.rotation.set(-1.15, 0, -0.55 * side);
  forearm.position.set(0.03 * side, -0.06, 0.10);
  a.add(fist, cuff, forearm);
  a.position.set(ex, ey, ez);
  return a;
}

// Each builder returns a group whose origin is the grip, oriented so -Z points
// away from the viewer down the aim.
const BUILD = {
  // A spear: shaft with a leaf head, both hands on it.
  warden() {
    const g = new THREE.Group();
    const shaft = mesh(cone(0.032, 0.034, 1.7, 6), MAT.grip);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -0.5;
    const head = mesh(merge([
      shift(slab(0.09, 0.015, 0.12, 0.04, 0, 0.36), 0, 0, 0),
      shift(slab(0.06, 0.06, 0.07, 0.07, -0.05, 0), 0, 0, 0),
    ]), MAT.steel);
    head.rotation.x = -Math.PI / 2;
    head.position.z = -1.35;
    const band = mesh(slab(0.045, 0.045, 0.045, 0.045, 0, 0.1), MAT.energy);
    band.rotation.x = -Math.PI / 2;
    band.position.z = -1.05;
    g.add(shaft, head, band, arm(g, 1), arm(g, -1, -0.02, 0.04, -0.55));
    g.userData.blade = [0, 0, -1.0, 0, 0, -1.7];
    return g;
  },
  // A slab of a sword, wide enough to read as heavy at the edge of the screen.
  commander() {
    const g = new THREE.Group();
    const grip = mesh(cone(0.03, 0.036, 0.28, 6), MAT.grip);
    grip.rotation.x = Math.PI / 2;
    const pommel = mesh(slab(0.06, 0.06, 0.04, 0.04, 0, 0.05), MAT.gold);
    pommel.rotation.x = Math.PI / 2;
    pommel.position.z = 0.16;
    const guard = mesh(slab(0.36, 0.06, 0.30, 0.09, -0.03, 0.03), MAT.gold);
    guard.rotation.x = Math.PI / 2;
    guard.position.z = -0.17;
    const blade = mesh(merge([
      slab(0.15, 0.014, 0.19, 0.045, 0, 1.0),
      slab(0.01, 0.01, 0.15, 0.014, 1.0, 1.22),
    ]), MAT.steel);
    blade.rotation.x = -Math.PI / 2;
    blade.position.z = -0.2;
    const fuller = mesh(slab(0.04, 0.05, 0.05, 0.05, 0.05, 0.9), MAT.energy);
    fuller.rotation.x = -Math.PI / 2;
    fuller.position.z = -0.2;
    g.add(grip, pommel, guard, blade, fuller, arm(g, 1));
    g.userData.blade = [0, 0, -0.25, 0, 0, -1.42];
    return g;
  },
  // Two short blades, one in each hand, held low and reversed.
  duelist() {
    const g = new THREE.Group();
    for (const [side, tilt] of [[1, 0.10], [-1, -0.14]]) {
      const b = new THREE.Group();
      const grip = mesh(cone(0.024, 0.028, 0.22, 6), MAT.grip);
      grip.rotation.x = Math.PI / 2;
      const guard = mesh(slab(0.18, 0.05, 0.14, 0.06, -0.02, 0.02), MAT.gold);
      guard.rotation.x = Math.PI / 2;
      guard.position.z = -0.13;
      const blade = mesh(merge([
        slab(0.08, 0.012, 0.11, 0.03, 0, 0.62),
        slab(0.01, 0.01, 0.08, 0.012, 0.62, 0.8),
      ]), MAT.steel);
      blade.rotation.x = -Math.PI / 2;
      blade.position.z = -0.15;
      const edge = mesh(slab(0.025, 0.035, 0.03, 0.035, 0.03, 0.56), MAT.energy);
      edge.rotation.x = -Math.PI / 2;
      edge.position.z = -0.15;
      b.add(grip, guard, blade, edge, arm(b, side));
      b.position.set(side * 0.30, side > 0 ? 0 : -0.02, side > 0 ? 0 : 0.05);
      b.rotation.z = tilt;
      b.rotation.y = -side * 0.35;
      b.name = side > 0 ? 'right' : 'left';
      g.add(b);
    }
    g.userData.blade = [0.3, 0, -0.2, 0.3, 0, -0.95];
    return g;
  },
  // A long rifle with a scope and a muzzle the recoil pivots around.
  marksman() {
    const g = new THREE.Group();
    const stock = mesh(slab(0.11, 0.15, 0.09, 0.12, -0.5, -0.05), MAT.grip);
    stock.rotation.x = -Math.PI / 2;
    stock.position.set(0, -0.02, 0.0);
    const body = mesh(merge([
      slab(0.10, 0.12, 0.11, 0.13, 0, 0.75),
      shift(slab(0.05, 0.05, 0.05, 0.05, 0.3, 0.6), 0, 0.12, 0),
    ]), MAT.dark);
    body.rotation.x = -Math.PI / 2;
    body.position.z = -0.05;
    const barrel = mesh(cone(0.026, 0.032, 0.95, 6), MAT.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -1.2;
    const glow = mesh(slab(0.035, 0.035, 0.035, 0.035, 0, 0.12), MAT.energy);
    glow.rotation.x = -Math.PI / 2;
    glow.position.z = -1.62;
    g.add(stock, body, barrel, glow, arm(g, 1, 0, -0.06, 0.05), arm(g, -1, -0.04, -0.02, -0.55));
    g.userData.blade = null;
    return g;
  },
  // A stubby mortar tube, held across the body.
  bombardier() {
    const g = new THREE.Group();
    const tube = mesh(cone(0.15, 0.13, 0.8, 8), MAT.dark);
    tube.rotation.x = Math.PI / 2.4;
    tube.position.z = -0.5;
    const mouth = mesh(cone(0.17, 0.15, 0.09, 8), MAT.steel);
    mouth.position.set(0, 0.27, -0.82);
    mouth.rotation.x = Math.PI / 2.4;
    const shell = mesh(cone(0.05, 0.08, 0.18, 6), MAT.gold);
    shell.position.set(-0.2, -0.06, -0.2);
    shell.rotation.x = 0.4;
    g.add(tube, mouth, shell, arm(g, 1, 0.02, -0.14, -0.2), arm(g, -1, -0.28, 0.1, -0.7));
    g.userData.blade = null;
    return g;
  },
  // A focusing lens on a fork, with a core that brightens as the beam ramps.
  oracle() {
    const g = new THREE.Group();
    const handle = mesh(cone(0.03, 0.034, 0.9, 6), MAT.grip);
    handle.rotation.x = Math.PI / 2;
    handle.position.z = -0.25;
    const fork = mesh(merge([
      shift(spin(cone(0.02, 0.02, 0.36, 5), 0, 0, 0.55), -0.13, 0.2, 0),
      shift(spin(cone(0.02, 0.02, 0.36, 5), 0, 0, -0.55), 0.13, 0.2, 0),
      shift(slab(0.1, 0.06, 0.08, 0.05, -0.03, 0.03), 0, 0.06, 0),
    ]), MAT.steel);
    fork.rotation.x = -Math.PI / 2;
    fork.position.z = -0.72;
    const core = mesh(merge([
      cone(0.001, 0.11, 0.14, 4),
      spin(cone(0.001, 0.11, 0.14, 4), Math.PI, 0, 0),
    ]), MAT.energy);
    core.position.z = -0.98;
    g.add(handle, fork, core, arm(g, 1), arm(g, -1, -0.04, 0.02, -0.5));
    g.userData.core = core;
    g.userData.blade = null;
    return g;
  },
};

// ---------------------------------------------------------------------------
// The blade trail: a ribbon through the last N positions of the blade, base to
// tip, fading along its length. Additive and unlit, so it reads as light off
// the edge. Used in the view-model scene for first person and in the world for
// third person; the geometry is the same, only the scene differs.

export class BladeTrail {
  constructor(scene, samples = 16, life = 1.0) {
    this.n = samples;
    this.life = life;
    this.count = 0;
    this.head = 0;
    this.bases = new Float32Array(samples * 3);
    this.tips = new Float32Array(samples * 3);
    this.ages = new Float32Array(samples);
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(samples * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.fade = new THREE.BufferAttribute(new Float32Array(samples * 2), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pos);
    geo.setAttribute('aFade', this.fade);
    const idx = [];
    for (let i = 0; i < samples - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(PALETTE.energy) }, uAlpha: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aFade;
        varying float vFade;
        void main() {
          vFade = aFade;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uAlpha;
        varying float vFade;
        void main() {
          float a = vFade * vFade * uAlpha;
          gl_FragColor = vec4(uColor * (0.6 + 1.6 * vFade), a);
        }
      `,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 12;
    scene.add(this.mesh);
  }

  clear() {
    this.count = 0;
    this.head = 0;
    this.mesh.visible = false;
  }

  push(base, tip) {
    const i = this.head;
    this.bases[i * 3] = base.x; this.bases[i * 3 + 1] = base.y; this.bases[i * 3 + 2] = base.z;
    this.tips[i * 3] = tip.x; this.tips[i * 3 + 1] = tip.y; this.tips[i * 3 + 2] = tip.z;
    this.ages[i] = 0;
    this.head = (i + 1) % this.n;
    if (this.count < this.n) this.count++;
  }

  // `live` keeps the newest sample bright; when the sweep ends the whole
  // ribbon fades out over `life` and hides itself.
  update(dt, live) {
    if (this.count === 0) return;
    let visible = 0;
    for (let i = 0; i < this.n; i++) this.ages[i] += dt;
    // Oldest to newest, so the ribbon's fade runs along its length.
    const oldest = (this.head - this.count + this.n) % this.n;
    for (let k = 0; k < this.count; k++) {
      const i = (oldest + k) % this.n;
      const age = this.ages[i];
      const f = Math.max(0, 1 - age / (this.life * 0.35)) * (k + 1) / this.count;
      if (f > 0.01) visible++;
      this.pos.setXYZ(k * 2, this.bases[i * 3], this.bases[i * 3 + 1], this.bases[i * 3 + 2]);
      this.pos.setXYZ(k * 2 + 1, this.tips[i * 3], this.tips[i * 3 + 1], this.tips[i * 3 + 2]);
      this.fade.setX(k * 2, f * 0.35);
      this.fade.setX(k * 2 + 1, f);
    }
    this.mesh.geometry.setDrawRange(0, Math.max(0, (this.count - 1) * 6));
    this.pos.needsUpdate = true;
    this.fade.needsUpdate = true;
    this.mesh.visible = visible > 1;
    if (!live && visible <= 1) this.clear();
  }
}

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 12);
    this.scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x3d6b52, 0.55));
    const key = new THREE.DirectionalLight(PALETTE.sunlight, 2.3);
    key.position.set(0.5, 1, 0.6);
    const rim = new THREE.DirectionalLight(0x3f6bff, 0.9);
    rim.position.set(-0.7, 0.2, -0.5);
    this.scene.add(key, rim);
    this.models = new Map();
    this.current = null;
    this.visible = false;
    this.t = 0;
    this._sway = new THREE.Vector2();
    this._lastSide = 1;
    this.trail = new BladeTrail(this.scene, 14, 0.5);
  }

  // Built lazily, so a run only pays for the archetypes it actually holds.
  _model(typeKey) {
    if (!this.models.has(typeKey)) {
      const build = BUILD[typeKey] || BUILD.warden;
      const g = build();
      g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
      g.scale.setScalar(VM_SCALE);
      g.visible = false;
      this.scene.add(g);
      this.models.set(typeKey, g);
    }
    return this.models.get(typeKey);
  }

  show(typeKey) {
    if (this.current) this.current.visible = false;
    this.current = this._model(typeKey);
    this.current.visible = true;
    this.grip = GRIP[typeKey] ?? 0.6;
    this.visible = true;
    this.trail.clear();
  }

  hide() {
    if (this.current) this.current.visible = false;
    this.visible = false;
    this.trail.clear();
  }

  // The melee arc, as keyframes over the swing. Offsets are in grip units,
  // rotations in radians, all relative to the rest pose. Anticipation to
  // 0.22, the snap across the frame to 0.44 (the strike frame is 0.40, when
  // the blade is at the centre), overshoot to 0.58, then a slow recovery.
  static cleave(p, side) {
    const s = side;
    return {
      dx: keyed([[0, 0], [0.22, 0.18], [0.44, -0.95], [0.58, -1.15], [1, 0]], p) * s,
      dy: keyed([[0, 0], [0.22, 0.34], [0.44, -0.05], [0.58, -0.30], [1, 0]], p),
      dz: keyed([[0, 0], [0.22, 0.10], [0.44, -0.28], [0.58, -0.12], [1, 0]], p),
      rx: keyed([[0, 0], [0.22, 0.55], [0.44, -1.25], [0.58, -1.55], [1, 0]], p),
      ry: keyed([[0, 0], [0.22, -0.45], [0.44, 1.35], [0.58, 1.55], [1, 0]], p) * s,
      rz: keyed([[0, 0], [0.22, 0.65], [0.44, -0.70], [0.58, -0.95], [1, 0]], p) * s,
    };
  }

  // The twin cut: one hand snaps forward and across while the other holds.
  static cut(p, side) {
    const s = side;
    return {
      dx: keyed([[0, 0], [0.16, 0.10], [0.34, -0.55], [0.5, -0.45], [1, 0]], p) * s,
      dy: keyed([[0, 0], [0.16, -0.06], [0.34, 0.12], [0.5, 0.0], [1, 0]], p),
      dz: keyed([[0, 0], [0.16, 0.14], [0.34, -0.40], [0.5, -0.25], [1, 0]], p),
      rx: keyed([[0, 0], [0.16, 0.30], [0.34, -0.55], [0.5, -0.45], [1, 0]], p),
      ry: keyed([[0, 0], [0.16, -0.30], [0.34, 0.95], [0.5, 0.85], [1, 0]], p) * s,
      rz: keyed([[0, 0], [0.16, 0.25], [0.34, -0.45], [0.5, -0.35], [1, 0]], p) * s,
    };
  }

  // A spear thrust: back to the hip, then driven straight down the aim.
  static thrust(p) {
    return {
      dx: keyed([[0, 0], [0.22, 0.12], [0.42, -0.15], [1, 0]], p),
      dy: keyed([[0, 0], [0.22, -0.06], [0.42, 0.04], [1, 0]], p),
      dz: keyed([[0, 0], [0.22, 0.40], [0.42, -0.85], [0.6, -0.6], [1, 0]], p),
      rx: keyed([[0, 0], [0.22, 0.15], [0.42, -0.35], [1, 0]], p),
      ry: keyed([[0, 0], [0.22, -0.2], [0.42, 0.25], [1, 0]], p),
      rz: 0,
    };
  }

  // Called every frame while possessed, after the main camera is placed.
  update(dt, cam, unit, opts = {}) {
    if (!this.visible || !this.current) return;
    this.t += dt;
    const g = this.grip;
    const kind = unit.type.strike?.kind || 'melee';
    const ranged = kind !== 'melee';
    const rest = ranged ? REST_RANGED : REST;

    // Progress through the current swing, if any.
    const dur = unit.swingDur || 0.55;
    const p = unit.swingT > 0 ? 1 - unit.swingT / dur : -1;

    let ox = rest.x * g;
    let oy = rest.y * g;
    let oz = rest.z * g;
    let rx = rest.rx;
    let ry = rest.ry;
    let rz = rest.rz;

    // Idle sway and walk bob, layered under whatever the swing is doing so the
    // weapon is never completely still. The bob is the eye's figure-eight,
    // counter-phased a little so the weapon lags the head.
    const mv = opts.moveT || 0;
    const stride = opts.stride || 0;
    const amp = mv * (1 + 0.5 * (opts.sprint || 0));
    ox += Math.sin(this.t * 1.2) * 0.010 * g + Math.sin(stride - 0.4) * 0.040 * g * amp;
    oy += Math.sin(this.t * 1.7) * 0.008 * g + Math.sin(stride * 2 - 0.6) * 0.030 * g * amp
      + (opts.spring || 0) * 0.03 * g;
    rz += Math.sin(stride - 0.4) * 0.05 * amp;
    rx += Math.sin(this.t * 1.7) * 0.016 + Math.sin(stride * 2 - 0.6) * 0.02 * amp;
    // Sprinting drops the weapon low and forward, the way a runner carries it.
    const sp = opts.sprint || 0;
    oy += -0.10 * g * sp;
    oz += 0.06 * g * sp;
    rx += 0.25 * sp;
    // In the air the weapon drifts up with the body's lift.
    if (opts.airborne) { oy += 0.03 * g; rx += -0.12; }

    // Aim lag: the weapon trails the turn for a moment, then catches up.
    this._sway.x += ((opts.yawRate || 0) * -0.9 - this._sway.x) * Math.min(1, dt * 10);
    this._sway.y += ((opts.pitchRate || 0) * -0.7 - this._sway.y) * Math.min(1, dt * 10);
    ox += Math.max(-0.09, Math.min(0.09, this._sway.x)) * g;
    oy += Math.max(-0.07, Math.min(0.07, this._sway.y)) * g;
    rz += Math.max(-0.09, Math.min(0.09, this._sway.x)) * 1.4;

    let leftHand = false;
    if (p >= 0) {
      if (kind === 'melee') {
        const side = unit.swingSide || 1;
        const twin = unit.typeKey === 'duelist';
        const spear = unit.typeKey === 'warden';
        const arc = twin ? ViewModel.cut(p, side) : spear ? ViewModel.thrust(p) : ViewModel.cleave(p, side);
        // The cleave is authored right-to-left. A mirrored swing runs from the
        // left, so the rest offset itself has to cross the frame: the prop
        // travels from its right-hand rest, over, and back.
        ox += arc.dx * g;
        oy += arc.dy * g;
        oz += arc.dz * g;
        rx += arc.rx;
        ry += arc.ry;
        rz += arc.rz;
        leftHand = twin && side < 0;
      } else if (kind === 'hitscan') {
        // A short punch straight back with muzzle climb, decaying fast.
        const rec = Math.exp(-p * 7);
        oz += 0.16 * g * rec;
        rx += 0.30 * rec;
        ry += 0.05 * rec;
      } else if (kind === 'lob') {
        // Over the shoulder and forward: wind back, then throw.
        const back = Math.sin(Math.PI * Math.min(1, p * 2.2));
        oz += 0.22 * g * back;
        oy += 0.16 * g * back;
        rx += -0.85 * back;
      }
    }

    if (kind === 'beam') {
      // No swing at all: a held weapon that hums, rising while it fires and
      // sagging as heat builds.
      const on = opts.firing ? 1 : 0;
      this._beam = (this._beam || 0) + ((on ? 1 : 0) - (this._beam || 0)) * Math.min(1, dt * (on ? 9 : 5));
      oy += 0.05 * g * this._beam;
      oz += -0.05 * g * this._beam;
      ox += Math.sin(this.t * 31) * 0.008 * g * this._beam;
      oy += Math.sin(this.t * 23) * 0.006 * g * this._beam;
      rx += -0.10 * this._beam + (unit.heat || 0) * 0.22;
      const core = this.current.userData.core;
      if (core) core.scale.setScalar(0.8 + this._beam * 0.5 + Math.sin(this.t * 18) * 0.06 * this._beam);
    }

    // The landing thump, and the recoil kick from possession.
    oy -= (opts.kick || 0) * 0.10 * g;
    rx += (opts.kick || 0) * 0.30;

    // Place it against the camera basis. Three's camera looks down -Z, so the
    // forward offset is negated.
    cam.matrixWorld.extractBasis(_x, _y, _z);
    // A fixed, narrower lens than the world's. Letting the prop inherit an 84
    // degree field of view stretched it across the corner of the screen.
    this.camera.fov = 55;
    this.camera.aspect = cam.aspect;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 0, 0);
    this.camera.quaternion.set(0, 0, 0, 1);
    this.camera.updateMatrixWorld();

    // The overlay scene is camera-relative, so the model is positioned in plain
    // camera space and the overlay camera sits at the origin looking down -Z.
    this.current.position.set(ox, oy, -oz);
    _e.set(rx, ry, rz, 'YXZ');
    _lq.setFromEuler(_e);
    this.current.quaternion.copy(_lq);
    this.current.scale.setScalar(VM_SCALE);
    // The twin blades swap which hand leads: the striking blade is brought to
    // the centre of the frame, the other stays out at its side.
    if (unit.typeKey === 'duelist') {
      const r = this.current.getObjectByName('right');
      const l = this.current.getObjectByName('left');
      if (r && l) {
        const lead = p >= 0 ? hump(Math.min(1, p / 0.5)) : 0;
        r.position.x = 0.30 - (leftHand ? 0 : 0.30) * lead;
        l.position.x = -0.30 + (leftHand ? 0.30 : 0) * lead;
      }
    }
    this.current.updateMatrixWorld(true);

    // The trail samples the blade line in camera space while the sweep is
    // crossing the frame, and lets go the moment the recovery starts.
    const bl = this.current.userData.blade;
    const sweeping = kind === 'melee' && p >= 0.16 && p <= 0.6 && bl;
    if (sweeping) {
      const m = this.current.matrixWorld;
      _base.set(bl[0] * (leftHand ? -1 : 1), bl[1], bl[2]).applyMatrix4(m);
      _tip.set(bl[3] * (leftHand ? -1 : 1), bl[4], bl[5]).applyMatrix4(m);
      this.trail.push(_base, _tip);
    }
    this.trail.update(dt, !!sweeping);
  }

  render(renderer) {
    if (!this.visible || !this.current) return;
    // autoClear is ON by default, so a second render() wipes the COLOUR buffer
    // and takes the whole world with it - the first build of this pass drew the
    // weapon onto a black screen. Only the depth buffer may be cleared here,
    // which is what lets the weapon sit in front of terrain it would otherwise
    // intersect.
    // The depth clear is the post chain's now; this must only ever ADD to the
    // buffer it is handed. autoClear stays off for the same reason it always
    // did: a second render() with it on wipes the colour buffer and takes the
    // whole world with it.
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(this.scene, this.camera);
    renderer.autoClear = prevAutoClear;
  }
}
