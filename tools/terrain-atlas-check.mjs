// Actual inspection UI, cooperative global survey and rendered dots. No combat
// or campaign state is fabricated. Synthetic topology cases live in tests.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/terrain-atlas/ui');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],faults=[];
const check=(name,ok,actual)=>{checks.push({name,ok,actual});console.log(JSON.stringify({name,ok,actual}));};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>faults.push(String(e)));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 await page.goto(`${base}/?map=ninetynine&campaign=0&seed=12345&terrain=varied&worldgen=1`);
 await page.waitForFunction(()=>window.WH?.worldgen,{},{timeout:180000});
 const before=await page.evaluate(()=>({n:WH.nav.n,revision:WH.nav.revision,seed:WH.CONFIG.seed,wave:WH.waves.wave,next:Array.from(WH.nav.march.next).reduce((a,b)=>a+b,0)}));
 await page.locator('#worldgen-paths').check();await page.locator('#worldgen-paths').uncheck();
 check('Unchecking during construction hides the whole overlay',await page.evaluate(()=>!WH.worldgen.paths.visible));
 const stats=await page.evaluate(()=>WH.worldgen.atlasReady);
 check('Bounded global graph surveys every hemisphere',stats?.nodes===40962&&stats.potential>1000,stats);
 check('Survey finishes without silently reviving a hidden overlay',await page.evaluate(()=>!WH.worldgen.paths.visible));
 const after=await page.evaluate(()=>({n:WH.nav.n,revision:WH.nav.revision,seed:WH.CONFIG.seed,wave:WH.waves.wave,next:Array.from(WH.nav.march.next).reduce((a,b)=>a+b,0)}));
 check('Survey leaves the authoritative game graph and waves unchanged',JSON.stringify(before)===JSON.stringify(after),{before,after});
 const audit=await page.evaluate(async()=>{
  const {availableNestSites}=await import(new URL('js/nest-sites.js',location.href)),v=WH.worldgen.routeView,a=v.atlas;
  const exact=[...availableNestSites(WH.nav,WH.nav.fieldCenter,WH.heartPos.clone())],octants=new Set();let beyond=0,validEdges=true;
  for(let i=0;i<a.verts.length;i++){
   const p=a.verts[i];if(a.habitat[i]){octants.add(p.map(n=>n>=0?1:0).join(''));if(p.reduce((s,n,k)=>s+n*WH.nav.fieldCenter.getComponent(k),0)<Math.cos(WH.CONFIG.map.fieldTheta))beyond++;}
   if(a.routes[i]&&(!(a.next[i]>=0)||!(a.distance[i]>a.distance[a.next[i]])))validEdges=false;
  }
  return {exactEqual:JSON.stringify(exact)===JSON.stringify(v.exactNodes),octants:[...octants],beyond,validEdges};
 });
 check('Every legal battlefield clearing is included',audit.exactEqual,audit);
 check('Potential habitat extends beyond the cap into all eight globe octants',audit.beyond>500&&audit.octants.length===8,audit);
 check('Global routes make strictly decreasing progress without loops',audit.validEdges);
 check('Legend distinguishes legal battlefield sites from coarse global habitat',/individually valid battlefield/.test(await page.locator('#worldgen-atlas').textContent())&&/coarse terrain survey/.test(await page.locator('#worldgen-atlas').textContent()));
 await page.locator('#worldgen-paths').check();await page.evaluate(()=>{__qaFramesEnabled=false;WH.step(1);});
 const frozen=await page.evaluate(()=>{const v=WH.worldgen.routeView;return {phase:v.material.uniforms.phase.value,ids:v.group.children.map(c=>[c.geometry.uuid,c.geometry.attributes.position.version])};});
 await page.locator('#worldgen-home').click();await page.evaluate(()=>WH.step(1));await page.locator('#worldgen-panel summary').click();
 await page.screenshot({path:resolve(out,'battlefield-dotted-routes.png')});
 await page.evaluate(()=>WH.step(.21));
 const advanced=await page.evaluate(()=>{const v=WH.worldgen.routeView;return {phase:v.material.uniforms.phase.value,ids:v.group.children.map(c=>[c.geometry.uuid,c.geometry.attributes.position.version])};});
 check('Dots move while inspector simulation remains paused',frozen.phase!==advanced.phase&&await page.evaluate(()=>WH.game.paused&&WH.waves.wave===0));
 check('Animation reuses every position buffer',JSON.stringify(frozen.ids)===JSON.stringify(advanced.ids));
 await page.screenshot({path:resolve(out,'battlefield-dots-advanced.png')});
 await page.locator('#worldgen-panel summary').click();await page.locator('#worldgen-globe').click();await page.evaluate(()=>WH.step(1));await page.locator('#worldgen-panel summary').click();
 await page.screenshot({path:resolve(out,'whole-planet-atlas.png')});
 await page.evaluate(()=>{const r=WH.rig;r.lon+=Math.PI;r.lat=-r.lat;r._placeCamera();WH.step(0);});await page.screenshot({path:resolve(out,'opposite-hemisphere-atlas.png')});
 check('Geometry and camera remain finite over the opposite hemisphere',await page.evaluate(()=>WH.rig.camera.matrixWorld.elements.every(Number.isFinite)&&WH.worldgen.routeView.group.children.every(c=>c.geometry.attributes.position.array.every(Number.isFinite))));
 const reduced=await browser.newPage({reducedMotion:'reduce'});reduced.on('pageerror',e=>faults.push(String(e)));
 await reduced.goto(`${base}/?map=ninetynine&campaign=0&seed=12345&terrain=varied&worldgen=1`);await reduced.waitForFunction(()=>window.WH?.worldgen,{},{timeout:180000});
 await reduced.locator('#worldgen-paths').check();
 check('Reduced motion keeps path dots static',await reduced.evaluate(()=>{const m=WH.worldgen.routeView.material,v=m.uniforms.phase.value;WH.step(.2);return v===m.uniforms.phase.value;}));await reduced.close();
 await page.close();
}catch(e){faults.push(String(e));console.error(e);}
finally{await browser.close();writeFileSync(resolve(out,'results.json'),JSON.stringify({base,scope:'Normal inspector interaction and controlled render-frame progression, not combat',checks,faults,pass:checks.every(c=>c.ok)&&!faults.length},null,2)+'\n');if(checks.some(c=>!c.ok)||faults.length)process.exitCode=1;}
