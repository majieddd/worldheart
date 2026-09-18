import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=process.env.WH_BASE_URL||'http://127.0.0.1:8141',out=process.argv[2]||'artifacts/procgen-fast/lab';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{for(const width of [1280,390]){
 const page=await browser.newPage({viewport:{width,height:width===390?844:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(base+'/generation-lab.html');await page.waitForFunction(()=>document.querySelector('#parity').textContent.includes('match'));
 const options=await page.locator('#fixture option').count();
 for(let i=0;i<options;i++){
  await page.selectOption('#fixture',String(i));await page.waitForFunction(()=>[...document.querySelectorAll('.comparison img')].every(i=>i.complete&&i.naturalWidth>0));
  await page.selectOption('#view','before');await page.selectOption('#view','after');await page.selectOption('#view','wipe');
 }
 await page.selectOption('#fixture','0');await page.waitForFunction(()=>[...document.querySelectorAll('.comparison img')].every(i=>i.complete&&i.naturalWidth>0));await page.locator('#wipe').focus();await page.keyboard.press('ArrowRight');
 const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,range:document.querySelector('#wipe').value,focused:document.activeElement.id,candidate:document.querySelector('#open-after').href,reference:document.querySelector('#open-before').href,images:[...document.querySelectorAll('.comparison img')].map(i=>i.naturalWidth)}));
 await page.screenshot({path:out+`/lab-${width}.png`,fullPage:true});results.push({width,options,...state,errors});await page.close();
 if(state.overflow||state.range!=='51'||state.focused!=='wipe'||state.images.some(w=>!w)||errors.length)process.exitCode=1;
}}finally{await browser.close();writeFileSync(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));}
