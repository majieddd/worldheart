import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/m4-poses');mkdirSync(out,{recursive:true});
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,'');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),faults=[];
 page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});});
 await page.goto(`${base}/?map=ninetynine&seed=12345`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
 await page.evaluate(async()=>{
   __qaFramesEnabled=false;document.getElementById('btn-begin').click();WH.game.paused=true;
   const {terrainHeight,R}=await import(new URL('js/world.js',location.href)),a=WH.allies.active[0],n=WH.nav;
   let best=-1,cost=Infinity;
   for(let i=0;i<n.n;i++)if(n.walk[i]&&n.height[i]>.13&&n.height[i]<1.3&&n.dist[i]>5&&n.dist[i]<12){const c=Math.abs(n.dist[i]-8);if(c<cost){cost=c;best=i;}}
   window.__poseDir=n.nodeDir(best>=0?best:n.heartNode,a.dir.clone());
   const up=__poseDir,side=a.fwd.clone().addScaledVector(up,-a.fwd.dot(up)).normalize();let score=Infinity;
   for(let i=0;i<16;i++){
     const f=side.clone().applyAxisAngle(up,i*Math.PI/8);let high=0;
     for(const d of [4,8,12,18]){const v=up.clone().addScaledVector(f,d/R).normalize();high=Math.max(high,terrainHeight(v.x,v.y,v.z));}
     if(high<score){score=high;window.__poseFacing=f;}
   }
 });
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('title-overlay')).opacity==='0',{},{polling:50});
 const records=[];
 for(const family of ['sword','spear','carbine','lobber','twinblade','scepter'])for(const tier of [1,34,67]){
  records.push(await page.evaluate(async({family,tier})=>{
   const {generateWeapon,weaponStats,FAMILIES,materialForWeapon}=await import(new URL('js/run/weapons.js',location.href)),{makeRng}=await import(new URL('js/run/rng.js',location.href));
   const W=WH;W.possession.exit();let unit=W.allies.active.find(a=>a.typeKey===(family==='carbine'||family==='scepter'?'marksman':'commander'));
   if(!unit){const lead=W.allies.active[0];unit=W.allies.spawn('marksman',lead.dir,lead.dir,8);}
   for(const a of W.allies.active)a.hidden=true;
   unit.dir.copy(__poseDir);unit.anchor.copy(__poseDir);unit.fwd.copy(__poseFacing);W.allies._ground(unit);
   const item=generateWeapon({id:'pose',seed:42,tier,family,rng:makeRng(42)});item.rarity=tier===1?'common':tier===34?'epic':'relic';item.parts={head:'balanced',grip:'balanced',core:'frost'};
   unit.swingT=0;unit.strikePending=false;
   W.allies.setWeapon(unit,weaponStats(item,unit.typeKey),FAMILIES[family].visual,FAMILIES[family].view,0xffffff,1,{era:item.era,core:item.parts.core,material:materialForWeapon(item)});
   W.possession.enter(unit);W.possession.boom=W.possession.boomWant=0;W.step(.1);
   return {family,tier,era:item.era,model:unit.modelKey,view:W.viewModel.typeKey,near:W.rig.camera.near,weaponParts:W.allies.species[unit.modelKey].parts.filter(p=>p.weapon).length};
  },{family,tier}));
  await page.screenshot({path:resolve(out,`${family}-${tier}-first.jpg`),quality:82});
  if(tier===1){
   await page.evaluate(()=>{const u=WH.possession.unit;u.swingDur=u.type.strike.cd;const at=u.type.strike.kind==='projectile'?.12:u.type.strike.kind==='lob'?.42:.4;u.swingT=u.swingDur*(1-at);WH.step(1/60);});
   await page.screenshot({path:resolve(out,`${family}-strike.jpg`),quality:82});
  }
  await page.evaluate(()=>{WH.possession.boom=WH.possession.boomWant=5;WH.step(.1);});
  await page.screenshot({path:resolve(out,`${family}-${tier}-third.jpg`),quality:82});
 }
 await page.evaluate(async()=>{
   const {R,terrainHeight}=await import(new URL('js/world.js',location.href)),W=WH,u=W.possession.unit;
   W.possession.exit();u.hidden=false;u.swingT=0;u.strikePending=false;
   const e=W.enemies.spawn('husk',W.nav.heartNode,1);
   e.dir.copy(u.dir).addScaledVector(u.fwd,1/R).normalize();e.height=terrainHeight(e.dir.x,e.dir.y,e.dir.z);e.alt=0;e.atkCd=0;e.scanT=0;
   W.enemies._melee(e,0);W.mode99.threats.update();
   W.rig.lon=Math.atan2(u.dir.x,u.dir.z);W.rig.lat=Math.asin(u.dir.y);W.rig.dist=W.rig.targetDist=10;W.rig.pitch=.8;W.rig.flight=null;
   W.step(1/60);
   const cam=W.rig.camera,center=W.allies.worldPos(u,u.dir.clone());
   cam.position.copy(center).addScaledVector(u.dir,12);cam.up.copy(u.fwd);cam.lookAt(center);cam.near=.1;cam.fov=55;cam.updateProjectionMatrix();cam.updateMatrixWorld();
   W.post.render(W.scene,cam,1/60);
   window.__poseThreat=!!e.attackPlan&&W.mode99.threats.pool.some(g=>g.visible&&g.userData.attack===e.attackPlan);
 });
 await page.screenshot({path:resolve(out,'red-strike-volume.jpg'),quality:88});
 const threatVisible=await page.evaluate(()=>__poseThreat);
 writeFileSync(resolve(out,'poses.json'),JSON.stringify({scope:'Fixed-pose fixtures with tier, equipment and phase injected; not campaign progression',records,threatVisible,faults},null,2)+'\n');
 console.log(JSON.stringify({records:records.length,missingWeapons:records.filter(r=>!r.weaponParts),faults}));if(faults.length||records.some(r=>!r.weaponParts))process.exitCode=1;
}finally{await browser.close();}
