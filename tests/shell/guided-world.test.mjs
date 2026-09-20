import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){return s==='three'?{url:new URL('../../lib/three.module.min.js',import.meta.url).href,shortCircuit:true}:n(s,c);}});
globalThis.location={search:'?map=ninetynine&campaign=0&seed=12345&planet=temperate',pathname:'/'};
globalThis.matchMedia=()=>({matches:false});
const W=await import('../../js/world.js'),{CONFIG,TERRAIN_PROFILES}=await import('../../js/config.js'),{planetEnvironment}=await import('../../js/run/planet-environments.js'),T=await import('../../lib/three.module.min.js');
const points=Array.from({length:1600},(_,i)=>{const y=1-(i+.5)/800,a=i*2.399963229728653,r=Math.sqrt(1-y*y);return [r*Math.cos(a),y,r*Math.sin(a)];});
const setup=(theme='temperate',terrain='varied',version=1)=>{
  const environment=planetEnvironment(12345,theme);
  Object.assign(CONFIG,{seed:12345,terrainVersion:version,planetRadius:environment.radius,environment,terrainKey:terrain,terrain:{...TERRAIN_PROFILES[terrain],ocean:TERRAIN_PROFILES[terrain].ocean+environment.oceanShift}});W.initTerrainField(12345);
};
test('Guided production field retains themed shores, low approaches and dry cuts',()=>{
  for(const [theme,terrain] of [['temperate','varied'],['earth','varied'],['arid','canyon'],['io','varied']]){
    setup(theme,terrain,0);const old=points.map(p=>({h:W.terrainHeight(...p,false),wet:W.oceanAt(...p)}));
    setup(theme,terrain);assert.ok(W.GUIDED);
    let changed=0,dry=0;
    points.forEach((p,i)=>{const h=W.terrainHeight(...p,false),r=old[i];assert.ok(Number.isFinite(h));assert.equal(W.oceanAt(...p),r.wet);
      if(Math.abs(r.h-.55)<1.25&&!W.GUIDED.landmarks.some(l=>p.reduce((a,x,k)=>a+x*l.dir[k],0)>l.limit))assert.equal(h,r.h);
      if(Math.abs(h-r.h)>.1)changed++;if(h< -3&&!r.wet)dry++;
    });
    assert.ok(changed>5,theme+' actually uses guided terrain');if(terrain==='canyon')assert.ok(dry>40,'dry canyons stay below sea level');
  }
});
test('An earthquake adds its predicted displacement without rebuilding the kit',()=>{
  setup();const kit=W.GUIDED,centre=new T.Vector3(...points[245]),axis=new T.Vector3(0,1,0).addScaledVector(centre,-centre.y).normalize(),heart=centre.clone().negate();
  const before=points.map(p=>W.terrainHeight(...p,false)),fault=W.createTerrainFault(centre,axis,heart);W.addTerrainFault(centre,axis,heart,fault);
  assert.equal(W.GUIDED,kit);
  points.forEach((p,i)=>assert.ok(Math.abs(W.terrainHeight(...p,false)-before[i]-W.terrainFaultDelta(fault,...p))<1e-10));
});
test('All Planet increases grid density; layered sky worlds retain their real island decks',()=>{
  setup('all');assert.equal(W.R,480);assert.ok(W.GUIDED.grid.quads.length>40000);
  for(const p of points)assert.ok(W.GUIDED.index.find(...p)>=0&&Number.isFinite(W.terrainHeight(...p,false)));
  setup('skyarchipelago','sky');assert.equal(W.GUIDED,null);assert.ok(W.FEATURES.surfaces.length>0);
  const island=W.FEATURES.surfaces.find(s=>s.key==='floating-slab');assert.ok(W.navigationHeight(...island.dir,false)>20);
});
test('Version zero remains deterministic and classic maps do not use the kit',()=>{
  setup('earth','varied',0);const before=points.map(p=>W.terrainHeight(...p,false));setup('earth','varied',1);setup('earth','varied',0);
  assert.deepEqual(points.map(p=>W.terrainHeight(...p,false)),before);assert.equal(W.GUIDED,null);
  CONFIG.terrain=null;CONFIG.environment=null;W.initTerrainField(12345);assert.equal(W.GUIDED,null);assert.ok(Number.isFinite(W.terrainHeight(0,1,0)));
});
test('Solar relief is immutable through fine queries and terrain cache invalidation',()=>{
  setup('earth','varied',2);
  const sample=points.slice(0,96),before=sample.map(p=>[W.terrainHeight(...p,false),W.terrainHeight(...p,true)]);
  const centre=new T.Vector3(...sample[0]),axis=new T.Vector3(0,1,0).cross(centre).normalize();
  for(let i=0;i<3;i++){
    // Zero displacement invalidates the dynamic height cache but must not grow
    // the Solar sampler's memoized relief, including the fine/coarse pair.
    const fault=W.createTerrainFault(centre,axis,centre.clone().negate());fault.strength=0;
    W.addTerrainFault(centre,axis,centre.clone().negate(),fault);
    assert.deepEqual(sample.map(p=>[W.terrainHeight(...p,false),W.terrainHeight(...p,true)]),before);
  }
  assert.ok(before.every(pair=>pair.every(h=>Number.isFinite(h)&&Math.abs(h)<150)));
});
