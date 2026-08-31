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

// Orbit rig around the planet center with inertia, damped zoom, trauma shake,
// fov kicks, and a scripted intro flyby. Latitude is clamped so the rig never
// crosses a pole; gameplay content is generated inside the clamp band.
//
// Panning works in the tangent plane at the aim point using the camera's own
// world basis, so drag direction stays screen-true under any view rotation or
// pitch. Everything a player can feel (lens, pitch, height limits, speeds)
// reads from CAM_TUNE every frame.

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
    this.dist = c.distStart;
    this.targetDist = c.distStart;
    this.velLon = 0;
    this.velLat = 0;

    this.trauma = 0;
    this.fovKickV = 0;
    this.autoOrbit = 0;          // rad/s, used by the title screen
    this.flight = null;          // active tween {fromLon...toDist,t,dur}
    this.shakeEnabled = !REDUCED_MOTION;
    this.confine = null;         // {center: Vector3, maxAng} battlefield bounds
    this.viewYaw = 0;            // ctrl+middle drag / Q,E: spin the view
    this.tiltOffset = 0;         // ctrl+middle drag: manual pitch offset
    this.appliedTilt = 0;        // total pitch used this frame
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
          if (this.grabValid) this.panGrab(e.clientX, e.clientY);
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
  get distMin() {
    return CONFIG.planetRadius + CAM_TUNE.minAlt;
  }

  get distMax() {
    return CONFIG.planetRadius * (1 + CAM_TUNE.maxAlt);
  }

  // Normalized zoom, 0 fully in, 1 fully out. Consumers drive the
  // strategic-scale presentation (model swell, icon layer) from this.
  get zoomT() {
    return clamp((this.dist - this.distMin) / Math.max(this.distMax - this.distMin, 1), 0, 1);
  }

  zoomBy(amount) {
    this.targetDist = clamp(
      this.targetDist * Math.exp(amount * (CAM_TUNE.zoomSpeed / 100)),
      this.distMin, this.distMax,
    );
  }

  // Ground units per screen pixel at the aim point, split into the screen
  // horizontal and vertical axes: pitch foreshortens the vertical axis, so
  // the two differ and the world tracks the cursor in both.
  _panScale() {
    const R0 = CONFIG.planetRadius;
    const alt = Math.max(this.dist - R0, 1.2);
    const H = Math.max(this.canvas.clientHeight || innerHeight || 720, 1);
    const tanHalf = Math.tan((this.camera.fov * Math.PI) / 360);
    const base = ((2 * alt * tanHalf) / (H * R0)) * (CAM_TUNE.panMul / 100);
    const ct = Math.max(Math.cos(this.appliedTilt), 0.4);
    return { h: base / ct, v: base / (ct * ct) };
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

  // Cheap camera resync so several pointer events inside one frame each see
  // the pose their predecessor produced (otherwise a fast drag over-rotates).
  _syncCamera() {
    const cosLat = Math.cos(this.lat);
    this.camera.position.set(
      Math.sin(this.lon) * cosLat * this.dist,
      Math.sin(this.lat) * this.dist,
      Math.cos(this.lon) * cosLat * this.dist,
    );
    this.camera.up.set(0, 1, 0);
    if (this.viewYaw) {
      _aim.copy(this.camera.position).normalize();
      this.camera.up.applyAxisAngle(_aim, this.viewYaw);
    }
    this.camera.lookAt(0, 0, 0);
    this.camera.rotateX(this.appliedTilt);
    this.camera.updateMatrixWorld();
  }

  // Exact grab-the-world panning: rotate the rig so the point grabbed at
  // pointer-down sits back under the cursor. Correct by construction at any
  // lens, pitch, view rotation, zoom, and planet size, and self-correcting
  // because the anchor never moves during the gesture.
  panGrab(clientX, clientY) {
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

    // A cursor on the globe may legitimately demand a large swing (near the
    // limb the ground genuinely races under the pointer), so only the
    // fabricated off-globe target is held to a tight leash. The generous
    // on-globe cap is a backstop against teleporting, nothing more.
    const clNow = Math.cos(this.lat);
    _camDir.set(Math.sin(this.lon) * clNow, Math.sin(this.lat), Math.cos(this.lon) * clNow);
    const moved = Math.acos(clamp(_camStart.dot(_camDir), -1, 1));
    const CAP = this.rayHit ? 1.0 : 0.12;
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
    const fromDist = Math.min(this.distMax * 1.15, CONFIG.planetRadius * 5);
    this.lon = toLon - 2.5;
    this.lat = clamp(toLat + 0.55, -c.latClamp, c.latClamp);
    this.dist = fromDist; this.targetDist = fromDist;
    this.flight = {
      fromLon: this.lon, toLon,
      fromLat: this.lat, toLat,
      fromDist, toDist: clamp(c.distStart, this.distMin, this.distMax),
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
      }
    }

    const cosLat = Math.cos(this.lat);
    const px = Math.sin(this.lon) * cosLat;
    const py = Math.sin(this.lat);
    const pz = Math.cos(this.lon) * cosLat;
    this.camera.position.set(px * this.dist, py * this.dist, pz * this.dist);

    // Trauma shake: squared response, decaying, applied as a positional wobble
    // plus a slight roll. Never enters simulation state.
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    let roll = 0;
    if (this.trauma > 0 && this.shakeEnabled) {
      this._noiseT += dt * 34;
      const sq = this.trauma * this.trauma;
      const amp = c.shakeMax * sq * (this.dist / 60);
      const n1 = Math.sin(this._noiseT * 1.1) * Math.sin(this._noiseT * 0.63 + 2.1);
      const n2 = Math.sin(this._noiseT * 0.91 + 4.2) * Math.sin(this._noiseT * 1.37);
      const n3 = Math.sin(this._noiseT * 1.23 + 1.3) * Math.sin(this._noiseT * 0.77 + 3.7);
      this.camera.position.x += n1 * amp;
      this.camera.position.y += n2 * amp;
      this.camera.position.z += n3 * amp * 0.6;
      roll = n3 * sq * 0.012;
    }

    this.camera.up.set(0, 1, 0);
    if (this.viewYaw) {
      _aim.copy(this.camera.position).normalize();
      this.camera.up.applyAxisAngle(_aim, this.viewYaw);
    }
    this.camera.lookAt(0, 0, 0);

    // Grounded RTS framing: close in, the view pitches toward the horizon so
    // sky and distance fill the top of the frame; from orbit it settles back
    // to a map-like look-down. Both ends are player-tunable.
    const tiltNear = CAM_TUNE.tiltNear * (Math.PI / 180);
    const tiltFar = CAM_TUNE.tiltFar * (Math.PI / 180);
    this.appliedTilt = clamp(
      lerp(tiltNear, tiltFar, Math.min(1, this.zoomT * 1.5)) + this.tiltOffset, -0.62, 1.55,
    );
    this.camera.rotateX(this.appliedTilt);
    if (roll) this.camera.rotateZ(roll);
    this.camera.updateMatrixWorld();

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
