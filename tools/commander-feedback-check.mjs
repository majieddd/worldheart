import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'docs/qa/implementation/commander-feedback/after');mkdirSync(out,{recursive:true});
const base=(process.argv.find(x=>x.startsWith('--base-url='))?.slice(11)||process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,'');
const baseline=JSON.parse(readFileSync('docs/qa/implementation/commander-feedback/before/movement.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[],faults=[];const check=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});});
 await page.goto(`${base}/?map=ninetynine&campaign=0&seed=12345`,{timeout:120000});
 await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
 const fixtures=await page.evaluate(async baseline=>{
  __qaFramesEnabled=false;document.getElementById('btn-begin').click();WH.game.paused=true;
  const W=WH,m=W.mode99,a=W.allies.active[0],nav=W.nav,checks=[];window.__a=a;
  const check=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
  const {R,surfacePoint}=await import('/js/world.js'),{Vector3,Matrix4}=await import('three'),{poseSoldier}=await import('/js/soldier.js');
  const oldDir=a.dir.clone(),oldFwd=a.fwd.clone(),movement=[];
  // The rounded terrain chooser can select a different effective seed.
  // Frozen coordinates on another layout cannot measure collision regression;
  // commander-surface-check samples actual boundaries in the current world.
  if(W.CONFIG.seed===baseline.effectiveSeed){
  for(const entry of baseline.records){
   a.dir.fromArray(entry.start);a.fwd.fromArray(entry.bearing);W.allies._ground(a);
   for(let k=0;k<45;k++)W.allies.driveUnit(a,1,.35,1/60);
   movement.push({...entry,after:new Vector3(...entry.start).angleTo(a.dir)*R,blocked:!!nav.block[nav.nearestNode(a.dir)]});
  }
  check('Boundary movement improves on the exact retained inputs',movement.reduce((s,r)=>s+r.after,0)>movement.reduce((s,r)=>s+r.distance,0)*1.25,{before:movement.reduce((s,r)=>s+r.distance,0)/movement.length,after:movement.reduce((s,r)=>s+r.after,0)/movement.length,records:movement});
  check('Boundary glides never enter a tower footprint',movement.every(r=>!r.blocked));
  }else window.__legacyMovement={status:'not-comparable',archivedSeed:baseline.effectiveSeed,currentSeed:W.CONFIG.seed,replacement:'tools/commander-surface-check.mjs'};
  a.dir.copy(oldDir);a.fwd.copy(oldFwd);W.allies._ground(a);
  W.game.gold=100000;W.game.tierCap=10;
  for(let n=0;n<nav.n;n++){
   if(!nav.walk[n]||nav.dist[n]<4||nav.dist[n]>13)continue;
   nav.nodeDir(n,W.game.cursorDir);surfacePoint(W.game.cursorDir,W.game.cursorPos);W.game.cursorValid=true;W.game.buildType='bolt';
   W.game._tryPlace();if(W.towers.towers.length)break;
  }
  W.game.cancelBuild();const tower=W.towers.towers[0];window.__tower=tower;
  check('A contextual tower fixture can be legally placed',!!tower);
  W.game.select(tower);W.game.context.update();
  const target=nav.nodeDir(nav.portalNodes[0],new Vector3());a.selected=true;
  check('An actual move order has an authoritative path',W.allies.orderMove(a,target)&&a.route.length>1,a.route?.length);
  m.unitRoutes.update();check('Selected ordered unit draws its actual remaining route',m.unitRoutes.visibleUnitIds.includes(a.id)&&m.unitRoutes.geometry.drawRange.count>0,m.unitRoutes.geometry.drawRange.count);
  const oldRoute=a.route;W.allies.orderMove(a,oldDir);m.unitRoutes.update();check('A new order replaces the line route',a.route!==oldRoute);
  a.selected=false;m.unitRoutes.update();check('Unselection clears the route line',m.unitRoutes.geometry.drawRange.count===0);
  a.selected=true;W.allies.clearOrder(a);m.unitRoutes.update();check('Cancellation clears the route line',m.unitRoutes.geometry.drawRange.count===0);
  const sp=W.allies.species[a.modelKey],directions=[];
  for(const side of [-1,1]){
   a.swingDur=.85;a.swingT=.85*(1-.40);a.swingSide=side;a.phase=0;
   poseSoldier(sp.skeleton,sp.spec,a,{moveT:0,landT:0},0);sp.skeleton.compute(new Matrix4());
   const v=new Vector3(0,0,-1).transformDirection(sp.skeleton.get('weaponR').world);directions.push(v.toArray());
  }
  check('Both sword active frames point through the forward strike volume',directions.every(v=>-v[2]>.9),directions);
  a.swingT=0;a.strikePending=false;
  const wave=W.waves;wave.wave=0;wave._startWave();
  const first=W.world.portals.find(p=>p.established);check('Wave1 establishes a visible reachable source',first.active&&first.group.visible&&Number.isFinite(nav.dist[first.node])&&Number.isFinite(nav.airDist[first.node]),{node:first.node,ground:nav.dist[first.node],air:nav.airDist[first.node]});
  check('Every queued wave unit uses the visible source with a warning',wave.queues.every(q=>q.portal===first.node&&q.t>=3));
  wave.update(4);check('Actual spawns begin within the visible nest footprint before movement',W.enemies.active.length>0&&W.enemies.active.every(e=>e.sourceNest===first.node&&e.dir.angleTo(nav.nodeDir(first.node,new Vector3()))*R<.25),W.enemies.active.map(e=>({source:e.sourceNest,node:e.node,offset:e.dir.angleTo(nav.nodeDir(first.node,new Vector3()))*R,dir:e.dir.toArray()})));
  if(W.world.damagePortal(first,99999))W.allies.onPortalDestroyed(first);wave.update(.01);
  check('Destroying the source cancels its pending buildup',wave.pendingSpawns===0,wave.pendingSpawns);
  for(const e of [...W.enemies.active])W.enemies._release(e);
  wave.state='idle';wave.wave=14;wave._startWave();
  const guardian=W.world.portals.find(p=>p.guardianPending);check('Final wave introduces a protected visible guardian source',!!guardian&&guardian.group.visible);
  W.world.damagePortal(guardian,99999);check('Destroying a source cannot cancel the owed boss',!guardian.destroyed&&wave.queues.some(q=>q.type==='colossus'&&q.portal===guardian.node));
  wave.update(4);check('Boss actually emerges before its nest becomes vulnerable',W.enemies.active.some(e=>e.type.boss&&e.sourceNest===guardian.node)&&!guardian.guardianPending);
  const boss=W.enemies.active.find(e=>e.type.boss),{EVO}=await import('/js/enemies.js');
  boss.node=nav.heartNode;nav.nodeDir(nav.heartNode,boss.dir);const oldIds=new Set(W.enemies.active.map(e=>e.id));
  W.enemies.damage(boss,boss.hpMax*.3,{trueDamage:true});
  const escorts=W.enemies.active.filter(e=>!oldIds.has(e.id));
  check('Actual boss shedding summons escorts inside living nests, away from the mobile boss',escorts.length>0&&escorts.every(e=>e.sourceNest===guardian.node&&e.dir.angleTo(nav.nodeDir(guardian.node,new Vector3()))*R<.25));
  const mite=escorts[0],tier=EVO.tier,ids=new Set(W.enemies.active.map(e=>e.id));EVO.tier=4;mite.shieldT=1;mite.shieldHits=0;mite.node=nav.heartNode;nav.nodeDir(nav.heartNode,mite.dir);
  W.enemies.damage(mite,mite.hpMax*3,{trueDamage:true});const children=W.enemies.active.filter(e=>!ids.has(e.id));EVO.tier=tier;
  check('An actual evolved mite split emerges at a living nest and remains bounded',children.length===2&&children.every(e=>e.isSplit&&e.sourceNest===guardian.node&&e.dir.angleTo(nav.nodeDir(guardian.node,new Vector3()))*R<.25));
  for(const nest of W.world.portals)if(nest.established&&!nest.destroyed&&W.world.damagePortal(nest,99999))W.allies.onPortalDestroyed(nest);
  const count=W.enemies.active.length;W.enemies.damage(boss,boss.hpMax*.25,{trueDamage:true});
  check('Destroyed nests prevent new boss escorts without erasing the live guardian',W.enemies.active.length===count&&boss.active&&!boss.dead);
  for(const e of [...W.enemies.active])W.enemies._release(e);wave.state='idle';wave.queues=[];wave.pendingSpawns=0;
  W.game.select(tower);W.game.context.update();W.step(.01);
  return checks;
 },baseline);
 checks.push(...fixtures);
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('title-overlay')).opacity==='0',{},{polling:50});
 await page.screenshot({path:resolve(out,'tower-board.png')});
 const tier=await page.evaluate(()=>__tower.tier);await page.locator('#tp-upgrade').click();
 check('World-anchored Upgrade remains a real clickable action',await page.evaluate(()=>__tower.tier)===tier+1);
 await page.evaluate(()=>{
  const W=WH,a=__a,t=__tower;a.dir.copy(t.pos).normalize().addScaledVector(a.fwd,-5/240).normalize();W.allies._ground(a);W.possession.enter(a);W.step(.1);
  const aim=t.pos.clone().addScaledVector(t.pos.clone().normalize(),1.1);W.rig.camera.lookAt(aim);W.rig.camera.updateMatrixWorld();W.game.context.update();
 });
 await page.keyboard.press('f');
 check('F lends pointer ownership without jumping or leaving the commander',await page.evaluate(()=>WH.game.context.editing&&WH.possession.suspended&&WH.possession.active&&__a.hop===0));
 await page.screenshot({path:resolve(out,'tower-first-person.png')});
 const fpTier=await page.evaluate(()=>__tower.tier);await page.locator('#tp-upgrade').click();
 check('Commander can click Upgrade while inspecting a nearby tower',await page.evaluate(()=>__tower.tier)===fpTier+1);
 check('Successful commander upgrade automatically resumes control',await page.evaluate(()=>!WH.game.context.editing&&!WH.possession.suspended&&WH.possession.active));
 await page.evaluate(()=>{const c=WH.game.context;c.dismissed=null;c.update();});await page.keyboard.press('f');
 await page.keyboard.press('Escape');check('Escape closes a reopened inspection and resumes the same commander',await page.evaluate(()=>!WH.game.context.editing&&!WH.possession.suspended&&WH.possession.active));
 await page.evaluate(async()=>{
  const {generateWeapon}=await import('/js/run/weapons.js'),{makeRng}=await import('/js/run/rng.js');
  const W=WH,m=W.mode99,a=__a;W.game.select(null);
  const drop=generateWeapon({id:'inspect-actual-sword',family:'sword',seed:45,rng:makeRng(45)});m.inventory.register(drop);m.loot.add(drop,a.dir.clone().addScaledVector(a.fwd,1.7/240).normalize());
  window.__drop=drop;const entry=m.loot.entries.get(drop.id),aim=entry.position.clone().addScaledVector(entry.position.clone().normalize(),.8);
  W.rig.camera.lookAt(aim);W.rig.camera.updateMatrixWorld();W.game.context.dismissed=null;W.game.context.update();
 });
 const aimProbe=await page.evaluate(async()=>{const c=WH.game.context,e=WH.mode99.loot.entries.get(__drop.id),{Vector3}=await import('three'),{raycastTerrain}=await import('/js/world.js'),p=new Vector3();const hit=raycastTerrain(c.ray.ray.origin,c.ray.ray.direction,p);return {id:c.target?.object?.item?.id,kind:c.target?.kind,hover:c.panel().matches(':hover'),editing:c.editing,position:e.position.toArray(),camera:WH.rig.camera.position.toArray(),ray:c.ray.ray.direction.toArray(),hit:hit&&p.toArray(),near:WH.mode99.weapons.nearby().map(x=>x.id)};});
 check('Aimed loot is selected by the actual world ray before pickup',aimProbe.id==='inspect-actual-sword',aimProbe);
 await page.keyboard.press('f');
 check('Ground model and inspection preview exist before pickup',await page.evaluate(()=>WH.mode99.loot.entries.get(__drop.id).token.userData.weaponVisual==='sword'&&document.querySelector('#loot-preview canvas')&&WH.mode99.inventory.drops.some(x=>x.id===__drop.id)));
 await page.screenshot({path:resolve(out,'loot-inspection.png')});
 await page.locator('#loot-equip').click();
 check('Pick up + equip transfers one identity into the active loadout',await page.evaluate(()=>WH.mode99.inventory.current?.id===__drop.id&&!WH.mode99.loot.entries.has(__drop.id)&&!WH.mode99.weapons.pickup(__drop.id)));
 check('No page overflow at desktop',await page.evaluate(()=>document.body.scrollWidth<=innerWidth));
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{WH.possession.exit();WH.step(.5);WH.game.select(__tower);WH.game.context.dismissed=null;WH.game.context.update();});
 await page.screenshot({path:resolve(out,'tower-narrow.png')});
 check('Context avoids checkpoint chrome and page overflow at narrow width',await page.evaluate(()=>{
   const a=document.querySelector('#tower-panel').getBoundingClientRect(),b=document.querySelector('.campaign-save')?.getBoundingClientRect();
   return document.body.scrollWidth<=innerWidth&&(!b||a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom);
 }));
 await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>{WH.game.context.close();WH.possession.exit();WH.step(.5);});
 const camera=await page.evaluate(()=>WH.camTest());check('Campaign camera contract remains green',camera.pass,camera);
 const legacyMovement=await page.evaluate(()=>window.__legacyMovement||null);
 writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Instrumented fixtures and real DOM/mouse/keyboard interactions, not a natural campaign victory',legacyMovement,checks,faults},null,2)+'\n');
 console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok),faults},null,2));
 if(checks.some(c=>!c.ok)||faults.length)process.exitCode=1;
} catch(error) {writeFileSync(resolve(out,'failure.json'),JSON.stringify({error:String(error),checks,faults},null,2));throw error;}
finally{await browser.close();}
