import * as THREE from 'three';
import { R, terrainHeight, surfacePoint } from './world.js';
import { PALETTE } from './config.js';
import { SIM_RANDOM } from './noise.js';

// Direct control of a friendly unit, in first person.
//
// While possessed the orbit rig is bypassed entirely: the camera is placed at
// the unit's eye every frame and the unit is driven by the keyboard. That is
// also what lets a possessed unit leave the frontier - the confine lives on the
// rig, and the rig is not driving.
//
// Nothing here writes to js/run. Possession is a shell concern; the run does
// not know or care that a body is being flown by a player.

const EYE_HEIGHT = 1.05;
const TURN_PER_PIXEL = 0.0032;
const KEY_TURN = 1.9;          // rad/s for Q and E
const CACHE_REACH = 2.6;

const _eye = new THREE.Vector3();
const _look = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _axis = new THREE.Vector3();

// Gold caches hidden in the fog. They exist to give the trip a reward, so they
// are only ever placed OUTSIDE the current frontier.
export class CacheField {
  constructor(scene) {
    this.scene = scene;
    this.caches = [];
    const geo = new THREE.OctahedronGeometry(0.42, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE.gold, roughness: 0.3, metalness: 0.6,
      emissive: PALETTE.gold, emissiveIntensity: 0.85, flatShading: true,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, 64);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this._m4 = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3(1, 1, 1);
    this.time = 0;
  }

  // Scatter caches on a ring between the frontier and the far edge of the cap,
  // so they always sit in fog the player has to walk into.
  scatter(centre, innerTheta, outerTheta, count) {
    for (let i = 0; i < count && this.caches.length < 64; i++) {
      _tmp.set(SIM_RANDOM.next() - 0.5, SIM_RANDOM.next() - 0.5, SIM_RANDOM.next() - 0.5);
      _tmp.addScaledVector(centre, -_tmp.dot(centre));
      if (_tmp.lengthSq() < 1e-9) _tmp.set(1, 0, 0);
      _tmp.normalize();
      _axis.crossVectors(centre, _tmp);
      if (_axis.lengthSq() < 1e-12) continue;
      _axis.normalize();
      const ang = innerTheta + (outerTheta - innerTheta) * SIM_RANDOM.next();
      const dir = centre.clone().applyAxisAngle(_axis, ang).normalize();
      this.caches.push({ dir, taken: false, gold: 90 + Math.floor(SIM_RANDOM.next() * 140) });
    }
    this._render();
  }

  // Nearest untaken cache within reach of a world position.
  collectNear(point, reach = CACHE_REACH) {
    for (const c of this.caches) {
      if (c.taken) continue;
      surfacePoint(c.dir, _tmp2);
      _tmp2.addScaledVector(c.dir, 0.5);
      if (_tmp2.distanceTo(point) <= reach) {
        c.taken = true;
        this._render();
        return c.gold;
      }
    }
    return 0;
  }

  remaining() {
    let n = 0;
    for (const c of this.caches) if (!c.taken) n++;
    return n;
  }

  update(dt) {
    this.time += dt;
    this._render();
  }

