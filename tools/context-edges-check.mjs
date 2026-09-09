import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'docs/qa/implementation/commander-feedback/context-edges');mkdirSync(out,{recursive:true});
const base=(process.argv.find(x=>x.startsWith('--base-url='))?.slice('--base-url='.length)||'http://127.0.0.1:8141/').replace(/\/?$/,'/');
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],faults=[];
const check=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>faults.push(String(e)));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});});
 await page.goto(`${base}?map=ninetynine&campaign=1&seed=12345`,{timeout:120000});
 await page.waitForFunction(()=>WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
 await page.evaluate(async()=>{
  __qaFramesEnabled=false;document.getElementById('btn-begin').click();WH.game.paused=true;WH.game.gold=100000;WH.game.tierCap=10;
  const W=WH,{surfacePoint}=await import(new URL('js/world.js',location.href).href);window.__a=W.allies.active[0];
  for(let n=0;n<W.nav.n;n++)if(W.nav.walk[n]&&W.nav.dist[n]>4&&W.nav.dist[n]<13){W.nav.nodeDir(n,W.game.cursorDir);surfacePoint(W.game.cursorDir,W.game.cursorPos);W.game.cursorValid=true;W.game.buildType='bolt';W.game._tryPlace();if(W.towers.towers.length)break;}
  W.game.cancelBuild();window.__tower=W.towers.towers[0];W.game.select(__tower);W.step(.5);
 });
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('title-overlay')).opacity==='0',{},{polling:50});
 for(const size of [{width:1280,height:720},{width:1920,height:1080},{width:390,height:844}]){
  await page.setViewportSize(size);await page.evaluate(()=>{WH.step(.1);WH.game.select(__tower);WH.game.context.update();});
  const rects=await page.evaluate(()=>{const p=document.getElementById('tower-panel'),s=document.getElementById('campaign-save');return {panel:p.getBoundingClientRect().toJSON(),save:s?.getBoundingClientRect().toJSON(),shown:!!s&&!s.hidden&&p.classList.contains('show')&&getComputedStyle(p).visibility!=='hidden',overflow:document.body.scrollWidth>innerWidth};});
  const a=rects.panel,b=rects.save;check(`Actual checkpoint and tower panel do not overlap at ${size.width}x${size.height}`,rects.shown&&!rects.overflow&&b&&(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom),rects);
  await page.screenshot({path:resolve(out,`checkpoint-${size.width}.png`)});
 }
 await page.setViewportSize({width:1280,height:720});
 const point=await page.evaluate(()=>{WH.game.select(null);WH.game.context.dismissed=null;WH.step(.1);const p=__tower.pos.clone().addScaledVector(__tower.pos.clone().normalize(),1.1).project(WH.rig.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
 await page.mouse.move(point.x,point.y);await page.evaluate(()=>WH.game.context.update());
 check('Real board pointer hover discovers the tower without selecting it first',await page.evaluate(()=>WH.game.contextTower===__tower&&WH.game.selectedTower===null));
 const boardTier=await page.evaluate(()=>__tower.tier);await page.locator('#tp-upgrade').click();
 check('Hovered tower Upgrade button purchases the displayed tower tier',await page.evaluate(()=>__tower.tier)===boardTier+1);
 await page.evaluate(()=>{const W=WH,a=__a,t=__tower;a.dir.copy(t.pos).normalize().addScaledVector(a.fwd,-5/240).normalize();W.allies._ground(a);W.possession.enter(a);W.step(.1);W.rig.camera.lookAt(t.pos.clone().addScaledVector(t.pos.clone().normalize(),1.1));W.rig.camera.updateMatrixWorld();W.game.context.update();});
 await page.keyboard.press('f');
 const fp=await page.evaluate(()=>{const a=document.getElementById('tower-panel').getBoundingClientRect(),b=document.getElementById('campaign-save').getBoundingClientRect();return {editing:WH.game.context.editing,overlap:!(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom)};});
 check('First-person tower management avoids the actual checkpoint',fp.editing&&!fp.overlap,fp);
 const firstPersonTier=await page.evaluate(()=>__tower.tier);await page.locator('#tp-upgrade').click();
 check('First-person Upgrade button purchases the displayed tower tier',await page.evaluate(()=>__tower.tier)===firstPersonTier+1);
 await page.screenshot({path:resolve(out,'checkpoint-first-person.png')});
 await page.evaluate(()=>{const old=__tower.tier,c=WH.game.context;c.dismissed=null;c.update();c.open();if(WH.game.contextTower!==__tower)throw Error('Out-of-reach fixture must start with a managed tower');__a.dir.copy(WH.nav.nodeDir(WH.nav.portalNodes[0],__a.dir.clone()));WH.allies._ground(__a);WH.game.upgradeSelected();window.__farResult=__tower.tier===old;WH.game.context.close();});
 check('An out-of-reach tower cannot be remotely upgraded',await page.evaluate(()=>__farResult));
 await page.evaluate(async()=>{
  const W=WH,a=__a,m=W.mode99,{generateWeapon}=await import(new URL('js/run/weapons.js',location.href).href),{makeRng}=await import(new URL('js/run/rng.js',location.href).href);
  a.dir.copy(__tower.pos).normalize().addScaledVector(a.fwd,-5/240).normalize();W.allies._ground(a);W.possession.placeCamera();
  window.__makeDrop=(id,family)=>{const drop=generateWeapon({id,family,seed:41,rng:makeRng(41)});m.inventory.register(drop);m.loot.add(drop,a.dir.clone().addScaledVector(a.fwd,1.7/240).normalize());const e=m.loot.entries.get(id);W.rig.camera.lookAt(e.position.clone().addScaledVector(e.position.clone().normalize(),.8));W.rig.camera.updateMatrixWorld();W.game.context.dismissed=null;W.game.context.update();return drop;};
  __makeDrop('incompatible-carbine','carbine');
 });
 await page.keyboard.press('f');
 check('Incompatible aimed loot has real stats and rejects equip without crashing',await page.evaluate(()=>WH.game.context.target?.object?.item.id==='incompatible-carbine'&&document.getElementById('loot-equip').disabled&&document.getElementById('loot-compatibility').textContent.includes('Incompatible')&&!document.getElementById('loot-stats').textContent.includes('undefined')));
 await page.screenshot({path:resolve(out,'incompatible-preview.png')});
 await page.evaluate(async()=>{
  const m=WH.mode99,{generateWeapon}=await import(new URL('js/run/weapons.js',location.href).href),{makeRng}=await import(new URL('js/run/rng.js',location.href).href);
  for(let i=0;m.inventory.items.length-m.inventory.slots.filter(Boolean).length<12;i++){const item=generateWeapon({id:`bag-${i}`,family:'sword',seed:i,rng:makeRng(i+1)});m.inventory.register(item);m.inventory.pickup(item.id);}
  window.__fullBefore=JSON.stringify(m.inventory.snapshot());WH.game.context.update();
 });
 await page.locator('#loot-pickup').click();
 check('Full bag opens deliberate replacement without losing or equipping the drop',await page.evaluate(()=>document.getElementById('weapon-dialog').open&&WH.mode99.loot.entries.has('incompatible-carbine')&&JSON.stringify(WH.mode99.inventory.snapshot())===__fullBefore));
 await page.getByRole('button',{name:'Resume',exact:true}).click();
 await page.evaluate(()=>{WH.mode99.loot.remove('incompatible-carbine');__makeDrop('lobber-preview','lobber');});
 await page.keyboard.press('f');
 check('Lobber inspection presents blast, fuse and speed instead of undefined reach',await page.evaluate(()=>{const text=document.getElementById('loot-stats').textContent;return text.includes('Blast')&&text.includes('Fuse')&&text.includes('Speed')&&!text.includes('undefined');}));
 await page.screenshot({path:resolve(out,'lobber-preview.png')});
 check('Weapon preview fills a useful share of its viewport',await page.evaluate(()=>{const c=WH.game.context,b=c.previewCamera;return b.right-b.left<3&&c.previewObject.children.length>1;}));
 const lifecycle=await page.evaluate(()=>{
  const m=WH.mode99,a=__a;WH.game.context.close();const disposable=m.inventory.items.find(x=>!m.inventory.slots.includes(x.id));m.inventory.salvage(disposable.id);
  const drop=m.inventory.drops.find(x=>x.id==='lobber-preview');a.swingT=.5;a.strikePending=true;const previous=m.inventory.current?.id;
  const picked=m.weapons.pickup(drop.id),queued=m.weapons.request({kind:'equip',id:drop.id,slot:0});const safe=m.inventory.current?.id===previous&&!!m.inventory.pending;
  a.swingT=0;a.strikePending=false;m.inventory.settle(false);return {picked,queued,safe,settled:m.inventory.current?.id===drop.id};
 });
 check('Pickup plus equip during a committed attack queues until recovery',lifecycle.picked&&lifecycle.queued&&lifecycle.safe&&lifecycle.settled,lifecycle);
 const sale=await page.evaluate(()=>{WH.game.context.close();WH.possession.exit();WH.step(.5);WH.game.select(__tower);WH.game.context.update();return {gold:WH.game.gold,value:__tower.sellValue(WH.game.refundFrac())};});
 await page.locator('#tp-sell').click();
 check('Contextual Sell removes the displayed tower and pays its exact refund',await page.evaluate(s=>!WH.towers.towers.includes(__tower)&&WH.game.gold===s.gold+s.value,sale));
 writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Instrumented campaign checkpoint, actual pointer/keyboard/UI and inventory edge cases; isolated profile with explicit fixture resources',base,checks,faults},null,2)+'\n');
 console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok),faults},null,2));if(checks.some(c=>!c.ok)||faults.length)process.exitCode=1;
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({error:String(error),checks,faults},null,2));throw error;}finally{await browser.close();}
