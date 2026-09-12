// An unforced, instrumented full-run policy. Uses the same purchase, placement
// validation, card and draft paths as gameplay. WH.step advances only time;
// no gold/lives/enemies/waves/powers are injected. This is not a blind human run.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validSave } from '../js/run/campaign.js';
const require=createRequire(process.env.WH_NODE_MODULES?resolve(process.env.WH_NODE_MODULES,'package.json'):import.meta.url);
const {chromium}=require('playwright');
const seed=process.argv[2]||'12345',rootOut=resolve(process.argv[3]||`artifacts/self-play-${seed}`);let out=rootOut;mkdirSync(out,{recursive:true});
const expeditionOnly=process.argv.includes('--expedition');
const useWeapons=process.argv.includes('--weapons');
const campaign=process.argv.includes('--campaign');
const useTalents=process.argv.includes('--talents');
const sparseRender=process.argv.includes('--sparse-render');
const cautious=process.argv.includes('--cautious');
const strategy=process.argv.find(x=>x.startsWith('--strategy='))?.split('=')[1]||'defense';
if(!['defense','assault'].includes(strategy))throw Error('Unknown strategy');
const baseUrl=process.argv.find(x=>x.startsWith('--base-url='))?.slice('--base-url='.length)||'http://127.0.0.1:8139/';
const assaultSource=strategy==='assault'?readFileSync(new URL('./assault-policy.mjs',import.meta.url),'utf8'):null;
const towerPriority=process.argv.find(x=>x.startsWith('--tower-priority='))?.split('=')[1].split(',')||['bolt','tesla','helios','warden','mortar','cryo'];
const towerLimit=Number(process.argv.find(x=>x.startsWith('--tower-limit='))?.split('=')[1])||8;
const campaignCount=Number(process.argv.find(x=>x.startsWith('--planets='))?.split('=')[1])||2;
const checkpointPath=process.argv.find(x=>x.startsWith('--checkpoint='))?.slice('--checkpoint='.length);
let sourceCheckpoint=null;
if(checkpointPath){const parsed=JSON.parse(readFileSync(resolve(checkpointPath),'utf8'));sourceCheckpoint=parsed.checkpoint||parsed;if(!campaign||!validSave(sourceCheckpoint))throw Error('Resume requires --campaign and a valid exported checkpoint');}
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});const faults=[];
const runtimeHashes={},responseReads=[];
page.on('response',response=>{
  const url=new URL(response.url());
  if(url.origin!==new URL(baseUrl).origin||!(/\.(js|css)$/.test(url.pathname)||url.pathname==='/'))return;
  responseReads.push(response.body().then(body=>{runtimeHashes[url.pathname]=createHash('sha256').update(body).digest('hex');}).catch(error=>{runtimeHashes[url.pathname]={error:String(error)};}));
});
page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});});
await page.addInitScript(value=>{window.__qaUseWeapons=value;},useWeapons);
await page.addInitScript(value=>{window.__qaStrategy=value.strategy;window.__qaTowerPriority=value.towerPriority;window.__qaTowerLimit=value.towerLimit;window.__qaSparseRender=value.sparseRender;window.__qaCautious=value.cautious;},{strategy,towerPriority,towerLimit,sparseRender,cautious});
if(assaultSource)await page.addInitScript(value=>{window.__qaAssaultSource=value;},assaultSource);
if(sourceCheckpoint)await page.addInitScript(value=>{if(!localStorage.getItem('wh99Campaign'))localStorage.setItem('wh99Campaign',JSON.stringify(value));},sourceCheckpoint);
try{
  await page.goto(`${baseUrl.replace(/\/?$/,'/')}?map=ninetynine&seed=${seed}${campaign?'&campaign=1':''}`,{waitUntil:'domcontentloaded',timeout:120000});
  const campaignResults=[];
  await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
  const startPlanet=campaign?await page.evaluate(()=>WH.mode99.campaign.state().planet):1;
  const endPlanet=campaign?Math.min(startPlanet+campaignCount-1,await page.evaluate(()=>WH.mode99.campaign.state().limit)):1;
  for(let planet=startPlanet;planet<=endPlanet;planet++){
  if(campaign){out=resolve(rootOut,`planet-${planet}`);mkdirSync(out,{recursive:true});}
  await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
  let purchases=[];
  if(useTalents){
    purchases=await page.evaluate(()=>{
      document.getElementById('btn-talents').click();const result=[];
      for(const name of ['Mortar','Counting House','Arc Spire','Helios Lance','Twinfang','Veterancy','Forward Scout','Quartermaster','Cryo Bloom']){
        const button=[...document.querySelectorAll('.talent-node.ready')].find(b=>b.querySelector('.tn-name').textContent===name);
        if(button){const before=Number(document.getElementById('talent-coins').textContent);button.click();result.push({name,before,after:Number(document.getElementById('talent-coins').textContent)});}
      }return result;
    });
    if(purchases.length){await Promise.all([page.waitForEvent('load',{timeout:180000}),page.locator('#btn-talents-close').click()]);await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});}
    else await page.locator('#btn-talents-close').click();
  }
  await page.evaluate(async()=>{
    window.__qaFramesEnabled=false;
    const THREE=await import('/lib/three.module.min.js');
    const {surfacePoint}=await import('/js/world.js');
    const {tierCost}=await import('/js/towers.js');
    const {weaponStats}=await import('/js/run/weapons.js');
    const W=WH,g=W.game,run=W.mode99.run;window.__qaTrace=[];
    document.getElementById('btn-begin').click();g.paused=false;
    const centre=W.nav.fieldCenter.clone(),up=new THREE.Vector3(0,1,0);if(Math.abs(up.dot(centre))>.9)up.set(1,0,0);
    const side=new THREE.Vector3().crossVectors(centre,up).normalize(),forward=new THREE.Vector3().crossVectors(centre,side).normalize();
    const trace=(action,extra={})=>__qaTrace.push({action,wave:run.getWave(),lives:g.lives,gold:g.gold,...extra});
    function build(index){
      const type=g.hand[index],def=W.TOWER_TYPES[type];if(g.gold<g._cost(def))return false;
      const paths=W.nav.previewPaths();const samples=[];
      for(const flat of paths)for(let k=0;k<flat.length;k+=9){const p=new THREE.Vector3(flat[k],flat[k+1],flat[k+2]);if(p.distanceTo(W.heartPos)<38)samples.push(p);}
      const options=[];
      // Shorelines need positions beyond the opening foothold. These remain
      // normal validated placements inside the player's purchased territory.
      for(const radius of [4.1,5.6,7.2,9.0,11.0,14,18,22,26])for(let i=0;i<36;i++){
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
    let retreating=false,weaponAttempted=false;
    window.__qaPolicy=()=>{
      if(g.state!=='playing'||run.getPhase()==='victory')return;
      // A player can leave possession to construct across the purchased field.
      // Trying remote placements from the commander correctly fails reach
      // validation; the first active policy hoarded gold behind that limit.
      if(window.__qaStrategy==='assault'&&window.__qaTripState==='done'&&W.possession.active)W.possession.exit();
      const commander=W.allies.active.find(a=>a.type.commander);
      if(window.__qaUseWeapons&&commander&&W.mode99.weapons){
        const mode=W.mode99;
        const rating=item=>{const stats=weaponStats(item,commander.typeKey);return stats?stats.dmg/stats.cd:0;};
        for(const item of mode.weapons.nearby()){
          const bag=mode.inventory.items.filter(x=>!mode.inventory.slots.includes(x.id)).sort((a,b)=>rating(a)-rating(b));
          const replace=bag.length>=12&&rating(item)>rating(bag[0])?bag[0].id:null;
          if(bag.length>=12&&!replace)continue;
          if(!mode.weapons.pickup(item.id,replace))continue;
          trace('weapon-picked-up',{id:item.id,family:item.family,rarity:item.rarity,replace});
          if(window.__qaStrategy!=='assault'&&mode.weaponPanel.rules.compatible(item.family)&&(!mode.inventory.current||rating(item)>rating(mode.inventory.current))&&mode.weapons.request({kind:'equip',id:item.id,slot:0}))trace('weapon-equipped',{id:item.id,family:item.family});
        }
        if(window.__qaStrategy!=='assault'&&!weaponAttempted&&!retreating&&window.__qaTripState==='done'&&run.getWave()<=7&&commander.hp>commander.hpMax*.85&&W.enemies.active.filter(e=>!e.dead).length<12){
          const candidates=[...mode.loot.entries.values()].filter(e=>mode.weaponPanel.rules.compatible(e.item.family)).map(e=>({entry:e,path:W.nav.findPath(commander.dir,e.position.clone().normalize())})).filter(x=>x.path.length&&x.path.cost<30).sort((a,b)=>a.path.cost-b.path.cost);
          const chosen=candidates[0];
          if(chosen){
            weaponAttempted=true;W.possession.enter(commander);let waypoint=0;
            trace('weapon-expedition',{id:chosen.entry.item.id,nodes:chosen.path.length,cost:chosen.path.cost});
            window.__qaWeaponTrip=()=>{
              const id=chosen.entry.item.id;
              if(!mode.loot.entries.has(id)||commander.hp<commander.hpMax*.65){dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));W.possession.exit();window.__qaWeaponTrip=null;trace('weapon-expedition-ended',{recovered:mode.inventory.items.some(x=>x.id===id)});return;}
              let aim=chosen.entry.position.clone().normalize();
              while(waypoint<chosen.path.length){const p=W.nav.nodeDir(chosen.path[waypoint],new THREE.Vector3());if(commander.dir.angleTo(p)*240>.32){aim=p;break;}waypoint++;}
              const tangent=aim.clone().addScaledVector(commander.dir,-aim.dot(commander.dir)).normalize(),right=new THREE.Vector3().crossVectors(commander.fwd,commander.dir).normalize();
              const turn=Math.atan2(tangent.dot(right),tangent.dot(commander.fwd));
              W.possession.canvas.dispatchEvent(new MouseEvent('mousemove',{buttons:2,movementX:turn/.0032}));dispatchEvent(new KeyboardEvent(Math.abs(turn)<.6?'keydown':'keyup',{code:'KeyW'}));
            };
          }
        }
      }
      if(window.__qaStrategy!=='assault'&&commander&&!retreating&&!window.__qaWeaponTrip&&(run.getWave()>=8||commander.hp<commander.hpMax*.8)&&window.__qaTripState==='done'){
        W.possession.enter(commander);retreating=true;
        if(W.CONFIG.terrain){
          const options=[];
          for(let i=0;i<24;i++){
            const angle=i*Math.PI/12,d=centre.clone().addScaledVector(side,Math.cos(angle)*44/240).addScaledVector(forward,Math.sin(angle)*44/240).normalize();
            const node=W.nav.nearestWalkableNode(d,true);if(node<0||!Number.isFinite(W.nav.dist[node]))continue;
            W.nav.nodeDir(node,d);const path=W.nav.findPath(commander.dir,d);if(!path.length||path.cost>110)continue;
            const nearest=W.enemies.active.reduce((v,e)=>Math.min(v,e.dir.angleTo(d)*240),80);
            options.push({dir:d,path,score:nearest-path.cost*.15});
          }
          options.sort((a,b)=>b.score-a.score);const safe=options[0];
          if(safe){
            let waypoint=0;trace('possess-and-retreat',{nodes:safe.path.length,cost:safe.path.cost});
            window.__qaRetreat=()=>{
              if(!commander.active)return;
              if(commander.dir.angleTo(safe.dir)*240<1){dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));window.__qaRetreat=null;W.possession.exit();W.allies.orderMove(commander,safe.dir);trace('retreat-arrived-and-posted');return;}
              let aim=safe.dir;
              while(waypoint<safe.path.length){const p=W.nav.nodeDir(safe.path[waypoint],new THREE.Vector3());if(commander.dir.angleTo(p)*240>.32){aim=p;break;}waypoint++;}
              const tangent=aim.clone().addScaledVector(commander.dir,-aim.dot(commander.dir)).normalize(),right=new THREE.Vector3().crossVectors(commander.fwd,commander.dir).normalize();
              const turn=Math.atan2(tangent.dot(right),tangent.dot(commander.fwd));
              W.possession.canvas.dispatchEvent(new MouseEvent('mousemove',{buttons:2,movementX:turn/.0032}));
              dispatchEvent(new KeyboardEvent(Math.abs(turn)<.6?'keydown':'keyup',{code:'KeyW'}));
            };
          }
        }else{dispatchEvent(new KeyboardEvent('keydown',{code:'KeyS'}));trace('possess-and-retreat');}
      }
      if(retreating&&commander&&!W.CONFIG.terrain&&Math.acos(Math.min(1,commander.dir.dot(centre)))*240>38){
        dispatchEvent(new KeyboardEvent('keyup',{code:'KeyS'}));
      }
      const draft=run.getDraft();
      if(draft){
        const priorities=['mending','hardened-heart','twin-rails','keen-rails','flywheel','overclock','fifth-volley','deep-crit','sharp-edge','chain-coil','thrift','long-lens','far-sight','cryo-field','compound-interest','bounty','salvage'];
        let best=0,rank=999;draft.offers.forEach((p,i)=>{let r=priorities.indexOf(p.id);if(r<0)r=100;if(r<rank){rank=r;best=i;}});
        trace('draft',{power:draft.offers[best].id});document.querySelectorAll('#draft-cards button')[best].click();
      }
      // The contextual panel follows the commander's crosshair while possessed.
      // Leave possession for remote construction/upgrades, then resume the
      // same body before its next input step. Selecting an offscreen tower
      // while possessed is not a valid way to target its Upgrade button.
      const resumeBody=W.possession.active&&window.__qaTripState==='done'?W.possession.unit:null;
      if(resumeBody)W.possession.exit();
      let changes=0;
      for(let attempt=0;attempt<10;attempt++){
        // Use cards before hoarding upgrades; first secure reliable direct
        // damage, then add aura and garrison support near the convergence.
        const hand=g.hand||[];let built=false;
        const owned=W.towers.towers;
        if(owned.length<window.__qaTowerLimit)for(const key of window.__qaTowerPriority){
          if(key==='cryo'&&owned.some(t=>t.typeKey==='cryo'))continue;
          const i=hand.indexOf(key);if(i>=0&&build(i)){built=true;changes++;break;}
        }
        if(built)continue;
        const eligible=owned.filter(t=>t.tier+1<g.tierCap&&g.gold>=tierCost(t.typeKey,t.tier+1));
        eligible.sort((a,b)=>((b.damageDealt+40)/(tierCost(b.typeKey,b.tier+1)+1))-((a.damageDealt+40)/(tierCost(a.typeKey,a.tier+1)+1)));
        const t=eligible.find(t=>['bolt','tesla','helios','mortar'].includes(t.typeKey))||eligible[0];
        if(t){
          const before=t.tier;g.select(t);document.getElementById('tp-upgrade').click();
          if(t.tier===before){trace('upgrade-rejected',{type:t.typeKey,tier:t.tier});break;}
          trace('upgrade',{type:t.typeKey,tier:t.tier});changes++;continue;
        }
        const cost=run.getHeartCost();
        if(cost!==null&&owned.length>=2&&g.gold>=cost){document.getElementById('heart-panel').click();trace('base',{level:run.getHeartLevel()});changes++;continue;}
        break;
      }
      g.select(null);
      if(resumeBody?.active&&!resumeBody.dead)W.possession.enter(resumeBody);
      return changes;
    };
    if(window.__qaStrategy==='assault'){
      // The policy belongs to this checkout; game imports belong to the
      // tested local server, which can be a collaborator's separate worktree.
      const source=window.__qaAssaultSource.replaceAll("from '../",`from '${new URL('.',location.href).href}`);
      const {installAssaultPolicy}=await import('data:text/javascript,'+encodeURIComponent(source));
      window.__qaAssault=installAssaultPolicy(W,trace);
    }
    __qaPolicy();trace('start');
    if(W.mode99.crystals){
      const a=W.allies.active.find(a=>a.type.commander);
      const cache=[...W.caches.caches].sort((x,y)=>y.dir.dot(a.dir)-x.dir.dot(a.dir))[0];
      if(!cache)throw Error('No reachable opening crystal');
      W.possession.enter(a);
      let stage='outbound';window.__qaTripState=stage;const startTheta=run.getFrontierTheta();
      let routeStage='',route=[],waypoint=0;
      window.__qaTrip=()=>{
        if(stage==='done'||!a.active)return;
        if(stage==='outbound'&&W.mode99.crystals.carried.length){stage='return';window.__qaTripState=stage;trace('crystal-picked-up',{id:cache.id,theta:run.getFrontierTheta()});}
        const destination=stage==='outbound'?cache.dir:centre;
        if(W.CONFIG.terrain&&routeStage!==stage){route=W.nav.findPath(a.dir,destination);waypoint=0;routeStage=stage;trace('expedition-route',{stage,nodes:route.length});}
        const distance=Math.acos(Math.min(1,a.dir.dot(destination)))*240;
        if(stage==='return'&&distance<3.5){
          dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));
          dispatchEvent(new KeyboardEvent('keydown',{code:'KeyC'}));
          trace('crystal-deposited',{ledger:W.mode99.crystals.snapshot(),theta:run.getFrontierTheta()});
          if(run.getFrontierTheta()!==startTheta)throw Error('Travel or deposit expanded the frontier');
          const credit=W.mode99.crystals.credit;
          W.possession.exit();document.getElementById('heart-panel').click();
          trace('crystal-funded-upgrade',{creditBefore:credit,creditAfter:W.mode99.crystals.credit,level:run.getHeartLevel(),theta:run.getFrontierTheta()});
          if(credit===0||W.mode99.crystals.credit>=credit)throw Error('Delivery credit was not spent on expansion');
          stage='done';window.__qaTripState=stage;return;
        }
        let aim=destination;
        if(route.length){
          while(waypoint<route.length){const p=W.nav.nodeDir(route[waypoint],new THREE.Vector3());if(a.dir.angleTo(p)*240>.32){aim=p;break;}waypoint++;}
        }
        const tangent=aim.clone().addScaledVector(a.dir,-aim.dot(a.dir)).normalize();
        const right=new THREE.Vector3().crossVectors(a.fwd,a.dir).normalize();
        const turn=Math.atan2(tangent.dot(right),tangent.dot(a.fwd));
        // Normal right-drag look and W input; no body position assignment.
        W.possession.canvas.dispatchEvent(new MouseEvent('mousemove',{buttons:2,movementX:turn/.0032}));
        dispatchEvent(new KeyboardEvent(Math.abs(turn)<.6?'keydown':'keyup',{code:'KeyW'}));
      };
    }
  });
  let lastWave=0,lastTrip='',result,previousStranded='';
  for(let i=0;i<900;i++){
    result=await page.evaluate(()=>{__qaPolicy();for(let n=0;n<20;n++){window.__qaTrip?.();window.__qaWeaponTrip?.();window.__qaRetreat?.();window.__qaAssault?.update(.1);WH.step(.1,60,!__qaSparseRender);}if(__qaSparseRender)WH.step(0);return {state:WH.game.state,phase:WH.mode99.run.getPhase(),wave:WH.mode99.run.getWave(),lives:WH.game.lives,gold:WH.game.gold,kills:WH.game.kills,score:WH.game.score,towers:WH.towers.towers.length,commander:WH.allies.active.filter(a=>a.type.commander).map(a=>({hp:a.hp,hpMax:a.hpMax,state:a.state,dir:a.dir.toArray()})),seed:WH.CONFIG.seed};});
    if(result.wave!==lastWave){lastWave=result.wave;console.log(JSON.stringify(result));await page.screenshot({path:resolve(out,`wave-${String(lastWave).padStart(2,'0')}.png`)});}
    const trip=await page.evaluate(()=>window.__qaTripState||'');
    if(i>0&&i%50===0){
      const progress=await page.evaluate(()=>({time:WH.enemies.time,trip:window.__qaTripState,live:WH.enemies.active.length,stopped:WH.enemies.active.filter(e=>e.moveV===0).map(e=>({id:e.id,type:e.typeKey,node:e.node,next:e.type.flying?WH.nav.airNext[e.node]:WH.nav.next[e.node],heart:e.node===WH.nav.heartNode,height:e.height,source:e.sourceNest,blocked:!!WH.nav.block[e.node]}))}));
      console.log('PROGRESS '+JSON.stringify(progress));
      const stranded=progress.stopped.filter(e=>e.next<0&&!e.heart).map(e=>e.id+':'+e.node).sort().join(',');
      if(stranded&&stranded===previousStranded){result.termination='stranded-enemy-stall';break;}
      previousStranded=stranded;
    }
    if(trip&&trip!==lastTrip){lastTrip=trip;await page.screenshot({path:resolve(out,`expedition-${trip}.jpg`),type:'jpeg',quality:85});}
    if(expeditionOnly&&trip==='done')break;
    if(result.state==='defeat'||result.phase==='victory')break;
  }
  if(result.state==='defeat'||result.phase==='victory')await page.waitForFunction(()=>getComputedStyle(document.getElementById('end-overlay')).opacity==='1',{},{polling:50});
  await page.screenshot({path:resolve(out,'terminal.png')});
  result.talentPurchases=purchases;
  result.rendering=sparseRender?'60Hz simulation; one rendered frame per two simulation seconds, plus captures':'60Hz simulation; rendered every 0.1 simulation seconds';
  result.trace=await page.evaluate(()=>__qaTrace);result.faults=[...faults];result.policy={strategy,towerPriority,towerLimit,cautious};result.assault=await page.evaluate(()=>window.__qaAssault?.metrics||null);result.towerStats=await page.evaluate(()=>WH.towers.towers.map(t=>({type:t.typeKey,tier:t.tier,damage:t.damageDealt,kills:t.kills})));result.scope=`Unforced instrumented self-play, legal purchases/cards/placements; deterministic time advance; ${sourceCheckpoint?'resumed exported checkpoint':planet===1?'fresh profile':'continued earned campaign profile'}`;
  await Promise.all(responseReads);result.runtimeHashes={...runtimeHashes};result.policySourceHash=assaultSource?createHash('sha256').update(assaultSource).digest('hex'):null;
  result.navigation=await page.evaluate(()=>({heartNode:WH.nav.heartNode,towers:WH.towers.towers.map(t=>({type:t.typeKey,pos:t.pos.toArray()})),nests:WH.world.portals.filter(p=>p.established).map(p=>({node:p.node,destroyed:p.destroyed,next:WH.nav.next[p.node],airNext:WH.nav.airNext[p.node],blocked:!!WH.nav.block[p.node],pos:p.group.position.toArray()})),enemies:WH.enemies.active.filter(e=>e.active&&!e.dead).map(e=>({id:e.id,type:e.typeKey,node:e.node,nearest:WH.nav.nearestNode(e.dir),next:e.type.flying?WH.nav.airNext[e.node]:WH.nav.next[e.node],blocked:!!WH.nav.block[e.node],source:e.sourceNest,dir:e.dir.toArray()}))}));
  if(useWeapons){result.inventory=await page.evaluate(()=>WH.mode99.inventory.snapshot());result.weaponLoop=result.trace.some(a=>a.action==='weapon-picked-up')&&result.trace.some(a=>['weapon-equipped','assault-weapon'].includes(a.action));}
  if(expeditionOnly)result.scope='Unforced instrumented crystal out-and-back; not a full planet';
  writeFileSync(resolve(out,'run.json'),JSON.stringify(result,null,2)+'\n');
  console.log('TERMINAL '+JSON.stringify({...result,trace:result.trace.length,runtimeHashes:Object.keys(result.runtimeHashes).length,inventory:result.inventory?.items.length,navigation:undefined}));
  if((expeditionOnly?lastTrip!=='done':result.phase!=='victory')||faults.length){
    if(campaign)writeFileSync(resolve(rootOut,'checkpoint.json'),await page.evaluate(async()=>(await import('/js/modes/campaign-store.js')).campaignStore.export()));
    process.exitCode=1;break;
  }
  if(campaign){
    const checkpoint=await page.evaluate(()=>WH.mode99.campaign.state());
    const exported=await page.evaluate(async()=>(await import('/js/modes/campaign-store.js')).campaignStore.export());
    writeFileSync(resolve(out,'victory-checkpoint.json'),exported);
    writeFileSync(resolve(rootOut,'checkpoint.json'),exported);
    campaignResults.push({planet,result:{...result,trace:result.trace.length},checkpoint});
    if(planet<checkpoint.limit){
      await Promise.all([page.waitForEvent('load',{timeout:180000}),page.locator('#btn-extract').click()]);
      await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
      const arrived=await page.evaluate(()=>({planet:WH.mode99.campaign.state().planet,inventory:WH.mode99.inventory.snapshot(),terrain:WH.CONFIG.terrainKey}));
      if(arrived.planet!==planet+1||JSON.stringify(arrived.inventory)!==JSON.stringify(checkpoint.assault.victory.inventory))throw Error('Natural extraction did not preserve its inventory');
      writeFileSync(resolve(out,'arrival.json'),JSON.stringify(arrived,null,2)+'\n');
      console.log('ARRIVAL '+JSON.stringify(arrived));
    }else{
      await page.locator('#btn-extract').click();
      const final=await page.evaluate(()=>WH.mode99.campaign.state());
      if(final.status!=='complete')throw Error('Campaign did not reach its real final receipt');
      await page.screenshot({path:resolve(rootOut,'campaign-complete.png')});
    }
    const final=await page.evaluate(()=>WH.mode99.campaign.state());
    writeFileSync(resolve(rootOut,'campaign.json'),JSON.stringify({scope:`Unforced planets ${startPlanet} through ${planet}, linked by normal saved extraction; no wave/resource/enemy injection. A ready checkpoint means remaining planets are unplayed.`,sourceCheckpoint:checkpointPath||null,planets:campaignResults,final,faults},null,2)+'\n');
    writeFileSync(resolve(rootOut,'checkpoint.json'),await page.evaluate(async()=>(await import('/js/modes/campaign-store.js')).campaignStore.export()));
  }
  }
}catch(e){
  console.error(e);await page.screenshot({path:resolve(out,'error.png')});
  const context=await page.evaluate(()=>({pointerLock:document.pointerLockElement?.tagName||null,focused:document.activeElement?.id,paused:WH.game.paused,possession:{active:WH.possession.active,suspended:WH.possession.suspended},phase:WH.mode99.run.getPhase()})).catch(()=>null);
  writeFileSync(resolve(out,'error.json'),JSON.stringify({error:String(e),context,faults},null,2)+'\n');
  if(campaign)writeFileSync(resolve(rootOut,'checkpoint.json'),await page.evaluate(async()=>(await import('/js/modes/campaign-store.js')).campaignStore.export()));
  process.exitCode=1;
}finally{await browser.close();}
