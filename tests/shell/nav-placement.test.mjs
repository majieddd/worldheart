import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
globalThis.location={search:'?map=ninetynine'};globalThis.matchMedia=()=>({matches:false});
registerHooks({resolve(spec,context,next){if(spec==='three')return {url:new URL('../../lib/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(spec,context);}});
const {NavGraph}=await import('../../js/nav.js');
const graph=()=>({
 heartNode:0,portalNodes:[2],walk:new Uint8Array([1,1,1,1,1]),block:new Int32Array(5),
 adjOff:new Int32Array([0,1,4,5,7,8]),adj:new Int32Array([1,0,2,3,1,1,4,3]),cost:new Float32Array(8).fill(1),
 _fA:[],_gen:0,_scratch(){this._gen++;return new Int32Array(5);},nodesInRadius(){return [3];},
});
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
