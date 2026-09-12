import {createRequire} from 'node:module';import {mkdirSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8139',out=resolve(process.argv[2]||'artifacts/living-worlds/equipment');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],errors=[];
try{for(const [commander,family] of [['duelist','twinblade'],['oracle','scepter']]){
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(180000);
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__frames=true;window.requestAnimationFrame=fn=>raf(t=>{if(__frames)fn(t);});});
 await page.goto(base+'/?map=ninetynine&campaign=0&seed=12345&commander='+commander);await page.waitForFunction(()=>window.WH?.mode99&&document.querySelector('#boot.done'));await page.locator('#btn-begin').click();
 checks.push(...await page.evaluate(async({family})=>{
  __frames=false;const W=WH,m=W.mode99,a=m.commander,w=await import(new URL('js/run/weapons.js',location.href)),world=await import(new URL('js/world.js',location.href)),r=[];const ck=(name,ok,detail)=>r.push({name,ok:!!ok,detail});W.waves.canRaid=()=>false;W.possession.exit();
  for(let i=0;i<5;i++){
   a.swingT=0;a.strikePending=false;a.heat=0;a.heatLock=0;
   const item=w.generateWeapon({id:'equipment-'+i,seed:42,tier:i<3?1:i===3?34:67,family,rng:()=>.1});item.rarity=w.RARITIES[i];item.parts={head:'balanced',grip:'balanced',core:'frost'};
   m.inventory.register(item);m.inventory.pickup(item.id);m.weapons.request({kind:'equip',id:item.id,slot:0});m.weapons.request({kind:'select',slot:0});m.update(0);
   ck(family+' '+w.WEAPON_MATERIALS[i]+' equips a real inventory item',a.weaponMaterial===w.WEAPON_MATERIALS[i]&&a.weaponFamily===family,{model:a.modelKey,family:a.weaponFamily});
   a.possessed=false;const enemy=W.enemies.spawn('husk',W.nav.heartNode,1),point=W.allies.worldPos(a,a.dir.clone()).addScaledVector(a.fwd,1.5);enemy.dir.copy(point).normalize();enemy.height=point.length()-world.R-enemy.type.radius*.9;enemy.alt=0;enemy.swimming=false;enemy.hp=enemy.hpMax=10000;
   W.allies.playerAttack(a,.15);if(family==='twinblade')W.allies.update(a.swingDur*.42);
   ck(family+' '+w.WEAPON_MATERIALS[i]+' damages and applies its fitted core',enemy.hp<10000&&enemy.slowFrac>0,{hp:enemy.hp,slow:enemy.slowFrac});
   W.enemies._release(enemy);a.swingT=0;a.strikePending=false;a.heat=0;a.heatLock=0;a.beamOn=null;
  }
  W.possession.enter(a);W.possession.boom=W.possession.boomWant=0;W.step(.05,60,true);
  ck(family+' held assembly has finite transforms',W.viewModel.current.children.length>0&&W.rig.camera.matrixWorld.elements.every(Number.isFinite));return r;
 },{family}));
 await page.screenshot({path:resolve(out,family+'-onyx-first.png')});await page.keyboard.press('i');await page.waitForTimeout(180);await page.screenshot({path:resolve(out,family+'-inventory.png')});await page.close();
}}catch(e){errors.push(String(e));}finally{writeFileSync(resolve(out,'report.json'),JSON.stringify({scope:'Instrumented real inventory, combat, elemental effects and first-person rendering',checks,errors},null,2));await browser.close();console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok),errors}));if(checks.some(c=>!c.ok)||errors.length)process.exitCode=1;}
