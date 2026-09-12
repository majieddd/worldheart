import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRun} from '../../js/run/run.js';
import {COMMANDERS,MOUNTS,commanderStats,scaleWeapon,createRespawn,createOreLedger} from '../../js/run/expedition.js';
import {frontierTheta,HEART_RINGS} from '../../js/run/schedule.js';
import {buildIcosphere} from '../../js/geodesic.js';
import {freshSave,startExpedition,beginAssault,awardWave,resolveAssault,continueEndless,validSave} from '../../js/run/campaign.js';
import {createInventory} from '../../js/run/weapons.js';

function clear(run){const events=run.completeWave();if(run.getDraft()){run.vote('solo',0);events.push(...run.tick(0));}return events;}
test('ten-wave victory is explicit and Endless keeps the same run through later bosses',()=>{
 const run=createRun({seed:13,playerIds:['solo']});assert.equal(run.startEndless(),false);
 for(let w=1;w<=9;w++)assert.ok(!clear(run).some(e=>e.type==='runWon'));
 assert.ok(clear(run).some(e=>e.type==='runWon'));assert.equal(run.getWave(),10);
 const coins=run.getCoins();assert.deepEqual(run.completeWave(),[]);assert.equal(run.getCoins(),coins);
 assert.equal(run.startEndless(),true);assert.equal(run.startEndless(),false);
 for(let w=11;w<=100;w++){assert.equal(run.getWave(),w);const e=clear(run);assert.ok(!e.some(x=>x.type==='runWon'));assert.equal(run.getPhase(),'building');}
 assert.ok(run.getCoins()>coins);assert.equal(run.finishEndless()[0].type,'runWon');assert.deepEqual(run.finishEndless(),[]);
});
test('full-planet territory is paid, monotone and accelerates at later levels',()=>{
 const angles=HEART_RINGS.map(frontierTheta);assert.equal(angles[0],.05);assert.equal(angles.at(-1),Math.PI);
 for(let i=2;i<angles.length;i++)assert.ok(angles[i]-angles[i-1]>angles[i-1]-angles[i-2]);
});
test('safe death waits thirty injected seconds, outside death has no respawn, repeats reset',()=>{
 const life=createRespawn();assert.equal(life.die(true),'respawning');assert.equal(life.tick(29),false);assert.equal(life.remaining,1);
 assert.equal(life.tick(0),false);assert.equal(life.tick(1),true);assert.equal(life.tick(1),false);
 life.die(true);life.tick(12);life.die(true);assert.equal(life.remaining,30);
 assert.equal(life.die(false),'defeat');assert.equal(life.remaining,0);assert.equal(life.tick(31),false);
});
test('commander identity and base scaling agree for every weapon channel without compounding',()=>{
 const identities=Object.keys(COMMANDERS).map(k=>commanderStats(k));
 assert.equal(new Set(identities.map(x=>x.health)).size,5);assert.equal(new Set(identities.map(x=>x.power)).size,5);assert.equal(new Set(identities.map(x=>x.speed)).size,5);
 for(const key of Object.keys(COMMANDERS))for(const spec of [{kind:'melee',dmg:20,radius:3},{kind:'beam',dps:50,range:17},{kind:'projectile',dmg:20,range:30},{kind:'lob',dmg:40,speed:16,fuse:2.6}]){
  const original=structuredClone(spec),zero=scaleWeapon(spec,key),max=scaleWeapon(spec,key,10);assert.ok((max.dmg||max.dps)>(zero.dmg||zero.dps));assert.deepEqual(spec,original);
  assert.deepEqual(scaleWeapon(spec,key,10),max);assert.ok(commanderStats(key,10).speed>commanderStats(key,0).speed);
  for(const mount of Object.keys(MOUNTS)){const mounted=scaleWeapon(spec,key,10,mount);assert.equal(mounted.dmg||mounted.dps,(max.dmg||max.dps)*MOUNTS[mount].damage);}
 }
});
test('ore cannot duplicate pickups or spend on rejected/full-hand crafting',()=>{
 const ore=createOreLedger();assert.ok(ore.collect('a',3));assert.equal(ore.collect('a',3),false);assert.equal(ore.craft(false,()=> 'bolt'),null);assert.equal(ore.craft(true,()=>null),null);assert.equal(ore.ore,3);
 assert.equal(ore.craft(true,()=> 'bolt'),'bolt');assert.equal(ore.ore,0);assert.equal(ore.craft(true,()=> 'bolt'),null);
 const run=createRun({seed:13,playerIds:['solo']});run.craftTower();run.craftTower();assert.equal(run.craftTower(),null);assert.equal(run.getHand().length,3);
});
test('Endless campaign coins beyond the legacy bitmask remain idempotent after reload',()=>{
 const s=freshSave(),inventory=createInventory('commander').snapshot();startExpedition(s,{seed:12345});const id=beginAssault(s,{commander:'commander',inventory,effectiveSeed:12345});
 awardWave(s,id,10,130);resolveAssault(s,id,'victory',{inventory,drops:[],kills:12,score:100,lives:5});assert.ok(continueEndless(s,id));assert.equal(continueEndless(s,id),false);
 for(let w=11;w<=40;w++)assert.ok(awardWave(s,id,w,30));const restored=JSON.parse(JSON.stringify(s)),coins=restored.account.coins;
 for(let w=1;w<=40;w++)if(w>=10)assert.equal(awardWave(restored,id,w,30),false);
 assert.equal(restored.account.coins,coins);assert.ok(validSave(restored));assert.ok(awardWave(restored,id,41,30));
});
test('hybrid planet geometry is a closed manifold across detail transitions',()=>{
 const sphere=buildIcosphere(5,{x:0,y:0,z:1},.52,3),edges=new Map();
 for(const f of sphere.faces)for(let i=0;i<3;i++){const a=f[i],b=f[(i+1)%3],key=a<b?a+','+b:b+','+a;edges.set(key,(edges.get(key)||0)+1);}
 assert.ok(sphere.verts.some(v=>v[2]<-.99));assert.ok(sphere.verts.length<buildIcosphere(5).verts.length);
 for(const [edge,count]of edges)assert.equal(count,2,'open or duplicated transition edge '+edge);
 assert.equal(sphere.verts.length-edges.size+sphere.faces.length,2,'sphere Euler characteristic');
});
