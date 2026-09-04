import * as THREE from 'three';
import { R, terrainHeight, surfacePoint } from './world.js';
import { PALETTE, CAM_TUNE } from './config.js';
import { SIM_RANDOM } from './noise.js';
import { BladeTrail } from './viewmodel.js';

// Direct control of a friendly unit, in first or third person.
//
// While possessed the orbit rig is bypassed entirely: the camera is placed at
// the unit's eye every frame and the unit is driven by the keyboard. That is
// also what lets a possessed unit leave the frontier - the confine lives on the
// rig, and the rig is not driving.
//
// Nothing here writes to js/run. Possession is a shell concern; the run does
// not know or care that a body is being flown by a player.
//
// FEEL. The first version of this file drove the body at full speed on the
// first frame of a key press, stopped it dead on release, and bobbed the eye
// by 0.035 units on a single sine. The owner's verdict was "clunky and weird
// with no head bobbing", and every number below is a response to it: the
// body has a velocity that ramps and settles, the eye rides a figure-eight
// that scales with speed and rolls into strafes, a jump has a lens kick and a
// landing has a spring, and every stride puts a footstep in the audio.

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
// A jump pressed a moment before landing still fires on touchdown. Without
// this a bunny-hop rhythm drops every other press, which reads as "jump does
// not work" rather than "I pressed early".
const JUMP_BUFFER = 0.14;

// Locomotion. Rates are per second toward the target velocity: a tenth of a
// second to full speed, a little less to stop, and almost no control in the
// air so a jump commits you to its arc.
const ACCEL = 14;
const DECEL = 18;
const AIR_CONTROL = 3.5;
const SPRINT_MUL = 1.45;
const SPRINT_FOV = 7;           // degrees of lens widening at full sprint

// Head bob. Vertical runs at twice the stride rate (one dip per footfall),
// lateral and roll at the stride rate (one sway per pair), which is the
// figure-eight a real head traces. Amplitudes scale with the body's smoothed
// speed so a creeping start does not thump.
const BOB_Y = 0.055;
const BOB_X = 0.032;
const BOB_ROLL = 0.020;
const STRAFE_ROLL = 0.045;      // radians of lean at full strafe
const SPRINT_BOB = 1.5;

// The landing spring: a critically damped second-order system on the eye
// height, kicked by touchdown speed. k and c give a ~0.3 s settle.
const SPRING_K = 210;
const SPRING_C = 29;

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
// The boom direction trails the aim a little, so a turn swings the camera
// round behind the body rather than snapping it, and the body reads as the
// thing that turned. Tight: at 9 with a 6 rad/s floor a fast mouse swing left
// the camera visibly catching up, which the owner called wonky; the lag is
// now a few frames of smoothing rather than a follow.
const TP_LAG = 22;
const TP_LAG_FLOOR = 14;        // rad/s minimum, so a flick completes in a few frames

