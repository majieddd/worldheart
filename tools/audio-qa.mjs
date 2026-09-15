// Rendered browser audio acceptance. Fixtures are labelled, not natural play.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/audio-revamp/browser'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8140';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report={base,checks:[],faults:[]};
const check=(name,ok,detail)=>{report.checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name);};
try{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});const page=await context.newPage();
 page.on('pageerror',e=>report.faults.push(String(e)));
 await page.goto(base+'/?map=ninetynine&campaign=0&planet=temperate&seed=12345',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WH?.audio&&document.querySelector('#boot.done'),null,{timeout:180000});
 check('No autoplay before a gesture',await page.evaluate(()=>!WH.audio.started));
 await page.locator('#btn-begin').tap();await page.waitForFunction(()=>WH.audio.snapshot().bank==='ready',null,{timeout:45000});
 check('Touch unlock and bank decode',await page.evaluate(()=>WH.audio.ctx.state==='running'&&WH.audio.buffer.numberOfChannels===1));
 report.initial=await page.evaluate(()=>WH.audio.snapshot());
 check('Decoded bank under 40 MiB',report.initial.decodedBytes<40*1024*1024,report.initial.decodedBytes);
 // Analytic inspection uses the actual browser-decoded MP3, including encoder delay.
 report.cues=await page.evaluate(async()=>{
  const {AUDIO_BANK}=await import('./js/audio-bank.js'),{AUDIO_CUES}=await import('./js/audio-catalogue.js'),a=WH.audio,channel=a.buffer.getChannelData(0),sr=a.buffer.sampleRate;
  return Object.entries(AUDIO_BANK.cues).map(([key,variants])=>{
   const metrics=variants.map(c=>{const start=Math.round(c.start*sr),end=Math.round((c.start+c.duration)*sr);let peak=0,energy=0,dc=0;for(let i=start;i<end;i++){const x=channel[i]||0;peak=Math.max(peak,Math.abs(x));energy+=x*x;dc+=x;}return {peak,rms:Math.sqrt(energy/(end-start)),dc:dc/(end-start)};});
   return {key,label:AUDIO_CUES[key].label,metrics};
  });
 });
 for(const cue of report.cues)check('Decoded cue '+cue.key,cue.metrics.every(m=>m.peak>.01&&m.peak<1&&m.rms>.003&&Math.abs(m.dc)<.008),cue.metrics);
 await page.evaluate(()=>{WH.game.paused=true;WH.audio._stopVoices();});
 report.stress=await page.evaluate(async()=>{
  const a=WH.audio,{AUDIO_CUES}=await import('./js/audio-catalogue.js'),keys=Object.keys(AUDIO_CUES).filter(k=>AUDIO_CUES[k].bus!=='ambience');
  const start=performance.now();for(let j=0;j<15;j++)for(const key of keys)a.play(key,{audition:true});
  return {elapsed:performance.now()-start,...a.snapshot()};
 });
 check('Bounded voice stealing during 1,000+ event burst',report.stress.voices<=24&&report.stress.peakVoices<=24&&report.stress.stolen>0,report.stress);
 await page.waitForTimeout(3000);check('One-shot nodes are released',await page.evaluate(()=>WH.audio.voices.size===0));
 await page.evaluate(()=>{WH.audio.setVolume('music',.23);WH.audio.setVolume('effects',.61);WH.audio.toggleMute();});
 check('Mute stops voices and music',await page.evaluate(()=>WH.audio.muted&&WH.audio.voices.size===0&&WH.audio.decks.every(d=>d.element.paused)));
 await page.evaluate(()=>WH.audio.toggleMute());await page.waitForTimeout(300);check('Unmute recovers context',await page.evaluate(()=>WH.audio.ctx.state==='running'&&!WH.audio.muted));
 await page.evaluate(async()=>{await WH.audio.ctx.suspend();});await page.touchscreen.tap(400,160);await page.waitForTimeout(400);check('Interrupted context recovers on touch',await page.evaluate(()=>WH.audio.ctx.state==='running'));
 await page.locator('#touch-menu-open').tap();await page.locator('#touch-tab-options').tap();
 await page.locator('.audio-settings summary').tap();await page.locator('[data-audio-bus=music]').scrollIntoViewIfNeeded();
 await page.screenshot({path:resolve(out,'mobile-mixer.png')});
 report.sliders=await page.locator('.audio-slider input').evaluateAll(es=>es.map(e=>({label:e.getAttribute('aria-label'),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
 check('Five usable labelled mix controls',report.sliders.length===5&&report.sliders.every(s=>s.width>=70&&s.height>=40),report.sliders);
 await page.locator('[data-audio-bus=music]').fill('23');await page.locator('[data-audio-bus=effects]').fill('61');
 const slider=await page.locator('[data-audio-bus=music]').boundingBox();await page.touchscreen.tap(slider.x+slider.width*.72,slider.y+slider.height/2);
 check('Native touch moves the music slider',await page.evaluate(()=>WH.audio.settings.music>.6&&WH.audio.settings.music<.85));
 await page.locator('[data-audio-bus=music]').fill('23');
 check('No page horizontal overflow',await page.evaluate(()=>document.body.scrollWidth<=innerWidth));
 await page.reload();await page.waitForFunction(()=>window.WH?.audio&&document.querySelector('#boot.done'),null,{timeout:180000});
 check('Mix settings persist',await page.evaluate(()=>WH.audio.settings.music===.23&&WH.audio.settings.effects===.61));
 check('Reload stays gesture-locked',await page.evaluate(()=>!WH.audio.started));
 await page.goto(base+'/lobby.html');await page.waitForFunction(()=>window.LOBBY?.audio);await page.locator('.audio-settings summary').tap();
 await page.waitForFunction(()=>LOBBY.audio.ctx?.state==='running');check('Lobby touch unlock',true);
 await page.screenshot({path:resolve(out,'lobby-mixer.png')});
 await page.goto(base+'/debug.html');await page.waitForFunction(()=>window.WH_AUDIO&&window.DEBUG_WORLD,null,{timeout:180000});
 await page.locator('#debug-inspect').tap();await page.locator('.audio-settings summary').tap();
 await page.locator('#audio-cue').selectOption('rifle');await page.locator('#audio-play').click();await page.waitForFunction(()=>WH_AUDIO.snapshot().bank==='ready',null,{timeout:45000});
 check('Debug audio catalogue',await page.locator('#audio-cue option').count()===report.cues.length);
 await page.screenshot({path:resolve(out,'debug-audition.png')});
 check('No browser exceptions',report.faults.length===0,report.faults);
}catch(e){report.faults.push(String(e));console.error(e);}finally{writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
if(report.faults.length||report.checks.some(c=>!c.ok))process.exitCode=1;
