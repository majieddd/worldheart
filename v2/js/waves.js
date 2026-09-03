import { CONFIG } from './config.js';
import { SIM_RANDOM } from './noise.js';

// Wave direction: 30 authored waves, then endless scaling. Portals wake at
// waves 1, 4, 9, 14. Bosses at 10, 20, 30. Early calls pay the remaining
// countdown as bounty.

export function hpScale(wave) {
  let s = 1 + (wave - 1) * 0.08;
  if (wave > 10) s += (wave - 10) * 0.05;
  if (wave > 20) s += (wave - 20) * 0.055;
  if (wave > 30) s *= Math.pow(1.12, wave - 30);
  return s;
}

export function portalCount(wave) {
  const wakes = CONFIG.map.portalWakes;
  let count = 0;
  for (const w of wakes) if (wave >= w) count++;
  return Math.max(1, count);
}

export function waveReward(wave) {
  return 70 + wave * 9;
}

// Returns spawn groups: { type, count, gap, portal: 'all' | index-within-active }
export function waveComp(wave) {
  const w = wave;
  const total = CONFIG.waves.count;
  // A short run gets exactly one boss, on its final wave. The classic 30-wave
  // maps keep their bosses at 10, 20 and 30.
  const boss = total === 30 ? w % 10 === 0 : w === total;
  const groups = [];
  const push = (type, count, gap, portal = 'spread') => groups.push({ type, count, gap, portal });

  if (boss) {
    if (total !== 30) {
      // The three-phase planetary boss: an armoured approach, its escorts,
      // then the swarm that arrives while it is still standing.
      push('colossus', 1, 4, 'far');
      push('aegis', 4, 2.2);
      push('husk', 18, 0.9);
      push('mite', 24, 0.4);
      push('wisp', 10, 1.1);
      return groups;
    }
    push('colossus', Math.max(1, Math.floor(w / 22)), 4, 'far');
    push('husk', 4 + w, 1.15);
    push('mite', 6 + w, 0.6);
    if (w >= 20) push('wisp', 6 + Math.floor(w / 3), 1.3);
    return groups;
  }

  switch (w % 5) {
    case 1:
      push('husk', 6 + Math.floor(w * 1.4), 1.35);
      if (w > 6) push('mite', 4 + w, 0.6);
      break;
    case 2:
      push('mite', 10 + w * 2, 0.42);
      if (w > 8) push('husk', Math.floor(w * 0.8), 1.4);
      break;
    case 3:
      push('husk', 5 + w, 1.3);
      push('wisp', 2 + Math.floor(w * 0.6), 1.5);
      break;
    case 4:
      push('aegis', 1 + Math.floor(w / 4), 3.2);
      push('husk', 4 + w, 1.2);
      if (w > 12) push('mite', w, 0.5);
      break;
    case 0:
      push('mite', 8 + w, 0.5);
      push('wisp', 2 + Math.floor(w / 2), 1.6);
      push('aegis', Math.floor(w / 6), 3.5);
      break;
  }
  return groups;
}

export class WaveDirector {
  constructor(game, enemies, nav) {
    this.game = game;
    this.enemies = enemies;
    this.nav = nav;
    this.wave = 0;
    this.state = 'idle'; // idle | countdown | spawning | combat
    this.countdown = 0;
    this.queues = [];
    this.pendingSpawns = 0;
    this.onWaveStart = null;
    this.onWaveClear = null;
    this.onPortalWake = null;
    this.onVictory = null;
    this.onCountdown = null;
  }

  begin() {
    this.wave = 0;
    this.state = 'countdown';
    this.countdown = CONFIG.waves.firstPrep;
  }

  callEarly() {
    if (this.state !== 'countdown') return 0;
    const bonus = Math.floor(this.countdown) * CONFIG.waves.earlyBonusPerSec;
    this.game.gold += bonus;
    this.countdown = 0;
    return bonus;
  }

  activePortals() {
    return this.nav.portalNodes.slice(0, portalCount(Math.max(this.wave, 1)));
  }

  _startWave() {
    this.wave++;
    const prevPortals = portalCount(Math.max(this.wave - 1, 1));
    const nowPortals = portalCount(this.wave);
    if (nowPortals > prevPortals && this.wave > 1 && this.onPortalWake) {
      this.onPortalWake(nowPortals - 1);
    }
    const comp = waveComp(this.wave);
    const scale = hpScale(this.wave);
    const active = this.activePortals();
    this.queues = [];
    this.pendingSpawns = 0;

    for (const g of comp) {
      let portals;
      if (g.portal === 'far') portals = [active[0]];
      else if (typeof g.portal === 'number') portals = [active[g.portal % active.length]];
      else portals = active;
      for (let i = 0; i < g.count; i++) {
        const portal = portals[i % portals.length];
        this.queues.push({
          t: 1.2 + i * g.gap + SIM_RANDOM.next() * 0.3,
          type: g.type, portal, scale,
        });
        this.pendingSpawns++;
      }
    }
    this.queues.sort((a, b) => a.t - b.t);
    this.clock = 0;
    this.state = 'spawning';
    if (this.onWaveStart) this.onWaveStart(this.wave, waveComp(this.wave));
  }

  update(dt) {
    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.onCountdown) this.onCountdown(this.countdown);
      if (this.countdown <= 0) this._startWave();
      return;
    }
    if (this.state === 'spawning' || this.state === 'combat') {
      this.clock += dt;
      while (this.queues.length && this.queues[0].t <= this.clock) {
        const q = this.queues.shift();
        this.enemies.spawn(q.type, q.portal, q.scale);
        this.pendingSpawns--;
        if (this.onSpawnPortal) this.onSpawnPortal(q.portal);
      }
      if (!this.queues.length) this.state = 'combat';
      if (this.state === 'combat' && this.enemies.active.length === 0) {
        const reward = waveReward(this.wave);
        this.game.gold += reward;
        if (this.onWaveClear) this.onWaveClear(this.wave, reward);
        if (this.wave >= CONFIG.waves.count && !this.victoryFired) {
          this.victoryFired = true;
          if (this.onVictory) this.onVictory();
        }
        this.state = 'countdown';
        this.countdown = CONFIG.waves.prepTime;
      }
    }
  }
}
