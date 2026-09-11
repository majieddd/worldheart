// Render exposed examples at the inspector's normal seed and formation controls.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/terrain-atlas/showcase');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),records=[],faults=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>faults.push(String(e)));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 for(const seed of [771,92741]){
  await page.goto(`${base}/?map=ninetynine&campaign=0&seed=${seed}&terrain=varied&worldgen=1`);await page.waitForFunction(()=>window.WH?.worldgen,{},{timeout:180000});
  await page.evaluate(()=>{__qaFramesEnabled=false;WH.step(1);});
  const sites=await page.evaluate(()=>WH.worldgen.landmarks);
  for(const type of ['caldera','buttes','dunes','valley','plateau','ravine','gorge','crevice','escarpment','hills','mesa','canyon']){
   const index=sites.findIndex(s=>s.type===type);if(index<0)continue;
   await page.locator('#worldgen-formation').selectOption(String(index));await page.evaluate(()=>WH.step(1));
   await page.locator('#worldgen-panel summary').click();await page.screenshot({path:resolve(out,`${seed}-${type}.png`)});await page.locator('#worldgen-panel summary').click();
   records.push({seed,effectiveSeed:await page.evaluate(()=>WH.CONFIG.seed),...sites[index]});
  }
 }
}finally{await browser.close();const pass=['caldera','buttes','dunes','valley','plateau','ravine','gorge','crevice','escarpment','hills','mesa','canyon'].every(t=>records.some(r=>r.type===t))&&!faults.length;writeFileSync(resolve(out,'results.json'),JSON.stringify({base,scope:'Rendered actual terrain through normal inspector controls, controlled frame advance',records,faults,pass},null,2)+'\n');console.log(JSON.stringify({records:records.map(r=>({seed:r.seed,type:r.type,height:r.height,depth:r.depth})),faults,pass}));if(!pass)process.exitCode=1;}
