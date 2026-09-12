import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {TERRAIN_PACKS,NEW_PLANET_THEMES} from '../js/run/world-catalogue.js';
import {PLANET_THEMES} from '../js/run/planet-environments.js';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/living-worlds/expansion'),kind=process.argv[3]||'all',base=process.env.WH_BASE_URL||'http://127.0.0.1:8139';mkdirSync(out,{recursive:true});
const cases=[...(kind==='themes'?[]:Object.keys(TERRAIN_PACKS).map(terrain=>({terrain,planet:'temperate',label:'terrain-'+terrain}))),...(kind==='packs'?[]:Object.keys(PLANET_THEMES).filter(x=>x!=='auto').map(planet=>({terrain:'varied',planet,label:'planet-'+planet})))];
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],records=[],faults=[];
page.on('pageerror',e=>faults.push(String(e)));await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__frames=true;window.requestAnimationFrame=fn=>raf(t=>{if(__frames)fn(t);});});
const ck=(name,ok,actual)=>checks.push({name,ok:!!ok,actual}),save=()=>writeFileSync(resolve(out,'report.json'),JSON.stringify({base,checks,records,faults},null,2));
try{for(const c of cases.filter(c=>!process.argv[4]||process.argv[4].split(',').includes(c.label))){const start=Date.now();
 try{
  await page.goto(`${base}/?map=ninetynine&campaign=0&worldgen=1&terrain=${c.terrain}&planet=${c.planet}&seed=4206018157`);
  await page.waitForFunction(()=>window.WH?.heartPos&&window.WH?.worldgen?.landmarks&&document.querySelector('#boot.done')||document.querySelector('#boot-status')?.textContent.includes('failed'),{},{timeout:120000});
  const result=await page.evaluate(async()=>{
   if(!window.WH?.heartPos)throw Error(document.querySelector('#boot-status')?.textContent);__frames=false;WH.step(1);
   const W=WH,w=await import(new URL('js/world.js',location.href)),sites=await import(new URL('js/nest-sites.js',location.href)),n=W.nav,v=W.heartPos.clone(),types={},biomes={},bad={},used=new Set(),routes=[];let dry=0,connected=0,pits=0,water=0,land=0;
   for(const m of w.FORMATIONS.modules)if(m.height>0)types[m.type]=(types[m.type]||0)+1;
   for(let i=0;i<n.n;i++)if(n.baseHeight[i]<-1&&n.waterDepth[i]===0&&n.floorWalk[i]){
    const reached=n.march.floorReach[i];if(!reached){const key=w.FORMATIONS.inspect(n.dirs[i*3],n.dirs[i*3+1],n.dirs[i*3+2]).type;bad[key]=(bad[key]||0)+1;if(['karst','kettles'].includes(key)){pits++;continue;}}
    dry++;if(reached)connected++;
   }
   for(let i=0;i<3000;i++){const y=1-2*(i+.5)/3000,a=i*2.39996323,r=Math.sqrt(1-y*y);v.set(r*Math.cos(a),y,r*Math.sin(a));const h=w.terrainHeight(...v.toArray(),false),b=w.biomeAt(v,h);biomes[b]=(biomes[b]||0)+1;if(w.waterDepthAt(v,h)>0)water++;else land++;}
   const centre=n.nodeDir(n.heartNode,v.clone());for(let k=0;k<11;k++){const node=sites.nestSite(n,n.portalNodes[k%n.portalNodes.length],centre,.05,used,v);if(node<0)break;used.add(node);let i=node,steps=0,legal=true;while(i!==n.heartNode&&i>=0&&steps<n.n){const j=n.march.next[i];if(j<0||!n.march.floorReach[i]){legal=false;break;}i=j;steps++;}routes.push({node,legal:legal&&i===n.heartNode,steps});}
   return {seed:W.CONFIG.seed,attempts:n.attempts,types,biomes,dry,connected,pits,bad,water,land,routes,certificate:n.terrainCertificate,features:w.FEATURES.surfaces.length,vents:w.FEATURES.vents.length,environment:W.CONFIG.environment};
  });
  ck(c.label+': certified battlefield and eleven actual nest approaches',result.certificate?.pass&&result.routes.length===11&&result.routes.every(r=>r.legal),{certificate:result.certificate,routes:result.routes});
  ck(c.label+': dry passage connectivity',!result.dry||result.connected/result.dry>=.95,{dry:result.dry,connected:result.connected,pits:result.pits,disconnected:result.bad});
  if(c.terrain==='alpine')ck('Giant Peaks contains only mountain ranges',Object.keys(result.types).every(k=>['range','spine'].includes(k)),result.types);
  if(c.terrain==='canyon')ck('Deep Canyons contains only incised families',Object.keys(result.types).every(k=>Object.hasOwn(TERRAIN_PACKS.canyon.weights,k)),result.types);
  if(c.terrain==='ocean')ck('Ocean World has a majority ocean',result.water>result.land,{water:result.water,land:result.land});
  if(NEW_PLANET_THEMES[c.planet])ck(c.label+': multiple authored biomes present',NEW_PLANET_THEMES[c.planet].biomes.filter(k=>result.biomes[k]>10).length>=2,result.biomes);
  await page.evaluate(()=>{WH.rig.camera.position.set(.72,.18,.69).normalize().multiplyScalar(WH.CONFIG.planetRadius*4.2);WH.rig.camera.lookAt(0,0,0);WH.worldgen.inspectionLight.position.copy(WH.rig.camera.position);WH.post.render(WH.scene,WH.rig.camera,0);});
  await page.locator('#worldgen-panel summary').click();await page.screenshot({path:resolve(out,c.label+'.png')});records.push({...c,ms:Date.now()-start,...result});console.log(JSON.stringify({label:c.label,ms:Date.now()-start,seed:result.seed,pass:result.certificate?.pass,deepRatio:result.connected/result.dry,bad:result.bad}));
 }catch(error){ck(c.label+': boots',false,String(error));await page.screenshot({path:resolve(out,c.label+'-failed.png')}).catch(()=>{});console.log(c.label+': '+error);}
 save();
}ck('No browser faults',faults.length===0,faults);}finally{save();await browser.close();}
console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length}));if(checks.some(c=>!c.ok))process.exitCode=1;
