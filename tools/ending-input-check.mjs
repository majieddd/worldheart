// Injected wave completions reproduce input ownership at the real campaign
// receipt. They never count as a natural victory or earned campaign progress.
import {createRequire} from 'node:module';import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/ending-input');mkdirSync(out,{recursive:true});
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139/').replace(/\/?$/,'/');
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),checks=[],faults=[];
const check=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
try{
 page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 await page.goto(`${base}?map=ninetynine&seed=12345&campaign=1`,{waitUntil:'domcontentloaded',timeout:120000});
 const boot=()=>page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});await boot();
 await page.locator('#btn-begin').click();
 await page.evaluate(()=>{
  __qaFramesEnabled=false;
  const b=document.createElement('button');b.id='qa-possess';b.textContent='Fixture: possess';b.style.cssText='position:fixed;left:10px;top:200px;z-index:9999';
  b.onclick=()=>{WH.possession.enter(WH.allies.active.find(a=>a.type.commander));b.remove();};document.body.append(b);
 });
 await page.locator('#qa-possess').click();
 await page.waitForFunction(()=>!!document.pointerLockElement,{},{timeout:3000}).catch(()=>{});
 check('Fixture enters commander with a real granted pointer lock',await page.evaluate(()=>WH.possession.active&&!!document.pointerLockElement));
 await page.evaluate(()=>{for(let wave=1;wave<=15;wave++){WH.waves.wave=wave;WH.waves.onWaveClear(wave,0);if(WH.mode99.run.getDraft()){WH.mode99.run.vote('solo',0);WH.mode99.update(0);}}WH.step(0);});
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('end-overlay')).opacity==='1',{},{polling:50});
 const receipt=await page.evaluate(()=>({locked:!!document.pointerLockElement,suspended:WH.possession.suspended,paused:WH.game.paused,active:document.activeElement.id,phase:WH.mode99.run.getPhase()}));
 check('The campaign receipt releases commander input and pointer lock',!receipt.locked&&receipt.suspended&&receipt.paused,receipt);
 await page.screenshot({path:resolve(out,'possessed-victory.png')});
 let collect=false;try{await page.locator('#btn-continue').click({timeout:2000});collect=true;}catch(error){check('Collect remaining loot accepts a real click',false,String(error));}
 if(collect){
  check('Collect remaining loot resumes the same commander',await page.evaluate(()=>WH.possession.active&&!WH.possession.suspended&&!WH.game.paused&&!document.getElementById('end-overlay').classList.contains('show')));
  // The public badge owns reopening the same receipt.
  await page.evaluate(()=>document.querySelector('#campaign-status').click());
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('end-overlay')).opacity==='1',{},{polling:50});
  await page.keyboard.press('i');await page.keyboard.press('Escape');
  check('Inventory returns pointer ownership to the still-open receipt',await page.evaluate(()=>WH.possession.suspended&&!document.pointerLockElement&&WH.game.paused&&document.getElementById('end-overlay').classList.contains('show')));
  await page.keyboard.press('p');await page.keyboard.press('1');
  check('Receipt owns pause and construction shortcuts',await page.evaluate(()=>WH.game.paused&&!WH.game.buildType));
  await Promise.all([page.waitForEvent('load',{timeout:120000}),page.locator('#btn-extract').click({timeout:4000})]);await boot();
  check('A real extraction click loads planet two',await page.evaluate(()=>WH.mode99.campaign.state().planet===2));
  await page.screenshot({path:resolve(out,'planet-2-arrival.png')});
 }
}catch(error){faults.push(String(error));}
finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Possessed victory and extraction fixtures with real pointer/mouse input; wave completions injected',base,checks,faults},null,2)+'\n');console.log(JSON.stringify({passed:checks.filter(x=>x.ok).length,total:checks.length,failed:checks.filter(x=>!x.ok),faults},null,2));await browser.close();}
if(faults.length||checks.some(x=>!x.ok))process.exitCode=1;
