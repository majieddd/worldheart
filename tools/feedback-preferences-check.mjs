// Browser controls and cosmetic invariants for independent feedback settings.
import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/feedback-preferences');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],faults=[];
const url=`${process.env.WH_BASE_URL||'http://127.0.0.1:8139'}/?map=ninetynine&campaign=0&seed=12345`;
const controls=[['set-flashes','flashes'],['set-trails','trails'],['set-numbers','numbers'],['set-grain','grain']];
async function boot(page){await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});}
async function snapshot(page){return page.evaluate(async()=>({...((await import(new URL('js/config.js',location.href))).PRESENTATION)}));}
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
 await boot(page);await page.locator('#btn-begin').click();await page.locator('#btn-pause').click();await page.locator('#btn-settings').click();
 let available=true;
 for(const [id] of controls){const exists=await page.locator('#'+id).count()===1;checks.push({name:`${id}: independently available`,ok:exists});available&&=exists;}
 if(available){
  for(const [id,key] of controls){
   const before=await snapshot(page);await page.locator('#'+id).focus();await page.keyboard.press('Enter');const after=await snapshot(page);
   checks.push({name:`${key}: keyboard toggle changes only its preference`,ok:after[key]===!before[key]&&Object.keys(before).filter(k=>k!==key).every(k=>before[k]===after[k])&&await page.locator('#'+id).getAttribute('aria-pressed')===String(after[key]),actual:{before,after}});
  }
  const effects=await page.evaluate(async()=>{
   const W=WH,THREE=await import(new URL('lib/three.module.min.js',location.href)),{terrainHeight,R}=await import(new URL('js/world.js',location.href));
   const a=W.allies.active.find(x=>x.type.commander),point=W.allies.worldPos(a,new THREE.Vector3());
   W.fx.floaters.spawn(point,'123');W.fx.floaters.spawn(point,'BLOCKED');W.fx.floaters.update(0);
   const texts=W.fx.floaters.items.filter(x=>x.life>0).map(x=>x.el.textContent);
   for(const trail of [W.viewModel.trail,W.possession.tpTrail]){trail.push(point,point.clone().addScaledVector(a.dir,1));trail.push(point.clone().addScaledVector(a.fwd,.1),point.clone().addScaledVector(a.dir,1));trail.update(.01,true);}
   W.ui._leakFlash();W.ui.strikeFeedback(0,true);
   const e=W.enemies.spawn('husk',W.nav.heartNode,1);e.dir.copy(a.dir).addScaledVector(a.fwd,.7/R).normalize();e.height=terrainHeight(e.dir.x,e.dir.y,e.dir.z);e.alt=0;e.atkCd=0;e.scanT=0;
   W.enemies._melee(e,0);W.mode99.threats.update();const plan=e.attackPlan,guide=W.mode99.threats.pool.some(g=>g.visible&&g.userData.enemyId===e.id),hp=a.hp;
   if(plan)W.enemies._melee(e,e.windT+.001);
   W.post.render(W.scene,W.rig.camera,0);
   return {texts,fpTrail:W.viewModel.trail.mesh.visible,tpTrail:W.possession.tpTrail.mesh.visible,grain:W.post.compositeMat.uniforms.uGrain.value,guide,damage:hp-a.hp,vignette:getComputedStyle(document.getElementById('damage-vignette')).opacity,hitClass:document.getElementById('fp-hit').className,hitAnimation:getComputedStyle(document.getElementById('fp-hit')).animationName,paused:W.game.paused};
  });
  checks.push({name:'Numbers can hide while BLOCKED remains readable',ok:!effects.texts.includes('123')&&effects.texts.includes('BLOCKED'),actual:effects});
  checks.push({name:'Blade trail preference applies in both camera modes',ok:!effects.fpTrail&&!effects.tpTrail});
  checks.push({name:'Grain can be disabled independently of bloom quality',ok:effects.grain===0});
  checks.push({name:'Reduced flashes retain static hit feedback and suppress the screen flash',ok:effects.vignette==='0'&&effects.hitClass.includes('blocked')&&effects.hitAnimation==='none'});
  checks.push({name:'Red danger tells and real damage remain with cosmetics reduced',ok:effects.guide&&effects.damage>0&&effects.paused});
  await page.waitForTimeout(400);
  checks.push({name:'Static hit marker expires instead of sticking on screen',ok:await page.locator('#fp-hit').evaluate(el=>!el.classList.contains('go'))});
  for(const viewport of [{width:1280,height:720},{width:1920,height:1080},{width:390,height:844}]){
   await page.setViewportSize(viewport);await page.locator('#settings-pop').evaluate(el=>el.scrollTop=0);await page.screenshot({path:resolve(out,`settings-${viewport.width}.png`)});
   checks.push({name:`Settings fit ${viewport.width}px and remain scrollable`,ok:await page.locator('#settings-pop').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight&&el.scrollWidth<=el.clientWidth+1;})});
   const reachable=await page.locator('#settings-pop').evaluate(el=>[...el.querySelectorAll('button,input')].every(control=>{control.scrollIntoView({block:'nearest'});const r=control.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return top===control||control.contains(top);}));
   checks.push({name:`Settings controls at ${viewport.width}px are above build cards and alerts`,ok:reachable});
  }
  await page.locator('#set-grain').focus();await page.keyboard.press('Escape');
  checks.push({name:'Escape closes settings and returns keyboard focus',ok:await page.locator('#settings-pop').evaluate(el=>!el.classList.contains('show'))&&await page.locator('#btn-settings').evaluate(el=>el===document.activeElement&&el.getAttribute('aria-expanded')==='false')});
  const beforeReload=await snapshot(page);await boot(page);const reloaded=await snapshot(page);
  checks.push({name:'Feedback preferences survive a normal reload',ok:JSON.stringify(reloaded)===JSON.stringify(beforeReload),actual:reloaded});
  const reduced=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});await boot(reduced);const defaults=await snapshot(reduced);
  checks.push({name:'Reduced-motion defaults turn optional flashes, trails, numbers and grain off',ok:controls.every(([,key])=>defaults[key]===false),actual:defaults});await reduced.close();
 }
}catch(error){faults.push(String(error));}
finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Actual settings clicks/keyboard, injected effect and strike fixtures, reload and fresh reduced-motion profile; not a photosensitivity certification.',checks,faults},null,2)+'\n');console.log(JSON.stringify({passed:checks.filter(x=>x.ok).length,total:checks.length,failed:checks.filter(x=>!x.ok),faults}));await browser.close();}
if(faults.length||checks.some(x=>!x.ok))process.exitCode=1;
