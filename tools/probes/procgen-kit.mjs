import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
export async function run({page,browser,base,out,check,errors,requests}){
  const ready=p=>p.waitForFunction(()=>window.PROCGEN_LAB?.state.ready,null,{timeout:60000});
  const frames=(p,n=8)=>p.evaluate(n=>new Promise(resolve=>{function next(){if(--n<=0)resolve();else requestAnimationFrame(next);}requestAnimationFrame(next);}),n);
  await page.goto(base+'/procgen-lab.html?seed=12345');
  await ready(page);
  check('Seeded current and guided patches render',await page.evaluate(()=>PROCGEN_LAB.recipe.surfaces.length===2));
  check('Shared input and mesh budget have no open seams',await page.evaluate(()=>{const [a,b]=PROCGEN_LAB.recipe.surfaces;return a.metrics.triangles===b.metrics.triangles&&a.metrics.seamError<1e-8&&b.metrics.seamError<1e-8&&b.metrics.reachable===3;}));
  check('No campaign storage writes or game imports',await page.evaluate(()=>localStorage.length===0)&&!requests.some(u=>/js\/(main|core)\.js/.test(u)));
  await page.screenshot({path:resolve(out,'comparison.png'),fullPage:true});
  await page.locator('#grid').check();await frames(page);await page.locator('#stage').screenshot({path:resolve(out,'shared-grid.png')});check('Shared-grid overlay toggles',await page.evaluate(()=>PROCGEN_LAB.state.grid));await page.locator('#grid').uncheck();
  await page.locator('[data-mode="guided"]').click();check('Single-side mode uses the selected comparison',await page.locator('.viewport:visible').count()===1&&await page.locator('[data-side="1"]').isVisible());
  await page.locator('[data-mode="split"]').click();const before=await page.evaluate(()=>PROCGEN_LAB.state.yaw);
  await page.locator('[data-side="0"]').focus();await page.keyboard.press('ArrowRight');check('Keyboard orbit moves synchronized camera',await page.evaluate(b=>PROCGEN_LAB.state.yaw!==b,before));
  const rect=await page.locator('[data-side="1"]').boundingBox();await page.mouse.move(rect.x+rect.width*.6,rect.y+rect.height*.4);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.6+55,rect.y+rect.height*.4+15,{steps:6});await page.mouse.up();
  check('Real drag changes shared orbit',await page.evaluate(b=>Math.abs(PROCGEN_LAB.state.yaw-b)>.1,before));
  const distance=await page.evaluate(()=>PROCGEN_LAB.state.distance);await page.mouse.wheel(0,-150);check('Wheel zoom works',await page.evaluate(d=>PROCGEN_LAB.state.distance<d,distance));await page.locator('#reset-view').click();
  const target=await page.evaluate(async()=>{
    const THREE=await import('./lib/three.module.min.js'),r=document.querySelector('[data-side="1"]').getBoundingClientRect(),s=PROCGEN_LAB.state,path=PROCGEN_LAB.recipe.surfaces[1].routes[0];
    const p=path[Math.max(0,path.length-32)],camera=new THREE.PerspectiveCamera(43,r.width/r.height,.5,1500);
    camera.position.set(Math.sin(s.yaw)*Math.cos(s.pitch)*s.distance,8+Math.sin(s.pitch)*s.distance,Math.cos(s.yaw)*Math.cos(s.pitch)*s.distance);camera.lookAt(0,8,0);camera.updateMatrixWorld();
    const q=new THREE.Vector3(...p).project(camera);return {x:r.x+(q.x+1)*r.width/2,y:r.y+(1-q.y)*r.height/2,initial:PROCGEN_LAB.heroes[1]};
  });
  await page.mouse.click(target.x,target.y);await page.waitForFunction(p=>Math.hypot(...PROCGEN_LAB.heroes[1].map((x,i)=>x-p[i]))>5,target.initial,{timeout:15000});
  check('Ground click moves commander along a real surface route',await page.evaluate(()=>PROCGEN_LAB.state.walks>0));
  await page.locator('#overlook').click();await page.waitForFunction(()=>{const h=PROCGEN_LAB.heroes[1],p=PROCGEN_LAB.recipe.overlook.center;return Math.hypot(h[0]-p[0],h[2]-p[1])<5;},null,{timeout:30000});
  check('Commander traverses the fitted multi-cell ramp',true);await page.locator('#stage').screenshot({path:resolve(out,'overlook-walk.png')});
  await page.locator('#scouts').click();await page.waitForFunction(()=>PROCGEN_LAB.scouts.flat().length===18);
  await page.locator('#pause').click();const stopped=await page.evaluate(()=>PROCGEN_LAB.scouts);await frames(page,12);check('Pause freezes moving scouts',JSON.stringify(stopped)===JSON.stringify(await page.evaluate(()=>PROCGEN_LAB.scouts)));await page.locator('#pause').click();
  await page.waitForFunction(()=>PROCGEN_LAB.state.arrivals===18,null,{timeout:45000});check('All 18 scouts finish both sets of three routes without teleporting',true);
  const reports=[];
  for(const preset of ['varied','badlands','canyon']){
    await page.locator('#preset').selectOption(preset);await page.locator('#generate').click();await ready(page);await frames(page,30);
    const report=await page.evaluate(()=>({seed:PROCGEN_LAB.state.seed,preset:PROCGEN_LAB.state.preset,recipe:PROCGEN_LAB.recipe.timings,metrics:PROCGEN_LAB.recipe.surfaces.map(s=>s.metrics),overlook:!!PROCGEN_LAB.recipe.overlook,rejected:PROCGEN_LAB.recipe.overlookRejected,runtime:PROCGEN_LAB.metrics}));reports.push(report);
    check(preset+' renders with checked guided approaches',report.metrics[1].reachable===3);
    await page.locator('#stage').screenshot({path:resolve(out,preset+'.png')});
  }
  await page.locator('#preset').selectOption('varied');await page.locator('#generate').click();await ready(page);await frames(page);const warm=await page.evaluate(()=>PROCGEN_LAB.metrics);
  for(let i=0;i<2;i++){await page.locator('#generate').click();await ready(page);await frames(page);}
  check('Repeated regeneration frees GPU geometry and shadow textures',await page.evaluate(w=>PROCGEN_LAB.metrics.geometries===w.geometries&&PROCGEN_LAB.metrics.textures===w.textures,warm),{before:{geometries:warm.geometries,textures:warm.textures},after:await page.evaluate(()=>({geometries:PROCGEN_LAB.metrics.geometries,textures:PROCGEN_LAB.metrics.textures}))});
  await page.locator('#random').click();await ready(page);check('New seed changes recipe and shareable URL',await page.evaluate(()=>PROCGEN_LAB.state.seed!==12345&&new URLSearchParams(location.search).get('seed')===String(PROCGEN_LAB.state.seed)));
  await page.locator('#seed').fill('44021');await page.locator('#generate').click();await page.locator('#seed').fill('9137');await page.locator('#generate').click();await ready(page);check('New recipe cancels an in-flight worker without stale result',await page.evaluate(()=>PROCGEN_LAB.recipe.seed===9137));
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'}),mobile=await context.newPage();mobile.on('pageerror',e=>errors.push(String(e)));await mobile.goto(base+'/procgen-lab.html?seed=12345');await ready(mobile);
  check('Mobile fits viewport and respects reduced motion',await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&PROCGEN_LAB.state.paused));
  await mobile.locator('[data-mode="guided"]').tap();await mobile.locator('[data-side="1"]').scrollIntoViewIfNeeded();const mr=await mobile.locator('[data-side="1"]').boundingBox(),yaw=await mobile.evaluate(()=>PROCGEN_LAB.state.yaw),cdp=await context.newCDPSession(mobile),x=mr.x+mr.width*.4,y=Math.max(120,Math.min(650,mr.y+180));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+55,y:y+15}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  check('Actual touch drag orbits the mobile patch',await mobile.evaluate(b=>PROCGEN_LAB.state.yaw!==b,yaw));await mobile.screenshot({path:resolve(out,'mobile.png'),fullPage:true});await context.close();
  writeFileSync(resolve(out,'metrics.json'),JSON.stringify(reports,null,2)+'\n');
  check('No runtime errors',errors.length===0,errors);
}
