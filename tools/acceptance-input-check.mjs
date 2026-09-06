// Actual keyboard interaction against an isolated inventory fixture. Setup
// items are explicit; none of these assertions counts as campaign progress.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json'));
const {chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/acceptance-input');mkdirSync(out,{recursive:true});
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139/').replace(/\/?$/,'/');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),checks=[],faults=[];
const check=(name,ok,actual)=>checks.push({name,ok:!!ok,actual});
page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
async function tabTo(selector){
  for(let i=0;i<160;i++){
    if(await page.evaluate(s=>document.activeElement?.matches(s),selector))return true;
    await page.keyboard.press('Tab');
  }return false;
}
try{
  await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
  await page.goto(`${base}?map=ninetynine&seed=12345&campaign=1`,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
  await page.evaluate(async()=>{
    __qaFramesEnabled=false;document.getElementById('btn-begin').click();WH.game.paused=false;
    const {generateWeapon}=await import(new URL('js/run/weapons.js',location.href));
    const {makeRng}=await import(new URL('js/run/rng.js',location.href));
    for(let i=0;i<8;i++){
      const item=generateWeapon({id:'acceptance-'+i,family:'sword',seed:42+i,rng:makeRng(42+i)});
      item.parts={head:'balanced',grip:'balanced',core:'tempered'};
      WH.mode99.inventory.register(item);WH.mode99.inventory.pickup(item.id);
    }
  });
  await page.keyboard.press('i');
  check('I opens an actual modal with focus and pauses the battle',await page.evaluate(()=>document.querySelector('#weapon-dialog').open&&document.activeElement?.dataset.action==='close'&&WH.game.paused));
  check('Tab reaches customization without a pointer',await tabTo('#weapon-dialog details summary'));
  await page.keyboard.press('Enter');await page.keyboard.press('Tab');
  const select=await page.evaluate(()=>({id:document.activeElement.dataset.id,part:document.activeElement.dataset.part,value:document.activeElement.value,scroll:document.querySelector('#weapon-dialog').scrollTop}));
  await page.keyboard.press('ArrowDown');
  check('Keyboard part fitting preserves focus on the same control',await page.evaluate(s=>document.activeElement.dataset.id===s.id&&document.activeElement.dataset.part===s.part,select),await page.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.dataset.id,part:document.activeElement.dataset.part})));
  check('Keyboard part fitting commits the selected value',await page.evaluate(s=>WH.mode99.inventory.items.find(x=>x.id===s.id).parts[s.part]!==s.value,select));
  check('Part fitting preserves expanded controls and scroll position',await page.evaluate(s=>[...document.querySelectorAll('#weapon-dialog details[open]')].some(x=>x.dataset.item===s.id)&&Math.abs(document.querySelector('#weapon-dialog').scrollTop-s.scroll)<3,select));
  check('Tab reaches a carried item equip action',await tabTo('[data-action="equip"][data-id="acceptance-5"][data-slot="0"]'));
  await page.keyboard.press('Enter');
  check('Equipping by keyboard keeps focus with the moved item',await page.evaluate(()=>WH.mode99.inventory.slots[0]==='acceptance-5'&&document.activeElement.dataset.id==='acceptance-5'&&document.querySelector('#weapon-dialog').contains(document.activeElement)));
  await page.screenshot({path:resolve(out,'keyboard-equipment.png')});
  check('Tab reaches salvage on a carried item',await tabTo('[data-action="salvage"][data-id="acceptance-6"]'));
  await page.keyboard.press('Enter');
  check('Removing a focused item moves focus to another usable inventory control',await page.evaluate(()=>!WH.mode99.inventory.items.some(x=>x.id==='acceptance-6')&&document.activeElement?.matches('button,select,summary')&&document.querySelector('#weapon-dialog').contains(document.activeElement)));
  await page.evaluate(()=>WH.step(.5));
  const cameraBefore=await page.evaluate(()=>({lon:WH.rig.lon,lat:WH.rig.lat,gold:WH.game.gold,paused:WH.game.paused}));
  for(const key of ['w','1','b','p','x','c'])await page.keyboard.press(key);
  await page.evaluate(()=>WH.step(.25));
  const cameraAfter=await page.evaluate(()=>({lon:WH.rig.lon,lat:WH.rig.lat,gold:WH.game.gold,paused:WH.game.paused,build:WH.game.buildType}));
  check('Inventory owns movement/build/pause/sell/deposit shortcuts',cameraAfter.paused===cameraBefore.paused&&cameraAfter.gold===cameraBefore.gold&&!cameraAfter.build&&Math.abs(cameraAfter.lon-cameraBefore.lon)<1e-8&&Math.abs(cameraAfter.lat-cameraBefore.lat)<1e-8,{before:cameraBefore,after:cameraAfter});
  await page.keyboard.press('Escape');
  check('Escape closes inventory and restores the previous running state',await page.evaluate(()=>!document.querySelector('#weapon-dialog').open&&!WH.game.paused&&!WH.possession.suspended));
  await page.evaluate(()=>WH.game.paused=true);await page.keyboard.press('i');await page.keyboard.press('Escape');
  check('Opening and closing from pause keeps the game paused',await page.evaluate(()=>WH.game.paused));
  await page.keyboard.press('i');
  for(const viewport of [{width:1280,height:720},{width:1920,height:1080},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    const layout=await page.evaluate(()=>{
      const d=document.querySelector('#weapon-dialog'),r=d.getBoundingClientRect();
      return {width:innerWidth,dialog:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},overflow:d.scrollWidth>d.clientWidth+1,pageOverflow:document.body.scrollWidth>innerWidth};
    });
    check(`Inventory is readable without horizontal scrolling at ${viewport.width}x${viewport.height}`,!layout.overflow&&!layout.pageOverflow&&layout.dialog.left>=0&&layout.dialog.right<=viewport.width,layout);
    await page.screenshot({path:resolve(out,`inventory-${viewport.width}.png`)});
  }
}catch(error){check('Harness completed',false,String(error));process.exitCode=1;}
finally{
  const result={scope:'Keyboard/viewport fixtures with explicit inventory setup, not natural play',base,checks,faults};
  writeFileSync(resolve(out,'results.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({passed:checks.filter(x=>x.ok).length,total:checks.length,failed:checks.filter(x=>!x.ok),faults},null,2));
  await browser.close();
}
if(faults.length||checks.some(x=>!x.ok))process.exitCode=1;
