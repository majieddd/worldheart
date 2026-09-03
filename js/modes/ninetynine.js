// The 99 Planets shell. The ONLY file that knows both the pure run core and
// Three.js. The core decides WHAT happened; this file decides what it looks
// like. Nothing here leaks back into js/run.

import { createRun } from '../run/run.js';
import { makeRng } from '../run/rng.js';
import { MODS } from '../towers.js';
import { EVO } from '../enemies.js';
import { SIM_RANDOM } from '../noise.js';
import { CONFIG } from '../config.js';
import * as THREE from 'three';
import { bankVictory } from './progress.js';

export function createNinetyNine({ game, waves, world, nav, rig, ui, enemies }) {
  const run = createRun({
    seed: CONFIG.seed,
    playerIds: ['solo'],
    startGold: CONFIG.economy.startGold,
  });

  // One seeded stream for the whole simulation, so a seed replays identically.
  // Offset from the world seed so terrain and combat are not correlated.
  SIM_RANDOM.next = makeRng((CONFIG.seed ^ 0x9e3779b9) >>> 0);

  const centre = nav.fieldCenter ? nav.fieldCenter.clone() : null;
  const _sdir = new THREE.Vector3();
  const _axis = new THREE.Vector3();
  const _up = new THREE.Vector3();
  let frontierTheta = 0;

  function applyFrontier(theta) {
    frontierTheta = theta;
    game.frontier = centre ? { centre, theta } : null;
    world.setFieldWallTheta(theta);
    world.setFogTheta(theta);
    // The camera follows the PLAYABLE area, not the built area, so the player
    // is never panned out over ground they cannot use yet, and how far they may
    // pull back grows with the territory they hold.
    rig.frontierTheta = theta;
    if (rig.confine) rig.confine.maxAng = theta * 1.02;
  }

  // Breach sites are authored across the FINAL cap, so an unremapped spawn at
  // wave 1 appears far outside a tiny circle and the walk in is most of the
  // wave. Pull the spawn along the great circle from the cap centre toward its
  // portal until it sits just outside the current frontier: the direction each
  // breach attacks from is preserved, the distance is not.
  function spawnNodeNearFrontier(portalNode) {
    if (!centre || portalNode < 0) return -1;
    nav.nodeDir(portalNode, _sdir);
    const ang = Math.acos(Math.max(-1, Math.min(1, _sdir.dot(centre))));
    const want = frontierTheta * 1.12;
    if (ang <= want || ang < 1e-4) return portalNode;   // already close enough
    _axis.crossVectors(centre, _sdir);
    if (_axis.lengthSq() < 1e-12) return portalNode;    // portal is dead centre
    _axis.normalize();
    _up.copy(centre).applyAxisAngle(_axis, want).normalize();
    const node = nav.nearestWalkableNode(_up);
    return node >= 0 ? node : portalNode;
  }

  // Everything the renderer needs to know is derived from the core, never
  // tracked separately, so the two cannot drift apart.
  function syncFromRun() {
    MODS.current = run.getModifiers();
    EVO.tier = run.getEvolutionTier();
    game.unlockedTowers = run.getUnlockedTowers();
    ui.unlockedTowers = game.unlockedTowers;
    game.tierCap = run.getTierCap();
    game.hand = run.getHand();
    ui.renderHand(game.hand);
    applyFrontier(run.getFrontierTheta());
  }

  function handle(events) {
    for (const e of events) {
      if (e.type === 'towerUnlocked') {
        ui.toast(`${e.tower.toUpperCase()} unlocked`, 'info');
      } else if (e.type === 'tierCapRaised') {
        ui.toast(`Tower upgrades unlocked: tier ${e.cap}`, 'info');
      } else if (e.type === 'enemiesEvolved') {
        ui.toast('The swarm evolves', 'danger');
      } else if (e.type === 'frontierGrew') {
        ui.toast('The frontier widens', 'info');
      } else if (e.type === 'draftOpened') {
        ui.showDraft(e.offers, (i) => { run.vote('solo', i); });
      } else if (e.type === 'powerTaken') {
        ui.hideDraft();
        ui.toast(`${e.power.name} taken`, 'info');
      } else if (e.type === 'runWon') {
        const progress = bankVictory();
        ui.showEnd(true, `the planet is yours — ${progress.planetsBeaten} held`);
      }
    }
    syncFromRun();
  }

  // A cleared wave advances the run, and the draft holds the next one until it
  // resolves. Chained, not assigned: the HUD already owns onWaveClear and
  // replacing it outright would silently kill the wave banner.
  const prevClear = waves.onWaveClear;
  waves.onWaveClear = (n, reward) => {
    prevClear?.(n, reward);
    if (run.getPhase() !== 'building') return;
    waves.state = 'idle';          // hold the countdown while drafting
    handle(run.completeWave());
  };

  enemies.spawnNodeOverride = spawnNodeNearFrontier;

  // Placing a tower spends its card. The core owns the hand, so the shell
  // reports the placement and re-reads rather than mutating a local copy.
  game.onCardSpent = (index) => { run.playCard(index); syncFromRun(); };

  syncFromRun();

  return {
    run,
    // Driven from stepFrame. dt is injected; the core never reads a clock.
    update(dt) {
      const draft = run.getDraft();
      if (!draft) return;
      ui.setDraftTimer(draft.remaining / 10);
      const events = run.tick(dt);
      if (events.length) {
        handle(events);
        // Draft settled: release the director for the next wave.
        if (run.getPhase() === 'building') {
          waves.state = 'countdown';
          waves.countdown = CONFIG.waves.prepTime;
        }
      }
    },
  };
}
