// Reproducible browser fixtures on an isolated profile. Natural playthroughs
// are separate: this runner deliberately manipulates state to probe contracts.
// Set WH_NODE_MODULES to an existing directory containing Playwright, or make
// Playwright available normally. No package install or production data needed.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(process.env.WH_NODE_MODULES
  ? resolve(process.env.WH_NODE_MODULES,'package.json') : import.meta.url);
const { chromium } = require('playwright');
const url=process.argv[2] || 'http://127.0.0.1:8139/?map=ninetynine&seed=12345';
const out=resolve(process.argv[3] || 'artifacts/m0');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.WH_BROWSER || 'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const faults=[];page.on('pageerror',e=>faults.push(String(e)));
page.on('console',m=>{if(m.type()==='error')faults.push(m.text()+' at '+m.location().url);});
page.on('response',r=>{if(r.status()>=400)faults.push(`HTTP ${r.status()}: ${r.url()}`);});
await page.addInitScript(()=>{
  localStorage.setItem('wh99Progress',JSON.stringify({version:2,coins:0,planetsBeaten:0,towers:['bolt'],commanders:['commander'],loadout:'bolt',bonuses:{interest:true,veteran:true,quartermaster:true,scout:true}}));
  const raf=window.requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;
  window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});
});
try{
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.WH?.mode99 && document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
  await page.evaluate(()=>{window.__qaFramesEnabled=false;WH.game.paused=true;});
  await page.screenshot({path:resolve(out,'opening.png')});
  const result=await page.evaluate(async()=>{
    const checks=[];const check=(name,ok,actual)=>{checks.push({name,ok,actual});if(!ok)throw Error(name+': '+JSON.stringify(actual));};
    const {POWER_BY_ID}=await import('/js/run/powers.js');
    const {MODS,Tower}=await import('/js/towers.js');
    const run=WH.mode99.run,game=WH.game;
    check('Counting House pays live gold',game.gold===600,game.gold);
    check('Veterancy pays commander health',WH.allies.active[0].hpMax===1680,WH.allies.active[0].hpMax);
    check('Scout starts wider',run.getFrontierSteps()===1,run.getFrontierSteps());
    for(let i=0;i<12;i++)game.onCardSpent(-1);
    check('Commander bonus does not accumulate on refresh',Math.abs(MODS.current.dmgMul-1.15)<1e-9,MODS.current.dmgMul);
    check('Core modifiers stay independent of commander presence',run.getModifiers().dmgMul===1,run.getModifiers().dmgMul);
    check('Current and next caps are labelled',document.getElementById('heart-buys').textContent.includes('Current MK II. Next: MK III'),document.getElementById('heart-buys').textContent);
    document.getElementById('btn-begin').click();game.paused=true;
    // Complete two wave events only in this fixture, then click the actual
    // card. This is evidence for the bridge/UI, never a played wave claim.
    WH.waves.onWaveClear(1,0);WH.waves.onWaveClear(2,0);
    const draft=run.getDraft();draft.offers[0]=POWER_BY_ID['hardened-heart'];
    // Existing DOM card retains the same index, so the click follows the
    // shipped callback and resolution path, including while paused.
    document.querySelector('#draft-cards button').click();
    check('Paused pick resolves immediately',run.getPhase()==='building' && game.paused,run.getPhase());
    check('Hardened Heart reaches live health and capacity',game.lives===22&&game.maxLives===22,{lives:game.lives,max:game.maxLives});
    check('Draft overlay dismisses',!document.getElementById('draft-overlay').classList.contains('show'));
    for(let i=0;i<8;i++)game.onCardSpent(-1);
    check('Health reward cannot be collected repeatedly by refreshing',game.lives===22,game.lives);
    WH.waves.onWaveClear(3,0);WH.waves.onWaveClear(4,0);
    run.getDraft().offers[0]=POWER_BY_ID.mending;document.querySelector('#draft-cards button').click();
    game.lives=10;WH.waves.onWaveClear(5,0);
    check('Mending pays on real shell wave callback',game.lives===11,game.lives);
    WH.waves.onWaveClear(6,0);
    check('Solo reward remains untimed',run.getDraft().remaining===null,run.getDraft().remaining);
    run.tick(5000);check('Solo reward survives arbitrarily long waiting',run.getPhase()==='drafting');
    const h=Object.assign(Object.create(Tower.prototype),{typeKey:'helios',tier:0});
    check('Live Helios receives the commander damage bonus',Math.abs(h.stats.dps-26*1.15)<1e-9,h.stats.dps);
    return {scope:'Instrumented shell/UI fixtures, not natural play',seed:WH.CONFIG.seed,checks};
  });
  await page.screenshot({path:resolve(out,'reward-fixture.png')});
  result.faults=faults;result.pass=result.checks.every(c=>c.ok)&&faults.length===0;
  writeFileSync(resolve(out,'browser-results.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;
}catch(e){await page.screenshot({path:resolve(out,'failure.png')});writeFileSync(resolve(out,'failure.json'),JSON.stringify({error:String(e),faults},null,2));console.error(e);process.exitCode=1;}
finally{await browser.close();}
