import * as THREE from 'three';
import { PALETTE } from './config.js';

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
// The models are built from primitives, like everything else in this project -
// there are no imported art assets anywhere in the codebase.

const MAT = {
  steel: new THREE.MeshStandardMaterial({ color: 0x9fb0cf, roughness: 0.42, metalness: 0.72, flatShading: true }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2b3350, roughness: 0.7, metalness: 0.3, flatShading: true }),
  grip: new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 0.9, metalness: 0.05, flatShading: true }),
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
  warden: 0.55, commander: 0.72, duelist: 0.52,
  marksman: 0.60, bombardier: 0.66, oracle: 0.58,
};

// Rest pose in camera space: right, up, forward. Down and to the right, the
// way a held item sits in Minecraft.
const REST = { x: 0.40, y: -0.34, z: 0.78 };

// Everything is modelled at world scale - a spear really is 1.5 units long -
// and a world-scale weapon held half a metre from the eye fills the screen. The
// overlay is drawn at a fraction of that, which is the same trick a real view
// model uses: it is a prop sized for the frame, not the world.
const VM_SCALE = 0.15;

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _lq = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cyl(rt, rb, h, seg, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); }

// Each builder returns a group whose origin is the grip, oriented so -Z points
// away from the viewer down the aim.
const BUILD = {
  // A spear: shaft with a leaf head.
  warden() {
    const g = new THREE.Group();
    const shaft = cyl(0.035, 0.035, 1.5, 6, MAT.grip);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -0.45;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 4), MAT.steel);
    head.rotation.x = -Math.PI / 2;
    head.position.z = -1.32;
    g.add(shaft, head);
    return g;
  },
  // A slab of a sword, wide enough to read as heavy at the edge of the screen.
  commander() {
    const g = new THREE.Group();
    const grip = cyl(0.05, 0.055, 0.3, 6, MAT.grip);
    grip.rotation.x = Math.PI / 2;
    const guard = box(0.34, 0.07, 0.09, MAT.dark);
    guard.position.z = -0.18;
    const blade = box(0.19, 0.045, 1.25, MAT.steel);
    blade.position.z = -0.82;
    const fuller = box(0.05, 0.055, 1.0, MAT.energy);
    fuller.position.z = -0.78;
    g.add(grip, guard, blade, fuller);
    return g;
  },
  // Two short blades, offset so the pair reads as two.
  duelist() {
    const g = new THREE.Group();
    for (const [side, tilt] of [[1, 0.12], [-1, -0.16]]) {
      const b = new THREE.Group();
      const grip = cyl(0.04, 0.045, 0.22, 6, MAT.grip);
      grip.rotation.x = Math.PI / 2;
      const blade = box(0.1, 0.035, 0.72, MAT.steel);
      blade.position.z = -0.5;
      const edge = box(0.03, 0.042, 0.66, MAT.energy);
      edge.position.z = -0.49;
      b.add(grip, blade, edge);
      b.position.set(side * 0.13, side * 0.03, side > 0 ? 0 : 0.1);
      b.rotation.z = tilt;
      g.add(b);
    }
    return g;
  },
  // A long rifle with a scope and a muzzle the recoil pivots around.
  marksman() {
    const g = new THREE.Group();
    const stock = box(0.11, 0.14, 0.5, MAT.grip);
    stock.position.z = 0.12;
    const body = box(0.1, 0.12, 0.7, MAT.dark);
    body.position.z = -0.4;
    const barrel = cyl(0.028, 0.032, 0.95, 8, MAT.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -1.05;
    const scope = cyl(0.05, 0.05, 0.34, 8, MAT.dark);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.12, -0.42);
    const glow = cyl(0.022, 0.022, 0.1, 6, MAT.energy);
    glow.rotation.x = Math.PI / 2;
    glow.position.z = -0.72;
    g.add(stock, body, barrel, scope, glow);
    return g;
  },
  // A stubby mortar tube, held across the body.
  bombardier() {
    const g = new THREE.Group();
    const tube = cyl(0.14, 0.16, 0.8, 10, MAT.dark);
    tube.rotation.x = Math.PI / 2.4;
    tube.position.z = -0.5;
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 12), MAT.steel);
    mouth.position.set(0, 0.27, -0.82);
    mouth.rotation.x = Math.PI / 2.4;
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), MAT.gold);
    shell.position.set(-0.2, -0.08, -0.2);
    const grip = cyl(0.045, 0.05, 0.26, 6, MAT.grip);
    grip.position.set(0.02, -0.16, -0.28);
    g.add(tube, mouth, shell, grip);
    return g;
  },
  // A focusing lens on a fork, with a core that brightens as the beam ramps.
  oracle() {
    const g = new THREE.Group();
    const handle = cyl(0.05, 0.055, 0.34, 6, MAT.grip);
    handle.rotation.x = Math.PI / 2;
    const fork = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 14), MAT.steel);
    fork.position.z = -0.62;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), MAT.energy);
    core.position.z = -0.62;
    const arm = box(0.05, 0.05, 0.5, MAT.dark);
    arm.position.z = -0.36;
    g.add(handle, arm, fork, core);
    g.userData.core = core;
    return g;
  },
};

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
  }

  hide() {
    if (this.current) this.current.visible = false;
    this.visible = false;
  }

  // The swing arc, shaped after Minecraft's: the item drops down and to the
  // right, sweeps across and up, then settles back. `p` runs 0..1 across the
  // swing. sin(pi*p) gives the single-humped sweep; the squared term biases the
  // return so the recovery reads slower than the strike, which is what makes a
  // heavy weapon feel heavy.
  static swingCurve(p) {
    const s = Math.sin(Math.PI * p);
    return { sweep: s, bias: s * s, lead: Math.sin(Math.PI * Math.min(1, p * 1.35)) };
  }

  // Called every frame while possessed, after the main camera is placed.
  update(dt, cam, unit, opts = {}) {
    if (!this.visible || !this.current) return;
    this.t += dt;
    const g = this.grip;
    const kind = unit.type.strike?.kind || 'melee';

    // Progress through the current swing, if any.
    const dur = unit.swingDur || 0.55;
    const p = unit.swingT > 0 ? 1 - unit.swingT / dur : -1;
    const sw = p >= 0 ? ViewModel.swingCurve(p) : null;

    let ox = REST.x * g;
    let oy = REST.y * g;
    let oz = REST.z * g;
    let rx = 0;
    let ry = 0;
    let rz = 0;

    // Idle sway and walk bob, layered under whatever the swing is doing so the
    // weapon is never completely still.
    const moving = opts.moving ? 1 : 0;
    ox += Math.sin(this.t * 1.2) * 0.010 * g + Math.sin(opts.stride || 0) * 0.045 * g * moving;
    oy += Math.sin(this.t * 1.7) * 0.008 * g
      - Math.abs(Math.cos(opts.stride || 0)) * 0.032 * g * moving;
    rz += Math.sin(opts.stride || 0) * 0.056 * moving;
    rx += Math.sin(this.t * 1.7) * 0.016;

    // Aim lag: the weapon trails the turn for a moment, then catches up.
    this._sway.x += ((opts.yawRate || 0) * -0.9 - this._sway.x) * Math.min(1, dt * 10);
    this._sway.y += ((opts.pitchRate || 0) * -0.7 - this._sway.y) * Math.min(1, dt * 10);
    ox += Math.max(-0.09, Math.min(0.09, this._sway.x)) * g;
    oy += Math.max(-0.07, Math.min(0.07, this._sway.y)) * g;
    rz += Math.max(-0.09, Math.min(0.09, this._sway.x)) * 1.4;

    if (sw) {
      if (kind === 'melee') {
        // Down-right, across and up. The big number is the pitch: an 80 degree
        // rotation is what reads as a swing rather than a nudge.
        ox += -0.40 * g * sw.lead;
        oy += 0.20 * g * sw.sweep;
        oz += -0.20 * g * sw.bias;
        rx += -1.40 * sw.lead;
        ry += -0.35 * sw.sweep;
        rz += -0.35 * sw.bias;
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
    this.current.updateMatrixWorld(true);
  }

  render(renderer) {
    if (!this.visible || !this.current) return;
    // autoClear is ON by default, so a second render() wipes the COLOUR buffer
    // and takes the whole world with it - the first build of this pass drew the
    // weapon onto a black screen. Only the depth buffer may be cleared here,
    // which is what lets the weapon sit in front of terrain it would otherwise
    // intersect.
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = prevAutoClear;
  }
}
