import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json'));
const {chromium}=require('playwright'),sharp=require('sharp');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8152').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/style-lab/qa');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100}}),checks=[],errors=[],requests=[];
const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name);};
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
const settle=async()=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
const shot=async name=>{await settle();return page.locator('#stage').screenshot({path:resolve(out,name+'.png')});};
const pixels=async buffer=>sharp(buffer).removeAlpha().raw().toBuffer({resolveWithObject:true});
const difference=async(a,b)=>{const aa=await pixels(a),bb=await pixels(b);if(aa.data.length!==bb.data.length)return Infinity;let sum=0;for(let i=0;i<aa.data.length;i++)sum+=Math.abs(aa.data[i]-bb.data[i]);return sum/aa.data.length;};
const ready=async()=>{await page.waitForFunction(()=>window.STYLE_LAB?.metrics.frames>1&&!document.querySelector('#loading:not([hidden])'),null,{timeout:30000});};
try{
  await page.goto(base+'/style-lab.html');await ready();
  const initial=await page.evaluate(()=>({metrics:STYLE_LAB.metrics,storage:JSON.stringify(localStorage),geometry:STYLE_LAB.camera}));
  check('Live 3D boots with three scouts, three towers and one context',initial.metrics.unitCount===3&&initial.metrics.towerCount===3&&initial.metrics.contexts===1,initial.metrics);
  check('Independent entry does not load campaign simulation',!requests.some(u=>/\/js\/(main|modes\/ninetynine|run\/)/.test(u)));
  await page.waitForTimeout(1500);const movingTime=await page.evaluate(()=>STYLE_LAB.time);
  check('Animation advances',movingTime>0);
  await page.locator('#motion').click();const paused=await page.evaluate(()=>STYLE_LAB.time);await page.waitForTimeout(150);
  check('Pause freezes the shared animation phase',await page.evaluate(t=>STYLE_LAB.time===t,paused));
  const full=await shot('compare-world');
  await page.screenshot({path:resolve(out,'page-desktop.png'),fullPage:true});
  const contrast=await page.evaluate(()=>{
    const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number),lum=c=>{const a=c.slice(0,3).map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;});return a[0]*0.2126+a[1]*0.7152+a[2]*0.0722;};
    const bg=e=>{const c=rgb(getComputedStyle(e).backgroundColor);if((c[3]??1)>=0.99)return c;const under=e.parentElement?bg(e.parentElement):[255,255,255];return c.slice(0,3).map((v,i)=>v*(c[3]??1)+under[i]*(1-(c[3]??1)));};
    const ratio=(a,b)=>(Math.max(lum(a),lum(b))+0.05)/(Math.min(lum(a),lum(b))+0.05);
    return [...document.querySelectorAll('p,h1,h2,h3,dt,dd,button,a,label,.view-title>span,.view-caption,.edition,#gesture-hint,#render-status')].filter(e=>e.offsetParent).map(e=>{const s=getComputedStyle(e),r=ratio(rgb(s.color),bg(e)),size=parseFloat(s.fontSize);return {text:e.textContent.trim().slice(0,48),ratio:r,required:size>=24||(size>=18.66&&parseInt(s.fontWeight)>=700)?3:4.5};});
  });
  check('Rendered interface text meets AA contrast',contrast.every(c=>c.ratio>=c.required),contrast);
  const samples=[];
  for(const id of ['anime','ink','hybrid']){
    await page.locator(`[data-focus="${id}"]`).click();
    check(id+' focus displays exactly one viewport',await page.locator('.viewport:visible').count()===1);
    for(const view of ['world','ground','materials']){await page.locator(`[data-view="${view}"]`).click();const b=await shot(id+'-'+view);if(view==='ground')samples.push(b);check(id+' '+view+' renders finite camera and scene',await page.evaluate(()=>Number.isFinite(STYLE_LAB.camera.distance)&&STYLE_LAB.metrics.triangles>100));}
    await page.locator('#compare').click();
  }
  check('All styles produce different rendered ground scenes',(await difference(samples[0],samples[1]))>5&&(await difference(samples[1],samples[2]))>5,{animeInk:await difference(samples[0],samples[1]),inkHybrid:await difference(samples[1],samples[2])});
  await page.locator('[data-view="ground"]').click();await page.locator('[data-focus="hybrid"]').click();
  const textured=await shot('hybrid-detail');await page.locator('#textures').uncheck();const plain=await shot('hybrid-without-texture');
  const textureDelta=await difference(textured,plain);check('Texture toggle changes rendered surfaces',textureDelta>0.15,{meanRGBDifference:textureDelta});
  await page.locator('#outlines').uncheck();const bare=await shot('hybrid-without-ink');const inkDelta=await difference(plain,bare);check('Ink toggle changes silhouettes and seams',inkDelta>0.1,{meanRGBDifference:inkDelta});
  await page.locator('#textures').check();await page.locator('#outlines').check();
  const prior=await page.evaluate(()=>STYLE_LAB.camera);const area=await page.locator('.viewport:visible').boundingBox();
  await page.mouse.move(area.x+area.width*.55,area.y+area.height*.6);await page.mouse.down();await page.mouse.move(area.x+area.width*.55+90,area.y+area.height*.6+35,{steps:8});await page.mouse.up();
  check('Real pointer drag changes yaw and elevation',await page.evaluate(p=>STYLE_LAB.camera.yaw!==p.yaw&&STYLE_LAB.camera.pitch!==p.pitch,prior));
  const beforeZoom=await page.evaluate(()=>STYLE_LAB.camera.distance);await page.mouse.wheel(0,-150);await settle();check('Wheel zoom changes camera distance',await page.evaluate(d=>STYLE_LAB.camera.distance<d,beforeZoom));
  await page.locator('.viewport:visible').focus();const beforeKey=await page.evaluate(()=>STYLE_LAB.camera.yaw);await page.keyboard.press('ArrowRight');check('Keyboard orbit works with visible focus',await page.evaluate(y=>STYLE_LAB.camera.yaw>y&&getComputedStyle(document.activeElement).outlineStyle!=='none',beforeKey));
  await page.locator('#reset').click();check('Reset restores view camera',await page.evaluate(()=>Math.abs(STYLE_LAB.camera.yaw-0.05)<1e-9&&STYLE_LAB.camera.distance===18));
  await page.locator('#lighting').selectOption('day');const day=await shot('hybrid-daylight');check('Daylight changes the rendered scene',await difference(textured,day)>5);
  await page.locator('#compare').click();await shot('compare-daylight');await page.locator('[data-view="materials"]').click();await shot('materials-daylight');
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;await download.saveAs(resolve(out,'export.png'));
  const exportMeta=await sharp(resolve(out,'export.png')).metadata();check('Save view downloads a real PNG',exportMeta.width>500&&exportMeta.height>300,exportMeta);
  check('Lab leaves existing browser storage unchanged',await page.evaluate(s=>JSON.stringify(localStorage)===s,initial.storage));
  for(const width of [375,768,1280]){
    await page.setViewportSize({width,height:960});await settle();
    const layout=await page.evaluate(()=>({width:innerWidth,body:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('button:not([hidden])')].filter(b=>b.offsetParent&&b.scrollWidth>b.clientWidth+1).map(b=>b.textContent),viewports:[...document.querySelectorAll('.viewport:not([hidden])')].map(p=>({width:p.clientWidth,height:p.clientHeight})),nav:document.querySelector('.masthead').getBoundingClientRect().height}));
    check('Responsive layout '+width,layout.body<=width&&layout.buttons.length===0&&layout.nav<=80,layout);
    await page.screenshot({path:resolve(out,'layout-'+width+'.png'),fullPage:true});
  }
  await page.setViewportSize({width:1600,height:1100});await page.locator('[data-view="world"]').click();await page.locator('#lighting').selectOption('sunset');
  await page.locator('#motion').click();await page.waitForTimeout(1000);
  const timing=await page.evaluate(()=>{const a=STYLE_LAB.frameTimes.slice(20).sort((a,b)=>a-b);return {samples:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)]};});
  check('Native desktop renders sustained frames',timing.samples>50&&timing.p95<100,timing);
  await page.emulateMedia({reducedMotion:'reduce'});await settle();check('OS reduced motion stops animation',await page.evaluate(()=>!STYLE_LAB.options.motion));
  const still=await page.evaluate(()=>({time:STYLE_LAB.time,frames:STYLE_LAB.metrics.frames}));await page.waitForTimeout(150);check('Paused scene does not render an idle loop',await page.evaluate(s=>STYLE_LAB.time===s.time&&STYLE_LAB.metrics.frames===s.frames,still));
  await page.evaluate(()=>{const gl=document.querySelector('#render').getContext('webgl2');window.recoveryExtension=gl.getExtension('WEBGL_lose_context');window.recoveryExtension.loseContext();});
  await page.waitForTimeout(100);check('Context loss displays recovery guidance',await page.locator('#loading').isVisible());await page.evaluate(()=>window.recoveryExtension.restoreContext());await page.waitForTimeout(400);check('Context restoration resumes a rendered scene',await page.evaluate(()=>document.querySelector('#loading').hidden&&STYLE_LAB.metrics.frames>0));
  await shot('recovered');
  await page.goto(base+'/style-lab.html?style=ink&view=materials&light=day');await page.waitForFunction(()=>window.STYLE_LAB?.metrics.frames>0);check('Shareable URL restores style, view and light',await page.evaluate(()=>STYLE_LAB.options.focus==='ink'&&STYLE_LAB.options.view==='materials'&&STYLE_LAB.options.light==='day'&&location.search.includes('light=day')));
  const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const mobile=await touch.newPage();mobile.on('pageerror',e=>errors.push(String(e)));await mobile.goto(base+'/style-lab.html');await mobile.waitForFunction(()=>window.STYLE_LAB?.metrics.frames>0);
  await mobile.locator('[data-focus="anime"]').tap();check('Touch tap opens a single style',await mobile.locator('.viewport:visible').count()===1);
  const touchPrior=await mobile.evaluate(()=>STYLE_LAB.camera.yaw),bounds=await mobile.locator('.viewport:visible').boundingBox();const cdp=await touch.newCDPSession(mobile),x=bounds.x+bounds.width*.45,y=Math.max(100,Math.min(700,bounds.y+240));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+85,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  check('Real touch swipe orbits',await mobile.evaluate(n=>STYLE_LAB.camera.yaw!==n,touchPrior));
  await mobile.screenshot({path:resolve(out,'touch-focus.png'),fullPage:true});await touch.close();
  check('No runtime or shader errors',errors.length===0,errors);
}catch(error){errors.push(String(error));check('Harness completed',false,String(error));}
finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({base,checks,errors},null,2)+'\n');await browser.close();}
console.log(`${checks.filter(c=>c.ok).length}/${checks.length} style lab checks pass`);if(checks.some(c=>!c.ok)||errors.length)process.exitCode=1;
