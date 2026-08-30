import * as THREE from 'three';
import { CONFIG, REDUCED_MOTION } from './config.js';
import { clamp, lerp, easeInOut, easeOutCubic } from './noise.js';

// Orbit rig around the planet center with inertia, damped zoom, trauma shake,
// fov kicks, and a scripted intro flyby. Latitude is clamped so the rig never
// crosses a pole; gameplay content is generated inside the clamp band.

export class OrbitRig {
  constructor(canvas) {
    this.canvas = canvas;
    const c = CONFIG.camera;
    this.camera = new THREE.PerspectiveCamera(c.fov, 1, c.near, c.far);

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

    this.dragging = false;
    this.dragButton = 0;
    this.dragMoved = 0;
    this.lastX = 0; this.lastY = 0;
    this.pointers = new Map();
    this.pinchDist = 0;

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
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.dragging = true;
        this.dragButton = e.button;
        this.dragMoved = 0;
        this.lastX = e.clientX; this.lastY = e.clientY;
        this.velLon = 0; this.velLat = 0;
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
        if (this.dragMoved > 4) {
          this.flight = null;
          this.autoOrbit = 0;
          const s = CONFIG.camera.rotSpeed * this._distScale();
          this.lon -= dx * s;
          this.lat += dy * s;
          this.lat = clamp(this.lat, -CONFIG.camera.latClamp, CONFIG.camera.latClamp);
          this.velLon = -dx * s * 60;
          this.velLat = dy * s * 60;
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
        if (this.dragMoved <= 4 && this.onTap) this.onTap(e.clientX, e.clientY, this.dragButton);
      }
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomBy(e.deltaY * (e.deltaMode === 1 ? 0.03 : 0.0011));
    }, { passive: false });
  }

  _distScale() {
    return lerp(0.35, 1.15, (this.dist - CONFIG.camera.distMin) / (CONFIG.camera.distMax - CONFIG.camera.distMin));
  }

  zoomBy(amount) {
    this.targetDist = clamp(this.targetDist * Math.exp(amount), CONFIG.camera.distMin, CONFIG.camera.distMax);
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
      toDist: clamp(dist ?? this.targetDist, CONFIG.camera.distMin, CONFIG.camera.distMax),
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
    const fromDist = Math.min(c.distMax * 1.3, CONFIG.planetRadius * 5);
    this.lon = toLon - 2.5;
    this.lat = clamp(toLat + 0.55, -c.latClamp, c.latClamp);
    this.dist = fromDist; this.targetDist = fromDist;
    this.flight = {
      fromLon: this.lon, toLon,
      fromLat: this.lat, toLat,
      fromDist, toDist: c.distStart,
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
      }
      this.dist = lerp(this.dist, this.targetDist, 1 - Math.exp(-c.zoomDamp * dt));
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
    this.camera.lookAt(0, 0, 0);
    // Oblique framing: pitch up from the nadir as the camera closes in, so
    // nearby play reads at a 3/4 angle and the horizon stays in frame.
    const zoomT = (this.dist - c.distMin) / (c.distMax - c.distMin);
    this.camera.rotateX(lerp(0.34, 0.05, Math.min(1, zoomT * 1.4)));
    if (roll) this.camera.rotateZ(roll);

    this.fovKickV = Math.max(0, this.fovKickV - dt * 26);
    const fov = c.fov + this.fovKickV;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
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
