import {test} from 'node:test';import assert from 'node:assert/strict';
import {ACTIVE_FEATURES,DISASTERS,featureFits,environmentalHostility,compatibleDisasters,disasterExposure,disasterTargets} from '../../js/run/environment-catalogue.js';
import {planetEnvironment} from '../../js/run/planet-environments.js';
import {SOLAR_THEMES,solarGeography,createSolarSampler} from '../../js/run/solar-worlds.js';
import {worldgenUrl} from '../../js/worldgen.js';
import {LANDFORM_RECIPES} from '../../js/terrain/recipes.js';
import {createFormationField} from '../../js/terrain/formations.js';
import {TERRAIN_PACKS} from '../../js/run/world-catalogue.js';
const at=(key,lng,lat)=>{lng*=Math.PI/180;lat*=Math.PI/180;return solarGeography(key,Math.cos(lat)*Math.cos(lng),Math.sin(lat),Math.cos(lat)*Math.sin(lng));};
test('twelve local features have enforceable geology, ecology, water and slope constraints',()=>{
 assert.equal(Object.keys(ACTIVE_FEATURES).length,12);assert.ok(!LANDFORM_RECIPES.geyser&&!LANDFORM_RECIPES.trunks&&!LANDFORM_RECIPES.amphitheatre);
 for(const [key,f]of Object.entries(ACTIVE_FEATURES)){
  assert.ok(f.formations.every(k=>LANDFORM_RECIPES[k]));
  const context={formation:f.formations[0],biome:f.biomes[0],water:f.water,slope:f.slope};assert.ok(featureFits(key,context));
  for(const change of [{formation:'missing'},{biome:'missing'},{water:!f.water},{slope:f.slope+.001}])assert.equal(featureFits(key,{...context,...change}),false);
 }
});
test('hostility has an independent reproducible stream and both campaign limits rise',()=>{
 for(let seed=1;seed<=100;seed++){
  const a=environmentalHostility(seed,0),b=environmentalHostility(seed,98);assert.ok(a.floor<b.floor&&a.ceiling<b.ceiling&&a.value<b.value);assert.ok(a.value>=a.floor&&a.value<=a.ceiling);assert.ok(b.interval<a.interval&&b.scale>a.scale);assert.deepEqual(a,environmentalHostility(seed,0));
 }assert.equal(environmentalHostility(123,0,0).value,0);assert.equal(environmentalHostility(123,98,7).value,2);
});
test('weather respects airless, molten and ocean themes',()=>{
 assert.equal(Object.keys(DISASTERS).length,12);
 const lava=compatibleDisasters(planetEnvironment(771,'volcanic')),moon=compatibleDisasters(planetEnvironment(771,'moon')),sea=compatibleDisasters(planetEnvironment(771,'oceanic'));
 assert.ok(lava.includes('eruption')&&!lava.includes('tsunami')&&!lava.includes('hail'));assert.ok(moon.includes('meteor')&&moon.includes('solar')&&!moon.includes('tornado')&&!moon.includes('thunder'));assert.ok(sea.includes('tsunami'));
});
test('predicted strikes and coast-safe surge have finite bounded real damage footprints',()=>{
 for(const k of ['meteor','thunder','eruption']){const p=disasterTargets(k,0)[0];assert.equal(disasterExposure(k,p.u,p.v,0,.1),1);assert.equal(disasterExposure(k,100,0,0,.1),0);assert.equal(disasterExposure(k,p.u,p.v,0,2),0);}
 assert.equal(disasterExposure('tsunami',0,0,0,8),1);assert.equal(disasterExposure('tsunami',0,0,10,8),0);assert.equal(disasterExposure('tsunami',15,0,0,8),0);
});
test('sixteen astronomical worlds own geography rather than sharing a colour swap',()=>{
 assert.equal(Object.keys(SOLAR_THEMES).length,16);const fingerprints=new Set();
 for(const key of Object.keys(SOLAR_THEMES)){const e=planetEnvironment(771,key);assert.equal(e.star.name,'Sun');assert.equal(e.orbitAU,SOLAR_THEMES[key].orbit);const p=[];for(let lat=-75;lat<85;lat+=15)for(let lng=-170;lng<180;lng+=15){const g=at(key,lng,lat);assert.ok(Number.isFinite(g.land+g.relief+g.extra));p.push([g.biome,g.land.toFixed(2),g.extra.toFixed(2),g.tint]);}fingerprints.add(JSON.stringify(p));}
 assert.equal(fingerprints.size,16);assert.ok(at('earth',20,0).land>.3&&at('earth',-140,0).land<.3);assert.equal(at('earth',20,-80).biome,'tundra');assert.equal(at('jupiter',-50,-22).biome,'stormcloud');assert.equal(at('pluto',100,12).biome,'nitrogen');assert.ok(at('mars',-65,-12).extra<-10);
});
test('All Planet reserves the entire formation vocabulary in ten oversized geological provinces',()=>{
 const e=planetEnvironment(771,'all');assert.equal(e.radius,480);const field=createFormationField(771,e.radius,TERRAIN_PACKS.varied,'varied',{composition:e});assert.equal(new Set(field.modules.map(m=>m.type)).size,Object.keys(LANDFORM_RECIPES).length);assert.equal(new Set(field.modules.map(m=>m.pack)).size,10);
});
test('geography caching is independent of query order and shared links retain hostility',()=>{
 const a=createSolarSampler('earth'),b=createSolarSampler('earth'),p=[.65534,.3,.69235],q=p.map(x=>x+1e-8);
 a(...q);const expected=b(...p);assert.deepEqual(a(...p),expected);b(...q);assert.deepEqual(b(...p),expected);
 const url=new URL(worldgenUrl('https://example.com/v2/?hostility=1.2',77,'varied',false,'auto','moon'));assert.equal(url.searchParams.get('hostility'),'1.2');assert.equal(url.searchParams.get('worldgen'),null);
});
