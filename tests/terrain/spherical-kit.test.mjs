import test from 'node:test';
import assert from 'node:assert/strict';
import {createSphericalQuads,createSphereIndex,spherePosition,sphereUV,createGuidedSurface} from '../../js/terrain/spherical-kit.js';
import {mulberry32} from '../../js/noise.js';
import {starterEarthHome,validateHome} from '../../js/run/homeworld.js';
import {freshSave,startExpedition,beginAssault,validSave} from '../../js/run/campaign.js';
import {createInventory} from '../../js/run/weapons.js';
import {savedTerrainVersion} from '../../js/run/terrain-version.js';

const grid=createSphericalQuads(12345),index=createSphereIndex(grid);
test('Spherical cages are deterministic closed quads with no polar boundaries',()=>{
  assert.deepEqual(createSphericalQuads(12345),grid);
  assert.notDeepEqual(createSphericalQuads(99).quads,grid.quads);
  const edges=new Map();
  for(const f of grid.quads){assert.equal(f.length,4);for(let i=0;i<4;i++){const a=f[i],b=f[(i+1)%4],k=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(k,(edges.get(k)||0)+1);}}
  assert.ok([...edges.values()].every(n=>n===2));assert.equal(grid.points.length-edges.size+grid.quads.length,2);
  for(const p of grid.points)assert.ok(Math.abs(Math.hypot(...p)-1)<1e-12);
});
test('Spherical inverse cages agree along both sides of every shared edge',()=>{
  for(let i=0;i<grid.quads.length;i++){
    const f=grid.quads[i];
    for(const [u,v] of [[0,.37],[1,.67],[.23,0],[.61,1],[.24,.72]]){
      const p=spherePosition(grid.points,f,u,v),uv=sphereUV(index.cages[i],...p);
      assert.ok(uv&&Math.abs(uv[0]-u)<1e-7&&Math.abs(uv[1]-v)<1e-7,`cage ${i}`);
      const found=index.find(...p);assert.ok(found>=0);const other=sphereUV(index.cages[found],...p);assert.ok(other);
      const q=spherePosition(grid.points,grid.quads[found],...other);assert.ok(Math.hypot(...p.map((x,k)=>x-q[k]))<1e-10);
    }
  }
});
test('Spatial index covers poles and 30000 independent globe rays',()=>{
  const rng=mulberry32(771),samples=[[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
  for(let i=0;i<30000;i++){const y=rng()*2-1,a=rng()*Math.PI*2,r=Math.sqrt(1-y*y);samples.push([r*Math.cos(a),y,r*Math.sin(a)]);}
  for(const p of samples){const i=index.find(...p);assert.ok(i>=0,`missing ${p}`);assert.ok(sphereUV(index.cages[i],...p));}
});
test('Guided height preserves real low routes and dry canyon floors, continuously across cages',()=>{
  const source=(x,y,z)=>.55+24*Math.sin(x*9)*Math.sin(y*11)*Math.sin(z*7),kit=createGuidedSurface(12345,240,source,{landmarks:false});
  let changed=0;
  for(let i=0;i<grid.quads.length;i+=3){
    const f=grid.quads[i],p=spherePosition(grid.points,f,.5,.5),raw=source(...p),h=kit.height(...p);
    assert.ok(Number.isFinite(h));if(Math.abs(raw-.55)<1.25)assert.equal(h,raw);if(Math.abs(h-raw)>1)changed++;
    for(const [u,v] of [[0,.38],[1,.63],[.43,0],[.71,1]]){
      const edge=spherePosition(grid.points,f,u,v),near=spherePosition(grid.points,f,u===0?1e-7:u===1?1-1e-7:u,v===0?1e-7:v===1?1-1e-7:v);
      assert.ok(Math.abs(kit.height(...edge)-kit.height(...near))<.001,`height seam ${i}`);
    }
  }
  assert.ok(changed>200,'actual terrain changes');
  const deep=createGuidedSurface(7,240,()=>-18,{landmarks:false});assert.equal(deep.height(0,1,0),-18);
});
test('Terrain versions preserve old home/assault geometry and identify new saves',()=>{
  const home=starterEarthHome();assert.equal(home.world.terrainVersion,3);assert.ok(validateHome(home));
  delete home.world.terrainVersion;assert.ok(validateHome(home));assert.equal(savedTerrainVersion(home.world),0);
  for(const version of [1,2,3]){home.world.terrainVersion=version;assert.ok(validateHome(home));}home.world.terrainVersion=4;assert.equal(validateHome(home),false);
  const save=freshSave();startExpedition(save,{seed:12345});beginAssault(save,{commander:'commander',inventory:createInventory('commander').snapshot(),effectiveSeed:12345});
  assert.equal(save.expedition.assault.terrainVersion,3);assert.ok(validSave(save));
  delete save.expedition.assault.terrainVersion;assert.ok(validSave(save));assert.equal(savedTerrainVersion(save.expedition.assault),0);
  save.expedition.assault.terrainVersion=-1;assert.equal(validSave(save),false);
});
