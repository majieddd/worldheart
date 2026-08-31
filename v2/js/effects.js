import * as THREE from 'three';
import { CONFIG, PALETTE, REDUCED_MOTION } from './config.js';
import { clamp } from './noise.js';
import { R, groundNormal, orientOnSurface } from './world.js';

// Pooled visual effects. Nothing here allocates in the frame loop: every
// system pre-builds its buffers and recycles slots. Reduced motion trims
// counts and drops decorative bursts while keeping informational feedback.

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------
// Additive glow points

class GlowPoints {
  constructor(scene, max) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.lifeMax = new Float32Array(max);
    this.size = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.head = 0;
    this.alive = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.aCol = new THREE.BufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aColor', this.aCol);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aSize', this.aSize);

    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec4 aColor;
        attribute float aSize;
        varying vec4 vCol;
        uniform float uScale;
        void main() {
          vCol = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale * (240.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec4 vCol;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float m = smoothstep(0.5, 0.06, length(d));
          gl_FragColor = vec4(vCol.rgb * m, vCol.a * m);
        }
      `,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
    scene.add(this.points);
  }

  emit(px, py, pz, vx, vy, vz, colorHex, intensity, life, size, grav = 0) {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    this.pos[i * 3] = px; this.pos[i * 3 + 1] = py; this.pos[i * 3 + 2] = pz;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    _c.setHex(colorHex);
    this.col[i * 3] = _c.r * intensity; this.col[i * 3 + 1] = _c.g * intensity; this.col[i * 3 + 2] = _c.b * intensity;
    this.life[i] = life; this.lifeMax[i] = life;
    this.size[i] = size;
    this.grav[i] = grav;
  }

  update(dt) {
    const n = this.max;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) { this.aCol.array[i * 4 + 3] = 0; continue; }
      this.life[i] -= dt;
      const t = Math.max(this.life[i] / this.lifeMax[i], 0);
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.grav[i] !== 0) {
        // gravity pulls toward the planet center
        const px = this.pos[i * 3], py = this.pos[i * 3 + 1], pz = this.pos[i * 3 + 2];
        const il = this.grav[i] * dt / Math.hypot(px, py, pz);
        this.vel[i * 3] -= px * il; this.vel[i * 3 + 1] -= py * il; this.vel[i * 3 + 2] -= pz * il;
      }
      const fade = t * t;
      this.aCol.array[i * 4] = this.col[i * 3];
      this.aCol.array[i * 4 + 1] = this.col[i * 3 + 1];
      this.aCol.array[i * 4 + 2] = this.col[i * 3 + 2];
      this.aCol.array[i * 4 + 3] = fade;
      this.aSize.array[i] = this.size[i] * (0.6 + 0.4 * t);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aSize.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Solid debris shards (lit, gravity, spin)

class Shards {
  constructor(scene, max) {
    this.max = max;
    const geo = new THREE.TetrahedronGeometry(0.09);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1, flatShading: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = max;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);

    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.rot = new Float32Array(max * 4);
    this.spin = new Float32Array(max);
    this.life = new Float32Array(max);
    this.scl = new Float32Array(max);
    this.head = 0;
    for (let i = 0; i < max; i++) {
      _m4.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, _m4);
      _c.setHex(0xffffff);
      this.mesh.setColorAt(i, _c);
    }
  }

  burst(center, normal, count, colorHex, speed = 5, size = 1) {
    if (REDUCED_MOTION) count = Math.ceil(count / 3);
    for (let k = 0; k < count; k++) {
      const i = this.head;
      this.head = (this.head + 1) % this.max;
      this.pos[i * 3] = center.x; this.pos[i * 3 + 1] = center.y; this.pos[i * 3 + 2] = center.z;
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
        .addScaledVector(normal, 1.4).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.9));
      this.vel[i * 3] = _v.x; this.vel[i * 3 + 1] = _v.y; this.vel[i * 3 + 2] = _v.z;
      this.life[i] = 0.55 + Math.random() * 0.4;
      this.spin[i] = (Math.random() - 0.5) * 18;
      this.scl[i] = size * (0.6 + Math.random() * 0.9);
      _q.setFromAxisAngle(Y_AXIS, Math.random() * 6.28);
      this.rot[i * 4] = _q.x; this.rot[i * 4 + 1] = _q.y; this.rot[i * 4 + 2] = _q.z; this.rot[i * 4 + 3] = _q.w;
      _c.setHex(colorHex);
      const j = 0.75 + Math.random() * 0.5;
      _c.multiplyScalar(j);
      this.mesh.setColorAt(i, _c);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const px = this.pos[i * 3], py = this.pos[i * 3 + 1], pz = this.pos[i * 3 + 2];
      const d = Math.hypot(px, py, pz);
      const g = 16 * dt / d;
      this.vel[i * 3] -= px * g; this.vel[i * 3 + 1] -= py * g; this.vel[i * 3 + 2] -= pz * g;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      _q.set(this.rot[i * 4], this.rot[i * 4 + 1], this.rot[i * 4 + 2], this.rot[i * 4 + 3]);
      _qSpin.setFromAxisAngle(Y_AXIS, this.spin[i] * dt);
      _q.multiply(_qSpin);
      this.rot[i * 4] = _q.x; this.rot[i * 4 + 1] = _q.y; this.rot[i * 4 + 2] = _q.z; this.rot[i * 4 + 3] = _q.w;
      const s = this.life[i] > 0 ? this.scl[i] * Math.min(1, this.life[i] * 3) : 0;
      _v.set(px, py, pz);
      _m4.compose(_v, _q, _s.set(s, s, s));
      this.mesh.setMatrixAt(i, _m4);
      if (this.life[i] <= 0) {
        _m4.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, _m4);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
const _qSpin = new THREE.Quaternion();

// ---------------------------------------------------------------------------
// Ground ring pulses (instanced discs with per-instance progress via color)

class RingPulses {
  constructor(scene, max = 20) {
    this.max = max;
    const geo = new THREE.RingGeometry(0.82, 1, 40);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vICol;
        void main() {
          vUv = uv;
          vICol = instanceColor;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vICol;
        void main() {
          float ring = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
          gl_FragColor = vec4(vICol * 1.6, ring);
        }
      `,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = max;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    this.items = [];
    for (let i = 0; i < max; i++) {
      this.items.push({ life: 0, dur: 1, rMax: 1, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), color: new THREE.Color() });
      _m4.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, _m4);
      this.mesh.setColorAt(i, _c.setRGB(0, 0, 0));
    }
    this.head = 0;
  }

  spawn(pos, colorHex, rMax = 2.6, dur = 0.55) {
    const it = this.items[this.head];
    this.head = (this.head + 1) % this.max;
    it.life = dur; it.dur = dur; it.rMax = rMax;
    it.pos.copy(pos);
    _v.copy(pos).normalize();
    groundNormal(_v, _n);
    it.quat.setFromUnitVectors(Y_AXIS, _n);
    it.color.setHex(colorHex);
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const it = this.items[i];
      if (it.life <= 0) continue;
      it.life -= dt;
      const t = 1 - Math.max(it.life, 0) / it.dur;
      const ease = 1 - Math.pow(1 - t, 3);
      const r = it.rMax * ease;
      _v.copy(it.pos).addScaledVector(_v2.copy(it.pos).normalize(), 0.12);
      _m4.compose(_v, _mQuatTmp.copy(it.quat).multiply(_qFlat), _s.set(r, r, r));
      this.mesh.setMatrixAt(i, _m4);
      const fade = (1 - ease) * 0.9;
      this.mesh.setColorAt(i, _c.copy(it.color).multiplyScalar(fade));
      if (it.life <= 0) {
        _m4.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, _m4);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
const _qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const _mQuatTmp = new THREE.Quaternion();

// ---------------------------------------------------------------------------
// Chain lightning ribbons

const ZAP_SEGS = 14;
class ZapPool {
  constructor(scene, slots = 8) {
    this.slots = [];
    for (let s = 0; s < slots; s++) {
      const geo = new THREE.BufferGeometry();
      const posAttr = new THREE.BufferAttribute(new Float32Array((ZAP_SEGS + 1) * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', posAttr);
      const uv = new Float32Array((ZAP_SEGS + 1) * 2 * 2);
      for (let i = 0; i <= ZAP_SEGS; i++) {
        uv[(i * 2) * 2] = i / ZAP_SEGS; uv[(i * 2) * 2 + 1] = 0;
        uv[(i * 2 + 1) * 2] = i / ZAP_SEGS; uv[(i * 2 + 1) * 2 + 1] = 1;
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const idx = [];
      for (let i = 0; i < ZAP_SEGS; i++) {
        const a = i * 2, b = i * 2 + 1, cc = i * 2 + 2, d = i * 2 + 3;
        idx.push(a, b, cc, b, d, cc);
      }
      geo.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uCol: { value: new THREE.Color(PALETTE.energy) }, uAlpha: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform vec3 uCol; uniform float uAlpha;
          void main() {
            float core = smoothstep(0.0, 0.42, vUv.y) * smoothstep(1.0, 0.58, vUv.y);
            gl_FragColor = vec4(uCol * (1.0 + core * 2.4), uAlpha * (0.35 + core));
          }
        `,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 9;
      mesh.visible = false;
      scene.add(mesh);
      this.slots.push({ mesh, life: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), jitterT: 0, width: 0.09 });
    }
    this.head = 0;
    this.camera = null;
  }

  fire(from, to, colorHex = PALETTE.energy, dur = 0.14, width = 0.09) {
    const s = this.slots[this.head];
    this.head = (this.head + 1) % this.slots.length;
    s.from.copy(from); s.to.copy(to);
    s.life = dur; s.dur = dur; s.jitterT = 0; s.width = width;
    s.mesh.material.uniforms.uCol.value.setHex(colorHex);
    s.mesh.visible = true;
    this._shape(s);
  }

  _shape(s) {
    const posAttr = s.mesh.geometry.attributes.position;
    _v.copy(s.to).sub(s.from);
    const len = _v.length();
    // camera-facing width axis
    _n.copy(this.camera ? this.camera.position : _v2.set(0, 0, 1)).sub(s.from).normalize();
    _v2.copy(_v).normalize();
    _n.crossVectors(_v2, _n).normalize().multiplyScalar(s.width * (0.7 + len * 0.05));
    for (let i = 0; i <= ZAP_SEGS; i++) {
      const t = i / ZAP_SEGS;
      const amp = Math.sin(t * Math.PI) * len * 0.11;
      _s.set(
        s.from.x + _v.x * t, s.from.y + _v.y * t, s.from.z + _v.z * t,
      );
      if (i > 0 && i < ZAP_SEGS) {
        _s.x += (Math.random() - 0.5) * amp;
        _s.y += (Math.random() - 0.5) * amp;
        _s.z += (Math.random() - 0.5) * amp;
      }
      posAttr.array[(i * 2) * 3] = _s.x - _n.x;
      posAttr.array[(i * 2) * 3 + 1] = _s.y - _n.y;
      posAttr.array[(i * 2) * 3 + 2] = _s.z - _n.z;
      posAttr.array[(i * 2 + 1) * 3] = _s.x + _n.x;
      posAttr.array[(i * 2 + 1) * 3 + 1] = _s.y + _n.y;
      posAttr.array[(i * 2 + 1) * 3 + 2] = _s.z + _n.z;
    }
    posAttr.needsUpdate = true;
  }

  update(dt) {
    for (const s of this.slots) {
      if (s.life <= 0) { s.mesh.visible = false; continue; }
      s.life -= dt;
      s.jitterT -= dt;
      if (s.jitterT <= 0 && !REDUCED_MOTION) { this._shape(s); s.jitterT = 0.045; }
      s.mesh.material.uniforms.uAlpha.value = clamp(s.life / s.dur, 0, 1);
      if (s.life <= 0) s.mesh.visible = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Damage numbers (DOM pool, transform-only updates)

class DamageNumbers {
  constructor(camera) {
    this.camera = camera;
    this.max = CONFIG.limits.maxDamageNumbers;
    this.root = document.createElement('div');
    this.root.id = 'floaters';
    this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9;overflow:hidden;';
    document.body.appendChild(this.root);
    this.items = [];
    for (let i = 0; i < this.max; i++) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:0;top:0;font-family:"Chakra Petch","Segoe UI",sans-serif;' +
        'font-weight:600;font-size:13px;color:#e8ecf8;text-shadow:0 1px 6px rgba(9,12,28,0.9);' +
        'will-change:transform,opacity;opacity:0;';
      this.root.appendChild(el);
      this.items.push({ el, life: 0, pos: new THREE.Vector3(), vy: 0 });
    }
    this.head = 0;
  }

  spawn(pos, text, color = '#e8ecf8', size = 13) {
    const it = this.items[this.head];
    this.head = (this.head + 1) % this.max;
    it.pos.copy(pos);
    it.life = 0.8;
    it.vy = 0;
    it.el.textContent = text;
    it.el.style.color = color;
    it.el.style.fontSize = size + 'px';
  }

  update(dt) {
    const w = innerWidth, h = innerHeight;
    for (const it of this.items) {
      if (it.life <= 0) { if (it.el.style.opacity !== '0') it.el.style.opacity = '0'; continue; }
      it.life -= dt;
      it.vy += dt * 46;
      _v.copy(it.pos).project(this.camera);
      if (_v.z > 1) { it.life = 0; it.el.style.opacity = '0'; continue; }
      const x = (_v.x * 0.5 + 0.5) * w;
      const y = (-_v.y * 0.5 + 0.5) * h - it.vy;
      it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
      it.el.style.opacity = String(clamp(it.life * 2.4, 0, 1));
    }
  }
}

// ---------------------------------------------------------------------------
// Blob shadows for enemies (instanced, follows the enemy list each frame)

class BlobShadows {
  constructor(scene, max) {
    const geo = new THREE.CircleGeometry(1, 20);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x0a0e21, transparent: true, opacity: 0.32, depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }

  updateFrom(enemyList) {
    let n = 0;
    for (const e of enemyList) {
      const hRaw = Math.max(e.height, 0.03);
      _v.copy(e.dir).multiplyScalar(R + hRaw + 0.06);
      groundNormal(e.dir, _n);
      _q.setFromUnitVectors(Y_AXIS, _n);
      _q.multiply(_qFlat2);
      const s = e.type.radius * (e.type.flying ? 0.85 : 1.5);
      _m4.compose(_v, _q, _s.set(s, s, s));
      this.mesh.setMatrixAt(n, _m4);
      n++;
      if (n >= 200) break;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
const _qFlat2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

// ---------------------------------------------------------------------------
// Strategic icon layer: at far zoom, towers and landmarks read as
// screen-fixed glyph dots (the Planetary Annihilation trick), fading in as
// the models stop being individually legible.

class StrategicIcons {
  constructor(scene, max = 96) {
    this.max = max;
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aRing = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('aColor', this.aCol);
    geo.setAttribute('aSize', this.aSize);
    geo.setAttribute('aRing', this.aRing);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      uniforms: { uAlpha: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aRing;
        varying vec3 vCol;
        varying float vRing;
        void main() {
          vCol = aColor;
          vRing = aRing;
          gl_PointSize = aSize;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vCol;
        varying float vRing;
        uniform float uAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float disc = smoothstep(0.5, 0.4, d);
          float hole = vRing > 0.5 ? smoothstep(0.18, 0.28, d) : 1.0;
          float m = disc * hole;
          float outline = smoothstep(0.5, 0.46, d) - smoothstep(0.42, 0.38, d);
          vec3 col = mix(vCol, vec3(0.04, 0.06, 0.13), outline * 0.85);
          gl_FragColor = vec4(col, m * uAlpha);
        }
      `,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 14;
    scene.add(this.points);
    this._n = 0;
  }

  begin() { this._n = 0; }

  add(pos, colorHex, size, ring = 0) {
    if (this._n >= this.max) return;
    const i = this._n++;
    this.aPos.setXYZ(i, pos.x, pos.y, pos.z);
    _c.setHex(colorHex);
    this.aCol.setXYZ(i, _c.r, _c.g, _c.b);
    this.aSize.setX(i, size);
    this.aRing.setX(i, ring);
  }

  commit(alpha) {
    this.mat.uniforms.uAlpha.value = alpha;
    this.points.visible = alpha > 0.01;
    if (!this.points.visible) return;
    this.points.geometry.setDrawRange(0, this._n);
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aRing.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------

export class Effects {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.glow = new GlowPoints(scene, REDUCED_MOTION ? 500 : CONFIG.limits.maxParticles);
    this.shards = new Shards(scene, REDUCED_MOTION ? 100 : 340);
    this.rings = new RingPulses(scene, 20);
    this.zaps = new ZapPool(scene, 8);
    this.zaps.camera = camera;
    this.floaters = new DamageNumbers(camera);
    this.blobs = new BlobShadows(scene, 200);
    this.icons = new StrategicIcons(scene);
  }

  // Composite recipes -------------------------------------------------------

  burstGlow(pos, colorHex, count, speed = 4, life = 0.5, size = 0.5, intensity = 2.2) {
    if (REDUCED_MOTION) count = Math.ceil(count / 3);
    for (let i = 0; i < count; i++) {
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
        .multiplyScalar(speed * (0.3 + Math.random()));
      this.glow.emit(pos.x, pos.y, pos.z, _v.x, _v.y, _v.z, colorHex, intensity,
        life * (0.6 + Math.random() * 0.8), size * (0.6 + Math.random() * 0.9), 6);
    }
  }

  enemyDeath(pos, big = false) {
    this.burstGlow(pos, PALETTE.voidEmissive, big ? 26 : 10, big ? 7 : 4.5, 0.55, big ? 0.8 : 0.5);
    _n.copy(pos).normalize();
    this.shards.burst(pos, _n, big ? 18 : 7, PALETTE.voidPlate, big ? 7 : 4.6, big ? 1.6 : 1);
    if (big) this.rings.spawn(pos, PALETTE.voidEmissive, 3.6, 0.7);
  }

  impactSpark(pos, colorHex = PALETTE.energy) {
    this.burstGlow(pos, colorHex, 4, 3.4, 0.28, 0.36);
  }

  explosion(pos, radius, colorHex = 0xffb469) {
    this.burstGlow(pos, colorHex, 26, 8, 0.5, 0.85, 2.6);
    this.burstGlow(pos, 0x7d8598, 12, 3.2, 0.9, 1.1, 0.5);
    _n.copy(pos).normalize();
    this.shards.burst(pos, _n, 10, 0x4a4033, 7, 1.2);
    this.rings.spawn(pos, colorHex, radius * 1.25, 0.5);
  }

  buildPuff(pos) {
    this.burstGlow(pos, 0xb9a789, 16, 2.6, 0.7, 0.9, 0.75);
    this.rings.spawn(pos, PALETTE.energy, 2.2, 0.5);
  }

  spawnFlash(pos) {
    this.burstGlow(pos, PALETTE.voidHot, 12, 3.2, 0.45, 0.6);
  }

  update(dt, enemyList) {
    this.glow.update(dt);
    this.shards.update(dt);
    this.rings.update(dt);
    this.zaps.update(dt);
    this.floaters.update(dt);
    if (enemyList && this.blobs.mesh.visible) this.blobs.updateFrom(enemyList);
  }
}
