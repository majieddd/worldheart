// Gesture regressions use native multi-touch. Render equivalence compares two
// submissions of the same frozen world, with identical visual settings.
import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8139',out=resolve(process.argv[2]||'artifacts/mobile-polish/check');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true}),page=await context.newPage(),cdp=await context.newCDPSession(page),checks=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));const ck=(name,ok,actual)=>{checks.push({name,ok:!!ok,actual});console.log((ok?'PASS ':'FAIL ')+name);};
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__frames=true;window.requestAnimationFrame=fn=>raf(t=>{if(__frames)fn(t);});});
const step=(n=12)=>page.evaluate(n=>WH.step(n/60),n),tap=async s=>{await page.locator(s).tap();await page.waitForTimeout(40);await step();},at=async s=>{const r=await page.locator(s).boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2};},points=new Map();
async function touch(type,id,pos){const ending=points.get(id);if(type==='touchEnd')points.delete(id);else points.set(id,{id,...pos,radiusX:6,radiusY:6,force:1});await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[ending]:[...points.values()]});await page.waitForTimeout(30);}
try{
 await page.goto(base+'/?map=ninetynine&campaign=0&seed=12345&commander=commander&planet=temperate',{waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.WH?.mobile&&document.querySelector('#boot.done'),null,{timeout:180000});await tap('#btn-begin');await page.waitForTimeout(1700);await page.evaluate(()=>{__frames=false;WH.waves.update=()=>{};});
 const render=await page.evaluate(()=>{
  const W=WH,chunks=W.world.terrainChunks,gl=W.renderer.getContext(),camera=W.rig.camera,results=[];
  W.ui.onQuality('high');W.rig.cancelFlight();
  for(const [dist,yaw] of [[22,0],[65,0],[900,0],[22,-.65],[22,.65]]){
   W.rig.dist=W.rig.targetDist=dist;W.rig.update(.01);camera.rotateY(yaw);camera.updateMatrixWorld();const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
   const before=new Uint8Array(width*height*4),after=new Uint8Array(before.length);
   const draw=(full,pixels)=>{chunks.forceFull=full;chunks.update(camera.position);for(const s of W.world.decor.sets)if(s.sectors)s.sectors.forceFull=full;W.world.updateDecorVisibility(camera);W.world.syncDecorBatches();W.renderer.info.reset();W.post.render(W.scene,camera,0);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return W.tris();};
   const original=draw(true,before),optimized=draw(false,after);let changed=0,max=0;
   for(let i=0;i<before.length;i++){const d=Math.abs(before[i]-after[i]);if(d>2)changed++;max=Math.max(max,d);}
   results.push({distance:dist,yaw,original,optimized,ratio:optimized/original,changedFraction:changed/before.length,maxDelta:max});
  }return results;
 });ck('Terrain culling preserves the rendered image at close, regional and whole-planet views',render.every(r=>r.changedFraction<.001),render);ck('Close views avoid at least 100000 submitted triangles without reducing detail',render[0].original-render[0].optimized>=100000,render[0]);
 await tap('#touch-commander');await tap('#touch-camera');await step(40);
 await page.evaluate(()=>{window.__touchTrace=[];for(const name of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','click'])document.addEventListener(name,e=>{__touchTrace.push({type:name,id:e.pointerId,target:e.target.id||e.target.closest('button')?.id,x:e.clientX,y:e.clientY});if(__touchTrace.length>80)__touchTrace.shift();},true);});
 const stick=await at('#touch-stick'),fire=await at('#touch-fire'),power=await at('#touch-power');
 await touch('touchStart',1,{x:stick.x-20,y:stick.y+15});await step();ck('Floating stick starts neutral under the landing thumb',await page.evaluate(()=>WH.possession.touchInput.forward===0&&WH.possession.touchInput.strafe===0));
 await touch('touchMove',1,{x:stick.x-20,y:stick.y-40});await touch('touchStart',2,fire);await step(3);
 ck('Move and held fire coexist',await page.evaluate(()=>WH.possession.firing&&WH.possession.touchInput.forward>.8));
 const before=await page.evaluate(()=>WH.mode99.abilities.events.length);
 await touch('touchStart',3,power);await touch('touchEnd',3);await step(1);
 const queued=await page.evaluate(()=>({pending:!!WH.mobile.pendingPower,firing:WH.possession.firing,swing:WH.mode99.commander.swingT,canDrive:WH.mobile.canDrive(),events:WH.mode99.abilities.events,trace:__touchTrace}));ck('A Power tap during held-fire recovery queues exactly once',queued.pending&&!queued.firing&&queued.swing>0,queued);
 await step(65);
 ck('Queued Power activates at recovery and held fire resumes',await page.evaluate(n=>WH.mode99.abilities.events.length===n+1&&WH.mode99.abilities.events.at(-1).which==='weapon'&&!WH.mobile.pendingPower&&WH.possession.firing,before));
 ck('Cooldown keeps ability identity and remaining time visible',await page.evaluate(()=>document.querySelector('#touch-power strong').textContent==='Cyclone'&&/\ds/.test(document.querySelector('#touch-power .touch-cooldown').textContent)&&document.querySelector('#touch-power').disabled));
 await touch('touchEnd',2);await touch('touchEnd',1);await step();
 await page.screenshot({path:resolve(out,'landscape-combat.png')});
 // Every family uses the same recovery gate. A cancelled request must not
 // reappear on resume, and changing targets cannot spend two cooldowns.
 await page.evaluate(()=>WH.mode99.abilities.clock.tick(60));await touch('touchStart',2,fire);await step(2);await touch('touchStart',3,power);await touch('touchEnd',3);await tap('#touch-menu-open');
 ck('Opening a menu cancels queued actions and clears every held pointer',await page.evaluate(()=>!WH.mobile.pendingPower&&!WH.mobile.holds.size&&WH.mobile.stick.pointer===null&&!WH.possession.firing));
 points.clear();await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await tap('#touch-close');const old=await page.evaluate(()=>WH.mode99.abilities.events.length);await step(100);ck('Cancelled Power never fires after resume',await page.evaluate(n=>WH.mode99.abilities.events.length===n,old));
 for(const viewport of [{width:360,height:640},{width:390,height:844},{width:844,height:390},{width:1024,height:768}]){
  await page.setViewportSize(viewport);await step();
  const targets=await page.evaluate(()=>['fire','jump','special','power','aim','switch'].map(id=>{const e=document.querySelector('#touch-'+id),r=e.getBoundingClientRect();return {id,w:r.width,h:r.height,x:r.x,y:r.y,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e};}));
  ck(`Large actions have genuine hit areas at ${viewport.width}x${viewport.height}`,targets.every(t=>t.w>=64&&t.h>=64&&t.hit),targets);
  await page.screenshot({path:resolve(out,`actions-${viewport.width}x${viewport.height}.png`)});
 }
 ck('No runtime exceptions',!errors.length,errors);
}catch(e){errors.push(String(e));await page.screenshot({path:resolve(out,'failure.png')});}finally{writeFileSync(resolve(out,'report.json'),JSON.stringify({scope:'Native emulated multitouch plus same-frame visual equivalence, not physical-phone acceptance.',checks,errors},null,2));await browser.close();}if(errors.length||checks.some(c=>!c.ok))process.exitCode=1;
