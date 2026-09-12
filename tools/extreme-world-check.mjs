import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {PLANET_THEMES} from '../js/run/planet-environments.js';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json'));
const {chromium}=require('playwright'),out=resolve(process.argv[2]||'artifacts/extreme-worlds/planets'),base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,'');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],records=[],faults=[];
const check=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
page.on('pageerror',e=>faults.push(String(e)));
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__frames=true;window.requestAnimationFrame=fn=>raf(t=>{if(__frames)fn(t);});});
try{
 for(const planet of Object.keys(PLANET_THEMES).filter(k=>k!=='auto')){
  const start=Date.now();await page.goto(`${base}/?map=ninetynine&campaign=0&worldgen=1&terrain=varied&seed=4206018157&planet=${planet}`);
  await page.waitForFunction(()=>window.WH?.worldgen,{},{timeout:240000});
  const r=await page.evaluate(async()=>{
   __frames=false;WH.step(1);const w=await import(new URL('js/world.js',location.href)),n=WH.nav,counts={},land={},v=WH.heartPos.clone();let dry=0,reached=0;
   for(let k=0;k<3000;k++){const y=1-2*(k+.5)/3000,a=k*2.3999632297,r=Math.sqrt(1-y*y);v.set(r*Math.cos(a),y,r*Math.sin(a));const h=w.terrainHeight(v.x,v.y,v.z,false),b=w.biomeAt(v,h);counts[b]=(counts[b]||0)+1;if(w.waterDepthAt(v,h)===0)land[b]=(land[b]||0)+1;}
   for(let i=0;i<n.n;i++)if(n.baseHeight[i]<-1&&n.waterDepth[i]===0&&n.floorWalk[i]){dry++;if(n.march.floorReach[i])reached++;}
   return {seed:WH.CONFIG.seed,attempts:n.attempts,environment:WH.CONFIG.environment,counts,land,dry,reached,certificate:n.terrainCertificate,
    decor:WH.world.decor.sets.map(s=>s.list.length),landmarks:WH.worldgen.landmarks.map(x=>x.type)};
  });
  check(`${planet}: exact theme and certified battlefield`,r.environment.theme===planet&&r.certificate?.pass,r.certificate);
  check(`${planet}: connected dry floors`,!r.dry||r.reached/r.dry>=.95,{dry:r.dry,reached:r.reached});
  const surface={monsoon:['jungle','woodland'],arid:['desert'],frozen:['tundra','alpine'],volcanic:['volcanic'],crystalline:['crystalline'],fungal:['fungal'],oceanic:['wetland','jungle'],ferrous:['ferrous'],twilight:['twilight']}[planet];
  if(surface){const total=Object.values(r.land).reduce((a,b)=>a+b,0),dominant=surface.reduce((sum,k)=>sum+(r.land[k]||0),0);check(`${planet}: dominant themed land`,dominant/total>=.82,{dominant,total,ratio:dominant/total});}
  check(`${planet}: selectable theme and debug route`,await page.locator('#worldgen-planet').inputValue()===planet&&await page.locator('#worldgen-panel a[href="debug.html"]').count()===1);
  // A centered inspection capture, not a claim about normal gameplay zoom.
  await page.evaluate(()=>{WH.step(1);WH.rig.camera.position.copy(WH.heartPos).set(.72,.18,.69).normalize().multiplyScalar(WH.CONFIG.planetRadius*4.2);WH.rig.camera.lookAt(0,0,0);WH.worldgen.inspectionLight.position.copy(WH.rig.camera.position);WH.post.render(WH.scene,WH.rig.camera,0);});
  await page.locator('#worldgen-panel summary').click();await page.screenshot({path:resolve(out,`globe-${planet}.png`)});await page.locator('#worldgen-panel summary').click();
  await page.locator('#worldgen-home').click();await page.evaluate(()=>WH.step(1));await page.locator('#worldgen-panel summary').click();await page.screenshot({path:resolve(out,`ground-${planet}.png`)});
  records.push({planet,ms:Date.now()-start,...r});console.log(JSON.stringify({planet,ms:Date.now()-start,seed:r.seed,counts:r.counts,dry:r.dry,reached:r.reached}));
 }
 check('no browser faults',faults.length===0,faults);
}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,records,faults},null,2));await browser.close();}
console.log(JSON.stringify({passed:checks.filter(x=>x.ok).length,total:checks.length}));if(checks.some(x=>!x.ok))process.exitCode=1;
