// Real UI navigation and rendered inspection; injected RAF control only.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/worldgen/ui');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1280,height:800}}),checks=[],faults=[];
const check=(name,ok,actual)=>{checks.push({name,ok,actual});console.log(JSON.stringify({name,ok,actual}));};
const ready=p=>p.waitForFunction(()=>window.WH?.game&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
const labReady=p=>p.waitForFunction(()=>window.WH?.worldgen,{},{timeout:180000});
const snapshot=p=>p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>!k.startsWith('whWorldgen:')).sort().map(k=>[k,localStorage.getItem(k)])));
const fingerprint=p=>p.evaluate(async()=>{const w=await import(new URL('js/world.js',location.href));return {seed:WH.CONFIG.seed,heart:WH.nav.nodeDir(WH.nav.heartNode,WH.heartPos.clone()).toArray(),heights:[0,.4,.8,1.2,1.6].map(a=>w.terrainHeight(Math.cos(a),Math.sin(a),0,false))};});
try{
 await context.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 context.on('page',p=>p.on('pageerror',e=>faults.push(String(e))));
 const page=await context.newPage();await page.goto(`${base}/?map=ninetynine&campaign=1&seed=12345`);await ready(page);
 const saved=await snapshot(page),opened=context.waitForEvent('page');await page.locator('#title-overlay .worldgen-launch').click();const lab=await opened;await labReady(lab);
 await lab.evaluate(()=>{__qaFramesEnabled=false;WH.step(1);});
 check('Title opens an independent inspector tab',lab!==page&&new URL(lab.url()).searchParams.get('worldgen')==='1');
 check('Inspector cannot launch campaign, waves or rewards',await lab.evaluate(()=>!WH.CONFIG.campaign&&WH.game.state==='title'&&WH.game.paused&&WH.waves.wave===0));
 check('Opening inspector leaves all normal saved data unchanged',JSON.stringify(await snapshot(page))===JSON.stringify(saved));
 const first=await fingerprint(lab);
 await lab.locator('#worldgen-paths').check();check('Real nest approach overlay reaches the heart from all seventeen sources',await lab.evaluate(()=>WH.worldgen.routeCount===17&&WH.worldgen.paths.visible));
 await lab.locator('#worldgen-peak').click();await lab.evaluate(()=>WH.step(1));await lab.screenshot({path:resolve(out,'peak-and-routes.png')});
 check('Peak camera stays finite and above the planet',await lab.evaluate(()=>WH.rig.camera.matrixWorld.elements.every(Number.isFinite)&&WH.rig.camera.position.length()>WH.CONFIG.planetRadius));
 await lab.locator('#worldgen-globe').click();await lab.evaluate(()=>WH.step(1));check('Whole-planet inspection has a separate wide zoom',await lab.evaluate(()=>WH.rig.dist>WH.CONFIG.planetRadius*2.7));
 await lab.locator('#worldgen-home').click();await lab.evaluate(()=>WH.step(1));
 const start=await lab.evaluate(()=>[WH.rig.lat,WH.rig.lon]);await lab.mouse.click(950,430);await lab.keyboard.down('ArrowRight');await lab.evaluate(()=>WH.step(.5));await lab.keyboard.up('ArrowRight');
 check('Paused inspector accepts real arrow navigation',await lab.evaluate(([lat,lon])=>Math.abs(WH.rig.lat-lat)+Math.abs(WH.rig.lon-lon)>.001,start));
 await lab.locator('#worldgen-panel summary').focus();await lab.keyboard.press('Tab');
 check('Keyboard focus enters the generator with a visible outline',await lab.evaluate(()=>document.activeElement.id==='worldgen-terrain'&&parseFloat(getComputedStyle(document.activeElement).outlineWidth)>0));
 const textContrast=await lab.evaluate(()=>{
  const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number),luminance=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const background=luminance(rgb(getComputedStyle(document.getElementById('worldgen-panel')).backgroundColor));
  return ['#worldgen-panel summary','#worldgen-info'].map(selector=>{const color=luminance(rgb(getComputedStyle(document.querySelector(selector)).color));return (Math.max(color,background)+.05)/(Math.min(color,background)+.05);});
 });check('Inspector text contrast exceeds 4.5 to one',textContrast.every(n=>n>=4.5),textContrast);
 await lab.locator('#worldgen-panel summary').click();check('Collapsing the inspector clears the terrain view',await lab.locator('#worldgen-panel').evaluate(p=>!p.open&&p.getBoundingClientRect().height<60));await lab.locator('#worldgen-panel summary').click();
 await lab.locator('#worldgen-seed').focus();const editing=await lab.evaluate(()=>[WH.rig.lat,WH.rig.lon]);await lab.keyboard.down('ArrowRight');await lab.evaluate(()=>WH.step(.5));await lab.keyboard.up('ArrowRight');
 check('Editing a seed does not pan the world',JSON.stringify(await lab.evaluate(()=>[WH.rig.lat,WH.rig.lon]))===JSON.stringify(editing));
 for(const width of [390,768,1280]){
  await lab.setViewportSize({width,height:800});await lab.evaluate(()=>WH.step(.1));const layout=await lab.evaluate(()=>{const p=document.getElementById('worldgen-panel'),r=p.getBoundingClientRect();return {right:r.right,bottom:r.bottom,scroll:p.scrollWidth,width:p.clientWidth,body:document.body.scrollWidth};});
  check(`Generator fits ${width}px viewport`,layout.right<=width&&layout.bottom<=800&&layout.scroll<=layout.width+1&&layout.body<=width,layout);
 }
 await lab.screenshot({path:resolve(out,'generator-controls.png')});
 const oldUrl=lab.url();await lab.locator('#worldgen-seed').fill('0');await lab.getByRole('button',{name:'Load seed',exact:true}).click();
 check('Invalid seed gives an actionable error without losing the scene',lab.url()===oldUrl&&(await lab.locator('#worldgen-status').innerText()).includes('4294967295'));
 await lab.locator('#worldgen-new').click();await lab.waitForURL(url=>url.href!==oldUrl,{timeout:180000});await labReady(lab);await lab.evaluate(()=>{__qaFramesEnabled=false;WH.step(1);});
 const second=await fingerprint(lab);check('Generate world loads a new deterministic world',JSON.stringify(second)!==JSON.stringify(first));
 check('Previous seed remains in recent history',await lab.locator('#worldgen-history option').count()===2);
 await lab.locator('#worldgen-history').selectOption('1');await lab.waitForURL(url=>url.searchParams.get('seed')===new URL(oldUrl).searchParams.get('seed'),{timeout:180000});await labReady(lab);await lab.evaluate(()=>{__qaFramesEnabled=false;WH.step(1);});
 check('Recent history exactly replays accepted seed, base and heights',JSON.stringify(await fingerprint(lab))===JSON.stringify(first));
 await lab.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied fixture');}},configurable:true}));await lab.locator('#worldgen-copy').click();
 check('Denied clipboard exposes a selectable reproducible link',await lab.locator('#worldgen-link').isVisible()&&(await lab.locator('#worldgen-link').inputValue())===lab.url());
 await lab.locator('#worldgen-terrain').selectOption('alpine');await lab.locator('#worldgen-seed').fill('12345');await lab.getByRole('button',{name:'Load seed',exact:true}).click();await lab.waitForURL(url=>url.searchParams.get('terrain')==='alpine',{timeout:180000});await labReady(lab);await lab.evaluate(()=>{__qaFramesEnabled=false;WH.step(1);});
 check('Terrain selector loads Giant peaks and retains sandbox isolation',await lab.evaluate(()=>WH.CONFIG.terrainKey==='alpine'&&!WH.CONFIG.campaign&&WH.CONFIG.worldgen));
 await lab.locator('#worldgen-peak').click();await lab.evaluate(()=>WH.step(1));await lab.screenshot({path:resolve(out,'giant-peaks.png')});
 const alpine=await fingerprint(lab),playOpened=context.waitForEvent('page');await lab.locator('#worldgen-play').click();const play=await playOpened;await ready(play);
 check('Play this seed opens the normal sandbox with the same world',await play.evaluate(seed=>!WH.CONFIG.worldgen&&!WH.CONFIG.campaign&&WH.CONFIG.requestedSeed===seed,12345)&&JSON.stringify(await fingerprint(play))===JSON.stringify(alpine));await play.close();
 await lab.locator('#worldgen-terrain').selectOption('classic');await lab.getByRole('button',{name:'Load seed',exact:true}).click();await lab.waitForURL(url=>url.searchParams.get('map')==='giant',{timeout:180000});await labReady(lab);await lab.evaluate(()=>{__qaFramesEnabled=false;WH.step(1);});
 check('Classic whole-planet comparison uses the original terrain formula',await lab.evaluate(()=>WH.CONFIG.mapKey==='giant'&&!WH.CONFIG.terrain&&document.getElementById('worldgen-paths').disabled));
 await lab.screenshot({path:resolve(out,'classic-comparison.png')});
 // Playing a normal sandbox can write ordinary map preferences, so compare
 // campaign data specifically after that deliberate handoff.
 const after=await snapshot(page);check('Regeneration and play handoff preserve saved campaign bytes',Object.keys(saved).filter(k=>k.includes('Campaign')).every(k=>saved[k]===after[k]));
 await page.locator('#btn-begin').click();await page.evaluate(()=>{__qaFramesEnabled=false;});await page.locator('#btn-settings').click();const during=context.waitForEvent('page');await page.locator('#settings-pop .worldgen-launch').click();const extra=await during;await labReady(extra);
 check('In-game generator entry pauses the original battle',await page.evaluate(()=>WH.game.paused&&WH.game.state==='playing'));await extra.close();
}catch(error){faults.push(String(error));throw error;}
finally{await browser.close();writeFileSync(resolve(out,'results.json'),JSON.stringify({base,scope:'Normal UI navigation and deterministic render frames; forced clipboard denial only',checks,faults,pass:checks.every(c=>c.ok)&&!faults.length},null,2)+'\n');if(checks.some(c=>!c.ok)||faults.length)process.exitCode=1;}
