import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=process.env.WH_BASE_URL||'http://127.0.0.1:8139',out=resolve(process.argv[2]||'artifacts/living-worlds/critical');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(180000);
const ck=(name,ok,detail)=>checks.push({name,ok:!!ok,detail});
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__frames=true;window.requestAnimationFrame=fn=>raf(t=>{if(__frames)fn(t);});});
try{
 await page.goto(base+'/?map=ninetynine&campaign=1&seed=12345');await page.waitForFunction(()=>window.WH?.mode99&&document.querySelector('#boot.done'));await page.locator('#btn-begin').click();
 await page.evaluate(()=>{__frames=false;WH.waves.canRaid=()=>false;WH.step(.05,60,true);document.activeElement.blur();});
 checks.push(...await page.evaluate(async()=>{
  const W=WH,m=W.mode99,a=m.commander,world=await import(new URL('js/world.js',location.href)),T=await import(new URL('lib/three.module.min.js',location.href)),r=[],ck=(name,ok,detail)=>r.push({name,ok:!!ok,detail});
  const home=W.nav.nodeDir(W.nav.heartNode,new T.Vector3());a.dir.copy(home);a.height=world.terrainHeight(...home.toArray());
  for(let i=0;i<8;i++){const before=m.ore.ore;m.oreField.add(home,99);m.oreField.update(.01);ck('One rendered relic grants exactly one ore, including a legacy multi-ore request '+i,m.ore.ore===before+1);if(i===2){ck('First actual forge costs three ore',!!m.craft()&&m.ore.ore===0&&m.ore.cost===5);}}
  ck('Second actual forge costs five ore',!!m.craft()&&m.ore.ore===0&&m.ore.cost===7);const cost=m.ore.cost;ck('Failed forge keeps the next price',!m.craft()&&m.ore.cost===cost);
  let edge=null;
  for(let i=0;i<W.nav.n&&!edge;i++)if(W.nav.height[i]>8&&!W.nav.block[i])for(let e=W.nav.adjOff[i];e<W.nav.adjOff[i+1];e++){
    const j=W.nav.adj[e];if(W.nav.height[i]-W.nav.height[j]>.8&&!Number.isFinite(W.nav.cost[e])){edge=[i,j];break;}
  }
  ck('Fixture finds an actual steep terrain edge',!!edge);
  if(edge){const [i,j]=edge;W.nav.nodeDir(i,a.dir);const goal=W.nav.nodeDir(j,new T.Vector3());a.fwd.copy(goal).addScaledVector(a.dir,-goal.dot(a.dir)).normalize();a.height=world.terrainHeight(...a.dir.toArray());a.hop=0;a.airT=0;a.mountKey='none';a.mountFlying=false;a.mountSpeed=1;a.moveNode=i;
    const start=a.dir.clone(),height=world.surfaceElevation(a.dir,a.height);for(let k=0;k<20;k++)W.allies.driveUnit(a,1,0,1/60);
    ck('Commander steps off a steep edge without a ground-graph wall',start.distanceTo(a.dir)*world.R>.5,{distance:start.distanceTo(a.dir)*world.R,hop:a.hop});
    ck('Dropping preserves height and enters a ballistic fall',a.hop>0&&a.airT>0&&Math.abs(world.surfaceElevation(a.dir,a.height)+a.hop-height)<.2,{before:height,after:world.surfaceElevation(a.dir,a.height)+a.hop,hop:a.hop});
    for(let k=0;k<300&&a.airT>0;k++)W.allies._fall(a,1/60);ck('The drop lands cleanly',a.airT===0&&a.hop===0);
  }
  a.dir.copy(home);a.height=world.terrainHeight(...home.toArray());a.hop=a.airT=0;
  W.waves.prepareNests(1);const nest=W.world.portals.find(p=>p.established&&!p.destroyed);ck('A real nest is available for the quake',!!nest);
  if(nest){window.__quakeNest=nest;const dir=nest.group.position.clone().normalize();m.weather.trigger('quake',dir);while(m.weather.phase==='forecasting')m.weather.advanceShift();m.weather.update(3);ck('Earthquake displays a predicted red surface',m.weather.forecast.group.visible&&m.weather.forecast.mesh.geometry.attributes.position.count>500&&m.weather.forecast.fill.color.r>m.weather.forecast.fill.color.g);window.__forecast=m.weather.forecast.samples.map(s=>({dir:s.dir.toArray(),height:s.height,delta:s.delta}));}
  W.rig.cancelFlight();W.rig.dist=W.rig.targetDist=70;W.step(.01,60,true);return r;
 }));
 await page.screenshot({path:resolve(out,'quake-prediction.png')});
 checks.push(...await page.evaluate(async()=>{
  const W=WH,m=W.mode99,w=await import(new URL('js/world.js',location.href)),r=[],ck=(name,ok,detail)=>r.push({name,ok:!!ok,detail});
  m.weather.update(6);while(m.weather.phase==='shifting')m.weather.advanceShift();const event=m.weather.events.at(-1);
  ck('Disrupted nest is destroyed and removed from spawning',__quakeNest.destroyed&&!__quakeNest.active&&W.waves.destroyedNodes.has(__quakeNest.node),event);
  ck('Forecast is removed after the shift',!m.weather.forecast.group.visible);
  const error=Math.max(...__forecast.map(s=>Math.abs(w.terrainHeight(...s.dir)-(s.height+s.delta))));ck('Forecast matches the committed terrain',error<.02,{maxError:error,strength:event.strength});
  const ore=m.oreField.entries.length;m.weather.update(1);ck('Nest collapse does not pay repeatedly',m.oreField.entries.length===ore);
  W.step(.01,60,true);W.ui.toast('Earthquake warning: leave the highlighted terrain.','danger');return r;
 }));
 await page.screenshot({path:resolve(out,'quake-result.png')});
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.waitForTimeout(220);ck(width+'px: planet badge and alerts do not overlap',await page.evaluate(()=>{const a=document.querySelector('#campaign-status').getBoundingClientRect(),b=document.querySelector('#toast-anchor').getBoundingClientRect();return a.bottom<=b.top+1&&b.right<=innerWidth;}));}
}catch(e){errors.push(String(e));await page.screenshot({path:resolve(out,'error.png')}).catch(()=>{});}finally{
 const report={base,scope:'Targeted actual forge/pickup, physical ledge, nest collapse and HUD fixtures; setup and time are instrumented.',checks,errors};writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok),errors}));await browser.close();if(checks.some(c=>!c.ok)||errors.length)process.exitCode=1;
}
