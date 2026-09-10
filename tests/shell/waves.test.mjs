import{test}from'node:test';import assert from'node:assert/strict';import{registerHooks}from'node:module';
globalThis.location={search:'?map=ninetynine'};globalThis.matchMedia=()=>({matches:false});
registerHooks({resolve(spec,context,next){if(spec==='three')return{url:new URL('../../lib/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(spec,context);}});
const{WaveDirector,newNestCount}=await import('../../js/waves.js');
const{CONFIG}=await import('../../js/config.js');
const{NEST_SCHEDULE_CAPACITY}=await import('../../js/nest-sites.js');
const{World}=await import('../../js/world.js');
const{EnemyManager,EVO}=await import('../../js/enemies.js');
const nestFixture=()=>{
 const enemies={active:[],spawn(type,node){const e={id:this.active.length+1,type:{},typeKey:type,node};this.active.push(e);return e;}},game={gold:0};
 const waves=new WaveDirector(game,enemies,{});Object.assign(waves,{nestOnly:true,nestSources:[4,8],destroyedNodes:new Set(),state:'spawning',wave:2,clock:0});
 return {waves,enemies,game};
};
test('campaign destruction cancels only unspawned buildup and never revives a source',()=>{
 const{waves,enemies}=nestFixture();waves.queues=[{t:0,type:'mite',portal:4,scale:1},{t:5,type:'wisp',portal:4,scale:1},{t:5,type:'husk',portal:8,scale:1}];waves.pendingSpawns=3;
 waves.update(.1);assert.equal(enemies.active[0].sourceNest,4);
 waves.destroyedNodes.add(4);waves.update(.1);assert.equal(waves.pendingSpawns,1);assert.equal(enemies.active.length,1);assert.deepEqual(waves.activePortals(),[8]);
 waves.destroyedNodes.add(8);waves.update(.1);assert.deepEqual(waves.activePortals(),[]);assert.equal(waves.state,'combat');assert.equal(enemies.active.length,1);
});
test('an entirely prevented campaign assault clears once without an invisible fallback',()=>{
 const{waves,game}=nestFixture();waves.destroyedNodes=new Set([4,8]);waves.queues=[{t:500,type:'husk',portal:4,scale:1}];waves.pendingSpawns=1;let clears=0;waves.onWaveClear=()=>{clears++;waves.state='idle';};
 waves.update(.01);waves.update(.01);assert.equal(waves.pendingSpawns,0);assert.equal(clears,1);assert.ok(game.gold>0);
});
test('a protected guardian nest cannot erase an owed guardian launch',()=>{
 const p={hp:900,guardianPending:true,destroyed:false,group:{visible:true}};
 assert.equal(World.prototype.damagePortal(p,9999),false);assert.equal(p.hp,900);assert.equal(p.destroyed,false);
 p.guardianPending=false;assert.equal(World.prototype.damagePortal(p,9999),true);assert.equal(p.destroyed,true);
});
test('classic portals retain their authored all-destroyed fallback',()=>{
 const{waves}=nestFixture();waves.nestOnly=false;waves.nav.portalNodes=[4,8];waves.destroyedNodes=new Set([4,8]);assert.deepEqual(waves.activePortals(),[4]);
});
test('boss shedding and evolved splitting use living campaign nests instead of a mobile parent',()=>{
 const spawned=[],manager={reinforcementSource:()=>8,_spawnReinforcement:EnemyManager.prototype._spawnReinforcement,spawn(type,node){const child={typeKey:type,node,hp:50};spawned.push(child);return child;}};
 const boss={active:true,dead:false,type:{boss:true},hp:100,hpMax:100,plates:6,node:99,sourceNest:4,hpScaleUsed:1};
 EnemyManager.prototype.damage.call(manager,boss,40,{trueDamage:true});assert.equal(spawned.length,4);assert.ok(spawned.every(e=>e.node===8&&e.sourceNest===8));
 const before=spawned.length;manager.reinforcementSource=()=>-1;EnemyManager.prototype.damage.call(manager,boss,20,{trueDamage:true});assert.equal(spawned.length,before);assert.equal(boss.dead,false);
 const tier=EVO.tier;EVO.tier=4;manager.reinforcementSource=()=>8;
 try{const mite={active:true,dead:false,type:{},typeKey:'mite',hp:10,hpMax:10,shieldT:1,shieldHits:0,node:99,hpScaleUsed:1};EnemyManager.prototype.damage.call(manager,mite,20,{trueDamage:true});assert.equal(spawned.length,before+2);assert.ok(spawned.slice(-2).every(e=>e.node===8&&e.isSplit&&e.hp===20));}finally{EVO.tier=tier;}
 manager.reinforcementSource=null;manager._spawnReinforcement(boss);assert.equal(spawned.at(-1).node,99,'classic child origins stay on the parent');
});
test('a full enemy pool delays an owed wave spawn without paying its clear',()=>{
 let full=true,spawned=0,cleared=0;const enemies={active:[],spawn(){if(full)return null;const e={id:++spawned};this.active.push(e);return e;}},game={gold:0},waves=new WaveDirector(game,enemies,{});
 waves.state='spawning';waves.wave=1;waves.clock=0;waves.queues=[{t:0,type:'mite',portal:0,scale:1}];waves.pendingSpawns=1;waves.onWaveClear=()=>cleared++;
 waves.update(.1);assert.equal(waves.pendingSpawns,1);assert.equal(waves.queues.length,1);assert.equal(cleared,0);assert.equal(game.gold,0);
 full=false;waves.update(.1);assert.equal(spawned,1);assert.equal(waves.pendingSpawns,0);assert.equal(cleared,0);
 enemies.active=[];waves.update(.1);assert.equal(cleared,1);assert.ok(game.gold>0);
});
function timedFixture() {
 const f=nestFixture();let id=0;
 f.enemies.spawn=function(type,node){const e={id:++id,typeKey:type,node};this.active.push(e);return e;};
 Object.assign(f.waves,{timedNests:true,nestSources:[],wave:0,clearedWaves:0,state:'countdown',countdown:0});
 f.waves.prepareNests=wave=>[wave,...f.waves.activePortals()];
 return f;
}
test('every timed wave creates a source and every surviving source adds a pack',()=>{
 const{waves}=timedFixture();waves._startWave();const before=waves.queues.slice();
 waves._startWave();assert.equal(waves.wave,2);assert.ok(before.every(q=>waves.queues.includes(q)));
 assert.ok(waves.queues.some(q=>q.wave===2&&q.portal===2));
 assert.ok(waves.queues.filter(q=>q.wave===2).length>14,'14 authored mites plus surviving-nest pressure');
 for(let i=1;i<=15;i++)assert.ok(newNestCount(i)>=1);
 assert.equal(Array.from({length:CONFIG.waves.count},(_,i)=>newNestCount(i+1)).reduce((a,b)=>a+b,0),NEST_SCHEDULE_CAPACITY);
});
test('timer overlaps a live assault, pauses for drafts and does not reset owed queues',()=>{
 const{waves,enemies}=timedFixture();waves._startWave();waves.update(5);assert.ok(enemies.active.length);
 const owed=waves.queues.slice();waves.countdown=.1;waves.update(.2);
 assert.equal(waves.wave,2);assert.ok(owed.every(q=>waves.queues.includes(q)));
 const clock=waves.clock,left=waves.countdown;waves.canRaid=()=>false;waves.update(200);
 assert.equal(waves.wave,2);assert.equal(waves.clock,clock);assert.equal(waves.countdown,left);
 waves.canRaid=()=>true;waves.update(1);assert.equal(waves.countdown,left-1);
});
test('out of order kills, pool pressure and split ancestry cannot advance rewards early',()=>{
 const{waves,enemies,game}=timedFixture(),clears=[];waves.onWaveClear=n=>clears.push(n);
 waves._startWave();waves.update(20);waves._startWave();waves.update(20);
 const first=enemies.active.find(e=>waves.assaultIds.get(e.id)===1);
 enemies.active=enemies.active.filter(e=>e===first);waves.queues=[];
 const child=enemies.spawn('mite',1);waves.inheritAssault(child,first);enemies.active=[child];
 waves.update(.1);assert.deepEqual(clears,[]);assert.equal(game.gold,0);
 enemies.active=[];waves.update(.1);waves.update(.1);assert.deepEqual(clears,[1,2]);
 const gold=game.gold;waves.update(.1);assert.equal(game.gold,gold);
});
test('no safe site defers the wave without phantom enemies, rewards or a mountain fallback',()=>{
 const{waves,game}=timedFixture();waves.prepareNests=()=>null;waves.update(.1);
 assert.equal(waves.wave,0);assert.equal(waves.pendingSpawns,0);assert.equal(game.gold,0);assert.equal(waves.countdown,5);
 assert.equal(waves.callEarly(),0);assert.equal(game.gold,0,'blocked-site retries cannot farm early-call bounty');
 waves.prepareNests=()=>[9];waves.update(5.1);assert.equal(waves.wave,1);assert.ok(waves.pendingSpawns>0);
});
test('a full pool retains both overlapping assaults and cannot pay either early',()=>{
 const{waves,enemies,game}=timedFixture();enemies.spawn=()=>null;
 waves._startWave();waves._startWave();const queued=waves.queues.length;waves.update(30);
 assert.equal(waves.pendingSpawns,queued);assert.equal(waves.clearedWaves,0);assert.equal(game.gold,0);
 assert.ok(waves.queues.some(q=>q.wave===1)&&waves.queues.some(q=>q.wave===2));
});
test('final timed assault fires victory once only after every earlier wave and boss child',()=>{
 const{waves,enemies}=timedFixture();let victories=0;waves.onVictory=()=>victories++;
 waves.wave=CONFIG.waves.count;waves.state='combat';waves.clearedWaves=13;
 const child=enemies.spawn('mite',1);waves.assaultIds.set(child.id,15);
 waves.update(1000);assert.equal(waves.clearedWaves,14);assert.equal(waves.wave,15);assert.equal(victories,0);
 waves.update(1000);assert.equal(victories,0);enemies.active=[];waves.update(.1);waves.update(1000);
 assert.equal(victories,1);assert.equal(waves.state,'idle');
});
