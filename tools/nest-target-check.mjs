import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/nest-targets'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8139';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],faults=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 await page.goto(`${base}/?map=ninetynine&campaign=0&seed=12345`);await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
 await page.locator('#btn-begin').click();await page.waitForFunction(()=>getComputedStyle(document.getElementById('title-overlay')).opacity==='0');
 checks.push(...await page.evaluate(async()=>{
  __qaFramesEnabled=false;const W=WH,m=W.towers,g=W.game,T=await import(new URL('lib/three.module.min.js',location.href)),records=[],check=(name,ok,actual)=>records.push({name,ok:!!ok,actual});g.paused=true;
  W.waves._startWave();const p=W.world.portals.find(p=>p.established);check('Wave establishes a physical target',p?.group.visible&&p.hp>0,{node:p?.node});
  const up=p.group.position.clone().normalize(),side=new T.Vector3(0,1,0).cross(up).normalize();
  const place=key=>m.place(key,p.group.position.clone().addScaledVector(side,5));
  for(const key of ['bolt','mortar','tesla','helios']){
   p.hp=10000;const t=place(key);let acquired=false;
   for(let f=0;f<600;f++){W.scene.updateMatrixWorld(true);m.update(1/60);acquired ||=t.target?.nest===p;}
   check(`${key}: acquires and damages a living nest through its real attack`,acquired&&p.hp<10000&&t.damageDealt>0,{damage:10000-p.hp,credited:t.damageDealt});
   check(`${key}: nest never receives creature stun state`,p.stunT===undefined);
   m.remove(t);for(const b of [...m.bolts,...m.shells])b.active=false;
  }
  const t=place('bolt');m.update(0);const wrapper=m.targets.find(e=>e.nest===p);
  const enemy=W.enemies.spawn('husk',p.node,1);enemy.dir.copy(p.group.position).addScaledVector(side,2).normalize();enemy.height=p.group.position.length()-240;enemy.progress=1;
  t.target=wrapper;check('Nest wrappers stay stable between target-list updates',t._acquire(m.targets)===wrapper&&m.targets.includes(wrapper));m.update(0);check('Defenders prioritize enemies over nests after the target list refresh',t.target===enemy);
  W.enemies._release(enemy);p.guardianPending=true;m.update(0);check('Guardian-protected nests cannot be targeted or damaged',!m.targets.includes(wrapper)&&m.applyDamage(t,wrapper,100)===0);p.guardianPending=false;
  p.established=false;m.update(0);check('Unestablished nests are excluded',!m.targets.includes(wrapper));p.established=true;m.update(0);
  p.hp=1;const gold=g.gold,dealt=t.damageDealt;check('Lethal tower damage pays one nest reward',m.applyDamage(t,wrapper,100)===1&&g.gold-gold===180&&p.destroyed&&W.waves.destroyedNodes.has(p.node));
  check('Repeated and in-flight hits cannot duplicate nest rewards',m.applyDamage(t,wrapper,100)===0&&g.gold-gold===180&&t.damageDealt-dealt===1&&!wrapper.active);
  m.update(1);check('Destroyed sources disappear from future targets',!m.targets.includes(wrapper)&&t.target===null);
  return records;
 }));
 await page.screenshot({path:resolve(out,'nest-target-fixture.png')});
}catch(e){faults.push(String(e));}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Repositioned tower/target fixtures with real acquisition, projectile simulation, damage and destruction callbacks; not natural siege balance',checks,faults},null,2)+'\n');console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok),faults}));await browser.close();}
if(faults.length||checks.some(c=>!c.ok))process.exitCode=1;
