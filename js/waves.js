import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SIM_RANDOM } from './noise.js';
import { planetGroups } from './encounters.js';

// Classic maps keep their authored waves and breach schedule. 99 Planets
// opts into timed, overlapping nest waves with per-assault completion.
// Early calls pay the remaining countdown as bounty.

const ATK_SCALE_SLOPE = 0.35;
const ATK_SCALE_CAP = 4;

// Nests: 99 Planets only. The shell authors visible stationary sources;
// waves and extra raids both emerge at those exact nodes. Destroying a nest
// cancels its remaining buildup. The old frontier-only nest predicate below
// remains the legacy mode contract for tests and other callers.
// Measured at the brief's 16 s with a one-tower wave-1 base under 99 Planets'
// half-length cadence: ten raiders in 46 s of sim, the wave never reached
// zero enemies and so never cleared, and the leaks took five lives. A raid is
// a tax, not a siege: it starts on wave 2, arrives every 26 s (13 s at the
// mode's pace) tightening to 12, and raiders never hold a wave open.
const RAID_INTERVAL = 26;
const RAID_INTERVAL_FLOOR = 12;
const RAID_INTERVAL_SLOPE = 0.5;
const RAID_START_WAVE = 2;
// A raider spawns a beat after the last so a pack reads as a pack, not a
// clump on one node.
const RAID_GAP = 0.55;
// A breach counts as swallowed at the same margin the mode uses to stop
// remapping its spawns, so the two readings of "inside" cannot disagree.
const NEST_MARGIN = 1.12;

// The pack a nest sends. Small on purpose: a raid is a tax on an unexpanded
// frontier, not a second wave.
export function raidComp(wave) {
  // One mite while the base is a tower and a commander, a pair from wave 4,
  // a husk from wave 6 and an aegis from wave 9. Measured with two mites from
  // wave 2 against a one-tower base: fifteen lives gone by wave 3.
  const pack = [{ type: 'mite', count: wave >= 4 ? 2 : 1 }];
  if (wave >= 6) pack.push({ type: 'husk', count: 1 });
  if (wave >= 9) pack.push({ type: 'aegis', count: 1 });
  return pack;
}

export function raidInterval(wave, paceMul = 1) {
  return Math.max(RAID_INTERVAL_FLOOR, RAID_INTERVAL - (wave - 1) * RAID_INTERVAL_SLOPE) * paceMul * (CONFIG.campaign?.pressure==='raids'?.85:1);
}

const _nd = new THREE.Vector3();