// Mouse look is applied through a two-frame filter rather than raw per
// event: pointer-lock deltas arrive in bursts, and a fast swing dumped a
// whole burst into one frame and nothing into the next, which reads as a
// stutter. The filter carries a fraction of each burst into the next frame.
const LOOK_SMOOTH = 0.55;       // fraction of the queued turn applied per frame at 60 Hz

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
const _base = new THREE.Vector3();
const _tip = new THREE.Vector3();
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
    // Locomotion state. `vel` is forward and strafe as fractions of full
    // speed; `moveT` is its smoothed magnitude, which everything cosmetic
    // scales by.
    this.vel = new THREE.Vector2();
    this.moveT = 0;
    this.sprint = false;
    this.sprintT = 0;       // eased 0..1 for the lens
    this.jumpBuffer = 0;
    this.springY = 0;       // eye offset from the landing spring
    this.springV = 0;
    this.fovKick = 0;       // brief widenings from jumps and strikes
    this.roll = 0;          // smoothed camera roll
    this.stepPhase = 0;     // which half of the stride last stepped
    // Third-person: the smoothed boom direction and the world-space trail.
    this._tpAim = new THREE.Vector3();
    this._tpAimSet = false;
    this.world = null;       // set by main.js; decor occlusion for the boom
    this.boomAllow = 1;      // fraction of the boom the decor lets through
    // The draft overlay needs the mouse. While suspended, look and strike
    // input are ignored and the pointer is released; the camera still
    // follows the body so the world does not freeze behind the cards.
    this.suspended = false;
    this.pitchQueue = 0;
    this.tpTrail = scene ? new BladeTrail(scene, 18, 1.0, 0.7) : null;
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
      // Space jumps while a body is possessed. It used to pause the game,
      // which is the key every player presses first to jump, so "you cannot
      // jump" was the owner's read of a jump that was bound to F alone. The
      // pause is on P everywhere and on Space only on the board (js/ui.js
      // checks possession before it toggles). F stays as an alias.
      if ((e.code === 'Space' || e.code === 'KeyF') && !e.repeat) {
        e.preventDefault();
        if (!this.jump()) this.jumpBuffer = JUMP_BUFFER;
      }
      if (e.code === 'KeyH') { e.preventDefault(); this.dismiss(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    // Left click strikes.
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.active || this.suspended) return;
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
      if (!this.active || this.suspended) return;
      const locked = document.pointerLockElement === this.canvas;
      if (locked || (e.buttons & 2)) {
        const sens = TURN_PER_PIXEL * (CAM_TUNE.lookSens || 100) / 100;
        this.yawQueue += e.movementX * sens;
        // Screen-down should look down, and movementY is positive downward.
        // Queued like yaw and drained through the same filter in update().
        this.pitchQueue -= e.movementY * sens;
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
    this.vel.set(0, 0);
    this.moveT = 0;
    this.sprint = false;
    this.sprintT = 0;
    this.springY = 0;
    this.springV = 0;
    this.fovKick = 0;
    this.roll = 0;
    this._tpAimSet = false;
    this.boomAllow = 1;
    this.suspended = false;
    this.pitchQueue = 0;
    this._lock();
    // Each archetype sees the world a little differently: a Bulwark is close
    // and heavy at 74, a Twinfang wide and quick at 84.
    const cam = this.rig.camera;
    if (this._savedFov === null) this._savedFov = cam.fov;
    this.baseFov = unit.type.strike?.fov || cam.fov;
    cam.fov = this.baseFov;
    cam.updateProjectionMatrix();
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
    if (unit) {
      unit.possessed = false;
      unit.aim = null;
      unit.hidden = false;
      unit.aimPitch = 0;
      unit.strafeIn = 0;
      unit.sprint = false;
    }
    this.boom = 0;
    this.boomWant = 0;
    this.firing = false;
    this.kick = 0;
    this.viewModel?.hide();
    this.tpTrail?.clear();
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

  // Take the pointer. requestPointerLock resolves a PROMISE in current
  // browsers, so a refusal escapes try/catch entirely and lands as an
  // unhandled rejection. It is refused outright in some embedded contexts, and
  // drag-look covers that case, so the rejection is swallowed deliberately.
  // unadjustedMovement asks for raw deltas with no OS acceleration, which is
  // most of what made a fast mouse swing land somewhere unpredictable; a
  // browser that rejects the option gets the plain request.
  _lock() {
    const el = this.canvas;
    const plain = () => {
      try {
        const p = el.requestPointerLock?.();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch { /* refused synchronously; drag-look covers it */ }
    };
    try {
      const p = el.requestPointerLock?.({ unadjustedMovement: true });
      if (p && typeof p.catch === 'function') p.catch(() => plain());
    } catch { plain(); }
  }

  // The draft overlay (and anything else that needs the mouse) suspends the
  // body's input: the pointer is released, look and strike stop, held keys
  // drop. Resuming asks for the pointer back, which the browser grants only
  // inside the activation window of the click that dismissed the overlay,
  // and that is exactly when the shell calls this.
  suspend(on) {
    if (this.suspended === on) return;
    this.suspended = on;
    this.keys.clear();
    this.firing = false;
    this.yawQueue = 0;
    this.pitchQueue = 0;
    if (on) {
      try {
        if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
      } catch { /* nothing to release */ }
    } else if (this.active) {
      this._lock();
    }
  }

  // A hop. Purely radial: on a sphere "up" is the surface normal, so a jump is
  // a change of altitude and the angular walk underneath it is untouched, which
  // is why air control needs no special case.
  jump() {
    const u = this.unit;
    if (!u || u.airT > 0) return false;
    u.vertVel = JUMP_SPEED;
    u.airT = 0.0001;
    this.jumpBuffer = 0;
    // The eye lifts a touch ahead of the body and the lens opens: the push
    // off the ground has to be felt, not only seen from the ground moving.
    this.springV += 1.4;
    this.fovKick = Math.max(this.fovKick, 2.5);
    this.audio?.play('jump');
    return true;
  }

  // Called by main.js from allies.onLand for this body.
  landed(u) {
    if (u !== this.unit) return;
    // The dip scales with how hard the body came down. A hop from flat ground
    // arrives at about 8 units per second.
    const hard = Math.min(1.6, Math.abs(this.unit.cos?.lastVert || 8) / 8);
    this.springV -= 2.2 * hard;
    this.rig.addTrauma(0.06 * hard);
    if (this.jumpBuffer > 0) this.jump();
  }

  attack(dt = 0) {
    if (!this.active) return 0;
    const kind = this.unit.type.strike?.kind;
    const n = this.allies.playerAttack(this.unit, dt);
    // Melee reports through onStrikeResolved once the blade is actually across
    // the target; only the instant kinds land here.
    if (n > 0 && kind !== 'melee') {
      const s = this.unit.type.strike;
      if (kind === 'hitscan') this.audio?.play('rifle');
      else if (kind === 'lob') this.audio?.play('lob');
      // A weapon that does not move when it fires does not feel like a weapon.
      this.kick = Math.min(0.5, this.kick + (s.kick || 0));
      this.rig.addTrauma(s.trauma || 0.05);
    }
    return n;
  }

  // The swing has started: the whoosh belongs here, at the wind-up, so the
  // input is heard the instant it registers.
  swingStarted(u) {
    if (u !== this.unit) return;
    this.audio?.play('swing');
    this.fovKick = Math.max(this.fovKick, 0.8);
  }

  // The blade has crossed the target. Weight lands here: the kick, the shake
  // and the lens snap all belong to the moment of contact, not the click.
  strikeResolved(u, hits, spec) {
    if (u !== this.unit || !spec) return;
    this.kick = Math.min(0.5, this.kick + (spec.kick || 0) * (hits > 0 ? 1 : 0.5));
    this.rig.addTrauma((spec.trauma || 0.05) * (hits > 0 ? 1 : 0.4));
    if (hits > 0) this.fovKick = Math.max(this.fovKick, 2);
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

    // Drain the look queues through the filter: most of a burst this frame,
    // the rest next frame, so a fast swing lands smoothly and stops where the
    // hand stopped rather than a frame late or a frame early.
    if (this.yawQueue !== 0 || this.pitchQueue !== 0) {
      const k = Math.min(1, LOOK_SMOOTH * Math.max(0.5, Math.min(2, dt * 60)) + (dt <= 0 ? 1 : 0));
      const yaw = this.yawQueue * k;
      const pit = this.pitchQueue * k;
      this.yawQueue -= yaw;
      this.pitchQueue -= pit;
      if (Math.abs(this.yawQueue) < 1e-5) this.yawQueue = 0;
      if (Math.abs(this.pitchQueue) < 1e-5) this.pitchQueue = 0;
      if (yaw !== 0) this.allies.turnUnit(u, yaw);
      this._yawUsed = yaw;
      this.pitch = clamp(this.pitch + pit, -PITCH_MAX, PITCH_MAX);
    }
    if (!simRunning || this.suspended) {
      // Paused, or the mouse is lent to an overlay: the camera must still be
      // placed, but nothing this body does may touch the world.
      this._updateLink();
      dtShake = 0;
      this.placeCamera();
      this.viewModel?.update(0, this.rig.camera, u, this._vmOpts(0, false));
      this.ui?.updatePossession?.(u);
      return;
    }
    if (this.keys.has('KeyQ')) this.allies.turnUnit(u, -KEY_TURN * dt);
    if (this.keys.has('KeyE')) this.allies.turnUnit(u, KEY_TURN * dt);

    // ---- locomotion ---------------------------------------------------
    let fwd = 0;
    let strafe = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) fwd += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) fwd -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) strafe -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) strafe += 1;
    const wantLen = Math.hypot(fwd, strafe);
    if (wantLen > 1) { fwd /= wantLen; strafe /= wantLen; }
    // Sprint only carries forward: a sideways sprint reads as a glitch.
    this.sprint = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && fwd > 0.5;
    const airborne = u.airT > 0;
    const rate = airborne ? AIR_CONTROL : (wantLen > 0 ? ACCEL : DECEL);
    const k = Math.min(1, dt * rate);
    this.vel.x += (fwd - this.vel.x) * k;
    this.vel.y += (strafe - this.vel.y) * k;
    if (Math.abs(this.vel.x) < 0.002) this.vel.x = 0;
    if (Math.abs(this.vel.y) < 0.002) this.vel.y = 0;
    const speedFrac = Math.min(1, this.vel.length());
    this.moveT += (speedFrac - this.moveT) * Math.min(1, dt * 10);
    this.sprintT += ((this.sprint ? 1 : 0) - this.sprintT) * Math.min(1, dt * 5);
    u.sprint = this.sprint;
    if (speedFrac > 0) this.allies.driveUnit(u, this.vel.x, this.vel.y, dt, 1 + (SPRINT_MUL - 1) * this.sprintT);
    else u.strafeIn = 0;
    if (this.jumpBuffer > 0) {
      this.jumpBuffer -= dt;
      if (!airborne) this.jump();
    }

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
    if (this.fovKick > 0) this.fovKick = Math.max(0, this.fovKick - this.fovKick * Math.min(1, dt * 9) - dt * 0.5);

    // Stride phase advances with the body's real speed, and never in the air,
    // where feet have nothing to fall on. Each half-stride is a footfall.
    if (!airborne && this.moveT > 0.05) {
      const hz = (u.type.strike?.strideHz || 2) * (1 + 0.25 * this.sprintT);
      this.stride += dt * hz * Math.PI * 2 * this.moveT;
      const half = Math.floor(this.stride / Math.PI);
      if (half !== this.stepPhase) {
        this.stepPhase = half;
        this.audio?.play(this.sprintT > 0.5 ? 'stepHard' : 'step');
      }
    }

    // The landing spring integrates every frame, so a jump's lift and a
    // touchdown's dip both settle on their own.
    this.springV += (-SPRING_K * this.springY - SPRING_C * this.springV) * dt;
    this.springY += this.springV * dt;

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
    this._updateTrail(dt);
    this.viewModel?.update(dt, this.rig.camera, u, this._vmOpts(dt, true));
    this._prevPitch = this.pitch;
    this._yawUsed = 0;
    this.ui?.updatePossession?.(u);
  }

  _vmOpts(dt, live) {
    return {
      moving: this.moveT > 0.05,
      moveT: this.moveT,
      sprint: this.sprintT,
      stride: this.stride,
      kick: this.kick,
      firing: this.firing,
      airborne: this.unit.airT > 0,
      spring: this.springY,
      yawRate: live && dt > 0 ? this._yawUsed / dt : 0,
      pitchRate: live && dt > 0 ? (this.pitch - this._prevPitch) / dt : 0,
    };
  }

  // The third-person blade trail follows the weapon the body is drawn with.
  // Sampled only while a melee swing is in its sweep, and only when the body
  // is visible, so first person never draws a world-space ribbon through its
  // own eye.
  _updateTrail(dt) {
    if (!this.tpTrail) return;
    const u = this.unit;
    const kind = u.type.strike?.kind;
    const dur = u.swingDur || 0.55;
    const p = u.swingT > 0 ? 1 - u.swingT / dur : -1;
    const sweeping = kind === 'melee' && p >= 0.18 && p <= 0.62 && !u.hidden;
    if (sweeping && this.allies.weaponLine(u, _base, _tip)) this.tpTrail.push(_base, _tip);
    this.tpTrail.update(dt, sweeping);
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

  // Where the player is LOOKING, as opposed to where the body is facing. Exact
  // on a sphere because fwd and dir are orthonormal: rotating fwd by p about
  // the right vector is fwd*cos(p) + dir*sin(p) with no residual term.
  aimDir(out) {
    const u = this.unit;
    const p = clamp(this.pitch + this.kick * KICK_PITCH, -VIEW_PITCH_MAX, VIEW_PITCH_MAX);
    return out.copy(u.fwd).multiplyScalar(Math.cos(p)).addScaledVector(u.dir, Math.sin(p)).normalize();
  }

  // First person: the eye sits on the unit, looking along its facing. camera.up
  // is the surface normal, so "up" stays up wherever you are on the sphere.
  placeCamera() {
    const u = this.unit;
    const cam = this.rig.camera;
    u.height = terrainHeight(u.dir.x, u.dir.y, u.dir.z);
    // Published on the body so the third-person pose can raise the weapon to
    // where the player is looking.
    u.aimPitch = this.pitch;

    // The bob. Vertical at twice the stride, lateral and roll at the stride,
    // all scaled by the smoothed speed and lifted by sprint.
    const amp = this.moveT * (1 + (SPRINT_BOB - 1) * this.sprintT);
    const s1 = Math.sin(this.stride);
    const s2 = Math.sin(this.stride * 2);
    const bobY = s2 * BOB_Y * amp;
    const bobX = s1 * BOB_X * amp;
    const wantRoll = s1 * BOB_ROLL * amp + this.vel.y * STRAFE_ROLL;
    this.roll += (wantRoll - this.roll) * Math.min(1, dtShake * 12 + (dtShake === 0 ? 1 : 0) * 0);

    const alt = Math.max(u.height, 0.03) + (u.hop || 0);
    _right.crossVectors(u.fwd, u.dir).normalize();
    _eye.copy(u.dir).multiplyScalar(
      R + alt + EYE_HEIGHT * u.type.scale + bobY + this.springY * 0.11 - this.kick * 0.06);
    _eye.addScaledVector(_right, bobX);
    this.aimDir(_aim);
    // Published on the body so the strike paths aim where the player is
    // looking rather than where the feet are pointed.
    if (!u.aim) u.aim = new THREE.Vector3();
    u.aim.copy(_aim);
    _look.copy(_eye).addScaledVector(_aim, 4);
    cam.up.copy(u.dir);

    if (this.boom > 0.01) {
      // The boom direction trails the aim, so a turn swings the camera round
      // behind the body rather than snapping it there.
      if (!this._tpAimSet) { this._tpAim.copy(_aim); this._tpAimSet = true; }
      // Rotated toward the aim by ANGLE, never lerped. A lerp between two
      // near-opposite unit vectors shrinks through zero and normalises back
      // to where it started, so after a 180 degree flick the boom stayed
      // behind the OLD facing for good and the tree it had ducked never
      // released it. The rate has a floor so a big turn completes in about
      // half a second rather than asymptotically.
      const dotA = clamp(this._tpAim.dot(_aim), -1, 1);
      const angA = Math.acos(dotA);
      if (angA > 1e-4) {
        _axis.crossVectors(this._tpAim, _aim);
        if (_axis.lengthSq() < 1e-8) _axis.copy(u.dir);
        _axis.normalize();
        const step = Math.min(angA, Math.max(angA * Math.min(1, dtShake * TP_LAG), Math.min(angA, dtShake * TP_LAG_FLOOR)));
        this._tpAim.applyAxisAngle(_axis, step).normalize();
      }
      // Swing back along the reverse of the aim and out to the shoulder, then
      // pull in if the ground is in the way - a boom that clips through a hill
      // is worse than a short one.
      _tp.copy(_eye)
        .addScaledVector(this._tpAim, -this.boom)
        .addScaledVector(_right, TP_SHOULDER * Math.min(1, this.boom / 2));
      _gn.copy(_tp).normalize();
      const ground = R + Math.max(terrainHeight(_gn.x, _gn.y, _gn.z), 0) + TP_CLEAR;
      if (_tp.length() < ground) _tp.setLength(ground);
      // A tree between the eye and the boom pulls the camera in front of it.
      // Eased asymmetrically: quick to duck inside a trunk that just came
      // between, slower to let the boom back out, so a run through a wood
      // does not pump the camera.
      let allow = 1;
      if (this.world) {
        const t = this.world.decorHit(_eye, _tp, 1.1);
        if (t >= 0) allow = Math.max(0.12, t - 0.12);
      }
      const rate = allow < this.boomAllow ? 18 : 5;
      this.boomAllow += (allow - this.boomAllow) * Math.min(1, dtShake * rate + (dtShake === 0 ? 1 : 0));
      if (this.boomAllow < 0.999) _tp.lerpVectors(_eye, _tp, this.boomAllow);
      cam.position.copy(_tp);
      // Look past the head rather than at the feet, so the body sits low in
      // frame the way an over-the-shoulder camera should.
      _look.copy(_eye).addScaledVector(_aim, 6);
    } else {
      this._tpAimSet = false;
      cam.position.copy(_eye);
    }
    cam.lookAt(_look);
    // Roll is applied about the view axis after lookAt, so it never leaks
    // into the aim. Third person keeps a quarter of it: the body is what
    // leans there, not the eye.
    const roll = this.roll * (this.boom > 0.01 ? 0.25 : 1);
    if (Math.abs(roll) > 1e-5) cam.rotateZ(roll);

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

    // The lens: the archetype's base, widened by sprint and by brief kicks.
    const fov = (this.baseFov || cam.fov) + SPRINT_FOV * this.sprintT + this.fovKick;
    let proj = false;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; proj = true; }
    // The orbit near plane is metres deep and swallowed everything close to the
    // eye, weapon included. Saved and restored so orbit keeps its own.
    if (this._savedNear === null) this._savedNear = cam.near;
    if (cam.near !== FP_NEAR) { cam.near = FP_NEAR; proj = true; }
    if (proj) cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }
}
