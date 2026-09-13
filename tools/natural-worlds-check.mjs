import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright'),out=resolve(process.argv[2]||'artifacts/natural-worlds/native'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8139';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],faults=[];page.on('pageerror',e=>faults.push(String(e)));page.setDefaultNavigationTimeout(180000);
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__frames=true;window.requestAnimationFrame=fn=>raf(t=>{if(__frames)fn(t);});});
try{
 await page.goto(base+'/?map=ninetynine&campaign=0&planet=temperate&terrain=varied&seed=771');await page.waitForFunction(()=>window.WH?.mode99&&document.querySelector('#boot.done'),{},{timeout:180000});await page.locator('#btn-begin').click();if(await page.locator('#draft-cards button:visible').count())await page.locator('#draft-cards button').first().click();
 checks.push(...await page.evaluate(async()=>{
  __frames=false;const W=WH,nav=W.nav,w=await import(new URL('js/world.js',location.href)),T=await import(new URL('lib/three.module.min.js',location.href)),r=await import(new URL('js/run/environment-catalogue.js',location.href)),checks=[],ck=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
  const banks=[];for(let i=nav.baseCount;i<nav.n;i++)for(let e=nav.adjOff[i];e<nav.adjOff[i+1];e++){const b=nav.adj[e];if(b<nav.baseCount&&Number.isFinite(nav.cost[e]))banks.push({i,b,dir:nav.nodeDir(b,new T.Vector3()).normalize()});}
  let fixture=null;for(const s of w.FEATURES.surfaces.filter(s=>['glacial-bridge','cave-roof','cavern-vault','stone-arch'].includes(s.key))){
   const near=banks.filter(b=>b.dir.dot(new T.Vector3(...s.dir))>Math.cos((s.halfV+3)/w.R)).map(b=>({...b,p:w.FORMATIONS.coordinates(s.m,b.dir.toArray())}));
   const a=near.find(b=>b.p.v<0),b=near.find(b=>b.p.v>0);if(!a||!b)continue;const path=nav.findPath(a.dir,b.dir);if(path.filter(i=>nav.layer[i]).length<6)continue;fixture={s,a,b,path};break;
  }
  ck('Native generated planet has a bank-to-bank upper route',!!fixture,fixture&&{key:fixture.s.key,path:fixture.path.length,upper:fixture.path.filter(i=>nav.layer[i]).length});
  if(fixture){
   const {s,a,b}=fixture,body=W.allies.spawn('warden',a.dir,a.dir,200);body.fwd.copy(b.dir).addScaledVector(body.dir,-b.dir.dot(body.dir)).normalize();body.height=nav.height[a.b];const ordered=W.allies.orderMove(body,b.dir,nav.height[b.b]);let maxClearance=0,minClearance=Infinity,frames=0;
   for(;frames<18000&&body.dir.angleTo(b.dir)*w.R>.4;frames++){W.allies.time+=1/60;W.allies._moveToward(body,b.dir,body.type.speed/60);W.allies._ground(body);const clearance=body.height-w.terrainHeight(...body.dir.toArray());maxClearance=Math.max(maxClearance,clearance);minClearance=Math.min(minClearance,clearance);}
   ck('Native ally follows its ordered bridge surface',ordered&&body.dir.angleTo(b.dir)*w.R<.5&&maxClearance>2,{frames,distance:body.dir.angleTo(b.dir)*w.R,maxClearance,minClearance});
   const heart=nav.heartNode;nav.heartNode=b.b;nav.recomputeFlow();const enemy=W.enemies.spawn('husk',a.b,1);let progressed=0,peak=0;const start=enemy.dir.angleTo(b.dir)*w.R;
   for(let k=0;k<18000&&enemy.active;k++){W.enemies.update(1/60);peak=Math.max(peak,enemy.height-w.terrainHeight(...enemy.dir.toArray()));progressed=Math.max(progressed,start-enemy.dir.angleTo(b.dir)*w.R);if(enemy.dir.angleTo(b.dir)*w.R<1.3)break;}
   ck('Native enemy walks the upper bridge without selecting the floor below',progressed>start*.8&&peak>2,{start,progressed,peak,active:enemy.active,node:enemy.node});
   nav.heartNode=heart;nav.recomputeFlow();
   const d=new T.Vector3(...s.dir),target=d.clone().multiplyScalar(w.R+s.top(0,0)),camera=W.rig.camera,axis=new T.Vector3(...s.m.axis);camera.position.copy(target).addScaledVector(axis,65).addScaledVector(d,28);camera.up.copy(d);camera.lookAt(target.clone().addScaledVector(d,-3));camera.updateProjectionMatrix();camera.updateMatrixWorld();W.allies._render(.01);W.enemies._render(.01);W.post.render(W.scene,camera,.01);
  }
  window.__natural={W,w,T,r,checks};return checks;
 }));await page.screenshot({path:resolve(out,'bridge-native.png')});
 checks.push(...await page.evaluate(()=>{
  const {W,w,T,r}=__natural,weather=W.mode99.weather,checks=[],ck=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});weather.phase='calm';weather.environment={...W.CONFIG.environment,tags:['airless']};weather.nextEvent=Infinity;
  weather.trigger('solar',W.heartPos.clone().normalize());const scale=weather.hostility.scale,target=r.disasterTargets('solar',0,scale)[0],side=new T.Vector3().crossVectors(weather.axis,weather.dir).normalize(),dir=weather.dir.clone().addScaledVector(weather.axis,target.u/w.R).addScaledVector(side,target.v/w.R).normalize();
  const pos=dir.clone().multiplyScalar(w.R+w.surfaceElevation(dir)),towers=['bolt','mortar','cryo','tesla','helios','warden'].map(key=>W.towers.place(key,pos));
  const outside=W.towers.place('bolt',dir.clone().addScaledVector(side,65/w.R).normalize().multiplyScalar(w.R+1));weather.update(8);weather.update(.1);
  ck('Radiation hits only local towers',towers.every(t=>t.empRemaining===8)&&outside.empRemaining===0,{remaining:towers.map(t=>t.empRemaining),outside:outside.empRemaining,hits:weather.effectCounts.emp});
  const enemy=W.enemies.spawn('husk',W.nav.heartNode,1);enemy.dir.copy(dir).addScaledVector(side,3/w.R).normalize();enemy.height=w.terrainHeight(...enemy.dir.toArray());enemy.hp=enemy.hpMax=100000;
  for(const t of towers){const shots=t.shotCount,charge=t.charge,oldCooldown=t.cooldown;for(let k=0;k<70;k++)t.update(.1,[enemy],W.fx);ck(t.typeKey+': EMP prevents firing, charging and summoning',t.shotCount===shots&&t.charge===charge&&t.cooldown===oldCooldown&&t.empRing.visible,{remaining:t.empRemaining,shots:t.shotCount});for(let k=0;k<12;k++)t.update(.1,[enemy],W.fx);ck(t.typeKey+': power and normal updates resume',t.empRemaining===0&&!t.empRing.visible&&t.cooldown<oldCooldown||t.empRemaining===0&&!t.empRing.visible&&t.shotCount>shots,{remaining:t.empRemaining,shots:t.shotCount,cooldown:t.cooldown});}
  weather.eventTime=.08;weather.hazardArt.userData.update(.08);const camera=W.rig.camera;camera.position.copy(pos).addScaledVector(side,52).addScaledVector(dir,33);camera.up.copy(dir);camera.lookAt(pos.clone().addScaledVector(dir,10));camera.updateProjectionMatrix();camera.updateMatrixWorld();W.enemies._render(.01);W.post.render(W.scene,camera,.01);
  ck('Removed disasters cannot be scheduled or triggered',!r.DISASTERS.ashfall&&!r.DISASTERS.cryoburst&&!r.compatibleDisasters(weather.environment).includes('ashfall'));
  return checks;
 }));await page.screenshot({path:resolve(out,'radiation-native.png')});
 checks.push({name:'No runtime faults',ok:!faults.length,actual:faults});
}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,faults},null,2));await browser.close();}
console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok)}));if(checks.some(c=>!c.ok))process.exitCode=1;

