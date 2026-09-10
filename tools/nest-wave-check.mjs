// Instrumented production-shell fixtures. Time, health and target placement
// are controlled; this report does not claim a natural run or combat balance.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/nest-waves/browser'),base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,'');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],faults=[];
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 await page.goto(`${base}/?map=ninetynine&campaign=0&seed=12345`);
 await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
 await page.locator('#btn-begin').click();
 checks.push(...await page.evaluate(()=>{
  __qaFramesEnabled=false;const W=WH,w=W.waves,g=W.game,r=[],check=(name,ok,actual)=>r.push({name,ok:!!ok,actual});g.paused=false;
  w.callEarly();for(let i=0;i<160;i++)W.step(1/30);
  const first=W.world.portals.find(p=>p.established),oldIds=W.enemies.active.map(e=>e.id);
  check('Opening wave appears at a dry physical clearing',first?.active&&W.nav.march.floorReach[first.node]&&W.nav.baseHeight[first.node]>=.18,{height:W.nav.baseHeight[first.node],route:W.nav.march.dist[first.node]});
  w.countdown=.01;W.step(1/30);
  check('Next wave adds a new nest while the first wave is alive',w.wave===2&&W.world.portals.filter(p=>p.established).length===2&&oldIds.some(id=>W.enemies.active.some(e=>e.id===id)),{wave:w.wave,nests:w.liveNestCount});
  check('Surviving source contributes to the new wave',w.queues.some(q=>q.wave===2&&q.portal===first.node));
  W.ui.update();check('HUD shows the continuing nest countdown and live count',W.ui.el['wave-sub'].textContent.includes('nests in')&&W.ui.el['nest-count'].textContent.includes('2 nests'),{timer:W.ui.el['wave-sub'].textContent,count:W.ui.el['nest-count'].textContent});
  const before=g.gold;W.world.damagePortal(first,10000);W.allies.onPortalDestroyed(first);W.step(1/30);
  check('Destroying a nest cancels its buildup and updates the count immediately',!w.queues.some(q=>q.portal===first.node)&&w.liveNestCount===1&&g.gold>=before+180);
  // Remove fixture enemies as if defeated, then let the actual director and
  // run bridge resolve both waves. Keep an owned third-wave enemy under draft.
  for(const e of [...W.enemies.active])W.enemies._release(e);
  w.queues=[];w.pendingSpawns=0;W.step(1/30);W.step(1/30);
  check('Ordered clears reach the actual reward draft',w.clearedWaves===2&&W.mode99.run.getPhase()==='drafting',{cleared:w.clearedWaves,phase:W.mode99.run.getPhase()});
  const source=w.activePortals()[0],enemy=W.enemies.spawn('husk',source,1),dir=enemy.dir.clone(),time=W.enemies.time,countdown=w.countdown,hp=g.lives;
  for(let i=0;i<120;i++)W.step(1/30);
  check('Draft freezes real enemy movement, damage and nest clock',enemy.dir.distanceTo(dir)<1e-10&&time===W.enemies.time&&countdown===w.countdown&&hp===g.lives);
  document.querySelector('#draft-cards button').click();W.step(1/30);
  check('Picking a reward resumes the same countdown',W.mode99.run.getPhase()==='building'&&w.countdown<countdown&&w.countdown>countdown-.1,{before:countdown,after:w.countdown});
  W.enemies._release(enemy);g.paused=true;return r;
 }));
 await page.screenshot({path:resolve(out,'nest-countdown.png')});
 for(const width of [375,768,1280]){
  await page.setViewportSize({width,height:720});
  checks.push(await page.evaluate(()=>{
   WH.step(1/60);WH.ui.update();const p=document.getElementById('wave-pill').getBoundingClientRect();
   const boxes=['.hud-top-right','.hud-top-left'].map(s=>document.querySelector(s).getBoundingClientRect());
   const overlap=boxes.some(b=>p.left<b.right&&p.right>b.left&&p.top<b.bottom&&p.bottom>b.top);
   return {name:`Wave HUD fits without overlapping controls at ${innerWidth}px`,ok:!overlap&&p.left>=0&&p.right<=innerWidth&&document.body.scrollWidth<=innerWidth,actual:{left:p.left,right:p.right,width:innerWidth,overlap}};
  }));
  await page.screenshot({path:resolve(out,`hud-${width}.png`)});
 }
 await page.setViewportSize({width:1280,height:720});
 checks.push(...await page.evaluate(async()=>{
  const W=WH,g=W.game,n=W.nav,T=await import(new URL('lib/three.module.min.js',location.href)),world=await import(new URL('js/world.js',location.href));
  const {TOWER_TYPES,tierStats,MODS}=await import(new URL('js/towers.js',location.href)),{modifiedTowerStats}=await import(new URL('js/rewards.js',location.href));
  const r=[],check=(name,ok,actual)=>r.push({name,ok:!!ok,actual}),v=new T.Vector3();
  g.gold=100000;for(let i=0;i<5;i++)W.mode99.upgradeHeart();
  let site=-1,height=0;
  for(let i=0;i<n.n;i+=7){if(n.height[i]<=height||!n.walk[i])continue;n.nodeDir(i,v);if(world.terrainFootprint(v,g._fp(TOWER_TYPES.bolt),'bolt').ok){site=i;height=n.height[i];}}
  check('Fixture finds actual stable neutral raised terrain',site>=0&&height>2,{height});if(site<0)return r;
  const pos=world.surfacePoint(n.nodeDir(site,v),new T.Vector3());
  const t=W.towers.place('bolt',pos);g.buildType='bolt';g.cursorValid=true;g.cursorDir.copy(v);g.cursorPos.copy(pos);g._mountGhost('bolt');
  check('Placement veil equals the actual elevated tower sphere',Math.abs(g.rangeRing.outer.scale.x-t.range)<1e-9&&g.rangeRing.veil.scale.x===g.rangeRing.outer.scale.x,{preview:g.rangeRing.outer.scale.x,range:t.range});
  const flat=modifiedTowerStats(tierStats('bolt',0),MODS.current).range;
  check('Elevation provides extra reach and compensates the vertical drop',t.range>flat&&t.range>t.elevation,{flat,height:t.elevation,range:t.range});
  const tangent=new T.Vector3(0,1,0).cross(v).normalize();
  const targetAt=distance=>{
   const p=pos.clone().addScaledVector(tangent,distance),rad=p.length();
   return {active:true,dead:false,progress:0,dir:p.normalize(),height:rad-world.R,alt:0,type:{flying:false,radius:0,altitude:0}};
  };
  const inside=targetAt(t.range-.01),outside=targetAt(t.range+.01);
  t.target=null;check('Elevated tower acquires just inside its displayed boundary',t._acquire([inside])===inside);
  t.target=null;check('Elevated tower rejects a new target just outside its displayed boundary',t._acquire([outside])===null);
  const valleyDir=v.clone().addScaledVector(tangent,flat*1.05/world.R).normalize();
  const valley={active:true,dead:false,progress:0,dir:valleyDir,height:.03,alt:0,type:{flying:false,radius:0,altitude:0}};
  t.target=null;check('A valley target beyond flat reach is acquired through true 3D distance',t._dist2(valley)>flat*flat&&t._acquire([valley])===valley);
  const before=t.range;t.upgrade();g.cancelBuild();g.select(t);W.ui.refresh();
  check('Upgrade and selected guide keep the elevation bonus synchronized',t.range>before&&Math.abs(g.selRing.outer.scale.x-t.range)<1e-9,{before,after:t.range});
  check('Tower readout explains its high-ground advantage',document.getElementById('tp-stats').textContent.includes('High ground'));
  W.rig.confine=null;W.rig.cancelFlight();W.rig.lat=Math.asin(v.y);W.rig.lon=Math.atan2(v.x,v.z);W.rig.targetDist=W.rig.dist=W.rig.distMin+28;
  W.rig._placeCamera();W.step(1/60);return r;
 }));
 await page.screenshot({path:resolve(out,'high-ground-range.png')});
}catch(error){faults.push(String(error));}
finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Instrumented real shell: overlapping source lifecycle, draft freeze, HUD layout and elevated range boundaries. Controlled enemy removals and tower placement; not natural play.',checks,faults},null,2)+'\n');console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok),faults}));await browser.close();}
if(faults.length||checks.some(c=>!c.ok))process.exitCode=1;
