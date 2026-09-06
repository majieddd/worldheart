import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
globalThis.location = { search: '?map=ninetynine' };
globalThis.matchMedia = () => ({ matches: false });
registerHooks({ resolve(spec, context, next) {
  if (spec === 'three') return { url: new URL('../../lib/three.module.min.js', import.meta.url).href, shortCircuit: true };
  return next(spec, context);
} });
const THREE = await import('../../lib/three.module.min.js');
const { Tower, TowerManager, TOWER_TYPES, MODS, tierCost } = await import('../../js/towers.js');
const { AllyManager } = await import('../../js/allies.js');
const { EnemyManager } = await import('../../js/enemies.js');
const { Game } = await import('../../js/game.js');
const { initTerrainField } = await import('../../js/world.js');
initTerrainField(12345);
const { createRewardConsumer } = await import('../../js/rewards.js');
const { foldModifiers } = await import('../../js/run/modifiers.js');
const { POWER_BY_ID } = await import('../../js/run/powers.js');
const { createRun } = await import('../../js/run/run.js');
const mods = (...ids) => foldModifiers(ids.map(id => POWER_BY_ID[id]));
const tower = (type) => Object.assign(Object.create(Tower.prototype), {typeKey:type,tier:0,shotCount:0});
afterEach(() => { MODS.current = null; });

