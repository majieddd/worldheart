// Explicit shell fixtures. Teleported bodies below test transaction guards;
// the unforced out-and-back expedition is recorded by tools/self-play.mjs.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(process.env.WH_NODE_MODULES?resolve(process.env.WH_NODE_MODULES,'package.json'):import.meta.url);
const {chromium}=require('playwright');const out=resolve(process.argv[2]||'artifacts/m2');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),faults=[];
  page.on('pageerror',e=>faults.push(String(e)));
  await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});});
  await page.goto('http://127.0.0.1:8139/?map=ninetynine&seed=12345');
  const ready=()=>page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
  await ready();
  const checks=await page.evaluate(()=>{
    __qaFramesEnabled=false;const W=WH,g=W.game,m=W.mode99,r=m.run,a=W.allies.active[0];
    const checks=[];const check=(name,ok,actual)=>{checks.push({name,ok,actual});if(!ok)throw Error(name+': '+JSON.stringify(actual));};
    const initial=r.getFrontierTheta(),opening=W.caches.caches.slice(),gold=g.gold;
    check('Opening crystals are reachable and outside the frontier',opening.length>=4&&opening.every(c=>Number.isFinite(W.nav.dist[c.node])&&Math.acos(c.dir.dot(W.nav.fieldCenter))>initial),opening.map(c=>({id:c.id,node:c.node,cost:W.nav.dist[c.node]})));
    document.getElementById('btn-begin').click();g.paused=true;
    const move=dir=>{a.dir.copy(dir).normalize();a.fwd.addScaledVector(a.dir,-a.fwd.dot(a.dir)).normalize();};
    move(opening[0].dir);W.step(.1);check('Pause does not collect resources',m.crystals.carried.length===0);
    g.paused=false;W.step(.02);check('Proximity collects one carried crystal',m.crystals.carried.length===1&&opening[0].taken);
    check('Pickup grants no gold or expansion',g.gold===gold&&m.crystals.credit===0&&r.getFrontierTheta()===initial);
    check('Carried crystal slows the actual body',Math.abs(a.carryMul-(1-.1/3))<1e-9,a.carryMul);
    // Isolate cargo on a level water surface now that real hills change the
    // speed along different-length steps. This remains a position fixture.
    if(W.CONFIG.terrain){
      const node=Array.from(W.nav.height).findIndex((h,i)=>h < -1.3&&W.nav.walk[i]&&Number.isFinite(W.nav.dist[i]));
      if(node<0)throw Error('Missing level-water cargo control');
      move(W.nav.nodeDir(node,a.dir));
    }
    const start=a.dir.clone(),fwd=a.fwd.clone(),penalty=a.carryMul;
    W.allies.driveUnit(a,1,0,.05);const loaded=start.angleTo(a.dir);
    a.dir.copy(start);a.fwd.copy(fwd);a.carryMul=1;W.allies.driveUnit(a,1,0,.05);const empty=start.angleTo(a.dir);
    a.dir.copy(start);a.fwd.copy(fwd);a.carryMul=penalty;
    check('Real travel distance matches the carry penalty',Math.abs(loaded/empty-penalty)<.0001,{ratio:loaded/empty,penalty});
    for(let i=1;i<4;i++){move(opening[i].dir);W.step(.02);}
    check('Full carry leaves the fourth crystal in the world',m.crystals.carried.length===3&&!opening[3].taken);
    check('Far-away deposit is refused',!m.depositCrystals()&&m.crystals.credit===0);
    move(W.nav.fieldCenter);W.step(.02);document.getElementById('btn-deposit').click();
    check('Deposit pays base-only credit',m.crystals.credit===300&&m.crystals.carried.length===0&&g.gold===gold);
    check('Deposit never expands territory',r.getFrontierTheta()===initial);
    dispatchEvent(new KeyboardEvent('keydown',{code:'KeyC'}));check('Duplicate deposit cannot pay twice',m.crystals.credit===300);
    document.getElementById('heart-panel').click();
    check('Explicit purchase spends credit and expands',m.crystals.credit===50&&g.gold===gold&&r.getHeartLevel()===1&&r.getFrontierTheta()>initial);
    const theta=r.getFrontierTheta();g.gold=0;document.getElementById('heart-panel').click();
    check('Insufficient mixed payment changes nothing',m.crystals.credit===50&&g.gold===0&&r.getHeartLevel()===1&&r.getFrontierTheta()===theta);
    W.waves.onWaveClear(1,0);check('A live wave callback does not expand territory',r.getFrontierTheta()===theta);
    move(opening[3].dir);W.step(.02);W.allies.damage(a,a.hpMax*2);
    check('Commander death loses cargo and refuses deposits',m.crystals.carried.length===0&&!m.depositCrystals());
    return checks;
  });
  await page.screenshot({path:resolve(out,'transaction-fixture.png')});
  await page.reload();await ready();
  const retry=await page.evaluate(()=>({credit:WH.mode99.crystals.credit,carried:WH.mode99.crystals.carried.length,level:WH.mode99.run.getHeartLevel(),theta:WH.mode99.run.getFrontierTheta()}));
  checks.push({name:'Reload starts a fresh assault without duplicate credit',ok:retry.credit===0&&retry.carried===0&&retry.level===0&&retry.theta===.05,actual:retry});
  const result={scope:'Injected-position/resource shell fixtures; natural expedition is separate',checks,faults};
  writeFileSync(resolve(out,'crystal-results.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({checks:checks.length,pass:checks.every(c=>c.ok)&&!faults.length,faults}));
  if(checks.some(c=>!c.ok)||faults.length)process.exitCode=1;
}finally{await browser.close();}
