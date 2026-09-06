// Fixed camera poses and rendered comparisons. Visibility is measured against
// the actual terrain ray predicate; this is not an owner feel approval.
import{createRequire}from'node:module';import{resolve}from'node:path';import{mkdirSync,writeFileSync}from'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/visibility');mkdirSync(out,{recursive:true});
const reduced=process.argv.includes('--reduced-motion'),onlyTerrain=process.argv.find(x=>x.startsWith('--terrain='))?.slice(10);
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{for(const [terrain,seed]of [['varied',12345],['canyon',12345],['alpine',12345],['ocean',326532]]){
 if(onlyTerrain&&terrain!==onlyTerrain)continue;
 const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:reduced?'reduce':'no-preference'}),faults=[];page.on('pageerror',e=>faults.push(String(e)));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});});
 await page.goto(`http://127.0.0.1:8139/?map=ninetynine&terrain=${terrain}&seed=${seed}`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
 const result=await page.evaluate(async()=>{
  __qaFramesEnabled=false;const W=WH,rig=W.rig,{raycastTerrain}=await import('/js/world.js'),THREE=await import('/lib/three.module.min.js');document.getElementById('btn-begin').click();W.game.paused=true;rig.cancelFlight();rig.autoOrbit=0;rig.velLon=0;rig.velLat=0;
  const center=W.heartPos.clone().normalize(),records=[];rig.lon=Math.atan2(center.x,center.z);rig.lat=Math.asin(center.y);
  for(const distance of [rig.distMin,18,35])for(let yaw=0;yaw<8;yaw++){
   rig.viewYaw=yaw*Math.PI/4;rig.dist=distance;rig.targetDist=distance;for(let i=0;i<120;i++)rig.update(1/60);
   const target=center.clone().multiplyScalar(rig.focusRadius),direction=target.clone().sub(rig.camera.position).normalize(),hit=new THREE.Vector3(),length=target.distanceTo(rig.camera.position),found=raycastTerrain(rig.camera.position,direction,hit),gap=found?length-hit.distanceTo(rig.camera.position):0;
   records.push({distance,yaw:rig.viewYaw,gap,visible:gap<.4,lift:rig.visibilityLift||0,camera:rig.camera.position.toArray()});
  }
  const motion=[];
  if(typeof rig.visibilityLift==='number'){
    const pose=[...records].sort((a,b)=>b.lift-a.lift)[0];
    for(const fps of [30,60,120]){
      rig.dist=rig.targetDist=pose.distance;rig.viewYaw=pose.yaw;rig.visibilityLift=rig.visibilityTarget=rig.visibilityVelocity=0;rig._visibilityKey='';
      let monotonic=true,previous=0;
      for(let i=0;i<fps/2;i++){rig.update(1/fps);if(rig.visibilityLift<previous-1e-8)monotonic=false;previous=rig.visibilityLift;}
      motion.push({fps,lift:rig.visibilityLift,target:rig.visibilityTarget,monotonic,camera:rig.camera.position.toArray()});
    }
    const held=rig.visibilityLift;rig.dragFocusRadius=rig.focusRadius;rig.dragging=true;for(let i=0;i<30;i++)rig.update(1/60);rig.dragging=false;rig.dragFocusRadius=null;
    motion.push({kind:'drag-framing-frozen',pass:held===rig.visibilityLift});
    let probes=0;const original=rig.surfaceProbe;rig.surfaceProbe=(...args)=>{probes++;return original(...args);};for(let i=0;i<120;i++)rig.update(1/60);rig.surfaceProbe=original;
    motion.push({kind:'stationary-probe-cache',probes,pass:probes===0});
  }
  rig.viewYaw=0;rig.dist=35;rig.targetDist=35;for(let i=0;i<120;i++)rig.update(1/60);W.step(0);
  const rates=motion.filter(x=>x.fps),motionPass=!rates.length||rates.every(x=>x.monotonic&&Math.abs(x.lift-rates[0].lift)<1e-5)&&motion.filter(x=>x.kind).every(x=>x.pass);
  return{terrain:W.CONFIG.terrainKey,seed:W.CONFIG.seed,records,motion,motionPass,visible:records.filter(x=>x.visible).length,total:records.length};
 });
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('title-overlay')).opacity==='0',{},{polling:50});await page.screenshot({path:resolve(out,`${terrain}.png`)});result.faults=faults;results.push(result);console.log(JSON.stringify({terrain,visible:result.visible,total:result.total,faults}));await page.close();
}}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Fixed heart-focus camera poses with actual terrain-ray occlusion',reducedMotion:reduced,results},null,2)+'\n');await browser.close();}
if(results.some(r=>r.visible!==r.total||!r.motionPass||r.faults.length))process.exitCode=1;
