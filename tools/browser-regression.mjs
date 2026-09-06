// Optional Playwright runner; production remains dependency-free. Fixtures
// and camera harness results are recorded separately from unforced play.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const require=createRequire(process.env.WH_NODE_MODULES?resolve(process.env.WH_NODE_MODULES,'package.json'):import.meta.url);
const {chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/regression');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.WH_BROWSER||'chrome',headless:true});
const results=[];
try{
  for(const map of ['pocket','giant','titan','ninetynine','reach']){
    const page=await browser.newPage({viewport:{width:1280,height:720}}),faults=[];
    page.on('pageerror',e=>faults.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
    await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});});
    await page.goto(`http://127.0.0.1:8139/?map=${map}&seed=12345`);
    await page.waitForFunction(()=>window.WH?.game&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
    await page.evaluate(()=>{window.__qaFramesEnabled=false;WH.game.paused=true;});
    await page.screenshot({path:resolve(out,`${map}-title.png`)});
    const result=await page.evaluate(()=>{
      const b=document.getElementById('btn-begin').getBoundingClientRect();
      const card=document.querySelector('#title-overlay .overlay-card').getBoundingClientRect();
      const visible=b.top>=card.top&&b.bottom<=Math.min(card.bottom,innerHeight);
      document.getElementById('btn-begin').click();WH.game.paused=true;
      const camera=WH.camTest();
      return {map:WH.CONFIG.mapKey,seed:WH.CONFIG.seed,beginVisible:visible,camera};
    });
    if(map==='ninetynine'){
      result.defeat=await page.evaluate(()=>{
        WH.game.paused=false;const a=WH.allies.active.find(a=>a.type.commander);WH.allies.damage(a,a.hpMax*2);
        return {phase:WH.mode99.run.getPhase(),state:WH.game.state,overlay:document.getElementById('end-overlay').classList.contains('show')};
      });
      await page.screenshot({path:resolve(out,'defeat-fixture.png')});
      await page.getByRole('button',{name:'Same world',exact:true}).click();
      await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
      result.retry=await page.evaluate(()=>({phase:WH.mode99.run.getPhase(),wave:WH.mode99.run.getWave(),gold:WH.game.gold,lives:WH.game.lives,towers:WH.towers.towers.length,commander:WH.allies.active[0].hp,seed:WH.CONFIG.seed}));
    }
    result.faults=faults;result.pass=!faults.length&&result.beginVisible&&!result.camera.failed.length;
    if(result.retry)result.pass&&=result.defeat.phase==='defeat'&&result.defeat.overlay&&result.retry.phase==='building'&&result.retry.wave===1&&result.retry.lives===20&&result.retry.gold===450&&result.retry.towers===0&&result.retry.commander===1400;
    results.push(result);console.log(JSON.stringify({map,pass:result.pass,failed:result.camera.failed,faults}));await page.close();
  }
  writeFileSync(resolve(out,'results.json'),JSON.stringify(results,null,2)+'\n');
  if(results.some(r=>!r.pass))process.exitCode=1;
}finally{await browser.close();}
