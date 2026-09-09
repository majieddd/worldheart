// Source-informed fixtures with real DOM clicks and native pointer lock.
// Placement timings isolate guide work; they are not whole-game FPS evidence.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/build-comfort');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],faults=[];
const check=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>faults.push(String(e)));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 await page.goto(`${base}/?map=ninetynine&campaign=1&seed=12345`);await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
 await page.locator('#btn-begin').click();await page.waitForFunction(()=>getComputedStyle(document.getElementById('title-overlay')).opacity==='0');
 await page.evaluate(()=>{__qaFramesEnabled=false;WH.game.paused=true;WH.step(.01);});
 const trees=await page.evaluate(async()=>{
  const T=await import(new URL('lib/three.module.min.js',location.href)),W=WH,sets=W.world.decor.sets,results=[];
  for(const [index,label] of [[0,'pine'],[1,'broadleaf'],[2,'rock']]){
   const set=sets[index],g=set.mesh.geometry;g.computeBoundingBox();
   for(let i=0,count=0;i<set.list.length&&count<3;i++){
    const it=set.list[i];if(!it.alive)continue;
    const m=new T.Matrix4();set.mesh.getMatrixAt(i,m);const p=g.boundingBox.getCenter(new T.Vector3()).applyMatrix4(m),t=new T.Vector3(1,0,0).transformDirection(m);
    W.world.decor.sets=[{...set,list:[it]}];const hit=W.world.decorHit(p.clone().addScaledVector(t,-5),p.clone().addScaledVector(t,5),.3);results.push({label,hit});count++;
   }
  }W.world.decor.sets=sets;return results;
 });for(const [i,r]of trees.entries())check(`${r.label} ${i}: ${r.label==='rock'?'rock camera clearance retained':'tree does not obstruct camera'}`,r.label==='rock'?r.hit>=0:r.hit<0,r);
 const travel=await page.evaluate(()=>{
  const W=WH,a=W.allies.active.find(x=>x.type.commander),saved={dir:a.dir.clone(),fwd:a.fwd.clone()},samples=[];
  const n=W.nav,sets=W.world.decor.sets;
  for(const set of sets.slice(0,2))for(const it of set.list){
   if(!it.alive||samples.length>=6)continue;
   const center=it.dir.clone(),bearing=a.fwd.clone().addScaledVector(center,-a.fwd.dot(center)).normalize();
   const start=center.clone().addScaledVector(bearing,-2/240).normalize();
   a.dir.copy(start);a.fwd.copy(bearing).addScaledVector(start,-bearing.dot(start)).normalize();W.allies._ground(a);
   let near=Infinity;for(let i=0;i<90;i++){W.allies.driveUnit(a,1,0,1/60);near=Math.min(near,a.dir.distanceTo(center)*240);}
   const distance=start.distanceTo(a.dir)*240;if(near>.45||distance<3)continue;
   const withTree=a.dir.clone();W.world.decor.sets=[];a.dir.copy(start);a.fwd.copy(bearing).addScaledVector(start,-bearing.dot(start)).normalize();W.allies._ground(a);
   for(let i=0;i<90;i++)W.allies.driveUnit(a,1,0,1/60);W.world.decor.sets=sets;
   samples.push({distance,closestToTrunk:near,withoutTreeDifference:withTree.distanceTo(a.dir)*240});
  }
  a.dir.copy(saved.dir);a.fwd.copy(saved.fwd);W.allies._ground(a);return samples;
 });check('Commander crosses six actual tree locations with identical travel when decor is removed',travel.length===6&&travel.every(r=>r.withoutTreeDifference<1e-8),travel);
 const guide=await page.evaluate(async()=>{
  const {surfacePoint}=await import(new URL('js/world.js',location.href)),W=WH,g=W.game.rangeRing,center=W.heartPos.clone(),axis=W.allies.active[0].fwd.clone(),times=[];
  const ids=()=>g.mesh.children.map(x=>x.geometry?.uuid).join(',');const start=ids();
  for(let i=0;i<100;i++){const p=center.clone().addScaledVector(axis,(i%40)*.11).normalize();surfacePoint(p,p);const t=performance.now();g.place(p,12,3);times.push(performance.now()-t);}
  times.sort((a,b)=>a-b);g.show(true);W.step(.01);
  return {medianMs:times[50],p95Ms:times[95],maxMs:times.at(-1),geometryReused:ids()===start,hasVeil:!!g.veil,transparent:g.veil?.material.transparent,depthWrite:g.veil?.material.depthWrite,maxRadius:g.outer.scale.x,minRadius:g.inner.scale.x};
 });check('Moving guide reuses buffers without terrain remeshing',guide.geometryReused,guide);check('Moving guide stays below 2ms p95 in the isolated 100-position fixture',guide.p95Ms<2,guide);
 check('Range is a transparent veil with correct maximum and minimum radii',guide.hasVeil&&guide.transparent&&!guide.depthWrite&&guide.maxRadius===12&&guide.minRadius===3,guide);
 await page.screenshot({path:resolve(out,'range-board.png')});
 await page.evaluate(async()=>{
  const W=WH,{surfacePoint}=await import(new URL('js/world.js',location.href));W.game.rangeRing.show(false);W.game.gold=100000;W.game.tierCap=10;
  for(let n=0;n<W.nav.n;n++)if(W.nav.walk[n]&&W.nav.dist[n]>4&&W.nav.dist[n]<13){W.nav.nodeDir(n,W.game.cursorDir);surfacePoint(W.game.cursorDir,W.game.cursorPos);W.game.cursorValid=true;W.game.buildType='bolt';W.game._tryPlace();if(W.towers.towers.length)break;}
  W.game.cancelBuild();window.__tower=W.towers.towers[0];window.__commander=W.allies.active.find(x=>x.type.commander);
  __commander.dir.copy(__tower.pos).normalize().addScaledVector(__commander.fwd,-5/240).normalize();W.allies._ground(__commander);
  const button=document.createElement('button');button.id='qa-enter';button.textContent='Enter commander';button.style.cssText='position:fixed;top:10px;left:400px;z-index:99999';button.onclick=()=>{W.possession.enter(__commander);W.possession.boomWant=0;W.step(.4);button.remove();};document.body.append(button);
 });await page.locator('#qa-enter').click();await page.waitForTimeout(180);
 check('Browser grants native pointer lock on commander entry',await page.evaluate(()=>document.pointerLockElement===WH.rig.canvas));
 const prepare=async()=>{await page.evaluate(()=>{const c=WH.game.context;WH.rig.camera.lookAt(__tower.pos.clone().addScaledVector(__tower.pos.clone().normalize(),1.1));WH.rig.camera.updateMatrixWorld();c.dismissed=null;c.update();});await page.keyboard.press('f');await page.waitForTimeout(100);};
 await prepare();check('F opens inspection and releases pointer lock',await page.evaluate(()=>WH.game.context.editing&&WH.possession.suspended&&!document.pointerLockElement));
 const tier=await page.evaluate(()=>__tower.tier);await page.locator('#tp-upgrade').click();await page.waitForTimeout(180);
 const upgraded=await page.evaluate(()=>({tier:__tower.tier,editing:WH.game.context.editing,suspended:WH.possession.suspended,locked:document.pointerLockElement===WH.rig.canvas,boom:WH.possession.boom,focus:document.activeElement?.id}));
 check('Successful Upgrade buys exactly one tier and restores first-person lock',upgraded.tier===tier+1&&!upgraded.editing&&!upgraded.suspended&&upgraded.locked&&upgraded.boom<.02,upgraded);
 check('Upgrade click leaves no stuck attack or focused hidden action',await page.evaluate(()=>!WH.possession.firing&&!document.getElementById('tower-panel').contains(document.activeElement)));
 await page.screenshot({path:resolve(out,'upgrade-first-person.png')});
 if(await page.evaluate(()=>!!WH.game.context.editing))await page.keyboard.press('f');
 await prepare();await page.evaluate(()=>{WH.game.gold=0;WH.ui.refresh();});
 check('Unaffordable upgrade is disabled and retains inspection ownership',await page.evaluate(()=>document.getElementById('tp-upgrade').disabled&&WH.game.context.editing&&WH.possession.suspended&&!document.pointerLockElement));
 const old=await page.evaluate(()=>__tower.tier);await page.evaluate(()=>WH.game.upgradeSelected());check('Refused purchase does not close inspection or change tier',await page.evaluate(t=>WH.game.context.editing&&WH.possession.suspended&&__tower.tier===t,old));
 await page.evaluate(()=>{WH.game.gold=100000;WH.ui.refresh();});await page.locator('#tp-sell').click();await page.waitForTimeout(180);
 const sold=await page.evaluate(()=>({gone:!WH.towers.towers.includes(__tower),editing:WH.game.context.editing,suspended:WH.possession.suspended,locked:document.pointerLockElement===WH.rig.canvas}));
 check('Successful Sell closes inspection and restores pointer lock in the click gesture',sold.gone&&!sold.editing&&!sold.suspended&&sold.locked,sold);
 // A refused browser must still permit right-drag look after a transaction.
 await page.evaluate(()=>{WH.game.context.close();document.exitPointerLock?.();WH.rig.canvas.requestPointerLock=()=>Promise.reject(new Error('Deliberate refusal'));WH.possession.suspend(true);WH.possession.suspend(false);});await page.waitForTimeout(100);
 const fallback=await page.evaluate(()=>{const p=WH.possession,before=p.unit.fwd.clone();p.canvas.dispatchEvent(new MouseEvent('mousemove',{buttons:2,movementX:60,movementY:0}));p.update(.1,false);return before.distanceTo(p.unit.fwd);});check('Pointer-lock refusal retains working drag-look fallback',fallback>.01,fallback);
 const ownership=await page.evaluate(()=>{
  const W=WH,c=W.game.context,p=W.possession;p.suspend(true);c.editing=true;c.wasSuspended=true;c.close();const priorOwner=p.suspended;
  c.editing=true;c.wasSuspended=false;W.mode99.weaponPanel.open();c.close();const modalOwner=p.suspended&&!!document.querySelector('dialog[open]');
  document.querySelector('dialog[open]')?.close();const state=W.game.state;W.game.state='over';c.editing=true;c.wasSuspended=false;c.close();const terminalOwner=p.suspended;W.game.state=state;
  return {priorOwner,modalOwner,terminalOwner};
 });check('Context cannot steal input from an earlier suspension, open modal or terminal state',ownership.priorOwner&&ownership.modalOwner&&ownership.terminalOwner,ownership);
 await page.close();
}catch(e){faults.push(String(e));}
finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({base,scope:'Controlled actual tree/guide fixtures and real DOM/native pointer-lock transactions; no whole-run or device-performance claim',checks,faults},null,2)+'\n');console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok),faults},null,2));await browser.close();}
if(faults.length||checks.some(c=>!c.ok))process.exitCode=1;
