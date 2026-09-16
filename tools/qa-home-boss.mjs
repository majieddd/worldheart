import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json'));
const {chromium}=require('playwright'),base=(process.env.WH_BASE_URL||'http://127.0.0.1:8141').replace(/\/$/,''),out=process.argv[2]||'artifacts/home-boss/local';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),checks=[],errors=[];
page.setDefaultNavigationTimeout(180000);
page.on('pageerror',e=>errors.push(String(e)));
const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name+' '+JSON.stringify(detail));};
const ready=async(p=page)=>{await p.waitForFunction(()=>(window.WH?.mode99&&document.querySelector('#boot.done'))||document.querySelector('#boot-status')?.textContent.startsWith('Boot failed'),null,{timeout:180000});const failure=await p.locator('#boot-status').textContent();if(failure.startsWith('Boot failed'))throw Error(failure);};
const clickWave=async()=>{await page.evaluate(()=>document.exitPointerLock?.());await page.locator('#home-wave-toggle').click();};
const state=()=>page.evaluate(()=>({playing:WH.game.state,active:WH.mode99.home.active,quiet:WH.mode99.home.quiet,level:WH.mode99.run.getHeartLevel(),wave:WH.mode99.run.getWave(),cleared:WH.mode99.run.checkpoint().wavesCleared,checkpoint:WH.mode99.home.record?.defenseCheckpoint?.run.wavesCleared,possessed:WH.possession.unit===WH.mode99.commander,boom:WH.possession.boomWant,veil:WH.world.fogVeil?.mesh.visible,cloud:WH.world.cloudDeck?.mesh.visible,fog:!!WH.game.scene.fog,seed:WH.CONFIG.seed,theme:WH.CONFIG.environment.theme,min:WH.rig.distMin,max:WH.rig.distMax,title:document.querySelector('#title-overlay').classList.contains('show')}));
let s;
try{
 if(!process.argv.includes('--conquest-only')){
 await page.goto(base+'/lobby.html#homeworld');await page.getByRole('link',{name:'Go to Homeworld'}).waitFor({timeout:60000});
 check('Fresh lobby offers unlocked Earth',await page.locator('.home-featured').innerText().then(t=>t.includes('Earth')));
 await page.getByRole('link',{name:'Go to Homeworld'}).click();await ready();
 s=await state();check('Home visit skips title and starts peaceful in commander third person',s.playing==='playing'&&s.active&&s.quiet&&s.possessed&&s.boom===4&&!s.title,s);
 check('Earth uses Earth theme, full base and clear fog',s.theme==='earth'&&s.level===10&&!s.veil&&!s.cloud&&!s.fog,s);
 check('Maximum base retains close zoom and whole-planet overview',s.min<10&&s.max>WH_RADIUS(s),s);
 await page.screenshot({path:out+'/earth-arrival.png'});
 writeFileSync(out+'/earth-preset.json',JSON.stringify(await page.evaluate(()=>({record:WH.mode99.home.record,stages:WH.bootStages,attempts:WH.nav.attempts})),null,2));
 check('Start waves is visible on the HUD',await page.locator('#home-wave-toggle').isVisible());
 if(!process.argv.includes('--from-camera')){
 await page.evaluate(()=>{WH.step(3,30,false);window.homeBaseline=WH.mode99.home.snapshot();});
 await page.reload();await ready();s=await state();check('Earth initialization persists accepted anchors and remains direct entry',s.theme==='earth'&&s.possessed&&!s.title,s);
 await clickWave();
 await page.evaluate(()=>WH.step(14,30,false));
 check('Start waves creates physical home nests',await page.evaluate(()=>WH.mode99.home.running&&WH.waves.wave===1&&WH.world.portals.some(p=>p.active&&p.established)));
 await page.screenshot({path:out+'/home-wave.png'});
 // This is a bounded accelerated fixture: real wave queues/core callbacks,
 // with explicit lethal damage to test persistence rather than difficulty.
 await page.evaluate(()=>{WH.mode99.weather.nextEvent=1e9;WH.mode99.home.requestStop();});
 const clearUntil=async target=>{for(let i=0;i<1600;i++){
   const done=await page.evaluate(target=>{WH.game.paused=false;const m=WH.mode99;if(m.run.getDraft())m.run.vote('solo',0);WH.step(1,15,false);for(const e of [...WH.enemies.active])WH.enemies.damage(e,1e9,{armorPierce:99});return m.run.checkpoint().wavesCleared>=target&&m.home.quiet;},target);
   if(done)return;}
   throw Error('wave fixture timed out '+JSON.stringify(await state()));
 };
 await clearUntil(1);s=await state();check('Stopping wave one returns to peace without advancing ten-wave checkpoint',s.cleared===1&&s.checkpoint===0&&s.quiet,s);
 const gear=await page.evaluate(async()=>{const {generateWeapon}=await import(new URL('js/run/weapons.js',location.href)),m=WH.mode99;
   const item=generateWeapon({id:'qa-retained-relic',seed:192,family:'sword',rng:()=>.999});m.inventory.register(item);m.inventory.pickup(item.id);m.inventory.request({kind:'equip',id:item.id,slot:0});m.home.dirty=true;m.home.save();m.home.start();return m.inventory.snapshot();});
 await page.evaluate(()=>WH.allies.damage(WH.mode99.commander,1e9));await page.waitForURL(/home=home-earth/);await page.waitForEvent('framenavigated',{timeout:15000});await ready();
 s=await state();check('Commander death returns to wave-zero defense checkpoint in third person',s.cleared===0&&s.possessed&&s.quiet,s);
 check('Death retains new equipment including pre-existing rarity above Rare',await page.evaluate(gear=>JSON.stringify(WH.mode99.inventory.snapshot())===JSON.stringify(gear),gear));
 // Wave 10 is the next durable checkpoint. Stop as its real director starts.
 await clickWave();
 for(let i=0;i<1800;i++){
   const done=await page.evaluate(()=>{const m=WH.mode99;WH.game.paused=false;m.weather.nextEvent=1e9;
     if(WH.waves.wave>=10)m.home.requestStop();if(m.run.getDraft())m.run.vote('solo',0);
     WH.step(1,15,false);for(const e of [...WH.enemies.active])WH.enemies.damage(e,1e9,{armorPierce:99});
     return m.home.quiet&&m.run.checkpoint().wavesCleared===10;});if(done)break;
 }
 s=await state();check('Tenth defended wave creates the next checkpoint',s.quiet&&s.cleared===10&&s.checkpoint===10,s);
 await clickWave();check('HUD restarts waves after the tenth-wave draft',await page.evaluate(()=>WH.mode99.home.running),await page.evaluate(()=>({save:WH.mode99.home.lastSave,locked:!!document.pointerLockElement,phase:WH.mode99.run.getPhase(),swing:WH.mode99.commander.swingT})));await page.evaluate(()=>WH.mode99.home.requestStop());await clearUntil(11);
 s=await state();check('Wave eleven does not replace the wave-ten checkpoint',s.cleared===11&&s.checkpoint===10,s);
 // Verify rare cap through actual enemy death/drop wiring, not just generation.
 const drops=await page.evaluate(()=>{const before=WH.mode99.inventory.drops.length;for(let i=0;i<110;i++){
   const e=WH.enemies.spawn('colossus',WH.nav.portalNodes[0],1);if(!e)throw Error('fixture pool');for(let k=0;k<5&&!e.dead;k++)WH.enemies.damage(e,1e9,{armorPierce:99});WH.enemies._release(e);
 }return WH.mode99.inventory.drops.slice(before).map(i=>i.rarity);});
 check('Home enemy drops are capped at Rare',drops.length===110&&drops.every(r=>['common','uncommon','rare'].includes(r))&&drops.includes('rare'),{count:drops.length,rarities:[...new Set(drops)]});
 await page.evaluate(()=>{WH.mode99.home.start();WH.game.lives=0;WH.game.onGameEnd(false);});await page.waitForEvent('framenavigated',{timeout:15000});await ready();
 s=await state();check('Heart defeat after wave eleven restores wave ten',s.cleared===10&&s.checkpoint===10&&s.quiet,s);
 // Hail uses the real exposure and hurt callbacks; retain a little shake.
 const hail=await page.evaluate(()=>{const m=WH.mode99,p=WH.possession,a=m.commander;m.home.start();WH.waves.countdown=1000;
   const trauma=WH.rig.addTrauma.bind(WH.rig),hits=[];WH.rig.addTrauma=n=>{hits.push(n);trauma(n);};
   const start=m.weather.trigger('hail',a.dir);WH.step(14,60,false);WH.rig.addTrauma=trauma;
   return {start,pulses:hits,exposures:m.weather.effectCounts.hail,trauma:WH.rig.trauma};});
 check('Hail retains small pulses without per-frame trauma stacking',hail.start&&hail.exposures>0&&hail.pulses.length>0&&hail.pulses.length<=12&&Math.max(...hail.pulses)<=.081,hail);
 }
 await page.evaluate(()=>{WH.mode99.home.running=false;WH.mode99.home.setPeace();WH.possession.exit();});
 const cam=await page.evaluate(()=>WH.camTest());writeFileSync(out+'/camera.json',JSON.stringify(cam,null,2));
 check('Home maximum-base camera regression',Array.isArray(cam.failed)&&cam.failed.length===0,cam);
 await page.evaluate(()=>{WH.mode99.enterHome();WH.mobile.setEnabled?.(true);});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>WH.step(.2,30,true));await page.screenshot({path:out+'/home-touch.png'});
 const touch=await page.locator('#home-wave-toggle').evaluate(b=>{const r=b.getBoundingClientRect(),quick=document.querySelector('.touch-quick').getBoundingClientRect();return {visible:r.width>0&&r.height>=48&&r.left>=0&&r.right<=innerWidth,overlap:r.bottom>quick.top&&r.right>quick.left&&r.left<quick.right};});
 check('Touch home wave control fits and avoids action-button overlap',touch.visible&&!touch.overlap,touch);
 await clickWave();check('Touch layout can start home waves',await page.evaluate(()=>WH.mode99.home.running));
 await page.evaluate(()=>{WH.mode99.home.running=false;WH.mode99.home.setPeace();});
 }
 if(!process.argv.includes('--home-only')){
 // A separate fresh expedition tests conquest at an existing wave multiplier.
 await page.setViewportSize({width:1440,height:900});await page.goto(base+'/?map=ninetynine&campaign=0&seed=12345&planet=temperate&terrain=varied&commander=marksman');await ready();await page.locator('#btn-begin').click();
 const queued=await page.evaluate(async()=>{const m=WH.mode99,r=m.run;
   for(let i=0;i<22;i++){r.completeWave();if(r.getDraft()){r.vote('solo',0);r.tick(0);}if(r.getPhase()==='victory')r.startEndless();}
   WH.waves.wave=WH.waves.clearedWaves=22;WH.waves.endless=true;WH.waves.state='countdown';WH.waves.countdown=10;WH.game.gold=50000;
   for(let i=0;i<10;i++)m.upgradeHeart();m.weather.nextEvent=1e9;
   return {wave:r.getConquestWave(),limit:WH.waves.limit,claim:await m.home.capture(),level:r.getHeartLevel()};});
 check('Max base schedules next boss at current multiplier and cannot claim early',queued.wave===23&&queued.limit===23&&queued.claim===null&&queued.level===10,queued);
 await page.evaluate(()=>WH.step(10.3,30,false));
 const disrupted=await page.evaluate(()=>{const q=WH.waves.queues.find(q=>q.conquest),p=WH.world.portals.find(p=>p.node===q?.portal);if(!p)return null;
   WH.world.damagePortal(p,p.hp,true);WH.allies.onPortalDestroyed(p);return {node:p.node,destroyed:p.destroyed};});
 check('Fixture disrupts the queued sovereign nest through the quake destruction path',disrupted?.destroyed,disrupted);
 await page.evaluate(()=>WH.step(6,30,false));
 const boss=await page.evaluate(async()=>{const b=WH.enemies.active.find(e=>e.conquestWave),{hpScale}=await import(new URL('js/waves.js',location.href));window.conquestBoss=b;
   return b?{wave:b.conquestWave,scale:b.hpScaleUsed,expected:hpScale(23)*2.25,name:b.type.name,protected:WH.world.portals.some(p=>p.node===b.sourceNest&&p.guardianPending),waveNow:WH.waves.wave,source:b.sourceNest}:null;});
 check('Planet Sovereign actually spawns stronger than current-wave ordinary boss',boss&&boss.scale===boss.expected&&boss.wave===23&&boss.protected&&boss.waveNow===23&&boss.source!==disrupted.node,boss);
 const summon=await page.evaluate(()=>{const b=window.conquestBoss,before=WH.enemies.active.length;b.summonClock=11.9;WH.mode99.update(.2);return {added:WH.enemies.active.length-before,children:WH.enemies.active.filter(e=>e!==b&&e.sourceNest===b.sourceNest&&WH.waves.assaultIds.get(e.id)===23).length};});
 check('Sovereign summons minions at its physical nest with assault ancestry',summon.added===3&&summon.children>=3,summon);
 await page.screenshot({path:out+'/sovereign.png'});
 await page.evaluate(()=>{for(let k=0;k<5&&!window.conquestBoss.dead;k++)WH.enemies.damage(window.conquestBoss,1e9,{armorPierce:99});});
 for(let i=0;i<180;i++){const won=await page.evaluate(()=>{WH.step(1,15,false);return WH.mode99.home.active;});if(won)break;}
 s=await state();check('Sovereign defeat disperses minions, captures the planet and automatically stops waves',s.active&&s.quiet&&s.cleared===23&&!s.veil&&!s.cloud,s);
 check('Captured home remains selectable alongside Earth',await page.evaluate(async()=>{const {homeStore}=await import(new URL('js/modes/home-store.js',location.href));return homeStore.list().homes.length===2&&homeStore.list().homes.some(h=>h.id==='home-earth');}));
 await clickWave();await page.evaluate(()=>WH.step(13,30,false));
 check('Newly captured home can immediately restart endless beyond conquest wave',await page.evaluate(()=>WH.waves.wave===24&&WH.mode99.home.running&&WH.waves.conquestWave===null));
 }
 check('No browser exceptions',errors.length===0,errors);
}catch(error){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});writeFileSync(out+'/failure.txt',String(error.stack));console.error(error);process.exitCode=1;}
finally{writeFileSync(out+'/results.json',JSON.stringify({base,checks,errors},null,2));await browser.close();}
function WH_RADIUS(s){return 240;}
