import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(resolve(process.env.WH_NODE_MODULES, 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage();
  await page.addInitScript(() => { const raf=requestAnimationFrame.bind(window); window.__qaFramesEnabled=true; window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);}); });
  await page.goto('http://127.0.0.1:8139/?map=ninetynine&seed=12345');
  await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
  console.log(JSON.stringify(await page.evaluate(async()=>{
    __qaFramesEnabled=false;document.getElementById('btn-begin').click();
    const w=await import('/js/world.js');WH.step(140); const n=WH.nav,v=WH.heartPos.clone();
    return {wave:WH.waves.wave, enemies:WH.enemies.active.map(e=>{
      const i=e.node,j=n.next[i];if(j>=0)n.nodeDir(j,v);
      v.addScaledVector(e.dir,-v.dot(e.dir)).normalize();
      return {node:i,next:j,walk:n.walk[i],nextWalk:n.walk[j],height:e.height,speed:e.moveV,forwardFactor:w.surfaceTravel(e,e.fwd),nextFactor:w.surfaceTravel(e,v),distanceToNext:j>=0?e.dir.angleTo(n.nodeDir(j,v))*240:null,base:n.baseHeight[i],nextBase:n.baseHeight[j],flying:e.type.flying,dir:e.dir.toArray()};
    })};
  }),null,2));
}finally{await browser.close();}
