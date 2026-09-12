// Browser input plus bounded fixtures for traversal, actual melee impact and death.
import {createRequire} from 'node:module';import {mkdirSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=process.env.WH_BASE_URL||'http://127.0.0.1:8139',out=resolve(process.argv[2]||'artifacts/expedition/play');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(180000);const check=(name,ok,detail)=>results.push({name,ok:!!ok,detail});
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__frames=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__frames)fn(t);});});
try{
 await page.goto(base+'/?map=ninetynine&campaign=0&seed=12345&commander=duelist&mount=strider');await page.waitForFunction(()=>window.WH?.mode99&&document.querySelector('#boot.done'));await page.locator('#btn-begin').click();
 await page.evaluate(()=>{__frames=false;WH.waves.canRaid=()=>false;WH.step(.1,60,false);document.activeElement.blur();});
 const sound=await page.locator('#btn-sound').innerHTML();await page.keyboard.press('m');
 check('M mounts without muting sound',await page.evaluate(()=>WH.mode99.commander.mountKey==='strider')&&sound===await page.locator('#btn-sound').innerHTML());await page.keyboard.press('n');check('N controls sound in 99 Planets',sound!==await page.locator('#btn-sound').innerHTML());await page.keyboard.press('n');await page.keyboard.press('m');
 await page.evaluate(()=>{WH.possession.enter(WH.mode99.commander);WH.possession.boom=WH.possession.boomWant=0;WH.step(.1,60,true);window.__start=WH.mode99.commander.dir.clone();});
 await page.keyboard.down('w');const accel=await page.evaluate(()=>{WH.step(1/60,60,false);return WH.possession.vel.x;});await page.keyboard.down('Shift');
 const movement=await page.evaluate(()=>{WH.step(1.2,60,true);const a=WH.mode99.commander,p=WH.possession;return{distance:__start.distanceTo(a.dir)*240,first:a.hidden,move:p.moveT,sprint:p.sprintT,finite:WH.rig.camera.matrixWorld.elements.every(Number.isFinite),fov:WH.rig.camera.fov};});
 check('Keyboard walk accelerates instead of snapping',accel>0&&accel<.3,accel);check('First-person sprint actually traverses with a finite camera',movement.distance>2&&movement.first&&movement.finite,movement);await page.screenshot({path:resolve(out,'first-person.png')});
 await page.keyboard.up('w');await page.keyboard.up('Shift');const stop=await page.evaluate(()=>{WH.step(.6,60,true);return WH.possession.vel.length();});check('Released movement settles without drift',stop<.01,stop);
 results.push(...await page.evaluate(async()=>{
  const W=WH,m=W.mode99,a=m.commander,T=await import(new URL('lib/three.module.min.js',location.href)),world=await import(new URL('js/world.js',location.href)),config=await import(new URL('js/config.js',location.href));const r=[],ck=(name,ok,detail)=>r.push({name,ok:!!ok,detail});
  const centre=W.nav.nodeDir(W.nav.heartNode,new T.Vector3()),dir=new T.Vector3(),up=new T.Vector3(0,1,0),fwd=new T.Vector3();if(Math.abs(centre.dot(up))>.9)up.set(1,0,0);fwd.crossVectors(centre,up).normalize();
  W.possession.exit();
  function travel(node,key){W.nav.nodeDir(node,a.dir);a.fwd.copy(fwd).addScaledVector(a.dir,-fwd.dot(a.dir)).normalize();a.height=world.terrainHeight(a.dir.x,a.dir.y,a.dir.z);a.moveNode=node;a.swimming=false;a.mountKey=key;m.mounts.update(0);m.update(0);const start=a.dir.clone();for(let i=0;i<30;i++)W.allies.driveUnit(a,1,0,1/60);return start.distanceTo(a.dir)*world.R;}
  const ground=W.nav.heartNode,groundDistances={};for(const key of ['none','strider','tideback','skyray'])groundDistances[key]=travel(ground,key);
  ck('Strider is fastest on real ground traversal',groundDistances.strider>groundDistances.none*1.45&&groundDistances.strider>groundDistances.tideback,groundDistances);
  let water=-1;for(let i=0;i<W.nav.n;i++){if(W.nav.height[i]>-2||!W.nav.walk[i])continue;W.nav.nodeDir(i,dir);if(world.waterDepthAt(dir)<1)continue;water=i;break;}
  const waterDistances={};if(water>=0)for(const key of ['none','strider','tideback'])waterDistances[key]=travel(water,key);
  ck('Tideback has a real ocean traversal advantage',water>=0&&waterDistances.tideback>waterDistances.none*2&&waterDistances.tideback>waterDistances.strider,waterDistances);
  a.dir.copy(centre);a.moveNode=ground;a.height=world.terrainHeight(a.dir.x,a.dir.y,a.dir.z);a.mountKey='skyray';W.possession.enter(a);W.possession.keys.add('Space');m.mounts.energy=12;
  for(let i=0;i<600;i++)m.mounts.update(1/60);ck('Sky Ray flies and cannot dismount in the air',a.mountFlying&&a.mountFlight===8&&!m.mounts.toggle(),{energy:m.mounts.energy,height:a.mountFlight});
  for(let i=0;i<240;i++)m.mounts.update(1/60);ck('Exhausted flight lands even while Space is held',m.mounts.energy===0&&a.mountFlight===0);W.possession.keys.delete('Space');for(let i=0;i<360;i++)m.mounts.update(1/60);ck('Grounded flight recharges',m.mounts.energy>11.9);
  a.mountKey='none';m.mounts.update(0);m.update(0);W.possession.boom=W.possession.boomWant=0;W.step(.1,60,false);config.PRESENTATION.bob=false;
  const cam=[];for(let i=0;i<120;i++){W.possession.stride=i*.23;W.possession.moveT=1;W.possession.placeCamera();cam.push(W.rig.camera.position.toArray());}
  ck('Bob-off removes periodic camera displacement',cam.every(v=>v.every((x,i)=>Math.abs(x-cam[0][i])<1e-8)));config.PRESENTATION.bob=true;
  W.possession.boom=W.possession.boomWant=5;W.step(.1,60,true);ck('Third person shows mounted-compatible body and camera',!a.hidden&&W.rig.camera.matrixWorld.elements.every(Number.isFinite));W.possession.exit();
  m.inventory.request({kind:'select',slot:0});m.update(0);const old={damage:a.type.strike.dmg,range:a.type.strike.range??a.type.strike.radius};W.give(1000);m.upgradeHeart();m.update(0);ck('Equipped loot scales its actual damage and reach',a.type.strike.dmg>old.damage&&(a.type.strike.range??a.type.strike.radius)>old.range,{before:old,after:a.type.strike});
  a.dir.copy(centre);a.height=world.terrainHeight(a.dir.x,a.dir.y,a.dir.z);a.moveNode=ground;a.hp=a.hpMax;
  const enemy=W.enemies.spawn('husk',ground,1);enemy.dir.copy(a.dir);enemy.height=a.height;enemy.fwd.copy(a.fwd);enemy.scanT=0;enemy.atkCd=0;W.enemies.atkScale=2.8;
  W.enemies._melee(enemy,.01);const wind=enemy.windT,damage=enemy.attackPlan?.damage||enemy.type.atk,hp=a.hp;W.enemies._melee(enemy,wind+.01);const loss=hp-a.hp;ck('Telegraphed enemy blow removes 2.8x actual commander health',loss>0&&Math.abs(loss-damage*2.8)<.01,{wind,damage,loss,hp:a.hpMax});
  const qdir=centre.clone().addScaledVector(fwd,30/world.R).normalize();m.weather.trigger('quake',qdir);while(m.weather.phase==='forecasting')m.weather.advanceShift();const t=performance.now();m.weather.update(8.01);const sim=W.enemies.time;W.step(.1,60,true);ck('Seismic transition holds combat and prevents placement',W.enemies.time===sim&&!W.game._validate(W.TOWER_TYPES.bolt).ok&&W.game.terrainBusy);
  let maxSlice=0,slices=0;while(W.game.terrainBusy){const time=performance.now();m.weather.advanceShift();maxSlice=Math.max(maxSlice,performance.now()-time);slices++;}
  ck('Earthquake refresh completes with changed terrain',m.weather.events.at(-1)?.vertices>0,{milliseconds:performance.now()-t,maxSlice,slices,event:m.weather.events.at(-1)});ck('Earthquake work yields to responsive frames',maxSlice<55&&slices>5,{maxSlice,slices});
  const oreEntry=m.oreField.entries.find(e=>!e.taken),oreBefore=m.ore.ore;a.dir.copy(oreEntry.dir);a.height=world.terrainHeight(a.dir.x,a.dir.y,a.dir.z);m.oreField.update(.1);m.oreField.update(.1);ck('Visible world ore is collected once on approach',oreEntry.taken&&m.ore.ore===oreBefore+oreEntry.amount);const oldOreId=oreEntry.id;m.oreField.add(centre,2);ck('Consumed ore slots can be reused for later nest drops with fresh identities',m.oreField.entries.some(e=>!e.taken&&e.id!==oldOreId&&e.amount===1));
  a.dir.copy(centre).addScaledVector(fwd,.6).normalize();a.height=world.terrainHeight(a.dir.x,a.dir.y,a.dir.z);W.allies.damage(a,a.hpMax*3);ck('Outside-base commander death actually defeats the run',W.game.state==='defeat'&&m.run.getPhase()==='defeat'&&m.respawn.remaining===0,{state:W.game.state,phase:m.run.getPhase()});
  W.step(.1,60,true);return r;
 }));await page.screenshot({path:resolve(out,'outside-defeat.png')});
}catch(e){errors.push(String(e));await page.screenshot({path:resolve(out,'error.png')}).catch(()=>{});}finally{writeFileSync(resolve(out,'report.json'),JSON.stringify({scope:'Browser input and instrumented traversal/combat fixtures; no unforced campaign claim.',base,results,errors},null,2));console.log(JSON.stringify({passed:results.filter(x=>x.ok).length,total:results.length,failed:results.filter(x=>!x.ok),errors}));await browser.close();}if(results.some(x=>!x.ok)||errors.length)process.exitCode=1;
