import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/mobile/transactions'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8139';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(25000);
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__frames=true;window.requestAnimationFrame=fn=>raf(t=>{if(__frames)fn(t);});});
const step=(n=20)=>page.evaluate(n=>WH.step(n/60,60,true),n),tap=async selector=>{await page.locator(selector).tap();await page.waitForTimeout(120);await step();};
const ck=(name,ok,actual)=>{checks.push({name,ok:!!ok,actual});console.log((ok?'PASS ':'FAIL ')+name);};
const snap=name=>page.screenshot({path:resolve(out,name+'.png')});
async function pointAtTower(){return page.evaluate(()=>{const t=WH.towers.towers[0],p=t.pos.clone().addScaledVector(t.pos.clone().normalize(),1.1).project(WH.rig.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});}
async function build(){
 await tap('#touch-build');await tap('#touch-menu .build-card');
 const point=await page.evaluate(()=>{const W=WH,g=W.game;W.rig.cancelFlight();for(let y=132;y<innerHeight-90;y+=12)for(let x=145;x<innerWidth-130;x+=18){g._hover(x,y);if(g.cursorValid&&g._validate(W.TOWER_TYPES[g.buildType]).ok)return{x,y};}return null;});
 if(!point)throw Error('No legal visible placement in fixture');
 await page.touchscreen.tap(point.x,point.y);await page.waitForTimeout(150);await step();
 const before=await page.evaluate(()=>({gold:WH.game.gold,hand:WH.game.hand.length,towers:WH.towers.towers.length}));
 await snap('placement-preview');await tap('#touch-confirm');
 ck('Confirm spends exactly one legal card and creates a tower',await page.evaluate(old=>WH.towers.towers.length===old.towers+1&&WH.game.hand.length===old.hand-1&&WH.game.gold<=old.gold,before));
}
try{
 await page.goto(base+'/?map=ninetynine&campaign=0&seed=12345&planet=temperate&commander=marksman',{waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.WH?.mobile&&document.querySelector('#boot.done'),null,{timeout:180000});
 await page.locator('#btn-begin').tap();await page.waitForTimeout(1800);await page.evaluate(()=>{__frames=false;WH.waves.update=()=>{};WH.waves.canRaid=()=>false;WH.game.gold=10000;});await step();
 await build();const point=await pointAtTower();await page.touchscreen.tap(point.x,point.y);await page.waitForTimeout(150);await step();
 ck('Tapping a real tower opens its management sheet',await page.evaluate(()=>WH.game.context.editing&&WH.game.context.target?.kind==='tower'));
 await snap('landscape-tower');const old=await page.evaluate(()=>({tier:WH.towers.towers[0].tier,gold:WH.game.gold}));await tap('#tp-upgrade');ck('Touch upgrade advances tier and charges gold',await page.evaluate(old=>WH.towers.towers[0].tier===old.tier+1&&WH.game.gold<old.gold,old));await tap('#tp-close');
 await tap('#touch-menu-open');await tap('#touch-tab-base');const level=await page.evaluate(()=>WH.mode99.run.getHeartLevel());await tap('#heart-panel');ck('Base upgrade works from the field menu',await page.evaluate(level=>WH.mode99.run.getHeartLevel()===level+1,level));
 await page.evaluate(async()=>{
   const W=WH,T=await import(new URL('lib/three.module.min.js',location.href)),world=await import(new URL('js/world.js',location.href)),t=W.towers.towers[0],a=W.mode99.commander;
   // Arrange a nearby, unobstructed first-person approach. Subsequent targeting
   // is the production crosshair ray, not a forced context-panel selection.
   const d=t.pos.clone().normalize(),side=new T.Vector3().crossVectors(d,new T.Vector3(0,1,0)).normalize();a.dir.copy(d).addScaledVector(side,7/world.R).normalize();a.height=world.terrainHeight(...a.dir.toArray());a.fwd.copy(d).addScaledVector(a.dir,-d.dot(a.dir)).normalize();a.hop=0;a.airT=0;a.vertVel=0;W.possession.enter(a);W.possession.boom=W.possession.boomWant=0;W.step(.1,60,true);
   const look=t.pos.clone().addScaledVector(d,1.1).sub(W.rig.camera.position).normalize();W.possession.pitch=Math.asin(look.dot(a.dir));W.step(.1,60,true);
 });await step();ck('First-person crosshair discovers a nearby tower',await page.evaluate(()=>WH.game.context.target?.kind==='tower'&&!WH.game.context.editing));
 await tap('#touch-interact');ck('Interact suspends movement for real tower buttons',await page.evaluate(()=>WH.possession.suspended&&WH.game.context.editing));await tap('#tp-upgrade');ck('First-person upgrade resumes touch looking immediately',await page.evaluate(()=>!WH.possession.suspended&&!WH.game.context.editing&&!document.pointerLockElement));
 await tap('#touch-commander');await step(50);
 await page.evaluate(async()=>{const m=WH.mode99,{generateWeapon}=await import(new URL('js/run/weapons.js',location.href));for(let i=0;i<9;i++){m.inventory.register(generateWeapon({id:'touch-scrap-'+i,seed:i,tier:1,family:'carbine',rng:()=>.1}));m.inventory.pickup('touch-scrap-'+i);}});
 await tap('#touch-menu-open');await tap('#touch-weapons');
 const item=await page.evaluate(()=>WH.mode99.inventory.items.find(x=>x.id.startsWith('touch-scrap-')).id);
 await tap(`#weapon-dialog [data-action="equip"][data-id="${item}"][data-slot="0"]`);
 ck('Touch can equip a carried weapon',await page.evaluate(id=>WH.mode99.inventory.slots[0]===id,item));
 await tap(`#weapon-dialog [data-action="select"][data-slot="0"]`);
 await tap(`#weapon-dialog details[data-item="${item}"] summary`);
 const part=page.locator(`#weapon-dialog [data-id="${item}"][data-part="core"]`),value=await part.locator('option').last().getAttribute('value');await part.selectOption(value);await step();
 ck('Part customization changes the actual item',await page.evaluate(({id,value})=>WH.mode99.inventory.items.find(i=>i.id===id).parts.core===value,{id:item,value}));
 await tap('#weapon-dialog [data-action="unequip"][data-slot="0"]');
 for(let i=0;i<9;i++)await tap(`#weapon-dialog [data-action="salvage"][data-id="touch-scrap-${i}"]`);
 ck('Touch salvage creates spendable scraps',await page.evaluate(()=>WH.mode99.inventory.scrap>=9));await snap('salvaged-inventory');await tap('#weapon-dialog [data-action="close"]');
 await page.evaluate(async()=>{const W=WH,a=W.mode99.commander,{terrainHeight}=await import(new URL('js/world.js',location.href));a.dir.copy(W.game.frontier.centre);a.fwd.addScaledVector(a.dir,-a.fwd.dot(a.dir)).normalize();a.height=terrainHeight(...a.dir.toArray());a.hop=0;a.airT=0;W.mode99.crystals.register('touch-crystal');W.mode99.crystals.pickup('touch-crystal');W.step(.2,60,true);});
 await tap('#touch-menu-open');await tap('#touch-tab-base');await tap('#btn-deposit');ck('Crystal deposit uses the real cargo transaction',await page.evaluate(()=>WH.mode99.crystals.carried.length===0&&WH.ui.el['crystal-readout'].textContent.includes('100')));
 await tap('#touch-menu-open');await tap('#touch-tab-base');if(await page.locator('#expedition-tools').getAttribute('open')===null)await tap('#expedition-tools summary');const cost=await page.evaluate(()=>WH.mode99.forge.cost);await tap('#craft-tower');
 ck('Forge creates a card and raises its next price',await page.evaluate(cost=>WH.mode99.forge.cost===cost+2&&WH.game.hand.length>0,cost));
 await build();
 await page.evaluate(()=>{WH.possession.exit();WH.rig.cancelFlight();WH.rig.flyTo(WH.world.heart.group.position,WH.rig.defaultDist,.01);WH.step(.5,60,true);});
 const sellPoint=await pointAtTower();await page.touchscreen.tap(sellPoint.x,sellPoint.y);await page.waitForTimeout(150);await step();const saleBefore=await page.evaluate(()=>({count:WH.towers.towers.length,target:WH.game.contextTower?.id,editing:WH.game.context.editing,valid:WH.game.context.validTower(WH.game.contextTower),gold:WH.game.gold}));await snap('before-sale');await page.evaluate(()=>{window.__saleEvents=[];for(const type of ['pointerdown','pointermove','pointerup','click'])document.addEventListener(type,e=>__saleEvents.push({type,target:e.target.id,trusted:e.isTrusted,pointer:e.pointerType,x:e.clientX,y:e.clientY,hit:document.elementFromPoint(e.clientX,e.clientY)?.id}),true);});await tap('#tp-sell');const saleAfter=await page.evaluate(()=>({count:WH.towers.towers.length,target:WH.game.contextTower?.id,editing:WH.game.context.editing,gold:WH.game.gold}));ck('Touch sale removes the selected tower',saleAfter.count===saleBefore.count-1,{before:saleBefore,after:saleAfter,events:await page.evaluate(()=>__saleEvents)});
 // Clipped scrolling panels still need all of their controls to accept input.
 const metrics=await page.evaluate(()=>{const sheets=[...document.querySelectorAll('link[rel="stylesheet"]')].map(l=>l.href);return {sheets,bodyWidth:document.body.scrollWidth,viewport:innerWidth};});ck('No horizontal page overflow after nested transactions',metrics.bodyWidth<=metrics.viewport,metrics);
 ck('No runtime errors',errors.length===0,errors);
}catch(e){errors.push(String(e));await snap('failure').catch(()=>{});}finally{writeFileSync(resolve(out,'report.json'),JSON.stringify({scope:'Real touch transactions with seeded item, resource and approach fixtures. Waves held to isolate controls; no balance claim.',checks,errors},null,2));await browser.close();}console.log(JSON.stringify({passed:checks.filter(x=>x.ok).length,total:checks.length,failed:checks.filter(x=>!x.ok),errors}));if(errors.length||checks.some(x=>!x.ok))process.exitCode=1;
