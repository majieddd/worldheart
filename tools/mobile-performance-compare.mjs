// Back-to-back samples in one Chrome/GPU session. Reference modules are read
// from the named commit, not from a moving public route. Each sample builds
// the same injected battlefield and retains full authored visual settings.
import {createRequire} from 'node:module';import {execFileSync,spawn} from 'node:child_process';import {resolve,dirname} from 'node:path';import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright'),out=resolve(process.argv[2]||'artifacts/mobile-polish/comparison'),ref=process.argv[3]||'102d4a5';mkdirSync(out,{recursive:true});
const source=resolve(out,'reference');
for(const file of ['nav.js','terrain/features.js','terrain/active-features.js','world-context.js']){const dest=resolve(source,file);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,execFileSync('git',['show',ref+':js/'+file]));}
const server=await chromium.launchServer({channel:'chrome',headless:true}),results=[];
try{
 for(const [name,rate,baseline]of [['before',4,true],['after',4,false],['native',1,false]]){
  const dir=resolve(out,name),args=['tools/performance-check.mjs',dir,'--mobile','--seconds=60','--cpu-rate='+rate];if(baseline)args.push('--baseline='+source);
  const exit=await new Promise((done,reject)=>{const child=spawn(process.execPath,args,{env:{...process.env,WH_BROWSER_WS:server.wsEndpoint()},stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',done);});
  const report=JSON.parse(readFileSync(resolve(dir,'results.json'),'utf8'));results.push({name,exit,report});
 }
}finally{await server.close();}
const before=results.find(r=>r.name==='before')?.report,after=results.find(r=>r.name==='after')?.report,native=results.find(r=>r.name==='native')?.report;
const summary={reference:ref,scope:'Same Chrome/GPU session, full visuals, 30 towers/100 replenished enemies, separate native and 4x CPU slowdown. Not physical-phone hardware.',samples:results.map(({name,exit,report:r})=>({name,exit,bootMs:r.bootMs,frameMs:r.measurement?.frameMs,medianFps:r.measurement?.medianFps,p99Fps:r.measurement?.onePercentLowFps,budgetPassed:r.budgetPassed,faults:r.faults,error:r.error})),p95Improvement:before&&after?1-after.measurement.frameMs.p95/before.measurement.frameMs.p95:null,pass:results.length===3&&results.every(r=>r.report.sustainedSimulation&&r.report.pauseRecovery?.pass&&!r.report.faults.length)&&native?.budgetPassed&&after.measurement.frameMs.p95<before.measurement.frameMs.p95*.85&&after.measurement.frameMs.p50<=before.measurement.frameMs.p50*1.1};writeFileSync(resolve(out,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));if(!summary.pass)process.exitCode=1;
