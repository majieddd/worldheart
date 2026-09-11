import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFormationField} from '../../js/terrain/formations.js';
import {LANDFORM_RECIPES} from '../../js/terrain/recipes.js';
import {createEcology,BIOME_REGIMES} from '../../js/terrain/ecology.js';
import {isFloorTerrain,travelCost} from '../../js/traversal.js';
import {worldgenUrl,rememberWorld} from '../../js/worldgen.js';

test('negative dry passages keep real slope costs; flooded terrain retains swimming',()=>{
 assert.equal(isFloorTerrain(-12,1.1,0),false,'a dry canyon wall is not an ocean shortcut');
 assert.equal(isFloorTerrain(-12,.2,0),true);
 assert.equal(isFloorTerrain(-12,1.1,12),true);
 assert.equal(travelCost(-12,0,2,0,0),Infinity,'cannot climb twelve metres in two metres');
 assert.equal(travelCost(-12,-12,10,0,0),10);
 assert.ok(travelCost(-12,-12,10,12,12)>16);
 assert.ok(travelCost(-12,-11,4,0,0)>travelCost(-11,-12,4,0,0));
});

test('butte groups contain 7-12 separate pillar feet with measured traversal gaps',()=>{
 for(const seed of [771,12345,92741,2387895531])for(const spacing of [80,104,160]){
  const field=createFormationField(seed,240,{range:90,canyon:32},'varied',{spacing,weights:Object.fromEntries(Object.keys(LANDFORM_RECIPES).map(k=>[k,k==='buttes'?1:0]))});
  for(const m of field.modules){
   assert.ok(m.pillars.length>=7&&m.pillars.length<=12);
   for(const a of m.pillars)for(const b of m.pillars)if(a!==b)assert.ok(Math.hypot(a.u-b.u,a.v-b.v)-a.width-b.width>=5.49);
  }
 }
});

test('independent climate overrides expose new biomes and preserve cold tower ground',()=>{
 const counts={};
 for(const key of Object.keys(BIOME_REGIMES)){
  const eco=createEcology(12345,key);counts[key]={};
  for(let i=0;i<2500;i++){
   const y=1-2*(i+.5)/2500,r=Math.sqrt(1-y*y),a=i*2.39996323,p=[r*Math.cos(a),y,r*Math.sin(a)];
   const b=eco.biome(...p,.6,'neutral',false);counts[key][b]=(counts[key][b]||0)+1;
   assert.equal(eco.biome(...p,45,'cold',false),'alpine');
   assert.notEqual(eco.biome(...p,-8,'neutral',false),'ocean');
   assert.equal(eco.biome(...p,-8,'neutral',true),'ocean');
  }
 }
 assert.ok(counts.desert.desert>500);assert.ok(counts.jungle.jungle>500);assert.ok(counts.volcanic.volcanic>1000);
 assert.ok(counts.boreal.tundra>500);assert.ok(counts.wetland.wetland>500);
});

test('climate survives play/share/history without changing explicit terrain intent',()=>{
 const base='https://example.com/worldheart/v2/';
 for(const key of Object.keys(BIOME_REGIMES)){
  const url=new URL(worldgenUrl(base,12345,'varied',false,key));
  assert.equal(url.searchParams.get('biome')||'auto',key);assert.equal(url.searchParams.get('campaign'),'0');
 }
 assert.throws(()=>worldgenUrl(base,12345,'varied',true,'invalid'));
 let history=rememberWorld([],{seed:12345,terrain:'varied',biome:'desert'});
 history=rememberWorld(history,{seed:12345,terrain:'varied',biome:'jungle'});assert.equal(history.length,2);
 assert.equal(new URL(worldgenUrl(base,1,'classic',true,'desert')).searchParams.has('biome'),false);
});

test('winding canyon floors have dry exits instead of trapping a low isolated pocket',()=>{
 const weights=Object.fromEntries(Object.keys(LANDFORM_RECIPES).map(k=>[k,k==='gorge'?1:0]));
 for(const seed of [771,12345,92741]){
  const field=createFormationField(seed,240,{range:90,canyon:38},'varied',{weights});
  for(const m of field.modules.slice(0,3)){
   const size=65,step=m.extent*3/(size-1),heights=[],legal=[],adj=[-1,1,-size,size],seen=new Set(),queue=[];
   const at=(u,v)=>{const p=m.dir.map((n,k)=>n+(m.axis[k]*u+m.side[k]*v)/240),l=Math.hypot(...p);return field.height(...p.map(n=>n/l));};
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x-(size-1)/2)*step,v=(y-(size-1)/2)*step,h=at(u,v),i=y*size+x;
    heights[i]=h;legal[i]=isFloorTerrain(h,Math.hypot((at(u+.4,v)-h)/.4,(at(u,v+.4)-h)/.4),0);
    if(legal[i]&&(x===0||y===0||x===size-1||y===size-1)){seen.add(i);queue.push(i);}
   }
   for(let k=0;k<queue.length;k++)for(const delta of adj){const i=queue[k],j=i+delta;
    if(j<0||j>=heights.length||Math.abs(i%size-j%size)>1||!legal[j]||seen.has(j)||Math.abs(heights[i]-heights[j])/step>.62)continue;
    seen.add(j);queue.push(j);
   }
   const low=heights.map((h,i)=>({h,i})).filter(p=>p.h<-1&&legal[p.i]);
   assert.ok(low.length>10);assert.ok(low.filter(p=>seen.has(p.i)).length/low.length>.95,`seed ${seed} group ${m.id} has trapped floor`);
  }
 }
});
