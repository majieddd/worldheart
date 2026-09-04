import * as THREE from 'three';
import { CONFIG, CAM_TUNE, PALETTE, LIGHTING } from './config.js';
import { OrbitRig } from './camera.js';
import { PostPipeline } from './postfx.js';
import { World, R, surfacePoint, setBattlefield, raycastTerrain, SUN_DIR } from './world.js';
import { NavGraph } from './nav.js';
import { SIM_RANDOM } from './noise.js';
import { makeRng } from './run/rng.js';
import { EnemyManager, EVO as ENEMY_EVO } from './enemies.js';
import { AllyManager, ALLY_TYPES } from './allies.js';
import { Possession, CacheField } from './possess.js';
import { ViewModel } from './viewmodel.js';
import { Effects } from './effects.js';
import { CombatFx } from './combatfx.js';
import { TowerManager, TOWER_TYPES, MODS as TOWER_MODS } from './towers.js';
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
// Soft shadows. PCFSoft costs more than PCF but this scene has hard flat
// facets everywhere, and a hard-edged shadow on top of them reads as a second
// facet rather than as light. autoUpdate stays on: towers, creatures and the
// shadow box itself all move.
renderer.shadowMap.enabled = LIGHTING.shadows.enabled;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
let mode99 = null;   // the 99 Planets shell, null in every other mode
let allies = null;   // friendly units; only built for modes that summon them
let possession = null;  // direct control of a unit, first person
let viewModel = null;   // the first-person weapon overlay
let combatFx = null;    // tracers, beams, shells and melee tells
let caches = null;      // gold hidden in the fog

/* ---- environment map and sun shadows ---------------------------------- */
const _shadowFocus = new THREE.Vector3();
const _shadowDir = new THREE.Vector3();

/* Runs once, after the sky and terrain exist.

   EVERY STEP HERE IS OPTIONAL AND MUST FAIL SOFT. Lighting is an enhancement;
   the game is playable without any of it. An earlier version called this
   unguarded from boot(), so a throw anywhere inside rejected the boot promise
   with no handler and the game hung on the boot screen showing nothing at all.
   PMREM in particular allocates a cube render target, which is exactly the
   kind of thing a constrained or sandboxed WebGL context can refuse while a
   plain page allows it, so it cannot be assumed to succeed just because it
   worked on the dev machine. Each block is isolated: losing the environment
   map must not also cost the shadows. */
function setupLighting() {
  // The sky group is already dome plus stars plus gas giant plus sun sprite,
  // so the environment costs one PMREM render at boot and nothing per frame.
  // fromScene walks any Object3D, so the Group is handed over as-is rather
  // than reparented out of the live scene.
  try {
    if (world.sky) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const rt = pmrem.fromScene(world.sky);
      scene.environment = rt.texture;
      scene.environmentIntensity = LIGHTING.envIntensity;
      pmrem.dispose();
    }
  } catch (err) {
    // Metals fall back to reflecting nothing, which is how the game shipped
    // before this existed. Worth a console line, not worth a dead boot.
    console.warn('environment map unavailable, continuing without it:', err);
    scene.environment = null;
  }

  try {
    setupSunShadow();
  } catch (err) {
    console.warn('shadows unavailable, continuing without them:', err);
    renderer.shadowMap.enabled = false;
    if (world.sun) world.sun.castShadow = false;
  }
}

function setupSunShadow() {
  const sun = world.sun;
  if (!sun || !renderer.shadowMap.enabled) return;
  const S = LIGHTING.shadows;
  sun.castShadow = true;
  sun.shadow.mapSize.set(S.mapSize, S.mapSize);
  // Both biases earn their keep on this geometry. bias fights the acne that
  // flat facets produce when a face is nearly parallel to the sun; normalBias
  // is the one that matters more here, because it offsets along the normal and
  // faceted normals are exactly what a per-vertex offset handles well.
  sun.shadow.bias = S.bias;
  sun.shadow.normalBias = S.normalBias;
  const c = sun.shadow.camera;
  c.near = 1;
  c.far = S.depth * 2;
  updateShadowCamera();
}

