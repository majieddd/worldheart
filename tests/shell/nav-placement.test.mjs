import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
globalThis.location={search:'?map=ninetynine'};globalThis.matchMedia=()=>({matches:false});
registerHooks({resolve(spec,context,next){if(spec==='three')return {url:new URL('../../lib/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(spec,context);}});
const {NavGraph}=await import('../../js/nav.js');
const graph=()=>{const nav=Object.assign(new NavGraph(),{
 n:5,dist:new Float32Array(5),next:new Int32Array(5),
 heartNode:0,portalNodes:[2],walk:new Uint8Array([1,1,1,1,1]),block:new Int32Array(5),
 adjOff:new Int32Array([0,1,4,5,7,8]),adj:new Int32Array([1,0,2,3,1,1,4,3]),cost:new Float32Array(8).fill(1),
 _fA:[],_gen:0,_scratch(){this._gen++;return new Int32Array(5);},nodesInRadius(){return [3];},
});nav._dijkstra(nav.heartNode,null);return nav;};
test('placement protects a dynamic nest or occupied pocket when original entrances can reroute',()=>{
 const nav=graph();
 assert.equal(NavGraph.prototype.validatePlacement.call(nav,null,1).ok,true,'original-only validation accepted the dead-end cut');
 assert.deepEqual(NavGraph.prototype.validatePlacement.call(nav,null,1,[4]),{ok:false,reason:'path'});
 assert.equal(NavGraph.prototype.validatePlacement.call(nav,null,1,[1,2,2,0]).ok,true,'duplicates and the heart cannot create false owed connections');
});
test('a footprint cannot cover a physical nest or occupied ground node',()=>{
 const nav=graph();nav.nodesInRadius=()=>[4];
 assert.deepEqual(NavGraph.prototype.validatePlacement.call(nav,null,1,[4]),{ok:false,reason:'path'});
});

test('preview detours honor outgoing directed costs and leave the live field unchanged',()=>{
 const nav=Object.assign(new NavGraph(),{n:4,heartNode:0,portalNodes:[3],walk:new Uint8Array([1,1,1,1]),block:new Int32Array(4),dist:new Float32Array(4),next:new Int32Array(4),
  adjOff:new Int32Array([0,2,4,6,8]),adj:new Int32Array([1,2,0,3,0,3,1,2]),cost:new Float32Array([1,1,1,1,1,9,1,2])});
 nav._dijkstra(nav.heartNode,null);const next=nav.next.slice(),dist=nav.dist.slice();
 assert.deepEqual(nav._previewRoute(3,new Set([1])),[3,2,0]);
 assert.equal(nav._preview.dist[0],10,'forward travel reads the incoming row of the destination');
 assert.deepEqual(nav.next,next);assert.deepEqual(nav.dist,dist);
 nav._preview.generation=0xffffffff;
 assert.deepEqual(nav._previewRoute(3,new Set([1])),[3,2,0],'generation rollover cannot retain stale closed marks');
});

test('a detour for an upstream node cannot certify a stranded downstream pocket',()=>{
 const nav=Object.assign(new NavGraph(),{n:4,heartNode:0,portalNodes:[3],walk:new Uint8Array([1,1,1,1]),block:new Int32Array(4),dist:new Float32Array(4),next:new Int32Array(4),
  adjOff:new Int32Array([0,2,4,6,8]),adj:new Int32Array([1,3,0,2,1,3,0,2]),cost:new Float32Array([1,20,1,1,1,1,20,Infinity]),nodesInRadius(){return[1];}});
 nav._dijkstra(nav.heartNode,null);assert.deepEqual(Array.from(nav.next),[-1,0,1,2]);
 assert.equal(nav.validatePlacement(null,1).ok,true,'node 3 can use its expensive direct exit');
 assert.deepEqual(nav.validatePlacement(null,1,[2]),{ok:false,reason:'path'},'node 2 cannot travel against its one-way edge back to node 3');
});
