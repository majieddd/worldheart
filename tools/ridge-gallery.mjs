// Same world direction, lens, eye distance and lighting seed on both builds.
// Inspection hides exploration covers; it does not claim a normal play view.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/worldgen/ridges'),after=process.env.WH_BASE_URL||'http://127.0.0.1:8139',before=process.env.WH_BEFORE_URL||'http://127.0.0.1:8140';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),records=[],faults=[];
async function open(base,profile,seed){const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>faults.push(String(e)));await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});await p.goto(`${base}/?map=ninetynine&campaign=0&terrain=${profile}&seed=${seed}`);await p.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});await p.evaluate(()=>{__qaFramesEnabled=false;});return p;}
async function capture(page,info,path){
 const pose=await page.evaluate(async info=>{
  const T=await import('three'),W=WH,r=W.rig,d=new T.Vector3(...info.anchor).normalize();
  document.getElementById('hud').style.display='none';for(const el of document.querySelectorAll('.overlay'))el.classList.remove('show');
  for(const layer of [W.world.fogVeil,W.world.cloudDeck,W.world.fieldWall])if(layer)layer.mesh.visible=false;
  W.game.paused=true;r.cancelFlight();r.lat=Math.asin(d.y);r.lon=Math.atan2(d.x,d.z);r.confine=null;r.autoOrbit=0;W.step(.1);
  const east=new T.Vector3().crossVectors(new T.Vector3(0,1,0),d).normalize(),target=d.clone().multiplyScalar(W.CONFIG.planetRadius+info.range*.3);
  r.camera.position.copy(target).addScaledVector(d,info.distance*.75).addScaledVector(east,info.distance*.66);
  r.camera.up.copy(d);r.camera.fov=50;r.camera.near=.8;r.camera.far=4000;r.camera.lookAt(target);r.camera.updateProjectionMatrix();r.camera.updateMatrixWorld();W.post.render(W.scene,r.camera,1/60);
  return {seed:W.CONFIG.seed,position:r.camera.position.toArray(),target:target.toArray(),fov:r.camera.fov};
 },info);await page.screenshot({path});return pose;
}
try{
 for(const profile of ['varied','alpine']){
  const next=await open(after,profile,12345);
  const info=await next.evaluate(async()=>{const {FORMATIONS,terrainHeight}=await import(new URL('js/world.js',location.href)),W=WH,m=FORMATIONS.manifest();
   const options=m.chains.map(chain=>{
    let height=-Infinity,anchor=null;
    for(const [a,b]of chain.links)for(let t=.1;t<=.9;t+=.1){const d=m.modules[a].dir.map((v,k)=>v*(1-t)+m.modules[b].dir[k]*t),l=Math.hypot(...d),p=d.map(v=>v/l),h=terrainHeight(...p,false);if(h>height){height=h;anchor=p;}}
    return {members:chain.members,anchor,height};
   });
   options.sort((a,b)=>b.height-a.height);
   if(!options.length)throw Error('No mountain chain generated');
   return {...options[0],seed:W.CONFIG.seed,version:FORMATIONS.version,range:W.CONFIG.terrain.range,distance:W.CONFIG.terrain.range*1.5+90};});
  const old=await open(before,profile,12345),oldPose=await capture(old,info,resolve(out,`${profile}-before.png`)),newPose=await capture(next,info,resolve(out,`${profile}-after.png`));
  records.push({profile,...info,oldPose,newPose,matching:JSON.stringify(oldPose)===JSON.stringify(newPose)});await old.close();await next.close();console.log(JSON.stringify(records.at(-1)));
 }
}catch(error){faults.push(String(error));throw error;}
finally{await browser.close();writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Fixed inspection poses on the same accepted seed and world direction',records,faults,pass:records.length===2&&records.every(r=>r.matching)&&!faults.length},null,2)+'\n');if(records.length!==2||records.some(r=>!r.matching)||faults.length)process.exitCode=1;}
