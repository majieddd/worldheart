// Fixed-state production mechanic callbacks, not a natural campaign run.
import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=process.env.WH_BASE_URL||'http://127.0.0.1:8140',out=resolve(process.argv[2]||'artifacts/audio-revamp/mechanics');mkdirSync(out,{recursive:true});
const report={scope:'Fixed-state fixtures exercise actual attack and ability methods and observe emitted audio. Not a natural run.',checks:[],faults:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true});const page=await context.newPage();page.on('pageerror',e=>report.faults.push(String(e)));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__frames=true;window.requestAnimationFrame=fn=>raf(t=>{if(__frames)fn(t);});});
 await page.goto(base+'/?map=ninetynine&campaign=0&seed=12345&planet=temperate');await page.waitForFunction(()=>window.WH?.mode99&&document.querySelector('#boot.done'),null,{timeout:180000});
 await page.locator('#btn-begin').tap();await page.waitForFunction(()=>WH.audio.stats.bank==='ready');await page.evaluate(()=>{__frames=false;WH.waves.update=()=>{};WH.game.paused=false;});
 report.checks=await page.evaluate(async()=>{
  const W=WH,checks=[],a=W.mode99.commander,A=W.audio;W.possession.enter(a);A.observer=W.allies.worldPos(a,a.dir.clone());A.setScene({state:'none',ambience:'none'});A._stopVoices();
  const {FAMILIES,generateWeapon,weaponStats}=await import('./js/run/weapons.js'),{makeRng}=await import('./js/run/rng.js'),{CommanderAbilities}=await import('./js/abilities.js');
  const check=(name,ok,actual)=>checks.push({name,ok:!!ok,actual}),count=k=>A.cueCounts[k]||0,pause=()=>new Promise(r=>setTimeout(r,220));
  let beamUnit=null;
  for(const [family,cue]of Object.entries({sword:'swing',spear:'spear',twinblade:'twinblade',carbine:'rifle',lobber:'lob',scepter:'fire'})){
   const type=family==='carbine'?'marksman':family==='scepter'?'oracle':'commander',unit=W.allies.spawn(type,a.dir,a.dir,8);unit.possessed=true;
   const item=generateWeapon({id:'audio-fixture-'+family,family,seed:42,rng:makeRng(42)}),spec=weaponStats(item,type);
   if(!spec)throw Error('Incompatible test loadout: '+family);
   W.allies.setWeapon(unit,spec,FAMILIES[family].visual,FAMILIES[family].view);await pause();const before=count(cue);
   W.allies.playerAttack(unit,.08);if(spec.kind!=='beam')W.allies.update(spec.cd*.8);
   check(family+' emits one timed attack cue',count(cue)===before+1,{before,after:count(cue)});
   unit.swingT=0;unit.strikePending=false;const ability=new CommanderAbilities({game:W.game,allies:W.allies,enemies:W.enemies,commander:()=>unit,ui:W.ui});
   await pause();const old=count('weaponPower'),activated=ability.activate('weapon');check(family+' special has feedback',activated&&count('weaponPower')===old+1);
   if(family==='scepter')beamUnit=unit;else unit.active=false;
  }
  await pause();beamUnit.heatLock=1;const heat=count('fire');W.allies.playerAttack(beamUnit,.08);check('Overheated scepter cannot emit false firing feedback',beamUnit.active&&count('fire')===heat);beamUnit.active=false;
  for(const [key,cue]of Object.entries({commander:'guard',duelist:'haste',marksman:'deadeye',bombardier:'barrage',oracle:'renew'})){
   const unit=W.allies.spawn(key,a.dir,a.dir,8),ability=new CommanderAbilities({game:W.game,allies:W.allies,enemies:W.enemies,commander:()=>unit,ui:W.ui});
   await pause();const before=count(cue);check(key+' ability has its own cue',ability.activate('commander')&&count(cue)===before+1);unit.active=false;
  }
  await pause();const mount=W.mode99.mounts;const before=count('mount');a.mountKey='none';a.mountFlight=0;check('Mounting emits feedback',mount.toggle()&&count('mount')===before+1);
  const dismount=count('dismount');check('Dismounting emits feedback',mount.toggle()&&count('dismount')===dismount+1);
  check('Mechanics emit no unknown cues or audio errors',Object.keys(A.unknownCues).length===0&&A.stats.errors.length===0,A.snapshot());return checks;
 });
 for(const c of report.checks)console.log((c.ok?'PASS ':'FAIL ')+c.name);await context.close();
}catch(e){report.faults.push(String(e));console.error(e);}finally{writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
if(report.faults.length||report.checks.some(c=>!c.ok))process.exitCode=1;
