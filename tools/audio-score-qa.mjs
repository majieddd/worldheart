// Actual shipped YuE2 media through the production mixer and real touch UI.
// A small component fixture isolates output measurement from combat sounds.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8140').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/audio-revamp/score-browser');mkdirSync(out,{recursive:true});
const report={scope:'Actual delivered music and production controls in a touch browser component fixture. Objective playback, not listening or physical iOS acceptance.',base,checks:[],files:[],faults:[]};
const check=(name,ok,detail)=>{report.checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name);};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();
  page.on('pageerror',e=>report.faults.push(String(e)));const requests=[];page.on('request',r=>{if(r.url().includes('/audio/'))requests.push(r.url());});
  await page.route('**/audio-score-fixture.html',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="css/audio.css"><main></main><script type="module">import {AudioEngine} from './js/audio.js';import {audioSettings} from './js/audio-settings.js';import {MUSIC_TRACKS} from './js/audio-music.js';window.TRACKS=MUSIC_TRACKS;window.A=new AudioEngine();A.ambience='none';A.state='none';audioSettings(A,document.querySelector('main'),{audition:true});setInterval(()=>A.update(.05),50);</script>`}));
  await page.goto(base+'/audio-score-fixture.html');await page.waitForFunction(()=>window.A&&window.TRACKS);
  check('Six distinct score states available',await page.evaluate(()=>Object.keys(TRACKS).length===6));
  check('Music transfers wait for user input',requests.every(u=>u.endsWith('feedback-bank.mp3'))&&await page.evaluate(()=>A.ctx===null),requests);
  await page.locator('summary').tap();await page.waitForFunction(()=>A.ctx?.state==='running');
  const keys=await page.evaluate(()=>Object.keys(TRACKS));
  for(const key of keys){
    await page.locator('#audio-track').selectOption(key);
    await page.waitForFunction(k=>A.decks.some(d=>d.key===k&&d.target===1&&d.element.currentTime>.2&&d.element.readyState>=3),key,{timeout:45000});
    await page.waitForTimeout(4500);
    const result=await page.evaluate(async k=>{
      const d=A.decks.find(d=>d.key===k&&d.target===1),track=TRACKS[k],response=await fetch(new URL('audio/'+track.file,document.baseURI));
      const mime=response.headers.get('content-type'),bytes=await response.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
      const analyser=A.ctx.createAnalyser();analyser.fftSize=4096;A.buses.music.connect(analyser);let peak=0,energy=0;
      for(let j=0;j<8;j++){await new Promise(r=>setTimeout(r,50));const x=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(x);for(const v of x){peak=Math.max(peak,Math.abs(v));energy+=v*v;}}
      A.buses.music.disconnect(analyser);analyser.disconnect();
      return {key:k,mime,bytes:bytes.byteLength,hash,expected:track,duration:d.element.duration,time:d.element.currentTime,peak,rms:Math.sqrt(energy/(4096*8)),playing:A.decks.filter(d=>!d.element.paused).length,snapshot:A.snapshot()};
    },key);report.files.push(result);
    check(key+' asset hash, MIME and duration',result.hash===result.expected.sha256&&result.bytes===result.expected.bytes&&/^audio\/(?:mpeg|mp3)(?:;|$)/i.test(result.mime)&&Math.abs(result.duration-result.expected.seconds)<.2,result);
    check(key+' produces music output and retires faded deck',result.peak>.0005&&result.peak<1&&result.rms>.0001&&result.playing===1);
    await page.evaluate(k=>{const d=A.decks.find(d=>d.key===k&&d.target===1);d.element.currentTime=d.element.duration-.3;},key);
    await page.waitForFunction(k=>{const e=A.decks.find(d=>d.key===k&&d.target===1)?.element;return e&&!e.paused&&e.currentTime>.1&&e.currentTime<3;},key,{timeout:12000});
    check(key+' wraps and keeps playing',true);
  }
  const volume=await page.evaluate(()=>A.settings.music);await page.locator('#audio-stop').tap();await page.waitForTimeout(200);
  check('Stop audition preserves mix and pauses streams',await page.evaluate(v=>A.decks.every(d=>d.element.paused)&&A.settings.music===v&&document.querySelector('#audio-track').value==='',volume));
  await page.locator('#audio-track').selectOption('lobby');await page.waitForFunction(()=>A.decks.some(d=>d.key==='lobby'&&d.target===1&&!d.element.paused&&d.element.currentTime>.2));
  check('Track can be selected again after Stop',true);
  report.final=await page.evaluate(()=>A.snapshot());check('No audio or browser errors',report.final.errors.length===0&&report.faults.length===0&&Object.keys(report.final.unknownCues).length===0,report.final);
  await context.close();
}catch(e){report.faults.push(String(e));console.error(e);}finally{writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
if(report.faults.length||report.checks.some(c=>!c.ok))process.exitCode=1;
