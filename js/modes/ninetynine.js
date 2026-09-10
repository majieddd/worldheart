// The 99 Planets shell. The ONLY file that knows both the pure run core and
// Three.js. The core decides WHAT happened; this file decides what it looks
// like. Nothing here leaks back into js/run.

import { createRun } from '../run/run.js';
import { makeRng } from '../run/rng.js';
import { MAX_HEART_LEVEL, HEART_RINGS } from '../run/schedule.js';
import { MODS, TOWER_TYPES } from '../towers.js';
import { EVO } from '../enemies.js';
import { SIM_RANDOM } from '../noise.js';
import { CONFIG } from '../config.js';
import { newNestCount } from '../waves.js';
import * as THREE from 'three';
import { bankVictory, bankCoins, loadProfile } from './progress.js';
import { createRewardConsumer } from '../rewards.js';
import { createCrystalLedger, CRYSTAL_CAPACITY } from '../run/crystals.js';
import { createInventory, generateWeapon, weaponStats, weaponName, shouldDrop, compatible, validPart, PARTS, FAMILIES, COMPATIBILITY } from '../run/weapons.js';
import { LootField } from '../loot-field.js';
import { WeaponPanel } from '../ui-weapons.js';
import { UnitRoutes } from '../unit-routes.js';
import { nestSite } from '../nest-sites.js';
import { ThreatGuides } from '../threat-guides.js';
import { campaignStore } from './campaign-store.js';
import { beginAssault, awardWave, resolveAssault, updateSalvage, extractPlanet, startExpedition } from '../run/campaign.js';
import { CampaignPanel } from '../ui-campaign.js';
import { planetDefinition } from '../run/planets.js';

