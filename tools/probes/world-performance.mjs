import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const args=process.argv.slice(2),option=(name,fallback)=>args.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const out=args.find(a=>!a.startsWith('--'))||'artifacts/procgen-performance/compare';mkdirSync(out,{recursive:true});
const reference=option('reference',null),runs=Number(option('runs',1)),map=option('map','ninetynine'),report=[];
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8141').replace(/\/$/,''),basePath=new URL(base).pathname.replace(/\/$/,'');
const fixtures=option('cases','12345:temperate:varied,2919286854:io:varied').split(',').map(c=>{const [seed,theme,terrain]=c.split(':');return{requestedSeed:Number(seed),theme,terrain:terrain||'varied'};});
const sources={},sourceFingerprints={};
for(const version of ['before','after']){
 const files=version==='before'?execFileSync('git',['ls-tree','-r','--name-only',reference,'js'],{encoding:'utf8'}).trim().split('\n'):readdirSync('js',{recursive:true}).map(f=>'js/'+f.replaceAll('\\','/'));sources[version]=new Map();
 for(const file of files.filter(f=>f.endsWith('.js')).sort())sources[version].set('/'+file,version==='before'?execFileSync('git',['show',`${reference}:${file}`],{encoding:'utf8',maxBuffer:20e6}):readFileSync(file,'utf8'));
 sourceFingerprints[version]=createHash('sha256').update(JSON.stringify([...sources[version]].map(([p,s])=>[p,s.replace(/\r\n/g,'\n')]))).digest('hex');
}
for(let run=0;run<runs;run++)for(const fixture of fixtures)for(const version of (args.includes('--after-only')?['after']:args.includes('--before-only')?['before']:run%2?['after','before']:['before','after'])){
 // Isolate retained heap, JIT and GPU state; alternate ordering across trials.
 const browser=await chromium.launch({channel:'chrome',headless:true});let row={...fixture,run,version,reference,map,sourceFingerprint:sourceFingerprints[version],browser:browser.version()};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],failedRequests=[];
  page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
  if(option('cpu',null))await cdp.send('Emulation.setCPUThrottlingRate',{rate:Number(option('cpu',1))});
  if(args.includes('--profile')){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
  await page.route('**/js/**',r=>{const body=sources[version].get(new URL(r.request().url()).pathname.slice(basePath.length));return body===undefined?r.continue():r.fulfill({body,contentType:'application/javascript'});});
  if(args.includes('--legacy'))await page.route('**/js/config.js',r=>r.fulfill({contentType:'application/javascript',body:sources[version].get('/js/config.js').replace(/terrainVersion:homeSnapshot\?[^\n]+/,'terrainVersion:0,')}));
  await page.addInitScript(fallback=>{if(fallback)Object.defineProperty(window,'scheduler',{value:undefined});window.tasks=[];new PerformanceObserver(l=>tasks.push(...l.getEntries().map(x=>({start:x.startTime,ms:x.duration})))).observe({type:'longtask',buffered:true});},args.includes('--fallback'));
  const t=Date.now();await page.goto(`${base}/?map=${map}&campaign=0&seed=${fixture.requestedSeed}&planet=${fixture.theme}&terrain=${fixture.terrain}${args.includes('--shots')?'&worldgen=1':''}`,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.WH?.nav&&document.querySelector('#boot.done'),null,{timeout:240000});const bootMs=Date.now()-t;
  const metrics=(await cdp.send('Performance.getMetrics')).metrics;
  const state=await page.evaluate(async()=>{
   const nav=WH.nav,hashes={},digest=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a))).map(x=>x.toString(16).padStart(2,'0')).join('');
   // All persistent typed arrays, including adjacency, layered surfaces and
   // both flow fields. Exclude search scratch buffers with timing-dependent use.
   const keys=['dirs','pos','height','baseHeight','waterDepth','walk','floorWalk','block','dist','next','flow','airWalk','airDist','airNext','adjOff','adj','cost','airCost','layer','deckIndex'];
   for(const k of keys)if(nav[k])hashes[k]=await digest(nav[k]);
   for(const [k,a]of Object.entries(nav.march||{}))if(ArrayBuffer.isView(a))hashes['march.'+k]=await digest(a);
   for(const [k,a]of Object.entries({terrain:WH.world.terrain.geometry.attributes.position.array,colors:WH.world.terrain.geometry.attributes.color.array,fog:WH.world.fogVeil?.mesh.geometry.attributes.position.array}))if(a)hashes[k]=await digest(a);
   const {CONFIG}=await import('./js/config.js');
   const end=WH.bootStages.at(-1).start+WH.bootStages.at(-1).ms,generationTasks=tasks.filter(t=>t.start<end);
   return{stages:WH.bootStages,n:nav.n,seed:CONFIG.seed,terrainVersion:CONFIG.terrainVersion,heart:nav.heartNode,portals:nav.portalNodes,hashes,maxBootTask:Math.max(0,...generationTasks.map(t=>t.ms)),maxLoadTask:Math.max(0,...tasks.map(t=>t.ms)),longTasks:generationTasks.length};
  });
  if(args.includes('--profile')){const {profile}=await cdp.send('Profiler.stop');writeFileSync(`${out}/profile-${version}-${fixture.requestedSeed}-${run}.json`,JSON.stringify(profile));}
  row={...row,bootMs,...state,metrics:Object.fromEntries(metrics.filter(m=>['JSHeapUsedSize','JSHeapTotalSize','TaskDuration','ScriptDuration'].includes(m.name)).map(m=>[m.name,m.value])),errors,failedRequests};
  if(args.includes('--shots')){
    await page.waitForFunction(()=>window.WH?.worldgen,null,{timeout:60000});
    await page.locator('#worldgen-peak').click();await page.waitForTimeout(1200);await page.locator('#worldgen-panel > summary').click();
    await page.screenshot({path:`${out}/${fixture.theme}-${version}-${run}.png`});
  }
  if(errors.length)process.exitCode=1;
 }catch(error){row.failure=String(error);process.exitCode=1;}
 finally{await browser.close();}
 report.push(row);writeFileSync(out+'/results.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({...row,hashes:undefined,metrics:undefined,stages:undefined}));
}
const oracle=option('oracle',null);
if(oracle||!args.includes('--after-only')&&!args.includes('--before-only')){
 const mismatches=[];
 const references=oracle?JSON.parse(readFileSync(oracle,'utf8')):report,candidates=report.filter(r=>r.version==='after');
 for(const a of candidates){const b=references.find(r=>r.version==='before'&&(oracle||r.run===a.run)&&r.theme===a.theme&&r.requestedSeed===a.requestedSeed&&r.terrain===a.terrain&&(r.map||'ninetynine')===a.map);if(!b||a.failure||b.failure){mismatches.push({fixture:a.theme,run:a.run,key:'failed sample'});continue;}for(const key of ['n','seed','terrainVersion','heart','portals','hashes'])if(JSON.stringify(a[key])!==JSON.stringify(b[key]))mismatches.push({fixture:a.theme,run:a.run,key,details:key==='hashes'?Object.keys(a.hashes).filter(k=>a.hashes[k]!==b.hashes[k]):undefined});}
 writeFileSync(out+'/parity.json',JSON.stringify({reference,oracle,cases:candidates.length,mismatches},null,2));console.log(JSON.stringify({parity:mismatches.length===0,mismatches}));if(mismatches.length)process.exitCode=1;
}
