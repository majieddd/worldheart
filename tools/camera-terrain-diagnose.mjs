import {createRequire} from 'node:module';import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});});
  await page.goto('http://127.0.0.1:8139/?map=ninetynine&seed=12345',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
  console.log(JSON.stringify(await page.evaluate(()=>{
    __qaFramesEnabled=false;document.getElementById('btn-begin').click();WH.game.paused=true;
    const rig=WH.rig,old=rig._panOnTerrain,records=[];
    rig._panOnTerrain=function(x,y){old.call(this,x,y);const p=this.grabDir.clone().multiplyScalar(this.grabR).project(this.camera);records.push({error:Math.hypot((p.x+1)*640-x,(1-p.y)*360-y),x,y,yaw:this.viewYaw,lat:this.lat,lon:this.lon,focus:this.focusRadius,cam:this.camera.position.length()});};
    const report=WH.camTest();records.sort((a,b)=>b.error-a.error);return {checks:report.checks.filter(c=>!c.ok),worstSolver:records.filter(r=>r.y>100&&r.y<620).slice(0,12)};
  }),null,2));
}finally{await browser.close();}
