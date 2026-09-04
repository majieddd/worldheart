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

// Looking up and down. The unit's FACING must stay tangent to the sphere - the
// render basis and every ground move depend on it - so pitch lives on the view
// rather than on a.fwd, and the two stop being the same thing. Because fwd and
// dir are kept orthonormal, the pitched look direction has an exact closed
// form: fwd*cos(p) + dir*sin(p). No quaternion, no drift.
const PITCH_MAX = 1.4835;       // 85 degrees, short of the pole where roll flips
const VIEW_PITCH_MAX = 1.5184;  // 87, the clamp after recoil is folded in
const KICK_PITCH = 0.22;        // radians of muzzle rise per unit of kick

// Jumping. Apex 1.269 units, which is deliberately just UNDER the 1.41 needed
// to break the closest enemy's contact grind: a jump dodges a telegraphed swing
// but never makes you untouchable while standing in a crowd.
const JUMP_SPEED = 7.0;
const JUMP_GRAVITY = 19.3;
const JUMP_FALL_MUL = 1.15;     // falls a little faster than it rises

// The orbit view's near plane is sized for orbit - about 5 world units at this
// mode's default zoom - and possession inherited it, so everything within five
// metres of the eye was clipped away, including a Bulwark's entire three unit
// strike radius.
// Small enough that a Bulwark's three unit strike radius is fully visible,
// large enough that the depth buffer survives. Dropping it to 0.10 against a
// far plane of 7200 is a 72,000:1 range, and the terrain z-fought itself into a
// black screen. The weapon does not need this to be tiny - the view model is
// drawn by its own camera in its own pass, which is the whole reason it has
// one.
const FP_NEAR = 0.4;
const FP_SHAKE = 0.035;         // radians at full trauma

// Third person. The cap is deliberately small: the orbit view in this mode
// reaches 113 units back and frames a frontier up to 125 units across, so a
// 7 unit boom is a different tool entirely rather than a timid orbit. You can
// see your own body and a little more around you - which is what an
// over-the-shoulder view is for - and you still cannot read the battlefield
// from it, so holding ground and reading the board stay separate decisions.
const TP_MAX = 7.0;
const TP_STEP = 0.9;            // units of boom per wheel notch
const TP_EASE = 12;             // how fast the boom follows the target
const TP_SHOULDER = 0.55;       // lateral offset so the body is not centred
const TP_CLEAR = 0.45;          // keep the camera this far off the ground

