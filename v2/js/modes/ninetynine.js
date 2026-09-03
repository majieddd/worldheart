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
import { bankVictory, bankCoins, loadProfile } from './progress.js';

export function createNinetyNine({ game, waves, world, nav, rig, ui, enemies, allies, possession, caches }) {
  // What this player has permanently unlocked. Read here in the shell and
  // handed to the core as a plain object, because js/run may not know that
  // storage exists.
  const profile = loadProfile();
  const run = createRun({
    seed: CONFIG.seed,
    playerIds: ['solo'],
    startGold: CONFIG.economy.startGold + (profile.bonuses.interest ? 150 : 0),
    profile,
  });
  // A seeded stream for shell-side choices, kept separate from the core's so
  // that adding a roll here cannot shift the run's own sequence.
  const rng = makeRng((CONFIG.seed ^ 0x5bf03635) >>> 0);

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
    // Possession reads this to fog the view once a unit walks out past it.
    if (possession) possession.frontier = game.frontier;
    // The commander's post grows with the territory but stays well inside it:
    // it is the last line at the core, not the frontline. Handing it the whole
    // frontier made it the tank for every wave and it was ground down by ten.
    // Read from the live list rather than the `commander` binding, which is
    // declared further down: this runs during setup too.
    if (allies) {
      const post = Math.max(12, Math.min(CONFIG.planetRadius * theta * 0.4, 30));
      for (const a of allies.active) {
        if (a.type.commander && a.active && !a.dead) a.leash = post;
      }
    }
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
  // A living commander steadies the whole line. Applied ON TOP of the run's
  // folded powers rather than inside them, because it is a battlefield
  // condition, not something drafted: it must appear and vanish with the
  // commander without touching the power list.
  const COMMANDER_DMG_BONUS = 0.15;

  function commanderAlive() {
    return allies ? allies.active.some((a) => a.type.commander && a.active && !a.dead) : false;
  }

  function syncFromRun() {
    const mods = run.getModifiers();
    if (commanderAlive()) mods.dmgMul += COMMANDER_DMG_BONUS;
    MODS.current = mods;
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
        seedCaches(e.theta);
      } else if (e.type === 'draftOpened') {
        ui.showDraft(e.offers, (i) => { run.vote('solo', i); });
      } else if (e.type === 'powerTaken') {
        ui.hideDraft();
        ui.toast(`${e.power.name} taken`, 'info');
      } else if (e.type === 'waveCleared') {
        if (e.coins) {
          bankCoins(e.coins);
          ui.toast(`+${e.coins} coins`, 'info');
        }
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
  // A completion that arrives while the core is mid-draft is QUEUED, never
  // dropped. Returning early here let the director run the next wave while the
  // core stood still, so the two counters drifted apart a wave at a time and
  // the run silently stopped expanding, unlocking and evolving on schedule.
  let pendingClears = 0;

  const prevClear = waves.onWaveClear;
  waves.onWaveClear = (n, reward) => {
    prevClear?.(n, reward);
    // Hold the director unconditionally: the core decides when the next wave
    // may start. This has to happen even when the completion is queued, which
    // is exactly the case the early return used to skip.
    waves.state = 'idle';
    if (run.getPhase() !== 'building') { pendingClears++; return; }
    handle(run.completeWave());
  };

  enemies.spawnNodeOverride = spawnNodeNearFrontier;

  // The RUN decides when the planet is won, not the wave director. Both count
  // to fifteen, so leaving the classic hook armed meant two endings raced for
  // the same overlay.
  waves.onVictory = () => {};

  // Placing a tower spends its card. The core owns the hand, so the shell
  // reports the placement and re-reads rather than mutating a local copy.
  game.onCardSpent = (index) => { run.playCard(index); syncFromRun(); };

  // ---- commanders -------------------------------------------------------
  // Drawn from what the profile has unlocked, on the run's own seeded RNG so a
  // seed still replays identically.
  const COMMANDERS = ['commander', 'duelist', 'marksman', 'bombardier', 'oracle'];
  function pickCommander() {
    const owned = COMMANDERS.filter((k) => profile.commanders.includes(k));
    const pool = owned.length ? owned : ['commander'];
    return pool[Math.floor(rng() * pool.length) % pool.length];
  }

  // One is granted at the start of the run and is permanent. Losing it ends
  // the run, which is the entire reason a trip into the fog is a gamble.
  let commander = null;
  if (allies && centre) {
    // Which commander leads the run. The archetypes play very differently, so
    // this is a real choice rather than a skin - and it is the hook the talent
    // tree hangs its commander unlocks on.
    commander = allies.spawn(pickCommander(), centre, centre, 8);
    allies.onCommanderLost = () => {
      run.loseRun();
      game.state = 'defeat';
      ui.showEnd(false, 'the commander fell');
    };
    // A commander buff appearing or vanishing has to reach the towers, and it
    // only changes on death, so re-syncing here is enough.
    allies.onDeath = (a) => { if (a.type.commander) syncFromRun(); };
  }

  // ---- click to possess, and posting a patrol ---------------------------
  const _pd = new THREE.Vector3();

  // A warden's garrison can be posted anywhere inside its leash. Right-click a
  // spot with a barracks selected and everything it summoned musters there,
  // including units it has not summoned yet.
  function setPatrolFrom(tower, dir) {
    if (!tower || tower.typeKey !== 'warden' || !allies) return false;
    const reach = tower.stats.leash;
    _pd.copy(tower.pos).normalize();
    const arc = Math.acos(Math.max(-1, Math.min(1, _pd.dot(dir)))) * CONFIG.planetRadius;
    if (arc > reach) {
      ui.toast('Too far from the barracks to post a patrol', 'warn');
      return false;
    }
    tower.patrolDir = dir.clone().normalize();
    let n = 0;
    for (const a of allies.active) {
      if (a.homeTower === tower.id) { allies.setPatrol(a, tower.patrolDir); n++; }
    }
    ui.toast(n ? `Patrol posted: ${n} on station` : 'Patrol posted', 'info');
    return true;
  }

  const prevTap = rig.onTap;
  rig.onTap = (x, y, button) => {
    // A possessed unit owns the mouse: left click swings and right drag looks,
    // both handled in js/possess.js. Letting the tap fall through from here
    // meant every swing also selected whatever tower happened to be under the
    // crosshair, and a right click posted a patrol mid-fight.
    if (possession && possession.active) return;
    // Right-click with a barracks selected posts its patrol.
    if (button === 2 && game.selectedTower && game.selectedTower.typeKey === 'warden' && game.cursorValid) {
      if (setPatrolFrom(game.selectedTower, game.cursorDir)) return;
    }
    // Only an idle left click takes a body; building and the tower panel keep
    // their own use of the tap.
    if (button === 0 && !game.buildType && possession && !possession.active && game.cursorValid) {
      const unit = allies.nearestTo(game.cursorPos, 3.2);
      if (unit) {
        possession.enter(unit);
        return;
      }
    }
    prevTap?.(x, y, button);
  };

  if (possession) {
    possession.onEnter = (u) => {
      ui.showPossession(u);
    };
    possession.onExit = () => {
      ui.hidePossession();
      ui.toast('Control released', 'info');
      // Hand the orbit rig back looking at what it was looking at, so the view
      // does not snap to a stale focus from before possession.
      if (world.heart) rig.flyTo(world.heart.group.position, rig.dist, 0.35);
    };
  }

  // ---- caches in the fog ------------------------------------------------
  // Seeded fresh each expansion, on the ring between the new frontier and the
  // far edge, so there is always something worth walking into the dark for.
  function seedCaches(theta) {
    if (!caches || !centre) return;
    caches.scatter(centre, theta * 1.15, Math.min(theta * 2.6, CONFIG.map.fieldTheta), 4);
  }

  syncFromRun();

  return {
    run,
    // Driven from stepFrame. dt is injected; the core never reads a clock.
    update(dt) {
      const draft = run.getDraft();
      if (draft) {
        ui.setDraftTimer(draft.remaining / 10);
        const events = run.tick(dt);
        if (events.length) handle(events);
      }
      if (run.getPhase() !== 'building') return;
      // Drain a completion that landed while the core was drafting, one per
      // frame: each one can open the next draft, so it must be allowed to.
      if (pendingClears > 0) {
        pendingClears--;
        handle(run.completeWave());
        return;
      }
      // Release the director. Checked every frame rather than only when a
      // draft produced events, because a wave that resolves without opening
      // one would otherwise leave the manager parked on 'idle' forever.
      if (waves.state === 'idle') {
        waves.state = 'countdown';
        waves.countdown = CONFIG.waves.prepTime;
      }
    },
  };
}
