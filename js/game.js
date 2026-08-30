import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import { clamp } from './noise.js';
import { R, isWalkableDir, surfacePoint, groundNormal, orientOnSurface } from './world.js';
import { TOWER_TYPES, TOWER_SCALE, tierCost, buildTowerVisual, GHOST_MAT_OK, GHOST_MAT_BAD } from './towers.js';

// Player-facing game logic: build mode with a live ghost, the placement rule
// pipeline, marching path previews, tower selection, and the economy.

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _n = new THREE.Vector3();
const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();

const PREVIEW_DOTS = 640;

class PathFlow {
  constructor(scene) {
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(PREVIEW_DOTS * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(new Float32Array(PREVIEW_DOTS * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    const mat = new THREE.PointsMaterial({
      size: 7.5, sizeAttenuation: false, vertexColors: true,
      transparent: true, opacity: 0.95, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 12;
    this.points.visible = false;
    scene.add(this.points);
    this.paths = [];
    this.phase = 0;
    this.spacing = 0.88;
  }

  setPaths(paths) {
    this.paths = paths.map((flat) => {
      const pts = [];
      for (let i = 0; i < flat.length; i += 3) pts.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]));
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
      return { pts, cum, len: cum[cum.length - 1] || 0 };
    });
  }

  show(v) { this.points.visible = v; }

  update(dt) {
    if (!this.points.visible) return;
    this.phase = (this.phase + dt * 1.6) % this.spacing;
    let n = 0;
    for (const path of this.paths) {
      if (path.len < 0.5) continue;
      for (let d = this.spacing - this.phase; d < path.len && n < PREVIEW_DOTS; d += this.spacing) {
        // locate segment
        let lo = 0, hi = path.cum.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (path.cum[mid] < d) lo = mid + 1; else hi = mid;
        }
        const i1 = Math.max(1, lo);
        const t = (d - path.cum[i1 - 1]) / Math.max(path.cum[i1] - path.cum[i1 - 1], 1e-5);
        _v.lerpVectors(path.pts[i1 - 1], path.pts[i1], t);
        _n.copy(_v).normalize();
        _v.addScaledVector(_n, 0.24);
        this.posAttr.array[n * 3] = _v.x;
        this.posAttr.array[n * 3 + 1] = _v.y;
        this.posAttr.array[n * 3 + 2] = _v.z;
        const head = 1 - d / path.len;
        this.colAttr.array[n * 3] = 0.35 + head * 0.2;
        this.colAttr.array[n * 3 + 1] = 0.95;
        this.colAttr.array[n * 3 + 2] = 1.0;
        n++;
      }
    }
    for (let k = n; k < PREVIEW_DOTS; k++) {
      this.posAttr.array[k * 3] = 0; this.posAttr.array[k * 3 + 1] = -9999; this.posAttr.array[k * 3 + 2] = 0;
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }
}

// Terrain-hugging soft ring band: two concentric circles sampled on the
// surface, joined into a strip with feathered edges.
class SurfaceBand {
  constructor(scene, segments = 64) {
    this.segments = segments;
    const geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(new Float32Array(segments * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.attr);
    const uv = new Float32Array(segments * 2 * 2);
    for (let i = 0; i < segments; i++) {
      uv[(i * 2) * 2] = i / segments; uv[(i * 2) * 2 + 1] = 0;
      uv[(i * 2 + 1) * 2] = i / segments; uv[(i * 2 + 1) * 2 + 1] = 1;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx = [];
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      idx.push(i * 2, i * 2 + 1, j * 2, i * 2 + 1, j * 2 + 1, j * 2);
    }
    geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(PALETTE.energy) }, uOpacity: { value: 0.62 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform vec3 uColor; uniform float uOpacity;
        void main() {
          float band = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
          gl_FragColor = vec4(uColor * 1.35, band * uOpacity);
        }
      `,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  setColor(hex) { this.mat.uniforms.uColor.value.setHex(hex); }
  show(v) { this.mesh.visible = v; }

  place(center, radius, width = 0.3) {
    _n.copy(center).normalize();
    if (Math.abs(_n.y) < 0.93) _e1.set(0, 1, 0); else _e1.set(1, 0, 0);
    _e2.crossVectors(_n, _e1).normalize();
    _e1.crossVectors(_e2, _n).normalize();
    for (let i = 0; i < this.segments; i++) {
      const a = (i / this.segments) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let k = 0; k < 2; k++) {
        const ang = (radius + (k === 0 ? -width : width)) / R;
        _v.copy(_n).multiplyScalar(Math.cos(ang))
          .addScaledVector(_e1, Math.sin(ang) * ca)
          .addScaledVector(_e2, Math.sin(ang) * sa)
          .normalize();
        surfacePoint(_v, _v2);
        _v2.addScaledVector(_v, 0.17);
        const o = (i * 2 + k) * 3;
        this.attr.array[o] = _v2.x;
        this.attr.array[o + 1] = _v2.y;
        this.attr.array[o + 2] = _v2.z;
      }
    }
    this.attr.needsUpdate = true;
  }
}

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx); // scene, rig, world, nav, enemies, towerMgr, fx
    this.gold = CONFIG.economy.startGold;
    this.lives = CONFIG.economy.startLives;
    this.score = 0;
    this.kills = 0;
    this.state = 'title';
    this.speed = 1;
    this.paused = false;

    this.buildType = null;
    this.selectedTower = null;
    this.cursorDir = new THREE.Vector3();
    this.cursorPos = new THREE.Vector3();
    this.cursorValid = false;
    this.ghostHolder = new THREE.Group();
    this.ghostHolder.visible = false;
    this.scene.add(this.ghostHolder);
    this.ghostMeshes = [];
    this.ghostCache = new Map();
    this.validity = { ok: false, reason: 'terrain' };
    this._validateT = 0;
    this._pathT = 0;
    this._lastGhostDir = new THREE.Vector3();

    this.pathFlow = new PathFlow(this.scene);
    this.rangeRing = new SurfaceBand(this.scene);
    this.footRing = new SurfaceBand(this.scene, 44);
    this.selRing = new SurfaceBand(this.scene);

    this.raycaster = new THREE.Raycaster();
    this.onHudChange = null;   // ui hook
    this.onToast = null;
    this.onLeakFx = null;

    this._wireInput();
    this._wireCombat();
  }

  // -- input ----------------------------------------------------------------

  _wireInput() {
    this.rig.onHover = (x, y) => this._hover(x, y);
    this.rig.onTap = (x, y, button) => {
      if (button === 2) { this.cancelBuild(); this.select(null); return; }
      if (button !== 0) return;
      // Touch and tap flows may arrive without a hover first; refresh the
      // cursor from the tap point before acting on it.
      this._hover(x, y);
      if (this.buildType) this._tryPlace();
      else this._trySelect(x, y);
    };
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const keys = { Digit1: 'bolt', Digit2: 'cryo', Digit3: 'mortar', Digit4: 'tesla', Digit5: 'helios' };
      if (keys[e.code]) this.toggleBuild(keys[e.code]);
      else if (e.code === 'Escape') { this.cancelBuild(); this.select(null); }
      else if (e.code === 'KeyU' && this.selectedTower) this.upgradeSelected();
      else if (e.code === 'KeyX' && this.selectedTower) this.sellSelected();
    });
  }

  _wireCombat() {
    this.towerMgr.onKillReward = (enemy) => {
      this.gold += enemy.type.bounty;
      this.score += enemy.type.score;
      this.kills++;
      this.towerMgr.enemyWorldPos(enemy, _v);
      this.fx.floaters.spawn(_v, `+${enemy.type.bounty}`, '#ffc857', 12);
      this.audio?.play('kill');
      this._hud();
    };
    this.enemies.onDeathFx = (e) => {
      this.towerMgr.enemyWorldPos(e, _v);
      this.fx.enemyDeath(_v, !!e.type.boss);
      if (e.type.boss) this.rig.addTrauma(0.5);
    };
    this.enemies.onSpawnFx = (e) => {
      this.towerMgr.enemyWorldPos(e, _v);
      this.fx.spawnFlash(_v);
    };
    this.enemies.onLeak = (e) => {
      this.lives = Math.max(0, this.lives - e.type.damage);
      this.world.setHeartHealth(this.lives / CONFIG.economy.startLives);
      this.rig.addTrauma(e.type.boss ? 0.65 : 0.34);
      if (this.onLeakFx) this.onLeakFx();
      this._hud();
      if (this.lives <= 0 && this.state === 'playing') {
        this.state = 'defeat';
        if (this.onGameEnd) this.onGameEnd(false);
      }
    };
  }

  _hover(x, y) {
    this.rig.raycaster(x, y, this.raycaster);
    const hits = this.raycaster.intersectObject(this.world.pickProxy, false);
    if (!hits.length) { this.cursorValid = false; if (this.buildType) this.ghostHolder.visible = false; return; }
    this.cursorDir.copy(hits[0].point).normalize();
    surfacePoint(this.cursorDir, this.cursorPos);
    this.cursorValid = true;
    if (this.buildType) this._updateGhost();
  }

  // -- build mode -----------------------------------------------------------

  toggleBuild(typeKey) {
    if (this.buildType === typeKey) { this.cancelBuild(); return; }
    if (this.state !== 'playing') return;
    this.buildType = typeKey;
    this.select(null);
    this._mountGhost(typeKey);
    this._pathT = 0;
    this.pathFlow.show(true);
    this._refreshPaths(true);
    if (this.onHudChange) this.onHudChange();
  }

  cancelBuild() {
    this.buildType = null;
    this.ghostHolder.visible = false;
    this.rangeRing.show(false);
    this.footRing.show(false);
    this.pathFlow.show(false);
    if (this.onHudChange) this.onHudChange();
  }

  _mountGhost(typeKey) {
    for (const c of [...this.ghostHolder.children]) this.ghostHolder.remove(c);
    let entry = this.ghostCache.get(typeKey);
    if (!entry) {
      const built = buildTowerVisual(typeKey, 0);
      built.group.scale.setScalar(TOWER_SCALE);
      const meshes = [];
      built.group.traverse((o) => { if (o.isMesh) { o.material = GHOST_MAT_OK; meshes.push(o); } });
      entry = { group: built.group, meshes };
      this.ghostCache.set(typeKey, entry);
    }
    this.ghostHolder.add(entry.group);
    this.ghostMeshes = entry.meshes;
    this.ghostHolder.visible = this.cursorValid;
    if (this.cursorValid) this._updateGhost(true);
  }

  _updateGhost(force = false) {
    const def = TOWER_TYPES[this.buildType];
    this.ghostHolder.visible = true;
    orientOnSurface(this.ghostHolder, this.cursorPos);
    this.rangeRing.show(true);
    this.rangeRing.place(this.cursorPos, def.tiers[0].range, 0.28);
    this.footRing.show(true);
    this.footRing.place(this.cursorPos, def.footprint, 0.15);

    this._validateT -= 1;
    if (force || this._validateT <= 0 || this._lastGhostDir.distanceToSquared(this.cursorDir) > 0.00002) {
      this._validateT = 4;
      this._lastGhostDir.copy(this.cursorDir);
      this.validity = this._validate(def);
      const mat = this.validity.ok ? GHOST_MAT_OK : GHOST_MAT_BAD;
      for (const m of this.ghostMeshes) m.material = mat;
      this.rangeRing.setColor(this.validity.ok ? PALETTE.energy : PALETTE.danger);
      this.footRing.setColor(this.validity.ok ? PALETTE.energy : PALETTE.danger);
      this._refreshPaths(this.validity.ok);
      if (this.onHudChange) this.onHudChange();
    }
  }

  _validate(def) {
    if (!this.cursorValid) return { ok: false, reason: 'terrain' };
    if (!isWalkableDir(this.cursorDir)) return { ok: false, reason: 'terrain' };
    if (this.cursorPos.distanceTo(this.world.heart.group.position) < 3.7) return { ok: false, reason: 'heart' };
    for (const p of this.world.portals) {
      if (this.cursorPos.distanceTo(p.group.position) < 3.0) return { ok: false, reason: 'portal' };
    }
    for (const t of this.towerMgr.towers) {
      if (this.cursorPos.distanceTo(t.pos) < def.footprint + t.def.footprint * 0.85) {
        return { ok: false, reason: 'overlap' };
      }
    }
    for (const e of this.enemies.active) {
      if (e.type.flying) continue;
      this.towerMgr.enemyWorldPos(e, _v2);
      if (_v2.distanceTo(this.cursorPos) < def.footprint + 0.75) return { ok: false, reason: 'enemies' };
    }
    const nv = this.nav.validatePlacement(this.cursorPos, def.footprint);
    if (!nv.ok) return { ok: false, reason: nv.reason === 'path' ? 'path' : 'landmark' };
    if (this.gold < def.cost) return { ok: false, reason: 'gold' };
    return { ok: true };
  }

  _refreshPaths(withGhost) {
    const def = this.buildType ? TOWER_TYPES[this.buildType] : null;
    const paths = (withGhost && def && this.cursorValid)
      ? this.nav.previewPaths(this.cursorPos, def.footprint)
      : this.nav.previewPaths();
    this.pathFlow.setPaths(paths);
  }

  _tryPlace() {
    if (!this.cursorValid) return;
    const def = TOWER_TYPES[this.buildType];
    this.validity = this._validate(def);
    if (!this.validity.ok) {
      const msgs = {
        terrain: 'Needs open walkable ground',
        heart: 'Too close to the Worldheart',
        portal: 'Too close to a breach',
        overlap: 'Overlaps another tower',
        enemies: 'Enemies are in the way',
        path: 'PATH BLOCKED: every breach must reach the heart',
        landmark: 'Cannot build on a landmark',
        gold: 'Not enough gold',
      };
      if (this.onToast) this.onToast(msgs[this.validity.reason] || 'Cannot build here', this.validity.reason === 'path' ? 'danger' : 'warn');
      this.rig.addTrauma(0.06);
      this.audio?.play('deny');
      return;
    }
    this.gold -= def.cost;
    const tower = this.towerMgr.place(this.buildType, this.cursorPos);
    this.nav.blockNodes(this.cursorPos, def.footprint, tower.id);
    const crushed = this.world.crushDecorNear(this.cursorPos, def.footprint + 0.5);
    this.fx.buildPuff(this.cursorPos);
    this.fx.floaters.spawn(this.cursorPos, `-${def.cost}`, '#ffc857', 13);
    if (crushed > 0) this.fx.burstGlow(this.cursorPos, 0x66b06d, 8, 2.4, 0.6, 0.7, 0.9);
    this._refreshPaths(false);
    if (this.audio) this.audio.play('build');
    this._hud();
    // stay in build mode for chain-building; ghost revalidates next hover
    this._validateT = 0;
  }

  _trySelect(x, y) {
    this.rig.raycaster(x, y, this.raycaster);
    let best = null, bestD = Infinity;
    for (const t of this.towerMgr.towers) {
      _v.copy(t.pos).addScaledVector(_v2.copy(t.pos).normalize(), 1.1);
      const d = this.raycaster.ray.distanceSqToPoint(_v);
      if (d < 2.4 && d < bestD) { bestD = d; best = t; }
    }
    this.select(best);
  }

  select(tower) {
    this.selectedTower = tower;
    if (tower) {
      this.selRing.show(true);
      this.selRing.setColor(PALETTE.energy);
      this.selRing.place(tower.pos, tower.range, 0.28);
    } else {
      this.selRing.show(false);
    }
    if (this.onHudChange) this.onHudChange();
  }

  upgradeSelected() {
    const t = this.selectedTower;
    if (!t || t.tier >= 2) return;
    const cost = tierCost(t.typeKey, t.tier + 1);
    if (this.gold < cost) {
      if (this.onToast) this.onToast('Not enough gold', 'warn');
      return;
    }
    this.gold -= cost;
    t.upgrade();
    this.fx.buildPuff(t.pos);
    this.fx.floaters.spawn(t.pos, `-${cost}`, '#ffc857', 13);
    this.selRing.place(t.pos, t.range, 0.28);
    if (this.audio) this.audio.play('upgrade');
    this._hud();
  }

  sellSelected() {
    const t = this.selectedTower;
    if (!t) return;
    const value = t.sellValue(CONFIG.economy.sellRefund);
    this.gold += value;
    this.nav.unblockNodes(t.id);
    this.towerMgr.remove(t);
    this.fx.floaters.spawn(t.pos, `+${value}`, '#ffc857', 13);
    this.fx.burstGlow(t.pos, PALETTE.energy, 10, 3, 0.5, 0.6);
    this.select(null);
    if (this.audio) this.audio.play('sell');
    this._hud();
  }

  _hud() { if (this.onHudChange) this.onHudChange(); }

  update(dt) {
    this.pathFlow.update(dt);
    if (this.buildType && this.cursorValid) {
      // enemies move; revalidate periodically even without cursor motion
      this._validateT -= dt * 60;
    }
  }
}
