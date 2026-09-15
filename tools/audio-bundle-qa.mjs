import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright'),out=resolve(process.argv[2]||'artifacts/audio-revamp/bundle');mkdirSync(out,{recursive:true});
const report={scope:'Generated single-file delivery with embedded real music and effects.',checks:[],faults:[]},browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});page.on('pageerror',e=>report.faults.push(String(e)));const network=[];page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.goto('http://127.0.0.1:8140/dist/worldheart.html?map=pocket&seed=12345');await page.waitForFunction(()=>window.WH?.audio&&document.querySelector('#boot.done'),null,{timeout:180000});
 const check=(name,ok)=>{report.checks.push({name,ok:!!ok});console.log((ok?'PASS ':'FAIL ')+name);};
 check('Standalone contains all seven compressed assets',await page.evaluate(()=>Object.keys(WH_AUDIO_ASSETS).length===7));
 await page.locator('#btn-begin').tap();await page.waitForFunction(()=>WH.audio.stats.bank==='ready'&&WH.audio.decks.some(d=>d.target&&d.element.currentTime>.5),null,{timeout:45000});
 check('Standalone decodes effects and plays an embedded score',await page.evaluate(()=>WH.audio.buffer&&WH.audio.decks.some(d=>d.target&&d.element.src.startsWith('data:audio/mpeg'))));
 check('Standalone does not request external audio files',network.every(u=>!u.includes('/audio/')));
 report.audio=await page.evaluate(()=>WH.audio.snapshot());report.network=network;check('Classic standalone boot has no audio or page error',!report.faults.length&&!report.audio.errors.length);
}catch(e){report.faults.push(String(e));console.error(e);}finally{writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
if(report.faults.length||report.checks.some(c=>!c.ok))process.exitCode=1;
