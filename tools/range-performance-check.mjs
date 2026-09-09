// Controlled A/B: preceding range and navigation preview implementations.
// Actual moving build ghosts and WebGL rendering run at native and 4x CPU rates.
import{createRequire}from'node:module';import{resolve}from'node:path';import{mkdirSync,writeFileSync}from'node:fs';import{execFileSync}from'node:child_process';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/range-performance');mkdirSync(out,{recursive:true});
const reference=process.argv.find(s=>s.startsWith('--reference='))?.slice(12)||'d79f1d6';
const old=execFileSync('git',['show',`${reference}:js/range-guide.js`],{encoding:'utf8'});
const oldNav=execFileSync('git',['show',`${reference}:js/nav.js`],{encoding:'utf8'}),variants=process.argv.includes('--after-only')?['after']:['before','after'];
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[],faults=[];
try{for(const variant of variants){
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>faults.push(String(e)));
 if(variant==='before'){await page.route('**/js/range-guide.js',r=>r.fulfill({contentType:'text/javascript',body:old}));await page.route('**/js/nav.js',r=>r.fulfill({contentType:'text/javascript',body:oldNav}));}
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__captureRAF=raf;window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 await page.goto(`${base}/?map=ninetynine&campaign=0&seed=12345`);await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
 await page.locator('#btn-begin').click();await page.waitForFunction(()=>getComputedStyle(document.getElementById('title-overlay')).opacity==='0');
 await page.evaluate(async()=>{
  __qaFramesEnabled=false;WH.game.paused=true;WH.step(.01);const W=WH,g=W.game,{surfacePoint}=await import(new URL('js/world.js',location.href)),{TOWER_TYPES}=await import(new URL('js/towers.js',location.href));
  const centers=[],dir=g.cursorDir.clone(),center=W.heartPos.clone().normalize(),bearing=W.allies.active[0].fwd.clone();
  g.buildType='bolt';g.cursorValid=true;g._mountGhost('bolt');
  for(let i=0;i<480&&centers.length<64;i++){
    const tangent=bearing.clone().applyAxisAngle(center,i*2.3999632297);
    dir.copy(center).addScaledVector(tangent,(5+i%12*.4)/240).normalize();
    g.cursorDir.copy(dir);surfacePoint(dir,g.cursorPos);
    if(g._validate(TOWER_TYPES.bolt).ok)centers.push(g.cursorPos.clone());
  }
  // A new seed put every point on the former straight probe inside a denial
  // area, silently skipping route validation. Measure proven legal sites.
  if(centers.length<12)throw Error(`Only ${centers.length} legal preview positions`);
  window.__guideCenters=centers;g.cursorDir.copy(centers[0]).normalize();g.cursorPos.copy(centers[0]);
 });
 const cdp=await page.context().newCDPSession(page);
 for(const cpuRate of (process.argv.includes('--diagnose')?[1]:[1,4])){
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpuRate});
  const data=await page.evaluate(async()=>{
   const g=WH.game,frames=[],work=[],guide=[],geometry=new Set(),original=g.rangeRing.place.bind(g.rangeRing),operations={},restore=[];
   for(const[obj,key]of [[WH.nav,'validatePlacement'],[WH.nav,'previewPaths'],[g,'_validate'],[g.pathFlow,'setPaths'],[g.footRing,'place']]){const fn=obj[key];operations[key]=[];obj[key]=function(...args){const t=performance.now(),r=fn.apply(this,args);operations[key].push(performance.now()-t);return r;};restore.push(()=>obj[key]=fn);}
   g.rangeRing.place=(...args)=>{const t=performance.now();const r=original(...args);guide.push(performance.now()-t);return r;};
   let previous=null;
   for(let i=0;i<280;i++){
    const now=await new Promise(r=>__captureRAF(r));if(i>=40&&previous!==null)frames.push(now-previous);previous=now;
    const p=__guideCenters[i%__guideCenters.length];g.cursorPos.copy(p);g.cursorDir.copy(p).normalize();const start=performance.now();g._updateGhost();WH.step(1/60);if(i>=40)work.push(performance.now()-start);
    for(const c of g.rangeRing.mesh.children)geometry.add(c.geometry.uuid);
   }
   g.rangeRing.place=original;restore.forEach(fn=>fn());
   const stats=a=>{a.sort((x,y)=>x-y);return {median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)],max:a.at(-1)};};
   if(!operations.validatePlacement.length)throw Error('Moving preview never exercised route validation');
   return {seed:WH.CONFIG.seed,legalPositions:__guideCenters.length,routeValidations:operations.validatePlacement.length,framesMs:stats(frames),mainWorkMs:stats(work),guideMs:stats(guide.slice(40)),operations:Object.fromEntries(Object.entries(operations).map(([k,v])=>[k,stats(v)])),geometryIds:geometry.size,visible:g.rangeRing.mesh.visible};
  });results.push({variant,cpuRate,...data});console.log(JSON.stringify(results.at(-1)));
 }
 await page.screenshot({path:resolve(out,`${variant}-placement.png`)});await page.close();
}
}catch(e){faults.push(String(e));}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Current integrated placement, with optional preceding RangeGuide and NavGraph swapped by request interception; 240 moving-preview rendered frames after warmup, paused combat; CPU slowdown uses the same GPU, not a lower-end device',reference,browser:browser.version(),results,faults},null,2)+'\n');await browser.close();}
if(faults.length||results.length!==variants.length*(process.argv.includes('--diagnose')?1:2))process.exitCode=1;
