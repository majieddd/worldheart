// Injected frontier/loot fixtures, separate from the legal planet run.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/base-loot/check');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],faults=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>faults.push(String(e)));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 await page.goto(`${base}/?map=ninetynine&campaign=0&seed=12345&terrain=alpine`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
 await page.locator('#btn-begin').click();await page.waitForFunction(()=>getComputedStyle(document.getElementById('title-overlay')).opacity==='0');
 await page.evaluate(async()=>{__qaFramesEnabled=false;WH.game.paused=true;WH.rig.cancelFlight();window.__THREE=await import('three');window.__world=await import(new URL('js/world.js',location.href));window.__weapons=await import(new URL('js/run/weapons.js',location.href));});
 const check=(name,ok,actual)=>{checks.push({name,ok,actual});console.log(JSON.stringify({name,ok,actual}));};
 let previous=0;
 for(let level=0;level<=5;level++){
  if(level){
   const retained=await page.evaluate(()=>{WH.game.gold=1e6;WH.game.paused=false;WH.mode99.upgradeHeart();WH.game.paused=true;return Math.abs(WH.rig.targetDist-WH.rig.distMax)<.01;});
   check(`Level ${level} upgrade preserves fully zoomed-out intent`,retained);
  }
  for(const [width,height] of [[1280,720],[720,1280],[1920,720]]){
   await page.setViewportSize({width,height});
   for(const offset of [0,1]){
    const result=await page.evaluate(({offset,width,height})=>{
     const W=WH,r=W.rig,T=__THREE,c=W.nav.fieldCenter,theta=W.mode99.run.getFrontierTheta();
     const east=new T.Vector3(1,0,0).addScaledVector(c,-c.x).normalize(),axis=new T.Vector3().crossVectors(c,east).normalize();
     const north=new T.Vector3().crossVectors(c,east).normalize(),focus=c.clone().applyAxisAngle(axis,offset*theta);
     r.lat=Math.asin(focus.y);r.lon=Math.atan2(focus.x,focus.z);r.viewYaw=.6;r.tiltOffset=0;r.velLon=r.velLat=0;r.flight=null;r.setAspect(width/height);
     r.dist=r.targetDist=r.distMax;W.step(2);
     let outside=0,maxNdc=0,behind=0;
     for(const ring of [0,.5,1])for(let i=0;i<96;i++){
      const a=i*Math.PI/48,p=c.clone().multiplyScalar(Math.cos(theta*ring)).addScaledVector(east,Math.sin(theta*ring)*Math.cos(a)).addScaledVector(north,Math.sin(theta*ring)*Math.sin(a)).normalize();
      const world=__world.surfacePoint(p,new T.Vector3()),projected=world.clone().project(r.camera);
      maxNdc=Math.max(maxNdc,Math.abs(projected.x),Math.abs(projected.y));
      if(Math.abs(projected.x)>.94||Math.abs(projected.y)>.94||projected.z>1||projected.z< -1)outside++;
      if(r.camera.position.dot(p)<W.CONFIG.planetRadius)behind++;
     }
     return {level:W.mode99.run.getHeartLevel(),theta,max:r.distMax,dist:r.dist,outside,maxNdc,behind};
    },{offset,width,height});
    check(`Level ${level} ${width}x${height} ${offset?'edge':'heart'} overview`,result.level===level&&result.outside===0&&result.behind===0,result);
    if(width===1280&&!offset){check(`Level ${level} zoom ceiling grows`,result.max>previous,{previous,next:result.max});previous=result.max;}
   }
  }
 }
 await page.setViewportSize({width:1280,height:720});await page.locator('#btn-home').click();await page.evaluate(()=>{WH.step(2);WH.rig.dist=WH.rig.targetDist=WH.rig.distMax;WH.step(2);});
 await page.screenshot({path:resolve(out,'level-5-overview.png')});
 const pickup=await page.evaluate(()=>{
  const W=WH,m=W.mode99,u=W.allies.active.find(a=>a.type.commander),id='auto-pickup-fixture';
  const item=__weapons.generateWeapon({id,seed:77,family:'sword',rng:()=>.5});m.inventory.register(item);m.loot.add(item,u.dir);
  const before=m.inventory.snapshot();W.game.paused=false;W.step(.1);W.game.paused=true;
  return {picked:m.inventory.items.some(x=>x.id===id),ground:m.loot.entries.has(id),slotsUnchanged:JSON.stringify(before.slots)===JSON.stringify(m.inventory.slots),activeUnchanged:before.active===m.inventory.active};
 });
 check('Nearby weapon enters inventory automatically without equipping',pickup.picked&&!pickup.ground&&pickup.slotsUnchanged&&pickup.activeUnchanged,pickup);
 const guards=await page.evaluate(()=>{
  const W=WH,m=W.mode99,u=W.allies.active.find(a=>a.type.commander),inv=m.inventory,results=[];
  const add=(id,dir=u.dir)=>{const item=__weapons.generateWeapon({id,seed:77,family:'sword',rng:()=>.5});inv.register(item);m.loot.add(item,dir);return item;};
  const has=id=>inv.items.some(x=>x.id===id),tick=()=>W.step(.05),record=(name,ok,actual)=>results.push({name,ok,actual});
  add('pause-loot');W.game.paused=true;tick();record('Paused play leaves nearby drops on the ground',!has('pause-loot')&&m.loot.entries.has('pause-loot'));
  W.game.paused=false;W.possession.enter(u);tick();record('First-person commander automatically collects',has('pause-loot')&&!m.loot.entries.has('pause-loot'));
  add('third-loot');W.possession.boomWant=5;tick();record('Third-person commander automatically collects',has('third-loot'));
  add('far-loot',u.dir.clone().addScaledVector(u.fwd,12/240).normalize());tick();record('Distant loot is left for exploration',!has('far-loot')&&m.loot.entries.has('far-loot'));
  const vertical=add('vertical-loot'),entry=m.loot.entries.get(vertical.id);entry.position.addScaledVector(u.dir,12);entry.group.position.copy(entry.position);tick();record('Pickup respects vertical distance',!has(vertical.id)&&m.loot.entries.has(vertical.id));
  const active=inv.active,slots=JSON.stringify(inv.slots);u.swingT=.1;u.strikePending=true;add('combat-loot');tick();record('Collection during combat preserves equipment',has('combat-loot')&&inv.active===active&&JSON.stringify(inv.slots)===slots);
  const dead=add('dead-loot');u.dead=true;m.update(.01);u.dead=false;record('Dead commanders cannot collect',!has(dead.id)&&m.loot.entries.has(dead.id));tick();
  while(inv.items.length-inv.slots.filter(Boolean).length<12){const item=add('fill-'+inv.items.length);if(!inv.pickup(item.id))throw Error('Could not fill fixture inventory');m.loot.remove(item.id);}
  const overflow=add('overflow-loot'),before=inv.snapshot();tick();record('Full backpack keeps overflow on the ground without salvage',JSON.stringify(inv.snapshot())===JSON.stringify(before)&&m.loot.entries.has(overflow.id));
  inv.salvage('combat-loot');tick();record('Making backpack space collects waiting nearby loot',has(overflow.id)&&!m.loot.entries.has(overflow.id));
  record('A claimed item cannot be collected twice',!m.weapons.pickup(overflow.id)&&!inv.register(overflow)&&inv.items.filter(x=>x.id===overflow.id).length===1);
  inv.salvage('third-loot');W.possession.exit();
  m.run.completeWave();m.run.completeWave();add('draft-loot');tick();record('Draft choices suspend automatic pickup',m.run.getPhase()==='drafting'&&!has('draft-loot'));
  m.run.vote('solo',0);m.update(0);tick();record('Pickup resumes after the draft',has('draft-loot'));
  W.game.paused=true;return results;
 });
 for(const r of guards)check(r.name,r.ok,r.actual);
 // Keyboard inventory is the normal possession flow. A pointer-lock request
 // from the compressed enter/exit fixture can still be pending after evaluate.
 await page.keyboard.press('KeyI');await page.waitForFunction(()=>document.getElementById('weapon-dialog').open,{},{polling:50});
 check('Inventory opens through normal keyboard input after collecting loot',await page.locator('#weapon-dialog').isVisible());
 await page.screenshot({path:resolve(out,'auto-loot-inventory.png')});
 await page.goto(`${base}/?map=ninetynine&campaign=1&seed=12345`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
 await page.locator('#btn-begin').click();
 await page.evaluate(()=>{__qaFramesEnabled=false;for(let wave=1;wave<=15;wave++){WH.waves.wave=wave;WH.waves.onWaveClear(wave,0);if(WH.mode99.run.getDraft()){WH.mode99.run.vote('solo',0);WH.mode99.update(0);}}});
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('end-overlay')).opacity==='1',{},{polling:50});
 await page.locator('#btn-continue').click();
 const victory=await page.evaluate(async()=>{
  const {generateWeapon}=await import(new URL('js/run/weapons.js',location.href)),W=WH,m=W.mode99,u=W.allies.active.find(a=>a.type.commander);
  const item=generateWeapon({id:'victory-auto-loot',seed:91,family:'sword',rng:()=>.5});m.inventory.register(item);m.loot.add(item,u.dir);W.step(.1);
  return {phase:m.run.getPhase(),picked:m.inventory.items.some(x=>x.id===item.id),saved:m.campaign.state().assault.victory.inventory.items.some(x=>x.id===item.id)};
 });
 check('Victory salvage automatically collects and saves loot',victory.phase==='victory'&&victory.picked&&victory.saved,victory);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
 await page.locator('#btn-begin').click();await page.evaluate(()=>{__qaFramesEnabled=false;});
 check('Victory reload retains the automatically collected identity',await page.evaluate(()=>WH.mode99.inventory.items.filter(x=>x.id==='victory-auto-loot').length===1));
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('end-overlay')).opacity==='1',{},{polling:50});
 await Promise.all([page.waitForEvent('load',{timeout:180000}),page.locator('#btn-extract').click()]);
 await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
 check('Extraction carries automatic loot to planet two exactly once',await page.evaluate(()=>WH.mode99.campaign.state().planet===2&&WH.mode99.inventory.items.filter(x=>x.id==='victory-auto-loot').length===1));
}catch(error){faults.push(String(error));throw error;}
finally{await browser.close();writeFileSync(resolve(out,'results.json'),JSON.stringify({base,scope:'Injected frontier upgrades, loot and terminal-wave fixtures; actual renderer/projection and normal update/save transactions',checks,faults,pass:checks.every(c=>c.ok)&&!faults.length},null,2)+'\n');if(checks.some(c=>!c.ok)||faults.length)process.exitCode=1;}
