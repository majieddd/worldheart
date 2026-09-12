import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFormationField} from '../../js/terrain/formations.js';
import {LANDFORM_RECIPES} from '../../js/terrain/recipes.js';
import {createEcology} from '../../js/terrain/ecology.js';
import {surveyLandmarks} from '../../js/terrain/landmarks.js';
const R=240,profile={range:90,canyon:38};
const sphere=Array.from({length:12000},(_,i)=>{const y=1-2*(i+.5)/12000,r=Math.sqrt(1-y*y),a=i*2.39996323;return [r*Math.cos(a),y,r*Math.sin(a)];});

test('inspection distinguishes a cut between banks from an isolated coastal cliff',()=>{
 const field={radius:R,modules:[{id:1,extent:70,dir:[0,0,1],axis:[0,1,0],side:[1,0,0],height:30}],
  inspect:()=>({id:1,type:'crevice',incision:30,relief:0})};
 const center={x:0,y:0,z:1};
 assert.deepEqual(surveyLandmarks(field,(x)=>Math.max(0,x*R),center,.5),[],'one bank cannot describe an incised channel');
 const valley=surveyLandmarks(field,(x)=>Math.abs(x)*R,center,.5);
 assert.equal(valley.length,1);assert.ok(valley[0].depth>20);assert.equal(valley[0].inside,true);
});

test('ravines cut into uplands, plateaus have broad benches, and crevices cut below sea level',()=>{
 for(const type of ['plateau','ravine','crevice']){
  const weights=Object.fromEntries(Object.keys(LANDFORM_RECIPES).map(k=>[k,k===type?1:0]));
  const f=createFormationField(91,R,profile,'varied',{weights});let cut=0,high=0,below=0,bench=0;
  for(const p of sphere){const s=f.inspect(...p);if(s.incision>8&&s.relief<1)cut++;if(s.relief>10)high++;if(s.relief<-1)below++;
   if(s.relief>10){const q=[p[0]+.001,p[1],p[2]],l=Math.hypot(...q);if(Math.abs(f.height(...q.map(n=>n/l))-s.relief)<.003)bench++;}
   if(s.edge<=s.valley)assert.equal(s.relief,0,'outer valley outlets remain open');
  }
  assert.ok(cut>20,`${type} needs deep cuts below nearby uplands`);assert.ok(high>200,`${type} retains the enclosing uplands`);
  if(type==='crevice')assert.ok(below>20,'some fault bottoms fall below sea level');
  if(type==='plateau')assert.ok(bench>100,'plateaus need usable flat benches');
 }
});

test('mixed terrain includes small hills, deep incisions and major ranges in one seeded globe',()=>{
 for(const seed of [12345,771,92741,2387895531]){
  const f=createFormationField(seed,R,profile,'varied'),types=new Set(f.modules.map(m=>m.type));
  for(const type of ['range','hills','canyon','plateau','ravine','crevice'])assert.ok(types.has(type),`${seed} missing ${type}`);
  assert.ok(Math.max(...f.modules.filter(m=>m.type==='range').map(m=>m.height))>70);
  assert.ok(Math.max(...f.modules.filter(m=>m.type==='hills').map(m=>m.height))<22);
 }
});

test('climate is repeatable, locally continuous and gives planets distinct biome regions',()=>{
 const regimes=new Set();
 for(const seed of [12345,771,92741,2387895531,13,19,27,32,4206018157]){
  const a=createEcology(seed),b=createEcology(seed),biomes=new Set();regimes.add(a.manifest().environment.theme);
  assert.deepEqual(a.manifest(),b.manifest());
  for(let i=0;i<sphere.length;i+=7){const p=sphere[i],t=a.temperature(...p),m=a.moisture(...p);
   assert.equal(t,b.temperature(...p));assert.equal(m,b.moisture(...p));biomes.add(a.biome(...p,.6));
   assert.ok(Math.abs(a.temperature(p[0]+.0001,p[1],p[2])-t)<.01);
   assert.ok(a.forest(...p)>=0&&a.forest(...p)<=1);
   assert.equal(a.biome(...p,4,'hot'),'volcanic');assert.equal(a.biome(...p,45,'cold'),'alpine');
  }
  assert.ok(biomes.size>=4,'each climate supports multiple biome regions');
 }
 assert.ok(regimes.size>=3,'planet climate varies across seeds');
});
