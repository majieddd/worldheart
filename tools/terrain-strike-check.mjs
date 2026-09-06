// Fixed terrain/pose fixtures. Rendered guide coordinates are probed against
// actual damage at three step rates; no campaign outcome is implied.
import {createRequire} from 'node:module';import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/terrain-strikes');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),checks=[],faults=[];
try{
 page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 await page.goto(`${process.env.WH_BASE_URL||'http://127.0.0.1:8139'}/?map=ninetynine&campaign=0&seed=12345&terrain=varied`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
 const sites=await page.evaluate(async()=>{
  __qaFramesEnabled=false;document.getElementById('btn-begin').click();WH.game.paused=true;WH.possession.exit();
  const {groundNormal}=await import(new URL('js/world.js',location.href)),THREE=await import(new URL('lib/three.module.min.js',location.href));
  const n=WH.nav,dir=new THREE.Vector3(),normal=new THREE.Vector3(),best={};
  for(let i=0;i<n.n;i+=7){
   if(!n.walk[i]||!Number.isFinite(n.dist[i])||n.dist[i]<8||n.dist[i]>65)continue;
   n.nodeDir(i,dir);groundNormal(dir,normal);const slope=dir.angleTo(normal),h=n.height[i];
   for(const [kind,cost,valid] of [['flat',slope,h>.2&&h<2],['slope',-slope,h>.3],['shore',Math.abs(h),true],['peak',-h,true]]){
    if(valid&&(!best[kind]||cost<best[kind].cost))best[kind]={node:i,height:h,slope,cost};
   }
  }
  window.__strikeSites=best;return best;
 });
 checks.push({name:'Samples include a slope, shoreline, hill and flat ground',ok:Object.keys(sites).length===4&&sites.slope.slope>.18&&Math.abs(sites.shore.height)<.15&&sites.peak.height>3,actual:sites});
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('title-overlay')).opacity==='0',{},{polling:50});
 for(const site of Object.keys(sites))for(const type of ['mite','husk','aegis','wisp','colossus']){
  const result=await page.evaluate(async({site,type})=>{
   const W=WH,n=W.nav,a=W.allies.active.find(x=>x.type.commander),{terrainHeight,R}=await import(new URL('js/world.js',location.href)),THREE=await import(new URL('lib/three.module.min.js',location.href));
   for(const enemy of [...W.enemies.active])W.enemies._release(enemy);
   a.hp=a.hpMax=100000;a.hop=0;a.swimming=false;a.active=true;a.dead=false;
   const node=__strikeSites[site].node,dir=n.nodeDir(node,new THREE.Vector3()),side=new THREE.Vector3().crossVectors(dir,new THREE.Vector3(0,1,0)).normalize();
   const e=W.enemies.spawn(type,node,1);e.dir.copy(dir);e.height=terrainHeight(dir.x,dir.y,dir.z);e.alt=type==='wisp'?.7:0;e.swimming=false;e.atkCd=0;e.scanT=0;
   // Grounded acquisition chooses its real tangent facing; the wisp is in
   // its low dive pose, rather than a fabricated ground-only damage rule.
   a.dir.copy(dir).addScaledVector(side,.55/R).normalize();a.fwd.copy(side);W.allies._ground(a);
   W.enemies._melee(e,0);W.mode99.threats.update();
   const group=W.mode99.threats.pool.find(g=>g.visible&&g.userData.enemyId===e.id),plan=e.attackPlan;
   if(!group||!plan)return {site,type,error:'No grounded attack acquired'};
   const grounded={origin:e.attackOrigin.toArray(),point:W.allies.worldPos(a,new THREE.Vector3()).toArray(),swimming:a.swimming,wind:plan.wind};
   group.updateMatrixWorld(true);const matrix=group.matrixWorld.clone();
   // Inspect the actual displayed positions before synthetic volume probes.
   W.allies._render(0);W.enemies._render(0);
   const camera=W.rig.camera,centre=e.attackOrigin.clone();camera.position.copy(centre).addScaledVector(dir,7).addScaledVector(side,-6);
   camera.up.copy(dir);camera.lookAt(centre.clone().addScaledVector(side,.6));camera.near=.05;camera.fov=55;camera.updateProjectionMatrix();camera.updateMatrixWorld();W.post.render(W.scene,camera,0);
   window.__strikeFixture={a,e,plan,matrix,grounded};
   return {site,type,grounded};
  },{site,type});
  if(result.error){checks.push({name:`${site}/${type}: ground acquisition`,ok:false,actual:result});continue;}
  await page.screenshot({path:resolve(out,`${site}-${type}.jpg`),quality:85});
  const probes=await page.evaluate(async()=>{
   const W=WH,{a,e,plan,matrix}=__strikeFixture,{R}=await import(new URL('js/world.js',location.href)),THREE=await import(new URL('lib/three.module.min.js',location.href));
   const half=plan.arcDeg*Math.PI/360,outside=half+.12;
   const samples=[['centre',[0,.1,-.45],true],['elevated',[0,.65,-.3],true],['past-radius',[0,.1,-1.12],false],['behind',[0,.1,.5],false],['outside-arc',[Math.sin(outside)*.7,.1,-Math.cos(outside)*.7],false]];
   const results=[];
   for(const fps of [30,60,120])for(const [label,local,expected] of samples){
    const point=new THREE.Vector3(...local).applyMatrix4(matrix);
    // Exact world-space probes, including elevated victims. Injecting hop
    // isolates the display/damage contract from movement path feasibility.
    a.dir.copy(point).normalize();a.height=Math.max(terrainHeightFor(a.dir),.03);a.swimming=false;
    a.hop=point.length()-R-a.height-a.type.radius*.9;a.hp=100000;
    e.attackPlan=plan;e.windT=plan.wind;e.atkVictim=a;e.atkCd=0;
    let elapsed=0,firstDamage=null;
    for(let step=0;step<Math.ceil(plan.wind*fps)+2;step++){
     W.enemies._melee(e,1/fps);elapsed+=1/fps;
     if(a.hp<100000&&firstDamage===null)firstDamage=elapsed;
    }
    W.mode99.threats.update();
    const hit=a.hp<100000,visible=W.mode99.threats.pool.some(g=>g.visible&&g.userData.enemyId===e.id);
    results.push({fps,label,expected,hit,damage:100000-a.hp,firstDamage,ok:hit===expected&&!visible&&(!hit||firstDamage+1e-8>=plan.wind&&firstDamage<=plan.wind+1/fps+1e-8)});
   }
   e.attackPlan=plan;e.windT=plan.wind;e.dead=true;W.mode99.threats.update();
   const cancelled=!W.mode99.threats.pool.some(g=>g.visible&&g.userData.enemyId===e.id);e.dead=false;W.enemies._release(e);a.hop=0;W.allies._ground(a);
   return {results,cancelled};
   function terrainHeightFor(dir){return W.nav.height[W.nav.nearestNode(dir)];}
  });
  checks.push({name:`${site}/${type}: rendered volume, damage timing and removal`,ok:probes.results.every(x=>x.ok)&&probes.cancelled,actual:{...result,...probes}});
 }
}catch(error){faults.push(String(error));}
finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Injected terrain/pose fixtures; grounded acquisition plus exact displayed-volume probes at 30/60/120 Hz. Not natural dodging or campaign play.',checks,faults},null,2)+'\n');console.log(JSON.stringify({passed:checks.filter(x=>x.ok).length,total:checks.length,failed:checks.filter(x=>!x.ok),faults}));await browser.close();}
if(faults.length||checks.some(x=>!x.ok))process.exitCode=1;
