import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFormationField} from '../../js/terrain/formations.js';
import {TERRAIN_PACKS} from '../../js/run/world-catalogue.js';
import {mulberry32} from '../../js/noise.js';
import {SamplePoints,TerrainSamplePool} from '../../js/terrain-sample-pool.js';
import {resolveSpecifier} from '../../tools/build.mjs';

test('incision field upper bound covers actual samples; unknown families disable it',()=>{
  for(const seed of [9137,17056,24975]){
    const field=createFormationField(seed,240,TERRAIN_PACKS.canyon,'canyon'),random=mulberry32(seed);
    assert.ok(Number.isFinite(field.upperBound));
    for(let i=0;i<12000;i++){
      const y=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-y*y);
      assert.ok(field.height(r*Math.cos(a),y,r*Math.sin(a))<=field.upperBound+1e-10);
    }
  }
  assert.equal(createFormationField(12345,240,TERRAIN_PACKS.varied,'varied').upperBound,Infinity);
});

test('parallel samples preserve double coordinates, global indices and uneven partition order',async()=>{
  const previousWorker=globalThis.Worker,previousLocation=globalThis.location,instances=[];
  globalThis.location={search:''};
  globalThis.Worker=class{
    constructor(){instances.push(this);}
    postMessage({points,batch}){const samples=new Float64Array(points.length/2);for(let i=0,j=0;i<points.length;i+=4,j+=2){samples[j]=points[i];samples[j+1]=points[i+1];}setTimeout(()=>this.onmessage({data:{batch,samples}}),instances.indexOf(this)?0:10);}
    terminate(){this.terminated=true;}
  };
  const pool=new TerrainSamplePool(2);
  try{
    const points=new SamplePoints(3);points.push(4,.10000000000000003,0,0);points.push(1,.1,0,0);points.push(7,-.99,0,0);
    const result=await pool.sample(points.finish(),{n:8,width:1});
    assert.equal(result[4],.10000000000000003);assert.equal(result[1],.1);assert.equal(result[7],-.99);assert.ok(Number.isNaN(result[0]));
    assert.equal(pool.metrics.points,3);assert.equal(pool.timers.size,0);
  }finally{pool.dispose();globalThis.Worker=previousWorker;globalThis.location=previousLocation;}
  assert.ok(instances.every(w=>w.terminated));
});

test('worker failure releases all workers and timers and returns the serial fallback',async()=>{
  const previousWorker=globalThis.Worker,previousLocation=globalThis.location,instances=[];globalThis.location={search:''};
  globalThis.Worker=class{
    constructor(){instances.push(this);}
    postMessage({batch}){queueMicrotask(()=>this.onmessage({data:{batch,error:'injected worker failure'}}));}
    terminate(){this.terminated=true;}
  };
  const pool=new TerrainSamplePool(2);
  try{assert.equal(await pool.sample(new Float64Array([0,0,0,1]),{n:1,width:1}),null);assert.equal(pool.timers.size,0);assert.ok(pool.failed);assert.ok(instances.every(w=>w.terminated));assert.equal(await pool.sample(new Float64Array(0),{n:0}),null);}
  finally{pool.dispose();globalThis.Worker=previousWorker;globalThis.location=previousLocation;}
});

test('worker-compatible vendored Three imports retain standalone bundle identity',()=>{
  assert.equal(resolveSpecifier('world','../lib/three.module.min.js'),'three');
  assert.equal(resolveSpecifier('terrain/features','../../lib/three.module.min.js'),'three');
});
import {floorCoverage} from '../../js/terrain/coverage.js';
import {surveyBattlefield} from '../../js/terrain/acceptance.js';
test('early coverage matches the full certificate for connected, disconnected and authored pit floors',()=>{
  for(const pit of [false,true])for(const linked of [false,true]){
    const nav={n:4,adjOff:new Int32Array([0,1,3,4,4]),adj:new Int32Array([1,0,2,1]),cost:new Float32Array([1,1,linked?1:Infinity,1]),floorWalk:new Uint8Array([1,1,1,1]),block:new Uint8Array(4),dirs:new Float32Array([1,0,0,1,0,0,1,0,0,1,0,0]),baseHeight:new Float32Array([1,1,-3,-3]),waterDepth:new Float32Array(4),march:{floorReach:new Uint8Array([1,1,linked?1:0,0])}};
    const field={inspect:()=>({type:pit?'karst':'ravine',relief:2}),modules:[{type:'ravine',height:4}],settings:{},mix:'varied'};
    const quick=floorCoverage(nav,field,0),full=surveyBattlefield(nav,field,()=>0,240);
    for(const key of ['dry','connected','deep','deepConnected'])assert.equal(quick[key],full[key]);
    assert.equal(quick.possible,full.dry>0&&full.dryConnected>=.95&&(!full.deep||full.deepConnected/full.deep>=.95));
  }
});
