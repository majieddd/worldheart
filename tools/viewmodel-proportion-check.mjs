// Fixed first-person poses isolate equipment length from commander anatomy.
import {createRequire} from 'node:module';import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/viewmodel-proportions');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),checks=[],faults=[];
try{
 page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 await page.goto(`${process.env.WH_BASE_URL||'http://127.0.0.1:8139'}/?map=ninetynine&seed=12345`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
 await page.evaluate(()=>{__qaFramesEnabled=false;document.getElementById('btn-begin').click();WH.game.paused=true;});
 for(const family of ['sword','spear','carbine','lobber']){
  const record=await page.evaluate(async family=>{
   const W=WH,{generateWeapon,weaponStats,FAMILIES}=await import(new URL('js/run/weapons.js',location.href)),{makeRng}=await import(new URL('js/run/rng.js',location.href));
   W.possession.exit();let unit=W.allies.active.find(a=>a.typeKey===(family==='carbine'?'marksman':'commander'));
   if(!unit)unit=W.allies.spawn('marksman',W.nav.fieldCenter,W.nav.fieldCenter,8);
   unit.swingT=0;unit.strikePending=false;const frames=[];
   for(const [length,era] of [[1,null],[1.2,'empowered'],[1,'technological'],[1,null]]){
    const item=generateWeapon({id:'proportion',seed:42,tier:length===1.2?67:1,family,rng:makeRng(42)});item.parts={head:length===1.2?'long':'balanced',grip:'balanced',core:'frost'};
    W.allies.setWeapon(unit,weaponStats(item,unit.typeKey),FAMILIES[family].visual,FAMILIES[family].view,0xffffff,length,era?{era,core:item.parts.core}:null);
    W.possession.enter(unit);W.viewModel.update(0,W.rig.camera,unit,{bob:false});W.viewModel.current.updateMatrixWorld(true);
    const arms=[];W.viewModel.current.traverse(o=>{if(o.name==='holding-arm')arms.push({volume:o.matrixWorld.determinant(),materials:o.children.filter(x=>x.isMesh).map(x=>x.material.color.getHexString())});});
    frames.push({length,era,arms,weaponScale:W.viewModel.current.userData.weaponGroup?.scale.z});
   }
   return {family,frames};
  },family);
  const [base,long,tech,restored]=record.frames;
  checks.push({name:`${family}: long equipment preserves the holding arm size`,ok:base.arms.length>0&&long.arms.length===base.arms.length&&base.arms.every((a,i)=>Math.abs(a.volume-long.arms[i].volume)<1e-10),actual:record});
  checks.push({name:`${family}: weapon era does not recolor commander gauntlets`,ok:[long,tech].every(frame=>JSON.stringify(base.arms.map(x=>x.materials))===JSON.stringify(frame.arms.map(x=>x.materials)))});
  checks.push({name:`${family}: switching back restores the original proportions`,ok:base.arms.every((a,i)=>Math.abs(a.volume-restored.arms[i].volume)<1e-10)});
  await page.evaluate(()=>WH.step(0));await page.screenshot({path:resolve(out,`${family}-restored.png`)});
 }
}catch(error){faults.push(String(error));}
finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Fixed equipment/pose fixtures, not natural combat',checks,faults},null,2)+'\n');console.log(JSON.stringify({passed:checks.filter(x=>x.ok).length,total:checks.length,failed:checks.filter(x=>!x.ok).map(x=>x.name),faults}));await browser.close();}
if(faults.length||checks.some(x=>!x.ok))process.exitCode=1;
