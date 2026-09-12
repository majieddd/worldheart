import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out='artifacts/cosmic-landforms/detail-review';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),faults=[];
page.on('pageerror',e=>faults.push(String(e)));
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
const records=[];
try{
 await page.goto('http://127.0.0.1:8139/?map=ninetynine&campaign=0&seed=4206018157&terrain=varied&worldgen=1&planet=temperate');
 await page.waitForFunction(()=>window.WH?.worldgen,{},{timeout:240000});
 await page.evaluate(()=>{__qaFramesEnabled=false;WH.step(1);});
 for(const type of ['labyrinth','forest']){
  const index=await page.evaluate(type=>WH.worldgen.landmarks.findIndex(s=>s.type===type),type);
  await page.locator('#worldgen-formation').selectOption(String(index));
  await page.evaluate(()=>{WH.step(1);WH.worldgen.rig.tiltOffset=-.55;WH.step(1);});
  await page.locator('#worldgen-panel summary').click();
  await page.screenshot({path:resolve(out,type+'.png')});
  await page.locator('#worldgen-panel summary').click();
  records.push(await page.evaluate(index=>WH.worldgen.landmarks[index],index));
 }
 const motion=await page.evaluate(()=>{const u=WH.world.terrain.material.userData.lavaTime,a=u.value;WH.step(2);return {before:a,after:u.value,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};});
 const result={scope:'Controlled final-source overhead landform inspection, reduced-motion media preference',records,motion,faults,pass:motion.reduced&&motion.before===motion.after&&!faults.length};
 writeFileSync(out+'/results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 if(!result.pass)process.exitCode=1;
}finally{await browser.close();}
