// Native frame pacing for the optional whole-planet atlas, including its
// cooperative construction. Run with other heavy QA processes stopped.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/terrain-atlas/atlas-performance');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),faults=[];
const profiling=process.argv.includes('--profile');
page.on('pageerror',e=>faults.push(String(e)));const result={scope:'Native 10-second whole-globe inspector frame pacing and construction, no injected combat',base,faults};
try{
 await page.goto(`${base}/?map=ninetynine&campaign=0&seed=12345&terrain=varied&worldgen=1`);await page.waitForFunction(()=>window.WH?.worldgen,{},{timeout:180000});
 await page.evaluate(()=>{window.__atlasTasks=[];window.__atlasObserver=new PerformanceObserver(list=>__atlasTasks.push(...list.getEntries().map(e=>e.duration)));__atlasObserver.observe({type:'longtask',buffered:false});});
 const cdp=profiling?await page.context().newCDPSession(page):null;
 if(cdp){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
 const start=Date.now();await page.locator('#worldgen-paths').check();result.atlas=await page.evaluate(()=>WH.worldgen.atlasReady);result.totalBuildMs=Date.now()-start;
 if(cdp){
  const {profile}=await cdp.send('Profiler.stop');writeFileSync(resolve(out,'cpu.cpuprofile'),JSON.stringify(profile));
  const nodes=new Map(profile.nodes.map(n=>[n.id,n])),time=new Map();
  for(let i=0;i<profile.samples.length;i++)time.set(profile.samples[i],(time.get(profile.samples[i])||0)+profile.timeDeltas[i]);
  result.cpuProfile=[...time].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([id,microseconds])=>({selfMs:microseconds/1000,...nodes.get(id).callFrame}));
  result.profileScope='Sampling profiler adds overhead; diagnostic timing only';
 }
 result.construction=await page.evaluate(()=>{__atlasObserver.disconnect();return {longTasks:__atlasTasks.length,maxMs:Math.max(0,...__atlasTasks)};});
 await page.locator('#worldgen-globe').click();await page.locator('#worldgen-panel summary').click();await page.waitForTimeout(2000);
 result.frames=await page.evaluate(()=>new Promise(resolve=>{
  const frames=[],start=performance.now();let last=start;
  function tick(t){frames.push(t-last);last=t;if(t-start<10000){requestAnimationFrame(tick);return;}
   const sorted=frames.filter(n=>n>0).sort((a,b)=>a-b),p=q=>sorted[Math.floor((sorted.length-1)*q)];
   resolve({count:sorted.length,p50:p(.5),p95:p(.95),p99:p(.99),max:sorted.at(-1),drawCalls:WH.drawCalls(),triangles:WH.tris(),memory:{...WH.renderer.info.memory}});
  }requestAnimationFrame(tick);
 }));
 await page.screenshot({path:resolve(out,'native-atlas.png')});
 result.pass=result.frames.p50<=1000/60+.2&&result.frames.p99<=1000/30&&result.construction.maxMs<200&&!!result.atlas&&!faults.length;
}catch(e){result.error=String(e);result.pass=false;}
finally{await browser.close();writeFileSync(resolve(out,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;}
