import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json'));
const {chromium}=require('playwright'),base=(process.env.WH_BASE_URL||'http://127.0.0.1:8141').replace(/\/$/,''),out=process.argv[2]||'artifacts/homeworld/local';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],errors=[];
page.setDefaultNavigationTimeout(180000);
page.on('pageerror',e=>errors.push(String(e)));
const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name+' '+JSON.stringify(detail));};
const same=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<1e-9:a&&b&&typeof a==='object'&&typeof b==='object'?Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>same(a[k],b[k])):a===b;
const ready=async()=>{await page.waitForFunction(()=>(window.WH?.mode99&&document.querySelector('#boot.done'))||document.querySelector('#boot-status')?.textContent.startsWith('Boot failed'),null,{timeout:180000});const failure=await page.locator('#boot-status').textContent();if(failure.startsWith('Boot failed'))throw Error(failure);};
try{
  await page.goto(base+'/?map=ninetynine&campaign=0&seed=12345&planet=temperate&terrain=varied&commander=marksman');await ready();await page.locator('#btn-begin').click();
  await page.evaluate(()=>{WH.waves.canRaid=()=>false;WH.game.gold=30000;});
  check('Claim unavailable before full expansion',await page.evaluate(async()=>!await WH.mode99.home.claim()));
  const prepared=await page.evaluate(async()=>{
    for(let i=0;i<10;i++)WH.mode99.upgradeHeart();WH.waves.state='idle';
    const {CONFIG}=await import(new URL('js/config.js',location.href));
    const T=WH.mode99.commander.dir.constructor,n=WH.nav,center=WH.mode99.commander.dir;
    let placed=0;
    for(let i=0;i<n.n&&placed<3;i++){
      if(!n.walk[i]||!Number.isFinite(n.dist[i]))continue;
      const dir=n.nodeDir(i,new T()),arc=Math.acos(Math.min(1,dir.dot(center)))*CONFIG.planetRadius;
      if(arc<5||arc>14)continue;const pos=n.nodePos(i,new T());
      if(WH.game.towerMgr.towers.some(t=>t.pos.distanceTo(pos)<4))continue;
      const t=WH.game.towerMgr.place(['bolt','cryo','mortar'][placed],pos);t.upgrade();n.blockNodes(pos,WH.game._fp(t.def),t.id);placed++;
    }
    n.recomputeFlow();
    const snap=WH.mode99.home.snapshot();window.beforeHome=snap;return {level:WH.mode99.run.getHeartLevel(),theta:WH.mode99.run.getFrontierTheta(),towers:placed,snap};
  });
  writeFileSync(out+'/prepared.json',JSON.stringify(prepared.snap));
  check('Fixture buys all ten real base upgrades and places three defenses',prepared.level===10&&prepared.theta===Math.PI&&prepared.towers===3,prepared.level);
  await page.locator('#expedition-tools summary').click();await page.locator('#home-planet-open').click();await page.locator('#home-name').fill('QA Aurora Home');
  await page.screenshot({path:out+'/claim.png'});
  await page.evaluate(()=>{const r=WH.mode99.run;r.defeatConquestBoss(r.getConquestWave());r.completeWave();WH.mode99.home.dialog.close();});
  await page.waitForFunction(()=>WH.mode99.home.active,null,{timeout:30000});
  await page.evaluate(()=>{const h=WH.mode99.home;h.record.name='QA Aurora Home';h.save();h.visit(h.record.id);});
  await page.waitForURL('**home=home-*',{timeout:15000});await ready();
  const restored=await page.evaluate(()=>({record:WH.mode99.home.record,snapshot:WH.mode99.home.snapshot(),quiet:WH.mode99.home.quiet,phase:WH.mode99.run.getPhase(),state:WH.waves.state,frontier:WH.mode99.run.getFrontierTheta()}));
  writeFileSync(out+'/restored.json',JSON.stringify(restored));
  check('Claim reloads the same seed, radius, terrain, anchor and three tower upgrades',JSON.stringify(prepared.snap.world)===JSON.stringify(restored.snapshot.world)&&same(prepared.snap.checkpoint.towers,restored.snapshot.checkpoint.towers),restored.snapshot.world);
  check('Home starts peaceful with full planet ownership',restored.quiet&&restored.phase==='building'&&restored.state==='idle'&&restored.frontier===Math.PI);
  await page.keyboard.press('w');
  await page.waitForFunction(()=>WH.game.soundtrack.key==='homegarden'&&WH.game.soundtrack.decks.some(d=>d.id==='homegarden'&&!d.media.paused&&d.media.readyState>=2),null,{timeout:20000});
  check('Peaceful home actually plays the approved calm arrangement',true);
  await page.evaluate(()=>WH.step(60,10,false));check('Peaceful simulation cannot spawn nests or enemies',await page.evaluate(()=>!WH.enemies.active.length&&!WH.waves.queues.length&&!WH.world.portals.some(p=>p.active)));
  await page.evaluate(()=>WH.mode99.home.open());await page.getByRole('button',{name:'Crystal lantern',exact:true}).click();
  const decor=await page.evaluate(()=>{const h=WH.mode99.home,a=WH.mode99.commander;for(const scale of [6,8,10]){const d=a.dir.clone().addScaledVector(a.fwd,scale/WH.CONFIG.planetRadius).normalize();if(h.place(d,a.height))return h.record.decorations;}return [];});
  check('Decoration placement saves a visible nonblocking model',decor.length===1&&await page.evaluate(()=>WH.mode99.home.group.children.length===1));
  await page.evaluate(()=>document.exitPointerLock?.());await page.locator('#home-cancel-place').click();
  await page.evaluate(()=>WH.mode99.home.open());await page.screenshot({path:out+'/home-controls.png'});await page.getByRole('button',{name:'Close home controls'}).click();
  const start=await page.evaluate(()=>WH.mode99.home.start());check('Incursions start explicitly',start);
  await page.evaluate(()=>WH.step(12));check('Home incursion establishes a physical nest',await page.evaluate(()=>WH.mode99.home.running&&WH.waves.wave===2&&WH.world.portals.some(p=>p.active&&p.established)));
  const savedGold=await page.evaluate(()=>WH.mode99.home.record.checkpoint.gold);await page.evaluate(()=>{WH.game.gold+=777;WH.game.lives=0;WH.game.onGameEnd(false);});
  await page.waitForEvent('framenavigated',{timeout:15000});await ready();
  check('Defeat restores the prior peaceful checkpoint without lost decor or duplicated money',await page.evaluate(g=>WH.mode99.home.quiet&&WH.game.gold===g&&WH.game.lives>0&&WH.mode99.home.group.children.length===1,savedGold));
  // Clear through the real director/core callbacks; fixture damage is explicit.
  await page.evaluate(()=>{WH.mode99.home.start();WH.mode99.home.requestStop();});
  for(let i=0;i<140;i++){
    const done=await page.evaluate(()=>{WH.step(1);for(const e of [...WH.enemies.active])WH.enemies.damage(e,1e9,{armorPierce:99});return WH.mode99.home.quiet&&WH.mode99.home.record.checkpoint.run.wavesCleared===2;});
    if(done)break;
  }
  check('Stopping saves a peaceful resume; defense checkpoint remains at capture',await page.evaluate(()=>WH.mode99.home.quiet&&WH.mode99.home.record.checkpoint.run.wavesCleared===2));
  await page.evaluate(()=>WH.mode99.home.open());
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/home-mobile.png'});
  check('Home dialog fits a phone and scrolls internally',await page.locator('#home-planet-dialog').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&e.scrollHeight>=e.clientHeight;}));
  await page.getByRole('button',{name:'Close home controls'}).click();
  await page.reload();await ready();
  check('Wave checkpoint persists across reload',await page.evaluate(()=>WH.mode99.run.getWave()===3&&WH.mode99.home.quiet));
  check('Peaceful HUD does not advertise a zero-second nest countdown',await page.locator('#wave-sub').textContent()==='peaceful · incursions paused');
  // Trigger the real quake pipeline during an incursion, then take an explicit
  // peaceful fixture checkpoint. This tests terrain persistence, not wave balance.
  await page.evaluate(()=>{const h=WH.mode99.home;h.start();WH.waves.countdown=1000;const a=WH.mode99.commander;WH.mode99.weather.trigger('quake',a.dir.clone().addScaledVector(a.fwd,20/WH.CONFIG.planetRadius).normalize());});
  await page.waitForFunction(()=>WH.mode99.weather.phase==='warning',null,{timeout:120000});
  await page.evaluate(()=>WH.mode99.weather.remaining=.01);
  await page.waitForFunction(()=>WH.mode99.weather.phase==='calm',null,{timeout:120000});
  const faultCheckpoint=await page.evaluate(()=>{const h=WH.mode99.home;h.running=false;h.setPeace();h.save();return {faults:h.record.checkpoint.faults,heights:Array.from(WH.nav.height).filter((_,i)=>i%97===0),decor:h.record.decorations};});
  check('Actual earthquake commits and is included in the home checkpoint',faultCheckpoint.faults.length===1);
  await page.reload();await ready();
  const afterFault=await page.evaluate(()=>({faults:WH.mode99.home.snapshot().checkpoint.faults,heights:Array.from(WH.nav.height).filter((_,i)=>i%97===0),decor:WH.mode99.home.record.decorations}));
  writeFileSync(out+'/quake-before.json',JSON.stringify(faultCheckpoint));writeFileSync(out+'/quake-after.json',JSON.stringify(afterFault));
  // Rebuild samples start from double precision vertices; the live quake uses
  // stored Float32 graph directions. Bound that rounding in world units.
  const heightError=Math.max(...faultCheckpoint.heights.map((h,i)=>Math.abs(h-afterFault.heights[i])));
  check('Quake terrain samples and reseated decorations survive home reload',faultCheckpoint.heights.length===afterFault.heights.length&&heightError<.0001&&same(faultCheckpoint.faults,afterFault.faults)&&same(faultCheckpoint.decor,afterFault.decor),{maximumHeightError:heightError});
  const backup=await page.evaluate(()=>{const h=WH.mode99.home;h.dirty=true;const copy=structuredClone(h.record);copy.checkpoint.gold+=123;return {version:1,homes:[copy]};});
  await page.evaluate(()=>WH.mode99.home.open());await page.getByText('Home backup',{exact:true}).click();
  const importedNavigation=page.waitForEvent('framenavigated',{timeout:15000});
  await page.locator('#home-import').setInputFiles({name:'home-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await importedNavigation;await ready();
  check('Importing the active home reloads the backup without an old autosave overwriting it',await page.evaluate(g=>WH.game.gold===g&&WH.mode99.home.record.checkpoint.gold===g,backup.homes[0].checkpoint.gold));
  await page.goto(base+'/lobby.html');await page.waitForFunction(()=>window.lobbySoundtrack);await page.locator('[data-station="homeworld"]').first().click();
  check('Lobby lists the named home and its checkpoint',await page.locator('.home-lobby a').count()===1&&(await page.locator('.home-choice').allInnerTexts()).join(' ').includes('Wave 1'));
  await page.waitForTimeout(400);await page.screenshot({path:out+'/lobby-home.png'});
  const homeURL=await page.locator('.home-lobby a').getAttribute('href');
  const phoneContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,storageState:await page.context().storageState()});
  const phone=await phoneContext.newPage();phone.on('pageerror',e=>errors.push(String(e)));
  await phone.goto(new URL(homeURL,base+'/lobby.html').href);await phone.waitForFunction(()=>window.WH?.mode99&&document.querySelector('#boot.done'),null,{timeout:180000});
  await phone.locator('#touch-status').tap();await phone.locator('#expedition-tools summary').tap();await phone.locator('#home-planet-open').tap();
  check('Touch Base opens home controls without stacking paused menus',await phone.evaluate(()=>document.querySelector('#home-planet-dialog').open&&!document.querySelector('#touch-menu').open&&WH.game.paused));
  await phone.getByRole('button',{name:'Resting bench',exact:true}).tap();
  check('Touch decoration selection resumes gameplay',await phone.evaluate(()=>!WH.game.paused&&WH.mode99.home.tool==='bench'&&!document.querySelector('#home-placement').hidden));
  await phone.evaluate(()=>{const a=WH.mode99.commander;a.dir.addScaledVector(a.fwd,18/WH.CONFIG.planetRadius).normalize();a.fwd.addScaledVector(a.dir,-a.fwd.dot(a.dir)).normalize();});
  await phone.locator('#home-place-here').tap();
  check('Touch Place here creates the selected decoration',await phone.evaluate(()=>WH.mode99.home.record.decorations.some(d=>d.kind==='bench')));
  await phone.locator('#home-cancel-place').tap();await phone.locator('#touch-status').tap();await phone.locator('#home-planet-open').tap();
  await phone.getByRole('button',{name:'Remove decoration',exact:true}).tap();await phone.locator('#home-place-here').tap();
  check('Touch Remove nearby removes the placed piece',await phone.evaluate(()=>!WH.mode99.home.record.decorations.some(d=>d.kind==='bench')));
  await phone.locator('#home-cancel-place').tap();await phone.locator('#touch-status').tap();await phone.locator('#home-planet-open').tap();
  await phone.screenshot({path:out+'/home-real-touch.png'});await phoneContext.close();
  check('No runtime errors',errors.length===0,errors);
}catch(e){errors.push(String(e));await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
const report={base,evidenceType:'Instrumented browser fixtures, not natural play',checks,errors,pass:!errors.length&&checks.every(c=>c.ok)};
writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();if(!report.pass)process.exitCode=1;