// Base control. Walking out past the frontier severs the link to the base: the
// orbit view is the BASE's view, and once you are outside it there is nothing
// standing at the heart to give it to you. The band is hysteretic so standing
// on the line does not strobe the warning on and off.
const LINK_OUT = 1.0;           // fraction of the frontier at which the link drops
const LINK_IN = 0.94;           // and the closer line at which it comes back

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const _eye = new THREE.Vector3();
const _look = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _tp = new THREE.Vector3();
const _gn = new THREE.Vector3();
const _right = new THREE.Vector3();
// The frame delta placeCamera needs to decay trauma, set by update().
let dtShake = 0;

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
    this.firing = false;
    this.kick = 0;
    this.stride = 0;
    this.pitch = 0;
    this._savedNear = null;
    this.shake = 0;
    this._prevPitch = 0;
    this._yawUsed = 0;
    this.viewModel = null;
    this.boom = 0;        // 0 is first person; rises to TP_MAX
    this.boomWant = 0;
    this.linked = true;   // is base control still reachable?
    this.onLinkChange = null;
    this._savedFov = null;
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
      if (e.code === 'Escape' || e.code === 'Tab') {
        e.preventDefault();
        // You cannot hand the view back to a base you are not connected to.
        // Walking home is the way back, which is what makes leaving a decision.
        if (!this.linked) {
          this.ui?.toast?.('No link to base. Walk back inside the frontier.', 'warn');
        } else {
          this.exit();
        }
      }
      if (e.code === 'KeyG') { e.preventDefault(); this.rally(); }
      // NOT Space: that is the global pause key and binding a second action to
      // it is exactly the defect that made every swing pause the game.
      if (e.code === 'KeyF' && !e.repeat) { e.preventDefault(); this.jump(); }
      if (e.code === 'KeyH') { e.preventDefault(); this.dismiss(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    // Left click strikes. Space is the game's PAUSE key and always was, so
    // binding the strike to it meant every swing also paused the game.
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.active) return;
      if (e.button === 0) { e.preventDefault(); this.firing = true; this.attack(0); }
    });
    // Held rather than clicked, so a beam channels and a melee keeps its own
    // cadence without the player having to match it by hand. playerAttack's own
    // cooldown does the rate limiting.
    addEventListener('mouseup', (e) => { if (e.button === 0) this.firing = false; });
    addEventListener('blur', () => { this.firing = false; });

    // Mouse look. Pointer lock when the browser grants it, drag-look otherwise,
    // so the mode is usable even where lock is refused. The fallback drags on
    // the RIGHT button now that the left one swings, because sharing a button
    // between looking and attacking made every turn throw a punch.
    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.active) return;
      const locked = document.pointerLockElement === this.canvas;
      if (locked || (e.buttons & 2)) {
        this.yawQueue += e.movementX * TURN_PER_PIXEL;
        // Screen-down should look down, and movementY is positive downward.
        this.pitch = clamp(this.pitch - e.movementY * TURN_PER_PIXEL, -PITCH_MAX, PITCH_MAX);
      }
    });

    // The wheel pulls the camera back off the shoulder instead of zooming the
    // orbit view, which is not driving while a body is possessed.
    this.rig.onWheelOverride = (e) => {
      if (!this.active) return false;
      const notches = e.deltaY * (e.deltaMode === 1 ? 16 : 1) / 100;
      this.boomWant = clamp(this.boomWant + notches * TP_STEP, 0, TP_MAX);
      return true;
    };

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
    // Each archetype sees the world a little differently: a Bulwark is close
    // and heavy at 74, a Twinfang wide and quick at 84.
    const cam = this.rig.camera;
    if (this._savedFov === null) this._savedFov = cam.fov;
    const want = unit.type.strike?.fov;
    if (want) { cam.fov = want; cam.updateProjectionMatrix(); }
    this.linked = true;
    this.audio?.play('possess');
    this.viewModel?.show(unit.typeKey);
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
    if (unit) { unit.possessed = false; unit.aim = null; unit.hidden = false; }
    this.boom = 0;
    this.boomWant = 0;
    this.firing = false;
    this.kick = 0;
    this.viewModel?.hide();
    this.audio?.play('release');
    if (this._savedFov !== null || this._savedNear !== null) {
      if (this._savedFov !== null) this.rig.camera.fov = this._savedFov;
      if (this._savedNear !== null) this.rig.camera.near = this._savedNear;
      this.rig.camera.updateProjectionMatrix();
      this._savedFov = null;
      this._savedNear = null;
    }
    this.pitch = 0;
    try {
      if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
    } catch { /* nothing to release */ }
    
    if (this.onExit) this.onExit(unit);
  }

  // A hop. Purely radial: on a sphere "up" is the surface normal, so a jump is
  // a change of altitude and the angular walk underneath it is untouched, which
  // is why air control needs no special case.
  jump() {
    const u = this.unit;
    if (!u || u.airT > 0) return false;
    u.vertVel = JUMP_SPEED;
    u.airT = 0.0001;
    this.audio?.play('jump');
    return true;
  }

  attack(dt = 0) {
    if (!this.active) return 0;
    const kind = this.unit.type.strike?.kind;
    const n = this.allies.playerAttack(this.unit, dt);
    // The swing sounds whether or not it connects - a whiff you cannot hear
    // reads as an input that did not register.
    if (kind === 'melee' && this.unit.swingT >= (this.unit.swingDur || 0) - 1e-6) {
      this.audio?.play('swing');
    }
    if (n > 0) {
      const s = this.unit.type.strike;
      if (kind === 'hitscan') this.audio?.play('rifle');
      else if (kind === 'lob') this.audio?.play('lob');
      // A weapon that does not move when it fires does not feel like a weapon.
      this.kick = Math.min(0.5, this.kick + (s.kick || 0));
      this.rig.addTrauma(s.trauma || 0.05);
    }
    return n;
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
    const size = this.allies.partySize(this.unit);
    this.ui?.toast?.(n ? `${n} joined - party of ${size}` : 'Nobody in range', n ? 'info' : 'warn');
    return n;
  }

  // Send the party home. Paired with rally so a group can be released at the
  // gate rather than dragged back into the base.
  dismiss() {
    if (!this.active) return 0;
    const n = this.allies.dismissParty(this.unit);
    this.ui?.toast?.(n ? `${n} returned to post` : 'No party to dismiss', n ? 'info' : 'warn');
    return n;
  }

  update(dt, simRunning = true) {
    if (!this.active) {
      // The body died underneath the player: hand control back rather than
      // leaving the camera stranded on a corpse.
      if (this.unit) this.exit();
      return;
    }
    const u = this.unit;

    if (this.yawQueue !== 0) {
      this.allies.turnUnit(u, this.yawQueue);
      this._yawUsed = this.yawQueue;
      this.yawQueue = 0;
    }
    if (!simRunning) {
      // Paused: you may still look around, and the camera must still be placed,
      // but nothing this body does may touch the frozen world.
      this._updateLink();
      dtShake = 0;
      this.placeCamera();
      this.viewModel?.update(0, this.rig.camera, u, { moving: false, stride: this.stride, kick: this.kick });
      this.ui?.updatePossession?.(u);
      return;
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
    if (this.firing) this.attack(dt);
    // Eased rather than snapped, so a scroll reads as the camera pulling out.
    this.boom += (this.boomWant - this.boom) * Math.min(1, dt * TP_EASE);
    // Your own body is hidden from the inside and shown from behind. Without
    // this the first-person eye sits inside the commander's own head, and
    // pulling back would reveal nothing to look at.
    u.hidden = this.boom <= 0.35;
    if (this.viewModel) this.viewModel.visible = this.boom <= 0.35 && !!this.viewModel.current;
    // The kick settles back over a few frames rather than snapping.
    if (this.kick > 0) this.kick = Math.max(0, this.kick - this.kick * Math.min(1, dt * 14) - dt * 0.05);
    this.stride += (fwd || strafe) ? dt * (u.type.strike?.strideHz || 2) * Math.PI * 2 : 0;

    // Treasure is collected by walking over it.
    if (this.caches) {
      const gold = this.caches.collectNear(this.allies.worldPos(u, _tmp));
      if (gold > 0) {
        this.game.gold += gold;
        this.goldFound += gold;
        this.ui?.toast?.(`Cache recovered: ${gold} gold`, 'info');
      }
    }

    this._updateLink();
    dtShake = dt;
    this.placeCamera();
    this._applyDistanceFog();
    this.viewModel?.update(dt, this.rig.camera, u, {
      moving: !!(fwd || strafe),
      stride: this.stride,
      kick: this.kick,
      firing: this.firing,
      yawRate: dt > 0 ? this._yawUsed / dt : 0,
      pitchRate: dt > 0 ? (this.pitch - this._prevPitch) / dt : 0,
    });
    this._prevPitch = this.pitch;
    this._yawUsed = 0;
    this.ui?.updatePossession?.(u);
  }

  // Thickens with how far past the frontier the unit has walked, so leaving
  // safety visibly costs you sight. Restored on exit.
  // Outside the circle you are on your own. Reported through a hook so the
  // shell owns the wording and the shell owns what it disables.
  _updateLink() {
    if (!this.frontier || !this.frontier.centre || !this.unit) return;
    const ang = Math.acos(Math.max(-1, Math.min(1, this.unit.dir.dot(this.frontier.centre))));
    const out = ang > this.frontier.theta * LINK_OUT;
    const back = ang < this.frontier.theta * LINK_IN;
    if (this.linked && out) {
      this.linked = false;
      if (this.onLinkChange) this.onLinkChange(false);
    } else if (!this.linked && back) {
      this.linked = true;
      if (this.onLinkChange) this.onLinkChange(true);
    }
  }

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
  // Where the player is LOOKING, as opposed to where the body is facing. Exact
  // on a sphere because fwd and dir are orthonormal: rotating fwd by p about
  // the right vector is fwd*cos(p) + dir*sin(p) with no residual term.
  aimDir(out) {
    const u = this.unit;
    const p = clamp(this.pitch + this.kick * KICK_PITCH, -VIEW_PITCH_MAX, VIEW_PITCH_MAX);
    return out.copy(u.fwd).multiplyScalar(Math.cos(p)).addScaledVector(u.dir, Math.sin(p)).normalize();
  }

  placeCamera() {
    const u = this.unit;
    const cam = this.rig.camera;
    u.height = terrainHeight(u.dir.x, u.dir.y, u.dir.z);
    // A small stride bob and the recoil kick. Both are tiny on purpose: enough
    // that walking and firing have weight, not enough to fight the aim.
    const bob = Math.sin(this.stride) * 0.035;
    const alt = Math.max(u.height, 0.03) + (u.hop || 0);
    _eye.copy(u.dir).multiplyScalar(
      R + alt + EYE_HEIGHT * u.type.scale + bob - this.kick * 0.06);
    this.aimDir(_aim);
    // Published on the body so the strike paths aim where the player is
    // looking rather than where the feet are pointed.
    if (!u.aim) u.aim = new THREE.Vector3();
    u.aim.copy(_aim);
    _look.copy(_eye).addScaledVector(_aim, 4);
    cam.up.copy(u.dir);

    if (this.boom > 0.01) {
      // Swing back along the reverse of the aim and out to the shoulder, then
      // pull in if the ground is in the way - a boom that clips through a hill
      // is worse than a short one.
      _right.crossVectors(u.fwd, u.dir).normalize();
      _tp.copy(_eye)
        .addScaledVector(_aim, -this.boom)
        .addScaledVector(_right, TP_SHOULDER * Math.min(1, this.boom / 2));
      _gn.copy(_tp).normalize();
      const ground = R + Math.max(terrainHeight(_gn.x, _gn.y, _gn.z), 0) + TP_CLEAR;
      if (_tp.length() < ground) _tp.setLength(ground);
      cam.position.copy(_tp);
      // Look past the head rather than at the feet, so the body sits low in
      // frame the way an over-the-shoulder camera should.
      _look.copy(_eye).addScaledVector(_aim, 6);
    } else {
      cam.position.copy(_eye);
    }
    cam.lookAt(_look);

    // Trauma is added from strikes and from being hit, but it is only ever
    // DECAYED and applied inside rig.update, which possession skips - so every
    // shake this mode asked for went nowhere and then discharged into the orbit
    // camera the moment control was released. First person consumes it here.
    if (this.rig.trauma > 0) {
      this.rig.trauma = Math.max(0, this.rig.trauma - dtShake * 1.7);
      const t = this.rig.trauma * this.rig.trauma * FP_SHAKE;
      if (t > 1e-5) {
        cam.rotateX((SIM_RANDOM.next() * 2 - 1) * t);
        cam.rotateY((SIM_RANDOM.next() * 2 - 1) * t * 1.3);
        cam.rotateZ((SIM_RANDOM.next() * 2 - 1) * t * 1.6);
      }
    }

    // The orbit near plane is metres deep and swallowed everything close to the
    // eye, weapon included. Saved and restored so orbit keeps its own.
    if (this._savedNear === null) this._savedNear = cam.near;
    if (cam.near !== FP_NEAR) { cam.near = FP_NEAR; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
  }
}
