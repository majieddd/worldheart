import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'docs/qa/implementation/commander-feedback/before');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});});
 await page.goto('http://127.0.0.1:8141/?map=ninetynine&campaign=0&seed=12345',{timeout:120000});
 await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
 const result=await page.evaluate(async()=>{
  __qaFramesEnabled=false;document.getElementById('btn-begin').click();WH.game.paused=true;
  const {R}=await import('/js/world.js'),W=WH,a=W.allies.active[0],nav=W.nav,records=[];
  const origin=a.dir.clone(),fwd=a.fwd.clone();
  for(let n=0;n<nav.n&&records.length<36;n++){
   if(!nav.walk[n]||nav.dist[n]<5||nav.dist[n]>50)continue;
   let edge=false;for(let j=nav.adjOff[n];j<nav.adjOff[n+1];j++)if(!nav.walk[nav.adj[j]]||!Number.isFinite(nav.cost[j]))edge=true;
   if(!edge)continue;
   for(let heading=0;heading<8;heading++){
    nav.nodeDir(n,a.dir);a.fwd.copy(fwd).addScaledVector(a.dir,-fwd.dot(a.dir)).normalize().applyAxisAngle(a.dir,heading*Math.PI/4);W.allies._ground(a);
    const start=a.dir.clone(),bearing=a.fwd.clone();
    for(let k=0;k<45;k++)W.allies.driveUnit(a,1,.35,1/60);
    const distance=start.angleTo(a.dir)*R;
    if(distance<1.5)records.push({node:n,heading,distance,start:start.toArray(),bearing:bearing.toArray(),end:a.dir.toArray()});
   }
  }
  a.dir.copy(origin);a.fwd.copy(fwd);W.allies._ground(a);W.possession.enter(a);W.step(.1);
  return {scope:'Instrumented 0.75-second diagonal movement at terrain boundaries, seed12345, no performance claim',effectiveSeed:W.CONFIG?.seed,records};
 });
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('title-overlay')).opacity==='0',{},{polling:50});
 await page.screenshot({path:resolve(out,'first-person.png')});
 await page.evaluate(()=>{WH.possession.boom=WH.possession.boomWant=5;WH.possession.unit.swingDur=.85;WH.possession.unit.swingT=.51;WH.possession.unit.swingSide=1;WH.step(.1);});
 await page.screenshot({path:resolve(out,'third-person-active.png')});
 writeFileSync(resolve(out,'movement.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({records:result.records.length,mean:result.records.reduce((a,b)=>a+b.distance,0)/result.records.length}));
} finally {await browser.close();}
