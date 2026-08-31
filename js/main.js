import * as THREE from 'three';
import { CONFIG, CAM_TUNE, PALETTE } from './config.js';
import { OrbitRig } from './camera.js';
import { PostPipeline } from './postfx.js';
import { World, R, surfacePoint, setBattlefield, raycastTerrain } from './world.js';
import { NavGraph } from './nav.js';
import { EnemyManager } from './enemies.js';
import { Effects } from './effects.js';
import { TowerManager, TOWER_TYPES } from './towers.js';
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
rig.surfaceProbe = raycastTerrain;

// A hidden, minimized, or mid-rotation viewport reports 0x0. Sizing to that
// collapses the canvas to a pixel and poisons the projection matrix, so the
// last good size is kept until a real one arrives.
let viewW = 1280, viewH = 720;

function resize() {
  if (innerWidth > 16 && innerHeight > 16) { viewW = innerWidth; viewH = innerHeight; }
  const w = viewW, h = viewH;
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
  if (nav.fieldCenter) {
    setBattlefield(nav.fieldCenter, CONFIG.map.fieldTheta);
    // The focus is what sits at screen centre, so the limit can run right out
    // to the wall: the player can now centre on the edge of the front.
    rig.confine = { center: nav.fieldCenter.clone(), maxAng: CONFIG.map.fieldTheta * 1.02 };
  }
  for (let i = 1; i < world.buildStepCount; i++) {
    await progress(BOOT_LABELS[i + 1]);
    world.buildStep(i);
  }
  await progress(BOOT_LABELS[7]);

  const heartPos = nav.nodePos(nav.heartNode, new THREE.Vector3());
  world.addHeart(heartPos);
  world.crushDecorNear(heartPos, 4.2);
  // The energy wall reads as a containment fence on a planet surface; in open
  // space the void itself is the boundary and a ring just looks bolted on.
  if (CONFIG.map.mode === 'battlefield') {
    world.addFieldWall(nav.fieldCenter, CONFIG.map.fieldTheta);
    world.addCloudDeck(nav.fieldCenter, CONFIG.map.fieldTheta);
  }
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
  if (CONFIG.map.mode === 'space') fx.blobs.mesh.visible = false;
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
  rig.autoOrbit = rig.confine ? 0 : 0.045;
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
  if (document.hidden) {
    if (game && game.state === 'playing' && !game.paused) {
      game.paused = true;
      ui?.reflectPause?.();
    }
  } else {
    // A tab restored from hidden may have been sized while degenerate.
    resize();
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
  if (fx) {
    // Strategic scale: swell models with zoom, then hand over to icons.
    // Bigger worlds get a stronger swell so a tower stays a landmark even
    // when the board is a continent.
    const z = rig.zoomT;
    const swell = SWELL_MAX - 1;
    if (towerMgr) towerMgr.zoomScale = 1 + z * swell;
    if (enemies) enemies.zoomScale = 1 + z * swell * 0.8;
    const iconAlpha = Math.min(1, Math.max(0, (z - 0.46) / 0.24));
    fx.icons.begin();
    if (iconAlpha > 0.01 && towerMgr && world.heart) {
      for (const t of towerMgr.towers) {
        _fxTmp.copy(t.pos).addScaledVector(_fxTmp2.copy(t.pos).normalize(), 2.2 + z * 4);
        fx.icons.add(_fxTmp, ICON_COLORS[t.typeKey] || 0x59f2ff, 10);
      }
      _fxTmp.copy(world.heart.group.position).addScaledVector(_fxTmp2.copy(world.heart.group.position).normalize(), 3.4 + z * 4);
      fx.icons.add(_fxTmp, 0xeafcff, 18, 1);
      for (const p of world.portals) {
        _fxTmp.copy(p.group.position).addScaledVector(_fxTmp2.copy(p.group.position).normalize(), 2.6 + z * 4);
        fx.icons.add(_fxTmp, p.active ? 0xff3fa6 : 0x8a5f9e, 14, 1);
      }
    }
    fx.icons.commit(iconAlpha);
    fx.update(simDt, enemies ? enemies.active : null);
  }
  if (render) post.render(scene, rig.camera, dt);
}

const ICON_COLORS = {
  bolt: 0x59f2ff, cryo: 0xbff1ff, mortar: 0xffc857, tesla: 0x9db8ff, helios: 0xffd9a0,
};

// ---------------------------------------------------------------------------
// Camera navigation harness. Every control path is exercised against a
// measurable property rather than by eye: the decisive one is that a fixed
// world point must track the cursor on screen under any view rotation, pitch,
// lens, and zoom. Run with WH.camTest().

const _ct = new THREE.Vector3();
const _cdir = new THREE.Vector3();
const _cref = new THREE.Vector3();
const _cprobe = new THREE.Vector3();

function camTest() {
  const rep = { map: CONFIG.mapKey, pass: true, checks: [] };
  const add = (name, ok, detail) => {
    rep.checks.push(Object.assign({ name, ok }, detail || {}));
    if (!ok) rep.pass = false;
  };
  const saved = {
    lon: rig.lon, lat: rig.lat, dist: rig.dist, target: rig.targetDist,
    yaw: rig.viewYaw, tilt: rig.tiltOffset, build: game && game.buildType,
  };
  if (game) game.buildType = null;

  // Measure against the live render viewport, which the resize guard keeps
  // sane even when the window reports nothing.
  const W = viewW, H = viewH;
  const project = (v) => {
    _ct.copy(v).project(rig.camera);
    return [(_ct.x * 0.5 + 0.5) * W, (-_ct.y * 0.5 + 0.5) * H];
  };
  const aimRef = () => {
    const cl = Math.cos(rig.lat);
    _cdir.set(Math.sin(rig.lon) * cl, Math.sin(rig.lat), Math.cos(rig.lon) * cl);
    surfacePoint(_cdir, _cref);
    return _cref;
  };
  const ptr = (type, x, y, button, ctrl) => canvas.dispatchEvent(new PointerEvent(type, {
    pointerId: 991, clientX: x, clientY: y, button, buttons: button === 1 ? 4 : 1,
    ctrlKey: !!ctrl, bubbles: true,
  }));
  const dragBy = (dx, dy, button = 0, ctrl = false, steps = 10) => {
    const sx = W * 0.5, sy = H * 0.5;
    ptr('pointerdown', sx, sy, button, ctrl);
    for (let i = 1; i <= steps; i++) ptr('pointermove', sx + (dx * i) / steps, sy + (dy * i) / steps, -1, ctrl);
    ptr('pointerup', sx + dx, sy + dy, button, ctrl);
  };
  const settle = (frames = 40) => { for (let i = 0; i < frames; i++) stepFrame(1 / 60, false); };
  const key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));

  // The measurement that defines "the world follows my cursor": the point of
  // the globe grabbed at pointer-down must sit under the cursor when the drag
  // ends, in pixels, whatever the lens, pitch, rotation, or zoom.
  // Returns the tracking error in pixels, or null when the gesture left the
  // globe (cursor over open sky), where keeping a point pinned is undefined
  // and the tangent-plane fallback takes over instead.
  const trackError = (dx, dy, steps = 10, resetTo = null) => {
    const sx = W * 0.5, sy = H * 0.5;
    // Each sub-test starts from the same pose so tracking accuracy is measured
    // independently of where previous drags left the camera.
    if (resetTo) { rig.lon = resetTo[0]; rig.lat = resetTo[1]; }
    rig.velLon = 0; rig.velLat = 0; rig.flight = null;
    for (let i = 0; i < 6; i++) stepFrame(1 / 60, false);
    ptr('pointerdown', sx, sy, 0, false);
    if (!rig.grabValid || !rig.rayHit) { ptr('pointerup', sx, sy, 0, false); return null; }
    _cref.copy(rig.grabDir).multiplyScalar(rig.grabR);
    const hitsBefore = rig.confineHits;
    let offGlobe = false;
    for (let i = 1; i <= steps; i++) {
      ptr('pointermove', sx + (dx * i) / steps, sy + (dy * i) / steps, -1, false);
      if (!rig.rayHit) offGlobe = true;
      stepFrame(1 / 60, false);
    }
    ptr('pointerup', sx + dx, sy + dy, 0, false);
    rig.velLon = 0; rig.velLat = 0;
    stepFrame(1 / 60, false);
    if (offGlobe) return null;
    // A drag that ran into the battlefield boundary at any point is meant to
    // stop short; that is confinement working, not a tracking error.
    if (rig.confineHits !== hitsBefore) return null;
    const p = project(_cref);
    const err = Math.hypot(p[0] - (sx + dx), p[1] - (sy + dy));
    return Number.isFinite(err) ? err : null;
  };

  // 1. Cursor tracking under every view rotation and drag direction. Confined
  // maps test from the middle of their battlefield with shorter gestures, so
  // the measurement is about tracking rather than about hitting the wall.
  const home = rig.confine
    ? [Math.atan2(rig.confine.center.x, rig.confine.center.z),
      Math.asin(Math.max(-1, Math.min(1, rig.confine.center.y)))]
    : [0.5, 0.25];
  // Gestures scale to how large the world actually appears: a 130px drag is a
  // gentle nudge on a colossus and more than the whole disc of a pocket world.
  const apparentRadiusPx = () => {
    const t = Math.tan((rig.camera.fov * Math.PI) / 360);
    const camDist = Math.max(rig.camera.position.length(), 1);
    return (CONFIG.planetRadius / camDist / Math.max(t, 0.05)) * (H / 2);
  };
  const gesture = () => {
    const g = apparentRadiusPx() * 0.28 * (rig.confine ? 0.55 : 1);
    return Math.max(40, Math.min(130, Math.round(g)));
  };
  rig.targetDist = rig.dist = rig.distMin + (rig.distMax - rig.distMin) * 0.4;
  settle();
  const L = gesture();
  const D = Math.round(L * 0.7);
  const yaws = [0, 45, 90, 135, 180, 225, 270, 315];
  const drags = [[L, 0], [-L, 0], [0, L], [0, -L], [D, D], [-D, D], [D, -D], [-D, -D]];
  let worstPx = 0, worstCase = null, sumPx = 0, samples = 0, offGlobe = 0;
  for (const yawDeg of yaws) {
    for (const [dx, dy] of drags) {
      rig.viewYaw = (yawDeg * Math.PI) / 180;
      const err = trackError(dx, dy, 10, home);
      if (err === null) { offGlobe++; continue; }
      sumPx += err; samples++;
      if (err > worstPx) { worstPx = err; worstCase = { yaw: yawDeg, drag: [dx, dy] }; }
    }
  }
  add('grabbed point stays under cursor under rotation',
    samples >= 16 && worstPx < 8, {
      worstErrorPx: +worstPx.toFixed(2),
      meanErrorPx: +(sumPx / Math.max(samples, 1)).toFixed(2),
      dragLengthPx: L, worstCase, samples, skippedAtBoundary: offGlobe,
    });
  rig.viewYaw = 0;

  // 2. Same tracking across the whole zoom range. The drag shrinks as the
  // planet shrinks on screen, since a fixed pixel drag from orbit would swing
  // the grabbed point around the far side.
  const zoomErrs = [];
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    rig.targetDist = rig.distMin + (rig.distMax - rig.distMin) * t;
    rig.dist = rig.targetDist;
    settle();
    const len = gesture();
    const err = trackError(len, Math.round(len * 0.4), 10, home);
    zoomErrs.push(err === null ? null : +err.toFixed(2));
  }
  add('cursor tracking holds across zoom',
    zoomErrs.filter((e) => e !== null).length >= 2
    && zoomErrs.every((e) => e === null || e < 8), { errorPxByZoom: zoomErrs });

  // 2b. Dragging off the globe must stay smooth and bounded, never NaN or a
  // snap: the cursor there points at sky, so motion continues on a tangent.
  rig.targetDist = rig.dist = rig.distMin + (rig.distMax - rig.distMin) * 0.4;
  rig.lon = 0.5; rig.lat = 0.25; settle();
  let maxJump = 0;
  const sx0 = W * 0.5, sy0 = H * 0.5;
  ptr('pointerdown', sx0, sy0, 0, false);
  let pl = rig.lon, pa = rig.lat;
  for (let i = 1; i <= 40; i++) {
    ptr('pointermove', sx0, sy0 - i * 22, -1, false);
    let d = rig.lon - pl;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    maxJump = Math.max(maxJump, Math.hypot(d, rig.lat - pa));
    pl = rig.lon; pa = rig.lat;
  }
  ptr('pointerup', sx0, sy0 - 880, 0, false);
  rig.velLon = 0; rig.velLat = 0;
  settle(4);
  add('dragging past the horizon stays bounded',
    Number.isFinite(maxJump) && maxJump <= 1.02
    && Number.isFinite(rig.lon) && Number.isFinite(rig.lat), {
      largestSingleStepRad: +maxJump.toFixed(4),
    });

  // 2c. The view must stay welded to what it is looking at through a full
  // zoom sweep. Pitching the camera in place instead of orbiting the focus
  // used to slide the world sideways worst at mid-zoom, which read as a
  // lurch in the middle of every scroll.
  rig.lon = home[0]; rig.lat = home[1];
  rig.targetDist = rig.dist = rig.distMin;
  settle(60);
  const clF = Math.cos(rig.lat);
  _cref.set(Math.sin(rig.lon) * clF, Math.sin(rig.lat), Math.cos(rig.lon) * clF)
    .multiplyScalar(CONFIG.planetRadius);
  let worstDrift = 0;
  for (let i = 0; i <= 60; i++) {
    rig.targetDist = rig.distMin + ((rig.distMax - rig.distMin) * i) / 60;
    settle(3);
    const p = project(_cref);
    worstDrift = Math.max(worstDrift, Math.hypot(p[0] - W * 0.5, p[1] - H * 0.5));
  }
  add('view stays centred through a full zoom', Number.isFinite(worstDrift) && worstDrift < 6, {
    worstDriftPx: +worstDrift.toFixed(2),
  });

  // 2d. The view angle must open steadily from grounded to look-down across
  // the zoom. It used to sag into a grazing near-flat look about a fifth of
  // the way out, where the pitch collided with the closing horizon, so a
  // single scroll passed through a framing neither end had asked for.
  // Shake displaces the camera by design, so measure with it off: a few
  // degrees of jitter would otherwise read as the sag being looked for.
  const shakeWas = rig.shakeEnabled;
  rig.shakeEnabled = false;
  rig.trauma = 0;
  let prevElev = -1e3, worstSag = 0, minElev = 1e3;
  for (let i = 0; i <= 40; i++) {
    // Drive height directly and cancel any tween or drift: a wave event can
    // fire flyTo mid-sweep, and a height that stops rising would show up as
    // sag that the pitch curve is not responsible for.
    rig.flight = null;
    rig.velLon = 0; rig.velLat = 0;
    rig.dist = rig.targetDist = rig.distMin + ((rig.distMax - rig.distMin) * i) / 40;
    settle(3);
    const cl = Math.cos(rig.lat);
    _cref.set(Math.sin(rig.lon) * cl, Math.sin(rig.lat), Math.cos(rig.lon) * cl);
    _cprobe.copy(rig.camera.position).addScaledVector(_cref, -CONFIG.planetRadius);
    const up = _cprobe.dot(_cref);
    const elev = Math.atan2(up, Math.sqrt(Math.max(0, _cprobe.lengthSq() - up * up)));
    if (i > 0) worstSag = Math.max(worstSag, prevElev - elev);
    prevElev = elev;
    minElev = Math.min(minElev, elev);
  }
  rig.shakeEnabled = shakeWas;
  add('view angle opens steadily through the zoom',
    Number.isFinite(worstSag) && worstSag < 0.012 && minElev > 0.14, {
      worstSagDeg: +((worstSag * 180) / Math.PI).toFixed(2),
      flattestDeg: +((minElev * 180) / Math.PI).toFixed(1),
    });

  // 3. Zoom clamps and stays finite.
  for (let i = 0; i < 40; i++) rig.zoomBy(-0.6);
  settle(30);
  const zMin = rig.dist;
  for (let i = 0; i < 60; i++) rig.zoomBy(0.6);
  settle(40);
  const zMax = rig.dist;
  add('zoom clamps to tuned height limits', zMin >= rig.distMin - 0.6 && zMax <= rig.distMax + 0.6, {
    reachedMin: +zMin.toFixed(1), reachedMax: +zMax.toFixed(1),
    limits: [+rig.distMin.toFixed(1), +rig.distMax.toFixed(1)],
  });

  // 4. Lens and pitch honor the tuning at both ends.
  rig.targetDist = rig.dist = rig.distMin; settle(80);
  const fovNear = rig.camera.fov, tiltNear = (rig.appliedTilt * 180) / Math.PI;
  rig.targetDist = rig.dist = rig.distMax; settle(90);
  const fovFar = rig.camera.fov, tiltFar = (rig.appliedTilt * 180) / Math.PI;
  // A small world's horizon can sit tighter than the tuned pitch, and no
  // camera can look further off nadir than that and still meet the ground, so
  // the endpoint to hold is the tuned angle or the horizon, whichever binds.
  const reach = (h, tuned) => Math.min(tuned, (rig._horizonAt(h) * 180) / Math.PI * 0.97);
  const wantNear = reach(rig.distMin, CAM_TUNE.tiltNear);
  const wantFar = reach(rig.distMax, CAM_TUNE.tiltFar);
  add('lens and pitch match the tuned endpoints', Math.abs(fovNear - CAM_TUNE.fovNear) < 1.5
    && Math.abs(fovFar - CAM_TUNE.fovFar) < 1.5
    && Math.abs(tiltNear - wantNear) < 1.5
    && Math.abs(tiltFar - wantFar) < 1.5, {
    fov: [+fovNear.toFixed(1), +fovFar.toFixed(1)],
    tiltDeg: [+tiltNear.toFixed(1), +tiltFar.toFixed(1)],
    achievable: [+wantNear.toFixed(1), +wantFar.toFixed(1)],
    tuned: { fov: [CAM_TUNE.fovNear, CAM_TUNE.fovFar], tilt: [CAM_TUNE.tiltNear, CAM_TUNE.tiltFar] },
  });

  // 5. Keyboard navigation moves the view and stops cleanly on release.
  rig.targetDist = rig.dist = rig.distMin + (rig.distMax - rig.distMin) * 0.3;
  settle(20);
  const kLon = rig.lon, kLat = rig.lat;
  key('keydown', 'KeyD');
  settle(18);
  key('keyup', 'KeyD');
  const kMoved = Math.hypot(rig.lon - kLon, rig.lat - kLat);
  settle(30);
  const kDrift = Math.hypot(rig.velLon, rig.velLat);
  add('keyboard pan moves and releases without drift', kMoved > 1e-4 && kDrift < 1e-3, {
    movedRad: +kMoved.toFixed(5), residualVelocity: +kDrift.toFixed(6),
  });

  // 6. Ctrl + middle drag rotates; ctrl + middle click resets.
  rig.viewYaw = 0; rig.tiltOffset = 0;
  dragBy(150, 60, 1, true);
  const rotYaw = rig.viewYaw, rotTilt = rig.tiltOffset;
  dragBy(0, 0, 1, true, 1);
  add('view rotation applies and click-resets', Math.abs(rotYaw) > 0.2 && Math.abs(rotTilt) > 0.05
    && rig.viewYaw === 0 && rig.tiltOffset === 0, {
    yawAfterDrag: +rotYaw.toFixed(3), tiltAfterDrag: +rotTilt.toFixed(3),
  });

  // 7. Inertia decays to rest.
  rig.viewYaw = 0;
  dragBy(220, 0);
  const flick = Math.abs(rig.velLon);
  for (let i = 0; i < 120; i++) stepFrame(1 / 60, false);
  add('flick inertia settles', flick > 0 && Math.abs(rig.velLon) < 1e-4, {
    launchVelocity: +flick.toFixed(4), after2s: +Math.abs(rig.velLon).toFixed(6),
  });

  // 8. Battlefield confinement holds under abusive input.
  if (rig.confine) {
    for (let i = 0; i < 12; i++) { dragBy(400, 260); settle(4); }
    settle(60);
    const cl = Math.cos(rig.lat);
    _cdir.set(Math.sin(rig.lon) * cl, Math.sin(rig.lat), Math.cos(rig.lon) * cl);
    const ang = Math.acos(Math.max(-1, Math.min(1, _cdir.dot(rig.confine.center))));
    add('camera stays inside the battlefield', ang <= rig.confine.maxAng + 0.02, {
      aimAngle: +ang.toFixed(3), limit: +rig.confine.maxAng.toFixed(3),
    });
  }

  // 9. No non-finite state anywhere in the rig.
  const finite = [rig.lon, rig.lat, rig.dist, rig.targetDist, rig.viewYaw, rig.tiltOffset,
    rig.velLon, rig.velLat, rig.camera.fov, rig.camera.position.x, rig.camera.position.y,
    rig.camera.position.z].every(Number.isFinite);
  add('camera state finite', finite, {});

  // 10. Frame cost of navigation at both extremes.
  const timeAt = (t) => {
    rig.targetDist = rig.dist = rig.distMin + (rig.distMax - rig.distMin) * t;
    settle(10);
    const t0 = performance.now();
    for (let i = 0; i < 120; i++) stepFrame(1 / 60, false);
    return +((performance.now() - t0) / 120).toFixed(3);
  };
  const msNear = timeAt(0), msFar = timeAt(1);
  add('sim + camera step under 6ms', msNear < 6 && msFar < 6, { msNear, msFar });

  // restore
  rig.lon = saved.lon; rig.lat = saved.lat;
  rig.dist = saved.dist; rig.targetDist = saved.target;
  rig.viewYaw = saved.yaw; rig.tiltOffset = saved.tilt;
  rig.velLon = 0; rig.velLat = 0;
  if (game) game.buildType = saved.build;
  settle(2);

  rep.failed = rep.checks.filter((c) => !c.ok).map((c) => c.name);
  return rep;
}
const SWELL_MAX = 1.9 * Math.min(1.9, Math.sqrt(CONFIG.planetRadius / 30));

function workMs() {
  let sum = 0;
  const n = Math.min(fpsCount, workSamples.length);
  for (let i = 0; i < n; i++) sum += workSamples[i];
  return n ? sum / n : 0;
}

let navDebugPts = null;
window.WH = {
  renderer, scene, world, rig, post, CONFIG, nav,
  fps, workMs, TOWER_TYPES,
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
  camTest: () => camTest(),
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
