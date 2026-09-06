// Sustained browser performance fixture. Gold, territory, enemies and heart
// health are injected only to hold a repeatable load, never as natural QA.
import{createRequire}from'node:module';import{resolve}from'node:path';import{mkdirSync,writeFileSync}from'node:fs';import{cpus,totalmem,platform,release}from'node:os';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/performance');mkdirSync(out,{recursive:true});
const orbit=process.argv.includes('--orbit');
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1}),faults=[];
page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
const report={scope:'60-second real-time stress fixture, not natural campaign play',cameraMotion:orbit?'Continuous orbit at 0.15 radians per second':'Stationary',hardware:{cpu:cpus()[0].model,logicalCpus:cpus().length,memoryGiB:totalmem()/2**30,os:platform(),release:release()},browser:browser.version(),viewport:{width:1920,height:1080,dpr:1},faults};
try{
 const start=Date.now();await page.goto('http://127.0.0.1:8139/?map=ninetynine&seed=12345&terrain=varied',{waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});report.bootMs=Date.now()-start;
 report.setup=await page.evaluate(async()=>{
   const W=WH,{surfacePoint,R}=await import('/js/world.js'),THREE=await import('/lib/three.module.min.js');document.getElementById('btn-begin').click();
   W.game.gold=1e7;W.game.lives=1e7;for(let i=0;i<5;i++)document.getElementById('heart-panel').click();W.waves.state='idle';W.waves.begin=()=>{};W.game.hand=null;
   const center=W.nav.fieldCenter.clone(),helper=new THREE.Vector3(0,1,0);if(Math.abs(helper.dot(center))>.9)helper.set(1,0,0);const side=new THREE.Vector3().crossVectors(center,helper).normalize(),forward=new THREE.Vector3().crossVectors(center,side).normalize();
   const failures={};
   for(let radius=5;radius<60&&W.towers.towers.length<30;radius+=3)for(let i=0;i<72&&W.towers.towers.length<30;i++){
     const angle=i*Math.PI/36,dir=center.clone().addScaledVector(side,Math.cos(angle)*radius/R).addScaledVector(forward,Math.sin(angle)*radius/R).normalize(),type=['bolt','tesla','mortar','cryo','helios','warden'][W.towers.towers.length%6];
     W.game.buildType=type;W.game.cursorDir.copy(dir);surfacePoint(dir,W.game.cursorPos);W.game.cursorValid=true;const valid=W.game._validate(W.TOWER_TYPES[type]);if(!valid.ok){failures[valid.reason]=(failures[valid.reason]||0)+1;continue;}W.game._tryPlace();
   }W.game.cancelBuild();W.game.select(null);W.rig.cancelFlight();W.rig.dist=35;W.rig.targetDist=35;
   window.__qaReplenish=()=>{for(let i=0;W.enemies.active.filter(e=>!e.dead).length<100&&i<100;i++)W.enemies.spawn(['husk','mite','wisp','aegis'][i%4],W.nav.portalNodes[i%5],4);};__qaReplenish();window.__qaReplenishTimer=setInterval(__qaReplenish,250);
   const gl=W.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
   return{seed:W.CONFIG.seed,terrain:W.CONFIG.terrainKey,towers:W.towers.towers.length,enemies:W.enemies.active.length,failures,gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
 });
 await page.waitForTimeout(10000);
 await page.evaluate(orbit=>{window.__qaFrameDeltas=[];window.__qaLoads=[];window.__qaMeasure=true;let last=performance.now();function sample(now){if(!__qaMeasure)return;__qaFrameDeltas.push(now-last);if(orbit)WH.rig.viewYaw+=(now-last)/1000*.15;last=now;if(__qaFrameDeltas.length%30===0)__qaLoads.push({ms:now,enemies:WH.enemies.active.filter(e=>!e.dead).length,towers:WH.towers.towers.length,drawCalls:WH.drawCalls(),triangles:WH.tris(),workMs:WH.workMs(),memory:{...WH.renderer.info.memory},heap:performance.memory?.usedJSHeapSize});requestAnimationFrame(sample);}requestAnimationFrame(sample);},orbit);
 await page.waitForTimeout(30000);await page.screenshot({path:resolve(out,'stress-30s.png')});await page.waitForTimeout(30000);
 report.measurement=await page.evaluate(()=>{__qaMeasure=false;clearInterval(__qaReplenishTimer);const frames=__qaFrameDeltas.filter(x=>x>0).sort((a,b)=>a-b),percentile=p=>frames[Math.min(frames.length-1,Math.floor(frames.length*p))];return{frames:frames.length,frameMs:{p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:frames.at(-1)},medianFps:1000/percentile(.5),onePercentLowFps:1000/percentile(.99),loads:__qaLoads,quality:{bloomLevels:WH.post.levels,pixelRatio:WH.renderer.getPixelRatio(),shadowSize:WH.renderer.shadowMap.enabled},heap:performance.memory?.usedJSHeapSize};});
 await page.screenshot({path:resolve(out,'stress-60s.png')});
 const before=await page.evaluate(()=>{WH.game.paused=true;return WH.enemies.time;});await page.waitForTimeout(2000);const paused=await page.evaluate(()=>WH.enemies.time);await page.evaluate(()=>WH.game.paused=false);await page.waitForTimeout(2000);const resumed=await page.evaluate(()=>WH.enemies.time);
 report.pauseRecovery={before,paused,resumed,pass:paused===before&&resumed>paused};report.budgetPassed=report.setup.towers===30&&report.measurement.medianFps>=60&&report.measurement.onePercentLowFps>=30&&!faults.length;
}catch(error){report.error=String(error);process.exitCode=1;}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,measurement:report.measurement?{...report.measurement,loads:report.measurement.loads.length}:null}));await browser.close();}
if(!report.budgetPassed)process.exitCode=1;
