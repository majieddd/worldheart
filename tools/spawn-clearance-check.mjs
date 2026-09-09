// Reset the start position between continuous walks, without replacing movement.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/spawn-clearance'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8139';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),faults=[];
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>faults.push(String(e)));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 await page.goto(`${base}/?map=ninetynine&campaign=0&seed=12345`);
 await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
 await page.locator('#btn-begin').click();await page.waitForFunction(()=>getComputedStyle(document.getElementById('title-overlay')).opacity==='0');
 const result=await page.evaluate(async()=>{
  __qaFramesEnabled=false;const W=WH,n=W.nav,a=W.allies.active.find(x=>x.type.commander),world=await import(new URL('js/world.js',location.href)),T=await import(new URL('lib/three.module.min.js',location.href));W.game.paused=true;
  const start=a.dir.clone(),fwd=a.fwd.clone(),walks=[];
  for(let heading=0;heading<24;heading++) {
   a.dir.copy(start);a.fwd.copy(fwd).applyAxisAngle(a.dir,heading*Math.PI/12);W.allies._ground(a);let distance=0,stuck=0;
   for(let i=0;i<240;i++){const b=a.dir.clone();W.allies.driveUnit(a,1,0,1/60);const d=b.distanceTo(a.dir)*world.R;distance+=d;if(d<.001)stuck++;}
   const next=a.dir.clone().addScaledVector(a.fwd,.2/world.R).normalize(),node=n.nearestNode(next),h=world.terrainHeight(next.x,next.y,next.z,false);
   walks.push({heading,distance,stuck,node,height:h,slope:world.slopeAt(next),forest:world.forestAt(next.x,next.y,next.z),walkable:!!n.walk[node],blocked:n.block[node]});
  }
  const sites=[];
  for(let i=0;i<n.n&&sites.length<12;i++){
   const d=n.nodeDir(i,new T.Vector3());if(d.angleTo(start)*world.R>35||n.height[i]<.24||n.height[i]>1.8||world.forestAt(d.x,d.y,d.z)<=.78||world.slopeAt(d)>.35)continue;
   for(let e=n.adjOff[i];e<n.adjOff[i+1];e++){
    const j=n.adj[e];if(!n.walk[j]||n.block[j])continue;
    a.dir.copy(n.nodeDir(j,new T.Vector3()));a.fwd.copy(d).addScaledVector(a.dir,-d.dot(a.dir)).normalize();W.allies._ground(a);
    const initial=a.dir.angleTo(d)*world.R;let closest=initial;
    for(let f=0;f<120;f++){a.fwd.copy(d).addScaledVector(a.dir,-d.dot(a.dir)).normalize();W.allies.driveUnit(a,1,0,1/60);closest=Math.min(closest,a.dir.angleTo(d)*world.R);if(closest<.08)break;}
    sites.push({node:i,from:j,initial,closest,forest:world.forestAt(d.x,d.y,d.z),slope:world.slopeAt(d),dir:d.toArray()});break;
   }
  }
  if(sites.length){const d=new T.Vector3().fromArray(sites[0].dir);a.dir.copy(n.nodeDir(sites[0].from,new T.Vector3()));a.fwd.copy(d).addScaledVector(a.dir,-d.dot(a.dir)).normalize();W.allies._ground(a);W.possession.enter(a);W.possession.boom=W.possession.boomWant=0;W.step(.3);}
  return {seed:W.CONFIG.seed,start:start.toArray(),walks,sites,checks:[{name:'Twelve flat forest sites near spawn remain traversable',ok:sites.length===12&&sites.every(s=>s.closest<.15)}]};
 });
 await page.screenshot({path:resolve(out,'spawn-forest.png')});writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Source-informed continuous movement from actual spawn and twelve repositioned nearby forest approaches',...result,faults},null,2)+'\n');
 console.log(JSON.stringify({seed:result.seed,walks:result.walks,sites:result.sites,checks:result.checks,faults}));if(faults.length||result.checks.some(c=>!c.ok))process.exitCode=1;
} finally {await browser.close();}
