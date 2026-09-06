// Isolated movement fixtures: spawn real bodies and run only their manager.
// Combat, health/economy and visual frame-rate acceptance are outside scope.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json'));
const {chromium}=require('playwright');
const seed=process.argv[4]||'12345';
const out=resolve(process.argv[2]||'artifacts/m3-routes');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try{
  for(const profile of (process.argv[3]?[process.argv[3]]:['varied','alpine','canyon','ocean'])){
    const page=await browser.newPage(),faults=[];page.on('pageerror',e=>faults.push(String(e)));
    await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});});
    const start=Date.now();
    await page.goto(`http://127.0.0.1:8139/?map=ninetynine&seed=${seed}&terrain=${profile}`,{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
    const result=await page.evaluate(async()=>{
      __qaFramesEnabled=false;const m=WH.enemies,n=WH.nav,world=await import('/js/world.js');
      m.allies=null;m._render=()=>{};m.spawnNodeOverride=null;m.onSpawnFx=null;m.onLeak=()=>{};
      let ceilingViolation=false;
      for(const node of n.portalNodes)for(const type of ['husk','mite','wisp'])m.spawn(type,node,1);
      const count=m.active.length;let steps=0;
      for(;steps<12000&&m.active.length;steps++){
        m.update(1/30);
        for(const e of m.active)if(e.type.flying&&world.terrainHeight(e.dir.x,e.dir.y,e.dir.z,false)+e.alt>world.FLIGHT_CEILING+.01)ceilingViolation=true;
      }
      const stranded=m.active.map(e=>{
        const j=e.type.flying?n.airNext[e.node]:n.next[e.node],v=n.nodeDir(e.node,e.dir.clone()).normalize(),to=n.nodeDir(j,v.clone()).normalize();
        const p=e.dir.clone().addScaledVector(e.fwd,.08/240).normalize();
        return {node:e.node,next:j,walk:n.walk[e.node],air:n.airWalk[e.node],type:e.typeKey,dir:e.dir.toArray(),height:e.height,speed:e.moveV,nodeHeight:n.baseHeight[e.node],nextHeight:n.baseHeight[j],nodeActual:world.terrainHeight(v.x,v.y,v.z,false),flyHere:world.canFlyAt(e.dir),flyNext:world.canFlyAt(to),step:n.canStep(e.dir,p,e.type.flying,e.node),flyStep:world.canFlyAt(p),distanceCentre:e.dir.angleTo(v)*240,heading:e.fwd.toArray()};
      });
      return {profile:WH.CONFIG.terrainKey,seed:WH.CONFIG.seed,spawned:count,arrived:count-m.active.length,seconds:steps/30,ceilingViolation,stranded};
    });
    result.faults=faults;result.elapsedMs=Date.now()-start;results.push(result);console.log(JSON.stringify(result));
    writeFileSync(resolve(out,'route-results.json'),JSON.stringify(results,null,2));await page.close();
  }
}finally{await browser.close();}
if(results.some(r=>r.stranded.length||r.ceilingViolation||r.faults.length))process.exitCode=1;
