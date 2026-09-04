import * as THREE from 'three';
import { CONFIG, CAM_TUNE, REDUCED_MOTION } from './config.js';
import { clamp, lerp, easeInOut, easeOutCubic } from './noise.js';

const _aim = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _ndc = new THREE.Vector3();
const _rdir = new THREE.Vector3();
const _grabNow = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _camStart = new THREE.Vector3();
const _probeHit = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _focusDir = new THREE.Vector3();
const _focusPt = new THREE.Vector3();
const _east = new THREE.Vector3();
const _north = new THREE.Vector3();
const _head = new THREE.Vector3();
const _axis = new THREE.Vector3();

// Smallest world scale the height sliders are measured against. Chosen so a
// planetoid's closest zoom holds about as many towers as a colossal planet's
// does, since tower and unit models are one absolute size on every map.
const MIN_CAM_SCALE = 150;

// Absolute floor on camera height. Towers stand about 3 units tall, so any
// closer than this and the camera is inside the thing it is framing.
const MIN_CAM_HEIGHT = 6;

// Height, in multiples of a cap's surface radius, at which the default lens and
// pitch put the whole cap on screen. Measured, not guessed.
const FRONTIER_FRAME = 3.9;

// Focus rig: the camera orbits a point on the surface that is pinned to the
// centre of the screen. `lon`/`lat` are that focus point, `dist` is the
// camera's height above the ground, and pitch is measured from straight down.
// The camera is placed at the angular offset that makes the view through
// screen centre land exactly on the focus, so changing pitch or zoom never
// slides the world sideways: what you are looking at stays under the
// crosshair. Confinement, flights and panning all steer the focus, which is
// why a walled battlefield can now be centred right on its own edge.
//
// Panning works in the tangent plane at the focus using the camera's own world
// basis, so drag direction stays screen-true under any view rotation or pitch.
// Everything a player can feel (lens, pitch, height limits, speeds) reads from
// CAM_TUNE every frame.

const PAN_KEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [1, 0], ArrowLeft: [1, 0],
  KeyD: [-1, 0], ArrowRight: [-1, 0],
};

export class OrbitRig {
  constructor(canvas) {
    this.canvas = canvas;
    const c = CONFIG.camera;
    this.camera = new THREE.PerspectiveCamera(CAM_TUNE.fovNear, 1, c.near, c.far);

    this.lon = 0.6;
    this.lat = 0.42;
    this.focusDist = CONFIG.planetRadius;
    this.dist = this.defaultDist;
    this.targetDist = this.dist;
    this.velLon = 0;
    this.velLat = 0;

    this.trauma = 0;
    this.fovKickV = 0;
    this.autoOrbit = 0;          // rad/s, used by the title screen
    this.flight = null;          // active tween {fromLon...toDist,t,dur}
    this.shakeEnabled = !REDUCED_MOTION;
    this.frontierTheta = null;   // live cap angle when a mode drives one
    this.confine = null;         // {center: Vector3, maxAng} battlefield bounds
    this.onWheelOverride = null; // (e) => true to consume the wheel elsewhere
    this.dragClaim = null;       // (e) => true to take this drag for a mode
    this.confineHits = 0;        // times the boundary clamped the view
    this.viewYaw = 0;            // ctrl+middle drag / Q,E: spin the view
    this.tiltOffset = 0;         // ctrl+middle drag: manual pitch offset
    this.appliedTilt = Math.asin(clamp(
      (CONFIG.planetRadius / (CONFIG.planetRadius + this.defaultDist))
      * Math.cos(CAM_TUNE.viewNear * (Math.PI / 180)), -1, 1,
    ));
    this.rotating = false;

    this.dragging = false;
    this.dragButton = 0;
    this.dragMoved = 0;
    this.lastX = 0; this.lastY = 0;
    this.pointers = new Map();
    this.pinchDist = 0;
    this.keys = new Set();
    this.grabDir = new THREE.Vector3();
    this.grabValid = false;
    this.rayHit = false;         // last screen ray actually met the globe
    this.grabR = CONFIG.planetRadius + 1;
    this.surfaceProbe = null;    // (origin, dir, out) => bool, set by main

    this.onTap = null;           // (clientX, clientY, button)
    this.onHover = null;         // (clientX, clientY)
    this.onDragStart = null;

    this._noiseT = Math.random() * 100;
    this._bind();
  }