/* Shadows are the first thing to go when the frame budget is tight: they cost
   a whole extra scene pass over every caster. Dropping the map to 1024 rather
   than switching them off keeps the diorama read, which is the entire reason
   they were added, and halves the memory. Off entirely only if a tier below
   'low' is ever added. */
function setShadowTier(q) {
  const sun = world?.sun;
  if (!sun || !renderer.shadowMap.enabled) return;
  const size = q === 'low' ? 1024 : LIGHTING.shadows.mapSize;
  if (sun.shadow.mapSize.x === size) return;
  sun.shadow.mapSize.set(size, size);
  // The map is allocated lazily from mapSize, so an existing one has to be
  // released or the change silently does nothing.
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
}

/* Runs per frame. The rig is a focus-orbit rig, so rig.lon/lat IS the point
   pinned to screen centre: fitting the shadow box to it puts the whole map
   budget where the player is actually looking. Radius follows zoomT so a
   close view gets a tight, dense box and orbit still covers what is visible.
   Recomputed from lon/lat rather than read off the rig because camera.js does
   not expose its focus vector, and that file is deliberately not touched. */
function updateShadowCamera() {
  const sun = world?.sun;
  if (!sun || !sun.castShadow) return;
  const S = LIGHTING.shadows;
  let radius;
  // While a unit is possessed the ORBIT RIG IS NOT DRIVING, so rig.lon/lat stay
  // frozen wherever the overhead camera was left - usually the heart. Fitting
  // the shadow box to them meant the box stayed parked on the base while the
  // player walked hundreds of units away, and everything past its edge sampled
  // the shadow map out of bounds and banded across the ground. In first person
  // the box follows the unit instead, at its tightest radius, which is also the
  // densest: at eye level you only ever see the ground right around you.
  if (possession && possession.unit) {
    _shadowFocus.copy(possession.unit.dir).multiplyScalar(R);
    radius = S.radiusNear;
  } else {
    const cosLat = Math.cos(rig.lat);
    _shadowDir.set(Math.sin(rig.lon) * cosLat, Math.sin(rig.lat), Math.cos(rig.lon) * cosLat);
    _shadowFocus.copy(_shadowDir).multiplyScalar(R);
    radius = S.radiusNear + (S.radiusFar - S.radiusNear) * rig.zoomT;
  }
  const c = sun.shadow.camera;
  if (c.right !== radius) {
    c.left = -radius; c.right = radius; c.top = radius; c.bottom = -radius;
    c.updateProjectionMatrix();
  }
  // Stand the light off along the sun direction far enough that the near plane
  // clears terrain relief between the light and the focus.
  sun.position.copy(_shadowFocus).addScaledVector(SUN_DIR, S.depth);
  sun.target.position.copy(_shadowFocus);
  sun.target.updateMatrixWorld();
}

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
  setupLighting();
  await progress(BOOT_LABELS[7]);

  const heartPos = nav.nodePos(nav.heartNode, new THREE.Vector3());
  world.addHeart(heartPos);
  world.crushDecorNear(heartPos, 4.2);
  // The energy wall reads as a containment fence on a planet surface; in open
  // space the void itself is the boundary and a ring just looks bolted on.
  if (CONFIG.map.mode === 'battlefield' || CONFIG.map.mode === 'ninetynine') {
    // 99 Planets builds the wall at the FINAL angle and then moves it inward
    // for wave 1; the shell re-angles it as the frontier widens.
    world.addFieldWall(nav.fieldCenter, CONFIG.map.fieldTheta);
    world.addCloudDeck(nav.fieldCenter, CONFIG.map.fieldTheta);
    // The roguelite hides everything past the frontier behind fog. Built at the
    // final angle and then pulled in by the shell, same as the wall.
    if (CONFIG.map.mode === 'ninetynine') {
      world.addFogVeil(nav.fieldCenter, CONFIG.map.fieldTheta);
    }
  }
  const portalPositions = [];
  for (const pn of nav.portalNodes) {
    const pp = nav.nodePos(pn, new THREE.Vector3());
    const portal = world.addPortal(pp);
    // The wave director excludes breaches by NAV NODE, so the visual has to
    // know which node it belongs to or a destroyed breach keeps spawning.
    portal.node = pn;
    world.crushDecorNear(pp, 3.2);
    portalPositions.push(pp);
  }

  enemies = new EnemyManager(scene, nav);
  enemies.setHeart(heartPos);
  // Friendly units. Only the roguelite summons them today, but the manager is
  // cheap when empty and keeping it unconditional avoids a null check on every
  // frame of the sim loop.
  allies = new AllyManager(scene, enemies);
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
    if (q === 'low') { post.setQuality('low'); pixelRatio = 1.1; setShadowTier('low'); }
    else if (q === 'high') { post.setQuality('high'); pixelRatio = Math.min(devicePixelRatio || 1, PIXEL_RATIO_CAP); setShadowTier('high'); }
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
  towerMgr.allies = allies;
  allies.world = world;
  // Rally reaches into barracks garrisons, so it has to be able to find them.
  allies.towers = towerMgr;
  // Enemies swing at whatever stands in front of them, so they need to be able
  // to see the friendly bodies. Held as a plain reference rather than an import
  // because allies.js already imports the enemy module.
  enemies.allies = allies;

  // Hit confirmation. A swing that lands has to SAY so - damage in the world,
  // a kick on the crosshair, a jolt on the camera - and a swing the tier-3
  // shield eats has to say that too, or a strike doing nothing three times in
  // a row reads as a broken weapon rather than as armour holding.
  const _fpHit = new THREE.Vector3();
  allies.onStrikeHit = (enemy, landed, primary) => {
    towerMgr.enemyWorldPos(enemy, _fpHit);
    if (landed > 0) {
      fx.floaters.spawn(_fpHit, String(Math.round(landed)), primary ? '#ffffff' : '#c8d4f0', primary ? 14 : 11);
    } else {
      fx.floaters.spawn(_fpHit, 'BLOCKED', '#8b97b8', 11);
    }
    if (primary) {
      ui?.strikeFeedback?.(landed, landed <= 0);
      rig.addTrauma(landed > 0 ? 0.05 : 0.03);
      audio?.play(landed > 0 ? 'meleeHit' : 'blocked');
    }
    // A spark at the point of contact and a shard or two off the body, so the
    // blade is seen to bite rather than a number appearing beside a target.
    if (landed > 0) {
      fx.impactSpark(_fpHit, primary ? PALETTE.energyHot : PALETTE.energy);
      if (primary) fx.shards.burst(_fpHit, _fxTmp2.copy(_fpHit).normalize(), 3, PALETTE.voidPlate, 3.5, 0.7);
    }
  };

  // A landed blow stops the world for a few frames. Hit stop is the cheapest
  // weight there is: the eye reads the pause as impact, and everything that
  // follows (the shake, the number, the knockback) lands on a still frame.
  // Only the possessed body earns it, and only on a hit that did damage.
  allies.onSwingStart = (a) => possession?.swingStarted?.(a);
  allies.onStrikeResolved = (a, hits, spec) => {
    possession?.strikeResolved?.(a, hits, spec);
    if (spec && hits > 0 && possession && possession.unit === a) game.hitStop = Math.max(game.hitStop || 0, 0.07);
  };
  // Being hit in first person should land on the player, not only on a number.
  // The thump when a hop ends. onLand was declared and fired and had never been
  // assigned to anything, so a jump landed in silence.
  allies.onLand = (a) => {
    if (possession && possession.unit === a) { audio?.play('land'); possession.landed(a); }
  };
  allies.onHurt = (a, amount) => {
    if (!possession || possession.unit !== a) return;
    rig.addTrauma(Math.min(0.22, 0.05 + amount / 260));
  };

  caches = new CacheField(scene);
  possession = new Possession({ canvas, rig, allies, game, ui: null, caches, scene });
  // The weapon in your hands, drawn in its own pass over the world.
  viewModel = new ViewModel();
  possession.viewModel = viewModel;
  // The third-person boom asks the world what stands between it and the eye.
  possession.world = world;
  window.WH.viewModel = viewModel;
  window.WH.possession = possession;
  window.WH.caches = caches;
  // The visible side of every strike the sim reports. Built AFTER onLand and
  // onStrikeHit above, because it chains whatever is already assigned rather
  // than replacing it, and after possession, because it asks possession whose
  // body a blow landed on.
  combatFx = new CombatFx({ scene, fx, allies, enemies, rig, audio, ui });
  combatFx.possession = possession;
  window.WH.combatFx = combatFx;
  // A felled breach stops feeding waves and pays a bounty. Tracked by nav node
  // because that is the identity the wave director filters on.
  waves.destroyedNodes = new Set();
  allies.onPortalDestroyed = (p) => {
    if (p.node >= 0) waves.destroyedNodes.add(p.node);
    game.gold += 180;
    ui?.toast?.('Breach collapsed', 'info');
    fx?.explosion?.(p.group.position, 4.5);
  };
  window.WH.allies = allies;
  window.WH.ALLY_TYPES = ALLY_TYPES;
  possession.ui = ui;
  // Both keydown owners need to know when the player is on the ground, so the
  // board's verbs can stand down. Without this the first-person key surface is
  // just the board's with three keys layered on top and nothing arbitrating.
  ui.possession = possession;
  game.possession = possession;
  possession.audio = audio;
  // Drawn INSIDE the scene pass so the weapon is tone mapped, graded, bloomed
  // and multisampled with everything else, instead of being composited over a
  // finished frame and reading as a different renderer.
  post.overlay = (r) => viewModel?.render(r);
  window.WH.ui = ui;

  // The roguelite shell binds the pure run core to the game. Constructed last
  // so every callback it chains is already installed.
  if (CONFIG.map.mode === 'ninetynine') {
    const { createNinetyNine } = await import('./modes/ninetynine.js');
    mode99 = createNinetyNine({ game, waves, world, nav, rig, ui, enemies, allies, possession, caches });
    window.WH.mode99 = mode99;
  }
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
        setShadowTier('low');
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
  // While a unit is possessed the orbit rig stands down entirely and the
  // camera is placed on the unit's eye instead. That is also what lets a
  // possessed unit walk past the frontier: the confine lives on the rig.
  //
  // Gated on `unit` rather than `active` so a body dying UNDER the player still
  // gets one update to release control and the pointer lock. Gating on active
  // left a dead reference held and onExit never fired.
  // The camera has to keep being placed while paused or the view freezes
  // mid-frame, but a possessed unit must NOT keep moving and swinging: this ran
  // above the simActive gate on raw dt, so a paused player could still walk,
  // and a beam archetype - which has no swing cooldown to rate-limit it - could
  // channel a whole wave to death against a frozen board.
  const simRunning = !!(game && game.state === 'playing' && !game.paused);
  if (possession && possession.unit) possession.update(dt, simRunning);
  if (!possession || !possession.active) rig.update(dt);
  camFill.position.copy(rig.camera.position);
  // After rig.update so the box tracks this frame's focus, not last frame's.
  // Inside stepFrame rather than the rAF loop so WH.step() advances it too:
  // a scripted verification run has to see the same shadows a player does.
  updateShadowCamera();
  world.update(dt, rig.camera.position);
  // Drives the draft timer. Outside the simDt gate on purpose: the draft must
  // keep counting while the director is held idle between waves.
  if (mode99 && game && game.state === 'playing' && !game.paused) mode99.update(dt);
  const simActive = game && game.state === 'playing' && !game.paused;
  let simDt = simActive ? dt * game.speed : 0;
  // Hit stop: the simulation freezes for a few frames after a landed strike
  // while the camera, the view model and the HUD keep running. Consumed on
  // raw dt so game speed cannot stretch it.
  if (game && game.hitStop > 0) { game.hitStop -= dt; simDt = 0; }
  if (simDt > 0) {
    allies?.update(simDt);
    caches?.update(simDt);
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
    // While possessed the orbit rig is not driving, so rig.zoomT is frozen at
    // whatever the survey view was left at - and the strategic layer kept
    // reading it. Standing on the ground with every enemy swollen to 3x and
    // strategic icons floating over them is most of what first person looked
    // wrong. On foot the scale is life size and the icons are off.
    const z = (possession && possession.active) ? 0 : rig.zoomT;
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
    // Same dt as the effects so a tracer freezes with the board it was fired
    // on; the beam is gated on being fed this frame, not on dt.
    combatFx?.update(simDt);
  }
  if (render) post.render(scene, rig.camera, dt);
}

