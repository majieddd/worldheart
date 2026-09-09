import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
globalThis.location={search:'?map=ninetynine'};globalThis.matchMedia=()=>({matches:false});
registerHooks({resolve(spec,context,next){if(spec==='three')return{url:new URL('../../lib/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(spec,context);}});
const THREE=await import('../../lib/three.module.min.js');
const {CONFIG}=await import('../../js/config.js'),{R,initTerrainField}=await import('../../js/world.js');
const {EnemyManager}=await import('../../js/enemies.js'),{NavGraph}=await import('../../js/nav.js');
initTerrainField(12345);const terrain=CONFIG.terrain;afterEach(()=>{CONFIG.terrain=terrain;});
const direction=d=>new THREE.Vector3(Math.sin(d/R),0,Math.cos(d/R));
function fixture(){
 const count=9,adj=[],off=[0];
 for(let i=0;i<count;i++){if(i>0)adj.push(i-1);if(i<count-1)adj.push(i+1);off.push(adj.length);}
 const nav={walk:new Uint8Array(count).fill(1),block:new Int32Array(count),dist:new Float32Array(count).fill(1),adjOff:off,adj,cost:new Float32Array(adj.length).fill(1),
  descendNode(node,dir){return Math.max(0,Math.min(count-1,Math.floor(Math.atan2(dir.x,dir.z)*R/.2)));},canStep:NavGraph.prototype.canStep,canMarchStep:NavGraph.prototype.canMarchStep};
 const e={active:true,dead:false,type:{flying:false},dir:direction(.05),fwd:new THREE.Vector3(Math.cos(.05/R),0,-Math.sin(.05/R)),node:0,hp:100};
 return {nav,e,manager:{nav},attacker:direction(-1)};
}
test('open terrain retains the full knockback and transports its tracked body state',()=>{
 const {e,manager,attacker}=fixture();const before=e.dir.clone();
 assert.ok(Math.abs(EnemyManager.prototype.knockback.call(manager,e,attacker,1.1)-1.1)<1e-9);
 assert.ok(Math.abs(before.angleTo(e.dir)*R-1.1)<1e-6);assert.equal(e.node,5);
 assert.ok(Math.abs(e.fwd.dot(e.dir))<1e-10);assert.ok(Number.isFinite(e.height));assert.equal(e.hp,100);
});
test('a narrow tower footprint stops a shove before its otherwise legal endpoint',()=>{
 const {nav,e,manager,attacker}=fixture();nav.block[2]=7;
 const moved=EnemyManager.prototype.knockback.call(manager,e,attacker,1.1);
 assert.ok(moved>0&&moved<.4);assert.equal(e.node,1);assert.equal(nav.block[e.node],0);
});

test('knockback cannot shove a floor-connected enemy onto a mountain shortcut',()=>{
 const {nav,e,manager,attacker}=fixture();nav.march={floorReach:new Uint8Array([1,1,0,0,0,0,0,0,0])};
 const moved=EnemyManager.prototype.knockback.call(manager,e,attacker,1.1);
 assert.ok(moved>0&&moved<.4);assert.equal(e.node,1);
});
test('a non-traversable edge cannot be crossed even when both nodes can reach the heart',()=>{
 const {nav,e,manager,attacker}=fixture();
 for(let edge=nav.adjOff[2];edge<nav.adjOff[3];edge++)if(nav.adj[edge]===1)nav.cost[edge]=Infinity;
 const moved=EnemyManager.prototype.knockback.call(manager,e,attacker,1.1);
 assert.ok(moved>0&&moved<.4);assert.equal(e.node,1);
});
test('unwalkable and disconnected destinations retain the last legal position',()=>{
 for(const field of ['walk','dist']){
  const {nav,e,manager,attacker}=fixture();nav[field][2]=field==='walk'?0:Infinity;
  const moved=EnemyManager.prototype.knockback.call(manager,e,attacker,1.1);
  assert.ok(moved>0&&moved<.4);assert.equal(e.node,1);
 }
});
test('flyer shoves use their own route layer while ignoring ground tower footprints',()=>{
 for(const blockedAir of [false,true]){
  const {nav,e,manager,attacker}=fixture();e.type.flying=true;
  nav.block[2]=7;nav.airWalk=new Uint8Array(nav.walk);nav.airCost=new Float32Array(nav.cost);nav.airDist=new Float32Array(nav.dist);
  if(blockedAir)nav.airWalk[2]=0;
  const moved=EnemyManager.prototype.knockback.call(manager,e,attacker,1.1);
  if(blockedAir){assert.ok(moved>0&&moved<.4);assert.equal(e.node,1);}
  else {assert.ok(Math.abs(moved-1.1)<1e-9);assert.equal(e.node,5);}
 }
});
test('dead bodies and nonpositive shoves cannot change position or identity',()=>{
 for(const condition of ['dead','inactive','zero','infinite']){
  const {e,manager,attacker}=fixture();const before=e.dir.clone();
  if(condition==='dead')e.dead=true;if(condition==='inactive')e.active=false;
  assert.equal(EnemyManager.prototype.knockback.call(manager,e,attacker,condition==='zero'?0:condition==='infinite'?Infinity:1.1),0);
  assert.deepEqual(e.dir,before);assert.equal(e.node,0);
 }
});
test('classic maps keep the original angular shove without terrain navigation',()=>{
 const {e,attacker}=fixture();CONFIG.terrain=null;
 const before=e.dir.clone(),heading=e.fwd.clone();
 assert.equal(EnemyManager.prototype.knockback.call({},e,attacker,1.1),1.1);
 assert.ok(Math.abs(before.angleTo(e.dir)*R-1.1)<1e-6);assert.deepEqual(e.fwd,heading);assert.equal(e.node,0);
});
