// Touch-input acceptance uses Chrome's real multi-touch dispatch. Fixtures
// isolate action routing; they do not stand in for an unassisted campaign.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/mobile/check'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8139';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),page=await context.newPage(),cdp=await context.newCDPSession(page);
const checks=[],errors=[];const ck=(name,ok,actual)=>{checks.push({name,ok:!!ok,actual});console.log((ok?'PASS ':'FAIL ')+name+(ok?'':' '+JSON.stringify(actual)));};page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(20000);
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__frames=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__frames)fn(t);});});
const step=async(n=12)=>page.evaluate(n=>{for(let i=0;i<n;i++)WH.step(1/60,60,true);},n);
const tap=async selector=>{await page.locator(selector).tap();await page.waitForTimeout(120);await step();};
const rect=selector=>page.locator(selector).boundingBox();
const at=(r,x=.5,y=.5)=>({x:r.x+r.width*x,y:r.y+r.height*y});
const points=new Map();
// CDP releases the supplied ids, not the remaining DOM TouchList. Supplying
// survivors ended the movement/fire fingers when a third skill finger lifted.
async function touch(type,id,x=0,y=0){const ending=points.get(id);if(type==='touchEnd'||type==='touchCancel')points.delete(id);else points.set(id,{id,x,y,radiusX:4,radiusY:4,force:1});await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[ending]:type==='touchCancel'?[]:[...points.values()]});await page.waitForTimeout(20);}
async function swipe(x,y,dx,dy){await touch('touchStart',1,x,y);for(let i=1;i<=8;i++){await touch('touchMove',1,x+dx*i/8,y+dy*i/8);await step(2);}await touch('touchEnd',1);await step();}
const snap=async name=>{await page.screenshot({path:resolve(out,name+'.png')});};
try{
 await page.goto(base+'/?map=ninetynine&campaign=0&seed=12345&commander=marksman&mount=skyray',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.WH?.mobile&&document.querySelector('#boot.done'),null,{timeout:180000});
 ck('Touch controls detect a mobile browser',await page.evaluate(()=>WH.mobile.enabled&&WH.possession.touchEnabled));
 ck('Start and commander choice fit the initial portrait viewport',await page.evaluate(()=>['btn-begin','starting-commander'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;})));
 await snap('portrait-title');await page.locator('#btn-begin').tap();await page.waitForTimeout(1900);
 await page.evaluate(()=>{__frames=false;WH.waves.update=()=>{};WH.waves.canRaid=()=>false;});await step();
 const unique=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.filter((id,i)=>ids.indexOf(id)!==i);});ck('No duplicated control identities',unique.length===0,unique);
 await snap('portrait-strategy');await tap('#touch-commander');ck('Commander button enters real possession',await page.evaluate(()=>WH.possession.unit===WH.mode99.commander));
 await tap('#touch-camera');await step(35);ck('First person works without Pointer Lock',await page.evaluate(()=>WH.possession.boom<.35&&!document.pointerLockElement));
 const facing=await page.evaluate(()=>({f:WH.mode99.commander.fwd.toArray(),pitch:WH.possession.pitch}));await swipe(225,350,65,-40);
 ck('Drag looks without attacking',await page.evaluate(old=>WH.mode99.commander.fwd.distanceTo({x:old.f[0],y:old.f[1],z:old.f[2]})>.02&&WH.possession.pitch>old.pitch&&!WH.possession.firing,facing));
 await tap('#touch-aim');ck('Aim is a usable toggle',await page.evaluate(()=>WH.possession.aiming));await step(35);ck('Aim narrows the actual lens',await page.evaluate(()=>WH.possession.aimT>.95&&WH.rig.camera.fov<WH.possession.baseFov*.85));await tap('#touch-aim');
 const start=await page.evaluate(()=>WH.mode99.commander.dir.toArray()),stick=at(await rect('#touch-stick'),.5,.22),fire=at(await rect('#touch-fire'));
 await touch('touchStart',1,stick.x,stick.y+50);await touch('touchMove',1,stick.x,stick.y);await touch('touchStart',2,fire.x,fire.y);await step(20);
 ck('Movement and attack work simultaneously',await page.evaluate(old=>WH.possession.touchInput.forward>.4&&WH.possession.firing&&WH.mode99.commander.dir.distanceTo({x:old[0],y:old[1],z:old[2]})>1e-5,start));
 const yaw=await page.evaluate(()=>WH.mode99.commander.fwd.toArray());
 for(let i=1;i<=6;i++){await touch('touchMove',2,fire.x-i*7,fire.y-i*4);await page.waitForTimeout(25);await step(3);}await step(15);
 const steering=await page.evaluate(old=>({distance:WH.mode99.commander.fwd.distanceTo({x:old[0],y:old[1],z:old[2]}),firing:WH.possession.firing,held:WH.mobile.holds.size,queue:WH.possession.yawQueue}),yaw);
 ck('Attack finger also steers aim',steering.distance>.01&&steering.firing,steering);
 await touch('touchEnd',2);await touch('touchEnd',1);await step();ck('Lifting fingers releases held actions',await page.evaluate(()=>!WH.possession.firing&&WH.possession.touchInput.forward===0));
 await tap('#touch-sprint');ck('Run toggle enables sprint intent',await page.evaluate(()=>WH.possession.touchInput.sprint));
 await tap('#touch-jump');ck('Touch Jump performs a real jump',await page.evaluate(()=>WH.mode99.commander.airT>0||WH.mode99.commander.hop>0));await step(100);
 const beforeSkill=await page.evaluate(()=>WH.mode99.abilities.events.length);await tap('#touch-special');ck('Commander ability activates from touch',await page.evaluate(n=>WH.mode99.abilities.events.length===n+1,beforeSkill));
 await tap('#touch-power');ck('Weapon special activates from touch',await page.evaluate(()=>WH.mode99.abilities.events.at(-1)?.which==='weapon'));
 const active=await page.evaluate(()=>WH.mode99.inventory.active);await tap('#touch-switch');await step(90);ck('Swap changes the equipped attack after recovery',await page.evaluate(old=>WH.mode99.inventory.active!==old,active));
 await snap('portrait-first-person');
 await tap('#touch-menu-open');ck('Field menu pauses and clears all combat intent',await page.evaluate(()=>WH.game.paused&&WH.possession.suspended&&!WH.possession.firing&&WH.possession.touchInput.forward===0));
 await tap('#touch-tab-base');if(!await page.locator('#expedition-tools').getAttribute('open'))await tap('#expedition-tools summary');await snap('portrait-base-menu');
 await tap('#mount-toggle');ck('Mount is available without a keyboard',await page.evaluate(()=>WH.mode99.commander.mountKey==='skyray'&&!WH.game.paused&&!WH.mobile.menu.open));
 const jump=at(await rect('#touch-jump'));await touch('touchStart',1,jump.x,jump.y);await step(45);ck('Held Rise flies and consumes mount energy',await page.evaluate(()=>WH.mode99.commander.mountFlight>1&&WH.mode99.mounts.energy<12));await touch('touchEnd',1);await step(110);ck('Releasing Rise lands the mount',await page.evaluate(()=>WH.mode99.commander.mountFlight===0));
 await tap('#touch-menu-open');await tap('#touch-weapons');ck('Weapons drawer owns pause after switching menus',await page.evaluate(()=>document.querySelector('#weapon-dialog').open&&WH.game.paused));
 await snap('portrait-weapons');await tap('#weapon-dialog [data-action="select"][data-slot="native"]');ck('Native attack can be selected in the inventory',await page.evaluate(()=>WH.mode99.inventory.active==='native'||WH.mode99.inventory.pending));
 await tap('#weapon-dialog [data-action="close"]');ck('Inventory resumes touch control',await page.evaluate(()=>!WH.game.paused&&!WH.possession.suspended));
 await touch('touchStart',1,stick.x,stick.y);await touch('touchStart',2,fire.x,fire.y);await step();points.clear();await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await step();ck('Touch cancellation cannot stick movement or fire',await page.evaluate(()=>!WH.possession.firing&&WH.possession.touchInput.forward===0));
 await tap('#touch-commander');ck('Strategy button releases linked possession',await page.evaluate(()=>!WH.possession.active));
 const pan=await page.evaluate(()=>[WH.rig.lon,WH.rig.lat]);await swipe(180,360,50,40);ck('One-finger strategy pan moves the view and stays finite',await page.evaluate(old=>WH.rig.camera.position.toArray().every(Number.isFinite)&&Math.hypot(WH.rig.lon-old[0],WH.rig.lat-old[1])>.001,pan));
 const beforePinch=await page.evaluate(()=>{window.__taps=0;const old=WH.rig.onTap;WH.rig.onTap=(...args)=>{__taps++;old(...args);};return WH.rig.targetDist;});
 await touch('touchStart',1,120,370);await touch('touchStart',2,270,370);await touch('touchMove',1,95,365);await touch('touchMove',2,290,380);await step();await touch('touchEnd',2);await touch('touchMove',1,100,366);await touch('touchEnd',1);await step();
 ck('Pinch zoom changes distance without a tap or selection',await page.evaluate(old=>WH.rig.targetDist!==old&&__taps===0,beforePinch));
 await tap('#touch-menu-open');await tap('#touch-tab-squad');await tap('#touch-visible');ck('Visible squad selection is touch accessible',await page.evaluate(()=>WH.mode99.orders.selection.length>0&&WH.mobile.orderMode==='move'));
 await tap('#touch-order-done');await tap('#touch-build');await snap('portrait-build');await tap('#touch-menu .build-card');
 const held=await page.evaluate(()=>({cards:WH.game.hand.length,gold:WH.game.gold}));await page.touchscreen.tap(190,340);await step();ck('Placement tap only previews, never spends',await page.evaluate(old=>WH.game.gold===old.gold&&WH.game.hand.length===old.cards,held));await tap('#touch-cancel');ck('Cancel returns the unspent card',await page.evaluate(old=>!WH.game.buildType&&WH.game.hand.length===old.cards,held));
 await tap('#touch-menu-open');await tap('#touch-tab-options');await snap('portrait-options');await tap('#touch-keep-paused');await tap('#touch-close');ck('Explicit pause survives menu closing',await page.evaluate(()=>WH.game.paused));await tap('#touch-resume');
 for(const viewport of [{width:844,height:390},{width:640,height:360},{width:568,height:320},{width:360,height:640},{width:768,height:1024},{width:1024,height:768}]){
   await page.setViewportSize(viewport);await step();await tap('#touch-commander');await step(35);
   const layout=await page.evaluate(()=>{const ids=['touch-menu-open','touch-status','touch-stick','touch-fire','touch-jump','touch-special','touch-power','touch-switch'];return {width:innerWidth,overflow:document.body.scrollWidth,controls:ids.map(id=>{const el=document.getElementById(id),r=el.getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height,visible:!el.hidden,inside:r.x>=0&&r.y>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5};})};});
   ck(`Controls fit ${viewport.width}x${viewport.height} with 44px targets`,layout.overflow<=layout.width&&layout.controls.every(r=>!r.visible||r.inside&&r.w>=44&&r.h>=44),layout);
   // Count painted panels, not the transparent floating-stick capture zone.
   // Hit rectangles still have independent overlap and aim-clearance checks.
   const density=await page.evaluate(()=>{const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden',rect=e=>{const r=e.getBoundingClientRect();return{id:e.id||e.className,x:r.x,y:r.y,w:r.width,h:r.height};},buttons=[...document.querySelectorAll('#touch-hud button,.touch-stick')].filter(visible).map(rect),overlap=[];for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){const a=buttons[i],b=buttons[j];if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1)overlap.push([a.id,b.id]);}const boxes=[...document.querySelectorAll('#touch-hud button,.touch-stick-pad,.touch-wave,.touch-vitals,.touch-boss')].filter(visible),painted=boxes.reduce((sum,e)=>{const r=rect(e),corner=getComputedStyle(e).borderTopLeftRadius,radius=Math.min(r.w/2,r.h/2,parseFloat(corner)*(corner.includes('%')?Math.min(r.w,r.h)/100:1)||0);return sum+r.w*r.h-(4-Math.PI)*radius*radius;},0);return {overlap,area:painted/(innerWidth*innerHeight),hitArea:buttons.reduce((sum,r)=>sum+r.w*r.h,0)/(innerWidth*innerHeight),aimClear:!buttons.some(r=>innerWidth/2>=r.x&&innerWidth/2<=r.x+r.w&&innerHeight/2>=r.y&&innerHeight/2<=r.y+r.h)};});
   ck(`Touch targets never overlap and leave aiming clear at ${viewport.width}x${viewport.height}`,!density.overlap.length&&density.aimClear&&density.area<.38,density);
   await snap(`commander-${viewport.width}x${viewport.height}`);await tap('#touch-commander');
 }
 await page.setViewportSize({width:390,height:844});await step();
 await tap('#touch-menu-open');await tap('#touch-tab-options');await page.locator('#touch-handed').check();await step();await tap('#touch-close');await tap('#touch-commander');await step(30);
 ck('Left-handed layout mirrors the thumb zones',await page.evaluate(()=>document.querySelector('#touch-stick').getBoundingClientRect().x>document.querySelector('#touch-fire').getBoundingClientRect().x));
 await tap('#touch-menu-open');await tap('#touch-tab-options');await page.locator('#touch-preference').selectOption('off');await step();
 ck('Hybrid device can restore original desktop controls',await page.evaluate(()=>!WH.mobile.enabled&&document.querySelector('#build-bar').closest('.hud-bottom')&&!WH.possession.touchEnabled));
 ck('No browser runtime exceptions',errors.length===0,errors);
}catch(e){errors.push(String(e));await snap('failure').catch(()=>{});}finally{writeFileSync(resolve(out,'report.json'),JSON.stringify({scope:'Real emulated multi-touch and rendered layouts with isolated simulation fixtures. Physical phone testing is separate.',checks,errors},null,2));await browser.close();}
console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok),errors}));if(errors.length||checks.some(c=>!c.ok))process.exitCode=1;
