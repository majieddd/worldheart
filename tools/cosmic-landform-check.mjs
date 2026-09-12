// Controlled rendered inspection plus normal generator controls. Seed survey
// precedes choosing a gameplay fixture; no claim of blind play is made here.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json'));
const {chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/cosmic-landforms/browser'),base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,'');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],faults=[],records=[];
const check=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
const themes=process.argv.includes('--quick')?['auto']:['auto','temperate','arid','frozen','volcanic','monsoon'];
const seed=Number(process.argv.find(a=>a.startsWith('--seed='))?.split('=')[1]||4206018157);
if(!Number.isInteger(seed)||seed<1||seed>0xffffffff)throw Error('Invalid seed');
const types=['grand','labyrinth','chaos','spine','volcano','forest','gorge','crevice','ravine'],seen=new Set();
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>faults.push(String(e)));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR'))faults.push(m.text());});
  await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
  for(const planet of themes){
    await page.goto(`${base}/?map=ninetynine&campaign=0&seed=${seed}&terrain=varied&worldgen=1&planet=${planet}`);
    await page.waitForFunction(()=>window.WH?.worldgen,{},{timeout:240000});
    await page.evaluate(()=>{__qaFramesEnabled=false;WH.step(1);});
    const r=await page.evaluate(async()=>{
      const W=await import(new URL('js/world.js',location.href)),n=WH.nav,p=WH.heartPos.clone();let dry=0,reached=0,lowest=0,hot=0;
      for(let i=0;i<n.n;i++)if(n.baseHeight[i]<-1&&n.waterDepth[i]===0&&n.floorWalk[i]){dry++;if(n.march.floorReach[i])reached++;lowest=Math.min(lowest,n.baseHeight[i]);}
      const lava=WH.world.terrain.geometry.attributes.aLava;
      for(let i=0;i<lava.count;i++)if(lava.getX(i)>.2)hot++;
      const forest=WH.worldgen.landmarks.find(s=>s.type==='forest');
      return {seed:WH.CONFIG.seed,environment:WH.CONFIG.environment,dry,reached,lowest,hot,forestBiome:forest?W.biomeAt(p.set(...forest.dir),forest.height):null,
        landmarks:WH.worldgen.landmarks,decor:WH.world.decor.sets.map(s=>({name:s.mesh.name,count:s.list.length})),certificate:n.terrainCertificate||null};
    });
    check(`${planet}: star/orbit theme displayed and selected`,await page.locator('#worldgen-planet').inputValue()===planet&&(await page.locator('#worldgen-info').innerText()).includes(r.environment.star.name));
    check(`${planet}: play link preserves planet`,new URL(await page.locator('#worldgen-play').getAttribute('href')).searchParams.get('planet')===(planet==='auto'?null:planet));
    check(`${planet}: dry sub-sea floors connect`,!r.dry||r.reached/r.dry>=.95,{dry:r.dry,reached:r.reached,lowest:r.lowest});
    if(planet==='monsoon')check('Monsoon canopy inspection shows a jungle shoulder',r.forestBiome==='jungle',r.forestBiome);
    // An equatorial viewpoint exposes both poles and all latitude belts.
    await page.evaluate(()=>{const p=WH.heartPos.clone().set(.72,0,.69).normalize();WH.worldgen.focus(p,WH.CONFIG.planetRadius*2.8);WH.step(1);});
    await page.locator('#worldgen-panel summary').click();await page.screenshot({path:resolve(out,`globe-${planet}.png`)});await page.locator('#worldgen-panel summary').click();
    for(const type of types){
      const index=r.landmarks.findIndex(s=>s.type===type);if(index<0||seen.has(type)&&planet!=='monsoon')continue;
      await page.locator('#worldgen-formation').selectOption(String(index));await page.evaluate(()=>WH.step(1));
      await page.locator('#worldgen-panel summary').click();await page.screenshot({path:resolve(out,`${planet}-${type}.png`)});await page.locator('#worldgen-panel summary').click();
      seen.add(type);
      if(type==='volcano'){
        const motion=await page.evaluate(()=>{const m=WH.world.terrain.material,t=m.userData.lavaTime.value,a=WH.world.terrain.geometry.attributes.aLava;WH.step(1);return {before:t,after:m.userData.lavaTime.value,same:a===WH.world.terrain.geometry.attributes.aLava};});
        check(`${planet}: lava flows without rebuilding geometry`,r.hot>30&&motion.after>motion.before&&motion.same,{hot:r.hot,...motion});
        await page.locator('#worldgen-panel summary').click();await page.screenshot({path:resolve(out,`${planet}-volcano-flow.png`)});await page.locator('#worldgen-panel summary').click();
      }
    }
    records.push({planet,...r});
    console.log(JSON.stringify({planet,seed:r.seed,lowest:r.lowest,catalog:r.landmarks.map(s=>({type:s.type,height:s.height,depth:s.depth})),hot:r.hot}));
  }
  if(!process.argv.includes('--quick'))for(const type of types)check(`${type}: actual exposed rendered representative`,seen.has(type));
  await page.setViewportSize({width:390,height:844});
  check('Theme controls fit narrow viewport',await page.evaluate(()=>document.body.scrollWidth<=innerWidth&&document.querySelector('#worldgen-planet').getBoundingClientRect().right<=innerWidth));
  await page.locator('#worldgen-planet').selectOption('temperate');
  await page.locator('#worldgen-form button[type=submit]').click();
  await page.waitForFunction(()=>window.WH?.worldgen&&WH.CONFIG.planetKey==='temperate',{},{timeout:240000});
  check('Load seed applies selected theme',new URL(page.url()).searchParams.get('planet')==='temperate');
}finally{
  await browser.close();const result={base,scope:'Controlled visual survey, actual graph dry-floor connectivity, normal theme controls and lava uniform/buffer checks',records,checks,faults,pass:checks.every(c=>c.ok)&&!faults.length};
  writeFileSync(resolve(out,'results.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({pass:result.pass,checks:checks.length,failed:checks.filter(c=>!c.ok),faults}));if(!result.pass)process.exitCode=1;
}