export function hpScale(wave) {
  let s = 1 + (wave - 1) * 0.08;
  if (wave > 10) s += (wave - 10) * 0.05;
  if (wave > 20) s += (wave - 20) * 0.055;
  // Endless eventually becomes linear again; neither HP nor a queue may
  // overflow just because a player keeps the same assault running.
  if (wave > 30) s *= Math.pow(1.12, Math.min(60, wave - 30));
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

// A campaign wave adds sources on a clock even if earlier enemies survive.
// Breathing room grows with the size of the assault, not with enemy transit.
export function nestWaveInterval(wave) { return Math.min(75, 45 + (wave - 1) * 2); }
export function newNestCount(wave) { return wave < CONFIG.waves.count && wave % 5 === 0 ? 2 : 1; }

// Returns spawn groups: { type, count, gap, portal: 'all' | index-within-active }
export function waveComp(wave) {
  const w = wave;
  const total = CONFIG.waves.count;
  // A short run gets exactly one boss, on its final wave. The classic 30-wave
  // maps keep their bosses at 10, 20 and 30.
  const boss = total === 30 || CONFIG.map.mode === 'ninetynine' ? w % 10 === 0 : w === total;
  const groups = [];
  const push = (type, count, gap, portal = 'spread') => groups.push({ type, count:Math.min(90,count), gap, portal });

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
    // Scales BOTH the breather between waves and the spawn cadence inside one,
    // because halving only the gap between waves would leave each wave taking
    // just as long to trickle out and the run would not actually feel faster.
    // Set by the mode; the classic maps leave it at 1.
    this.paceMul = 1;
    this.queues = [];
    this.pendingSpawns = 0;
    this.onWaveStart = null;
    this.onWaveClear = null;
    this.onPortalWake = null;
    this.onVictory = null;
    this.onCountdown = null;
    // Nests. Off unless the mode turns it on; the classic maps never see a
    // raid. nestClocks maps a breach node to the seconds until its next raid,
    // raidQueue holds the raiders of a pack still waiting on their beat, and
    // liveNestCount is what the HUD reads.
    this.nestMode = false;
    this.nestClocks = new Map();
    this.raidQueue = [];
    this.raidClock = 0;
    this.liveNestCount = 0;
    // Raiders by enemy id. A wave clears when every enemy the WAVE sent is
    // gone; raiders still walking are a running cost, not a gate, or a single
    // nest could hold wave 1 open forever. Ids rather than a flag on the
    // enemy, because enemies are pooled and this file does not own init().
    this.raiderIds = new Set();
    this.canRaid = null;      // () => bool, set by the mode; null means always
    this.onNestWake = null;   // (liveCount) => void
    this.onRaid = null;       // (node, wave) => void
    this.timedNests = false;
    this.clock = 0;
    this.clearedWaves = 0;
    this.assaultIds = new Map();
    this.siteBlocked = false;
    this.endless = false;
  }

  get limit() { return this.endless ? Infinity : CONFIG.waves.count; }

  begin() {
    this.wave = 0;
    this.clearedWaves = 0;
    this.clock = 0;
    this.assaultIds.clear();
    this.siteBlocked = false;
    this.queues = []; this.pendingSpawns = 0; this.victoryFired = false;
    this.state = 'countdown';
    this.countdown = CONFIG.waves.firstPrep * this.paceMul;
  }

  callEarly() {
    if (this.siteBlocked) return 0;
    if (this.state !== 'countdown' && !(this.timedNests && this.state !== 'idle' && this.wave < this.limit)) return 0;
    const bonus = Math.floor(this.countdown) * CONFIG.waves.earlyBonusPerSec;
    this.game.gold += bonus;
    this.countdown = 0;
    return bonus;
  }

  activePortals() {
    if (this.nestOnly) return this.nestSources.filter(n => !this.destroyedNodes?.has(n));
    const woken = this.nav.portalNodes.slice(0, portalCount(Math.max(this.wave, 1)));
    // A breach that units have destroyed stops feeding the wave. Falling back
    // to the full woken list when every breach is down matters: an empty list
    // would divide by zero in the spawn loop and silently stall the run.
    if (!this.destroyedNodes || !this.destroyedNodes.size) return woken;
    const alive = woken.filter((n) => !this.destroyedNodes.has(n));
    return alive.length ? alive : woken;
  }

  _startWave() {
    if (this.timedNests && this.wave >= this.limit) return false;
    const survivors = this.nestOnly ? this.activePortals() : [];
    // Campaign sources are physical structures prepared before any unit is
    // queued. An empty list means the player prevented this assault.
    if (this.nestOnly) {
      const sources = this.prepareNests(this.wave + 1);
      if (sources === null) { this.siteBlocked = true; this.countdown = 5; return false; }
      this.siteBlocked = false;
      this.nestSources = sources;
    }
    this.wave++;
    const prevPortals = portalCount(Math.max(this.wave - 1, 1));
    const nowPortals = portalCount(this.wave);
    if (!this.nestOnly && nowPortals > prevPortals && this.wave > 1 && this.onPortalWake) {
      this.onPortalWake(nowPortals - 1);
    }
    const comp = planetGroups(waveComp(this.wave),CONFIG.campaign);
    const scale = hpScale(this.wave)*(CONFIG.campaign?.enemyHealth||1);
    // Enemy melee grows with the wave so a garrison does not stay free forever,
    // but on a much shallower slope than health does and with a ceiling, so a
    // late swarm is dangerous rather than a one-shot on every body.
    this.enemies.atkScale = Math.min(1 + (scale - 1) * ATK_SCALE_SLOPE, ATK_SCALE_CAP) * (CONFIG.map.mode === 'ninetynine' ? 2.8 : 1);
    const active = this.activePortals();
    if (!this.timedNests) { this.queues = []; this.clock = 0; }

    for (const g of comp) {
      if (!active.length) continue;
      let portals;
      if (g.portal === 'far') portals = [this.nestOnly && g.type === 'colossus' ? this.guardianNode : active[0]];
      else if (typeof g.portal === 'number') portals = [active[g.portal % active.length]];
      else portals = active;
      for (let i = 0; i < g.count; i++) {
        const portal = portals[i % portals.length];
        this.queues.push({
          t: this.clock + (1.2 + i * g.gap + SIM_RANDOM.next() * 0.3) * this.paceMul + (this.nestOnly ? 3 : 0),
          type: g.type, portal, scale, wave: this.wave,
        });
      }
    }
    // Keeping old nests alive adds enemies instead of merely dividing the
    // same authored total among more locations. Every survivor contributes.
    if (this.timedNests) for (const portal of survivors) {
      let i = 0;
      for (const g of raidComp(this.wave)) for (let k = 0; k < g.count; k++) {
        this.queues.push({ t: this.clock + 3 + i++ * RAID_GAP, type: g.type, portal, scale, wave: this.wave });
      }
    }
    this.pendingSpawns = this.queues.length;
    this.queues.sort((a, b) => a.t - b.t);
    if (this.timedNests) this.countdown = this.wave < this.limit ? nestWaveInterval(this.wave) : 0;
    this.state = 'spawning';
    this.refreshNests();
    if (this.onWaveStart) this.onWaveStart(this.wave, waveComp(this.wave));
    return true;
  }

  inheritAssault(child, parent) {
    const wave = this.assaultIds.get(parent.id);
    if (wave !== undefined) this.assaultIds.set(child.id, wave);
  }

  _clearTimedWave() {
    // Award in sequence even if a later wave dies first. Queue identity and
    // reinforcement ancestry keep a crowded pool or boss split from silently
    // paying a victory while the original assault is still on the board.
    const owed = new Set(this.queues.map(q => q.wave));
    const active = new Set();
    for (const e of this.enemies.active) {
      active.add(e.id);
      const wave = this.assaultIds.get(e.id);
      if (wave !== undefined) owed.add(wave);
    }
    for (const id of this.assaultIds.keys()) if (!active.has(id)) this.assaultIds.delete(id);
    const next = this.clearedWaves + 1;
    if (next > this.wave || owed.has(next)) return;
    this.clearedWaves = next;
    const reward = waveReward(next);
    this.game.gold += reward;
    this.onWaveClear?.(next, reward);
    if (next === this.limit && !this.victoryFired) {
      this.victoryFired = true;
      this.state = 'idle';
      this.onVictory?.();
    }
  }

  // ---- nests -------------------------------------------------------------

  // Is this woken breach still outside the circle? Its direction against the
  // frontier centre, by angle, which is the only measure a spherical cap has.
  _isNest(node) {
    const f = this.game.frontier;
    if (!f || node < 0) return false;
    if (this.destroyedNodes && this.destroyedNodes.has(node)) return false;
    this.nav.nodeDir(node, _nd);
    const ang = Math.acos(Math.max(-1, Math.min(1, _nd.dot(f.centre))));
    return ang > f.theta * NEST_MARGIN;
  }

  // The nests alive right now: woken, standing, and beyond the frontier. None
  // before the first wave has been called, so the opening breather is a
  // breather.
  liveNests() {
    if (!this.nestMode || this.wave < 1 || !this.game.frontier) return [];
    if (this.nestOnly) return this.activePortals();
    const woken = this.nav.portalNodes.slice(0, portalCount(this.wave));
    return woken.filter((n) => this._isNest(n));
  }

  // Reconcile the clocks with the live list. A nest that has just woken gets
  // a full interval before its first raid, so a new breach is a warning
  // before it is a fight; one the circle has swallowed or units have felled
  // is dropped on the spot, along with any raiders it had queued.
  refreshNests() {
    const nests = this.liveNests();
    let woke = false;
    for (const n of nests) {
      if (!this.nestClocks.has(n)) {
        this.nestClocks.set(n, raidInterval(this.wave, this.paceMul));
        woke = true;
      }
    }
    for (const n of [...this.nestClocks.keys()]) {
      if (!nests.includes(n)) {
        this.nestClocks.delete(n);
        this.raidQueue = this.raidQueue.filter((q) => q.node !== n);
      }
    }
    this.liveNestCount = nests.length;
    if (woke && this.onNestWake) this.onNestWake(nests.length);
    return nests;
  }

  // Queue one pack at a nest. The raiders go through enemies.spawn like any
  // other, but with spawnRaw raised so the mode's frontier remap leaves them
  // where the breach stands.
  _queueRaid(node) {
    const scale = hpScale(this.wave)*(CONFIG.campaign?.enemyHealth||1);
    let i = 0;
    for (const g of raidComp(this.wave)) {
      for (let k = 0; k < g.count; k++) {
        this.raidQueue.push({ t: this.raidClock + i * RAID_GAP, type: g.type, node, scale });
        i++;
      }
    }
    this.raidQueue.sort((a, b) => a.t - b.t);
    if (this.onRaid) this.onRaid(node, this.wave);
  }

  _spawnRaw(type, node, scale) {
    this.enemies.spawnRaw = true;
    try {
      const e = this.enemies.spawn(type, node, scale);
      if (e && this.nestOnly) e.sourceNest=node;
      if (e) this.raiderIds.add(e.id);
      return e;
    } finally {
      this.enemies.spawnRaw = false;
    }
  }

  // Enemies the wave itself still owes the player: everything active that
  // was not sent by a nest. The set of raider ids is pruned to the living as
  // a side effect so it cannot grow for the length of a run.
  _waveEnemiesLeft() {
    let n = 0;
    let liveRaiders = 0;
    for (const e of this.enemies.active) {
      if (this.raiderIds.has(e.id)) liveRaiders++;
      else n++;
    }
    if (liveRaiders === 0 && this.raiderIds.size) this.raiderIds.clear();
    return n;
  }

  // Runs in every director state but idle. Idle is the mode holding the
  // director while the core drafts or advances, and a raid landing under a
  // draft overlay would be a fight the player cannot see; canRaid lets the
  // mode say so explicitly as well, and freezes the clocks rather than
  // letting them all fire the instant the overlay closes.
  _updateNests(dt) {
    if (this.timedNests || !this.nestMode || this.state === 'idle' || this.wave < RAID_START_WAVE) return;
    this.refreshNests();
    if (this.canRaid && !this.canRaid()) return;
    for (const [n, t] of this.nestClocks) {
      const left = t - dt;
      if (left > 0) { this.nestClocks.set(n, left); continue; }
      this.nestClocks.set(n, raidInterval(this.wave, this.paceMul));
      this._queueRaid(n);
    }
    this.raidClock += dt;
    while (this.raidQueue.length && this.raidQueue[0].t <= this.raidClock) {
      const q = this.raidQueue[0];
      if(!this._spawnRaw(q.type,q.node,q.scale))break;
      this.raidQueue.shift();
      if (this.onSpawnPortal) this.onSpawnPortal(q.node);
    }
  }

  update(dt) {
    if (this.timedNests && (this.state === 'idle' || (this.canRaid && !this.canRaid()))) return;
    this._updateNests(dt);
    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.onCountdown) this.onCountdown(this.countdown);
      if (this.countdown <= 0) this._startWave();
      return;
    }
    if (this.state === 'spawning' || this.state === 'combat') {
      if (this.timedNests && this.wave < this.limit) {
        this.countdown -= dt;
        if (this.countdown <= 0) this._startWave();
      }
      if (this.nestOnly) {
        // Cancellation is earned by destroying the visible source. Existing
        // enemies remain owed; the protected guardian queue cannot vanish.
        this.queues = this.queues.filter(q => !this.destroyedNodes?.has(q.portal));
        this.pendingSpawns = this.queues.length;
      }
      this.clock += dt;
      while (this.queues.length && this.queues[0].t <= this.clock) {
        const q = this.queues[0];
        // Pool pressure delays a spawn; it must not erase an owed enemy and
        // make a crowded campaign wave pay out before it has been defended.
        const enemy = this.enemies.spawn(q.type,q.portal,q.scale);
        if(!enemy)break;
        if (this.nestOnly) { enemy.sourceNest = q.portal; this.onNestSpawn?.(q, enemy); }
        if (this.timedNests) this.assaultIds.set(enemy.id, q.wave);
        this.queues.shift();
        this.pendingSpawns--;
        if (this.onSpawnPortal) this.onSpawnPortal(q.portal);
      }
      if (!this.queues.length) this.state = 'combat';
      if (this.timedNests) { this._clearTimedWave(); return; }
      if (this.state === 'combat' && this._waveEnemiesLeft() === 0) {
        const reward = waveReward(this.wave);
        this.game.gold += reward;
        if (this.onWaveClear) this.onWaveClear(this.wave, reward);
        if (this.wave >= this.limit && !this.victoryFired) {
          this.victoryFired = true;
          if (this.onVictory) this.onVictory();
        }
        // A listener may PARK the director on 'idle' from inside onWaveClear:
        // the 99 Planets shell does, to hold the next wave until its draft
        // resolves. This line used to set 'countdown' unconditionally right
        // after, so the hold lasted exactly one statement and the breather
        // ran down underneath the draft overlay - measured as the director in
        // 'countdown' with the draft open, and the next wave arriving about a
        // second after the pick. Only an unparked director starts its own
        // countdown now; a parked one waits to be released.
        if (this.state === 'combat') {
          this.state = 'countdown';
          this.countdown = CONFIG.waves.prepTime * this.paceMul;
        }
      }
    }
  }
}