  _bind() {
    const el = this.canvas;
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('pointerdown', (e) => {
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic or stale pointer */ }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (e.button === 1) e.preventDefault();
      if (this.pointers.size === 1) {
        // A mode can claim a left drag for itself - the marquee needs the same
        // gesture the pan uses. Asked before any drag state is set up, so a
        // claimed gesture never half-starts a pan.
        if (this.dragClaim && this.dragClaim(e)) { this.dragging = false; return; }
        this.dragging = true;
        this.rotating = e.button === 1 && e.ctrlKey;
        this.dragButton = e.button;
        this.dragMoved = 0;
        this.lastX = e.clientX; this.lastY = e.clientY;
        this.velLon = 0; this.velLat = 0;
        // Remember the exact point of the globe under the cursor; the drag
        // keeps that point pinned to the cursor for the rest of the gesture.
        this.grabR = this.rotating ? CONFIG.planetRadius + 1 : this._pickGrabRadius(e.clientX, e.clientY);
        this.grabValid = !this.rotating && this._screenToSphere(e.clientX, e.clientY, this.grabDir);
        this._grabOff = this.grabValid && !this.rayHit;
        if (this.onDragStart) this.onDragStart();
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });

    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (p) { p.x = e.clientX; p.y = e.clientY; }

      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist > 0) this.zoomBy((this.pinchDist - d) * 0.004);
        this.pinchDist = d;
        return;
      }
      if (this.dragging && p) {
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.lastX = e.clientX; this.lastY = e.clientY;
        this.dragMoved += Math.abs(dx) + Math.abs(dy);
        if (this.rotating) {
          // ctrl + middle drag: yaw spins the view, vertical adjusts pitch
          this.viewYaw -= dx * 0.0052;
          this.tiltOffset = clamp(this.tiltOffset + dy * 0.0042, -0.55, 0.75);
        } else if (this.dragMoved > 4) {
          // Pass the pixel delta so the grab solve can hold itself to a sane
          // angular rate. Without it the limb is a singularity (see panGrab).
          if (this.grabValid) this.panGrab(e.clientX, e.clientY, Math.hypot(dx, dy));
          else this.panPixels(dx, dy, true);
        }
      } else if (this.onHover) {
        this.onHover(e.clientX, e.clientY);
      }
      if (this.dragging && this.dragMoved > 4 && this.onHover) this.onHover(e.clientX, e.clientY);
    });

    const release = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchDist = 0;
      if (this.pointers.size === 0 && this.dragging) {
        this.dragging = false;
        if (this.rotating) {
          // a plain ctrl+middle click resets the view rotation
          if (this.dragMoved <= 4) this.resetView();
          this.rotating = false;
          return;
        }
        if (this.dragMoved <= 4 && this.onTap) this.onTap(e.clientX, e.clientY, this.dragButton);
      }
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      // While a unit is possessed the wheel belongs to that camera, not to the
      // orbit zoom, which is not driving anyway. Routed through a hook rather
      // than importing possession here, because the rig must not know the mode
      // exists.
      if (this.onWheelOverride && this.onWheelOverride(e)) return;
      this.zoomBy(e.deltaY * (e.deltaMode === 1 ? 0.03 : 0.0011));
    }, { passive: false });

    // Keyboard navigation. Ignored while a control has focus so sliders and
    // buttons keep their own arrow-key behavior.
    const typing = (e) => {
      const t = e.target;
      return e.ctrlKey || e.metaKey || e.altKey ||
        (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));
    };
    addEventListener('keydown', (e) => {
      if (typing(e)) return;
      if (PAN_KEYS[e.code] || e.code === 'KeyQ' || e.code === 'KeyE'
        || e.code === 'Equal' || e.code === 'Minus' || e.code === 'NumpadAdd' || e.code === 'NumpadSubtract') {
        this.keys.add(e.code);
        if (e.code.startsWith('Arrow')) e.preventDefault();
      } else if (e.code === 'KeyR') {
        this.resetView();
      }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  resetView() {
    this.viewYaw = 0;
    this.tiltOffset = 0;
  }

  // Live zoom bounds from the player's tuning.
  // A third of the way out: close enough to read the ground, far enough to see
  // the shape of the fight.
  get defaultDist() {
    return lerp(this.distMin, this.distMax, 0.33);
  }

  // What the height sliders are multiples of: the size of the thing being
  // played on, not the rock it sits on. A planetary map is the whole globe, so
  // that is the planet radius. A battlefield or asteroid field is a cap, and
  // its playable extent is the cap's surface radius, so one slider setting
  // frames a walled front and a whole planet alike. Scaling a cap map off the
  // planet instead parked the camera 60 units above a field 67 units wide,
  // which is why Titan's Brow could never get close to anything.
  // Towers and units are one absolute size on every map, so a scale that
  // tracked radius alone framed a planetoid far too tightly: at R30 the
  // closest zoom spanned 3.3 ground units, narrower than the worldheart's own
  // no-build radius. The floor keeps the close view holding a comparable
  // number of towers whatever the world is sized.
  get camScale() {
    const R = CONFIG.planetRadius;
    // A mode with a growing frontier writes its CURRENT angle here, so how far
    // the player may pull back expands with the territory they hold rather
    // than being fixed at the final size from wave one.
    const theta = this.frontierTheta ?? CONFIG.map.fieldTheta;
    // A cap map is already sized by its own playable extent, so it takes no
    // floor: forcing one on the asteroid field pushed the camera so far out
    // that almost no rock was in reach of a click.
    if (theta) return R * theta * 2.2;
    return Math.max(R, MIN_CAM_SCALE);
  }

  // Height of the camera above the ground, in units of camScale.
  get distMin() {
    // Floored in absolute units. A frontier-scaled camScale shrinks with a
    // small circle, and 0.04 of a 26-unit scale put the camera about a metre
    // off the ground - inside the towers it was meant to be looking at.
    return Math.max(this.camScale * CAM_TUNE.minAlt, MIN_CAM_HEIGHT);
  }

  /* The FAR limit is measured against the planet radius, not camScale, and the
     two are deliberately different scales.

     distMin is a gameplay framing: camScale carries a floor so a tiny world
     still holds a comparable number of towers in view, which is the right
     instinct up close and has nothing to do with the planet's size.

     distMax is a picture of the planet, and what decides that picture is the
     angular radius asin(R/(R+h)), which depends only on h/R. Multiplying by
     camScale broke exactly that: on the planetoid camScale floors at 150
     against R=30, so a setting meaning "4 radii out" silently became twenty,
     and camTest caught it as cursor tracking degrading to 26px of error at the
     far end while the giant world sat at 0. Against R the same number frames
     every world alike, which is what the slider's own "xR" label promises. */
  get distMax() {
    const d = this.distMin;
    const planetCeiling = CONFIG.planetRadius * CAM_TUNE.maxAlt;
    if (this.frontierTheta !== null) {
      // A growing frontier bounds the ceiling by the TERRITORY, so pulling back
      // is limited by what you hold and expands as you take ground. The factor
      // is the measured height at which the default lens and pitch frame a cap
      // edge to edge, so max zoom always shows the circle and no more. It still
      // tops out at the planet-relative ceiling: once the whole cap is in frame
      // extra height buys nothing.
      const capArc = CONFIG.planetRadius * this.frontierTheta;
      const framed = Math.min(capArc * FRONTIER_FRAME, planetCeiling);
      return Math.max(framed, d + 2, d * 1.6);
    }
    // Always leave a usable zoom band, however the two height sliders are set.
    return Math.max(planetCeiling, d + 2, d * 1.15);
  }

  // Angle from straight down to the horizon, seen from a camera at height h.
  // The pitch has to stay inside this or the view slides off the limb.
  _horizonAt(h) {
    const R0 = CONFIG.planetRadius;
    return Math.asin(clamp(R0 / (R0 + Math.max(h, 0.2)), -1, 1));
  }

  // Normalized zoom, 0 fully in, 1 fully out. Consumers drive the
  // strategic-scale presentation (model swell, icon layer) from this.
  get zoomT() {
    return clamp((this.dist - this.distMin) / Math.max(this.distMax - this.distMin, 1), 0, 1);
  }

  // Wheel steps are geometric in altitude but normalised to the zoom band, so
  // one notch always covers the same fraction of the range whatever the planet
  // size or how narrow the height limits are. Sizing steps against absolute
  // distance instead made a notch jump half the band on a colossal world.
  zoomBy(amount) {
    const dMin = this.distMin, dMax = this.distMax;
    const aMin = Math.max(dMin, 0.05);
    const aMax = Math.max(dMax, aMin * 1.0001);
    const span = Math.log(aMax / aMin);
    const alt = clamp(this.targetDist, aMin, aMax);
    // Scaled so the shipped 15% crosses the range in about twenty notches:
    // fine control by default, with headroom above for a fast zoom.
    const step = amount * 3 * (CAM_TUNE.zoomSpeed / 100);
    let nextAlt;
    if (span > 1e-4) {
      const t = clamp(Math.log(alt / aMin) / span + step, 0, 1);
      nextAlt = aMin * Math.exp(t * span);
    } else {
      nextAlt = clamp(alt + (aMax - aMin) * step, aMin, aMax);
    }
    this.targetDist = clamp(nextAlt, dMin, dMax);
  }

  // Ground units per screen pixel at the aim point, split into the screen
  // horizontal and vertical axes: pitch foreshortens the vertical axis, so
  // the two differ and the world tracks the cursor in both.
  _panScale() {
    const R0 = CONFIG.planetRadius;
    // Scale from the true camera-to-focus distance: that is the depth of the
    // ground at screen centre, so a pixel of drag maps to the right arc.
    const L = Math.max(this.focusDist || this.dist, 0.6);
    const H = Math.max(this.canvas.clientHeight || innerHeight || 720, 1);
    const tanHalf = Math.tan((this.camera.fov * Math.PI) / 360);
    const base = ((2 * L * tanHalf) / (H * R0)) * (CAM_TUNE.panMul / 100);
    const ct = Math.max(Math.cos(this.appliedTilt), 0.4);
    return { h: base, v: base / ct };
  }

  // Direction on the grab sphere under a screen pixel. Rays that miss the
  // globe (past the limb, or wide-lens screen corners) fall back to their
  // closest approach so a drag never freezes mid-gesture.
  _screenRay(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const rw = rect.width > 1 ? rect.width : (innerWidth || 1280);
    const rh = rect.height > 1 ? rect.height : (innerHeight || 720);
    const nx = ((clientX - rect.left) / rw) * 2 - 1;
    const ny = -((clientY - rect.top) / rh) * 2 + 1;
    _ndc.set(nx, ny, 0.5).unproject(this.camera);
    _rdir.copy(_ndc).sub(this.camera.position);
    if (_rdir.lengthSq() < 1e-12) return false;
    _rdir.normalize();
    return true;
  }

  // Anchor the drag to whatever the cursor is actually over: a mountain, a
  // floating rock, or sea level. Grabbing a fixed shell instead makes the
  // world slide under the pointer wherever the real surface is elsewhere.
  _pickGrabRadius(clientX, clientY) {
    let r = CONFIG.planetRadius + 1;
    if (this.surfaceProbe && this._screenRay(clientX, clientY)
      && this.surfaceProbe(this.camera.position, _rdir, _probeHit)) {
      const hit = _probeHit.length();
      if (Number.isFinite(hit)) {
        r = clamp(hit, CONFIG.planetRadius * 0.5, CONFIG.planetRadius * 1.6);
      }
    }
    return r;
  }

  _screenToSphere(clientX, clientY, out) {
    if (!this._screenRay(clientX, clientY)) return false;

    const o = this.camera.position;
    const b = o.dot(_rdir);
    const disc = b * b - (o.lengthSq() - this.grabR * this.grabR);
    if (disc > 0) {
      const t = -b - Math.sqrt(disc);
      if (t > 0) {
        out.copy(o).addScaledVector(_rdir, t).normalize();
        this.rayHit = true;
        return true;
      }
    }
    // Cursor is off the globe (past the limb, or a wide lens looking at sky).
    // Continue on the plane tangent at the grabbed point so the drag stays
    // smooth instead of snapping to the silhouette.
    this.rayHit = false;
    const denom = _rdir.dot(this.grabDir);
    if (Math.abs(denom) > 1e-4) {
      const tp = (this.grabR - o.dot(this.grabDir)) / denom;
      if (tp > 0) {
        out.copy(o).addScaledVector(_rdir, tp);
        if (out.lengthSq() > 1e-9) { out.normalize(); return true; }
      }
    }
    out.copy(o).addScaledVector(_rdir, -b);
    if (out.lengthSq() < 1e-9) return false;
    out.normalize();
    return true;
  }

  // Place the camera so the focus point sits dead centre at the current pitch.
  //
  // With the camera at radius Rc and the focus on the surface at radius R, an
  // angular separation a puts the focus at tilt t from the camera's nadir
  // where sin(a + t) = (Rc / R) sin t. Solving that for a is what keeps the
  // crosshair welded to the ground through any pitch or zoom change. Beyond
  // the horizon angle there is no solution, so the pitch is capped there.
  _placeCamera(shakeX = 0, shakeY = 0, shakeZ = 0) {
    const R0 = CONFIG.planetRadius;
    const h = Math.max(this.dist, 0.2);
    const Rc = R0 + h;

    // The near plane has to follow the camera down. A fixed near derived from
    // the planet radius cannot work once the minimum height is a slider: at
    // the closest zoom on a colossal world the nearest tower vertex measured
    // 3.97 units against a near plane of 4, so tower geometry was already
    // being sliced, and a lower Min height or a taller tower widens that. Ties
    // to altitude instead, which is what actually sets how close geometry can
    // get, and stays well clear of the far plane for depth precision.
    const wantNear = clamp(h * 0.12, 0.2, R0 / 40);
    if (Math.abs(this.camera.near - wantNear) > wantNear * 0.02) {
      this.camera.near = wantNear;
      this.camera.updateProjectionMatrix();
    }

    const cosLat = Math.cos(this.lat);
    _focusDir.set(Math.sin(this.lon) * cosLat, Math.sin(this.lat), Math.cos(this.lon) * cosLat);
    _focusPt.copy(_focusDir).multiplyScalar(R0);

    if (Math.abs(_focusDir.y) < 0.94) _east.set(0, 1, 0); else _east.set(1, 0, 0);
    _north.crossVectors(_focusDir, _east).normalize();
    _east.crossVectors(_north, _focusDir).normalize();
    _head.copy(_east).multiplyScalar(Math.cos(this.viewYaw))
      .addScaledVector(_north, Math.sin(this.viewYaw)).normalize();

    // Horizon from this height; pitch beyond it would stare into empty sky.
    // The pitch is solved from a view angle that already keeps it under this,
    // so the clamp is a guard against a bad external write rather than part of
    // the framing, and its margin stays small enough not to bend a low view.
    const horizon = Math.asin(clamp(R0 / Rc, -1, 1));
    const tilt = clamp(this.appliedTilt, -0.35, horizon - 0.0005);
    const alpha = Math.asin(clamp((Rc / R0) * Math.sin(tilt), -1, 1)) - tilt;

    _axis.crossVectors(_focusDir, _head).normalize();
    _camDir.copy(_focusDir).applyAxisAngle(_axis, -alpha).normalize();

    this.camera.position.copy(_camDir).multiplyScalar(Rc);
    this.camera.position.x += shakeX;
    this.camera.position.y += shakeY;
    this.camera.position.z += shakeZ;
    this.camera.up.copy(_camDir);
    this.camera.lookAt(_focusPt);
    this.camera.updateMatrixWorld();
    this.focusDist = this.camera.position.distanceTo(_focusPt);
  }

  // Cheap camera resync so several pointer events inside one frame each see
  // the pose their predecessor produced (otherwise a fast drag over-rotates).
  _syncCamera() {
    this._placeCamera();
  }

  // Exact grab-the-world panning: rotate the rig so the point grabbed at
  // pointer-down sits back under the cursor. Correct by construction at any
  // lens, pitch, view rotation, zoom, and planet size, and self-correcting
  // because the anchor never moves during the gesture.
  panGrab(clientX, clientY, pxMoved = 0) {
    const prevLat = this.lat, prevLon = this.lon;
    this.flight = null;
    this.autoOrbit = 0;

    // Track whether the cursor is on the globe. Leaving it and coming back
    // re-anchors the grab, so the view never jumps when the cursor returns
    // from open sky.
    if (this._screenToSphere(clientX, clientY, _grabNow)) {
      if (this._grabOff && this.rayHit) {
        this.grabDir.copy(_grabNow);
        this._grabOff = false;
        return;
      }
      this._grabOff = !this.rayHit;
    }

    const startLat = this.lat, startLon = this.lon;
    const cl0 = Math.cos(startLat);
    _camStart.set(Math.sin(startLon) * cl0, Math.sin(startLat), Math.cos(startLon) * cl0);
    // Rotating the rig also changes which ray passes through the cursor, so
    // the fixed point is found by iteration. Convergence is linear and can be
    // as slow as 0.7 per pass when the pitch feeds back into the solve, so the
    // cap is generous; the early exit means the common case costs two passes.
    for (let iter = 0; iter < 32; iter++) {
      if (!this._screenToSphere(clientX, clientY, _grabNow)) break;
      if (_grabNow.dot(this.grabDir) > 1 - 1e-10) break;
      _q.setFromUnitVectors(_grabNow, this.grabDir);
      const cosLat = Math.cos(this.lat);
      _camDir.set(Math.sin(this.lon) * cosLat, Math.sin(this.lat), Math.cos(this.lon) * cosLat);
      _camDir.applyQuaternion(_q).normalize();
      this.lat = clamp(Math.asin(clamp(_camDir.y, -1, 1)), -CONFIG.camera.latClamp, CONFIG.camera.latClamp);
      this.lon = Math.atan2(_camDir.x, _camDir.z);
      this._syncCamera();
    }

    /* RATE LIMIT, not a flat cap. The old cap was a constant 1.0 rad on the
       globe, which is 57 degrees of planet rotation permitted in a SINGLE
       pointermove, and several of those arrive per frame. That is why dragging
       near the edge span the world away: the screen-to-sphere map is singular
       at the limb, where the surface turns parallel to the view ray and
       d(angle)/d(pixel) goes to infinity, so a two-pixel jitter could ask for
       a huge swing and the cap was too loose to refuse it.

       The honest bound is angular scale per pixel. A screen-locked drag at the
       sub-camera point rotates about fov/height radians per pixel, and the
       limb legitimately needs more than that because of foreshortening, so the
       tolerance is generous rather than tight. It is a leash on the
       singularity, not on the feel: an ordinary drag never comes near it.

       The floor keeps slow, sub-pixel-per-event drags from stalling, and the
       old 1.0 stays as an absolute backstop. */
    const clNow = Math.cos(this.lat);
    _camDir.set(Math.sin(this.lon) * clNow, Math.sin(this.lat), Math.cos(this.lon) * clNow);
    const moved = Math.acos(clamp(_camStart.dot(_camDir), -1, 1));
    const vh = Math.max(this.canvas?.clientHeight || 0, 1);
    const radPerPx = (this.camera.fov * Math.PI / 180) / vh;
    const tol = this.rayHit ? 6 : 2;
    const CAP = Math.min(1.0, Math.max(0.012, pxMoved * radPerPx * tol));
    if (moved > CAP) {
      const s = Math.sin(moved);
      const a = Math.sin((1 - CAP / moved) * moved) / s;
      const b2 = Math.sin((CAP / moved) * moved) / s;
      _camDir.set(
        _camStart.x * a + _camDir.x * b2,
        _camStart.y * a + _camDir.y * b2,
        _camStart.z * a + _camDir.z * b2,
      ).normalize();
      this.lat = clamp(Math.asin(clamp(_camDir.y, -1, 1)), -CONFIG.camera.latClamp, CONFIG.camera.latClamp);
      this.lon = Math.atan2(_camDir.x, _camDir.z);
      this._syncCamera();
    }

    let dLon = this.lon - prevLon;
    while (dLon > Math.PI) dLon -= Math.PI * 2;
    while (dLon < -Math.PI) dLon += Math.PI * 2;
    this.velLon = dLon * 60;
    this.velLat = (this.lat - prevLat) * 60;
  }

  // Pan by a screen-space pixel delta. Uses the camera's own world basis
  // projected into the tangent plane, so screen direction is preserved under
  // any view rotation or pitch.
  panPixels(dx, dy, withInertia = false) {
    if (!dx && !dy) return;
    this.flight = null;
    this.autoOrbit = 0;
    const s = this._panScale();

    const cosLat = Math.cos(this.lat);
    _aimDir.set(Math.sin(this.lon) * cosLat, Math.sin(this.lat), Math.cos(this.lon) * cosLat);

    this.camera.updateMatrixWorld();
    this.camera.matrixWorld.extractBasis(_right, _up, _fwd);
    _right.addScaledVector(_aimDir, -_right.dot(_aimDir));
    if (_right.lengthSq() < 1e-9) return;
    _right.normalize();
    _up.addScaledVector(_aimDir, -_up.dot(_aimDir));
    if (_up.lengthSq() < 1e-9) _up.crossVectors(_aimDir, _right).normalize();
    else _up.normalize();

    const prevLat = this.lat, prevLon = this.lon;
    // grab-the-world: the surface follows the cursor
    _aimDir.addScaledVector(_right, -dx * s.h).addScaledVector(_up, dy * s.v).normalize();
    this.lat = clamp(Math.asin(clamp(_aimDir.y, -1, 1)), -CONFIG.camera.latClamp, CONFIG.camera.latClamp);
    this.lon = Math.atan2(_aimDir.x, _aimDir.z);

    if (withInertia) {
      let dLon = this.lon - prevLon;
      while (dLon > Math.PI) dLon -= Math.PI * 2;
      while (dLon < -Math.PI) dLon += Math.PI * 2;
      this.velLon = dLon * 60;
      this.velLat = (this.lat - prevLat) * 60;
    }
  }

  _keyboardStep(dt) {
    if (!this.keys.size) return;
    let kx = 0, ky = 0;
    for (const code of this.keys) {
      const v = PAN_KEYS[code];
      if (v) { kx += v[0]; ky += v[1]; }
    }
    if (kx || ky) {
      const len = Math.hypot(kx, ky) || 1;
      const px = (this.canvas.clientHeight || innerHeight || 720) * 1.15 * dt;
      this.panPixels((kx / len) * px, (ky / len) * px, false);
      this.velLon = 0; this.velLat = 0;
    }
    if (this.keys.has('KeyQ')) this.viewYaw += 1.5 * dt;
    if (this.keys.has('KeyE')) this.viewYaw -= 1.5 * dt;
    if (this.keys.has('Equal') || this.keys.has('NumpadAdd')) this.zoomBy(-1.3 * dt);
    if (this.keys.has('Minus') || this.keys.has('NumpadSubtract')) this.zoomBy(1.3 * dt);
  }

  // Fly the rig to look at a world-space point on the planet.
  flyTo(point, dist = null, dur = 0.9) {
    const lat = Math.asin(clamp(point.y / point.length(), -1, 1));
    const lon = Math.atan2(point.x, point.z);
    let dLon = lon - (this.lon % (Math.PI * 2));
    while (dLon > Math.PI) dLon -= Math.PI * 2;
    while (dLon < -Math.PI) dLon += Math.PI * 2;
    this.flight = {
      fromLon: this.lon, toLon: this.lon + dLon,
      fromLat: this.lat, toLat: clamp(lat, -CONFIG.camera.latClamp, CONFIG.camera.latClamp),
      fromDist: this.targetDist,
      toDist: clamp(dist ?? this.targetDist, this.distMin, this.distMax),
      t: 0, dur: REDUCED_MOTION ? 0.01 : dur, ease: easeInOut,
    };
    this.velLon = 0; this.velLat = 0;
  }

  introFlight(targetDir = null) {
    const c = CONFIG.camera;
    let toLon = 0.62, toLat = 0.34;
    if (targetDir) {
      toLat = clamp(Math.asin(clamp(targetDir.y, -1, 1)), -c.latClamp * 0.85, c.latClamp * 0.85);
      toLon = Math.atan2(targetDir.x, targetDir.z);
    }
    const fromDist = this.distMax;
    this.lon = toLon - 1.1;
    this.lat = clamp(toLat + 0.28, -c.latClamp, c.latClamp);
    this.dist = fromDist; this.targetDist = fromDist;
    this.flight = {
      fromLon: this.lon, toLon,
      fromLat: this.lat, toLat,
      fromDist, toDist: this.defaultDist,
      t: 0, dur: REDUCED_MOTION ? 0.01 : 3.4, ease: easeOutCubic,
    };
  }

  skipFlight() {
    const f = this.flight;
    if (!f) return;
    this.lon = f.toLon; this.lat = f.toLat;
    this.dist = f.toDist; this.targetDist = f.toDist;
    this.flight = null;
  }

  addTrauma(amount) {
    if (!this.shakeEnabled) return;
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  fovKick(deg) {
    if (REDUCED_MOTION) return;
    this.fovKickV = Math.max(this.fovKickV, deg);
  }

  update(dt) {
    const c = CONFIG.camera;
    this._keyboardStep(dt);

    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = f.ease(f.t);
      this.lon = lerp(f.fromLon, f.toLon, e);
      this.lat = lerp(f.fromLat, f.toLat, e);
      this.dist = lerp(f.fromDist, f.toDist, e);
      this.targetDist = this.dist;
      if (f.t >= 1) this.flight = null;
    } else {
      if (!this.dragging) {
        this.lon += this.velLon * dt + this.autoOrbit * dt;
        this.lat = clamp(this.lat + this.velLat * dt, -c.latClamp, c.latClamp);
        const damp = Math.exp(-c.inertia * dt);
        this.velLon *= damp;
        this.velLat *= damp;
        if (Math.abs(this.velLon) < 1e-5) this.velLon = 0;
        if (Math.abs(this.velLat) < 1e-5) this.velLat = 0;
      }
      // Live tuning can tighten the bounds under the current position.
      this.targetDist = clamp(this.targetDist, this.distMin, this.distMax);
      this.dist = lerp(this.dist, this.targetDist, 1 - Math.exp(-c.zoomDamp * dt));
    }

    // Battlefield confinement: the aim point never leaves the walled zone.
    if (this.confine) {
      const cosLat0 = Math.cos(this.lat);
      _aim.set(Math.sin(this.lon) * cosLat0, Math.sin(this.lat), Math.cos(this.lon) * cosLat0);
      const cc = this.confine.center;
      const ang = Math.acos(clamp(_aim.dot(cc), -1, 1));
      if (ang > this.confine.maxAng) {
        const t = this.confine.maxAng / ang;
        const s = Math.sin(ang);
        _aim.multiplyScalar(Math.sin(t * ang) / s)
          .addScaledVector(cc, Math.sin((1 - t) * ang) / s)
          .normalize();
        this.lat = Math.asin(clamp(_aim.y, -1, 1));
        this.lon = Math.atan2(_aim.x, _aim.z);
        this.velLon *= 0.5;
        this.velLat *= 0.5;
        this.confineHits++;
      }
    }

    // Grounded RTS framing: close in the view pitches toward the horizon so
    // sky and distance fill the top of the frame; from orbit it settles back
    // to a map-like look-down.
    //
    // What the player reads as "how grounded is this" is the angle the camera
    // sits at above the ground it is looking at, measured AT that point. The
    // rig's pitch is measured at the camera instead, and the two differ by the
    // planet: sin(pitch) = (R/Rc)*cos(view). So a fixed pitch is a different
    // view on every world, which is why one tuning framed the colossal planet
    // and the planetoid quite differently. Interpolate the view angle, which
    // is size-independent, and solve the pitch that delivers it here.
    //
    // This is also inherently horizon-safe: cos(view) <= 1 puts the pitch at
    // or under asin(R/Rc), the horizon, for any world and any height, so the
    // old fraction-of-horizon juggling is no longer needed.
    const zt = this.zoomT;
    const viewNear = CAM_TUNE.viewNear * (Math.PI / 180);
    const viewFar = CAM_TUNE.viewFar * (Math.PI / 180);
    // A manual pitch nudge lowers the view toward the horizon, keeping the
    // drag direction it had when it fed the pitch directly.
    const view = clamp(
      lerp(viewNear, viewFar, zt * zt * (3 - 2 * zt)) - this.tiltOffset, 0.06, 1.5,
    );
    const R0 = CONFIG.planetRadius;
    const Rc = R0 + Math.max(this.dist, 0.2);
    const tiltTarget = Math.asin(clamp((R0 / Rc) * Math.cos(view), -1, 1));
    // Height is already eased (zoomDamp), and the pitch is a pure function of
    // it, so the pitch inherits that smoothing. Easing it a second time on its
    // own clock only made it lag the height it is derived from, which reads as
    // the view sagging flat while a fast scroll is still in flight.
    this.appliedTilt = tiltTarget;

    // Trauma shake: squared response, decaying, a positional wobble only.
    // Never enters simulation state.
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    let sx = 0, sy = 0, sz = 0;
    if (this.trauma > 0 && this.shakeEnabled) {
      this._noiseT += dt * 34;
      const sq = this.trauma * this.trauma;
      const amp = c.shakeMax * sq * clamp(this.dist / 60, 0.3, 3);
      sx = Math.sin(this._noiseT * 1.1) * Math.sin(this._noiseT * 0.63 + 2.1) * amp;
      sy = Math.sin(this._noiseT * 0.91 + 4.2) * Math.sin(this._noiseT * 1.37) * amp;
      sz = Math.sin(this._noiseT * 1.23 + 1.3) * Math.sin(this._noiseT * 0.77 + 3.7) * amp * 0.6;
    }

    this._placeCamera(sx, sy, sz);

    // Wide immersive lens on the ground, telephoto from orbit. Player-tunable.
    this.fovKickV = Math.max(0, this.fovKickV - dt * 26);
    const targetFov = lerp(CAM_TUNE.fovNear, CAM_TUNE.fovFar, this.zoomT) + this.fovKickV;
    const fov = this.camera.fov + (targetFov - this.camera.fov) * Math.min(1, dt * 7);
    if (Math.abs(this.camera.fov - fov) > 0.005) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  setAspect(aspect) {
    // A zero-size viewport (hidden tab, minimized window, mid-rotation on
    // mobile) yields 0/0 here; letting NaN reach the projection matrix black
    // screens the game until reload.
    this.camera.aspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
    this.camera.updateProjectionMatrix();
  }

  raycaster(clientX, clientY, target) {
    const rect = this.canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    target.setFromCamera({ x: nx, y: ny }, this.camera);
    return target;
  }
}
