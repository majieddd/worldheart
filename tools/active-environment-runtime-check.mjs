import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright'),out=resolve(process.argv[2]||'artifacts/active-worlds/environment-runtime'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8139';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],faults=[];page.on('pageerror',e=>faults.push(String(e)));
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__frames=true;window.requestAnimationFrame=fn=>raf(t=>{if(__frames)fn(t);});});
try{
 await page.goto(base+'/?map=ninetynine&campaign=0&planet=temperate&terrain=varied&seed=4206018157');await page.waitForFunction(()=>window.WH?.mode99&&document.querySelector('#boot.done'),{},{timeout:180000});await page.locator('#btn-begin').click();if(await page.locator('#draft-cards button:visible').count())await page.locator('#draft-cards button').first().click();
 checks.push(...await page.evaluate(async()=>{
  __frames=false;const W=WH,w=await import(new URL('js/world.js',location.href)),r=await import(new URL('js/run/environment-catalogue.js',location.href)),T=await import(new URL('lib/three.module.min.js',location.href)),m=W.mode99,a=m.commander,e=W.enemies.spawn('husk',W.nav.heartNode,1),checks=[],ck=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
  const natural=w.FEATURES.active.slice();ck('Every naturally placed feature satisfies its actual biome, formation, water and slope',natural.length>0&&natural.every(s=>r.featureFits(s.key,s.context)),{count:natural.length,kinds:[...new Set(natural.map(s=>s.key))]});
  ck('Natural feature placement reaches both hemispheres',natural.some(s=>s.dir.y<-.15)&&natural.some(s=>s.dir.y>.15));
  let volcanic=0,stray=0;for(let i=0;i<W.nav.n;i+=37){const d=W.nav.nodeDir(i,new T.Vector3()),h=w.terrainHeight(...d.toArray(),false);if(w.biomeAt(d,h)==='volcanic'){volcanic++;if(!w.FORMATIONS.volcanic(...d.toArray()))stray++;}}
  ck('Garden-world volcanic ecology follows actual volcanic geology',volcanic>0&&!stray,{volcanic,stray});
  const reset=dir=>{for(const unit of [a,e]){unit.active=true;unit.dead=false;unit.dir.copy(dir);unit.height=w.terrainHeight(...dir.toArray(),false);unit.hpMax=unit.hp=10000;unit.hop=unit.mountFlight=unit.weatherLift=unit.geyserLift=unit.geyserVelocity=unit.vertVel=unit.airT=0;unit.geyserStamp='';unit.weatherSpeed=unit.environmentSpeed=1;unit.slowFrac=unit.slowT=0;}};
  for(const [key,f]of Object.entries(r.ACTIVE_FEATURES)){
   if(key==='trunks')continue;reset(W.heartPos.clone().normalize());a.hp=e.hp=5000;
   const site={id:900,key,m:w.FORMATIONS.modules[0],dir:a.dir.clone(),height:a.height,radius:f.radius,phase:0};w.FEATURES.active.splice(0,w.FEATURES.active.length,site);m.geysers.time=0;m.geysers.update(.1);
   const changed=f.damage?a.hp<5000&&e.hp<5000:f.heal?a.hp>5000&&e.hp>5000:f.lift?a.vertVel>0&&e.geyserVelocity>0:f.slow<1?a.environmentSpeed<1&&e.slowFrac>0:false;
   ck(key+': production effect reaches both real teams',changed,{ally:a.hp,enemy:e.hp,lift:a.vertVel,enemyLift:e.geyserVelocity,slow:a.environmentSpeed});
  }
  w.FEATURES.active.splice(0,w.FEATURES.active.length,...natural);
  const weather=m.weather;weather.environment={...W.CONFIG.environment,tags:['rock','ice','airless','cloud','atmosphere','wet','ocean','dry','volcanic']};weather.nextEvent=Infinity;
  window.__environmentFixture={W,w,r,T,m,a,e,weather,reset,checks};return checks;
 }));
 for(const key of ['meteor','thunder','hail','blizzard','sandstorm','ashfall','tsunami','solar','cryoburst','eruption']){
  const result=await page.evaluate(key=>{
   const {W,w,r,T,a,e,weather,reset}=__environmentFixture;weather.phase='calm';weather.kind=null;weather.nextEvent=Infinity;
   const started=weather.trigger(key,W.heartPos.clone().normalize());if(!started)return {name:key+': compatible location exists',ok:false};
   const scale=weather.hostility.scale,f=r.DISASTERS[key],time=key==='tsunami'?8:key==='sandstorm'?1:.1;
   const p=['meteor','thunder','eruption'].includes(key)?r.disasterTargets(key,time,scale)[0]:{u:0,v:0};
   const side=new T.Vector3().crossVectors(weather.axis,weather.dir).normalize(),dir=weather.dir.clone().addScaledVector(weather.axis,p.u/w.R).addScaledVector(side,p.v/w.R).normalize();reset(dir);
   const warning=weather.phase==='warning'&&weather.hazardArt.visible;weather.update(8);weather.eventTime=time-.1;weather.update(.1);
   const changed=f.damage?a.hp<10000&&e.hp<10000:f.slow<1?a.weatherSpeed<1:true;
   const target=dir.clone().multiplyScalar(w.R+w.surfaceElevation(dir)),camera=W.rig.camera;camera.position.copy(target).addScaledVector(weather.axis,70).addScaledVector(dir,45);camera.up.copy(dir);camera.lookAt(target.clone().addScaledVector(dir,8));camera.updateProjectionMatrix();camera.updateMatrixWorld();W.allies._render(.01);W.enemies._render(.01);W.post.render(W.scene,camera,.01);
   return {name:key+': warned effect damages/slows real actors in its footprint',ok:warning&&changed,actual:{warning,ally:a.hp,enemy:e.hp,time,height:a.height,scale,count:weather.effectCounts[key]||0}};
  },key);checks.push(result);await page.screenshot({path:resolve(out,key+'.png')});
 }
 checks.push({name:'No runtime faults',ok:!faults.length,actual:faults});
}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,faults},null,2));await browser.close();}
console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failures:checks.filter(c=>!c.ok)}));if(checks.some(c=>!c.ok))process.exitCode=1;
