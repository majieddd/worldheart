import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
globalThis.location={search:'?map=ninetynine'};globalThis.matchMedia=()=>({matches:false});
registerHooks({resolve(spec,context,next){if(spec==='three')return{url:new URL('../../lib/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(spec,context);}});
const {NavGraph}=await import('../../js/nav.js');
function fixture(){
 const n=Object.assign(new NavGraph(),{n:4,heartNode:0,walk:new Uint8Array([1,1,1,1]),floorWalk:new Uint8Array([1,1,0,1]),block:new Int16Array(4),dist:new Float32Array(4),next:new Int32Array(4),
  adjOff:new Int32Array([0,2,4,6,8]),adj:new Int32Array([1,2,0,3,0,3,1,2]),cost:new Float32Array([100,1,100,100,1,1,100,1])});
 n._dijkstra(0,null);n._marchFlow();return n;
}
test('a floor detour wins even when a mountain shortcut would be much faster',()=>{
 const n=fixture();assert.equal(n.next[3],2,'ordinary path is a two-unit mountain shortcut');
 assert.equal(n.march.next[3],1);assert.equal(n.march.dist[3],200);assert.equal(n.march.floorReach[3],1);
 assert.equal(n.march.floorReach[2],0);assert.equal(n.march.next[2],0);
});
test('blocking the only valley enables a slow emergency crossing; selling restores the valley',()=>{
 const n=fixture();n.block[1]=7;n._dijkstra(0,null);n._marchFlow();
 assert.equal(n.march.floorReach[3],0);assert.equal(n.march.next[3],2);assert.equal(n.march.dist[3],25);
 n.block[1]=0;n._dijkstra(0,null);n._marchFlow();assert.equal(n.march.next[3],1);assert.equal(n.march.floorReach[3],1);
});
test('directed impassable edges and temporary placement do not invent a mountain exit',()=>{
 const n=fixture();n.block[1]=7;n.cost[1]=Infinity;n.march=null;n._dijkstra(0,null);n._marchFlow();
 assert.equal(n.march.next[3],-1);assert.equal(n.march.dist[3],Infinity);
 const m=fixture(),before=m.march.next.slice();
 assert.deepEqual(m._previewRoute(3,new Set([1]),{next:m.march.next,walk:m.floorWalk,cost:m.cost}),[]);
 assert.deepEqual(m._previewRoute(3,new Set([1]),{next:m.march.next,walk:m.walk,cost:m.march.cost}),[3,2,0]);assert.deepEqual(m.march.next,before);
});