  _render() {
    let n = 0;
    for (const c of this.caches) {
      if (c.taken) continue;
      surfacePoint(c.dir, _tmp);
      _tmp.addScaledVector(c.dir, 0.55 + Math.sin(this.time * 2 + c.gold) * 0.08);
      this._q.setFromAxisAngle(c.dir, this.time * 0.8);
      this._m4.compose(_tmp, this._q, this._s);
      this.mesh.setMatrixAt(n++, this._m4);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Possession {
  constructor({ canvas, rig, allies, game, ui, caches, scene }) {
    this.canvas = canvas;
    this.rig = rig;
    this.allies = allies;
    this.game = game;
    this.ui = ui;
    this.caches = caches;
    this.scene = scene;
    // The fog veil is a shell ABOVE the terrain, built for the top-down view.
    // At eye level the camera is underneath it and the horizon reads perfectly
    // clear, so first person needs real distance fog of its own.
    this.frontier = null;   // { centre, theta }, set by the mode shell
    this._prevFog = null;
    this.unit = null;
    this.keys = new Set();
    this.yawQueue = 0;
    this.onEnter = null;
    this.onExit = null;
    this.goldFound = 0;
    this._bind();
  }

  get active() { return !!(this.unit && this.unit.active && !this.unit.dead); }

  _bind() {
    addEventListener('keydown', (e) => {
      if (!this.active) return;
      // Never swallow keys aimed at a text field.
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      this.keys.add(e.code);
      if (e.code === 'Escape' || e.code === 'Tab') { e.preventDefault(); this.exit(); }
      if (e.code === 'KeyG') { e.preventDefault(); this.rally(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    // Left click strikes. Space is the game's PAUSE key and always was, so
    // binding the strike to it meant every swing also paused the game.
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.active) return;
      if (e.button === 0) { e.preventDefault(); this.attack(); }
    });

    // Mouse look. Pointer lock when the browser grants it, drag-look otherwise,
    // so the mode is usable even where lock is refused. The fallback drags on
    // the RIGHT button now that the left one swings, because sharing a button
    // between looking and attacking made every turn throw a punch.
    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.active) return;
      const locked = document.pointerLockElement === this.canvas;
      if (locked) this.yawQueue += e.movementX * TURN_PER_PIXEL;
      else if (e.buttons & 2) this.yawQueue += e.movementX * TURN_PER_PIXEL;
    });

    // Right-drag is the look fallback, so its menu has to stay out of the way
    // while a unit is possessed.
    this.canvas.addEventListener('contextmenu', (e) => {
      if (this.active) e.preventDefault();
    });
  }

  enter(unit) {
    if (!unit || !unit.active || unit.dead) return false;
    if (this.unit) this.exit();
    this.unit = unit;
    unit.possessed = true;
    unit.following = null;
    this.keys.clear();
    this.yawQueue = 0;
    // requestPointerLock resolves a PROMISE in current browsers, so a refusal
    // escapes try/catch entirely and lands as an unhandled rejection. It is
    // refused outright in some embedded contexts, and drag-look covers that
    // case, so the rejection is swallowed deliberately.
    try {
      const lock = this.canvas.requestPointerLock?.();
      if (lock && typeof lock.catch === 'function') lock.catch(() => {});
    } catch { /* refused synchronously; drag-look covers it */ }
    if (this.onEnter) this.onEnter(unit);
    return true;
  }

  exit() {
    const unit = this.unit;
    this.unit = null;
    this.keys.clear();
    // Never leave the overhead view fogged: that state belongs to being on
    // the ground outside the frontier.
    if (this.scene && this._prevFog !== null) {
      this.scene.fog = this._prevFog || null;
      this._prevFog = null;
    }
    if (unit) unit.possessed = false;
    try {
      if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
    } catch { /* nothing to release */ }
    
    if (this.onExit) this.onExit(unit);
  }

  attack() {
    if (!this.active) return 0;
    return this.allies.playerAttack(this.unit);
  }

  // Gather every nearby friendly to follow this unit. Only a commander can
  // hold a party together, which is what makes them worth protecting.
  rally() {
    if (!this.active) return 0;
    if (!this.unit.type.commander) {
      this.ui?.toast?.('Only a commander can rally a party', 'warn');
      return 0;
    }
    const n = this.allies.gatherParty(this.unit);
    this.ui?.toast?.(n ? `${n} joined the party` : 'Nobody in range', n ? 'info' : 'warn');
    return n;
  }

  update(dt) {
    if (!this.active) {
      // The body died underneath the player: hand control back rather than
      // leaving the camera stranded on a corpse.
      if (this.unit) this.exit();
      return;
    }
    const u = this.unit;

    if (this.yawQueue !== 0) {
      this.allies.turnUnit(u, this.yawQueue);
      this.yawQueue = 0;
    }
    if (this.keys.has('KeyQ')) this.allies.turnUnit(u, -KEY_TURN * dt);
    if (this.keys.has('KeyE')) this.allies.turnUnit(u, KEY_TURN * dt);

    let fwd = 0;
    let strafe = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) fwd += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) fwd -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) strafe -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) strafe += 1;
    if (fwd || strafe) this.allies.driveUnit(u, fwd, strafe, dt);

    // Treasure is collected by walking over it.
    if (this.caches) {
      const gold = this.caches.collectNear(this.allies.worldPos(u, _tmp));
      if (gold > 0) {
        this.game.gold += gold;
        this.goldFound += gold;
        this.ui?.toast?.(`Cache recovered: ${gold} gold`, 'info');
      }
    }

    this.placeCamera();
    this._applyDistanceFog();
  }

  // Thickens with how far past the frontier the unit has walked, so leaving
  // safety visibly costs you sight. Restored on exit.
  _applyDistanceFog() {
    if (!this.scene || !this.frontier || !this.frontier.centre) return;
    const u = this.unit;
    const ang = Math.acos(Math.max(-1, Math.min(1, u.dir.dot(this.frontier.centre))));
    const past = ang - this.frontier.theta;
    if (past <= 0) {
      if (this._prevFog !== null) { this.scene.fog = this._prevFog; this._prevFog = null; }
      return;
    }
    if (this._prevFog === null) this._prevFog = this.scene.fog || undefined;
    // 0.02 at the rim thickening to about 0.09 deep out: near enough to lose
    // the horizon without blinding the player.
    const density = 0.02 + Math.min(past / 0.35, 1) * 0.07;
    if (this.scene.fog && this.scene.fog.isFogExp2) this.scene.fog.density = density;
    else this.scene.fog = new THREE.FogExp2(0x1b2445, density);
  }

  // First person: the eye sits on the unit, looking along its facing. camera.up
  // is the surface normal, so "up" stays up wherever you are on the sphere.
  placeCamera() {
    const u = this.unit;
    const cam = this.rig.camera;
    u.height = terrainHeight(u.dir.x, u.dir.y, u.dir.z);
    _eye.copy(u.dir).multiplyScalar(R + Math.max(u.height, 0.03) + EYE_HEIGHT * u.type.scale);
    _look.copy(_eye).addScaledVector(u.fwd, 4);
    cam.up.copy(u.dir);
    cam.position.copy(_eye);
    cam.lookAt(_look);
    cam.updateMatrixWorld();
  }
}
