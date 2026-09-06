import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(process.env.WH_NODE_MODULES?resolve(process.env.WH_NODE_MODULES,'package.json'):import.meta.url);
const {chromium}=require('playwright');const out=resolve(process.argv[2]||'artifacts/poses');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});});
  await page.goto('http://127.0.0.1:8139/?map=ninetynine&seed=12345');
  await page.waitForFunction(()=>window.WH?.possession&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
  await page.evaluate(()=>{__qaFramesEnabled=false;document.getElementById('btn-begin').click();WH.game.paused=true;WH.possession.enter(WH.allies.active[0]);WH.step(.1);});
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('title-overlay')).opacity==='0',{}, {polling:50});
  const metrics=[];
  for(const p of [0,.22,.40,.68,1]){
    metrics.push(await page.evaluate(p=>{const u=WH.possession.unit;u.swingDur=.85;u.swingT=p>0&&p<1?.85*(1-p):0;u.swingSide=1;WH.step(1/60);return {p,dir:u.dir.toArray(),camera:WH.rig.camera.position.toArray(),near:WH.rig.camera.near};},p));
    await page.screenshot({path:resolve(out,`bulwark-${p}.png`)});
  }
  await page.evaluate(()=>{WH.possession.boom=WH.possession.boomWant=5;WH.step(.25);});
  await page.screenshot({path:resolve(out,'bulwark-third.png')});
  writeFileSync(resolve(out,'poses.json'),JSON.stringify({scope:'Fixed-pose visual fixture; animation progress injected',metrics},null,2)+'\n');
}finally{await browser.close();}