// Every tower needs an entry or the strategic layer lies about what is on the
// board: a missing key falls through to the Bolt colour, so a Warden Barracks
// was drawing a Bolt Sentinel's icon.
const ICON_COLORS = {
  bolt: 0x59f2ff, cryo: 0xbff1ff, mortar: 0xffc857, tesla: 0x9db8ff, helios: 0xffd9a0, warden: 0x8fe3ff,
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
  // How high the camera sits above the ground at screen centre, measured at
  // that ground point. This is what the framing actually reads as, and unlike
  // the rig's own pitch it does not carry the planet radius in it.
  function viewAngle() {
    const cl = Math.cos(rig.lat);
    _cref.set(Math.sin(rig.lon) * cl, Math.sin(rig.lat), Math.cos(rig.lon) * cl);
    _cprobe.copy(rig.camera.position).addScaledVector(_cref, -CONFIG.planetRadius);
    const up = _cprobe.dot(_cref);
    return Math.atan2(up, Math.sqrt(Math.max(0, _cprobe.lengthSq() - up * up)));
  }

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
    const elev = viewAngle();
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

  // 4. Lens and view angle honor the tuning at both ends. The view angle is
  // measured at the ground, so these numbers must come out the same on every
  // world; that identity is what keeps one tuning framing a planetoid and a
  // colossal planet alike, and it is the thing to guard.
  // settle(45), not 20. The lens eases at dt*7, so 20 frames leaves 8.4% of
  // the gap unclosed. That was 1.4 degrees on the old 17-degree fov span and
  // squeaked under the 1.5 tolerance; on a wider span it reads as a failure
  // the lens does not actually have. The tolerance below is unchanged, this
  // only lets the value it measures finish arriving.
  rig.flight = null; rig.velLon = 0; rig.velLat = 0;
  rig.targetDist = rig.dist = rig.distMin; settle(45);
  const fovNear = rig.camera.fov, viewNear = (viewAngle() * 180) / Math.PI;
  rig.targetDist = rig.dist = rig.distMax; settle(45);
  const fovFar = rig.camera.fov, viewFar = (viewAngle() * 180) / Math.PI;
  add('lens and view angle match the tuned endpoints', Math.abs(fovNear - CAM_TUNE.fovNear) < 1.5
    && Math.abs(fovFar - CAM_TUNE.fovFar) < 1.5
    && Math.abs(viewNear - CAM_TUNE.viewNear) < 1.2
    && Math.abs(viewFar - CAM_TUNE.viewFar) < 1.2, {
    fov: [+fovNear.toFixed(1), +fovFar.toFixed(1)],
    viewDeg: [+viewNear.toFixed(1), +viewFar.toFixed(1)],
    tuned: { fov: [CAM_TUNE.fovNear, CAM_TUNE.fovFar], view: [CAM_TUNE.viewNear, CAM_TUNE.viewFar] },
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
  fps, workMs, TOWER_TYPES, TOWER_MODS, ENEMY_EVO, SIM_RANDOM, makeRng,
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

/* boot() was called bare. An async function's rejection with no handler is
   silent in a page: the boot screen simply sits there forever and nothing
   anywhere says why. That is the worst possible failure for a game someone
   opened from a link, because it is indistinguishable from a slow load.
   Surface it on the boot screen instead, and keep the console line for
   whoever can open devtools. */
boot().catch((err) => {
  console.error('boot failed:', err);
  const status = document.getElementById('boot-status');
  if (status) {
    status.textContent = 'Boot failed: ' + ((err && err.message) || String(err));
    status.style.color = 'var(--danger-text, #ff8ba0)';
  }
});
