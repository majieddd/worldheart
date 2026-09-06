import{test}from'node:test';import assert from'node:assert/strict';import{registerHooks}from'node:module';
globalThis.location={search:'?map=ninetynine'};globalThis.matchMedia=()=>({matches:false});
registerHooks({resolve(spec,context,next){if(spec==='three')return{url:new URL('../../lib/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(spec,context);}});
const{WaveDirector}=await import('../../js/waves.js');
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
