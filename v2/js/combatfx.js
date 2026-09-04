import * as THREE from 'three';
import { PALETTE, REDUCED_MOTION } from './config.js';
import { clamp } from './noise.js';
import { R } from './world.js';

// Combat feedback for the things the simulation reports and nothing drew.
//
// allies.js and enemies.js declare five callbacks - onShotFired, onBeam,
// onShellBurst, onMeleeWindUp, onMeleeHit - and fire them faithfully, and until
// this module nothing assigned any of them. Measured with grep: five
// declarations, five call sites, zero assignments. So the marksman's shot was
// a damage number with no tracer, the oracle's beam did fifty damage a second
// while being completely invisible, the bombardier's shell flew and burst
// without ever being drawn, and an enemy could wind up and land a blow on the
// player's own body with nothing on screen to dodge or to feel. onLand was
// assigned, but only to a sound for the possessed body.
//
// Everything here is pooled at construction and reuses module scratch, the
// same discipline effects.js keeps: the frame loop allocates nothing. The
// ribbons are camera-facing strips like the tesla zaps; the shell is one
// instanced mesh placed wherever the sim says a live shell is; the rest is
// composed from the glow, ring and shard pools that already exist.

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _side = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qSpin = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// The first-person eye height, per unit of body scale. Owned by possess.js;
// repeated here because the muzzle of a hidden body has to sit where the view
// model is drawn, and that is measured from the eye rather than the feet.
const EYE_HEIGHT = 1.05;

// How long a tracer stays on screen. A hitscan shot is instant, so this is the
// after-image, not the flight: long enough to read the line, short enough that
// a 0.55 s cooldown never shows two at once.
const TRACER_LIFE = 0.12;
const TRACER_SLOTS = 6;
const TRACER_SEGS = 6;
const BEAM_SLOTS = 2;
const BEAM_SEGS = 14;
// A dust ring this grey reads as ground rather than as an effect, which is the
// point: a landing is a thump, not a spell.
const DUST = 0x86909f;

const RIBBON_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// A bolt with a tail. uHead is where along the strip the bright head sits, so
// the same geometry can streak from the muzzle to the mark in its first frames
// and then thin out from the muzzle end as it dies.
const TRACER_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uCol; uniform vec3 uHot; uniform float uAlpha; uniform float uHead;
  void main() {
    float core = smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
    float tail = smoothstep(uHead - 0.7, uHead - 0.04, vUv.x) * (1.0 - smoothstep(uHead, uHead + 0.03, vUv.x));
    vec3 col = mix(uCol, uHot, core);
    gl_FragColor = vec4(col * (1.0 + core * 2.2), uAlpha * tail * (0.3 + core));
  }
`;

// The beam flows toward the mark and whitens in the core as the ramp climbs,
// so the damage multiplier the sim is applying is something the eye can see.
const BEAM_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uCol; uniform vec3 uHot; uniform float uAlpha; uniform float uTime; uniform float uRamp;
  void main() {
    float core = smoothstep(0.0, 0.42, vUv.y) * smoothstep(1.0, 0.58, vUv.y);
    float flow = 0.72 + 0.28 * sin(vUv.x * 34.0 - uTime * 26.0);
    float ends = smoothstep(0.0, 0.05, vUv.x);
    vec3 col = mix(uCol, uHot, core * (0.45 + 0.55 * uRamp));
    gl_FragColor = vec4(col * (1.0 + core * (1.8 + uRamp * 2.2)) * flow, uAlpha * ends * (0.35 + core));
  }
`;

// A camera-facing strip between two points. Shared by the tracer and the beam;
// only the fragment shader and the segment count differ.
class Ribbon {
  constructor(scene, segs, fragment, uniforms) {
    this.segs = segs;
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array((segs + 1) * 2 * 3), 3)
      .setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    const uv = new Float32Array((segs + 1) * 2 * 2);
    for (let i = 0; i <= segs; i++) {
      uv[(i * 2) * 2] = i / segs; uv[(i * 2) * 2 + 1] = 0;
      uv[(i * 2 + 1) * 2] = i / segs; uv[(i * 2 + 1) * 2 + 1] = 1;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx = [];
    for (let i = 0; i < segs; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      idx.push(a, b, c, b, d, c);
    }
    geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms, vertexShader: RIBBON_VERT, fragmentShader: fragment,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();
  }

