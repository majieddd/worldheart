import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/mobile/scenes'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8139';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),page=await context.newPage(),cdp=await context.newCDPSession(page),checks=[],errors=[];
page.setDefaultTimeout(25000);page.on('pageerror',e=>errors.push(String(e)));
const ck=(name,ok,actual)=>{checks.push({name,ok:!!ok,actual});console.log((ok?'PASS ':'FAIL ')+name);};
const tap=async selector=>{await page.locator(selector).tap();await page.waitForTimeout(150);};
const snap=name=>page.screenshot({path:resolve(out,name+'.png')});
const event=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
async function swipe(x,y,dx,dy){await event('touchStart',[{id:1,x,y}]);for(let i=1;i<=8;i++){await event('touchMove',[{id:1,x:x+dx*i/8,y:y+dy*i/8}]);await page.waitForTimeout(25);}await event('touchEnd',[]);await page.waitForTimeout(150);}
async function pinch(x,y){await event('touchStart',[{id:1,x:x-50,y},{id:2,x:x+50,y}]);await event('touchMove',[{id:1,x:x-75,y:y-5},{id:2,x:x+75,y:y+10}]);await event('touchEnd',[]);await page.waitForTimeout(150);}
async function station(key){await tap('#lobby-prepare');await tap(`[data-station="${key}"]`);}
try{
 await page.goto(base+'/lobby.html',{waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.LOBBY,null,{timeout:180000});
 ck('Lobby detects touch and keeps stations collapsed',await page.evaluate(()=>document.body.classList.contains('lobby-touch')&&getComputedStyle(document.querySelector('nav')).display==='none'));
 await snap('lobby-portrait');const before=await page.evaluate(()=>LOBBY.player.toArray()),r=await page.locator('#lobby-stick').boundingBox();
 await event('touchStart',[{id:1,x:r.x+r.width/2,y:r.y+15}]);await page.waitForTimeout(650);await event('touchEnd',[]);
 ck('Lobby joystick walks the actual commander',await page.evaluate(old=>LOBBY.player.distanceTo({x:old[0],y:old[1],z:old[2]})>.6,before));
 const yaw=await page.evaluate(()=>LOBBY.view.yaw);await swipe(170,350,65,20);ck('Lobby one-finger look turns the camera',await page.evaluate(old=>Math.abs(LOBBY.view.yaw-old)>.1,yaw));const distance=await page.evaluate(()=>LOBBY.view.distance);await pinch(180,380);ck('Lobby pinch zoom changes viewing distance',await page.evaluate(old=>LOBBY.view.distance<old,distance));
 await station('commanders');await tap('[data-commander="oracle"]');ck('Commander choice persists through touch selection',await page.evaluate(()=>LOBBY.selected.commander==='oracle'));await snap('lobby-commander');await tap('#close-station');
 await station('mounts');await tap('[data-mount="skyray"]');ck('Mount choice is touch accessible',await page.evaluate(()=>LOBBY.selected.mount==='skyray'));await tap('#close-station');
 await page.evaluate(async()=>{const {campaignStore}=await import(new URL('js/modes/campaign-store.js',location.href));campaignStore.commit(s=>{s.account.coins=120;return true;});});await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.LOBBY);
 await station('foundry');const owned=await page.evaluate(()=>LOBBY.profile.towers.length);await tap('#roll-tower');ck('Foundry roll spends coins once and adds one tower',await page.evaluate(old=>LOBBY.profile.coins===60&&LOBBY.profile.towers.length===old+1,owned));await page.locator('[data-tower]').last().tap();await page.waitForTimeout(150);await snap('lobby-foundry');await tap('#close-station');
 await station('mission');await snap('lobby-mission');await tap('#launch');await page.waitForFunction(()=>window.WH?.mobile&&document.querySelector('#boot.done'),null,{timeout:180000});
 ck('Lobby launches the selected commander and mount into the campaign',await page.evaluate(()=>WH.mode99.commander.typeKey==='oracle'&&WH.mode99.mounts.choice==='skyray'&&WH.mobile.enabled&&WH.mode99.campaign.state().planet===1));await snap('campaign-title');
 await page.goto(base+'/debug.html#weapons/sword-wood',{waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.DEBUG_WORLD,null,{timeout:180000});
 ck('Debug leaves most of the portrait viewport to the scene',await page.evaluate(()=>document.querySelector('#viewport').getBoundingClientRect().height>innerHeight*.7&&getComputedStyle(document.querySelector('aside')).display==='none'));
 await snap('debug-portrait');const debugYaw=await page.evaluate(()=>DEBUG_WORLD.view.yaw);await swipe(170,400,60,20);ck('Debug one-finger orbit rotates a real exhibit',await page.evaluate(old=>Math.abs(DEBUG_WORLD.view.yaw-old)>.1,debugYaw));
 const debugDist=await page.evaluate(()=>DEBUG_WORLD.view.distance);await pinch(180,420);ck('Debug pinch changes zoom',await page.evaluate(old=>DEBUG_WORLD.view.distance<old,debugDist));
 await tap('#debug-inspect');ck('Debug controls open with the first tap after a gesture',await page.evaluate(()=>document.body.classList.contains('debug-inspecting')));
 await tap('#next');ck('Exhibit navigation remains available',await page.evaluate(()=>DEBUG_WORLD.selected.key!=='sword-wood'));await page.locator('#motion').selectOption('attack');await page.waitForTimeout(150);await snap('debug-controls');await tap('#debug-inspect');
 await page.locator('[data-lane="themes"]').tap();await page.waitForTimeout(150);ck('All horizontally scrolling category buttons are reachable',await page.evaluate(()=>DEBUG_WORLD.selected.lane==='themes'));await snap('debug-theme');
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(350);await snap('debug-landscape');ck('Landscape Debug has no horizontal page overflow',await page.evaluate(()=>document.body.scrollWidth<=innerWidth));
 await page.goto(base+'/?map=ninetynine&campaign=0&seed=12345&terrain=varied&worldgen=1',{waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.WH?.worldgen&&document.querySelector('#boot.done'),null,{timeout:180000});
 ck('World generator starts collapsed for touch inspection',await page.evaluate(()=>!document.querySelector('#worldgen-panel').open));await swipe(340,170,80,20);await tap('#worldgen-panel summary');await page.locator('#worldgen-formation').selectOption({index:1});await page.waitForTimeout(800);ck('Worldgen formation selection focuses its actual camera',await page.evaluate(()=>document.querySelector('#worldgen-status').textContent.includes('Inside')||document.querySelector('#worldgen-status').textContent.includes('Elsewhere')));await snap('worldgen-controls');
 await page.locator('#worldgen-seed').fill('54321');await page.locator('#worldgen-form button[type="submit"]').tap();await page.waitForFunction(()=>window.WH?.worldgen&&document.querySelector('#boot.done')&&WH.CONFIG.requestedSeed===54321,null,{timeout:180000});ck('Touch form generates a different world',await page.evaluate(()=>WH.CONFIG.requestedSeed===54321));
 ck('No scene runtime errors',errors.length===0,errors);
}catch(e){errors.push(String(e));await snap('failure').catch(()=>{});}finally{writeFileSync(resolve(out,'report.json'),JSON.stringify({scope:'Real touch in lobby, launch, Debug and generator. Foundry gets 120 fixture coins; all other choices use normal UI.',checks,errors},null,2));await browser.close();}console.log(JSON.stringify({passed:checks.filter(x=>x.ok).length,total:checks.length,failed:checks.filter(x=>!x.ok),errors}));if(errors.length||checks.some(x=>!x.ok))process.exitCode=1;
