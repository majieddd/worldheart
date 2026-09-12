// Targeted fixtures use real rendering, input and damage. They are not a campaign playthrough.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=process.env.WH_BASE_URL||'http://127.0.0.1:8139',out=resolve(process.argv[2]||'artifacts/active-worlds/combat');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(180000);
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__frames=true;window.requestAnimationFrame=fn=>raf(t=>{if(__frames)fn(t);});});
const ck=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
try{
 await page.goto(base+'/?map=ninetynine&campaign=0&seed=12345&commander=oracle');await page.waitForFunction(()=>window.WH?.mode99&&document.querySelector('#boot.done'));await page.locator('#btn-begin').click();
 await page.evaluate(()=>{__frames=false;WH.waves.canRaid=()=>false;WH.waves.state='idle';WH.step(.01,60,true);});
 checks.push(...await page.evaluate(async()=>{
  const W=WH,m=W.mode99,a=m.commander,T=await import(new URL('lib/three.module.min.js',location.href)),world=await import(new URL('js/world.js',location.href)),weapons=await import(new URL('js/run/weapons.js',location.href)),r=[];
  const ck=(name,ok,actual)=>r.push({name,ok:!!ok,actual});window.__checks={T,world,weapons};
  ck('Orange relic field is removed',!m.oreField&&!m.ore&&!!m.forge);
  for(let i=0;i<8;i++){const item=weapons.generateWeapon({id:'forge-'+i,seed:i,tier:1,family:'sword',rng:()=>.1});m.inventory.register(item);m.inventory.salvage(item.id);}
  a.dir.copy(W.nav.nodeDir(W.nav.heartNode,new T.Vector3()));a.height=world.terrainHeight(...a.dir.toArray());
  ck('First real tower forge consumes 3 scraps',!!m.craft()&&m.forge.balance===5&&m.forge.cost===5);
  ck('Second real forge consumes 5 scraps',!!m.craft()&&m.forge.balance===0&&m.forge.cost===7);
  ck('Failed craft preserves price and balance',!m.craft()&&m.forge.cost===7&&m.forge.balance===0);
  let beam=null;const old=W.allies.onBeam;W.allies.onBeam=(...args)=>{beam=args;old?.(...args);};
  a.aim=a.dir.clone();a.heat=0;a.heatLock=0;W.allies.playerAttack(a,.05);ck('Scepter emits a beam into empty sky',beam&&beam[1]===null&&beam[4]>10);
  const p=W.world.addPortal(W.allies.worldPos(a,new T.Vector3()).addScaledVector(a.fwd,7));p.active=true;p.hp=1000;p.hpMax=1000;p.node=W.nav.heartNode;
  a.aim.copy(a.fwd);a.heat=0;W.allies.playerAttack(a,.1);ck('Scepter damages a visible nest',p.hp<1000,p.hp);W.world.damagePortal(p,p.hp,true);
  return r;
 }));
 await page.locator('#focus-commander').click();ck('Commander frame follows its live body',await page.evaluate(()=>WH.possession.unit===WH.mode99.commander));
 await page.evaluate(()=>{const W=WH;W.possession.boom=W.possession.boomWant=0;W.possession.pitch=.15;W.possession.suspend(false);W.step(.02,60,true);});
 await page.mouse.move(720,450);await page.mouse.down({button:'right'});await page.evaluate(()=>{for(let i=0;i<30;i++)WH.step(1/60,60,true);});
 ck('Held right mouse aims in first person',await page.evaluate(()=>WH.possession.aimT>.95&&WH.rig.camera.fov<WH.possession.baseFov*.8));await page.screenshot({path:resolve(out,'aim-scepter.png')});
 await page.mouse.up({button:'right'});await page.evaluate(()=>{for(let i=0;i<35;i++)WH.step(1/60,60,true);});ck('Releasing aim restores the lens',await page.evaluate(()=>WH.possession.aimT<.01&&Math.abs(WH.rig.camera.fov-WH.possession.baseFov)<.3));
 await page.mouse.down();await page.evaluate(()=>{WH.possession.pitch=.25;for(let i=0;i<20;i++)WH.step(1/60,60,true);});await page.screenshot({path:resolve(out,'scepter-fire.png')});await page.mouse.up();
 ck('Beam starts at the visible first-person tip',await page.evaluate(()=>{const W=WH,b=W.combatFx.beams.find(b=>b.a===W.mode99.commander&&b.rib.mesh.visible);if(!b)return false;const tip=b.rib.from.clone();W.viewModel.muzzle(W.rig.camera,tip);return tip.project(W.rig.camera).distanceTo(b.rib.from.clone().project(W.rig.camera))<.04;}));
 await page.mouse.down({button:'right'});await page.evaluate(()=>{WH.step(.2,60,true);WH.possession.suspend(true);WH.step(.02,60,true);});ck('An interaction menu cancels held aim and firing',await page.evaluate(()=>!WH.possession.aiming&&WH.possession.aimT===0&&!WH.possession.firing));await page.mouse.up({button:'right'});
 await page.evaluate(()=>WH.possession.suspend(false));
 checks.push(...await page.evaluate(async()=>{
  const W=WH,m=W.mode99,{T,world,weapons}=__checks,{CommanderAbilities}=await import(new URL('js/abilities.js',location.href)),r=[];const ck=(name,ok,actual)=>r.push({name,ok:!!ok,actual});
  W.possession.exit();const home=W.nav.nodeDir(W.nav.heartNode,new T.Vector3());
  const spawnEnemy=(a,distance)=>{const e=W.enemies.spawn('husk',W.nav.heartNode,1),point=W.allies.worldPos(a,new T.Vector3()).addScaledVector(a.fwd,distance);e.dir.copy(point).normalize();e.height=point.length()-world.R-e.type.radius*.9;e.alt=0;e.hp=e.hpMax=10000;e.swimming=false;return e;};
  for(const key of ['commander','duelist','marksman','bombardier','oracle']){
    const a=W.allies.spawn(key,home,home,12),ab=new CommanderAbilities({game:W.game,allies:W.allies,enemies:W.enemies,commander:()=>a,ui:W.ui});a.possessed=true;a.hp=a.hpMax*.5;
    const e=spawnEnemy(a,key==='bombardier'?7:2),before=a.dir.clone(),hp=a.hp;
    ck(key+' ability activates once',ab.activate('commander')&&!ab.activate('commander'));
    for(let i=0;i<20;i++)ab.update(.025);
    const spec=ab.modifyStrike(a,a.type.strike);
    const success=key==='commander'?(()=>{W.allies.damage(a,100);return a.hp===hp-25;})():key==='duelist'?a.dir.distanceTo(before)*world.R>.5:key==='marksman'?(spec.range||spec.radius)>(a.type.strike.range||a.type.strike.radius):key==='bombardier'?e.hp<10000:a.hp>hp&&e.hp<10000;
    ck(key+' ability changes its advertised gameplay',success,{health:a.hp,enemy:e.hp,moved:a.dir.distanceTo(before)*world.R});
    ab.update(7);ck(key+' temporary modifiers expire',!a.abilityGuard&&!a.abilityDeadeye&&a.abilitySpeed===1);
    W.enemies._release(e);W.allies._release(a);
  }
  const a=m.commander;a.possessed=true;
  for(const [family,def] of Object.entries(weapons.FAMILIES)){
    const spec={...def,weaponFamily:family};W.allies.setWeapon(a,spec,def.visual,def.view,0xffffff,1,{era:'ancient',core:'ember',material:'wood'});
    a.swingT=0;a.strikePending=false;a.heat=0;a.heatLock=0;a.aim=(family==='lobber'?a.dir:a.fwd).clone();if(family==='lobber')a.aim.negate();
    const ab=new CommanderAbilities({game:W.game,allies:W.allies,enemies:W.enemies,commander:()=>a,ui:W.ui}),e=spawnEnemy(a,family==='carbine'?8:2);
    ck(family+' weapon special activates once',ab.activate('weapon')&&!ab.activate('weapon'));
    for(let i=0;i<180;i++){ab.update(1/60);W.allies.update(1/60);}
    const success=family==='twinblade'?ab.modifyStrike(a,a.type.strike).cd<a.type.strike.cd:e.hp<10000;
    ck(family+' special applies its gameplay',success,{hp:e.hp,dance:a.abilityDance});W.enemies._release(e);
  }
  const nests=[];for(let wave=1;wave<=10;wave++){const sources=W.waves.prepareNests(wave);ck('Wave '+wave+' still has real connected nest sources',sources?.length&&sources.every(n=>Number.isFinite(W.nav.march.dist[n])));for(const p of W.world.portals)if(p.sourceWave===wave&&p.established)nests.push({wave,arc:home.angleTo(p.group.position.clone().normalize())*world.R});}
  const mean=list=>list.reduce((s,x)=>s+x.arc,0)/list.length,early=mean(nests.filter(n=>n.wave<=3)),late=mean(nests.filter(n=>n.wave>=8));
  ck('Later nests move outward while the base stays small',late>early+20,{early,late,nests});
  // A global base must fit the outer silhouette.
  W.possession.exit();W.rig.frontierTheta=Math.PI;W.rig.cancelFlight();W.rig.dist=W.rig.targetDist=W.rig.distMax;W.rig.update(.1);
  const cam=W.rig.camera,center=new T.Vector3().project(cam),radius=world.R+(W.rig.terrainTop||110),distance=cam.position.length(),angular=Math.asin(radius/distance),half=Math.atan(Math.tan(cam.fov*Math.PI/360)*Math.min(1,cam.aspect));
  ck('Global base zoom centres and frames the complete planet',Math.abs(center.x)<.05&&Math.abs(center.y)<.05&&angular<half,{center:center.toArray(),angular,half,distance});W.post.render(W.scene,cam,.01);return r;
 }));
 await page.screenshot({path:resolve(out,'global-base.png')});
}catch(error){errors.push(String(error));await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});}finally{writeFileSync(resolve(out,'report.json'),JSON.stringify({scope:'Instrumented economy, input, real unit damage, ability lifecycle and rendered camera. Not a full campaign.',checks,errors},null,2));await browser.close();}
console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok),errors}));if(checks.some(c=>!c.ok)||errors.length)process.exitCode=1;
