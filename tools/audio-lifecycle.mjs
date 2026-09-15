// Isolated fault-injection fixtures for audio routing, not song listening or
// natural play. Synthetic test media is intercepted in-browser, never shipped.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=process.env.WH_BASE_URL||'http://127.0.0.1:8140',out=resolve(process.argv[2]||'artifacts/audio-revamp/lifecycle');mkdirSync(out,{recursive:true});
const report={scope:'Browser fixtures with intercepted synthetic music, not generated soundtrack acceptance.',checks:[],faults:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
function check(name,ok,detail){report.checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name);}
const sr=24000,n=sr*3,wav=Buffer.alloc(44+n*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sr,24);wav.writeUInt32LE(sr*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)wav.writeInt16LE(Math.round(Math.sin(i/sr*440*Math.PI*2)*2000),44+i*2);
async function fixture({failBank=false,failMusic=false}={}){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();page.on('pageerror',e=>report.faults.push(String(e)));
  await page.route('**/audio-fixture.html',route=>route.fulfill({contentType:'text/html',body:`<html><body><button id="start">Start audio</button><script type="module">import {AudioEngine} from './js/audio.js';window.A=new AudioEngine();document.querySelector('button').onclick=()=>A.start();setInterval(()=>A.update(.05),50);</script></body></html>`}));
  await page.route('**/js/audio-music.js',route=>route.fulfill({contentType:'text/javascript',body:`export const MUSIC_TRACKS=Object.fromEntries(['lobby','explore','battle','danger','victory','defeat'].map(key=>[key,{title:key,file:'qa-tone.wav?'+key}]));`}));
  await page.route('**/audio/qa-tone.wav*',route=>route.fulfill({status:failMusic?503:200,contentType:'audio/wav',body:failMusic?Buffer.from('unavailable'):wav}));
  if(failBank)await page.route('**/audio/feedback-bank.mp3',route=>route.fulfill({status:503,body:'unavailable'}));
  await page.goto(base+'/audio-fixture.html');await page.waitForFunction(()=>window.A);return {context,page};
}
try{
  let {context,page}=await fixture();check('Stream waits for a real touch',await page.evaluate(()=>A.ctx===null&&A.decks.length===0));
  await page.locator('#start').tap();await page.waitForFunction(()=>A.decks.some(d=>d.element.currentTime>.2));
  check('Initial music starts after touch',await page.evaluate(()=>A.snapshot().music==='playing'));
  await page.evaluate(()=>A.setScene({state:'battle'}));await page.waitForTimeout(800);
  check('Second deck starts without another gesture',await page.evaluate(()=>A.decks.some(d=>d.key==='battle'&&d.target===1&&!d.element.paused)));
  await page.waitForTimeout(4500);check('Faded deck stops decoding',await page.evaluate(()=>A.decks.filter(d=>!d.element.paused).length===1));
  await page.evaluate(()=>{for(const state of ['danger','explore','battle','victory','defeat'])A.setScene({state});});await page.waitForTimeout(1000);
  check('Rapid transition settles on latest state',await page.evaluate(()=>A.decks.length===2&&A.decks.some(d=>d.key==='defeat'&&d.target===1&&!d.element.paused)));
  await page.waitForFunction(()=>A.stats.bank==='ready');
  const spatial=await page.evaluate(()=>{
    A._stopVoices();A.observer={x:0,y:0,z:0};A.camera={matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}};
    const left=A.play('rifle',{audition:true,position:{x:-8,y:0,z:0}}),right=A.play('rifle',{audition:true,position:{x:8,y:0,z:0}}),far=A.play('rifle',{audition:true,position:{x:150,y:0,z:0}});
    return {left:left?.panner.pan.value,right:right?.panner.pan.value,near:left?.gain.gain.value,far:far?.gain.gain.value};
  });
  check('Position controls stereo direction and attenuation',spatial.left<-.5&&spatial.right>.5&&spatial.far<spatial.near*.1,spatial);
  const audible=await page.evaluate(async()=>{
    const analyser=A.ctx.createAnalyser();analyser.fftSize=2048;A.comp.connect(analyser);A.play('explosion',{audition:true});await new Promise(r=>setTimeout(r,90));const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);analyser.disconnect();let peak=0;for(const x of data)peak=Math.max(peak,Math.abs(x));return peak;
  });check('Mixed graph reaches an actual audio output analyser',audible>.001&&audible<=1,audible);
  await page.evaluate(()=>A.toggleMute());await page.waitForTimeout(100);check('Mute pauses both streams',await page.evaluate(()=>A.decks.every(d=>d.element.paused)&&A.voices.size===0));
  await page.evaluate(()=>A.toggleMute());await page.waitForTimeout(400);check('Unmute preserves music state',await page.evaluate(()=>A.state==='defeat'&&A.decks.some(d=>!d.element.paused)));
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(200);
  check('Hidden-page fixture suspends audio',await page.evaluate(()=>A.ctx.state==='suspended'&&A.decks.every(d=>d.element.paused)&&A.voices.size===0));
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await page.locator('#start').tap();await page.waitForTimeout(300);
  check('Return from hidden-page fixture recovers music',await page.evaluate(()=>A.ctx.state==='running'&&A.decks.some(d=>!d.element.paused)));
  await page.evaluate(()=>A.dispose());await page.waitForTimeout(200);await page.locator('#start').tap();check('Disposal releases context and prevents resurrection',await page.evaluate(()=>A.disposed&&A.ctx.state==='closed'&&A.voices.size===0));
  await context.close();
  ({context,page}=await fixture({failBank:true,failMusic:true}));await page.locator('#start').tap();await page.waitForTimeout(1500);
  check('Missing assets leave input audio functional',await page.evaluate(()=>{const v=A.play('click');return A.stats.bank==='unavailable'&&!!v&&A.ctx.state==='running';}));
  check('Missing music is reported without a page exception',await page.evaluate(()=>A.stats.music==='unavailable'||A.stats.errors.some(e=>e.startsWith('music:'))));
  await page.unroute('**/audio/feedback-bank.mp3');await page.evaluate(()=>{A._retried=false;});await page.locator('#start').tap();await page.waitForFunction(()=>A.stats.bank==='ready',null,{timeout:30000});check('Effects recover after network failure',true);
  await context.close();
  check('No unhandled browser errors',report.faults.length===0,report.faults);
}catch(e){report.faults.push(String(e));console.error(e);}finally{writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
if(report.faults.length||report.checks.some(c=>!c.ok))process.exitCode=1;
