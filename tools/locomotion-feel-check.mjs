// Isolate actual-displacement feedback from input demand. The solid-boundary
// fixture blocks every candidate edge; real terrain/tower checks run separately.
import{createRequire}from'node:module';import{resolve}from'node:path';import{mkdirSync,writeFileSync}from'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/locomotion-feel');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],faults=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>faults.push(String(e)));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 await page.goto(`${base}/?map=ninetynine&campaign=0&seed=12345`);await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
 await page.locator('#btn-begin').click();await page.evaluate(()=>{__qaFramesEnabled=false;WH.game.paused=true;WH.possession.enter(WH.allies.active.find(a=>a.type.commander));WH.possession.suspended=false;});
 await page.keyboard.down('w');
 const blocked=await page.evaluate(()=>{
  const W=WH,p=W.possession,a=p.unit,nav=W.nav,canStep=nav.canStep,records=[];nav.canStep=()=>false;
  try{for(const hz of [30,60,120]){p.vel.set(0,0);p.moveT=0;p.stride=0;p.sprintT=0;p.roll=0;const start=a.dir.clone();let phase=0;
   for(let i=0;i<2*hz;i++){p.update(1/hz,true);if(i===hz-1)phase=p.stride;}
   records.push({hz,moveT:p.moveT,strideLastSecond:p.stride-phase,distance:start.distanceTo(a.dir)*240});
  }}finally{nav.canStep=canStep;}return records;
 });
 for(const r of blocked)checks.push({name:`${r.hz} Hz: blocked movement settles camera/weapon bob and footsteps`,ok:r.distance<1e-8&&r.moveT<.02&&r.strideLastSecond<.02,actual:r});
 await page.keyboard.up('w');
 const rest=await page.evaluate(async()=>{
  const p=WH.possession,v=WH.viewModel,{PRESENTATION}=await import(new URL('js/config.js',location.href));
  p.roll=.025;v._sway.set(.035,.02);PRESENTATION.bob=false;p.update(0,false);
  return {roll:p.roll,sway:v._sway.toArray()};
 });checks.push({name:'Turning bob off while paused immediately clears residual roll and weapon sway',ok:Math.abs(rest.roll)<1e-8&&rest.sway.every(x=>Math.abs(x)<1e-8),actual:rest});
 await page.evaluate(()=>{for(let i=0;i<6;i++)WH.ui.toast('Too steep to build here','warn');});
 const notices=await page.locator('#toast-anchor .toast').allTextContents();checks.push({name:'Repeated identical notification refreshes one readable message',ok:notices.filter(x=>x==='Too steep to build here').length===1,actual:notices});
 const labels=await page.evaluate(()=>{
  const f=WH.fx.floaters,T=WH.rig.camera;T.updateMatrixWorld();const front=WH.heartPos.clone().set(0,0,-2).applyMatrix4(T.matrixWorld),near=WH.heartPos.clone().set(0,0,-T.near*.25).applyMatrix4(T.matrixWorld);
  f.items.forEach(i=>i.life=0);f.spawn(front,'321');f.spawn(near,'NEAR');f.update(.01);return f.items.filter(i=>i.life>0).map(i=>({text:i.el.textContent,opacity:i.el.style.opacity}));
 });checks.push({name:'Feedback inside the camera near plane cannot flash over the HUD',ok:labels.some(x=>x.text==='321')&&!labels.some(x=>x.text==='NEAR'&&Number(x.opacity)>0),actual:labels});
 await page.evaluate(()=>WH.step(0));await page.screenshot({path:resolve(out,'feedback.png')});
 await page.close();
 const reduced=await browser.newPage({reducedMotion:'reduce'});reduced.on('pageerror',e=>faults.push(String(e)));
 await reduced.goto(`${base}/?map=pocket&seed=44021`);await reduced.waitForFunction(()=>window.WH&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
 const motion=await reduced.evaluate(()=>{const f=WH.fx.floaters,c=WH.rig.camera;c.updateMatrixWorld();const pos=WH.heartPos.clone().set(0,0,-10).applyMatrix4(c.matrixWorld);f.items.forEach(x=>x.life=0);f.spawn(pos,'BLOCKED');f.update(.1);const it=f.items.find(x=>x.el.textContent==='BLOCKED'&&x.life>0);return {drift:it?.vy,transform:it?.el.style.transform};});
 checks.push({name:'Reduced-motion essential block text stays anchored',ok:motion.drift===0,actual:motion});await reduced.close();
}catch(e){faults.push(String(e));}
finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Actual keyboard input with injected solid boundary and isolated feedback fixtures; no natural gameplay claim',checks,faults},null,2)+'\n');console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok).map(c=>c.name),faults}));await browser.close();}
if(faults.length||checks.some(c=>!c.ok))process.exitCode=1;
