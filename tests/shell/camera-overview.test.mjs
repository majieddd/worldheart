import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
globalThis.location={search:'?map=ninetynine'};globalThis.matchMedia=()=>({matches:false});globalThis.addEventListener=()=>{};
registerHooks({resolve(spec,context,next){if(spec==='three')return{url:new URL('../../lib/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(spec,context);}});
const T=await import('../../lib/three.module.min.js'),{OrbitRig}=await import('../../js/camera.js'),{CONFIG,CAM_TUNE}=await import('../../js/config.js');
const {frontierTheta,HEART_RINGS}=await import('../../js/run/schedule.js'),saved={...CAM_TUNE};afterEach(()=>Object.assign(CAM_TUNE,saved));
function rig(){const r=new OrbitRig({clientHeight:720,addEventListener(){}});r.frontierTheta=.05;r.dist=r.targetDist=35;r.frontierRelief=0;r.confine={center:new T.Vector3(0,0,1),maxAng:.051};return r;}
test('overview grows through all six base levels and preserves the starting altitude',()=>{
 const r=rig(),start=r.defaultDist;let previous=0;
 for(const steps of HEART_RINGS){r.frontierTheta=frontierTheta(steps);r.confine.maxAng=r.frontierTheta*1.02;assert.ok(r.distMax>previous);previous=r.distMax;}
 r.frontierTheta=.05;r.confine.maxAng=.051;r.frontierRelief=100;assert.equal(r.defaultDist,start);
});
test('overview frames terrain and both base rims from heart or edge at polar and equatorial latitudes',()=>{
 for(const lat of [0,Math.PI/2,-Math.PI/2])for(const aspect of [16/9,9/16,2.7])for(const offset of [0,1]){
  const r=rig(),c=new T.Vector3(0,Math.sin(lat),Math.cos(lat)),e=new T.Vector3(1,0,0),n=new T.Vector3().crossVectors(c,e);
  r.frontierTheta=.52;r.frontierRelief=100;r.confine={center:c,maxAng:.5252};r.setAspect(aspect);
  const f=c.clone().multiplyScalar(Math.cos(.52*offset)).addScaledVector(e,Math.sin(.52*offset));
  r.lat=Math.asin(f.y);r.lon=Math.atan2(f.x,f.z);r.viewYaw=1.2;r.tiltOffset=.7;r.dist=r.targetDist=r.distMax;
  for(let j=0;j<120;j++)r.update(1/60);
  for(const height of [0,100])for(let i=0;i<96;i++){
   const a=i*Math.PI/48,d=c.clone().multiplyScalar(Math.cos(.52)).addScaledVector(e,Math.sin(.52)*Math.cos(a)).addScaledVector(n,Math.sin(.52)*Math.sin(a));
   const p=d.clone().multiplyScalar(CONFIG.planetRadius+height).project(r.camera);
   assert.ok(Math.max(Math.abs(p.x),Math.abs(p.y))<.94&&p.z<1&&p.z> -1);
   assert.ok(r.camera.position.dot(d)>CONFIG.planetRadius);
  }
 }
});
test('narrow lenses and portrait views retain far-plane clearance at maximum zoom',()=>{
 const r=rig();CAM_TUNE.fovFar=14;r.setAspect(.3);r.frontierTheta=.52;r.frontierRelief=140;r.confine.maxAng=.5252;
 r.dist=r.targetDist=r.distMax;for(let j=0;j<120;j++)r.update(1/60);
 assert.ok(r.camera.far>r.camera.position.length()+CONFIG.planetRadius);
 assert.ok(r.camera.matrixWorld.elements.every(Number.isFinite));
});