  // Lay the strip from `from` to `to`, `width` half-wide across the view. The
  // width axis is the cross of the strip and the eye line, so the strip is
  // always seen face on, the way the tesla zaps are. `wobble` bends the interior
  // points along that same axis by a sine, which is enough for a beam to
  // breathe without any per-frame randomness or allocation.
  shape(camera, width, wobble = 0, phase = 0) {
    const arr = this.posAttr.array;
    _v.copy(this.to).sub(this.from);
    _n.copy(camera.position).sub(this.from).normalize();
    _v2.copy(_v).normalize();
    _side.crossVectors(_v2, _n);
    // Looking straight down the strip leaves no width axis; any perpendicular
    // will do, because at that angle the strip is a dot however it is turned.
    if (_side.lengthSq() < 1e-8) {
      _side.set(0, 1, 0);
      if (Math.abs(_v2.y) > 0.9) _side.set(1, 0, 0);
      _side.addScaledVector(_v2, -_side.dot(_v2));
    }
    _side.normalize();
    for (let i = 0; i <= this.segs; i++) {
      const t = i / this.segs;
      const bend = wobble * Math.sin(t * Math.PI) * Math.sin(t * 9 + phase);
      const px = this.from.x + _v.x * t + _side.x * bend;
      const py = this.from.y + _v.y * t + _side.y * bend;
      const pz = this.from.z + _v.z * t + _side.z * bend;
      arr[(i * 2) * 3] = px - _side.x * width;
      arr[(i * 2) * 3 + 1] = py - _side.y * width;
      arr[(i * 2) * 3 + 2] = pz - _side.z * width;
      arr[(i * 2 + 1) * 3] = px + _side.x * width;
      arr[(i * 2 + 1) * 3 + 1] = py + _side.y * width;
      arr[(i * 2 + 1) * 3 + 2] = pz + _side.z * width;
    }
    this.posAttr.needsUpdate = true;
  }
}

export class CombatFx {
  constructor({ scene, fx, allies, enemies, rig, audio, ui }) {
    this.scene = scene;
    this.fx = fx;
    this.allies = allies;
    this.enemies = enemies;
    this.rig = rig;
    this.audio = audio;
    this.ui = ui;
    // Set by main once it exists; only read to ask whether a struck body is the
    // one the player is inside of.
    this.possession = null;
    this.time = 0;
    this.frame = 0;
    this._vigT = 0;

    this.tracers = [];
    for (let i = 0; i < TRACER_SLOTS; i++) {
      const rib = new Ribbon(scene, TRACER_SEGS, TRACER_FRAG, {
        uCol: { value: new THREE.Color(PALETTE.energy) },
        uHot: { value: new THREE.Color(PALETTE.energyHot) },
        uAlpha: { value: 0 },
        uHead: { value: 1 },
      });
      this.tracers.push({ rib, life: 0 });
    }
    this.tracerHead = 0;

    this.beams = [];
    for (let i = 0; i < BEAM_SLOTS; i++) {
      const rib = new Ribbon(scene, BEAM_SEGS, BEAM_FRAG, {
        uCol: { value: new THREE.Color(PALETTE.energy) },
        uHot: { value: new THREE.Color(PALETTE.energyHot) },
        uAlpha: { value: 0 },
        uTime: { value: 0 },
        uRamp: { value: 0 },
      });
      // fedAt is the frame onBeam last spoke for this slot. The beam is drawn
      // on exactly the frames the sim is channelling and hidden the frame it
      // stops, with no fade: a beam that lingered after the trigger was
      // released would be a beam that appeared to still be doing damage.
      this.beams.push({ rib, a: null, fedAt: -1, ramp: 0, heat: 0, sputterT: 0, heatT: 0 });
    }

    // One faceted shell per sim slot, nose along +Z so a velocity can orient
    // it with a single setFromUnitVectors. Gold and self-lit, and like the
    // gold trim on the soldiers it casts no shadow: a glowing thing throwing a
    // hard shadow reads as a modelling mistake.
    const shellCount = (allies._shells && allies._shells.length) || 12;
    const shellGeo = new THREE.ConeGeometry(0.11, 0.36, 4);
    shellGeo.rotateX(Math.PI / 2);
    const shellMat = new THREE.MeshStandardMaterial({
      color: PALETTE.gold, emissive: PALETTE.gold, emissiveIntensity: 1.3,
      roughness: 0.35, metalness: 0.5, flatShading: true,
    });
    this.shellMesh = new THREE.InstancedMesh(shellGeo, shellMat, shellCount);
    this.shellMesh.count = 0;
    this.shellMesh.frustumCulled = false;
    this.shellMesh.castShadow = false;
    this.shellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.shellMesh);
    this.shellTrailT = new Float32Array(shellCount);

