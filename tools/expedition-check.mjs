import {createRequire} from 'node:module';import {mkdirSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=process.env.WH_BASE_URL||'http://127.0.0.1:8139',out=resolve(process.argv[2]||'artifacts/expedition/runtime');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(180000);
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__frames=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__frames)fn(t);});});
try{
 await page.goto(base+'/?map=ninetynine&campaign='+(process.argv.includes('--standalone')?'0':'1')+'&seed=12345&commander=marksman&mount=skyray');await page.waitForFunction(()=>window.WH?.mode99&&document.querySelector('#boot.done'));
 await page.locator('#btn-begin').click();
 const report=await page.evaluate(async()=>{
  __frames=false;const W=WH,m=W.mode99,g=W.game,T=await import(new URL('lib/three.module.min.js',location.href)),world=await import(new URL('js/world.js',location.href));
  const results=[],check=(name,ok,detail)=>{results.push({name,ok:!!ok,detail});};
  W.waves.canRaid=()=>false;W.step(.1,60,false);let a=m.commander;
  check('Chosen commander launches',a.typeKey==='marksman',a.typeKey);check('Chosen mount carries into game',m.mounts.choice==='skyray');
  check('Global graph exists at boot',W.nav.global&&W.nav.n>250000,W.nav.n);
  const far=W.nav.nearestNode(a.dir.clone().negate());check('Antipode has a real graph cell',far>=0&&W.nav.nodeDir(far,new T.Vector3()).dot(a.dir)<-.999);
  const before={hp:a.hpMax,power:a.type.strike.dmg,range:a.type.strike.range,speed:a.type.speed};W.give(50000);m.upgradeHeart();W.step(.1,60,false);
  check('Base upgrade raises actual health',a.hpMax>before.hp,{before:before.hp,after:a.hpMax});check('Native weapon damage and range grow',a.type.strike.dmg>before.power&&a.type.strike.range>before.range,{before,after:a.type.strike});check('Base upgrade raises actual movement speed',a.type.speed>before.speed);
  const stable=a.hpMax;for(let i=0;i<10;i++)m.update(0);check('Stat sync never compounds',a.hpMax===stable);
  m.mounts.toggle();m.update(0);W.step(.1,60,false);check('Mount has real model and damage tradeoff',a.mountKey==='skyray'&&m.mounts.models.skyray.group.visible&&a.type.strike.dmg<before.power*1.12,{damage:a.type.strike.dmg});
  W.possession.enter(a);W.possession.keys.add('Space');m.mounts.update(2);check('Sky Ray rises and spends energy',a.mountFlight>0&&m.mounts.energy===10);W.possession.keys.delete('Space');m.mounts.update(3);check('Flight release descends',a.mountFlight===0);m.mounts.toggle();m.update(0);W.possession.exit();
  const centre=W.nav.nodeDir(W.nav.heartNode,new T.Vector3());a.dir.copy(centre);a.height=world.terrainHeight(a.dir.x,a.dir.y,a.dir.z);
  m.ore.collect('qa-forge',3);const oldHand=m.run.getHand().length,oldGold=g.gold;const tower=m.craft();check('Ore crafts a usable card',!!tower&&m.ore.ore===0&&m.run.getHand().length===oldHand+1,tower);check('Craft pays resource and grants free placement',g.gold===oldGold&&g._cost(W.TOWER_TYPES[tower])===0);
  // Complete the authorized free placement through the game's real footprint/card path.
  const slot=m.run.getHand().lastIndexOf(tower);g.toggleBuildCard(slot);let placed=false;
  const up=new T.Vector3(0,1,0);if(Math.abs(up.dot(centre))>.9)up.set(1,0,0);const side=new T.Vector3().crossVectors(centre,up).normalize(),forward=new T.Vector3().crossVectors(centre,side).normalize();
  for(let r=5;r<=12&&!placed;r+=1.5)for(let k=0;k<20&&!placed;k++){const d=centre.clone().addScaledVector(side,Math.cos(k/20*6.283)*r/240).addScaledVector(forward,Math.sin(k/20*6.283)*r/240).normalize();g.cursorDir.copy(d);world.surfacePoint(d,g.cursorPos);g.cursorValid=true;if(g._validate(W.TOWER_TYPES[tower]).ok){const count=W.towers.towers.length;g._tryPlace();placed=W.towers.towers.length===count+1;}}
  check('Forged card places without gold and consumes its credit',placed&&g.gold===oldGold&&g._cost(W.TOWER_TYPES[tower])>0);const footprint=W.nav.block.slice();
  a.dir.copy(centre);const oldId=a.id;W.allies.damage(a,a.hpMax*2);check('Inside death starts recovery instead of defeat',g.state==='playing'&&m.respawn.remaining===30&&m.run.getPhase()==='building');
  const reserved=a;W.allies.spawn('warden',centre,centre,3);check('Dead commander identity cannot become a pooled warden',reserved.typeKey==='marksman'&&!reserved.active);
  g.paused=true;W.step(6,60,false);check('Pause freezes respawn',m.respawn.remaining===30);g.paused=false;W.step(29,30,false);check('Respawn is not early',m.respawn.remaining>.9&&m.commander.id===oldId);W.step(1.1,30,false);a=m.commander;
  check('Respawn restores same class, inventory and scaled health',a.active&&!a.dead&&a.id!==oldId&&a.typeKey==='marksman'&&a.hpMax===stable,{id:a.id,hp:a.hpMax,remaining:m.respawn.remaining});
  W.allies.damage(a,a.hpMax*2);W.step(30.1,30,false);check('Repeated safe deaths recover again',m.commander.active);a=m.commander;
  // Advance a storm warning through the same injected simulation adapter.
  m.weather.trigger('tornado',a.dir);m.weather.update(8.1);m.weather.update(.3);check('Tornado actually lifts a unit',a.weatherLift>.1,{lift:a.weatherLift,events:m.weather.events});m.weather.update(20);m.weather.update(2);check('Weather lift settles after storm',a.weatherLift===0);
  const point=centre.clone().addScaledVector(forward,26/240).normalize(),heightBefore=world.terrainHeight(point.x,point.y,point.z),nodes=W.nav.n,blockRef=W.nav.block;
  m.weather.trigger('quake',point);while(m.weather.phase==='forecasting')m.weather.advanceShift();m.weather.update(8.1);while(g.terrainBusy)m.weather.advanceShift();const quake=m.weather.events.at(-1);check('Quake deforms visible terrain and retains topology',quake?.kind==='quake'&&quake.strength>0&&quake.vertices>0&&quake.changedNodes>0&&W.nav.n===nodes&&W.nav.block===blockRef,quake);
  check('Tower footprint ownership survives quake',footprint.every((x,i)=>x===W.nav.block[i]));check('Quake changes shared terrain height',world.terrainHeight(point.x,point.y,point.z)!==heightBefore,{before:heightBefore,after:world.terrainHeight(point.x,point.y,point.z)});
  for(let i=m.run.getHeartLevel();i<10;i++)m.upgradeHeart();check('Paid maximum base covers globe',m.run.getFrontierTheta()===Math.PI&&g.frontier.theta===Math.PI);check('Full base removes collapsed antipode wall',!W.world.fieldWall.mesh.visible);W.rig.dist=W.rig.targetDist=W.rig.distMax;W.rig.update(.1);check('Global camera is finite and can zoom to full globe',W.rig.distMax>240*2&&W.rig.camera.matrixWorld.elements.every(Number.isFinite));
  // Scripted wave-clear fixture tests the shell's victory/Endless/save transition, not combat skill.
  for(let w=1;w<=10;w++){W.waves.wave=w;W.waves.clearedWaves=w;W.waves.onWaveClear(w,0);if(m.run.getDraft()){m.run.vote('solo',0);m.update(0);}}
  check('Wave ten produces the victory choice',m.run.getPhase()==='victory'&&document.querySelector('#end-overlay.show'));
  check('Endless begins only by explicit action',m.startEndless()&&W.waves.endless&&m.run.getWave()===11&&!g.paused);
  const saved=await import(new URL('js/modes/campaign-store.js',location.href));check('Endless respects campaign or sandbox ownership',W.CONFIG.campaign?saved.campaignStore.expeditionStatus()==='assault':!saved.campaignStore.expeditionStatus());
  W.waves.canRaid=()=>true;W.waves.countdown=0;W.waves.update(.1);check('Wave eleven has a physical nest and queued enemies',W.waves.wave===11&&W.waves.queues.some(q=>q.wave===11),{wave:W.waves.wave,nests:W.waves.nestSources.length});check('Enemies have stronger real attack multiplier',W.enemies.atkScale>=2.8,W.enemies.atkScale);
  // Return to base and cash out without fabricating a wave-clear reward.
  a.dir.copy(centre);W.waves.canRaid=()=>false;check('Endless can finish at the base',m.finishEndless()&&m.run.getPhase()==='victory');
  document.querySelector('#btn-continue').click();W.possession.exit();W.rig.cancelFlight();W.rig.dist=W.rig.targetDist=80;W.rig.frontierTheta=.52;W.rig.confine.maxAng=.5252;for(let i=0;i<60;i++)W.rig.update(1/60);const camera=W.camTest();check('Shared camera harness',camera.pass,camera.checks.filter(x=>!x.ok));
  W.step(.1,60,true);return results;
 });
 await page.screenshot({path:resolve(out,'game-checkpoint.png')});writeFileSync(resolve(out,'report.json'),JSON.stringify({scope:'Instrumented gameplay fixtures; injected setup gold/ore and wave-clear events are not unforced combat evidence.',base,results:report,errors},null,2));console.log(JSON.stringify({pass:report.filter(x=>x.ok).length,total:report.length,failed:report.filter(x=>!x.ok),errors}));if(report.some(x=>!x.ok)||errors.length)process.exitCode=1;
}catch(e){console.log(e);await page.screenshot({path:resolve(out,'error.png')}).catch(()=>{});writeFileSync(resolve(out,'error.json'),JSON.stringify({message:String(e),errors},null,2));process.exitCode=1;}finally{await browser.close();}