for (const type of Object.keys(TOWER_TYPES)) test(`${type}: actual stats never manufacture NaN fields`, () => {
  MODS.current = mods('keen-rails','overclock','sharp-edge','long-lens','chain-coil');
  for (const [key,value] of Object.entries(tower(type).stats)) if(typeof value==='number') assert.ok(Number.isFinite(value),key);
});
for (const [type,field,power,factor] of [
  ['bolt','dmg','keen-rails',1.12],['mortar','dmg','twin-rails',1.2],['tesla','dmg','keen-rails',1.12],['helios','dps','keen-rails',1.12],
  ['bolt','rate','overclock',1.1],['mortar','rate','flywheel',1.18],['tesla','charge','overclock',1/1.1],['helios','ramp','flywheel',1/1.18],['warden','summonTime','overclock',1/1.1],
  ...Object.keys(TOWER_TYPES).map(type=>[type,'range','long-lens',1.08]),
]) test(`${power} reaches ${type}.${field}`, () => {
  const t=tower(type),before=t.stats[field]; MODS.current=mods(power);
  assert.ok(Math.abs(t.stats[field]-before*factor)<1e-9);
});
test('Chain Coil reaches Arc chains while preserving other tower fields',()=>{
  MODS.current=mods('chain-coil','chain-coil');assert.equal(tower('tesla').stats.chains,5);assert.equal(tower('bolt').stats.chains,undefined);
});
test('critical chance affects discrete towers and deterministic beam output',()=>{
  MODS.current=mods('sharp-edge');
  for(const type of ['bolt','mortar','tesla'])assert.equal(tower(type).stats.crit,.05);
  assert.equal(tower('helios').stats.dps,26*1.06);
});
test('Fifth Volley counts actual volleys and resets per tower',()=>{
  MODS.current=mods('fifth-volley');const t=tower('tesla');
  assert.deepEqual(Array.from({length:10},()=>t._volleyMul()),[1,1,1,1,2,1,1,1,1,2]);
  assert.equal(tower('tesla')._volleyMul(),1);
});
test('Thrift discounts actual upgrade prices and respects minimum cost',()=>{
  assert.equal(tierCost('bolt',3),293);MODS.current=mods('thrift');assert.equal(tierCost('bolt',3),263);
  MODS.current=mods(...Array(100).fill('thrift'));assert.equal(MODS.current.costMul,.25);assert.ok(tierCost('bolt',1)>0);
});
function consumer(bonuses={}){
  const game={gold:450,lives:12},allies={},enemies={};
  const reward=createRewardConsumer({game,allies,enemies,centre:{},profile:{bonuses},startGold:450,startLives:20});
  return {game,allies,enemies,reward};
}
test('Counting House pays live gold once and ordinary profiles remain unchanged',()=>{
  const c=consumer({interest:true});assert.equal(c.game.gold,600);
  c.game.gold-=150;for(let i=0;i<10;i++)c.reward.sync(mods());assert.equal(c.game.gold,450);
  assert.equal(consumer().game.gold,450);
});
test('Hardened Heart increases current and maximum health once per acquired stack',()=>{
  const c=consumer();c.reward.sync(mods('hardened-heart'));assert.equal(c.game.lives,14);assert.equal(c.game.maxLives,22);
  c.reward.sync(mods('hardened-heart'));assert.equal(c.game.lives,14);
  c.reward.sync(mods('hardened-heart','hardened-heart'));assert.equal(c.game.lives,16);assert.equal(c.game.maxLives,24);
});
test('Mending heals on wave settlement, caps at max, and cannot revive defeat',()=>{
  const c=consumer();c.reward.sync(mods('mending'));assert.equal(c.reward.waveCleared().healed,1);assert.equal(c.game.lives,13);
  c.game.lives=20;assert.equal(c.reward.waveCleared().healed,0);
  c.game.lives=0;c.reward.sync(mods('hardened-heart','mending'));assert.equal(c.game.lives,0);assert.equal(c.reward.waveCleared().healed,0);
});
test('Compound Interest settles against spendable shell gold',()=>{
  const c=consumer();c.reward.sync(mods('compound-interest'));assert.equal(c.reward.waveCleared().interest,13);assert.equal(c.game.gold,463);
});
test('Cryo Field installs a bounded live aura and a healthy control has none',()=>{
  const c=consumer();c.reward.sync(mods());assert.equal(c.enemies.heartAura,null);
  c.reward.sync(mods('cryo-field'));assert.equal(c.enemies.heartAura.fraction,.1);assert.equal(c.enemies.heartAura.radius,8);
  c.reward.sync(mods(...Array(20).fill('cryo-field')));assert.equal(c.enemies.heartAura.fraction,.7);
});
test('Veterancy reaches real spawned bodies and pooled ownership resets',()=>{
  const manager=Object.assign(Object.create(AllyManager.prototype),{active:[],pool:[],healthMultiplier:1.2});
  const dir=new THREE.Vector3(0,1,0),a=manager.spawn('warden',dir,dir);
  assert.equal(a.hpMax,264);assert.equal(a.hp,264);a.homeTower=41;
  manager.active.length=0;manager.pool.push(a);const b=manager.spawn('commander',dir,dir);
  assert.equal(a,b);assert.equal(b.homeTower,null);assert.equal(b.hpMax,1680);
});
test('Warden damage and kill attribution survives AI/player shared path',()=>{
  const calls=[];const manager=Object.assign(Object.create(AllyManager.prototype),{modifiers:mods('keen-rails'),
    enemies:{damage(e,n){if(e.dead)return 0;e.hp-=n;e.dead=e.hp<=0;return n;}},onDamage:(...args)=>calls.push(args)});
  const a={homeTower:7},e={hp:8,dead:false};assert.equal(manager._dealDamage(a,e,10),11.200000000000001);
  assert.equal(calls.length,1);assert.equal(calls[0][2],true);manager._dealDamage(a,e,10);assert.equal(calls.length,1);
});
test('Scout starts one ring wider without granting a base level',()=>{
  const r=createRun({seed:3,playerIds:['solo'],profile:{bonuses:{scout:true}}});
  assert.equal(r.getFrontierSteps(),1);assert.equal(r.getHeartLevel(),0);r.completeWave();assert.equal(r.getFrontierSteps(),1);
});
test('Quartermaster is a healthy existing effect: fourth card is retained',()=>{
  const r=createRun({seed:3,playerIds:['solo'],profile:{bonuses:{quartermaster:true}}});
  for(let i=0;i<7;i++){r.completeWave();r.tick(11);}assert.equal(r.getHand().length,4);
});
test('untimed solo draft waits indefinitely, then resolves with zero simulation time',()=>{
  const r=createRun({seed:3,playerIds:['solo'],draftSeconds:null});r.completeWave();r.completeWave();
  assert.deepEqual(r.tick(10000),[]);assert.equal(r.getPhase(),'drafting');assert.equal(r.getDraft().remaining,null);
  assert.ok(r.vote('solo',0));assert.equal(r.tick(0)[0].type,'powerTaken');assert.equal(r.getPhase(),'building');assert.deepEqual(r.tick(0),[]);
});

