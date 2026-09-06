// Real WebGL context loss/restore and browser tab visibility observations.
import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/runtime-recovery');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),checks=[],faults=[],warnings=[];
try{
 page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 await page.goto(`${process.env.WH_BASE_URL||'http://127.0.0.1:8139'}/?map=ninetynine&seed=12345&campaign=0`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
 await page.getByRole('button',{name:/Begin/}).click();
 await page.evaluate(()=>{window.__visibility=[];document.addEventListener('visibilitychange',()=>__visibility.push({state:document.visibilityState,time:WH.enemies.time,paused:WH.game.paused}));});
 const companion=await context.newPage();await companion.setContent('<title>Recovery fixture companion</title><p>Tab-switch fixture</p>');await companion.bringToFront();await page.waitForTimeout(2000);
 const hidden=await page.evaluate(()=>({state:document.visibilityState,events:__visibility,paused:WH.game.paused,time:WH.enemies.time}));
 await page.bringToFront();await companion.close();await page.waitForTimeout(500);
 const returned=await page.evaluate(()=>({state:document.visibilityState,events:__visibility,paused:WH.game.paused,time:WH.enemies.time}));
 checks.push({name:'Actual tab background preserves a paused simulation',covered:hidden.state==='hidden',ok:hidden.state==='hidden'?hidden.paused&&returned.paused&&hidden.time===returned.time:null,actual:{hidden,returned},limitation:hidden.state==='hidden'?null:'This headless browser kept both tabs visible. Physical background-tab acceptance remains open; no visibility getter was mocked.'});
 const before=await page.evaluate(()=>{WH.game.paused=false;const gl=WH.renderer.getContext(),ext=gl.getExtension('WEBGL_lose_context');if(!ext)return null;window.__loseContext=ext;window.__restored=0;WH.renderer.domElement.addEventListener('webglcontextrestored',()=>__restored++);const state={time:WH.enemies.time,gold:WH.game.gold,wave:WH.mode99.run.getWave(),commander:WH.allies.active.find(a=>a.type.commander)?.hp};ext.loseContext();return state;});
 if(!before)throw Error('WEBGL_lose_context unavailable');
 await page.waitForFunction(()=>WH.renderer.getContext().isContextLost());await page.waitForTimeout(700);
 const during=await page.evaluate(()=>({time:WH.enemies.time,paused:WH.game.paused,lost:WH.renderer.getContext().isContextLost()}));
 checks.push({name:'Real context loss pauses the assault without corrupting state',covered:true,ok:during.lost&&during.paused&&Math.abs(during.time-before.time)<.05,actual:{before,during}});
 await page.evaluate(()=>__loseContext.restoreContext());await page.waitForFunction(()=>__restored>0&&!WH.renderer.getContext().isContextLost());await page.waitForTimeout(1000);
 const restored=await page.evaluate(()=>({time:WH.enemies.time,paused:WH.game.paused,gold:WH.game.gold,wave:WH.mode99.run.getWave(),commander:WH.allies.active.find(a=>a.type.commander)?.hp,calls:WH.drawCalls()}));
 checks.push({name:'Restored GPU draws the same paused assault',covered:true,ok:restored.paused&&restored.time===during.time&&restored.gold===before.gold&&restored.wave===before.wave&&restored.commander===before.commander&&restored.calls>0,actual:restored});
 await page.screenshot({path:resolve(out,'context-restored.png')});
 await page.locator('#btn-pause').click();await page.waitForTimeout(1200);
 const resumed=await page.evaluate(()=>({time:WH.enemies.time,paused:WH.game.paused,state:WH.game.state,calls:WH.drawCalls()}));
 checks.push({name:'A real Resume click continues simulation and rendering',covered:true,ok:!resumed.paused&&resumed.state==='playing'&&resumed.time>restored.time&&resumed.calls>0,actual:resumed});
}catch(error){faults.push(String(error));}
finally{checks.push({name:'Context restore produces no invalid GPU operations',covered:true,ok:!warnings.some(x=>/INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM/.test(x))});writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Real browser tab switch and WEBGL_lose_context fixture. A headless visibility limitation is reported separately from a pass.',checks,faults,warnings},null,2)+'\n');console.log(JSON.stringify({checks, faults,warnings}));await browser.close();}
if(faults.length||checks.some(x=>x.ok===false))process.exitCode=1;
