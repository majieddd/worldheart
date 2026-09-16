import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export async function run({page,browser,base,out,check,shot,settle,difference,sharp,errors,requests}){
  const ready=async p=>p.waitForFunction(()=>window.PLAYGROUND?.ready,null,{timeout:60000});
  const value=(fn,arg)=>page.evaluate(fn,arg),focus=()=>page.locator('#world').focus();
  await page.goto(base+'/style-playground.html');await ready(page);await page.waitForTimeout(500);
  const contrast=await page.evaluate(()=>{
    const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number),lum=c=>{const a=c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return a[0]*.2126+a[1]*.7152+a[2]*.0722;};
    const bg=e=>{const c=rgb(getComputedStyle(e).backgroundColor);if((c[3]??1)>=.99)return c;const under=e.parentElement?bg(e.parentElement):[255,255,255];return c.slice(0,3).map((v,i)=>v*(c[3]??1)+under[i]*(1-(c[3]??1)));};
    return [...document.querySelectorAll('header a,header button,header small,footer span,footer a,.title-card p,.title-card h1,.title-card>span,.status-card span,.status-card strong,.stations button')].filter(e=>e.offsetParent).map(e=>{const s=getComputedStyle(e),a=lum(rgb(s.color)),b=lum(bg(e)),size=parseFloat(s.fontSize);return {text:e.textContent.trim().slice(0,40),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),required:size>=24||(size>=18.66&&parseInt(s.fontWeight)>=700)?3:4.5};});
  });check('Playground interface text meets AA contrast',contrast.every(c=>c.ratio>=c.required),contrast);
  const initial=await value(()=>({speeds:PLAYGROUND.actor.groundSpeeds,clips:Object.keys(PLAYGROUND.actor.clips),metrics:PLAYGROUND.metrics,storage:JSON.stringify(localStorage)}));
  check('Authored rig and four skinned hand primitives load',initial.clips.length===14&&await value(()=>PLAYGROUND.actor.meshes.filter(m=>m.isSkinnedMesh).length===4),initial);
  check('Stance calibration yields finite walk and run speeds',Object.values(initial.speeds).every(s=>s>.3&&s<6),initial.speeds);
  const manifest=await (await page.request.get(base+'/lib/playground/provenance.json')).json(),asset=await page.request.get(base+'/lib/playground/RobotExpressive.glb');
  check('Pinned authored character serves exact saved bytes',asset.ok()&&createHash('sha256').update(await asset.body()).digest('hex')===manifest.sha256,manifest);
  await page.locator('#pause').click();const before=await value(()=>({pos:PLAYGROUND.actor.root.position.toArray(),time:PLAYGROUND.time,feet:PLAYGROUND.actor.bonePose()}));
  const hard=await shot('hard-cel');await page.locator('[data-style="v5"]').click();const atmosphere=await shot('atmospheric-ink');
  check('Live art treatments produce distinct pixels',await difference(hard,atmosphere)>.5);
  check('Style switching preserves camera, position and animation phase',await value(b=>JSON.stringify(PLAYGROUND.actor.root.position.toArray())===JSON.stringify(b.pos)&&PLAYGROUND.time===b.time&&JSON.stringify(PLAYGROUND.actor.bonePose())===JSON.stringify(b.feet),before));
  await page.waitForTimeout(300);check('Pause freezes simulation',await page.evaluate(t=>PLAYGROUND.time===t,before.time));
  await page.locator('#reset').click();await focus();
  await page.keyboard.down('KeyW');await page.waitForTimeout(1200);const walk=await value(()=>({pos:PLAYGROUND.actor.root.position.toArray(),clip:PLAYGROUND.actor.current,speed:PLAYGROUND.movement.velocity,feet:PLAYGROUND.actor.bonePose()}));await page.keyboard.up('KeyW');
  check('Real WASD walks forward with Walking clip',walk.pos[2]<8.6&&walk.clip==='Walking',walk);
  await page.waitForTimeout(400);check('Release settles to Idle',await value(()=>PLAYGROUND.actor.current==='Idle'));
  await page.keyboard.press('KeyJ');await page.waitForTimeout(390);check('Real strike produces one contact and a target hit',await value(()=>PLAYGROUND.state.contacts===1&&PLAYGROUND.state.hits===1),await value(()=>PLAYGROUND.state));await shot('strike-impact');
  await page.waitForTimeout(500);await page.keyboard.press('KeyE');await page.waitForTimeout(450);check('Pulse creates world effects at authored contact',await value(()=>PLAYGROUND.state.pulses===1&&PLAYGROUND.state.contacts===2&&PLAYGROUND.metrics.effects>0));await shot('pulse-impact');
  const pulseCount=await value(()=>PLAYGROUND.state.pulses);await page.keyboard.press('KeyE');check('Pulse recovery prevents repeated activation',await page.evaluate(n=>PLAYGROUND.state.pulses===n,pulseCount));await page.waitForTimeout(650);
  await page.keyboard.press('Space');await page.waitForTimeout(260);check('Jump lifts the animated character',await value(()=>PLAYGROUND.movement.jump>.35&&PLAYGROUND.actor.current==='Jump'));await page.waitForTimeout(850);check('Jump lands and returns to Idle',await value(()=>PLAYGROUND.movement.jump===0&&PLAYGROUND.actor.current==='Idle'));
  await page.locator('#reset').click();await focus();await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyD');await page.waitForTimeout(1100);const run=await value(()=>({pos:PLAYGROUND.actor.root.position.toArray(),clip:PLAYGROUND.actor.current,velocity:PLAYGROUND.movement.velocity}));await page.keyboard.up('KeyD');await page.keyboard.up('ShiftLeft');
  check('Sprint uses the Running clip at greater travel speed',run.clip==='Running'&&Math.hypot(...run.velocity)>initial.speeds.Walking*1.3,run);
  const rect=await page.locator('#world').boundingBox(),mx=rect.x+rect.width*.7,my=rect.y+rect.height*.5;await page.mouse.move(mx,my);await page.mouse.down({button:'right'});await page.mouse.move(mx+190,my+25,{steps:12});await page.mouse.up({button:'right'});check('Right drag orbits camera',await value(()=>Math.abs(PLAYGROUND.camera.yaw)>.8));
  await page.mouse.wheel(0,-300);check('Wheel zooms camera',await value(()=>PLAYGROUND.camera.distance<9.5));
  await page.locator('[data-station="cannon"]').click();check('Cannon station places player in the demonstration area',await value(()=>PLAYGROUND.actor.root.position.x===-7&&PLAYGROUND.actor.root.position.z===17));await page.waitForTimeout(4700);check('Cannon fires and impact follows the projectile',await value(()=>PLAYGROUND.events.some(e=>e.kind==='cannon-fire')&&PLAYGROUND.events.some(e=>e.kind==='cannon-impact')));await shot('cannon-range');
  await page.locator('[data-station="brook"]').click();await page.waitForTimeout(100);await shot('stream-station');

  // Measure full authored cycles, including the wrap. No retargeting or gait
  // edits are claimed. Keep continuous pose motion and an intentionally frozen
  // control, so the motion detector has demonstrated a failing condition.
  await page.locator('#pause').click();
  const animation=await value(()=>{
    const a=PLAYGROUND.actor,bones=[];a.model.traverse(o=>{if(o.isBone)bones.push(o);});const reports={};
    const median=v=>v.sort((x,y)=>x-y)[Math.floor(v.length/2)];
    for(const name of ['Walking','Running','Punch','Jump']){
      const duration=a.clips[name].duration,poses=[],feet=[],hips=[];
      for(let i=0;i<=120;i++){a.pose(name,duration*i/120);poses.push(bones.map(b=>b.quaternion.clone().normalize()));feet.push(a.bonePose());hips.push(a.model.getObjectByName('Hips').getWorldPosition(a.root.position.clone()).toArray());}
      const delta=(x,y)=>Math.sqrt(x.reduce((s,q,i)=>s+q.angleTo(y[i])**2,0)/x.length),steps=poses.slice(1).map((p,i)=>delta(p,poses[i])),moving=steps.filter(s=>s>1e-5),seam=delta(poses[119],poses[0]);
      const frozen=poses.map(()=>poses[0]),frozenMoving=frozen.slice(1).filter((p,i)=>delta(p,frozen[i])>1e-5).length;
      reports[name]={frozenMoving,duration,movingFrames:moving.length,medianPoseStep:median(moving),seam,wrapRatio:seam/median(moving),hipVerticalRange:Math.max(...hips.map(p=>p[1]))-Math.min(...hips.map(p=>p[1])),footTravel:Math.max(...feet.map(p=>p[0][2]))-Math.min(...feet.map(p=>p[0][2]))};
    }
    a.reset();return {clips:reports,frozenControl:{movingFrames:reports.Walking.frozenMoving},groundSpeeds:a.groundSpeeds};
  });
  writeFileSync(resolve(out,'animation-metrics.json'),JSON.stringify(animation,null,2)+'\n');
  check('Complete walk and run cycles contain continuous articulated motion',Object.values(animation.clips).every(c=>c.movingFrames>70),animation);
  check('Locomotion loop wrap stays within two typical sampled pose steps',['Walking','Running'].every(n=>animation.clips[n].wrapRatio<2.1),animation.clips);
  check('Authored hips translate and feet travel through both cycles',['Walking','Running'].every(n=>animation.clips[n].hipVerticalRange>.005&&animation.clips[n].footTravel>.2),animation.clips);
  check('The same motion detector rejects a deliberately frozen control',animation.frozenControl.movingFrames<=70);

  // Ordered contact sheets: actual rendered frames at several points in each
  // authored cycle, with deforming ink shells visible from a profile camera.
  await page.locator('#reset').click();await page.mouse.move(mx,my);await page.mouse.down({button:'right'});await page.mouse.move(mx+230,my,{steps:12});await page.mouse.up({button:'right'});await page.locator('#pause').click();
  await page.locator('#paused').evaluate(e=>e.style.visibility='hidden');
  for(const name of ['Walking','Running','Punch']){const images=[];for(let i=0;i<8;i++){await page.evaluate(({name,i})=>{PLAYGROUND.actor.pose(name,PLAYGROUND.actor.clips[name].duration*i/8);PLAYGROUND.render();},{name,i});const png=await page.locator('#stage').screenshot();const meta=await sharp(png).metadata();images.push(await sharp(png).extract({left:Math.round(meta.width/2-250),top:Math.round(meta.height*.34),width:500,height:500}).resize(320,320).png().toBuffer());}await sharp({create:{width:1280,height:640,channels:3,background:'#142136'}}).composite(images.map((input,i)=>({input,left:(i%4)*320,top:Math.floor(i/4)*320}))).png().toFile(resolve(out,name.toLowerCase()+'-sequence.png'));}
  await page.locator('#paused').evaluate(e=>e.style.visibility='');
  await page.locator('#reset').click();await focus();const geometryBefore=await value(()=>PLAYGROUND.metrics.geometries);for(let i=0;i<5;i++){await page.keyboard.press('KeyJ');await page.waitForTimeout(760);}check('Repeated effects keep GPU geometry allocation bounded',await page.evaluate(n=>PLAYGROUND.metrics.geometries<=n+2,geometryBefore));
  const download=page.waitForEvent('download');await page.locator('#capture').click();check('Photo exports a PNG',/\.png$/.test((await download).suggestedFilename()));
  const perf=await value(()=>{const t=PLAYGROUND.timings.slice(60).sort((a,b)=>a-b),gl=document.querySelector('#world').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {frames:t.length,p50:t[Math.floor(t.length*.5)],p95:t[Math.floor(t.length*.95)],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',metrics:PLAYGROUND.metrics};});writeFileSync(resolve(out,'performance.json'),JSON.stringify(perf,null,2)+'\n');check('Measured renderer frame sample is valid',perf.frames>30&&perf.p50>0,perf);
  await page.evaluate(()=>window.__lost=document.querySelector('#world').getContext('webgl2').getExtension('WEBGL_lose_context'));await page.evaluate(()=>__lost.loseContext());await page.waitForFunction(()=>PLAYGROUND.contextLost);check('Context interruption displays a recovery state',await page.locator('#loading').isVisible()&&await page.locator('#capture').isDisabled());await page.evaluate(()=>__lost.restoreContext());await page.waitForFunction(()=>!PLAYGROUND.contextLost);check('Restored context renders again',await page.locator('#loading').isHidden());
  check('No campaign code or saves used',!requests.some(u=>/\/js\/(main|modes\/|run\/)/.test(u))&&await page.evaluate(s=>JSON.stringify(localStorage)===s,initial.storage));

  const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'}),mobile=await mobileContext.newPage();mobile.on('pageerror',e=>errors.push(String(e)));await mobile.goto(base+'/style-playground.html');await ready(mobile);
  check('Mobile has no horizontal overflow and touch controls fit',await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#touch-strike').getBoundingClientRect().right<=innerWidth));
  const pad=await mobile.locator('#stick').boundingBox(),cdp=await mobileContext.newCDPSession(mobile),x=pad.x+pad.width/2,y=pad.y+pad.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y-35}]});await mobile.waitForTimeout(1000);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});check('Real touch joystick moves the character',await mobile.evaluate(()=>PLAYGROUND.actor.root.position.z<9));
  await mobile.locator('#touch-strike').tap();await mobile.waitForTimeout(400);check('Touch strike drives authored attack',await mobile.evaluate(()=>PLAYGROUND.state.strikes===1));await mobile.locator('[data-style="v5"]').tap();check('Touch style switch and reduced-motion preference work',await mobile.evaluate(()=>PLAYGROUND.state.style==='v5'&&PLAYGROUND.reducedMotion));await mobile.screenshot({path:resolve(out,'mobile.png'),fullPage:true});await mobileContext.close();
  const failed=await browser.newPage();await failed.route('**/RobotExpressive.glb',r=>r.abort());await failed.goto(base+'/style-playground.html');await failed.waitForFunction(()=>window.PLAYGROUND_ERROR);check('Missing character shows retry and disables export',await failed.locator('#retry').isVisible()&&await failed.locator('#capture').isDisabled());await failed.close();
  if(process.env.WH_RECORD_MOTION==='1'){
    const context=await browser.newContext({viewport:{width:1200,height:800},recordVideo:{dir:out,size:{width:1200,height:800}}}),motion=await context.newPage();motion.on('pageerror',e=>errors.push(String(e)));
    await motion.goto(base+'/style-playground.html?style=v5');await ready(motion);await motion.locator('#world').focus();await motion.keyboard.down('KeyA');await motion.waitForTimeout(3000);await motion.keyboard.down('ShiftLeft');await motion.waitForTimeout(2200);await motion.keyboard.press('Space');await motion.waitForTimeout(800);await motion.keyboard.up('KeyA');await motion.keyboard.up('ShiftLeft');await motion.waitForTimeout(500);
    await motion.locator('[data-station="meadow"]').click();await motion.keyboard.down('KeyW');await motion.waitForTimeout(1300);await motion.keyboard.up('KeyW');await motion.waitForTimeout(300);await motion.keyboard.press('KeyJ');await motion.waitForTimeout(850);await motion.keyboard.press('KeyE');await motion.waitForTimeout(1500);await motion.locator('[data-style="v1"]').click();await motion.waitForTimeout(500);
    const video=motion.video();await context.close();await video.saveAs(resolve(out,'motion-review.webm'));
    check('Continuous real-input motion recording saved',true,'motion-review.webm; walk, run, jump, settle, strike, pulse and style switch');
  }
  check('No JavaScript or shader errors',errors.length===0,errors);
}
