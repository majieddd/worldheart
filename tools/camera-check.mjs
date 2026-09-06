import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(process.env.WH_NODE_MODULES?resolve(process.env.WH_NODE_MODULES,'package.json'):import.meta.url);
const {chromium}=require('playwright');const out=resolve(process.argv[2]||'artifacts/m1');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),faults=[];
  page.on('pageerror',e=>faults.push(String(e)));
  await page.addInitScript(()=>{
    HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(new Error('QA pointer lock refusal'));
    const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});
  });
  await page.goto('http://127.0.0.1:8139/?map=ninetynine&seed=12345');
  await page.waitForFunction(()=>window.WH?.possession&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
  const checks=await page.evaluate(async()=>{
    __qaFramesEnabled=false;const checks=[];const check=(name,ok,actual)=>{checks.push({name,ok,actual});if(!ok)throw Error(name+': '+JSON.stringify(actual));};
    const W=WH,r=W.rig,p=W.possession,g=W.game;
    const {PRESENTATION}=await import('/js/config.js');
    document.getElementById('btn-begin').click();g.paused=true;r.cancelFlight();
    W.waves.onPortalWake(1);check('Breach focus defaults off',!r.flight&&!PRESENTATION.autoFocus);
    r.flyTo(W.heartPos,r.distMax,1);r.update(.2);const lon=r.lon,lat=r.lat;r.zoomBy(-.1);
    check('Wheel interrupts flight without jumping',r.flight===null&&r.lon===lon&&r.lat===lat);
    document.getElementById('btn-home').click();check('Return to heart starts explicit focus',!!r.flight);
    const a=W.allies.active[0];p.enter(a);check('Possession cancels orbit flight',!r.flight);
    dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));check('Movement belongs only to commander',p.keys.has('KeyW')&&!r.keys.has('KeyW'));
    dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));
    const oldFwd=a.fwd.clone();r.canvas.dispatchEvent(new MouseEvent('mousemove',{buttons:2,movementX:80,movementY:15}));
    p.update(.1,false);check('Right-drag look works with pointer lock refused',a.fwd.distanceTo(oldFwd)>0.01);
    const initial=a.fwd.clone(),pitch=p.pitch;const turns=[];
    for(const fps of [30,60,120]){
      a.fwd.copy(initial);p.pitch=pitch;p.yawQueue=2.8;p.pitchQueue=0;
      for(let i=0;i<fps/5;i++)p.update(1/fps,false);
      turns.push(a.fwd.toArray());check(`Tangent frame at ${fps} FPS`,Math.abs(a.fwd.dot(a.dir))<1e-8&&Math.abs(a.fwd.length()-1)<1e-8);
    }
    check('Look filter agrees at 30/60/120 FPS',turns.every(v=>v.every((x,i)=>Math.abs(x-turns[0][i])<1e-7)),turns);
    const prev=W.SIM_RANDOM.next;let calls=0;W.SIM_RANDOM.next=()=>{calls++;return .5;};r.trauma=.7;p.placeCamera();W.SIM_RANDOM.next=prev;
    check('Camera shake does not consume combat RNG',calls===0,calls);
    document.getElementById('set-bob').click();document.getElementById('set-shake').click();
    check('Bob and shake independently disable',!PRESENTATION.bob&&!PRESENTATION.shake&&!r.shakeEnabled);
    check('Motion settings persist',JSON.parse(localStorage.getItem('whPresentation')).bob===false);
    p.boomWant=5;W.step(.4);
    check('Third-person scroll works while paused',p.boom>4.5&&!a.hidden);
    return checks;
  });
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('title-overlay')).opacity==='0',{}, {polling:50});
  await page.screenshot({path:resolve(out,'third-person-720.png')});
  await page.setViewportSize({width:1920,height:1080});
  const hidden=await page.evaluate(()=>{WH.possession.boomWant=0;WH.step(.5);return WH.possession.unit.hidden&&WH.possession.viewModel.visible&&WH.allies.species.commander.parts.every(p=>p._n===0);});
  checks.push({name:'First-person hides the body while paused',ok:hidden});if(!hidden)throw Error('Paused view change left body visible');
  await page.screenshot({path:resolve(out,'first-person-1080.png')});
  const reduced=await browser.newPage({reducedMotion:'reduce',viewport:{width:1280,height:720}});
  await reduced.goto('http://127.0.0.1:8139/?map=ninetynine&seed=12345');
  await reduced.waitForFunction(()=>window.WH?.possession&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
  const quiet=await reduced.evaluate(async()=>{const {PRESENTATION}=await import('/js/config.js');return !PRESENTATION.bob&&!PRESENTATION.shake&&!WH.rig.shakeEnabled;});
  checks.push({name:'OS reduced motion starts bob/shake disabled',ok:quiet});if(!quiet)throw Error('Reduced motion defaults');
  await reduced.close();
  writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Camera/input and fixed-state fixtures',checks,faults},null,2)+'\n');
  console.log(JSON.stringify({checks:checks.length,pass:checks.every(c=>c.ok)&&!faults.length,faults}));
  if(faults.length)process.exitCode=1;
}finally{await browser.close();}
