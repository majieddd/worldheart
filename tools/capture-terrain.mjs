import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json'));
const {chromium}=require('playwright'),out=resolve(process.argv[2]||'artifacts/m3-layers');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});});
  await page.goto('http://127.0.0.1:8139/?map=ninetynine&seed=12345&terrain=alpine',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
  await page.evaluate(()=>{__qaFramesEnabled=false;document.getElementById('btn-begin').click();WH.game.paused=true;WH.step(.01);});
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('title-overlay')).opacity==='0',{},{polling:50});
  await page.screenshot({path:resolve(out,'all.jpg'),quality:82});
  for(const layer of ['fieldWall','fogVeil','terrain']){
    await page.evaluate(layer=>{const o=WH.world[layer].mesh||WH.world[layer];o.visible=false;WH.step(.01);},layer);
    await page.screenshot({path:resolve(out,`without-${layer}.jpg`),quality:82});
  }
}finally{await browser.close();}
