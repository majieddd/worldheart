// Native exhibition load. No game state or campaign acceptance is inferred.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/debug-performance'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8139';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),faults=[],records=[];
page.on('pageerror',e=>faults.push(String(e)));
try{
 await page.goto(base+'/debug.html');await page.waitForFunction(()=>window.DEBUG_WORLD,{},{timeout:120000});
 for(const mode of ['all lanes','animated units']){
  if(mode==='all lanes')await page.locator('#overview').click();
  else{await page.locator('[data-lane="units"]').click();await page.locator('#motion').selectOption('walk');await page.locator('#row').click();}
  await page.waitForTimeout(1500);
  const record=await page.evaluate(()=>new Promise(resolve=>{
    const dt=[],load=[],start=performance.now(),units=DEBUG_WORLD.lanes[0].items,seen=units.map(()=>new Set());let last=start;
    function frame(now){
      dt.push(now-last);last=now;for(let i=0;i<units.length;i++)seen[i].add(units[i].group.userData.animation);
      if(dt.length%60===0)load.push({...DEBUG_WORLD.renderer.info.render});if(now-start<15000)return requestAnimationFrame(frame);
      dt.sort((a,b)=>a-b);resolve({frames:dt.length,p50:dt[Math.floor(dt.length*.5)],p99:dt[Math.floor(dt.length*.99)],max:dt.at(-1),load,clips:units.map((e,i)=>({key:e.key,names:[...seen[i]]}))});
    }requestAnimationFrame(frame);
  }));
  records.push({mode,...record});console.log(JSON.stringify({mode,frames:record.frames,p50:record.p50,p99:record.p99}));
 }
}finally{await browser.close();}
const pass=!faults.length&&records.length===2&&records.every(r=>r.p50<=16.8&&r.p99<=33.4)&&records[0].clips.every(c=>c.names.length>=7);
writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Two 15-second native Debug World render fixtures at 1280x720, this machine only',records,faults,pass},null,2));if(!pass)process.exitCode=1;
