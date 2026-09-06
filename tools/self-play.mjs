// An unforced, instrumented full-run policy. Uses the same purchase, placement
// validation, card and draft paths as gameplay. WH.step advances only time;
// no gold/lives/enemies/waves/powers are injected. This is not a blind human run.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const require=createRequire(process.env.WH_NODE_MODULES?resolve(process.env.WH_NODE_MODULES,'package.json'):import.meta.url);
const {chromium}=require('playwright');
const seed=process.argv[2]||'12345',out=resolve(process.argv[3]||`artifacts/self-play-${seed}`);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});const faults=[];
page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});});
try{
  await page.goto(`http://127.0.0.1:8139/?map=ninetynine&seed=${seed}`);
  await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
  await page.evaluate(async()=>{
    window.__qaFramesEnabled=false;
    const THREE=await import('/lib/three.module.min.js');
    const {surfacePoint}=await import('/js/world.js');
    const {tierCost}=await import('/js/towers.js');
    const W=WH,g=W.game,run=W.mode99.run;window.__qaTrace=[];
    document.getElementById('btn-begin').click();g.paused=false;
    const centre=W.nav.fieldCenter.clone(),up=new THREE.Vector3(0,1,0);if(Math.abs(up.dot(centre))>.9)up.set(1,0,0);
    const side=new THREE.Vector3().crossVectors(centre,up).normalize(),forward=new THREE.Vector3().crossVectors(centre,side).normalize();
    const trace=(action,extra={})=>__qaTrace.push({action,wave:run.getWave(),lives:g.lives,gold:g.gold,...extra});
    function build(index){
      const type=g.hand[index],def=W.TOWER_TYPES[type];if(g.gold<g._cost(def))return false;
      const paths=W.nav.previewPaths();const samples=[];
      for(const flat of paths)for(let k=0;k<flat.length;k+=9){const p=new THREE.Vector3(flat[k],flat[k+1],flat[k+2]);if(p.distanceTo(W.heartPos)<20)samples.push(p);}
      const options=[];
      for(const radius of [4.1,5.6,7.2,9.0,11.0])for(let i=0;i<36;i++){
        const a=i*Math.PI/18,dir=centre.clone().addScaledVector(side,Math.cos(a)*radius/240).addScaledVector(forward,Math.sin(a)*radius/240).normalize();
        const pos=surfacePoint(dir,new THREE.Vector3());let score=0;
        for(const p of samples){const d=pos.distanceTo(p);if(d<def.tiers[0].range)score+=(1-d/def.tiers[0].range)*(1+Math.max(0,12-p.distanceTo(W.heartPos))*.08);}
        if(type==='warden')score-=radius*.5;
        options.push({dir,pos,score});
      }
      options.sort((a,b)=>b.score-a.score);
      g.toggleBuildCard(index);
      for(const o of options){
        g.cursorValid=true;g.cursorDir.copy(o.dir);g.cursorPos.copy(o.pos);
        if(!g._validate(def).ok)continue;
        const n=W.towers.towers.length;g._tryPlace();g.cancelBuild();
        if(W.towers.towers.length>n){trace('build',{type,pos:o.pos.toArray()});return true;}
      }
      g.cancelBuild();return false;
    }
    let retreating=false;
    window.__qaPolicy=()=>{
      if(g.state!=='playing'||run.getPhase()==='victory')return;
      const commander=W.allies.active.find(a=>a.type.commander);
      if(run.getWave()>=12&&commander&&!retreating){
        W.possession.enter(commander);retreating=true;
        dispatchEvent(new KeyboardEvent('keydown',{code:'KeyS'}));trace('possess-and-retreat');
      }
      if(retreating&&commander&&Math.acos(Math.min(1,commander.dir.dot(centre)))*240>38){
        dispatchEvent(new KeyboardEvent('keyup',{code:'KeyS'}));
      }
      const draft=run.getDraft();
      if(draft){
        const priorities=['mending','hardened-heart','twin-rails','keen-rails','flywheel','overclock','fifth-volley','deep-crit','sharp-edge','chain-coil','thrift','long-lens','far-sight','cryo-field','compound-interest','bounty','salvage'];
        let best=0,rank=999;draft.offers.forEach((p,i)=>{let r=priorities.indexOf(p.id);if(r<0)r=100;if(r<rank){rank=r;best=i;}});
        trace('draft',{power:draft.offers[best].id});document.querySelectorAll('#draft-cards button')[best].click();
      }
      let changes=0;
      for(let attempt=0;attempt<10;attempt++){
        // Use cards before hoarding upgrades; first secure reliable direct
        // damage, then add aura and garrison support near the convergence.
        const hand=g.hand||[];let built=false;
        const owned=W.towers.towers;
        if(owned.length<8)for(const key of ['bolt','tesla','helios','warden','mortar','cryo']){
          if(key==='cryo'&&owned.some(t=>t.typeKey==='cryo'))continue;
          const i=hand.indexOf(key);if(i>=0&&build(i)){built=true;changes++;break;}
        }
        if(built)continue;
        const eligible=owned.filter(t=>t.tier+1<g.tierCap&&g.gold>=tierCost(t.typeKey,t.tier+1));
        eligible.sort((a,b)=>((b.damageDealt+40)/(tierCost(b.typeKey,b.tier+1)+1))-((a.damageDealt+40)/(tierCost(a.typeKey,a.tier+1)+1)));
        const t=eligible.find(t=>['bolt','tesla','helios','mortar'].includes(t.typeKey))||eligible[0];
        if(t){g.select(t);document.getElementById('tp-upgrade').click();trace('upgrade',{type:t.typeKey,tier:t.tier});changes++;continue;}
        const cost=run.getHeartCost();
        if(cost!==null&&owned.length>=2&&g.gold>=cost){document.getElementById('heart-panel').click();trace('base',{level:run.getHeartLevel()});changes++;continue;}
        break;
      }
      g.select(null);return changes;
    };
    __qaPolicy();trace('start');
  });
  let lastWave=0,result;
  for(let i=0;i<600;i++){
    result=await page.evaluate(()=>{__qaPolicy();WH.step(2);return {state:WH.game.state,phase:WH.mode99.run.getPhase(),wave:WH.mode99.run.getWave(),lives:WH.game.lives,gold:WH.game.gold,kills:WH.game.kills,score:WH.game.score,towers:WH.towers.towers.length,commander:WH.allies.active.filter(a=>a.type.commander).map(a=>({hp:a.hp,hpMax:a.hpMax,state:a.state,dir:a.dir.toArray()})),seed:WH.CONFIG.seed};});
    if(result.wave!==lastWave){lastWave=result.wave;console.log(JSON.stringify(result));await page.screenshot({path:resolve(out,`wave-${String(lastWave).padStart(2,'0')}.png`)});}
    if(result.state==='defeat'||result.phase==='victory')break;
  }
  await page.screenshot({path:resolve(out,'terminal.png')});
  result.trace=await page.evaluate(()=>__qaTrace);result.faults=faults;result.scope='Unforced instrumented self-play, legal purchases/cards/placements; deterministic time advance; fresh profile';
  writeFileSync(resolve(out,'run.json'),JSON.stringify(result,null,2)+'\n');console.log('TERMINAL '+JSON.stringify({...result,trace:result.trace.length}));
  if(result.phase!=='victory'||faults.length)process.exitCode=1;
}catch(e){console.error(e);await page.screenshot({path:resolve(out,'error.png')});process.exitCode=1;}finally{await browser.close();}
