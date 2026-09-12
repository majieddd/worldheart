import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/extreme-worlds/debug'),base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,'');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],faults=[];
const check=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
await page.addInitScript(()=>{window.__storageCalls=[];for(const name of ['getItem','setItem','removeItem']){const old=Storage.prototype[name];Storage.prototype[name]=function(...args){__storageCalls.push([name,...args]);return old.apply(this,args);};}});
try{
 const start=Date.now();await page.goto(`${base}/debug.html`);await page.waitForFunction(()=>window.DEBUG_WORLD,{},{timeout:120000});
 const counts=await page.evaluate(()=>DEBUG_WORLD.lanes.map(l=>({key:l.key,n:l.items.length})));
 check('all eight registries are represented',JSON.stringify(counts.map(l=>l.n))===JSON.stringify([11,3,18,14,30,4,15,10]),counts);
 check('debug route never reads or mutates browser saves',await page.evaluate(()=>__storageCalls.length===0),await page.evaluate(()=>__storageCalls));
 check('bounded exhibit startup',Date.now()-start<15000,{ms:Date.now()-start});
 const entries=await page.evaluate(()=>DEBUG_WORLD.exhibits.map(e=>({key:e.key,lane:e.lane,name:e.name})));
 for(const e of entries){
   await page.locator(`[data-lane="${e.lane}"]`).click();await page.locator('#exhibit').selectOption(e.key);
   const result=await page.evaluate(()=>{const e=DEBUG_WORLD.selected;let vertices=0,bad=0;e.group.updateMatrixWorld(true);e.group.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;vertices+=p.count;for(const x of p.array)if(!Number.isFinite(x))bad++;for(const x of o.matrixWorld.elements)if(!Number.isFinite(x))bad++;}});return {vertices,bad,key:e.key};});
   check(`${e.lane}/${e.key}: selectable finite rendered model`,result.key===e.key&&result.vertices>0&&!result.bad,result);
   await page.waitForTimeout(35);
   if(['formations','terrain','mounts','biomes','themes'].includes(e.lane)||['commander','colossus','carbine-technological','lobber-ancient','native-oracle','bolt-0','helios-2'].includes(e.key))await page.screenshot({path:resolve(out,`${e.lane}-${e.key}.png`)});
 }
 await page.locator('[data-lane="units"]').click();await page.locator('#exhibit').selectOption('commander');
 for(const motion of ['idle','walk','attack']){
   await page.locator('#motion').selectOption(motion);
   const a=await page.evaluate(()=>DEBUG_WORLD.selected.group.children[0].matrix.toArray());await page.waitForTimeout(220);
   const b=await page.evaluate(()=>DEBUG_WORLD.selected.group.children[0].matrix.toArray());check(`${motion}: real rig changes pose`,JSON.stringify(a)!==JSON.stringify(b));
 }
 await page.locator('[data-lane="weapons"]').click();await page.locator('#exhibit').selectOption('carbine-technological');await page.locator('#core').selectOption('ember');
 check('energy core changes actual weapon material',await page.evaluate(()=>{let match=false;DEBUG_WORLD.selected.group.traverse(o=>{if(o.userData.energy&&o.material.color.getHex()===0xff794d)match=true;});return match;}));
 await page.locator('#exhibit').selectOption('sword-ancient');
 check('core selector follows the selected weapon',await page.locator('#core').inputValue()==='tempered');
 await page.locator('#core').selectOption('pulse');
 check('incompatible core restores the actual selection',await page.locator('#core').inputValue()==='tempered');
 await page.locator('#exhibit').selectOption('carbine-technological');
 check('returning to a weapon retains its core',await page.locator('#core').inputValue()==='ember');
 const original=await page.evaluate(()=>JSON.stringify(DEBUG_WORLD.target.toArray()));await page.locator('#viewport').focus();await page.keyboard.press('ArrowRight');
 check('keyboard pans the scene',await page.evaluate(()=>JSON.stringify(DEBUG_WORLD.target.toArray()))!==original);
 const yaw=await page.evaluate(()=>DEBUG_WORLD.view.yaw);await page.mouse.move(800,360);await page.mouse.down();await page.mouse.move(920,380,{steps:8});await page.mouse.up();
 check('pointer drag rotates camera',await page.evaluate(()=>DEBUG_WORLD.view.yaw)!==yaw);
 const distance=await page.evaluate(()=>DEBUG_WORLD.view.distance);await page.mouse.wheel(0,300);await page.waitForTimeout(70);check('wheel zoom changes distance',await page.evaluate(()=>DEBUG_WORLD.view.distance)>distance);
 await page.locator('#overview').click();await page.waitForTimeout(80);await page.screenshot({path:resolve(out,'all-lanes.png')});
 check('overview names all lanes',await page.locator('.lane-title:visible').count()===8);
 await page.locator('[data-lane="themes"]').click();await page.locator('#exhibit').selectOption('fungal');
 check('theme opens the matching real planet',new URL(await page.locator('#description a').getAttribute('href'),base).searchParams.get('planet')==='fungal');
 await page.locator('[data-lane="units"]').click();await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#motion').selectOption('walk');const t=await page.evaluate(()=>DEBUG_WORLD.time);await page.waitForTimeout(200);
 check('reduced motion holds the scene still',await page.evaluate(()=>DEBUG_WORLD.time)===t);
 for(const width of [375,768,1280]){
   await page.setViewportSize({width,height:900});await page.waitForTimeout(80);
   const d=await page.evaluate(()=>({overflow:document.body.scrollWidth>innerWidth,nav:document.querySelector('nav').getBoundingClientRect().height,canvas:document.querySelector('#viewport').getBoundingClientRect().height,buttons:[...document.querySelectorAll('button')].filter(b=>b.scrollHeight>b.clientHeight+1).map(b=>b.textContent)}));
   check(`${width}px: usable layout without horizontal overflow`,!d.overflow&&d.nav<=80&&d.canvas>=180&&!d.buttons.length,d);
   await page.screenshot({path:resolve(out,`layout-${width}.png`)});
 }
 const contrast=await page.evaluate(()=>{
   const lum=rgb=>{const c=rgb.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
   const issues=[];for(const e of document.querySelectorAll('aside p,aside label,h1,h2,a,button,select,dt,dd')){const s=getComputedStyle(e);let n=e,bg;while(n){bg=getComputedStyle(n).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)')break;n=n.parentElement;}const rgb=x=>x.match(/[\d.]+/g).slice(0,3).map(Number),a=lum(rgb(s.color)),b=lum(rgb(bg||'rgb(16,27,41)')),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);if(ratio<4.5)issues.push({text:e.textContent.slice(0,30),ratio});}return issues;
 });check('computed UI text contrast passes AA',contrast.length===0,contrast);
 check('no runtime faults',faults.length===0,faults);
}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,faults},null,2));await browser.close();}
console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok)}));if(checks.some(c=>!c.ok))process.exitCode=1;
