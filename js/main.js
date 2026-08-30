import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import { OrbitRig } from './camera.js';
import { PostPipeline } from './postfx.js';
import { World, R, surfacePoint, setBattlefield } from './world.js';
import { NavGraph } from './nav.js';
import { EnemyManager } from './enemies.js';
import { Effects } from './effects.js';
import { TowerManager } from './towers.js';
import { Game } from './game.js';
import { WaveDirector, portalCount } from './waves.js';
import { HUD } from './ui.js';
import { AudioEngine } from './audio.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false,
});
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const PIXEL_RATIO_CAP = 1.75;
let pixelRatio = Math.min(devicePixelRatio || 1, PIXEL_RATIO_CAP);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.space);

const rig = new OrbitRig(canvas);
const post = new PostPipeline(renderer);
const world = new World(scene);

// Camera-following fill so the night side stays readable; the sun remains
// the primary key light and the day/night mood survives.
const camFill = new THREE.DirectionalLight(0x9fb6e8, 0.42);
scene.add(camFill);
const _fxTmp = new THREE.Vector3();
const _fxTmp2 = new THREE.Vector3();

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(1);
  renderer.setSize(Math.round(w * pixelRatio), Math.round(h * pixelRatio), false);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  rig.setAspect(w / h);
  post.setSize(w, h, pixelRatio);
}
addEventListener('resize', resize);

const bootFill = document.getElementById('boot-fill');
const bootStatus = document.getElementById('boot-status');
// rAF with a timeout fallback: rAF stops in hidden tabs and boot must not.
const nextFrame = () => new Promise((res) => {
  requestAnimationFrame(() => res());
  setTimeout(res, 90);
});

const BOOT_LABELS = [
  'seeding the noise fields',
  'charting the ley lines',
  'carving the continents',
  'pouring the oceans',
  'hanging the stars',
  'planting the forests',
  'raising the light',
  'waking the worldheart',
];

renderer.info.autoReset = false;
const fpsSamples = new Float32Array(140);
const workSamples = new Float32Array(140);
let fpsIdx = 0, fpsCount = 0;
let qualityLocked = false;
let elapsed = 0;

function fps() {
  let sum = 0;
  const n = Math.min(fpsCount, fpsSamples.length);
  for (let i = 0; i < n; i++) sum += fpsSamples[i];
  return n ? 1 / (sum / n) : 0;
}

const nav = new NavGraph();
let enemies = null;
let fx = null;
let towerMgr = null;
let game = null;
let waves = null;
let ui = null;

async function boot() {
  resize();
  const totalSteps = world.buildStepCount + 2;
  let step = 0;
  const progress = async (label) => {
    bootStatus.textContent = label;
    bootFill.style.width = `${(++step / totalSteps) * 100}%`;
    await nextFrame();
  };

  await progress(BOOT_LABELS[0]);
  world.buildStep(0);
  await progress(BOOT_LABELS[1]);
  nav.build();
  // Capped maps must register the battlefield before any mesh building so
  // terrain tinting, decor scatter, and walkability all agree on the wall.
  if (nav.fieldCenter) setBattlefield(nav.fieldCenter, CONFIG.map.fieldTheta);
  for (let i = 1; i < world.buildStepCount; i++) {
    await progress(BOOT_LABELS[i + 1]);
    world.buildStep(i);
  }
  await progress(BOOT_LABELS[7]);

  const heartPos = nav.nodePos(nav.heartNode, new THREE.Vector3());
  world.addHeart(heartPos);
  world.crushDecorNear(heartPos, 4.2);
  if (nav.fieldCenter) world.addFieldWall(nav.fieldCenter, CONFIG.map.fieldTheta);
  const portalPositions = [];
  for (const pn of nav.portalNodes) {
    const pp = nav.nodePos(pn, new THREE.Vector3());
    world.addPortal(pp);
    world.crushDecorNear(pp, 3.2);
    portalPositions.push(pp);
  }

  enemies = new EnemyManager(scene, nav);
  enemies.setHeart(heartPos);
  fx = new Effects(scene, rig.camera);
  enemies.onLandFx = (e) => {
    towerMgr.enemyWorldPos(e, _fxTmp);
    fx.rings.spawn(_fxTmp, 0x86909f, 1.15, 0.42);
  };
  enemies.onShedFx = (e) => {
    towerMgr.enemyWorldPos(e, _fxTmp);
    fx.burstGlow(_fxTmp, PALETTE.voidEmissive, 14, 5.5, 0.5, 0.7);
    fx.shards.burst(_fxTmp, _fxTmp2.copy(_fxTmp).normalize(), 8, PALETTE.voidPlate, 6, 1.4);
    rig.addTrauma(0.22);
    game.audio?.play('shed');
  };
  towerMgr = new TowerManager(scene, enemies, fx, nav);
  game = new Game({ scene, rig, world, nav, enemies, towerMgr, fx });
  const audio = new AudioEngine();
  game.audio = audio;
  towerMgr.audio = audio;
  waves = new WaveDirector(game, enemies, nav);
  ui = new HUD({ game, waves, world, nav, rig, renderer, audio });
  ui.makeThumbnails();
  ui.onQuality = (q) => {
    if (q === 'low') { post.setQuality('low'); pixelRatio = 1.1; }
    else if (q === 'high') { post.setQuality('high'); pixelRatio = Math.min(devicePixelRatio || 1, PIXEL_RATIO_CAP); }
    resize();
  };

  waves.onPortalWake = (newestIdx) => {
    ui.toast('A new breach tears open', 'danger');
    const p = world.portals[newestIdx];
    if (p) rig.flyTo(p.group.position, rig.targetDist, 1.1);
    ui.audio?.play('portal');
  };
  waves.onSpawnPortal = (node) => {
    const idx = nav.portalNodes.indexOf(node);
    if (world.portals[idx]) world.portals[idx].flash = Math.max(world.portals[idx].flash, 0.6);
    audio.play('spawn');
  };
  const syncPortals = () => {
    const count = portalCount(Math.max(waves.wave, 1));
    world.portals.forEach((p, i) => { p.active = i < count; });
  };
  const prevStart = waves.onWaveStart;
  waves.onWaveStart = (n, comp) => { syncPortals(); prevStart?.(n, comp); };

  window.WH.enemies = enemies;
  window.WH.fx = fx;
  window.WH.towers = towerMgr;
  window.WH.game = game;
  window.WH.waves = waves;
  window.WH.ui = ui;
  window.WH.heartPos = heartPos;
  window.WH.portalPositions = portalPositions;

  bootFill.style.width = '100%';
  await nextFrame();

  document.getElementById('boot').classList.add('done');
  rig.introFlight(heartPos.clone().normalize());
  rig.autoOrbit = 0.045;
  ui.showTitle();

  let prev = performance.now();
  let frameFaults = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - prev) / 1000;
    prev = now;
    if (!Number.isFinite(raw) || raw <= 0) return;
    const dt = Math.min(raw, 1 / 30);
    elapsed += dt;

    fpsSamples[fpsIdx] = raw;

    if (!qualityLocked && elapsed > 7 && fpsCount > 130) {
      qualityLocked = true;
      if (fps() < 45) {
        post.setQuality('low');
        pixelRatio = Math.min(pixelRatio, 1.25);
        resize();
      }
    }

    const w0 = performance.now();
    renderer.info.reset();
    // A single faulty frame must never kill the loop: skip it, keep playing.
    // Repeated faults surface once in the console instead of spamming.
    try {
      stepFrame(dt, true);
      frameFaults = 0;
    } catch (err) {
      frameFaults++;
      if (frameFaults <= 3 || frameFaults % 300 === 0) {
        console.error('frame fault (recovering):', err);
      }
    }
    workSamples[fpsIdx] = performance.now() - w0;
    fpsIdx = (fpsIdx + 1) % fpsSamples.length;
    fpsCount++;
  }
  requestAnimationFrame(frame);
}

