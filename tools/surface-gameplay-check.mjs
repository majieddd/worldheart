import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright'),out=resolve(process.argv[2]||'artifacts/living-worlds/surfaces'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8139';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],faults=[];page.on('pageerror',e=>faults.push(String(e)));
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__frames=true;window.requestAnimationFrame=fn=>raf(t=>{if(__frames)fn(t);});});
try{for(const terrain of ['sky','geothermal']){
 await page.goto(`${base}/?map=ninetynine&campaign=0&planet=temperate&terrain=${terrain}&seed=4206018157`);await page.waitForFunction(()=>window.WH?.mode99&&document.querySelector('#boot.done'),{},{timeout:150000});await page.locator('#btn-begin').click();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#title-overlay')).opacity==='0');if(await page.locator('#draft-cards button:visible').count())await page.locator('#draft-cards button').first().click();await page.evaluate(()=>document.activeElement.blur());
 checks.push(...await page.evaluate(async terrain=>{
  __frames=false;const W=WH,m=W.mode99,w=await import(new URL('js/world.js',location.href)),T=await import(new URL('lib/three.module.min.js',location.href)),a=m.commander,r=[],ck=(name,ok,actual)=>r.push({name,ok:!!ok,actual});W.waves.canRaid=()=>false;W.game.paused=false;
  if(terrain==='sky'){
   const deck=w.FEATURES.surfaces.find(s=>s.key==='floating-slab'&&s.top(0,0)>w.terrainHeight(...s.dir)+3);ck('Actual planet contains a suspended deck',!!deck);if(!deck)return r;
   a.dir.set(...deck.dir);a.height=w.terrainHeight(...deck.dir);a.hop=deck.top(0,0)+.3-w.surfaceElevation(a.dir,a.height);a.vertVel=-20;a.airT=1;a.mountKey='none';a.mountFlight=0;
   W.allies._fall(a,1/30);ck('Actual commander lands on the rendered deck',a.airT===0&&Math.abs(a.height-deck.top(0,0))<.02,{height:a.height,top:deck.top(0,0)});
   W.possession.enter(a);W.possession.boom=W.possession.boomWant=5;W.possession.suspended=false;a.fwd.set(...deck.m.axis).addScaledVector(a.dir,-new T.Vector3(...deck.m.axis).dot(a.dir)).normalize();window.__deck=deck;window.__start=a.dir.clone();window.__fell=false;
   W.step(.01,60,true);
  }else{
   const vent=w.FEATURES.vents[0];ck('Actual volcanic pack contains an erupting vent',!!vent);if(!vent)return r;
   a.dir.copy(vent.dir);a.height=w.terrainHeight(...a.dir.toArray());a.hop=0;a.airT=0;a.mountFlight=0;
   const enemy=W.enemies.spawn('husk',W.nav.heartNode,1);enemy.dir.copy(vent.dir);enemy.height=a.height;enemy.alt=0;
   const before=W.allies.enemyPos(enemy,new T.Vector3()).length();m.geysers.time=(12-vent.phase)%12+.01;m.geysers.update(.01);
   for(let k=0;k<45;k++){m.geysers.update(1/60);W.allies._fall(a,1/60);}const after=W.allies.enemyPos(enemy,new T.Vector3()).length();
   ck('Visible geyser lifts the commander and a real husk',a.hop>3&&after-before>3,{commanderLift:a.hop,enemyLift:after-before,launches:m.geysers.launches});
   W.allies._render(.01);W.enemies._render(.01);const camera=W.rig.camera,centre=vent.dir.clone().multiplyScalar(w.R+vent.height),side=a.fwd.clone().addScaledVector(vent.dir,-a.fwd.dot(vent.dir)).normalize();camera.position.copy(centre).addScaledVector(side,30).addScaledVector(vent.dir,12);camera.up.copy(vent.dir);camera.lookAt(centre.clone().addScaledVector(vent.dir,5));camera.near=.1;camera.updateProjectionMatrix();camera.updateMatrixWorld();W.post.render(W.scene,camera,.01);
  }return r;
 },terrain));
 await page.screenshot({path:resolve(out,terrain+'-feature.png')});
 if(terrain==='sky'){
  await page.keyboard.down('w');const result=await page.evaluate(async()=>{const W=WH,w=await import(new URL('js/world.js',location.href)),a=W.mode99.commander;for(let i=0;i<400;i++){W.step(1/60,60,false);if(a.hop>1&&a.airT>0&&a.height<__deck.top(0,0)-.5)__fell=true;}return {distance:__start.angleTo(a.dir)*w.R,fell:__fell,height:a.height,hop:a.hop};});await page.keyboard.up('w');checks.push({name:'Keyboard movement leaves a deck and enters a real fall',ok:result.distance>10&&result.fell,actual:result});await page.screenshot({path:resolve(out,'walk-off-deck.png')});
 }
}}catch(error){faults.push(String(error));await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});}finally{writeFileSync(resolve(out,'report.json'),JSON.stringify({scope:'Targeted positions and time, actual rendered world, units, collision and keyboard events. Not an unforced expedition.',checks,faults},null,2));await browser.close();}
console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok),faults}));if(checks.some(c=>!c.ok)||faults.length)process.exitCode=1;