    this._install();
  }

  // Every hook is CHAINED, never replaced. main.js already assigns onLand for
  // the landing sound, and a later module may want any of the others; an
  // assignment that overwrote the previous owner would silently take a feature
  // away, which is the same shape of defect this module exists to fix.
  _install() {
    const chain = (obj, key, fn) => {
      const prev = obj[key];
      obj[key] = (...args) => { if (prev) prev(...args); fn(...args); };
    };
    chain(this.allies, 'onShotFired', (a, origin, target, along) => this._shot(a, origin, target, along));
    chain(this.allies, 'onBeam', (a, target, landed, origin, along) => this._beam(a, target, landed, origin, along));
    chain(this.allies, 'onShellBurst', (sh, hits) => this._burst(sh, hits));
    chain(this.allies, 'onLand', (a) => this._land(a));
    chain(this.enemies, 'onMeleeWindUp', (e, victim) => this._windUp(e, victim));
    chain(this.enemies, 'onMeleeHit', (e, victim) => this._meleeHit(e, victim));
  }

  // Where this body's weapon actually is, in world space. The sim's strike
  // origin is the body centre, and a line that starts inside a chest reads as
  // the body itself firing. allies.weaponLine is preferred when a build offers
  // it, since that is the drawn blade; otherwise the muzzle is derived from
  // the same frame the instanced renderer uses. A hidden body is the one the
  // player is looking out of, and its weapon is the view model, drawn low and
  // to the screen's right of the eye, so the tracer has to start there or it
  // appears to come from somewhere behind the camera.
  _muzzle(a, out) {
    if (typeof this.allies.weaponLine === 'function') {
      this.allies.weaponLine(a, _v2, out);
      if (Number.isFinite(out.x)) return out;
    }
    const sc = a.type.scale || 1;
    _up.copy(a.dir);
    _fwd.copy(a.fwd).addScaledVector(_up, -a.fwd.dot(_up));
    if (_fwd.lengthSq() < 1e-8) _fwd.set(1, 0, 0);
    _fwd.normalize();
    _aim.copy(a.aim || _fwd);
    if (a.hidden) {
      const alt = Math.max(a.height, 0.03) + (a.hop || 0);
      out.copy(_up).multiplyScalar(R + alt + EYE_HEIGHT * sc);
      _side.crossVectors(_fwd, _up).normalize();
      return out.addScaledVector(_side, 0.34).addScaledVector(_up, -0.22).addScaledVector(_aim, 0.95);
    }
    this.allies.worldPos(a, out);
    // The renderer's x axis is up cross fwd, and the arm that drives the swing
    // sits at +x in the part table, so the muzzle goes on that side.
    _side.crossVectors(_up, _fwd).normalize();
    return out
      .addScaledVector(_up, 0.66 * sc - a.type.radius * 0.9 + 0.06)
      .addScaledVector(_side, 0.27 * sc)
      .addScaledVector(_aim, 0.55 * sc);
  }

  // ---- marksman -----------------------------------------------------------

  _shot(a, origin, target, along) {
    const slot = this.tracers[this.tracerHead];
    this.tracerHead = (this.tracerHead + 1) % this.tracers.length;
    const rib = slot.rib;
    this._muzzle(a, rib.from);
    if (target) {
      this.enemies.enemyPos(target, rib.to);
    } else {
      // A miss still draws the line, out to the weapon's range along the aim,
      // which is the only way the player learns how far the rifle reaches.
      _aim.copy(a.aim || a.fwd);
      rib.to.copy(origin).addScaledVector(_aim, a.type.strike.range || 30);
    }
    slot.life = TRACER_LIFE;
    rib.mat.uniforms.uAlpha.value = 1;
    rib.mat.uniforms.uHead.value = 0.35;
    rib.mesh.visible = true;
    rib.shape(this.fx.camera, 0.055);
    // Muzzle flash and, when something was hit, the spark on it. A miss ends in
    // nothing on purpose: a spark on empty air would say the shot connected.
    this.fx.burstGlow(rib.from, PALETTE.energyHot, 3, 1.2, 0.14, 0.7, 3);
    if (target) this.fx.impactSpark(rib.to, PALETTE.energyHot);
  }

  // ---- oracle -------------------------------------------------------------

  _beam(a, target, landed, origin, along) {
    let slot = null;
    for (const b of this.beams) if (b.a === a) { slot = b; break; }
    if (!slot) {
      for (const b of this.beams) if (b.fedAt !== this.frame && b.fedAt !== this.frame - 1) { slot = b; break; }
    }
    if (!slot) slot = this.beams[0];
    slot.a = a;
    slot.fedAt = this.frame;
    const s = a.type.strike;
    slot.ramp = s && s.rampTime ? clamp(a.beamRamp / s.rampTime, 0, 1) : 0;
    slot.heat = clamp(a.heat || 0, 0, 1);
    this._muzzle(a, slot.rib.from);
    this.enemies.enemyPos(target, slot.rib.to);
  }

  _drawBeam(slot, dt) {
    const rib = slot.rib;
    const u = rib.mat.uniforms;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 38);
    // Width and colour both climb with the ramp, so a beam held on one body
    // visibly thickens toward its 1.9x, and both breathe a little so a held
    // beam is not a static bar.
    const width = 0.07 + 0.11 * slot.ramp + 0.02 * pulse;
    u.uAlpha.value = 0.85 + 0.15 * pulse;
    u.uTime.value = this.time;
    u.uRamp.value = slot.ramp;
    // The muzzle end warms from energy toward ember as heat rises, which is the
    // lock warning: the sim locks the weapon at heat 1.
    u.uCol.value.setHex(PALETTE.energy).lerp(_c2.setHex(0xffa74a), slot.heat * 0.7);
    rib.mesh.visible = true;
    rib.shape(this.fx.camera, width, 0.05 + slot.ramp * 0.06, this.time * 22);

    // Impact glow where the beam lands, and heat glow at the muzzle. Both are
    // throttled rather than per frame so a two-second channel does not empty
    // the glow pool for everything else on the board.
    if (REDUCED_MOTION) return;
    slot.sputterT -= dt;
    if (slot.sputterT <= 0) {
      slot.sputterT = 0.035;
      const hot = _c.setHex(PALETTE.energy).lerp(_c2.setHex(PALETTE.energyHot), slot.ramp).getHex();
      for (let k = 0; k < 2; k++) {
        _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2.2);
        this.fx.glow.emit(rib.to.x, rib.to.y, rib.to.z, _v.x, _v.y, _v.z, hot, 2.2 + slot.ramp * 1.5,
          0.16 + slot.ramp * 0.08, 0.45 + slot.ramp * 0.5, 0);
      }
    }
    slot.heatT -= dt;
    if (slot.heatT <= 0 && slot.heat > 0.05) {
      slot.heatT = 0.045;
      const ember = _c.setHex(PALETTE.energy).lerp(_c2.setHex(0xff7a3c), slot.heat).getHex();
      _v.copy(rib.from).sub(rib.to).normalize().multiplyScalar(0.3);
      this.fx.glow.emit(rib.from.x, rib.from.y, rib.from.z, _v.x, _v.y, _v.z, ember, 1.2 + slot.heat * 2.4,
        0.12 + slot.heat * 0.1, 0.5 + slot.heat * 1.1, 0);
    }
  }

  // ---- bombardier ---------------------------------------------------------

  _burst(sh, hits) {
    const aoe = (sh.spec && sh.spec.aoe) || 3;
    this.fx.explosion(sh.pos, aoe);
    // Heavier the more it caught, so a shell dropped into a pack feels like
    // more than one dropped on open ground.
    this.rig.addTrauma(0.16 + 0.04 * Math.min(hits, 3));
    this.audio?.play('explosion');
  }

  _drawShells(dt) {
    const shells = this.allies._shells;
    if (!shells) return;
    let n = 0;
    for (let i = 0; i < shells.length; i++) {
      const sh = shells[i];
      if (!sh.live) { this.shellTrailT[i] = 0; continue; }
      _v.copy(sh.vel);
      if (_v.lengthSq() < 1e-8) _v.copy(sh.pos).normalize();
      _v.normalize();
      _q.setFromUnitVectors(Z_AXIS, _v);
      // A slow roll about the line of flight so the four facets catch the sun
      // in turn; a shell that never turns reads as a static marker.
      _qSpin.setFromAxisAngle(Z_AXIS, sh.t * 14);
      _q.multiply(_qSpin);
      _m4.compose(sh.pos, _q, _s.set(1, 1, 1));
      this.shellMesh.setMatrixAt(n++, _m4);
      if (REDUCED_MOTION) continue;
      this.shellTrailT[i] -= dt;
      if (this.shellTrailT[i] <= 0) {
        this.shellTrailT[i] = 0.025;
        this.fx.glow.emit(sh.pos.x, sh.pos.y, sh.pos.z, -_v.x * 0.6, -_v.y * 0.6, -_v.z * 0.6,
          0xffb469, 1.6, 0.28, 0.55, 0);
      }
    }
    this.shellMesh.count = n;
    if (n > 0) this.shellMesh.instanceMatrix.needsUpdate = true;
  }

  // ---- enemy melee --------------------------------------------------------

  _isPlayer(victim) {
    return !!(this.possession && this.possession.unit === victim);
  }

  _windUp(e, victim) {
    this.enemies.enemyPos(e, _v);
    const player = this._isPlayer(victim);
    // The ring is the tell you can dodge, so it lasts the wind-up and grows to
    // the reach the blow will cover. It is drawn for a hit on the player's own
    // body and for anything near the camera; a whole wave winding up on a far
    // garrison would otherwise cycle the twenty-slot ring pool every second and
    // erase the explosion rings the towers are drawing.
    if (player || _v.distanceTo(this.fx.camera.position) < 45) {
      _v2.copy(e.dir).multiplyScalar(R + Math.max(e.height, 0.03) + 0.04);
      this.fx.rings.spawn(_v2, PALETTE.voidEmissive, (e.type.reach || 1.2) * 1.15, (e.type.wind || 0.3) + 0.15);
    }
    this.fx.burstGlow(_v, PALETTE.voidHot, player ? 8 : 5, 1.5, 0.3, 0.5, 2.2);
  }

  _meleeHit(e, victim) {
    this.allies.worldPos(victim, _v);
    this.fx.impactSpark(_v, PALETTE.voidHot);
    this.fx.burstGlow(_v, PALETTE.voidEmissive, 6, 2.6, 0.32, 0.5, 2);
    this.audio?.play('enemyHit');
    if (!this._isPlayer(victim)) return;
    // Being hit in first person lands on the player: onHurt already scales a
    // small shake by the damage, this is the blow itself on top of it, plus
    // the same vignette flash a leak uses so the edge of the screen goes red.
    this.rig.addTrauma(0.26);
    const v = this.ui && this.ui.el && this.ui.el['damage-vignette'];
    if (v) {
      v.classList.add('hit');
      clearTimeout(this._vigT);
      this._vigT = setTimeout(() => v.classList.remove('hit'), 110);
    }
  }

  // ---- landing ------------------------------------------------------------

  _land(a) {
    // vertVel is already zeroed when onLand fires, so the fall speed is read
    // from the body's own record when a build keeps one, and the ring is a
    // fixed size per body otherwise.
    const vert = Math.abs((a.cos && a.cos.lastVert) || 0);
    const sc = a.type.scale || 1;
    const r = 0.85 * sc * (1 + 0.5 * clamp(vert / 7, 0, 1));
    _v.copy(a.dir).multiplyScalar(R + Math.max(a.height, 0.03) + 0.04);
    this.fx.rings.spawn(_v, DUST, r, 0.42);
    this.fx.burstGlow(_v, DUST, 6, 1.4, 0.38, 0.7, 0.55);
  }

  // ---- per frame ----------------------------------------------------------

  // Called from stepFrame beside fx.update, with the SIM dt: zero while paused,
  // so a tracer freezes with the board it was fired on. The frame counter
  // advances regardless, which is what hides a beam the moment the sim stops
  // feeding it.
  update(dt) {
    this.time += dt;
    for (const t of this.tracers) {
      if (t.life <= 0) { t.rib.mesh.visible = false; continue; }
      t.life -= dt;
      const age = TRACER_LIFE - t.life;
      const u = t.rib.mat.uniforms;
      // The head races to the mark in the first few frames; after that only
      // the alpha falls, so the line dies from the muzzle end.
      u.uHead.value = Math.min(1, 0.35 + age / 0.04);
      u.uAlpha.value = clamp(t.life / TRACER_LIFE, 0, 1);
      t.rib.shape(this.fx.camera, 0.055);
      if (t.life <= 0) t.rib.mesh.visible = false;
    }
    for (const b of this.beams) {
      if (b.fedAt === this.frame) this._drawBeam(b, dt);
      else { b.rib.mesh.visible = false; b.a = null; }
    }
    this._drawShells(dt);
    this.frame++;
  }
}