// Pause the simulation whenever the tab is hidden: a background tab gets no
// frames, and a giant catch-up step on return reads as a freeze.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game && game.state === 'playing' && !game.paused) {
    game.paused = true;
    ui?.reflectPause?.();
  }
});

// WebGL context loss: absorb it, restore, repaint, keep the session.
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  if (game && game.state === 'playing') game.paused = true;
  console.warn('WebGL context lost, awaiting restore');
});
canvas.addEventListener('webglcontextrestored', () => {
  post.setQuality(post.levels >= 4 ? 'high' : 'low');
  resize();
  ui?.reflectPause?.();
  ui?.toast?.('Graphics recovered. Press Space to resume.', 'warn');
});

function stepFrame(dt, render) {
  rig.update(dt);
  camFill.position.copy(rig.camera.position);
  world.update(dt, rig.camera.position);
  const simActive = game && game.state === 'playing' && !game.paused;
  const simDt = simActive ? dt * game.speed : 0;
  if (simDt > 0) {
    waves.update(simDt);
    enemies.update(simDt);
    towerMgr.update(simDt);
  }
  if (game) game.update(dt);
  if (ui) ui.update(dt);
  if (fx) fx.update(simDt, enemies ? enemies.active : null);
  if (render) post.render(scene, rig.camera, dt);
}

function workMs() {
  let sum = 0;
  const n = Math.min(fpsCount, workSamples.length);
  for (let i = 0; i < n; i++) sum += workSamples[i];
  return n ? sum / n : 0;
}

let navDebugPts = null;
window.WH = {
  renderer, scene, world, rig, post, CONFIG, nav,
  fps, workMs,
  drawCalls: () => renderer.info.render.calls,
  tris: () => renderer.info.render.triangles,
  navDebug(show = true) {
    if (navDebugPts) { scene.remove(navDebugPts); navDebugPts = null; }
    if (show) { navDebugPts = nav.buildDebugPoints(); scene.add(navDebugPts); }
  },
  testSpawn(type = 'husk', count = 20, portal = 0) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => enemies?.spawn(type, nav.portalNodes[portal]), i * 260);
    }
  },
  give(n = 1000) { game.gold += n; },
  // Deterministic sim advance for scripted verification; rAF-independent.
  step(seconds = 1, fps60 = 60) {
    const n = Math.round(seconds * fps60);
    for (let i = 0; i < n; i++) stepFrame(1 / fps60, false);
    post.render(scene, rig.camera, 1 / fps60);
  },
  // Scripted placement for testing: drop a tower N hops down a portal's path,
  // offset sideways so it shapes the route instead of blocking it.
  placeNear(typeKey, portal = 0, hops = 6, side = 1.6) {
    let node = nav.portalNodes[portal];
    for (let k = 0; k < hops && nav.next[node] >= 0; k++) node = nav.next[node];
    const dir = nav.nodeDir(node, new THREE.Vector3());
    const t = new THREE.Vector3(0, 1, 0);
    if (Math.abs(dir.y) > 0.9) t.set(1, 0, 0);
    const tan = new THREE.Vector3().crossVectors(dir, t).normalize();
    dir.addScaledVector(tan, side / R).normalize();
    game.buildType = typeKey;
    game.cursorDir.copy(dir);
    surfacePoint(dir, game.cursorPos);
    game.cursorValid = true;
    game._tryPlace();
    const v = game.validity;
    game.cancelBuild();
    return v;
  },
};

boot();
