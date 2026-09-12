// Owner-reported Debug World regressions. Native input/animation observations
// precede the explicitly frozen pose and terrain-sampling fixtures.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/debug-inspection/targeted'),base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,'');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],faults=[];
const check=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__freeze=false;window.requestAnimationFrame=f=>raf(t=>{if(!__freeze)f(t);});});
try{
 const start=Date.now();await page.goto(`${base}/debug.html#weapons/sword-ancient`);await page.waitForFunction(()=>window.DEBUG_WORLD,{},{timeout:120000});
 check('full gallery starts within fifteen seconds',Date.now()-start<15000,{ms:Date.now()-start});
 check('default motion loops all animations',await page.locator('#motion').inputValue()==='cycle');
 const snapshot=()=>page.evaluate(()=>DEBUG_WORLD.lanes[0].items.map(e=>({key:e.key,clip:e.group.userData.animation,matrix:e.group.children.map(p=>p.matrix.toArray()).flat()})));
 await page.locator('#overview').click();await page.locator('#motion').selectOption('walk');await page.waitForTimeout(60);const before=await snapshot();await page.waitForTimeout(500);const after=await snapshot();
 for(let i=0;i<before.length;i++)check(`${before[i].key}: continues animating in overview`,JSON.stringify(before[i].matrix)!==JSON.stringify(after[i].matrix));
 await page.locator('#motion').selectOption('still');await page.waitForTimeout(70);const still=await snapshot(),t=await page.evaluate(()=>DEBUG_WORLD.time);await page.waitForTimeout(200);
 check('manual pause stops all rigs and timeline',JSON.stringify(still)===JSON.stringify(await snapshot())&&t===await page.evaluate(()=>DEBUG_WORLD.time));
 await page.locator('#motion').selectOption('cycle');await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(70);const quiet=await snapshot();await page.waitForTimeout(200);
 check('reduced motion stops every rig',JSON.stringify(quiet)===JSON.stringify(await snapshot()));await page.emulateMedia({reducedMotion:'no-preference'});
 const screen=()=>page.evaluate(async()=>{const T=await import('./lib/three.module.min.js'),d=DEBUG_WORLD,v=new T.Vector3(d.selected.x,d.selected.group.userData.focusY,d.selected.z).project(d.camera);return [v.x,v.y];});
 for(const yaw of [0,Math.PI/2,-Math.PI/2])for(const pitch of [.3,1.1]){
   await page.evaluate(({yaw,pitch})=>{const d=DEBUG_WORLD;d.focus(d.selected);d.view.yaw=yaw;d.view.pitch=pitch;},{yaw,pitch});await page.waitForTimeout(40);
   const a=await screen();await page.mouse.move(850,440);await page.mouse.down({button:'right'});await page.mouse.move(910,490,{steps:6});await page.mouse.up({button:'right'});await page.waitForTimeout(40);const b=await screen();
   check(`right grab follows pointer at yaw ${yaw.toFixed(2)}, pitch ${pitch}`,b[0]>a[0]&&b[1]<a[1],{a,b});
 }
 await page.locator('#focus').click();await page.locator('#viewport').focus();let a=await screen();await page.keyboard.press('ArrowRight');await page.waitForTimeout(40);let b=await screen();check('right arrow moves viewpoint right',b[0]<a[0]);
 a=b;await page.keyboard.press('ArrowUp');await page.waitForTimeout(40);b=await screen();check('up arrow moves viewpoint forward',b[1]<a[1]);
 const d=await page.evaluate(()=>DEBUG_WORLD.view.distance);await page.mouse.move(850,440);await page.mouse.wheel(0,-150);await page.waitForTimeout(80);check('wheel up zooms in',await page.evaluate(()=>DEBUG_WORLD.view.distance)<d);
 const n=await page.evaluate(()=>DEBUG_WORLD.view.distance);await page.mouse.wheel(0,150);await page.waitForTimeout(80);check('wheel down zooms out',await page.evaluate(()=>DEBUG_WORLD.view.distance)>n);
 const rigs=await page.evaluate(async()=>{
   const {ALLY_CLIPS,ENEMY_CLIPS}=await import('./js/debug-animation.js'),d=DEBUG_WORLD,results=[];
   for(const e of d.lanes[0].items){
     const enemy=['mite','husk','aegis','wisp','colossus'].includes(e.key),clips=enemy?ENEMY_CLIPS:ALLY_CLIPS;let offset=0;
     for(const [name,duration]of clips){
       let bad=0,states=new Set();
       for(const fraction of [.02,.2,.5,.8,.98]){
         d.previewAnimation(offset+duration*fraction);e.group.updateMatrixWorld(true);
         e.group.traverse(o=>{for(const v of o.matrixWorld.elements)if(!Number.isFinite(v))bad++;});
         states.add(JSON.stringify(e.group.children.map(c=>c.matrix.toArray())));
         if(e.group.userData.animation!==name)bad++;
       }
       results.push({key:e.key,name,bad,states:states.size});offset+=duration;
     }
     d.previewAnimation(offset+.1);results.push({key:e.key,name:'loop restarts',bad:e.group.userData.animation==='idle'?0:1,states:2});
   }return results;
 });
 // Aegis has a deliberately held, armored idle in the production rig.
 for(const r of rigs)check(`${r.key}: ${r.name} follows its production pose`,!r.bad&&(r.states>1||r.key==='aegis'&&r.name==='idle'),r);
 await page.locator('#motion').selectOption('still');await page.evaluate(()=>{DEBUG_WORLD.view.yaw=.65;});await page.waitForTimeout(60);
 const render=()=>page.evaluate(()=>{const d=DEBUG_WORLD;d.previewAnimation(0,'still');d.renderer.render(d.scene,d.camera);});
 const weapons=await page.evaluate(()=>DEBUG_WORLD.lanes.find(l=>l.key==='weapons').items.map(e=>e.key));
 for(const key of weapons){
   await page.evaluate(key=>DEBUG_WORLD.select('weapons',key),key);await render();
   const r=await page.evaluate(async()=>{
     const T=await import('./lib/three.module.min.js'),d=DEBUG_WORLD,e=d.selected,box=new T.Box3().setFromObject(e.group),v=new T.Vector3();let outside=0;
     e.group.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).project(d.camera);if(Math.abs(v.x)>.98||Math.abs(v.y)>.98||v.z<0||v.z>1)outside++;}}});
     return {minY:box.min.y,maxY:box.max.y,outside,center:box.getCenter(new T.Vector3()).toArray(),target:d.target.toArray()};
   });
   check(`${key}: entire weapon clears plinth and fits view`,r.minY>=.64&&!r.outside&&r.center.every((v,i)=>Math.abs(v-r.target[i])<.001),r);
   await page.screenshot({path:resolve(out,`weapon-${key}.png`)});
 }
 const themes=await page.evaluate(()=>DEBUG_WORLD.lanes.find(l=>l.key==='themes').items.map(e=>e.key));
 for(const key of themes){
   await page.evaluate(key=>DEBUG_WORLD.select('themes',key),key);await render();
   const r=await page.evaluate(async()=>{const T=await import('./lib/three.module.min.js'),d=DEBUG_WORLD,e=d.selected,p=e.group.getObjectByName('miniature-terrain').geometry.attributes.position;const v=new T.Vector3();let outside=0;for(let i=0;i<p.count;i+=13){v.fromBufferAttribute(p,i).applyMatrix4(e.group.getObjectByName('miniature-terrain').matrixWorld).project(d.camera);if(Math.abs(v.x)>.98||Math.abs(v.y)>.98)outside++;}return {...e.group.userData.miniature,outside};});
   check(`${key}: full spherical relief, biomes and formations`,r.vertices===40962&&r.min<-1&&r.max>20&&r.formations.length>=15&&Object.keys(r.biomes).length>=2&&!r.outside,r);
   await page.waitForTimeout(40);
   check(`${key}: distant labels do not cover the planet`,await page.locator('.label:not(.lane-title):visible').count()<=1);
   await page.screenshot({path:resolve(out,`theme-${key}.png`)});
 }
 await page.setViewportSize({width:375,height:900});await page.waitForTimeout(60);await page.locator('#focus').click();await render();
 const mobile=await page.evaluate(async()=>{const T=await import('./lib/three.module.min.js'),d=DEBUG_WORLD,o=d.selected.group.getObjectByName('miniature-terrain'),p=o.geometry.attributes.position,v=new T.Vector3();let outside=0;for(let i=0;i<p.count;i+=7){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).project(d.camera);if(Math.abs(v.x)>.98||Math.abs(v.y)>.98)outside++;}return outside;});
 check('miniature focus fits the narrow phone viewport',mobile===0,mobile);await page.screenshot({path:resolve(out,'mobile-theme.png')});await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(60);
 const restore=await page.evaluate(async()=>{
   const {CONFIG}=await import('./js/config.js'),w=await import('./js/world.js'),{miniaturePlanet}=await import('./js/debug-planets.js');
   const config=JSON.stringify(CONFIG),samples=()=>Array.from({length:60},(_,i)=>{const y=1-2*(i+.5)/60,a=i*2.39996323,r=Math.sqrt(1-y*y),d={x:Math.cos(a)*r,y,z:Math.sin(a)*r};return [w.terrainHeight(d.x,d.y,d.z,false),w.biomeAt(d),w.terrainThermal(d,10)];});
   const before=JSON.stringify(samples()),extra=miniaturePlanet('volcanic');extra.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
   return {config:config===JSON.stringify(CONFIG),field:before===JSON.stringify(samples()),radius:w.R};
 });check('miniature construction restores configuration and production field',restore.config&&restore.field&&restore.radius===240,restore);
 // Freeze rAF only for explicit pose screenshots, after native input/render checks.
 await page.evaluate(()=>{__freeze=true;});await page.waitForTimeout(40);
 for(const [key,time]of [['commander',8.8],['oracle',8.8],['wisp',12.8],['colossus',6]]){
   await page.evaluate(({key,time})=>{const d=DEBUG_WORLD;d.select('units',key);d.previewAnimation(time);d.renderer.render(d.scene,d.camera);},{key,time});await page.screenshot({path:resolve(out,`pose-${key}.png`)});
 }
 check('no runtime or console faults',faults.length===0,faults);
}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,faults},null,2)+'\n');await browser.close();}
console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok)}));if(checks.some(c=>!c.ok))process.exitCode=1;
