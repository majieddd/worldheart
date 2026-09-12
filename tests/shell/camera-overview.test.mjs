import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
globalThis.location={search:'?map=ninetynine'};globalThis.matchMedia=()=>({matches:false});globalThis.addEventListener=()=>{};
registerHooks({resolve(spec,context,next){if(spec==='three')return{url:new URL('../../lib/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(spec,context);}});
const T=await import('../../lib/three.module.min.js'),{OrbitRig}=await import('../../js/camera.js'),{CONFIG,CAM_TUNE}=await import('../../js/config.js');
const {frontierTheta,HEART_RINGS}=await import('../../js/run/schedule.js'),saved={...CAM_TUNE};afterEach(()=>Object.assign(CAM_TUNE,saved));
function rig(){const r=new OrbitRig({clientHeight:720,addEventListener(){}});r.frontierTheta=.05;r.dist=r.targetDist=35;r.confine={center:new T.Vector3(0,0,1),maxAng:.051};return r;}
test('close base retains its original zoom while a global base can frame the planet',()=>{
 const r=rig(),start=r.defaultDist;let previous=0;
 for(const steps of HEART_RINGS){r.frontierTheta=frontierTheta(steps);r.confine.maxAng=r.frontierTheta*1.02;assert.ok(r.distMax>previous);previous=r.distMax;}
 assert.ok(r.distMax>CONFIG.planetRadius*2);
 r.frontierTheta=.05;r.confine.maxAng=.051;assert.equal(r.defaultDist,start);assert.equal(r.distMax,46.8);
});
test('viewport and polar focus cannot inflate the owner-approved zoom band',()=>{
 for(const lat of [0,Math.PI/2,-Math.PI/2])for(const aspect of [16/9,9/16,2.7])for(const offset of [0,1]){
  const r=rig(),c=new T.Vector3(0,Math.sin(lat),Math.cos(lat)),e=new T.Vector3(1,0,0);
  r.frontierTheta=.52;r.confine={center:c,maxAng:.5252};r.setAspect(aspect);
  const f=c.clone().multiplyScalar(Math.cos(.52*offset)).addScaledVector(e,Math.sin(.52*offset));
  r.lat=Math.asin(f.y);r.lon=Math.atan2(f.x,f.z);r.viewYaw=1.2;r.tiltOffset=.7;r.dist=r.targetDist=r.distMax;
  for(let j=0;j<120;j++)r.update(1/60);
  assert.ok(Math.abs(r.distMax-124.08)<1e-7);
  assert.ok(r.camera.matrixWorld.elements.every(Number.isFinite));
 }
});
test('narrow lenses keep the bounded zoom and player height tuning remains effective',()=>{
 const r=rig();CAM_TUNE.fovFar=14;r.setAspect(.3);r.frontierTheta=.52;r.confine.maxAng=.5252;
 r.dist=r.targetDist=r.distMax;for(let j=0;j<120;j++)r.update(1/60);
 assert.ok(r.camera.far>r.camera.position.length()+CONFIG.planetRadius);
 assert.ok(r.camera.matrixWorld.elements.every(Number.isFinite));
 const old=r.distMax;CAM_TUNE.maxAlt=.2;assert.ok(r.distMax<old&&r.distMax>r.distMin);
 CAM_TUNE.viewFar=48;r.tiltOffset=.4;assert.ok(Math.abs(r._viewAngle(1)-(48*Math.PI/180-.4))<1e-8);
});
