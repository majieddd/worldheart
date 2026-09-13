// Deliberate inspection views complement registry checks and physical fixtures.
import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright'),out=resolve(process.argv[2]||'artifacts/natural-worlds/inspection'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8139';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],faults=[];page.on('pageerror',e=>faults.push(String(e)));
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__frames=true;window.requestAnimationFrame=fn=>raf(t=>{if(__frames)fn(t);});});
const capture=async(lane,key,suffix,options={})=>{
 await page.evaluate(({lane,key,options})=>{
  const D=DEBUG_WORLD;D.select(lane,key,false);const item=D.selected;D.previewAnimation(0,'still');
  if(lane==='themes')item.group.children[0].rotation.set(0,0,0);
  if(lane==='disasters')item.group.children[1].userData.update(options.time??.08,!!options.warning);
  const yaw=options.yaw??.65,pitch=options.pitch??.24,distance=options.distance??D.view.distance*.83;
  D.camera.position.set(D.target.x+Math.sin(yaw)*Math.cos(pitch)*distance,D.target.y+Math.sin(pitch)*distance,D.target.z+Math.cos(yaw)*Math.cos(pitch)*distance);
  D.camera.lookAt(D.target);D.camera.updateMatrixWorld();D.renderer.render(D.scene,D.camera);
 },{lane,key,options});
 await page.screenshot({path:resolve(out,`${lane}-${key}-${suffix}.png`)});
};
try{
 await page.goto(base+'/debug.html');await page.waitForFunction(()=>window.DEBUG_WORLD,{},{timeout:180000});await page.evaluate(()=>{__frames=false;});
 for(const key of ['valley','grotto','caverns','arcade','ribbons','sky','skyreef','skycrown','skyshards']){await capture('formations',key,'underpass');if(['valley','grotto','caverns','arcade'].includes(key))await capture('formations',key,'banks',{yaw:-.8,pitch:.48});}
 for(const [name,lon,lat]of [['africa',20,10],['americas',-90,15],['asia',110,30],['pacific',165,-15],['antarctica',20,-72]])await capture('themes','earth',name,{yaw:Math.PI/2+lon*Math.PI/180,pitch:lat*Math.PI/180,distance:32});
 for(const key of ['thunder','solar','tsunami','quake'])await capture('disasters',key,'active',{time:key==='tsunami'?8:.08,pitch:.5});
 await capture('disasters','tsunami','warning',{warning:true,pitch:.7});
 checks.push(await page.evaluate(()=>{const art=DEBUG_WORLD.selected.group.children[1];return {name:'Tsunami warning is visible and wave waits for impact',ok:art.getObjectByName('surge-warning').visible&&!art.getObjectByName('continuous-tsunami-bore').visible};}));
 for(const key of ['jungle','tundra','temperate']){
  const exists=await page.evaluate(key=>DEBUG_WORLD.exhibits.some(e=>e.lane==='biomes'&&e.key===key),key);if(exists)await capture('biomes',key,'density',{pitch:.9});
 }
 checks.push({name:'No runtime faults',ok:!faults.length,actual:faults});
}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Explicit camera and animation-time inspection views of the production Debug exhibits',checks,faults},null,2));await browser.close();}
console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length}));if(checks.some(c=>!c.ok))process.exitCode=1;
