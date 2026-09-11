// Instrumented sub-sea locomotion and normal generator UI. These are targeted
// fixtures, not a blind run or full-campaign completion claim.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/landform-biomes/browser');mkdirSync(out,{recursive:true});
const hydrologyOnly=process.argv.includes('--hydrology-only');
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],faults=[],records=[];
const check=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR'))faults.push(m.text());});
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 for(const [seed,profile] of [[771,'varied'],[4306234,'varied']]){
  await page.goto(`${base}/?map=ninetynine&campaign=0&seed=${seed}&terrain=${profile}`);await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
  const result=await page.evaluate(async()=>{
   __qaFramesEnabled=false;document.getElementById('btn-begin').click();WH.game.paused=true;
   const W=await import(new URL('js/world.js',location.href)),n=WH.nav,p=WH.heartPos.clone(),q=p.clone(),hit=p.clone(),checks=[];
   const check=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
   let total=0,reached=0,low=-1,wet=-1,place=-1;
   for(let i=0;i<n.n;i++){
    if(n.baseHeight[i]<-1&&n.waterDepth[i]===0&&n.floorWalk[i]&&(WH.CONFIG.requestedSeed!==771||W.FORMATIONS.inspect(...n.nodeDir(i,p).toArray()).type==='gorge')){total++;if(n.march.floorReach[i]){reached++;if(low<0||n.baseHeight[i]<n.baseHeight[low])low=i;}}
    if(n.baseHeight[i]<-1&&n.waterDepth[i]===0&&n.march.floorReach[i]&&place<0){n.nodeDir(i,p);if(W.terrainFootprint(p,1,'bolt').ok)place=i;}
    if(n.waterDepth[i]>1&&n.walk[i])wet=i;
   }
   check('Dry sub-sea floors exist and mostly connect to the heart',total>20&&reached/total>=.95,{total,reached,low:low>=0?n.baseHeight[low]:null,type:low>=0?W.FORMATIONS.inspect(...n.nodeDir(low,p).toArray()).type:null});
   if(low>=0){
    n.nodeDir(low,p);const height=W.terrainHeight(p.x,p.y,p.z);q.copy(p).multiplyScalar(W.R+20);
    check('Ray picks the actual negative canyon floor',W.raycastTerrain(q,p.clone().negate(),hit)&&Math.abs(hit.length()-W.R-height)<.01,{expected:height,actual:hit.length()-W.R});
    check('Water mesh mask leaves dry canyon open',!W.oceanAt(p.x,p.y,p.z)&&WH.world.water.material.fragmentShader.includes('vOcean < 0.0'));
    const a=WH.allies.active.find(a=>a.type.commander);a.dir.copy(p);n.nodeDir(n.march.next[low],q);a.fwd.copy(q).addScaledVector(p,-q.dot(p)).normalize();a.moveNode=-1;a.swimming=true;WH.allies._ground(a);
    const start=a.dir.clone();for(let k=0;k<60;k++)WH.allies.driveUnit(a,1,0,1/60);
    check('Commander walks below sea level without swimming',!a.swimming&&start.angleTo(a.dir)*W.R>.3,{distance:start.angleTo(a.dir)*W.R,height:a.height,swimming:a.swimming});
    const body=WH.allies.worldPos(a,q);check('Commander aiming origin stays below sea level with the body',body.length()<W.R,{height:body.length()-W.R});
    const e=WH.enemies.spawn('husk',low,1);let leak=false;const old=WH.enemies.onLeak;WH.enemies.onLeak=()=>{leak=true;};
    WH.enemies.setHeart(WH.heartPos);
    for(let k=0;k<15000&&!leak;k++)WH.enemies.update(1/30);
    WH.enemies.onLeak=old;check('A real ground enemy exits the sub-sea passage and reaches base',leak,{remaining:WH.enemies.active.length});
    WH.possession.enter(a);WH.step(.25);check('First-person camera stays finite inside the canyon',WH.rig.camera.matrixWorld.elements.every(Number.isFinite));
    WH.possession.exit();
   }
   check('Flat dry sub-sea ground permits a normal tower footprint',place>=0,{place});
   if(place>=0){n.nodeDir(place,p);const t=WH.towers.place('bolt',W.surfacePoint(p,q));check('Placed tower stands at negative ground height',t.pos.length()<W.R,{height:t.pos.length()-W.R});}
   check('Ocean swimming surface remains above the seabed',wet>=0&&W.surfacePoint(n.nodeDir(wet,p),q).length()>W.R&&W.waterDepthAt(p)>1);
   return {seed:WH.CONFIG.seed,checks};
  });
  checks.push(...result.checks.map(c=>({...c,name:`Seed ${seed} ${profile}: ${c.name}`})));records.push(result);
  await page.screenshot({path:resolve(out,`dry-canyon-${seed}-${profile}.png`)});
 }
 if(!hydrologyOnly){
 let fingerprint=null;
 for(const biome of ['temperate','desert','jungle','volcanic','boreal','wetland']){
  await page.goto(`${base}/?map=ninetynine&campaign=0&seed=12345&terrain=varied&worldgen=1&biome=${biome}`);await page.waitForFunction(()=>window.WH?.worldgen,{},{timeout:180000});
  await page.evaluate(()=>{__qaFramesEnabled=false;WH.step(1);});
  const result=await page.evaluate(async()=>{
   const w=await import(new URL('js/world.js',location.href)),n=WH.nav;return {seed:WH.CONFIG.seed,terrain:WH.CONFIG.terrainKey,key:w.ECOLOGY.manifest().key,field:JSON.stringify(w.FORMATIONS.manifest()),heights:Array.from(n.height.filter((_,i)=>i%101===0)),decor:WH.world.decor?.sets?.map(s=>s.list.length),catalog:WH.worldgen.landmarks};
  });
  const fp=JSON.stringify([result.seed,result.field,result.heights]);if(!fingerprint)fingerprint=fp;
  check(`${biome}: climate does not reroll terrain geometry`,fp===fingerprint,{seed:result.seed});
  check(`${biome}: inspector reflects the requested climate`,await page.locator('#worldgen-biome').inputValue()===biome&&result.key===biome);
  const play=new URL(await page.locator('#worldgen-play').getAttribute('href'));check(`${biome}: play link preserves climate`,play.searchParams.get('biome')===biome);
  await page.locator('#worldgen-globe').click();await page.evaluate(()=>WH.step(1));await page.locator('#worldgen-panel summary').click();await page.screenshot({path:resolve(out,`biome-${biome}.png`)});
  records.push({biome,...result,field:undefined,heights:undefined});
 }
 await page.locator('#worldgen-panel summary').click();await page.setViewportSize({width:390,height:844});
 check('Climate control fits a narrow viewport without horizontal scroll',await page.evaluate(()=>document.body.scrollWidth<=innerWidth&&document.getElementById('worldgen-biome').getBoundingClientRect().right<=innerWidth));
 await page.locator('#worldgen-biome').selectOption('desert');await page.locator('#worldgen-form button[type=submit]').click();await page.waitForFunction(()=>window.WH?.worldgen&&WH.CONFIG.biomeKey==='desert',{},{timeout:180000});
 check('Normal Load seed interaction applies the selected climate',new URL(page.url()).searchParams.get('biome')==='desert');
 }
}finally{await browser.close();const result={base,scope:'Targeted sub-sea movement/placement and normal climate controls with instrumented frame advance',checks,records,faults,pass:checks.every(c=>c.ok)&&!faults.length};writeFileSync(resolve(out,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.ok),faults,pass:result.pass}));if(!result.pass)process.exitCode=1;}
