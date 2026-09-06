// Valid but deliberately fabricated progression checkpoints exercise late
// boundaries. These fixtures do not count as completing the preceding planets.
import {createRequire}from'node:module';import{resolve}from'node:path';import{mkdirSync,writeFileSync}from'node:fs';
import{freshSave,startExpedition,beginAssault,resolveAssault,extractPlanet}from'../js/run/campaign.js';
import{generateWeapon,createInventory}from'../js/run/weapons.js';import{makeRng}from'../js/run/rng.js';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/m5-boundaries');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
const expectedEras={1:'ancient',33:'ancient',34:'technological',66:'technological',67:'empowered',98:'empowered',99:'empowered'};
try{for(const index of [1,33,34,66,67,98,99]){
 const save=freshSave(),inventory=createInventory('commander'),starter=generateWeapon({id:'boundary-starter',seed:42,family:'sword',rng:makeRng(42)});inventory.register(starter);inventory.pickup(starter.id);inventory.request({kind:'equip',id:starter.id,slot:0});
 startExpedition(save,{seed:12345,limit:99});
 for(let p=1;p<index;p++){const id=beginAssault(save,{commander:'commander',inventory:inventory.snapshot(),effectiveSeed:p});resolveAssault(save,id,'victory',{inventory:inventory.snapshot(),drops:[],kills:0,score:0,lives:20});extractPlanet(save,id,inventory.snapshot());}
 const page=await browser.newPage({viewport:{width:1280,height:720}}),faults=[];
 page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
 await page.addInitScript(value=>{if(!localStorage.getItem('wh99Campaign'))localStorage.setItem('wh99Campaign',value);const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});},JSON.stringify(save));
 const boot=async()=>{await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});await page.evaluate(()=>{__qaFramesEnabled=false;});};
 await page.goto('http://127.0.0.1:8139/?map=ninetynine&campaign=1',{waitUntil:'domcontentloaded',timeout:180000});await boot();await page.locator('#btn-begin').click();
 const record=await page.evaluate(async(index)=>{
   const W=WH,m=W.mode99,a=W.allies.active.find(a=>a.type.commander),{ENEMY_TYPES}=await import('/js/enemies.js'),{terrainHeight,R}=await import('/js/world.js'),checks=[];
   const check=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
   check('The saved node reaches live config',W.CONFIG.planetIndex===index,{index:W.CONFIG.planetIndex,terrain:W.CONFIG.terrainKey,seed:W.CONFIG.seed,era:W.CONFIG.campaign.era});
   const weaponId=m.inventory.items[0].id,infused=index===1||m.weapons.infuse(weaponId);m.weapons.request({kind:'select',slot:0});
   const item=m.inventory.items.find(x=>x.id===weaponId);check('Infusion preserves identity and reaches the current era model',infused&&item.tier===index&&a.modelKey.includes(item.era),{item,model:a.modelKey});
   const boss=W.enemies.spawn('colossus',W.nav.heartNode,1),bossName=boss.type.name;
   boss.dir.copy(a.dir).addScaledVector(a.fwd,1/R).normalize();boss.height=terrainHeight(boss.dir.x,boss.dir.y,boss.dir.z);boss.alt=0;boss.atkCd=0;boss.scanT=0;
   W.enemies._melee(boss,0);m.threats.update();
   check('The milestone boss uses its authoritative red tell',!!boss.attackPlan&&m.threats.pool.some(g=>g.visible&&g.userData.attack===boss.attackPlan),{name:bossName,arc:boss.attackPlan?.arcDeg,wind:boss.attackPlan?.wind,hp:boss.hpMax});
   check('The global Colossus template stays unchanged',ENEMY_TYPES.colossus.atk===90&&ENEMY_TYPES.colossus.hp===3600&&ENEMY_TYPES.colossus.arcDeg===undefined);
   W.enemies.damage(boss,boss.hpMax*3,{armorPierce:99});const drop=m.inventory.drops[0];
   check('A guaranteed boss drop carries the real planet tier',drop?.tier===index,{tier:drop?.tier,era:drop?.era,family:drop?.family});
   for(const item of m.weapons.nearby())m.weapons.pickup(item.id);
   for(let wave=1;wave<=15;wave++){W.waves.wave=wave;W.waves.onWaveClear(wave,0);if(m.run.getDraft()){m.run.vote('solo',0);m.update(0);}}
   return{index,checks,bossName,era:drop.era,inventory:m.inventory.snapshot(),seed:W.CONFIG.seed,terrain:W.CONFIG.terrainKey};
 },index);
 record.checks.push({name:'Era boundary matches the planned progression',ok:record.era===expectedEras[index]});
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('end-overlay')).opacity==='1'&&getComputedStyle(document.getElementById('title-overlay')).opacity==='0',{},{polling:50});
 await page.screenshot({path:resolve(out,`planet-${index}-receipt.png`)});
 if(index<99){await Promise.all([page.waitForEvent('load',{timeout:180000}),page.locator('#btn-extract').click()]);await boot();record.checks.push({name:'Normal extraction loads the next node with the exact inventory',ok:await page.evaluate(expected=>WH.mode99.campaign.state().planet===expected.index+1&&JSON.stringify(WH.mode99.inventory.snapshot())===JSON.stringify(expected.inventory),record)});}
 else{await page.locator('#btn-extract').click();record.checks.push({name:'Planet 99 ends the campaign without creating planet 100',ok:await page.evaluate(()=>{const e=WH.mode99.campaign.state();return e.status==='complete'&&e.planet===99&&e.receipts.length===99&&document.getElementById('end-mark').textContent==='EXPEDITION COMPLETE';})});await page.screenshot({path:resolve(out,'planet-99-complete.png')});}
 record.faults=faults;record.pass=!faults.length&&record.checks.every(x=>x.ok);results.push(record);writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Fabricated boundary checkpoints and wave-clear fixtures',results},null,2)+'\n');console.log(JSON.stringify({index,pass:record.pass,failed:record.checks.filter(x=>!x.ok),faults}));await page.close();
}}finally{await browser.close();}
if(results.length!==7||results.some(x=>!x.pass))process.exitCode=1;
