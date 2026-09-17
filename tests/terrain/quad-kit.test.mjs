import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createQuadPatch,convex,positionAt,inverseQuad,terraceHeight} from '../../js/terrain/quad-kit.js';
import {createExperiment} from '../../js/terrain/kit-experiment.js';

test('Irregular patches keep manifold seams, convex cells and deterministic topology across seeds',()=>{
  for(let seed=0;seed<64;seed++){
    const p=createQuadPatch(seed),again=createQuadPatch(seed);
    assert.deepEqual(p.points,again.points);assert.deepEqual(p.quads,again.quads);
    assert.equal(p.points.length-p.edgeCounts.length+p.quads.length,1,'disk Euler characteristic');
    assert.ok(p.edgeCounts.every(([,n])=>n===1||n===2));
    assert.ok(p.quads.every(f=>new Set(f).size===4&&convex(f,p.points)));
    for(const face of p.quads){const pos=positionAt(p.points,face,.31,.73),uv=inverseQuad(p.points,face,...pos);assert.ok(uv&&Math.abs(uv[0]-.31)<1e-6&&Math.abs(uv[1]-.73)<1e-6);}
  }
  assert.notDeepEqual(createQuadPatch(7).quads,createQuadPatch(8).quads);
});

test('All 16 dual masks preserve exact endpoints and compatible edges despite independent interiors',()=>{
  for(let mask=0;mask<16;mask++){
    const levels=[0,1,2,3].map(i=>(mask>>i)&1);
    [[0,0],[1,0],[1,1],[0,1]].forEach(([u,v],i)=>assert.equal(terraceHeight(levels,u,v),levels[i]*8));
    for(let i=0;i<=20;i++){
      const t=i/20;assert.equal(terraceHeight(levels,t,0),terraceHeight([levels[0],levels[1],-4,9],t,0));
      assert.ok(Math.abs(terraceHeight(levels,t,0)-terraceHeight([levels[1],levels[0],7,-3],1-t,0))<1e-12);
    }
  }
});

test('Guided terrain validates actual triangle routes, rejects inaccessible stamps and keeps source control intact',()=>{
  let accepted=0,rejected=0;
  for(const preset of ['varied','badlands','canyon'])for(const seed of [0,12345,44021,9137,4206018157,4294967295]){
    const e=createExperiment(seed,preset),[a,b]=e.surfaces;
    assert.equal(a.indices.length,b.indices.length,'same mesh budget');
    assert.equal(b.metrics.reachable,3,`${preset}/${seed}: all candidate approaches`);
    assert.equal(new Set(e.starts.map(p=>p.join(','))).size,3);
    for(const s of e.surfaces){
      assert.ok(s.positions.every(Number.isFinite));assert.ok(s.metrics.seamError<1e-8);
      for(let z=-60;z<=60;z+=6)for(let x=-60;x<=60;x+=6)if(Math.hypot(x,z)<65)assert.notEqual(s.heightAt(x,z),null,'no false collision holes inside the rendered patch');
      for(const path of s.nav.routes)for(let i=1;i<path.length;i++)for(const t of [.25,.5,.75]){
        const p=path[i].map((v,k)=>v*t+path[i-1][k]*(1-t));assert.ok(s.gradeAt(...p)<=.700001,'walkable slope and body clearance');
      }
    }
    if(e.overlook){accepted++;assert.ok(b.nav.find(e.heart,e.overlook.center).length,'fitted overlook actually reachable');}
    if(e.overlookRejected)rejected++;
  }
  assert.ok(accepted>0);assert.ok(rejected>0,'retains the failed-fit rejection path');
});

test('Generated geometry and objective choices replay deterministically without touching gameplay state',()=>{
  const a=createExperiment(12345),b=createExperiment(12345);
  const fingerprint=e=>createHash('sha256').update(JSON.stringify({surfaces:e.surfaces.map(s=>[s.positions,s.indices,s.metrics]),heart:e.heart,starts:e.starts,overlook:e.overlook})).digest('hex');
  assert.equal(fingerprint(a),fingerprint(b));
  assert.throws(()=>createExperiment(NaN));assert.throws(()=>createExperiment(1,'unknown'));
});
