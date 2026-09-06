// Sustained browser performance fixture. Gold, territory, enemies and heart
// health are injected only to hold a repeatable load, never as natural QA.
import{createRequire}from'node:module';import{resolve}from'node:path';import{mkdirSync,writeFileSync}from'node:fs';import{cpus,totalmem,platform,release}from'node:os';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/performance');mkdirSync(out,{recursive:true});
const orbit=process.argv.includes('--orbit');
const profiling=process.argv.includes('--profile');
const fullUploads=process.argv.includes('--full-uploads');
const seconds=Number(process.argv.find(x=>x.startsWith('--seconds='))?.split('=')[1]||60);
const cpuRate=Number(process.argv.find(x=>x.startsWith('--cpu-rate='))?.split('=')[1]||1);
if(!Number.isFinite(seconds)||seconds<60||seconds>1800||!Number.isFinite(cpuRate)||cpuRate<1||cpuRate>8)throw Error('Invalid duration or CPU throttling');
const viewport=process.argv.includes('--compact')?{width:1280,height:720}:{width:1920,height:1080};
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport,deviceScaleFactor:1}),faults=[];
page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
const report={scope:`${seconds}-second real-time stress fixture, not natural campaign play`,cpuRate,cpuScope:cpuRate>1?'DevTools CPU slowdown on this GPU, not a lower-end hardware measurement':'Native speed',cameraMotion:orbit?'Continuous orbit at 0.15 radians per second':'Stationary',hardware:{cpu:cpus()[0].model,logicalCpus:cpus().length,memoryGiB:totalmem()/2**30,os:platform(),release:release()},browser:browser.version(),viewport:{...viewport,dpr:1},faults};
try{
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpuRate});
 const start=Date.now();await page.goto(`${process.env.WH_BASE_URL||'http://127.0.0.1:8139'}/?map=ninetynine&seed=12345&terrain=varied`,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});report.bootMs=Date.now()-start;
 report.uploadPolicy=fullUploads?'Full-buffer ablation; ignores live-prefix ranges':'Runtime default';
 report.setup=await page.evaluate(async fullUploads=>{
   const W=WH,{surfacePoint,R}=await import('/js/world.js'),THREE=await import('/lib/three.module.min.js');document.getElementById('btn-begin').click();
   if(fullUploads)THREE.BufferAttribute.prototype.addUpdateRange=function(){};
   W.game.gold=1e7;for(let i=0;i<5;i++)document.getElementById('heart-panel').click();W.waves.state='idle';W.waves.update=()=>{};W.game.hand=null;
   // Upgrade application re-syncs the heart from run rewards. Inject its
   // stress-only health AFTER those legitimate placement-cap upgrades.
   W.game.lives=W.game.maxLives=1e7;
   // A commander death ends the assault even with an immortal heart. Hold
   // both fixture health pools and stop only the natural wave director;
   // movement, combat, effects and rendering must keep running throughout.
   for(const a of W.allies.active)if(a.type.commander)a.hp=a.hpMax=1e7;
   const center=W.nav.fieldCenter.clone(),helper=new THREE.Vector3(0,1,0);if(Math.abs(helper.dot(center))>.9)helper.set(1,0,0);const side=new THREE.Vector3().crossVectors(center,helper).normalize(),forward=new THREE.Vector3().crossVectors(center,side).normalize();
   const failures={};
   for(let radius=5;radius<60&&W.towers.towers.length<30;radius+=3)for(let i=0;i<72&&W.towers.towers.length<30;i++){
     const angle=i*Math.PI/36,dir=center.clone().addScaledVector(side,Math.cos(angle)*radius/R).addScaledVector(forward,Math.sin(angle)*radius/R).normalize(),type=['bolt','tesla','mortar','cryo','helios','warden'][W.towers.towers.length%6];
     W.game.buildType=type;W.game.cursorDir.copy(dir);surfacePoint(dir,W.game.cursorPos);W.game.cursorValid=true;const valid=W.game._validate(W.TOWER_TYPES[type]);if(!valid.ok){failures[valid.reason]=(failures[valid.reason]||0)+1;continue;}W.game._tryPlace();
   }W.game.cancelBuild();W.game.select(null);W.rig.cancelFlight();W.rig.dist=35;W.rig.targetDist=35;
   window.__qaReplenish=()=>{for(let i=0;W.enemies.active.filter(e=>!e.dead).length<100&&i<100;i++)W.enemies.spawn(['husk','mite','wisp','aegis'][i%4],W.nav.portalNodes[i%5],4);};__qaReplenish();window.__qaReplenishTimer=setInterval(__qaReplenish,250);
   const gl=W.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
   return{seed:W.CONFIG.seed,terrain:W.CONFIG.terrainKey,towers:W.towers.towers.length,enemies:W.enemies.active.length,heart:W.game.lives,commander:W.allies.active.filter(a=>a.type.commander).map(a=>a.hp),failures,gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
 },fullUploads);
 await page.waitForTimeout(10000);
 if(profiling){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
 await page.evaluate(orbit=>{window.__qaFrameDeltas=[];window.__qaLoads=[];window.__qaMeasure=true;let last=performance.now();function sample(now){if(!__qaMeasure)return;__qaFrameDeltas.push(now-last);if(orbit)WH.rig.viewYaw+=(now-last)/1000*.15;last=now;if(__qaFrameDeltas.length%30===0)__qaLoads.push({ms:now,simTime:WH.enemies.time,state:WH.game.state,paused:WH.game.paused,enemies:WH.enemies.active.filter(e=>!e.dead).length,towers:WH.towers.towers.length,drawCalls:WH.drawCalls(),triangles:WH.tris(),workMs:WH.workMs(),memory:{...WH.renderer.info.memory},heap:performance.memory?.usedJSHeapSize});requestAnimationFrame(sample);}requestAnimationFrame(sample);},orbit);
 for(let elapsed=0;elapsed<seconds;elapsed+=30){
   await page.waitForTimeout(Math.min(30,seconds-elapsed)*1000);
   const snapshot=await page.evaluate(()=>({frames:__qaFrameDeltas.length,enemies:WH.enemies.active.filter(e=>!e.dead).length,towers:WH.towers.towers.length,loot:WH.mode99.loot.entries.size,memory:{...WH.renderer.info.memory}}));
   console.log(JSON.stringify({elapsed:Math.min(elapsed+30,seconds),...snapshot}));
   if(elapsed===0||elapsed+30>=seconds)await page.screenshot({path:resolve(out,`stress-${Math.min(elapsed+30,seconds)}s.png`)});
 }
 report.measurement=await page.evaluate(()=>{__qaMeasure=false;clearInterval(__qaReplenishTimer);const frames=__qaFrameDeltas.filter(x=>x>0).sort((a,b)=>a-b),percentile=p=>frames[Math.min(frames.length-1,Math.floor(frames.length*p))];return{frames:frames.length,frameMs:{p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:frames.at(-1)},medianFps:1000/percentile(.5),onePercentLowFps:1000/percentile(.99),loads:__qaLoads,quality:{bloomLevels:WH.post.levels,pixelRatio:WH.renderer.getPixelRatio(),shadowSize:WH.renderer.shadowMap.enabled},heap:performance.memory?.usedJSHeapSize};});
 if(profiling){
   const {profile}=await cdp.send('Profiler.stop');writeFileSync(resolve(out,'cpu.cpuprofile'),JSON.stringify(profile));
   const nodes=new Map(profile.nodes.map(n=>[n.id,n])),time=new Map();
   for(let i=0;i<profile.samples.length;i++)time.set(profile.samples[i],(time.get(profile.samples[i])||0)+profile.timeDeltas[i]);
   report.cpuProfile=[...time].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([id,microseconds])=>({selfMs:microseconds/1000,...nodes.get(id).callFrame}));
   report.profileScope='Sampling profiler adds overhead; use for diagnosis, not final frame-budget acceptance';
 }
 const before=await page.evaluate(()=>{WH.game.paused=true;return WH.enemies.time;});await page.waitForTimeout(2000);const paused=await page.evaluate(()=>WH.enemies.time);await page.evaluate(()=>WH.game.paused=false);await page.waitForTimeout(2000);const resumed=await page.evaluate(()=>WH.enemies.time);
 report.pauseRecovery={before,paused,resumed,pass:paused===before&&resumed>paused};
 report.sustainedSimulation=report.measurement.loads.every((x,i,a)=>x.state==='playing'&&!x.paused&&(i===0||x.simTime>a[i-1].simTime));
 report.budgetPassed=report.sustainedSimulation&&report.pauseRecovery.pass&&report.setup.towers===30&&report.measurement.medianFps>=60&&report.measurement.onePercentLowFps>=30&&!faults.length;
 const first=report.measurement.loads[0],last=report.measurement.loads.at(-1);
 report.resourceChange={geometryDelta:last.memory.geometries-first.memory.geometries,textureDelta:last.memory.textures-first.memory.textures,heapDelta:last.heap-first.heap,explanation:'Includes retained stress loot and lazily built equipment appearances; growth alone is not a leak verdict'};
}catch(error){report.error=String(error);process.exitCode=1;}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,measurement:report.measurement?{...report.measurement,loads:report.measurement.loads.length}:null}));await browser.close();}
if(!report.budgetPassed)process.exitCode=1;
