import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTerrainAtlas} from '../../js/terrain/atlas.js';
import {createFormationField} from '../../js/terrain/formations.js';
import {LANDFORM_RECIPES} from '../../js/terrain/recipes.js';

test('global habitat covers both hemispheres without routing through a separating mountain belt',async()=>{
 const heightAt=(x,y)=>Math.abs(y)<.11?25:.5;
 const atlas=await createTerrainAtlas({radius:40,heart:[0,1,0],heightAt,slopeAt:()=>0});
 assert.equal(atlas.stats.nodes,40962);assert.ok(atlas.stats.potential>20000);
 assert.ok(atlas.stats.connected>10000&&atlas.stats.disconnected>10000);
 let north=0,south=0;
 for(let i=0;i<atlas.verts.length;i++){
  const p=atlas.verts[i];if(atlas.habitat[i]){if(p[1]>.5)north++;if(p[1]<-.5)south++;}
  if(atlas.routes[i]){const q=atlas.verts[atlas.next[i]];assert.ok(p[1]>=.11&&q[1]>=.11);assert.ok(atlas.distance[i]>atlas.distance[atlas.next[i]]);}
 }
 assert.ok(north>4000&&south>4000,'unreachable habitat remains visible globally');
});

test('buttes, dunes, calderas and glacial troughs retain distinct relief and open region borders',()=>{
 const fingerprints=[];
 for(const type of ['buttes','caldera','dunes','valley']){
  const weights=Object.fromEntries(Object.keys(LANDFORM_RECIPES).map(k=>[k,k===type?1:0]));
  const f=createFormationField(91,240,{range:90,canyon:38},'varied',{weights});let high=0,floor=0,peak=0,subfloor=0;
  const heights=[];
  for(let i=0;i<8000;i++){
   const y=1-2*(i+.5)/8000,r=Math.sqrt(1-y*y),a=i*2.39996323,s=f.inspect(r*Math.cos(a),y,r*Math.sin(a));
   assert.ok(Number.isFinite(s.relief));if(s.relief<0){subfloor++;assert.ok(type==='valley'&&s.incision>=-s.relief&&s.relief>-15);}peak=Math.max(peak,s.relief);heights.push(Math.round(s.relief*100));
   if(s.edge<=s.valley){assert.equal(s.relief,0);floor++;}if(s.relief>2)high++;
  }
  assert.ok(floor>600&&high>80,`${type} needs open routes and visible raised terrain`);
  if(type==='valley')assert.ok(subfloor>30,'glacial troughs have a broad bed below the enclosing floor');
  if(type==='dunes')assert.ok(peak<10,'wind ridges stay at the small scale');else assert.ok(peak>15);
  fingerprints.push(heights.join(','));
 }
 assert.equal(new Set(fingerprints).size,4,'new families cannot share one renamed shape');
});
