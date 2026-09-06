// Transition and persistence fixtures. Wave completions are injected here;
// tools/self-play.mjs provides unforced combat evidence separately.
import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/m5-campaign');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),faults=[],checks=[];
page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});});
const boot=async()=>{await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});await page.evaluate(()=>{__qaFramesEnabled=false;});};
const endVisible=()=>page.waitForFunction(()=>getComputedStyle(document.getElementById('end-overlay')).opacity==='1'&&getComputedStyle(document.getElementById('title-overlay')).opacity==='0',{},{polling:50});
const check=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
const state=()=>page.evaluate(()=>({campaign:WH.mode99.campaign.state(),seed:WH.CONFIG.seed,terrain:WH.CONFIG.terrainKey,inventory:WH.mode99.inventory.snapshot(),phase:WH.mode99.run.getPhase()}));
const finish=()=>page.evaluate(()=>{for(let wave=1;wave<=15;wave++){WH.waves.wave=wave;WH.waves.onWaveClear(wave,0);const draft=WH.mode99.run.getDraft();if(draft){WH.mode99.run.vote('solo',0);WH.mode99.update(0);}}});
try{
 await page.goto('http://127.0.0.1:8139/?map=ninetynine&seed=12345&campaign=1',{waitUntil:'domcontentloaded',timeout:120000});await boot();
 let first=await state();check('Fresh saved expedition starts on planet one',first.campaign.planet===1&&first.campaign.status==='ready',first.campaign);
 check('Begin is visible in the first 720p viewport',await page.locator('#btn-begin').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight));
 await page.screenshot({path:resolve(out,'title-720.png')});
 await page.locator('#btn-begin').click();
 await page.evaluate(async()=>{const {generateWeapon}=await import('/js/run/weapons.js'),{makeRng}=await import('/js/run/rng.js'),m=WH.mode99,item=generateWeapon({id:'refresh-lost-fixture',seed:7,rng:makeRng(7)});m.inventory.register(item);m.inventory.pickup(item.id);WH.waves.wave=1;WH.waves.onWaveClear(1,0);});
 const beforeRefresh=await page.evaluate(()=>({id:WH.mode99.campaign.state().assault.id,coins:JSON.parse(localStorage.getItem('wh99Campaign')).account.coins}));
 await page.reload({waitUntil:'domcontentloaded',timeout:120000});await boot();await page.locator('#btn-begin').click();
 check('Mid-assault reload restores the checkpoint and keeps its reward identity',await page.evaluate(expected=>{const e=WH.mode99.campaign.state();return e.assault.id===expected.id&&WH.mode99.run.getWave()===1&&!WH.mode99.inventory.items.some(x=>x.id==='refresh-lost-fixture')&&JSON.parse(localStorage.getItem('wh99Campaign')).account.coins===expected.coins;},beforeRefresh));
 await page.evaluate(()=>{const W=WH,boss=W.enemies.spawn('colossus',W.nav.heartNode,1);W.enemies.damage(boss,boss.hpMax*3,{armorPierce:99});for(const item of W.mode99.weapons.nearby())W.mode99.weapons.pickup(item.id);});
 const collected=await state();check('A boss weapon reaches the assault inventory',collected.inventory.items.length>first.inventory.items.length);
 await finish();first=await state();check('Victory creates saved salvage without advancing the planet',first.campaign.status==='victory'&&first.campaign.planet===1&&first.campaign.completed===0);
 await endVisible();await page.screenshot({path:resolve(out,'victory-720.png')});
 const coins=await page.evaluate(()=>JSON.parse(localStorage.getItem('wh99Campaign')).account.coins);
 await page.reload({waitUntil:'domcontentloaded',timeout:120000});await boot();await page.locator('#btn-begin').click();
 const restored=await state();check('Victory reload restores collected weapons and the terminal core',restored.phase==='victory'&&JSON.stringify(restored.inventory)===JSON.stringify(collected.inventory));
 check('Victory reload pays no duplicate wave coins',await page.evaluate(()=>JSON.parse(localStorage.getItem('wh99Campaign')).account.coins)===coins);
 await page.evaluate(()=>{const original=Storage.prototype.setItem;let writes=0;Storage.prototype.setItem=function(key,value){if(key==='wh99Campaign'&&++writes===2)throw new DOMException('Fixture quota','QuotaExceededError');return original.call(this,key,value);};});
 await page.locator('#btn-extract').click();
 check('A failed transition write keeps the field open and offers exact retry',await page.evaluate(()=>WH.mode99.campaign.state().status==='ready'&&document.getElementById('btn-extract').disabled&&document.getElementById('campaign-save').textContent.includes('Save failed')));
 await endVisible();await page.screenshot({path:resolve(out,'save-failure-720.png')});
 await page.locator('[data-save="retry"]').click();
 await Promise.all([page.waitForURL(url=>!url.searchParams.has('seed'),{timeout:180000}),page.locator('#btn-extract').click()]);await boot();
 const second=await state();check('Extraction loads a real second terrain with the banked inventory',second.campaign.planet===2&&second.terrain==='canyon'&&JSON.stringify(second.inventory)===JSON.stringify(collected.inventory),{planet:second.campaign.planet,terrain:second.terrain,seed:second.seed,items:second.inventory.items.length});
 await page.locator('#btn-begin').click();
 await page.evaluate(async()=>{const {generateWeapon}=await import('/js/run/weapons.js'),{makeRng}=await import('/js/run/rng.js'),m=WH.mode99,item=generateWeapon({id:'unbanked-fixture',seed:7,rng:makeRng(7)});m.inventory.register(item);m.inventory.pickup(item.id);m.run.getPhase();WH.game.state='defeat';WH.game.onGameEnd(false);});
 check('Defeat retains prior extraction and excludes temporary loot',await page.evaluate(()=>{const e=WH.mode99.campaign.state();return e.status==='defeat'&&!e.banked.items.some(x=>x.id==='unbanked-fixture');}));
 await endVisible();await page.screenshot({path:resolve(out,'defeat-720.png')});
 await Promise.all([page.waitForEvent('load',{timeout:180000}),page.locator('#btn-retry').click()]);await boot();await page.locator('#btn-begin').click();
 check('Retry starts the same planet with previously banked items',await page.evaluate(()=>WH.mode99.campaign.state().planet===2&&!WH.mode99.inventory.items.some(x=>x.id==='unbanked-fixture')));
 await finish();
 while((await state()).campaign.planet<3){
   await Promise.all([page.waitForEvent('load',{timeout:180000}),page.locator('#btn-extract').click()]);await boot();await page.locator('#btn-begin').click();
   const pilot=await page.evaluate(async()=>{
     const {generateWeapon,eraForPlanet}=await import('/js/run/weapons.js'),{makeRng}=await import('/js/run/rng.js'),m=WH.mode99,a=WH.allies.active.find(a=>a.type.commander),records=[];
     for(const tier of [1,34,67]){const item=generateWeapon({id:`era-fixture-${tier}`,seed:42,tier,family:'sword',rng:makeRng(42)});m.inventory.register(item);m.inventory.pickup(item.id);m.weapons.request({kind:'equip',id:item.id,slot:0});records.push({tier,era:item.era,model:a.modelKey,damage:a.type.strike.dmg,ok:item.era===eraForPlanet(tier)&&a.modelKey.includes(item.era)&&Number.isFinite(a.type.strike.dmg)});}
     return{terrain:WH.CONFIG.terrainKey,records};
   });
   check('The third terrain pilot equips all three era fixtures through live combat stats',pilot.terrain==='alpine'&&pilot.records.every(x=>x.ok)&&pilot.records[0].damage<pilot.records[1].damage&&pilot.records[1].damage<pilot.records[2].damage,pilot);
   await finish();
 }
 // The first three transitions above run in the live shell. Advance a valid
 // checkpoint with pure fixtures to exercise the final receipt without
 // pretending that 96 intervening planets were naturally played.
 await page.evaluate(async()=>{
   const {campaignStore}=await import('/js/modes/campaign-store.js');
   const {beginAssault,resolveAssault,extractPlanet}=await import('/js/run/campaign.js');
   campaignStore.commit(s=>{const e=s.expedition,inventory=e.assault.victory.inventory;extractPlanet(s,e.assault.id,inventory);while(e.planet<e.limit){const id=beginAssault(s,{commander:e.commander,inventory,effectiveSeed:1});resolveAssault(s,id,'victory',{inventory,drops:[],kills:0,score:0,lives:24});extractPlanet(s,id,inventory);}return true;});
 });
 await page.reload({waitUntil:'domcontentloaded',timeout:180000});await boot();await page.locator('#btn-begin').click();await finish();
 await page.locator('#btn-extract').click();
 check('The final checkpoint fixture ends distinctly after planet 99',await page.evaluate(()=>WH.mode99.campaign.state().status==='complete'&&WH.mode99.campaign.state().planet===99&&document.getElementById('end-mark').textContent==='EXPEDITION COMPLETE'));
 await endVisible();await page.screenshot({path:resolve(out,'complete-720.png')});
 await page.setViewportSize({width:1920,height:1080});await page.screenshot({path:resolve(out,'complete-1080.png')});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(out,'complete-390.png')});
 check('Final receipt has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-save="export"]').click()]);
 const exported=readFileSync(await download.path(),'utf8');check('Export downloads the completed checkpoint',JSON.parse(exported).checkpoint.expedition.status==='complete');
 await page.evaluate(()=>localStorage.setItem('wh99Campaign','corrupt-checkpoint-fixture'));
 await page.reload({waitUntil:'domcontentloaded',timeout:120000});await boot();
 check('A corrupt checkpoint remains intact and exposes recovery controls',await page.evaluate(()=>localStorage.getItem('wh99Campaign')==='corrupt-checkpoint-fixture'&&document.querySelector('[data-save="retry"]').textContent==='Recover with this session'));
 const imported=resolve(out,'exported-checkpoint.json');writeFileSync(imported,exported);
 await Promise.all([page.waitForEvent('load',{timeout:180000}),page.locator('#campaign-save input[type="file"]').setInputFiles(imported)]);await boot();
 check('Import validates and restores the exported expedition',await page.evaluate(()=>WH.mode99.campaign.state().status==='complete'));
 await page.locator('#btn-begin').click();await endVisible();
 await page.locator('.campaign-arsenal summary').click();check('The final receipt exposes its banked arsenal',await page.locator('.campaign-arsenal li').count()>0);
 const beforeNew=await page.evaluate(()=>({id:WH.mode99.campaign.state().id,coins:JSON.parse(localStorage.getItem('wh99Campaign')).account.coins}));
 await page.locator('#btn-new').click();await page.keyboard.press('Escape');
 check('Canceling a new expedition preserves the completed checkpoint',(await state()).campaign.id===beforeNew.id&&(await state()).campaign.status==='complete');
 await page.locator('#btn-new').click();await Promise.all([page.waitForEvent('load',{timeout:180000}),page.locator('[data-reset="start"]').click()]);await boot();
 check('An explicitly confirmed new expedition keeps account coins and resets the route',await page.evaluate(expected=>{const e=WH.mode99.campaign.state();return e.planet===1&&e.status==='ready'&&e.id!==expected.id&&e.banked===null&&JSON.parse(localStorage.getItem('wh99Campaign')).account.coins===expected.coins;},beforeNew));
 writeFileSync(resolve(out,'campaign-results.json'),JSON.stringify({scope:'Injected wave-clear and persistence fixtures, not natural campaign completion',checks,faults},null,2)+'\n');
 console.log(JSON.stringify({checks:checks.length,failed:checks.filter(x=>!x.ok),faults}));if(faults.length||checks.some(x=>!x.ok))process.exitCode=1;
}catch(error){console.error(error);await page.screenshot({path:resolve(out,'error.png')});writeFileSync(resolve(out,'partial.json'),JSON.stringify({checks,faults,error:String(error)},null,2));process.exitCode=1;}finally{await browser.close();}
