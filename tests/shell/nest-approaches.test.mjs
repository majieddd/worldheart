import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from '../../lib/three.module.min.js';
import {nestSite} from '../../js/nest-sites.js';

test('a dry nest clearing also prefers a dry approach over a shorter swim', () => {
  const dirs = [0,.2,.22,.15,.16,.08,.07].map(a => new Vector3(Math.sin(a),0,Math.cos(a)));
  const nav = {n:7,revision:1,heartNode:0,walk:new Uint8Array(7).fill(1),block:new Uint8Array(7),
    airWalk:Uint8Array.from([1,1,1,1,1,0,1]),airDist:new Float64Array(7),
    baseHeight:Float32Array.from([.5,.5,.5,.5,.5,.5,-1]),height:new Float32Array(7),
    adjOff:Uint32Array.from([0,0,1,2,3,4,4,4]),adj:Uint32Array.from([3,4,6,5]),cost:new Float32Array(4).fill(1),
    march:{floorReach:new Uint8Array(7).fill(1),next:Int32Array.from([-1,3,4,6,5,0,0]),dist:Float64Array.from([0,80,90,65,75,50,40])},
    pos:Float64Array.from(dirs.flatMap(d => d.toArray().map(v=>v*240))),
    nodeDir(i,out){return out.copy(dirs[i]);},nodePos(i,out){return out.copy(dirs[i]).multiplyScalar(240);},
    nodesInRadius(p){return [dirs.reduce((best,d,i)=>d.distanceToSquared(p.clone().normalize())<dirs[best].distanceToSquared(p.clone().normalize())?i:best,0)];}};
  const chosen=nestSite(nav,1,dirs[0],.18,new Set(),new Vector3());
  assert.equal(chosen,2,'slightly farther dry approach wins over a wet route');
  assert.equal(nav._nestSites.wetDistance[1],65);
  assert.equal(nav._nestSites.wetDistance[2],0);
  nav.block[2]=1; nav.revision++;
  assert.equal(nestSite(nav,1,dirs[0],.18,new Set(),new Vector3()),1,'water remains a usable fallback when the dry clearing is blocked');
});
