import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {formationSample} from '../../js/terrain/samples.js';
import {LANDFORM_RECIPES,landformSettings} from '../../js/terrain/recipes.js';
import {TERRAIN_PACKS,NEW_BIOMES,NEW_PLANET_THEMES} from '../../js/run/world-catalogue.js';
globalThis.location={search:'?map=ninetynine&campaign=0&planet=temperate',pathname:'/'};globalThis.matchMedia=()=>({matches:false});
registerHooks({resolve(s,c,n){return s==='three'?{url:new URL('../../lib/three.module.min.js',import.meta.url).href,shortCircuit:true}:n(s,c);}});
const T=await import('../../lib/three.module.min.js'),w=await import('../../js/world.js'),{CONFIG}=await import('../../js/config.js'),{AllyManager}=await import('../../js/allies.js'),{GeyserField}=await import('../../js/terrain/geysers.js');
function isolate(type){const sample=formationSample(type);CONFIG.terrain={...TERRAIN_PACKS.varied,range:90,canyon:38,ocean:-1,formations:{weights:Object.fromEntries(Object.keys(LANDFORM_RECIPES).map(k=>[k,k===type?1:0])),groups:sample.field.modules.map(m=>({id:m.id,disabled:m.id!==0}))}};CONFIG.terrainKey='varied';w.initTerrainField(771);return w.FEATURES;}
test('ten packs and twenty theme recipes reference valid distinct content',()=>{
 assert.equal(Object.keys(TERRAIN_PACKS).length,10);assert.equal(Object.keys(NEW_BIOMES).length,15);assert.equal(Object.keys(NEW_PLANET_THEMES).length,10);
 for(const pack of Object.values(TERRAIN_PACKS))for(const key of Object.keys(pack.weights))assert.ok(LANDFORM_RECIPES[key]);
 assert.deepEqual(Object.keys(TERRAIN_PACKS.alpine.weights).sort(),['range','spine']);
 for(const theme of Object.values(NEW_PLANET_THEMES)){assert.ok(TERRAIN_PACKS[theme.pack]);assert.ok(theme.coverage>0&&theme.coverage<=1);landformSettings('varied',{composition:theme});}
 assert.throws(()=>landformSettings('varied',{composition:{pack:'fake',coverage:1}}));assert.throws(()=>landformSettings('varied',{composition:{pack:'sky',coverage:NaN}}));
});
test('bridges, grotto roofs, floating islands, rock caps and logs share rendered collision surfaces',()=>{
 for(const type of ['valley','grotto','sky','pedestals','trunks']){
  const f=isolate(type),art=f.build();art.updateMatrixWorld(true);assert.ok(f.surfaces.length);
  for(const s of f.surfaces){const dir=new T.Vector3(...s.dir),floor=w.terrainHeight(...s.dir),top=f.support(s.dir,Infinity,floor);
   const ray=new T.Raycaster(dir.clone().multiplyScalar(w.R+top+30),dir.clone().negate());const hit=ray.intersectObject(art,true)[0];assert.ok(hit,type+' has an actual mesh');assert.ok(Math.abs(hit.point.length()-w.R-top)<.25,type+' mesh agrees with its landing surface');
   const manager=Object.create(AllyManager.prototype),unit={dir,height:floor,hop:top+.3-w.surfaceElevation(dir,floor),mountFlight:0,vertVel:-20,airT:1,mountOffset:0};
   manager._fall(unit,1/30);assert.equal(unit.airT,0,'fast falls land rather than tunnelling through the deck');assert.ok(Math.abs(unit.height-top)<.01);assert.equal(unit.hop,0);
   const bottom=s.bottom(0,0);if(bottom>floor+3){assert.ok(!f.intersects(s.dir,bottom-2,1.7));assert.ok(f.intersects(s.dir,bottom-.5,1.7),'the visible roof has a solid edge');
    unit.height=floor;unit.hop=bottom-2-w.surfaceElevation(dir,floor);unit.vertVel=20;unit.airT=1;
    manager._fall(unit,.03);assert.ok(w.surfaceElevation(dir,unit.height)+unit.hop+1.7<=bottom+.01,'jump is stopped by the underside '+JSON.stringify({type,bottom,head:w.surfaceElevation(dir,unit.height)+unit.hop+1.7,ground:floor,feet:unit.height+unit.hop}));
   }
  }
 }
});
test('geyser eruptions lift both teams once per cycle and settle without lifting high aircraft',()=>{
 const f=isolate('geyser'),vent=f.vents[0];assert.ok(vent);const manager=Object.create(AllyManager.prototype),unit={dir:vent.dir.clone(),height:w.terrainHeight(...vent.dir.toArray()),hop:0,mountFlight:0,vertVel:0,airT:0,mountOffset:0,active:true,type:{flying:false}};
 const enemy={...unit,dir:unit.dir.clone(),geyserLift:0,geyserVelocity:0},high={...unit,dir:unit.dir.clone(),mountFlight:15};
 const field=new GeyserField({}, {active:[unit,high]}, {active:[enemy]});field.time=(12-vent.phase)%12+.01;field.update(.01);
 assert.equal(field.launches,2);assert.ok(unit.vertVel>0&&enemy.geyserVelocity>0);assert.equal(high.airT,0);
 let max=0;for(let k=0;k<360;k++){field.update(1/60);if(unit.airT)manager._fall(unit,1/60);max=Math.max(max,unit.hop,enemy.geyserLift);}
 assert.equal(field.launches,2,'standing on the vent cannot retrigger the same burst');assert.ok(max>4);assert.equal(unit.hop,0);assert.equal(enemy.geyserLift,0);
 field.time+=6;field.update(.01);assert.equal(field.launches,4,'the next eruption is reusable');
});
