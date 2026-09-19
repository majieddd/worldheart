import test from 'node:test';import assert from 'node:assert/strict';
import {SOLAR_LANDMARKS,createSolarTactics,solarTerrainSeed} from '../../js/run/solar-tactics.js';
import {SOLAR_THEMES,createSolarSampler} from '../../js/run/solar-worlds.js';
test('every Solar body has distinct named tactical landmarks with bounded geometry',()=>{
 assert.deepEqual(Object.keys(SOLAR_LANDMARKS).sort(),Object.keys(SOLAR_THEMES).sort());const hashes=new Set();
 for(const key of Object.keys(SOLAR_THEMES)){
  const t=createSolarTactics(key);assert.ok(t.sites.length>=6,key);assert.equal(new Set(t.sites.map(s=>s.name)).size,t.sites.length);hashes.add(solarTerrainSeed(key));
  for(const s of t.sites){let min=Infinity,max=-Infinity;for(let i=-10;i<=10;i++)for(let j=-10;j<=10;j++){const d=s.dir.map((x,k)=>x+(s.axis[k]*i+s.side[k]*j)*s.width/10/240),r=Math.hypot(...d),h=t.height(...d.map(x=>x/r));assert.ok(Number.isFinite(h)&&Math.abs(h)<120);min=Math.min(min,h);max=Math.max(max,h);}assert.ok(max-min>2,`${key}/${s.name} must actually change terrain`);}
 }
 assert.equal(hashes.size,16);
});
test('old Solar samplers remain exact and current samplers retain coast and biome identity',()=>{
 for(const key of Object.keys(SOLAR_THEMES)){
  const old=createSolarSampler(key),legacy=createSolarSampler(key,{version:2}),current=createSolarSampler(key,{version:3});let changed=0;
  for(let i=0;i<500;i++){const y=1-2*(i+.5)/500,r=Math.sqrt(1-y*y),a=i*2.399,x=Math.cos(a)*r,z=Math.sin(a)*r,before=old(x,y,z),after=current(x,y,z);assert.deepEqual(before,legacy(x,y,z));assert.equal(after.land,before.land);assert.equal(after.biome,before.biome);if(after.extra!==before.extra||after.relief!==before.relief)changed++;}
  assert.ok(changed>100,key+' needs substantial relief coverage');
 }
});