test('Salvage uses the real sale fraction and cannot make a refund loop profitable',()=>{
  const g=Object.create(Game.prototype);MODS.current=mods('salvage');assert.ok(Math.abs(g.refundFrac()-.9)<1e-9);
  MODS.current=mods('salvage','salvage');assert.equal(g.refundFrac(),.92);
});

test('Pierce hits only a second body in the corridor beyond the first target',()=>{
  const target={p:[0,0,5]},inside={p:[0,0,8]},behind={p:[0,0,2]},side={p:[2,0,8]},far={p:[0,0,12]};
  const bodies=[target,inside,behind,side,far].map(e=>Object.assign(e,{active:true}));const hits=[];
  const m=Object.assign(Object.create(TowerManager.prototype),{enemies:{active:bodies},enemyWorldPos:(e,out)=>out.fromArray(e.p),applyDamage:(t,e,n)=>hits.push([e,n])});
  m._pierceThrough({from:new THREE.Vector3(),target,dmg:40,crit:false,tower:{}},new THREE.Vector3(0,0,5));
  assert.deepEqual(hits,[[inside,40]]);
});

test('Scorched Earth damages ground bodies, expires, and credits its originating tower',()=>{
  const ground={active:true,type:{flying:false}},air={active:true,type:{flying:true}},hits=[];
  const origin={id:31};const m=Object.assign(Object.create(TowerManager.prototype),{
    burns:[{active:false,pos:new THREE.Vector3()}],fx:{glow:{emit(){}}},enemies:{active:[ground,air]},
    enemyWorldPos:(e,out)=>out.set(0,0,0),applyDamage:(t,e,n)=>hits.push([t,e,n])});
  m._leaveBurn(new THREE.Vector3(),{dmg:100,aoe:3},origin);m._updateBurns(.25);
  assert.deepEqual(hits,[[origin,ground,5.5]]);m._updateBurns(5);assert.equal(m.burns[0].active,false);assert.equal(hits.length,1);
});

test('Deep Freeze has a real recovery interval even under overlapping auras',()=>{
  const m=Object.assign(Object.create(EnemyManager.prototype),{time:0}),enemy={};let held=0,released=0;
  for(let i=0;i<600;i++){m.time=i/60;const first=m.mayFreeze(enemy,1/60);assert.equal(m.mayFreeze(enemy,1/60),first);if(first)held++;else released++;}
  assert.ok(held>0);assert.ok(released>60,'target must get a meaningful recovery interval');
});

test('all 13 talents buy, persist, reject duplicate charging, and reach the next run',async()=>{
  const saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
  const p=await import('../../js/modes/progress.js');const profile=p.loadProfile();profile.coins=10000;p.saveProfile(profile);
  assert.equal(p.buyTalent('b-veteran').reason,'locked');let spent=0;
  for(const t of p.TALENTS){assert.equal(p.buyTalent(t.id).ok,true,t.id);spent+=t.cost;assert.equal(p.isOwned(p.loadProfile(),t),true);assert.equal(p.buyTalent(t.id).reason,'owned');}
  const current=p.loadProfile();assert.equal(current.coins,10000-spent);assert.equal(p.TALENTS.length,13);
  const run=createRun({seed:3,playerIds:['solo'],profile:current});assert.equal(run.getFrontierSteps(),1);
  for(const t of current.towers)assert.ok(run.getUnlockedTowers().includes(t),t);
  saved.set('wh99Progress','broken');assert.deepEqual(p.loadProfile().towers,['bolt']);delete globalThis.localStorage;
});
