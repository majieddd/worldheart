// The 99 Planets shell. The ONLY file that knows both the pure run core and
// Three.js. The core decides WHAT happened; this file decides what it looks
// like. Nothing here leaks back into js/run.

import { createRun } from '../run/run.js';
import { makeRng } from '../run/rng.js';
import { MODS } from '../towers.js';
import { EVO } from '../enemies.js';
import { SIM_RANDOM } from '../noise.js';
import { CONFIG } from '../config.js';
import { bankVictory } from './progress.js';

export function createNinetyNine({ game, waves, world, nav, rig, ui }) {
  const run = createRun({
    seed: CONFIG.seed,
    playerIds: ['solo'],
    startGold: CONFIG.economy.startGold,
  });

  // One seeded stream for the whole simulation, so a seed replays identically.
  // Offset from the world seed so terrain and combat are not correlated.
  SIM_RANDOM.next = makeRng((CONFIG.seed ^ 0x9e3779b9) >>> 0);

  const centre = nav.fieldCenter ? nav.fieldCenter.clone() : null;

  function applyFrontier(theta) {
    game.frontier = centre ? { centre, theta } : null;
    world.setFieldWallTheta(theta);
    // The camera follows the PLAYABLE area, not the built area, so the player
    // is never panned out over ground they cannot use yet.
    if (rig.confine) rig.confine.maxAng = theta * 1.02;
  }

  // Everything the renderer needs to know is derived from the core, never
  // tracked separately, so the two cannot drift apart.
  function syncFromRun() {
    MODS.current = run.getModifiers();
    EVO.tier = run.getEvolutionTier();
    game.unlockedTowers = run.getUnlockedTowers();
    ui.unlockedTowers = game.unlockedTowers;
    game.tierCap = run.getTierCap();
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
