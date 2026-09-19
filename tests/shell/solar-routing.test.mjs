import {test} from 'node:test';import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){return s==='three'?{url:new URL('../../lib/three.module.min.js',import.meta.url).href,shortCircuit:true}:n(s,c)}});
globalThis.location={search:'?map=ninetynine&campaign=0&planet=earth',pathname:'/'};globalThis.matchMedia=()=>({matches:false});
const T=await import('../../lib/three.module.min.js'),world=await import('../../js/world.js'),{CONFIG}=await import('../../js/config.js'),{NavGraph}=await import('../../js/nav.js'),{planetEnvironment}=await import('../../js/run/planet-environments.js'),{TERRAIN_PACKS}=await import('../../js/run/world-catalogue.js'),{SOLAR_LANDMARKS,createSolarTactics}=await import('../../js/run/solar-tactics.js');
function setup(key,seed){CONFIG.environment=planetEnvironment(seed,key);CONFIG.seed=seed;CONFIG.planetRadius=CONFIG.environment.radius;CONFIG.terrainVersion=3;CONFIG.terrainKey='varied';CONFIG.terrain={...TERRAIN_PACKS.varied,ocean:TERRAIN_PACKS.varied.ocean+CONFIG.environment.oceanShift};world.initTerrainField(seed);}
const samples=()=>Array.from({length:240},(_,i)=>{const y=1-2*(i+.5)/240,r=Math.sqrt(1-y*y),a=i*2.39996323,x=r*Math.cos(a),z=r*Math.sin(a);return [world.terrainHeight(x,y,z,false),world.oceanAt(x,y,z)];});
test('Solar body geometry is stable across expedition seeds and retains local floor routes beside relief',t=>{
 for(const key of Object.keys(SOLAR_LANDMARKS)){
  setup(key,12345);const first=samples();setup(key,77291);assert.deepEqual(samples(),first,key+' geography drifted with the expedition seed');
  const centre=new T.Vector3(...createSolarTactics(key,CONFIG.planetRadius).sites[0].dir),nav=new NavGraph();nav._buildGraph(centre,.3,false,6);
  const seen=new Uint8Array(nav.n);let largest=0,raised=0;
  for(let i=0;i<nav.n;i++){
   if(nav.baseHeight[i]>nav.floorDatum+8)raised++;
   if(seen[i]||!nav.floorWalk[i]||nav.waterDepth[i]>0)continue;
   const queue=[i];seen[i]=1;
   for(let k=0;k<queue.length;k++){const a=queue[k];for(let e=nav.adjOff[a];e<nav.adjOff[a+1];e++){const b=nav.adj[e];if(!seen[b]&&nav.floorWalk[b]&&nav.waterDepth[b]===0&&Number.isFinite(nav.cost[e])){seen[b]=1;queue.push(b);}}}
   largest=Math.max(largest,queue.length);
  }
  assert.ok(largest>=20,`${key}: only ${largest} connected floor nodes`);assert.ok(raised>=3,`${key}: no meaningful relief beside routes`);
  t.diagnostic(`${key}: ${nav.n} sampled nodes, ${largest} connected floor nodes, ${raised} raised nodes`);
 }
});
