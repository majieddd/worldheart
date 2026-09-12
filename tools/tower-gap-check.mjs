import {createRequire} from 'node:module';import {mkdirSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8139',out=resolve(process.argv[2]||'artifacts/living-worlds/tower-gaps');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));let report={};
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__frames=true;window.requestAnimationFrame=fn=>raf(t=>{if(__frames)fn(t);});});
try{
 await page.goto(base+'/?map=ninetynine&campaign=0&seed=12345');await page.waitForFunction(()=>window.WH?.mode99&&document.querySelector('#boot.done'),{},{timeout:180000});await page.locator('#btn-begin').click();
 report=await page.evaluate(async()=>{
  __frames=false;const W=WH,n=W.nav,T=await import(new URL('lib/three.module.min.js',location.href)),world=await import(new URL('js/world.js',location.href)),V=()=>new T.Vector3(),checks=[];const ck=(name,ok,detail)=>checks.push({name,ok:!!ok,detail});
  let node=n.portalNodes[0];for(let k=0;k<n.n&&n.march.dist[node]>14;k++)node=n.march.next[node];
  const center=n.nodeDir(node,V()),next=n.nodeDir(n.march.next[node],V()),fwd=next.clone().addScaledVector(center,-next.dot(center)).normalize(),side=V().crossVectors(center,fwd).normalize();
  const towers=[];
  for(const sign of [-1,1]){const dir=center.clone().addScaledVector(side,sign*1.65/world.R).normalize(),pos=world.surfacePoint(dir,V()),tower=W.towers.place('bolt',pos);n.blockNodes(pos,W.TOWER_TYPES.bolt.footprint*n.footprintScale,tower.id);towers.push(tower);}
  ck('Actual tower pair leaves its visible gap walkable',!n.block[node]&&Number.isFinite(n.march.dist[node]),{node,nominalGap:3.3-2*W.TOWER_TYPES.bolt.footprint,route:n.march.dist[node]});
  const start=center.clone().addScaledVector(fwd,-5/world.R).normalize(),source=n.nearestWalkableNode(start);ck('Approach remains reachable',Number.isFinite(n.march.dist[source]));
  const a=W.mode99.commander;a.dir.copy(center).addScaledVector(fwd,35/world.R).normalize();W.allies._ground(a);
  const enemy=W.enemies.spawn('husk',source,1);let through=false,closest=Infinity;
  for(let i=0;i<1800&&enemy.active;i++){
   W.enemies.update(1/60);const along=enemy.dir.dot(fwd)*world.R,across=enemy.dir.dot(side)*world.R;
   if(Math.abs(along)<.8&&Math.abs(across)<1){through=true;for(const tower of towers)closest=Math.min(closest,enemy.dir.angleTo(tower.pos.clone().normalize())*world.R);}
  }
  ck('A real ground enemy walks between the towers',through,{nearestTowerCenter:closest});
  ck('All original nest routes survive the pair',n.portalNodes.every(i=>Number.isFinite(n.march.dist[i])));
  W.possession.exit();W.rig.cancelFlight();W.rig.lon=Math.atan2(center.x,center.z);W.rig.lat=Math.asin(center.y);W.rig.dist=W.rig.targetDist=20;W.step(.01,60,true);return {scope:'Instrumented tower placement and actual enemy steering, without tower attacks',checks};
 });await page.screenshot({path:resolve(out,'tower-gap.png')});
}catch(e){errors.push(String(e));}finally{report.errors=errors;writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));if(errors.length||report.checks?.some(c=>!c.ok))process.exitCode=1;}
