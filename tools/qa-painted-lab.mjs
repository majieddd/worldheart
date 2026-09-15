// Bounded rendering/input probe. A green result does not certify art direction.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json'));
const {chromium}=require('playwright'),sharp=require('sharp');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8152').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/style-lab/painted/qa');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100}}),checks=[],errors=[],requests=[];
const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name);};
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
const settle=async()=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
const shot=async name=>{await settle();return page.locator('#stage').screenshot({path:resolve(out,name+'.png')});};
const difference=async(a,b)=>{const aa=await sharp(a).removeAlpha().raw().toBuffer(),bb=await sharp(b).removeAlpha().raw().toBuffer();if(aa.length!==bb.length)throw Error('Image dimensions differ');let sum=0;for(let i=0;i<aa.length;i++)sum+=Math.abs(aa[i]-bb[i]);return sum/aa.length;};
const ready=async p=>{await p.waitForFunction(()=>window.PAINTED_LAB?.ready&&!document.querySelector('#loading:not([hidden])'),null,{timeout:60000});};
try{
  if(process.argv.includes('--candidates')){
    await (await import('./probes/hard-cel.mjs')).run({page,browser,base,out,check,shot,settle,difference,sharp,errors,requests});
  }else{
  await page.goto(base+'/painted-lab.html');await ready(page);
  const initial=await page.evaluate(()=>({metrics:PAINTED_LAB.metrics,assets:PAINTED_LAB.assets,storage:JSON.stringify(localStorage)}));
  check('Three textured source models load in one live WebGL scene',initial.metrics.models===3&&initial.metrics.contexts===1&&initial.assets.every(a=>a.textures===1&&a.vertices>25000&&a.sourceDimensions.every(Number.isFinite)),initial);
  check('Layered environment contains curved grass and flowers',initial.metrics.grassBlades>9000&&initial.metrics.flowers>300,initial.metrics);
  check('No campaign simulation is imported',!requests.some(u=>/\/js\/(main|modes\/ninetynine|run\/)/.test(u)));
  const manifest=JSON.parse(readFileSync('lib/painted/provenance.json','utf8'));
  for(const asset of manifest.assets){const response=await page.request.get(base+'/'+asset.path),data=await response.body();check(asset.name+' served bytes match pinned reference',response.ok()&&createHash('sha256').update(data).digest('hex')===asset.sha256,{bytes:data.length,sha256:asset.sha256});}
  const pigmentResponse=await page.request.get(base+'/lib/painted/gouache.png');check('Generated pigment texture serves exact saved bytes',pigmentResponse.ok()&&createHash('sha256').update(await pigmentResponse.body()).digest('hex')==='3cf37ea545196e7358c446183839dee36bbf686de2834e110b4aaa7957fc09c7');
  await page.waitForTimeout(1200);check('Environment animation advances',await page.evaluate(()=>PAINTED_LAB.time>0));await page.locator('#motion').click();await settle();
  const paused=await page.evaluate(()=>({time:PAINTED_LAB.time,frames:PAINTED_LAB.metrics.frames}));await page.waitForTimeout(150);check('Pause freezes animation and idle rendering',await page.evaluate(s=>PAINTED_LAB.time===s.time&&PAINTED_LAB.metrics.frames===s.frames,paused));
  await shot('valley');await page.screenshot({path:resolve(out,'desktop.png'),fullPage:true});
  const contrast=await page.evaluate(()=>{
    const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number),lum=c=>{const a=c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return a[0]*.2126+a[1]*.7152+a[2]*.0722;};
    const bg=e=>{const c=rgb(getComputedStyle(e).backgroundColor);if((c[3]??1)>=.99)return c;const under=e.parentElement?bg(e.parentElement):[255,255,255];return c.slice(0,3).map((v,i)=>v*(c[3]??1)+under[i]*(1-(c[3]??1)));};
    return [...document.querySelectorAll('p,h1,h2,h3,button,a,label,select,.scene-tag,.scene-note,.underbar')].filter(e=>e.offsetParent).map(e=>{const s=getComputedStyle(e),a=lum(rgb(s.color)),b=lum(bg(e)),size=parseFloat(s.fontSize);return {text:e.textContent.trim().slice(0,40),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),required:size>=24||(size>=18.66&&parseInt(s.fontWeight)>=700)?3:4.5};});
  });check('Interface text meets AA contrast',contrast.every(c=>c.ratio>=c.required),contrast);
  for(const view of ['commander','tower','enemy','valley']){await page.locator(`[data-view="${view}"]`).click();await shot(view);check(view+' preset renders finite scene',await page.evaluate(()=>PAINTED_LAB.camera.target.every(Number.isFinite)&&PAINTED_LAB.metrics.triangles>100000));}
  await page.locator('[data-view="commander"]').click();await page.locator('#compare').click();await shot('compare-commander');
  check('Comparison displays two synchronized views',await page.locator('.viewport:visible').count()===2);
  const left=await page.locator('.viewport').nth(0).screenshot(),right=await page.locator('.viewport').nth(1).screenshot();
  // Exclude labels and one-pixel divider; compare the actual scene pixels.
  const lm=await sharp(left).metadata(),rm=await sharp(right).metadata(),crop={left:8,top:64,width:Math.min(lm.width,rm.width)-16,height:Math.min(lm.height,rm.height)-128};
  const delta=await difference(await sharp(left).extract(crop).png().toBuffer(),await sharp(right).extract(crop).png().toBuffer());check('Soft and hard cel produce distinct scene pixels',delta>1,{meanRGBDifference:delta});
  await page.locator('#compare').click();const painted=await shot('commander-painted');await page.locator('#paint').uncheck();const plain=await shot('commander-no-pigment');const paperDelta=await difference(painted,plain);check('Pigment toggle changes rendered surfaces',paperDelta>.2,{meanRGBDifference:paperDelta});
  await page.locator('#ink').uncheck();const noInk=await shot('commander-no-ink');const inkDelta=await difference(plain,noInk);check('Fine contour toggle changes rendered silhouettes',inkDelta>.05,{meanRGBDifference:inkDelta});await page.locator('#ink').check();await page.locator('#paint').check();
  const before=await page.evaluate(()=>PAINTED_LAB.camera),bounds=await page.locator('.viewport:visible').boundingBox();await page.mouse.move(bounds.x+bounds.width*.55,bounds.y+bounds.height*.5);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.55+90,bounds.y+bounds.height*.5+25,{steps:8});await page.mouse.up();check('Pointer drag changes yaw and elevation',await page.evaluate(p=>PAINTED_LAB.camera.yaw!==p.yaw&&PAINTED_LAB.camera.pitch!==p.pitch,before));
  const zoom=await page.evaluate(()=>PAINTED_LAB.camera.distance);await page.mouse.wheel(0,-140);await settle();check('Wheel zoom changes distance',await page.evaluate(d=>PAINTED_LAB.camera.distance<d,zoom));
  await page.locator('.viewport:visible').focus();const yaw=await page.evaluate(()=>PAINTED_LAB.camera.yaw);await page.keyboard.press('ArrowRight');check('Keyboard orbit and visible focus work',await page.evaluate(y=>PAINTED_LAB.camera.yaw>y&&getComputedStyle(document.activeElement).outlineStyle!=='none',yaw));await page.keyboard.press('Home');check('Home restores selected preset',await page.evaluate(()=>PAINTED_LAB.camera.distance===7.4&&PAINTED_LAB.camera.yaw===.36));
  await page.locator('#light').selectOption('overcast');const overcast=await shot('commander-overcast');check('Overcast changes visible lighting',await difference(painted,overcast)>2);
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;await download.saveAs(resolve(out,'export.png'));const exportMeta=await sharp(resolve(out,'export.png')).metadata();check('Save view exports a real scene PNG',exportMeta.width>500&&exportMeta.height>300,{width:exportMeta.width,height:exportMeta.height});
  check('Lab leaves browser saves unchanged',await page.evaluate(s=>JSON.stringify(localStorage)===s,initial.storage));
  await page.locator('#compare').click();
  for(const width of [375,768,1280]){await page.setViewportSize({width,height:960});await settle();const layout=await page.evaluate(()=>({body:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('button,select')].filter(b=>b.offsetParent).map(b=>({text:b.textContent,width:b.clientWidth,scroll:b.scrollWidth,height:b.getBoundingClientRect().height})),views:[...document.querySelectorAll('.viewport')].filter(p=>!p.hidden).map(p=>({w:p.clientWidth,h:p.clientHeight}))}));check('Responsive comparison '+width,layout.body<=width&&layout.controls.every(c=>c.scroll<=c.width+1&&c.height>=44)&&layout.views.every(v=>v.w>300&&v.h>300),layout);await page.screenshot({path:resolve(out,'layout-'+width+'.png'),fullPage:true});}
  await page.setViewportSize({width:1600,height:1100});await page.locator('[data-view="valley"]').click();await page.locator('#light').selectOption('golden');await page.locator('#compare').click();await page.locator('#motion').click();await page.waitForTimeout(1500);
  const timing=await page.evaluate(()=>{const a=PAINTED_LAB.timings.slice(25).sort((a,b)=>a-b);return {samples:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)],metrics:PAINTED_LAB.metrics};});check('Native desktop renders sustained frames',timing.samples>50&&timing.p95<100,timing);
  await page.emulateMedia({reducedMotion:'reduce'});await settle();check('OS reduced motion stops breeze',await page.evaluate(()=>!PAINTED_LAB.state.motion));
  await page.evaluate(()=>{const gl=document.querySelector('#painted-view').getContext('webgl2');window.recovery=gl.getExtension('WEBGL_lose_context');window.recovery.loseContext();});await page.waitForTimeout(100);check('Graphics interruption shows recovery guidance',await page.locator('#loading').isVisible());await page.evaluate(()=>window.recovery.restoreContext());await page.waitForTimeout(500);check('Graphics recovery renders again',await page.evaluate(()=>document.querySelector('#loading').hidden&&PAINTED_LAB.metrics.frames>0));await shot('recovered');
  await page.goto(base+'/painted-lab.html?view=tower&compare=1&light=overcast');await ready(page);check('Shareable link restores model comparison and light',await page.evaluate(()=>PAINTED_LAB.state.view==='tower'&&PAINTED_LAB.state.compare&&PAINTED_LAB.state.light==='overcast'));await shot('compare-tower');
  for(const view of ['commander','tower','enemy','valley']){await page.locator(`[data-view="${view}"]`).click();await settle();}const warm=await page.evaluate(()=>PAINTED_LAB.metrics);for(let i=0;i<3;i++)for(const view of ['commander','tower','enemy','valley']){await page.locator(`[data-view="${view}"]`).click();await settle();}check('Repeated view changes keep GPU allocation stable',await page.evaluate(m=>PAINTED_LAB.metrics.geometries===m.geometries&&PAINTED_LAB.metrics.textures===m.textures,warm),warm);
  const failure=await browser.newPage();await failure.route('**/lib/painted/commander.gltf',r=>r.abort());await failure.goto(base+'/painted-lab.html');await failure.waitForFunction(()=>window.PAINTED_LAB_ERROR);check('Missing model shows a recoverable error and disables export',await failure.locator('#loading').isVisible()&&await failure.locator('#export').isDisabled());await failure.close();
  const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'}),mobile=await touch.newPage();mobile.on('pageerror',e=>errors.push(String(e)));await mobile.goto(base+'/painted-lab.html');await ready(mobile);await mobile.locator('[data-view="enemy"]').tap();check('Touch selects detailed invader view',await mobile.evaluate(()=>PAINTED_LAB.state.view==='enemy'));await mobile.locator('.viewport:visible').scrollIntoViewIfNeeded();const touchBefore=await mobile.evaluate(()=>PAINTED_LAB.camera.yaw),rect=await mobile.locator('.viewport:visible').boundingBox(),cdp=await touch.newCDPSession(mobile),x=rect.x+rect.width*.4,y=Math.max(100,Math.min(650,rect.y+200));await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+70,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});check('Real touch swipe orbits the scene',await mobile.evaluate(n=>PAINTED_LAB.camera.yaw!==n,touchBefore));await mobile.screenshot({path:resolve(out,'touch-enemy.png'),fullPage:true});await touch.close();
  check('No runtime or shader errors',errors.length===0,errors);
  }
}catch(error){errors.push(String(error));check('Harness completed',false,String(error));}
finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({base,checks,errors},null,2)+'\n');await browser.close();}
console.log(`${checks.filter(c=>c.ok).length}/${checks.length} painted lab checks pass`);if(checks.some(c=>!c.ok)||errors.length)process.exitCode=1;
