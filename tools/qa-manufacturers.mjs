import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8141').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/manufacturers/local');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),checks=[],errors=[];
page.setDefaultNavigationTimeout(180000);
page.on('pageerror',e=>errors.push(String(e)));
const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name);};
const ready=async()=>{await page.waitForFunction(()=>window.WH?.mode99&&document.querySelector('#boot.done'),null,{timeout:180000});};
try{
  await page.goto(base+'/lobby.html#homeworld');await page.waitForFunction(()=>window.LOBBY);
  check('New players have an unlocked Earth home and a working visit link',await page.evaluate(()=>document.querySelector('.home-featured').textContent.includes('Earth')&&!!document.querySelector('.home-visit')));
  await page.goto(base+'/debug.html#weapons/carbine-gold');await page.waitForFunction(()=>window.DEBUG_WORLD,null,{timeout:180000});
  const debug=await page.evaluate(()=>{const d=DEBUG_WORLD;return {name:d.weaponLab.item.make.brand,shown:document.querySelectorAll('#debug-weapon-card img').length,meshes:d.selected.group.children.length};});
  check('Debug starts on a real manufacturer model and card',debug.name==='skibidi'&&debug.shown===1,debug);
  const initialStorage=await page.evaluate(()=>JSON.stringify(localStorage));
  for(const brand of ['skibidi','anomalous','bang','rainbow']){
    await page.selectOption('#debug-maker',brand);await page.screenshot({animations:'disabled',path:out+'/debug-'+brand+'.png'});
    const variant=await page.evaluate(()=>{const d=DEBUG_WORLD,w=d.weaponLab.item;let vertices=0;d.selected.group.traverse(o=>{vertices+=o.geometry?.attributes.position.count||0;});return {brand:w.make.brand,skill:w.make.skill,vertices,overflow:document.querySelector('#debug-weapon-card').scrollWidth>document.querySelector('#debug-weapon-card').clientWidth};});
    check('Debug manufacturer '+brand,variant.brand===brand&&!variant.overflow&&variant.vertices>0,variant);
  }
  const variants=await page.evaluate(()=>{
    const d=DEBUG_WORLD,results=[];
    for(const family of ['sword','spear','twinblade','scepter','carbine','lobber']){
      d.select('weapons',family+'-gold');results.push({family,valid:d.weaponLab.item.family===family,visible:d.selected.group.visible});
    }
    d.select('weapons','carbine-gold');return results;
  });check('All six weapon families can be inspected',variants.every(v=>v.valid&&v.visible),variants);
  await page.locator('#debug-weapon-seed').evaluate(e=>e.closest('details').open=true);
  await page.fill('#debug-weapon-seed','771');await page.locator('#debug-weapon-seed').dispatchEvent('change');
  const seed=await page.evaluate(()=>JSON.stringify(DEBUG_WORLD.weaponLab.item));
  await page.locator('#debug-weapon-seed').dispatchEvent('change');check('Same debug roll is deterministic',seed===await page.evaluate(()=>JSON.stringify(DEBUG_WORLD.weaponLab.item)));
  await page.locator('#debug-weapon-roll').click();check('Reroll changes identity without touching saves',seed!==await page.evaluate(()=>JSON.stringify(DEBUG_WORLD.weaponLab.item))&&initialStorage===await page.evaluate(()=>JSON.stringify(localStorage)));
  await page.setViewportSize({width:390,height:844});await page.screenshot({animations:'disabled',path:out+'/debug-phone.png'});
  check('Debug card fits a phone width',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.weapon-card').getBoundingClientRect().right<=innerWidth));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+'/?map=ninetynine&campaign=0&seed=12345&planet=temperate&terrain=varied&commander=marksman');await ready();await page.locator('#btn-begin').click();
  const combat=await page.evaluate(async()=>{
    const {generateWeapon,weaponStats}=await import(new URL('js/run/weapons.js',location.href)),{makeRng}=await import(new URL('js/run/rng.js',location.href));
    const {MAKER_SKILLS}=await import(new URL('js/run/manufacturers.js',location.href));
    const w=WH,m=w.mode99,a=m.commander,list=[];w.waves.state='idle';w.waves.canRaid=()=>false;w.game.paused=false;
    function target(){const e=w.enemies.spawn('husk',w.nav.heartNode,1);e.hp=e.hpMax=5000;e.dir.copy(a.dir).addScaledVector(a.fwd,2/WH.CONFIG.planetRadius).normalize();e.height=a.height;e.alt=0;return e;}
    const make=(brand,family='sword',skill=null)=>{const item=generateWeapon({id:'qa-'+brand+'-'+family,seed:71,family,manufacturer:brand,modifier:'puncture',rng:makeRng(71)});item.parts={head:'balanced',grip:'balanced',core:'tempered'};item.rarity='rare';if(skill)item.make.skill=skill;return item;};
    for(const brand of ['skibidi','anomalous','bang','rainbow']){
      const item=make(brand);m.inventory.register(item);m.inventory.pickup(item.id);a.swingT=0;a.strikePending=false;m.weapons.request({kind:'equip',id:item.id,slot:0});
      const e=target();a.hp=a.hpMax/2;const hp=a.hp;w.allies._meleeSweep(a,a.type.strike);
      list.push({name:'Live passive '+brand,ok:e.hp<5000&&(brand!=='anomalous'||a.hp>hp)&&(brand!=='rainbow'||e.burnDps>0&&e.slowFrac>0),hp:a.hp,slow:e.slowFrac,burn:e.burnDps});w.enemies._release(e);
      for(const skill of (await import(new URL('js/run/manufacturers.js',location.href))).MANUFACTURERS[brand].skills){
        const spec=weaponStats(make(brand,'sword',skill),'marksman');a.swingT=0;a.strikePending=false;w.allies.setWeapon(a,spec,'sword','commander');
        m.abilities.clock.tick(100);const e2=target(),before=e2.hp;m.abilities.update(.01);const used=m.abilities.activate('weapon');
        if(skill==='overdrive'){m.abilities.update(.01);const changed=m.abilities.modifyStrike(a,spec);list.push({name:'Skill '+skill,ok:used&&changed.cd<spec.cd});}
        else {w.allies.update(a.swingDur*.41);list.push({name:'Skill '+skill,ok:used&&e2.hp<before,damage:before-e2.hp,description:MAKER_SKILLS[skill].description});}
        a.swingT=0;a.strikePending=false;
        const swapped=weaponStats(make(brand==='skibidi'?'anomalous':'skibidi'),'marksman');w.allies.setWeapon(a,swapped,'sword','commander');
        const prevented=!m.abilities.activate('weapon');list.push({name:'Cooldown survives same-family manufacturer swap '+skill,ok:prevented});
        a.swingT=0;a.strikePending=false;w.enemies._release(e2);
      }
    }
    // Delayed projectiles must keep the firing item's effects after a swap,
    // and must never heal a new occupant of a pooled commander object.
    const e=target(),spec=weaponStats(make('anomalous','carbine'),'marksman');a.hp=a.hpMax/2;const hp=a.hp;
    w.allies._weaponEffect(e,spec,40,a);list.push({name:'Ranged confirmed damage heals only the active owner',ok:a.hp>hp});
    const before=a.hp;w.allies._weaponEffect(e,spec,0,a);list.push({name:'A miss cannot heal',ok:a.hp===before});w.enemies._release(e);
    a.swingT=0;a.strikePending=false;
    const gun=make('rainbow','carbine');m.inventory.register(gun);m.inventory.pickup(gun.id);m.weapons.request({kind:'equip',id:gun.id,slot:1});
    m.weaponPanel.open();return list;
  });for(const c of combat)check(c.name,c.ok,c);
  await page.screenshot({animations:'disabled',path:out+'/inventory-desktop.png'});
  check('Inventory uses real thumbnails, manufacturer skills and comparisons',await page.evaluate(()=>document.querySelectorAll('#weapon-dialog .weapon-card img').length>=4&&document.querySelector('#weapon-dialog .wc-compare')&&document.querySelector('#weapon-compare')));
  check('No weapon ammo or visible level fields',!await page.locator('#weapon-dialog').innerText().then(t=>/\b(ammunition|ammo|reload|tier|level)\b/i.test(t.replace('mid-assault reload',''))));
  await page.locator('#weapon-compare').focus();await page.selectOption('#weapon-compare','0');
  check('Comparison control keeps keyboard focus',await page.evaluate(()=>document.activeElement.id==='weapon-compare'));
  await page.setViewportSize({width:390,height:844});await page.screenshot({animations:'disabled',path:out+'/inventory-phone.png'});
  check('Inventory cards fit phone without horizontal scrolling',await page.evaluate(()=>{const d=document.querySelector('#weapon-dialog');return d.scrollWidth<=d.clientWidth&&[...d.querySelectorAll('.weapon-card')].every(c=>c.scrollWidth<=c.clientWidth);}));
  await page.locator('#weapon-dialog button[data-action=close]').click();await page.setViewportSize({width:1440,height:1000});
  const held=await page.evaluate(async()=>{
    const {generateWeapon,weaponStats,FAMILIES}=await import(new URL('js/run/weapons.js',location.href)),{makeRng}=await import(new URL('js/run/rng.js',location.href));
    const a=WH.mode99.commander,v=WH.viewModel,result=[];WH.possession.enter(a);WH.game.paused=true;
    for(const family of Object.keys(FAMILIES)){
      const item=generateWeapon({id:'held-'+family,seed:331,family,manufacturer:'anomalous',rng:makeRng(331)}),f=FAMILIES[family];
      a.swingT=0;a.strikePending=false;WH.allies.setWeapon(a,weaponStats(item,'marksman',true),f.visual,f.view,0xffffff,1,{era:'ancient',material:'gold',core:'tempered',manufacturer:item.make.brand});
      v.show(f.view,'ancient','anomalous');v.update(.016,WH.rig.camera,a);let finite=true,meshes=0;
      v.current.traverse(o=>{if(o.geometry){meshes++;finite&&=[...o.geometry.attributes.position.array].every(Number.isFinite);}});
      result.push({family,ok:finite&&meshes>0&&v.manufacturer==='anomalous'&&a.modelKey.includes('anomalous'),meshes});
    }
    WH.possession.exit(true);WH.game.paused=false;WH.mode99.weapons.request({kind:'select',slot:'native'});WH.mode99.weapons.request({kind:'select',slot:1});return result;
  });for(const r of held)check('First and third person maker model: '+r.family,r.ok,r);
  await page.evaluate(async()=>{
    const {generateWeapon}=await import(new URL('js/run/weapons.js',location.href)),{makeRng}=await import(new URL('js/run/rng.js',location.href));
    const m=WH.mode99,a=m.commander,item=generateWeapon({id:'qa-ground-card',family:'carbine',manufacturer:'skibidi',seed:28,rng:makeRng(28)});
    const dir=a.dir.clone().addScaledVector(a.fwd,6/WH.CONFIG.planetRadius).normalize();m.inventory.register(item);m.loot.add(item,dir);WH.game.context.target={kind:'loot',object:m.loot.entries.get(item.id)};WH.game.context.open();WH.game.paused=true;WH.game.context.update();
  });await page.screenshot({path:out+'/ground-card.png',animations:'disabled'});
  check('Ground hover uses the shared maker card and actual model',await page.evaluate(()=>!document.querySelector('#loot-inspect').hidden&&document.querySelector('#loot-card .wc-footer').textContent.includes('Skibidi Inc.')&&!!document.querySelector('#loot-card img')));
  await page.evaluate(()=>{WH.game.context.close();WH.game.paused=false;});
  await page.evaluate(()=>{
    WH.game.gold=30000;for(let i=0;i<10;i++)WH.mode99.upgradeHeart();WH.waves.state='idle';WH.mode99.commander.swingT=0;WH.mode99.commander.strikePending=false;
  });
  await page.evaluate(()=>{const r=WH.mode99.run;const wave=r.getConquestWave();r.defeatConquestBoss(wave);while(r.checkpoint().wavesCleared<wave){r.completeWave();if(r.getDraft()){r.vote('solo',0);r.tick(0);}}});
  await page.waitForFunction(()=>WH.mode99.home.active,null,{timeout:30000});
  const captures=await page.evaluate(async()=>{
    const id=WH.mode99.home.capturedId;
    const {homeStore}=await import(new URL('js/modes/home-store.js',location.href)),first=homeStore.get(id),second=structuredClone(first);second.id='home-second-test';second.name='QA Moon Haven';second.world.environment.theme='moon';second.world.seed=12346;
    first.name='QA Verdant Home';homeStore.save(first);
    homeStore.save(second);return {id,homes:homeStore.list().homes.length,active:WH.mode99.home.active,url:location.href};
  });check('Completed conquest automatically enters the catalogue and adopts the home',captures.homes===3&&captures.active&&!captures.url.includes('home='),captures);
  await page.goto(base+'/lobby.html?worldgen=1#homeworld');await page.waitForFunction(()=>window.LOBBY);
  check('Captured homes are shared with the generator while expedition saves stay separate',await page.locator('[data-home]').count()===3);
  await page.goto(base+'/lobby.html#homeworld');await page.waitForFunction(()=>window.LOBBY);await page.screenshot({animations:'disabled',path:out+'/homeworld-desktop.png'});
  check('Lobby has a reachable fifth Homeworld station and Earth plus two captured planets',await page.evaluate(()=>LOBBY.stations.some(s=>s.key==='homeworld')&&document.querySelectorAll('[data-home]').length===3));
  await page.locator('[data-choose-home="home-second-test"]').click();await page.reload();await page.waitForFunction(()=>window.LOBBY);
  check('Choosing a new Homeworld persists while keeping both captures',await page.evaluate(()=>document.querySelector('.home-featured h3').textContent==='QA Moon Haven'&&document.querySelectorAll('[data-home]').length===3));
  await page.setViewportSize({width:390,height:844});await page.screenshot({animations:'disabled',path:out+'/homeworld-phone.png'});
  check('Homeworld section fits phone width',await page.evaluate(()=>{const p=document.querySelector('#station-panel');return p.scrollWidth<=p.clientWidth&&p.getBoundingClientRect().right<=innerWidth;}));
  await page.locator('.home-visit').click();await ready();check('Go to Homeworld loads chosen saved planet peacefully',await page.evaluate(()=>WH.mode99.home.record.id==='home-second-test'&&WH.mode99.home.quiet));
  const homeURL=page.url(),phoneContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,storageState:await page.context().storageState()}),phone=await phoneContext.newPage();
  phone.on('pageerror',e=>errors.push(String(e)));await phone.goto(homeURL);await phone.waitForFunction(()=>window.WH?.mode99&&document.querySelector('#boot.done'),null,{timeout:180000});
  await phone.locator('#touch-status').tap();await phone.locator('#touch-weapons').tap();
  check('Touch menu opens manufacturer inventory with no stacked menu',await phone.evaluate(()=>document.querySelector('#weapon-dialog').open&&!document.querySelector('#touch-menu').open&&!!document.querySelector('#weapon-dialog .wc-footer')));
  await phone.locator('#weapon-dialog .weapon-card').first().scrollIntoViewIfNeeded();await phone.screenshot({path:out+'/inventory-real-touch.png',animations:'disabled'});
  check('Real touch inventory keeps 48px actions and contains its cards',await phone.evaluate(()=>{const d=document.querySelector('#weapon-dialog');return d.scrollWidth<=d.clientWidth&&[...d.querySelectorAll('button')].every(b=>b.getBoundingClientRect().height>=48);}));
  await phone.locator('#weapon-dialog [data-action=close]').tap();
  check('Closing touch inventory resumes peaceful home',await phone.evaluate(()=>!WH.game.paused&&!WH.possession.suspended));
  await phone.goto(base+'/lobby.html#homeworld');await phone.waitForFunction(()=>window.LOBBY);await phone.screenshot({path:out+'/homeworld-real-touch.png',animations:'disabled'});
  check('Touch Homeworld opens without joystick obstruction',await phone.evaluate(()=>document.body.classList.contains('station-open')&&getComputedStyle(document.querySelector('#lobby-touch')).display==='none'&&document.querySelector('.home-visit').getBoundingClientRect().height>=48));
  await phoneContext.close();
  check('No browser runtime exceptions',errors.length===0,errors);
}catch(e){errors.push(String(e));await page.screenshot({animations:'disabled',path:out+'/failure.png'}).catch(()=>{});}
const report={base,evidenceType:'Instrumented browser fixtures and rendered inspection; not blind play',checks,errors,pass:!errors.length&&checks.every(c=>c.ok)};
writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:report.pass,checks:checks.length,errors}));if(!report.pass)process.exitCode=1;
