// Earned-coin amounts are fixtures here. Purchases and Apply upgrades use the
// real title UI; natural account spending is recorded by self-play separately.
import{createRequire}from'node:module';import{resolve}from'node:path';import{mkdirSync,writeFileSync}from'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/talent-launch');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{for(const campaign of [false,true]){
 const page=await browser.newPage({viewport:{width:1280,height:720}}),faults=[];
 page.on('pageerror',e=>faults.push(String(e)));
 await page.addInitScript(()=>{if(!localStorage.getItem('wh99Campaign'))localStorage.setItem('wh99Progress',JSON.stringify({version:2,coins:1000,planetsBeaten:0,towers:['bolt'],commanders:['commander'],loadout:'bolt',bonuses:{}}));const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});});
 const boot=async()=>{await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});await page.evaluate(()=>{__qaFramesEnabled=false;});};
 await page.goto(`http://127.0.0.1:8139/?map=ninetynine&seed=12345${campaign?'&campaign=1':''}`,{waitUntil:'domcontentloaded',timeout:180000});await boot();
 const before=await page.evaluate(()=>({gold:WH.game.gold,seed:WH.CONFIG.seed,url:location.href}));
 await page.locator('#btn-talents').click();
 await page.locator('.talent-node').filter({has:page.locator('.tn-name',{hasText:'Cryo Bloom'})}).click();
 await page.locator('.talent-node').filter({has:page.locator('.tn-name',{hasText:'Counting House'})}).click();
 await page.evaluate(()=>{const set=Storage.prototype.setItem;window.__restoreStorage=()=>Storage.prototype.setItem=set;Storage.prototype.setItem=function(key,value){if(key==='wh99Campaign')throw new DOMException('Fixture quota','QuotaExceededError');return set.call(this,key,value);};});
 await page.locator('#btn-talents-close').click();
 const failedSaveHeld=await page.evaluate(()=>document.getElementById('talent-overlay').classList.contains('show')&&WH.game.gold===450);
 await page.evaluate(()=>__restoreStorage());
 await Promise.all([page.waitForEvent('load',{timeout:180000}),page.locator('#btn-talents-close').click()]);await boot();await page.locator('#btn-begin').click();
 const after=await page.evaluate(()=>({gold:WH.game.gold,seed:WH.CONFIG.seed,url:location.href,profile:JSON.parse(localStorage.getItem('wh99Campaign')).account,planet:WH.mode99.campaign?.state().planet}));
 const pass=failedSaveHeld&&before.gold===450&&after.gold===600&&before.seed===after.seed&&before.url===after.url&&after.profile.coins===700&&after.profile.bonuses.interest&&after.profile.towers.includes('cryo')&&(!campaign||after.planet===1)&&!faults.length;
 results.push({campaign,before,after,failedSaveHeld,faults,pass});await page.screenshot({path:resolve(out,`${campaign?'campaign':'sandbox'}-applied.png`)});await page.close();
}}finally{await browser.close();}
writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Title purchase fixtures, including failed-write hold and normal same-planet apply',results},null,2)+'\n');
console.log(JSON.stringify(results.map(({campaign,pass,failedSaveHeld,after})=>({campaign,pass,failedSaveHeld,gold:after.gold}))));if(results.some(x=>!x.pass))process.exitCode=1;
