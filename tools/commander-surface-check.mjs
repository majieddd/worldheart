// Continuous real movement against this build's terrain and a legally placed
// tower. Fixtures reposition the commander, but never replace collision rules.
import{createRequire}from'node:module';import{resolve}from'node:path';import{mkdirSync,writeFileSync}from'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/commander-surface');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],faults=[];
try{const page=await browser.newPage();page.on('pageerror',e=>faults.push(String(e)));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 await page.goto(`${base}/?map=ninetynine&campaign=0&seed=12345`);await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
 checks.push(...await page.evaluate(async()=>{
  __qaFramesEnabled=false;document.getElementById('btn-begin').click();const W=WH,n=W.nav,g=W.game,a=W.allies.active.find(x=>x.type.commander),{R,surfacePoint}=await import(new URL('js/world.js',location.href)),T=await import(new URL('lib/three.module.min.js',location.href)),records=[],checks=[];g.paused=true;g.gold=100000;
  for(let i=0;i<n.n&&!W.towers.towers.length;i++){if(!n.walk[i]||n.dist[i]<5||n.dist[i]>15)continue;n.nodeDir(i,g.cursorDir);surfacePoint(g.cursorDir,g.cursorPos);g.cursorValid=true;g.buildType='bolt';g._tryPlace();}g.cancelBuild();checks.push({name:'Fixture legally places a solid tower',ok:W.towers.towers.length===1});
  for(const kind of ['terrain','tower']){
   const sites=[];
   for(let i=0;i<n.n&&sites.length<12;i++){
    if(!n.walk[i]||n.block[i]||!Number.isFinite(n.dist[i])||n.height[i]<.2)continue;
    for(let edge=n.adjOff[i];edge<n.adjOff[i+1];edge++){
     const j=n.adj[edge];if(kind==='tower'?!n.block[j]:n.walk[j]||n.block[j])continue;
     const from=n.nodeDir(i,new T.Vector3()),to=n.nodeDir(j,new T.Vector3()),start=from.clone().lerp(to,.43).normalize();
     if(n.nearestNode(start)!==i)continue;sites.push({i,j,start,bearing:to.addScaledVector(start,-to.dot(start)).normalize()});break;
    }
   }
   checks.push({name:`${kind}: twelve current-layout boundary sites exist`,ok:sites.length===12,actual:sites.map(s=>({node:s.i,obstacle:s.j}))});
   for(const hz of [30,60,120]){
    const runs=[];
    for(const site of sites){a.dir.copy(site.start);a.fwd.copy(site.bearing).applyAxisAngle(a.dir,.8);W.allies._ground(a);let distance=0,violations=0;
     for(let step=0;step<hz;step++){const before=a.dir.clone();W.allies.driveUnit(a,1,.35,1/hz);distance+=before.distanceTo(a.dir)*R;const node=n.nearestNode(a.dir);if(!n.canStep(before,a.dir)||!n.walk[node]||n.block[node])violations++;}
     runs.push({node:site.i,distance,violations});
    }
    const glides=runs.filter(r=>r.distance>.2).length;checks.push({name:`${kind}: ${hz} Hz glancing travel preserves solid boundaries`,ok:runs.length===12&&glides>=8&&runs.every(r=>r.violations===0),actual:{seed:W.CONFIG.seed,glides,runs}});records.push(...runs);
   }
  }
  const from=n.nodeDir(n.heartNode,new T.Vector3()),to=n.nodeDir(n.portalNodes[0],new T.Vector3()),before=n.next.slice(),path=n.findPath(from,to),oracle={dist:new Float32Array(n.n),next:new Int32Array(n.n),walk:n.walk,cost:n.cost,block:n.block};
  n._dijkstra(n.portalNodes[0],null,oracle,n.heartNode);
  checks.push({name:'A real commander route after tower placement matches weighted Dijkstra without changing enemy flow',ok:path.length>1&&path.at(-1)===n.portalNodes[0]&&Math.abs(path.cost-oracle.dist[n.heartNode])<.01&&before.every((v,i)=>v===n.next[i]),actual:{steps:path.length,cost:path.cost,oracle:oracle.dist[n.heartNode]}});
  return checks;
 }));
}catch(e){faults.push(String(e));}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Repositioned fixtures with real continuous driveUnit input and unchanged terrain/tower collision; not human traversal feel',checks,faults},null,2)+'\n');console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok),faults}));await browser.close();}if(faults.length||checks.some(c=>!c.ok))process.exitCode=1;