export function createNinetyNine({ game, waves, world, nav, rig, ui, enemies, allies, possession, caches }) {
  // What this player has permanently unlocked. Read here in the shell and
  // handed to the core as a plain object, because js/run may not know that
  // storage exists.
  const profile = loadProfile();
  const campaign=CONFIG.campaign ? campaignStore : null;
  const expedition=campaign?.snapshot().expedition;
  const restoredVictory=expedition && ['victory','complete'].includes(expedition.status);
  let assaultId=expedition?.assault?.id || null,campaignPanel=null;
  const run = createRun({
    seed: CONFIG.seed,
    playerIds: ['solo'],
    startGold: CONFIG.economy.startGold + (profile.bonuses.interest ? 150 : 0),
    profile,
    draftSeconds: null,
    restoredVictory:!!restoredVictory,
  });
  // A seeded stream for shell-side choices, kept separate from the core's so
  // that adding a roll here cannot shift the run's own sequence.
  const rng = makeRng((CONFIG.seed ^ 0x5bf03635) >>> 0);
  const crystalRng = makeRng((CONFIG.seed ^ 0x73d16e2b) >>> 0);
  const crystals = createCrystalLedger();
  if (caches) {
    caches.kind = 'crystal';
    caches.mesh.material.color.setHex(0x91b7ff);
    caches.mesh.material.emissive.setHex(0x718bff);
  }

  // One seeded stream for the whole simulation, so a seed replays identically.
  // Offset from the world seed so terrain and combat are not correlated.
  SIM_RANDOM.next = makeRng((CONFIG.seed ^ 0x9e3779b9) >>> 0);

  const centre = nav.fieldCenter ? nav.nodeDir(nav.heartNode, new THREE.Vector3()) : null;
  const rewards = createRewardConsumer({ game, profile, centre, world, enemies, allies,
    startGold: CONFIG.economy.startGold, startLives: CONFIG.economy.startLives });
  if (allies) allies.onDamage = (a, dealt, killed) => {
    const tower = game.towerMgr.towers.find((t) => t.id === a.homeTower);
    if (tower) { tower.damageDealt += dealt; if (killed) tower.kills++; }
  };
  const _sdir = new THREE.Vector3();
  const _axis = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _home = new THREE.Vector3();
  let frontierTheta = 0;

  function applyFrontier(theta) {
    const changed = theta !== frontierTheta;
    const overview = rig.frontierTheta != null && Math.abs(rig.targetDist - rig.distMax) < .01;
    frontierTheta = theta;
    game.frontier = centre ? { centre, theta } : null;
    world.setFieldWallTheta(theta);
    world.setFogTheta(theta);
    // The camera follows the PLAYABLE area, not the built area, so the player
    // is never panned out over ground they cannot use yet, and how far they may
    // pull back grows with the territory they hold.
    rig.frontierTheta = theta;
    if (rig.confine) rig.confine.maxAng = theta * 1.02;
    if (changed) {
      // Sample fixed graph heights only on expansion, never during a pan.
      const edge = Math.cos(theta * 1.02 + .005), dirs = nav.dirs;
      let peak = 0;
      for (let i = 0; i < nav.n; i++) {
        if (dirs[i * 3] * centre.x + dirs[i * 3 + 1] * centre.y + dirs[i * 3 + 2] * centre.z >= edge) peak = Math.max(peak, nav.height[i]);
      }
      rig.frontierRelief = peak + 2;
      if (overview) rig.targetDist = rig.distMax;
    }
    // Possession reads this to fog the view once a unit walks out past it.
    if (possession) possession.frontier = game.frontier;
    // Keep the walk in roughly constant as the circle grows. Halving the
    // between-wave breather only bought about a fifth off the run, because most
    // of a late wave is transit: at the final frontier the approach is 125
    // units and a husk covers under two a second. Referenced against the arc at
    // the first expansion and capped, so early waves are untouched and the late
    // ones stop dragging.
    const arc = CONFIG.planetRadius * theta;
    enemies.marchMul = Math.max(1, Math.min(2.2, arc / 28));
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
    // Commander presence is a shell-only bonus. Mutating the core's cached
    // object added another 15% every time a card or base panel refreshed.
    const mods = { ...run.getModifiers() };
    if (commanderAlive()) mods.dmgMul += COMMANDER_DMG_BONUS;
    MODS.current = mods;
    EVO.tier = run.getEvolutionTier();
    game.unlockedTowers = run.getUnlockedTowers();
    ui.unlockedTowers = game.unlockedTowers;
    game.hand = run.getHand();
    ui.renderHand(game.hand);
    // The tier cap is the heart's, read here so the two cannot disagree. The
    // HUD's upgrade button reads game.tierCap on refresh, which is why the
    // refresh below is unconditional: a raised cap has to reach a tower panel
    // that is already open.
    rewards.sync(MODS.current);
    game.tierCap = run.getTierCap();
    const level = run.getHeartLevel();
    const cost = run.getHeartCost();
    const price = crystals.quote(cost, game.gold);
    ui.renderHeart({
      level,
      max: MAX_HEART_LEVEL,
      cost,
      tierCap: run.getTierCap(),
      nextTierCap: run.getTierCap() + 1,
      ringsGain: cost === null ? 0 : HEART_RINGS[level + 1] - run.getFrontierSteps(),
      held: 0,
      radius: Math.round(CONFIG.planetRadius * run.getFrontierTheta()),
      credit: price?.credit || 0,
      goldCost: price?.gold ?? cost,
      afford: !!price?.afford,
    });
    ui.refresh();
    applyFrontier(run.getFrontierTheta());
  }

  // The shell owns the gold, the core owns the level: check and deduct here,
  // then let the core say what the level bought. A maxed or ended run returns
  // no events, and the gold goes back, so a stray B can never charge for
  // nothing.
  function tryUpgradeHeart() {
    if (game.state !== 'playing' || run.getPhase() !== 'building') return false;
    if (possession?.active && !possession.linked) {
      ui.toast('Return inside the frontier to control the base', 'warn');
      return false;
    }
    const cost = run.getHeartCost();
    if (cost === null) {
      ui.toast('The Worldheart is at full strength', 'info');
      return false;
    }
    const price = crystals.quote(cost, game.gold);
    if (!price?.afford) {
      ui.toast(`The Worldheart needs ${price?.shortfall ?? cost} more gold after crystal credit`, 'warn');
      ui.audio?.play('deny');
      return false;
    }
    const events = run.upgradeHeart();
    if (!events.length) return false;
    crystals.spend(cost, game.gold);
    game.gold -= price.gold;
    handle(events);
    updateCrystals();
    return true;
  }
  ui.onHeartUpgrade = tryUpgradeHeart;

  function handle(events) {
    // Several rings can arrive in one batch when an upgrade pays out what the
    // waves had banked. One toast for the lot: three "the frontier widens" in
    // a row is a stutter, and the anchor only holds three anyway.
    let grew = 0;
    for (const e of events) {
      if (e.type === 'towerUnlocked') {
        ui.toast(`${TOWER_TYPES[e.tower]?.name || e.tower} unlocked`, 'info');
      } else if (e.type === 'handDrawn') {
        // The odd wave's ONLY reward. It was emitted and handled by nothing, so
        // half the waves paid out in silence while every even wave announced
        // its power - and when the hand was already full the card was dropped
        // with no message at all, which is a wave that paid literally nothing.
        if (e.drew) ui.toast(`${TOWER_TYPES[e.drew]?.name || e.drew} card drawn`, 'info');
        else ui.toast('Hand full - the card was lost. Spend one before the next wave.', 'warn');
      } else if (e.type === 'enemiesEvolved') {
        ui.toast('The swarm evolves', 'danger');
      } else if (e.type === 'frontierGrew') {
        grew++;
        // Each purchased geometric step seeds its own reachable band.
        seedCaches(e.theta);
      } else if (e.type === 'heartUpgraded') {
        ui.toast(`Worldheart raised to level ${e.level}: towers may reach mark ${run.getTierCap()}`, 'info');
        ui.audio?.play('upgrade');
      } else if (e.type === 'draftOpened') {
        ui.showDraft(e.offers, (i) => {
          if (run.vote('solo', i)) handle(run.tick(0));
        });
      } else if (e.type === 'powerTaken') {
        ui.hideDraft();
        ui.toast(`${e.power.name} taken`, 'info');
      } else if (e.type === 'waveCleared') {
        if (e.coins) {
          if(campaign)campaign.commit(s=>awardWave(s,assaultId,e.wave,e.coins));else bankCoins(e.coins);
          ui.toast(`+${e.coins} coins`, 'info');
          ui.audio?.play('coin');
        }
        // Compound Interest wrote interestPct and nothing ever read it, so the
        // power was a dead draft pick. Paid on the gold held at the moment the
        // wave clears, which is what the card promises.
        const paid = rewards.waveCleared();
        if (paid.interest > 0) ui.toast(`Interest +${paid.interest}`, 'info');
        if (paid.healed > 0) ui.toast(`Worldheart recovered ${paid.healed} life`, 'info');
      } else if (e.type === 'runWon') {
        if(campaign){
          commander.swingT=0;commander.strikePending=false;inventory.settle(false);syncWeapon();
          campaign.commit(s=>resolveAssault(s,assaultId,'victory',salvageSnapshot()));
          // Surviving raiders disperse when the planet falls silent. Salvage
          // cannot race a late leak or an enemy still swinging at the player.
          for(const enemy of [...enemies.active])enemies._release(enemy);
          waves.raidQueue=[];waves.queues=[];showCampaignReceipt();
        }else{
          const progress = bankVictory();
          ui.showEnd(true, `the planet is yours - ${progress.planetsBeaten} held`);
        }
      }
    }
    if (grew === 1) ui.toast('The frontier widens', 'info');
    else if (grew > 1) ui.toast(`The frontier widens: ${grew} rings held`, 'info');
    syncFromRun();
    campaignPanel?.update();
    if (grew) {
      // A ring the circle has just swallowed stops being a nest. Told to the
      // director straight away rather than on its next tick so the HUD count
      // and the raid clocks agree with the wall the player is looking at.
      waves.refreshNests?.();
    }
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

  enemies.spawnNodeOverride = node => node;

  // A campaign wave comes from the nest the player can actually see. New
  // nests are established once on solved routes near the current frontier;
  // expanding later never teleports that structure or its spawn point.
  waves.nestOnly = true;
  waves.timedNests = true;
  waves.nestSources = [];
  const sourcePortals = nav.portalNodes.slice();
  for (const p of world.portals) { p.active = false; p.group.visible = false; }
  const establishNest = (index, wave, guardian = false) => {
    const original = sourcePortals[index % sourcePortals.length];
    let node;
    // Two structures cannot share the destruction identity or crowd each
    // other's clearing, even after an earlier nest has been destroyed.
    const used = new Set(world.portals.filter(p => p.established).map(p => p.node));
    node=nestSite(nav,original,centre,frontierTheta,used,_sdir);
    for(const alternative of sourcePortals)if(node<0)node=nestSite(nav,alternative,centre,frontierTheta,used,_sdir);
    if(node<0)return null;
    const pos = nav.nodePos(node, new THREE.Vector3());
    const p = world.portals.find(p => !p.established) || world.addPortal(pos);
    p.group.position.copy(pos); p.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), pos.clone().normalize());
    p.node=node; p.established=true; p.sourceWave=wave; p.active=true; p.group.visible=true;
    p.guardianPending=guardian; p.flash=1;
    world.crushDecorNear(pos,3.2);
    ui.banner(guardian ? 'GUARDIAN NEST' : 'NEST EMERGING', guardian ? 'Protected until its guardian emerges. Defeat the guardian to win.' : 'Enemies emerge here in 3 seconds. Destroy the nest to stop its buildup.', false);
    ui.audio?.play('portal');
    return p;
  };
  waves.prepareNests = wave => {
    const count = newNestCount(wave);
    const fresh = world.portals.filter(p => p.established && p.sourceWave === wave);
    for (let i=fresh.length; i<count; i++) {
      const guardian = wave === CONFIG.waves.count;
      const p = establishNest(world.portals.filter(p => p.established).length, wave, guardian);
      if (!p) {
        // One healthy nest still starts a milestone wave. If none can fit,
        // retry after a visible breather instead of creating a mountain source
        // or granting a free wave clear from an empty spawn list.
        if (fresh.length) break;
        ui.toast('Nest wave delayed: no clear ground route. Sell a blocking tower to reopen ground.', 'warn');
        return null;
      }
      fresh.push(p);
      if (guardian) waves.guardianNode=p.node;
    }
    // New sources lead the authored distribution so even a small wave sends
    // enemies from the nest that just appeared. Survivors add their own packs.
    const previous = world.portals.filter(p => p.established && !p.destroyed && p.sourceWave !== wave);
    return [...fresh.filter(p=>!p.destroyed), ...previous].map(p=>p.node);
  };
  waves.onNestSpawn = (q, enemy) => {
    if (q.type !== 'colossus') return;
    for (const p of world.portals) p.guardianPending=false;
    enemy.guardianNest=q.portal;
  };
  enemies.reinforcementSource = parent => {
    const sources=waves.activePortals();
    return sources.includes(parent.sourceNest)?parent.sourceNest:(sources[0]??-1);
  };
  enemies.onReinforcement = (child,parent,node) => {
    if(waves.raiderIds.has(parent.id))waves.raiderIds.add(child.id);
    waves.inheritAssault(child,parent);
    waves.onSpawnPortal?.(node);
  };

  // Surviving physical nests supply an extra pack with each timed wave. Growing
  // the frontier no longer silently removes a source; destroying it does.
  // The core still owns whether a raid may run while a draft is open.
  waves.nestMode = true;
  waves.canRaid = () => run.getPhase() === 'building';
  waves.onNestWake = (count) => {
    ui.toast(count === 1 ? 'A nest stirs' : `Active nests: ${count}. Survivors reinforce the next wave.`, 'danger');
    ui.audio?.play('portal');
  };

  // 99 Planets runs at double speed. Fifteen waves at the classic cadence is a
  // long sit for a mode whose whole shape is a short, escalating run, and the
  // breather between waves was longer than most of the fights in it.
  waves.paceMul = 0.5;
  // Towers never stop upgrading in this mode; price is the only ceiling.
  game.uncappedTiers = true;

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
    if(expedition?.commander)return expedition.commander;
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
      if(!run.loseRun())return;
      crystals.loseCarried();
      if(campaign)campaign.commit(s=>resolveAssault(s,assaultId,'defeat'));
      game.state = 'defeat';
      ui.showEnd(false, 'the commander fell');
      campaignPanel?.update();
    };
    // A commander buff appearing or vanishing has to reach the towers, and it
    // only changes on death, so re-syncing here is enough.
    allies.onDeath = (a) => { if (a.type.commander) syncFromRun(); };
  }

  // ---- weapons ----------------------------------------------------------
  const initialInventory=expedition?.assault?.victory?.inventory || expedition?.assault?.start || expedition?.banked;
  const inventory = createInventory(commander.typeKey,initialInventory);
  const lootRng = makeRng((CONFIG.seed ^ 0x19427cb5) >>> 0);
  const previewModel = item => allies.weaponPreview(FAMILIES[item.family].visual,{era:item.era,core:item.parts.core},item.parts.head==='long'?1.2:1);
  const loot = new LootField(game.scene, allies, previewModel);
  const unitRoutes = new UnitRoutes(game.scene,allies,nav);
  const threats = new ThreatGuides(game.scene,enemies);
  let lootSequence = 0, weaponSignature = '';
  const starterFamily = { commander:'sword', duelist:'sword', marksman:'carbine', bombardier:'lobber', oracle:'spear' }[commander.typeKey];
  const starter = generateWeapon({id:`starter-${CONFIG.seed}`,seed:CONFIG.seed,family:starterFamily,rng:makeRng(CONFIG.seed ^ 0xa42)});
  starter.rarity = 'common'; starter.affixes = []; starter.parts = {head:'balanced',grip:'balanced',core:'tempered'};
  if(!initialInventory){inventory.register(starter); inventory.pickup(starter.id); inventory.request({kind:'equip',id:starter.id,slot:0}); inventory.request({kind:'select',slot:'native'});}
  for(const drop of expedition?.assault?.victory?.drops || [])if(inventory.register(drop.item))loot.add(drop.item,new THREE.Vector3(...drop.dir));
  const basic = { ...starter, id:`basic-${CONFIG.seed}`, family:'sword', rarity:'common', tier:1, affixes:[], parts:{head:'balanced',grip:'balanced',core:'tempered'} };
  const busyWeapon = () => commander.swingT > 0 || commander.strikePending;
  const nearbyLoot = () => commander.active && !commander.dead ? loot.nearby(allies.worldPos(commander, _up)) : [];
  function syncWeapon() {
    const item = inventory.active === 'basic' ? basic : inventory.current;
    const signature = JSON.stringify([inventory.active,item]);
    if (signature === weaponSignature || busyWeapon()) return;
    const spec = item ? weaponStats(item,commander.typeKey) : null;
    const family = item && FAMILIES[item.family];
    const appearance=item?{era:item.era,core:item.parts.core}:null;
    if (allies.setWeapon(commander,spec,family?.visual,family?.view,0xffffff,item?.parts.head==='long'?1.2:1,appearance)) {
      weaponSignature = signature;
      if (possession.unit === commander) { possession.baseFov = commander.type.strike.fov || 80; ui.showPossession(commander); }
    }
  }
  const weaponApi = {
    inventory,
    previewModel,
    inspect:id=>loot.entries.get(id),
    canInteract: () => game.state === 'playing' && ['building','victory'].includes(run.getPhase()) && (!campaign||['assault','victory'].includes(campaign.expeditionStatus())) && commander.active && !commander.dead,
    nearby: nearbyLoot,
    request(op) {
      if (!this.canInteract()) return false;
      const ok = inventory.request(op,busyWeapon());
      if (ok) { if (possession.unit===commander) possession.firing=false; syncWeapon(); persistSalvage(); }
      return ok;
    },
    pickup(id,replace=null) {
      if (!this.canInteract() || !nearbyLoot().some(x=>x.id===id) || !inventory.pickup(id,replace)) return false;
      loot.remove(id); persistSalvage(); ui.audio?.play('coin'); ui.toast('Weapon recovered. I to compare and equip.','info'); return true;
    },
    salvage(id) {
      if (!this.canInteract() || (inventory.drops.some(x=>x.id===id) && !nearbyLoot().some(x=>x.id===id))) return false;
      if (!inventory.salvage(id)) return false;
      loot.remove(id); persistSalvage(); ui.audio?.play('coin'); return true;
    },
    bankedIds:()=>campaign?.snapshot().expedition.banked?.items.map(x=>x.id)||[],
    infuse(id){if(!this.canInteract()||busyWeapon()||!inventory.infuse(id,CONFIG.planetIndex))return false;syncWeapon();persistSalvage();return true;},
    planet:CONFIG.planetIndex,
    campaign:!!campaign,
  };
  function collectNearbyWeapons() {
    if (game.paused || !weaponApi.canInteract()) return;
    let count = 0;
    for (const item of nearbyLoot()) {
      // A full bag leaves the model and identity intact for later salvage.
      // Automatic collection never chooses equipment or replaces an item.
      if (!inventory.pickup(item.id)) break;
      loot.remove(item.id); count++;
    }
    if (!count) return;
    persistSalvage(); ui.audio?.play('coin');
    ui.toast(`${count === 1 ? 'Weapon' : `${count} weapons`} collected. I to compare and equip.`, 'info');
  }
  const weaponPanel = new WeaponPanel({game,possession,ui,api:weaponApi,rules:{
    name:weaponName,stats:item=>weaponStats(item,commander.typeKey),inspectStats:item=>weaponStats(item,commander.typeKey,true),parts:PARTS,
    compatible:family=>compatible(commander.typeKey,family),validPart,trait:COMPATIBILITY[commander.typeKey].label,
  }});
  const previousKill = enemies.onKill;
  enemies.onKill = e => {
    previousKill?.(e);
    if (!shouldDrop({boss:!!e.type.boss,elite:e.typeKey === 'aegis'},lootRng)) return;
    const item = generateWeapon({id:`weapon-${assaultId || CONFIG.seed}-${++lootSequence}`,seed:(lootRng()*0x100000000)>>>0,tier:CONFIG.planetIndex || 1,rng:lootRng});
    if (inventory.register(item)) {
      let node = nav.nearestWalkableNode(e.dir,true);
      if (node < 0 || !Number.isFinite(nav.dist[node])) node = nav.heartNode;
      if (node >= 0) nav.nodeDir(node,_up); else _up.copy(e.dir);
      loot.add(item,_up);
      if (item.rarity !== 'common' || e.type.boss) ui.toast(`${weaponName(item)} dropped (${item.rarity}).`,'info');
    }
  };
  const previousProjectile = allies.onProjectileFired;
  allies.onProjectileFired = (a,bolt) => { previousProjectile?.(a,bolt); ui.audio?.play('rifle'); if (possession.unit===a) possession.kick = Math.min(.5,possession.kick+bolt.spec.kick); };
  const previousReady = allies.onAttackReady;
  allies.onAttackReady = a => { previousReady?.(a); if (a===commander && inventory.settle(false)){syncWeapon();persistSalvage();} };

  function salvageSnapshot() {
    return {inventory:inventory.snapshot(),drops:[...loot.entries.values()].map(x=>({item:x.item,dir:x.position.clone().normalize().toArray()})),kills:game.kills,score:game.score,lives:Math.max(1,game.lives)};
  }
  function persistSalvage() {
    if(campaign?.snapshot().expedition.status==='victory')campaign.commit(s=>updateSalvage(s,assaultId,salvageSnapshot()));
    campaignPanel?.update();
  }
  function showCampaignReceipt() {
    if(!campaign)return;
    const e=campaign.snapshot().expedition;if(!['victory','complete'].includes(e.status))return;
    ui._ended=false;ui.showEnd(true,`${CONFIG.campaign.name} defended`);campaignPanel?.update();
  }
  const campaignApi=campaign ? {
    state:()=>campaign.snapshot().expedition,name:CONFIG.campaign.name,brief:CONFIG.campaign.brief,
    destination:index=>planetDefinition(index,expedition.seed),
    arsenal:()=>campaign.snapshot().expedition.banked?.items.map(item=>({name:weaponName(item),tier:item.tier,rarity:item.rarity,core:item.parts.core})) || [],
    showReceipt:showCampaignReceipt,
    reload(){const url=new URL(location.href);url.searchParams.set('map','ninetynine');url.searchParams.set('campaign','1');url.searchParams.delete('seed');url.searchParams.delete('terrain');location.href=url.href;},
    restart(){
      if(campaign.expeditionStatus()!=='complete'||!campaign.status().saved)return false;
      const seed=crypto.getRandomValues(new Uint32Array(1))[0]||12345;
      const result=campaign.commit(s=>startExpedition(s,{seed,limit:CONFIG.campaign.limit}));
      if(result.ok&&result.saved)this.reload();return result.ok;
    },
    extract(){
      if(busyWeapon()||inventory.pending){ui.toast('Finish the current attack before extracting.','info');return false;}
      persistSalvage();if(!campaign.status().saved)return false;
      const e=campaign.snapshot().expedition;
      if(e.status==='ready'){this.reload();return true;}
      const result=campaign.commit(s=>extractPlanet(s,assaultId,inventory.snapshot()));
      if(!result.ok||!result.saved)return false;
      if(campaign.snapshot().expedition.status==='complete')showCampaignReceipt();else this.reload();return true;
    },
  } : null;
  if(campaign){
    campaignPanel=new CampaignPanel({store:campaign,api:campaignApi,ui,game});
    ui.onCampaignRetry=()=>campaignApi.reload();
    ui.onBegin=()=>{
      if(restoredVictory){
        ui.el['title-overlay'].classList.remove('show');game.state='playing';waves.state='idle';waves.wave=15;
        const v=expedition.assault?.victory;if(v){game.kills=v.kills;game.score=v.score;game.lives=v.lives;}
        showCampaignReceipt();return false;
      }
      const result=campaign.commit(s=>beginAssault(s,{commander:commander.typeKey,inventory:inventory.snapshot(),effectiveSeed:CONFIG.seed}));
      if(!result.ok)return false;assaultId=result.value;campaignPanel.update();return true;
    };
    game.onGameEnd=won=>{
      if(won||!run.loseRun())return;
      crystals.loseCarried();campaign.commit(s=>resolveAssault(s,assaultId,'defeat'));ui.showEnd(false);campaignPanel.update();
    };
    ui.onContinue=()=>{campaignPanel.update();};
  }

  // ---- click to possess, and posting a patrol ---------------------------
  const _pd = new THREE.Vector3();
  const _od = new THREE.Vector3();

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

  // ---- selecting and commanding from the board --------------------------
  // A drag over the globe boxes friendly units; a right click sends them. The
  // rig pans on EVERY button, so left-drag is claimed here and panning stays on
  // the right and middle buttons, which already worked.
  const selection = [];
  let marquee = null;
  const _sp = new THREE.Vector3();

  const box = document.createElement('div');
  box.id = 'sel-box';
  document.body.appendChild(box);
  const canvasEl = document.querySelector('canvas');

  function projectToScreen(v, out) {
    _sp.copy(v).project(rig.camera);
    out.x = (_sp.x * 0.5 + 0.5) * canvasEl.clientWidth;
    out.y = (-_sp.y * 0.5 + 0.5) * canvasEl.clientHeight;
    // Behind the camera projects to a mirrored point in front of it.
    out.ok = _sp.z < 1;
    return out;
  }

  const _scr = { x: 0, y: 0, ok: false };
  const _wp = new THREE.Vector3();

  function selectIn(x0, y0, x1, y1) {
    const lo = { x: Math.min(x0, x1), y: Math.min(y0, y1) };
    const hi = { x: Math.max(x0, x1), y: Math.max(y0, y1) };
    selection.length = 0;
    if (!allies) return;
    // A unit on the far side of the planet projects into the box too, so the
    // horizon has to be tested rather than the screen alone.
    for (const a of allies.active) {
      if (!a.active || a.dead || a.possessed) continue;
      allies.worldPos(a, _wp);
      if (_wp.dot(rig.camera.position) < CONFIG.planetRadius * CONFIG.planetRadius * 0.999) continue;
      projectToScreen(_wp, _scr);
      if (!_scr.ok) continue;
      if (_scr.x >= lo.x && _scr.x <= hi.x && _scr.y >= lo.y && _scr.y <= hi.y) selection.push(a);
    }
    for (const a of allies.active) a.selected = selection.includes(a);
    ui.showSelection(selection.length, selection[0] ? selection[0].type.name : '');
  }

  function clearSelection() {
    selection.length = 0;
    if (allies) for (const a of allies.active) a.selected = false;
    ui.showSelection(0, '');
  }

  rig.dragClaim = (e) => {
    if (e.button !== 0 || e.pointerType !== 'mouse') return false;
    if (game.buildType || (possession && possession.active)) return false;
    marquee = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, moved: 0 };
    return true;
  };

  addEventListener('pointermove', (e) => {
    if (!marquee) return;
    marquee.moved += Math.abs(e.clientX - marquee.x1) + Math.abs(e.clientY - marquee.y1);
    marquee.x1 = e.clientX; marquee.y1 = e.clientY;
    if (marquee.moved > 4) {
      box.style.display = 'block';
      box.style.left = `${Math.min(marquee.x0, marquee.x1)}px`;
      box.style.top = `${Math.min(marquee.y0, marquee.y1)}px`;
      box.style.width = `${Math.abs(marquee.x1 - marquee.x0)}px`;
      box.style.height = `${Math.abs(marquee.y1 - marquee.y0)}px`;
    }
  });

  addEventListener('pointerup', (e) => {
    if (!marquee) return;
    const m = marquee;
    marquee = null;
    box.style.display = 'none';
    if (m.moved > 4) {
      selectIn(m.x0, m.y0, m.x1, m.y1);
      return;
    }
    // A CLICK, not a drag. Claiming the gesture took it away from the rig, so
    // the rig never fired onTap and everything a click used to do stopped
    // working - taking a body, selecting a tower, placing one. The claim only
    // exists to reserve the DRAG, so a click has to be handed straight back.
    clearSelection();
    rig.onTap?.(e.clientX, e.clientY, 0);
  });

  const prevTap = rig.onTap;
  rig.onTap = (x, y, button) => {
    // A possessed unit owns the mouse: left click swings and right drag looks,
    // both handled in js/possess.js. Letting the tap fall through from here
    // meant every swing also selected whatever tower happened to be under the
    // crosshair, and a right click posted a patrol mid-fight.
    if (possession && possession.active) return;
    // Right-click with units selected sends them. Checked before the barracks
    // patrol so an explicit selection always wins the gesture.
    if (button === 2 && selection.length && game.cursorValid && !game.buildType) {
      // Snap to ground a unit can actually stand on: an unwalkable destination
      // becomes the unit's post on arrival and would strand it there for good.
      const node = nav.nearestWalkableNode(game.cursorDir);
      if (node >= 0) {
        nav.nodeDir(node, _od);
        let n = 0;
        for (const a of selection) if (allies.orderMove(a, _od)) n++;
        if (n) {
          ui.toast(n === 1 ? 'Moving out' : `${n} moving out`, 'info');
          ui.audio?.play('order');
        } else ui.toast('No ground route to that destination.', 'warn');
        return;
      }
      ui.toast('They cannot stand there', 'warn');
      return;
    }
    // Right-click with a barracks selected posts its patrol.
    if (button === 2 && game.selectedTower && game.selectedTower.typeKey === 'warden' && game.cursorValid) {
      if (setPatrolFrom(game.selectedTower, game.cursorDir)) return;
    }
    // Only an idle left click takes a body; building and the tower panel keep
    // their own use of the tap.
    if (button === 0 && !game.buildType && possession && !possession.active && game.cursorValid) {
      // A visible tower hit takes priority over a nearby garrison body. The
      // old proximity-first order possessed a soldier when aiming at its door.
      if (game._trySelect(x, y)) return;
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
      // The board's hands come off too. The card bar kept its pointer events,
      // so clicking a card while possessed mounted a ghost tower through the
      // player's own legs that could not be placed OR cancelled - the tap chain
      // returns early during possession, the canvas context menu is suppressed,
      // and Escape belongs to possession.
      game.cancelBuild();
      ui.setBoardEnabled(false);
      ui.showPossession(u);
    };
    // Leaving the circle severs base control: the orbit view is the BASE's
    // view, and out here there is nobody at the heart to hand it to you. That
    // is the whole cost of a trip into the fog - you cannot pull back to the
    // board to check on your towers halfway through one.
    possession.onLinkChange = (linked) => {
      ui.setBaseLink(linked);
      ui.audio?.play(linked ? 'reconnect' : 'disconnect');
      if (!linked) ui.toast('Base control lost - you are outside the frontier', 'danger');
      else ui.toast('Base control restored', 'info');
    };
    possession.onExit = () => {
      ui.setBoardEnabled(true);
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
    if (!caches || !centre || caches.caches.length >= 60) return;
    const inner = theta * 1.12, outer = Math.min(theta * 1.8, CONFIG.map.fieldTheta * .97);
    if (inner >= outer) return;
    let added = 0;
    for (let tries = 0; tries < 180 && added < 6 && caches.caches.length < 60; tries++) {
      _up.set(crystalRng() - .5, crystalRng() - .5, crystalRng() - .5);
      _axis.crossVectors(centre, _up);
      if (_axis.lengthSq() < 1e-9) continue;
      _axis.normalize();
      _sdir.copy(centre).applyAxisAngle(_axis, inner + (outer - inner) * crystalRng()).normalize();
      const node = nav.nearestWalkableNode(_sdir);
      if (node < 0 || !Number.isFinite(nav.dist[node])) continue;
      nav.nodeDir(node, _sdir);
      const angle = Math.acos(Math.max(-1, Math.min(1, _sdir.dot(centre))));
      if (angle < inner || angle > outer) continue;
      if (caches.caches.some(c => Math.acos(Math.min(1, c.dir.dot(_sdir))) * CONFIG.planetRadius < 3)) continue;
      const id = `crystal-${CONFIG.seed}-${caches.caches.length}`;
      crystals.register(id);
      caches.caches.push({ id, node, dir: _sdir.clone(), taken: false, gold: 0 });
      added++;
    }
    caches._render();
  }

  function homeDistance() {
    return commander?.active && !commander.dead
      ? Math.acos(Math.max(-1, Math.min(1, commander.dir.dot(centre)))) * CONFIG.planetRadius : Infinity;
  }

  function depositCrystals() {
    if (game.state !== 'playing' || game.paused || run.getPhase() !== 'building') return false;
    const receipt = crystals.deposit({ alive: !!commander?.active && !commander.dead, nearHeart: homeDistance() <= 4.5 });
    if (!receipt.count) { ui.toast('Carry crystals within 4.5 units of the heart to deposit', 'info'); return false; }
    ui.toast(`${receipt.count} crystals delivered: +${receipt.credit} base upgrade credit`, 'info');
    ui.audio?.play('upgrade');
    syncFromRun(); updateCrystals();
    return true;
  }
  ui.onCrystalDeposit = depositCrystals;
  addEventListener('keydown', e => {
    if (e.code !== 'KeyC' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
    e.preventDefault(); depositCrystals();
  });

  function updateCrystals() {
    if (!commander?.active || commander.dead) return;
    if (game.state === 'playing' && !game.paused && run.getPhase() === 'building'
      && crystals.carried.length < CRYSTAL_CAPACITY && caches) {
      const found = caches.peekCrystal(allies.worldPos(commander, _up));
      if (found && crystals.pickup(found.id)) {
        found.taken = true;
        ui.toast(`Crystal carried (${crystals.carried.length}/${CRYSTAL_CAPACITY}). Return to the heart and press C.`, 'info');
        ui.audio?.play('coin');
      }
    }
    commander.carryMul = 1 - .1 * crystals.carried.length / CRYSTAL_CAPACITY;
    if (caches) { caches.carrier = commander; caches.carriedCount = crystals.carried.length; }
    const distance = homeDistance();
    const home = _home.copy(centre).addScaledVector(commander.dir, -centre.dot(commander.dir)).normalize();
    _axis.crossVectors(commander.fwd, commander.dir).normalize();
    const angle = Math.atan2(home.dot(_axis), home.dot(commander.fwd));
    const directions = ['Ahead', 'Ahead-right', 'Right', 'Behind-right', 'Behind', 'Behind-left', 'Left', 'Ahead-left'];
    const direction = directions[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
    ui.renderCrystals({ carried: crystals.carried.length, capacity: CRYSTAL_CAPACITY, credit: crystals.credit,
      distance, direction, swimming: commander.swimming, canDeposit: distance <= 4.5 && !game.paused && crystals.carried.length > 0 });
  }

  seedCaches(run.getFrontierTheta());
  syncFromRun();
  updateCrystals();

  return {
    run,
    crystals,
    depositCrystals,
    inventory,
    loot,
    unitRoutes,
    threats,
    weapons: weaponApi,
    weaponPanel,
    campaign:campaignApi,
    renderEffects(dt) { loot.update(dt); unitRoutes.update(); threats.update(); weaponPanel.update(); if(campaignPanel){campaignPanel.badge.hidden=game.state==='title';} },
    // The same path the panel and the B key use, exposed so a scripted run
    // can buy a level without synthesising a click.
    upgradeHeart: tryUpgradeHeart,
    // Driven from stepFrame. dt is injected; the core never reads a clock.
    update(dt) {
      if(inventory.settle(busyWeapon()))persistSalvage(); syncWeapon();
      collectNearbyWeapons();
      updateCrystals();
      const draft = run.getDraft();
      if (draft) {
        ui.setDraftTimer(draft.remaining === null ? null : draft.remaining / 10);
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
      // Scaled by paceMul like the director's own breather: this path was
      // dead until the director stopped unparking itself (see waves.js), so
      // the unscaled value here had never actually been played.
      if (waves.state === 'idle') {
        if (waves.timedNests) waves.state = waves.wave ? (waves.queues.length ? 'spawning' : 'combat') : 'countdown';
        else { waves.state = 'countdown'; waves.countdown = CONFIG.waves.prepTime * waves.paceMul; }
      }
    },
  };
}
