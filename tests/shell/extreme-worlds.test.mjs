import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {PLANET_THEMES,planetEnvironment} from '../../js/run/planet-environments.js';
import {createEcology} from '../../js/terrain/ecology.js';
import {LANDFORM_RECIPES,formationHeightLimit,formationDepthLimit} from '../../js/terrain/recipes.js';
import {formationSample} from '../../js/terrain/samples.js';
globalThis.location={search:'?map=ninetynine&campaign=0'};globalThis.matchMedia=()=>({matches:false});
registerHooks({resolve(s,c,n){return s==='three'?{url:new URL('../../lib/three.module.min.js',import.meta.url).href,shortCircuit:true}:n(s,c);}});
const THREE=await import('../../lib/three.module.min.js');
const {TOWER_TYPES,tierStats,Tower}=await import('../../js/towers.js');
const {THEME_SURFACES,BIOME_VISUALS}=await import('../../js/biome-visuals.js');
const {CONFIG}=await import('../../js/config.js');

test('all tower families start 35 percent wider and reach grows slower through tier 100',()=>{
 for(const [key,def]of Object.entries(TOWER_TYPES)){
  const original=def.tiers[0].range,start=tierStats(key,0).range;
  assert.ok(Math.abs(start-original*1.35)<1e-12);
  assert.ok(Math.abs((tierStats(key,2).range-start)-(def.tiers[2].range-original)*.5)<1e-12);
  let last=0,delta=Infinity;
  for(let tier=0;tier<=100;tier++){
   const s=tierStats(key,tier);assert.ok(Number.isFinite(s.range)&&s.range>last);
   if(tier>=4){assert.ok(s.range-last<delta);delta=s.range-last;}
   if(key==='warden')assert.equal(s.leash,s.range);
   if(key==='mortar')assert.equal(s.minRange,2.3);
   last=s.range;
  }
  assert.ok(last<start*2,'late reach remains local');assert.equal(def.tiers[0].range,original,'authored reference data stays immutable');
 }
});
test('actual tower acquisition covers the added annulus but rejects a target outside it',()=>{
 for(const key of ['bolt','mortar','tesla','helios']){
  const tower=Object.assign(Object.create(Tower.prototype),{typeKey:key,def:TOWER_TYPES[key],tier:0,terrain:'neutral',pos:new THREE.Vector3(0,CONFIG.planetRadius,0),shotCount:0,target:null,
    manager:{enemyWorldPos:(e,p)=>p.copy(e.pos)}});
  const make=d=>({active:true,dead:false,type:{flying:false},progress:1,pos:tower.pos.clone().add(new THREE.Vector3(d,0,0))});
  const near=make(tierStats(key,0).range*.99),far=make(tierStats(key,0).range*1.01);
  assert.equal(tower._acquire([far,near]),near);tower.target=null;assert.equal(tower._acquire([far]),null);
 }
});
test('ten seeded themes have distinct surfaces and dominant extreme biomes',()=>{
 assert.equal(Object.keys(PLANET_THEMES).length-1,10);
 assert.deepEqual(Object.keys(THEME_SURFACES).sort(),Object.keys(PLANET_THEMES).filter(k=>k!=='auto').sort());
 const identities=new Set();
 for(const [theme,visual]of Object.entries(THEME_SURFACES)){
  identities.add([visual.biome,visual.water].join('/'));assert.ok(BIOME_VISUALS[visual.biome]);
  const e=createEcology(771,'auto',planetEnvironment(771,theme)),counts={};
  for(let k=0;k<2000;k++){const y=1-2*(k+.5)/2000,r=Math.sqrt(1-y*y),a=k*2.39996,b=e.biome(r*Math.cos(a),y,r*Math.sin(a),.6);counts[b]=(counts[b]||0)+1;}
  if(!['temperate','oceanic'].includes(theme))assert.ok(Math.max(...Object.values(counts))>=1800,`${theme} must read as a dominant extreme`);
 }
 assert.equal(identities.size,10);
});
test('thirty real formation fields are finite, distinctive and bounded',()=>{
 assert.ok(Object.keys(LANDFORM_RECIPES).length>=30);const fingerprints=new Set();
 for(const type of Object.keys(LANDFORM_RECIPES)){
  const sample=formationSample(type),values=[];
  for(let x=-sample.half;x<=sample.half;x+=3)for(let y=-sample.half;y<=sample.half;y+=3){
   const h=sample.height(x,y);assert.ok(Number.isFinite(h));
   assert.ok(h<=formationHeightLimit({range:90,canyon:38})&&h>=-formationDepthLimit({range:90,canyon:38}));values.push(h);
  }
  assert.ok(Math.max(...values)-Math.min(...values)>2,`${type} is not flat`);
  fingerprints.add(values.map(v=>v.toFixed(2)).join(','));
 }
 assert.equal(fingerprints.size,Object.keys(LANDFORM_RECIPES).length);
});
