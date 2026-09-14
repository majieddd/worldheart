import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/mobile/inspect');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(120000);
try{
 await page.goto((process.env.WH_BASE_URL||'http://127.0.0.1:8139')+'/?map=ninetynine&campaign=0&seed=12345&commander=marksman');
 await page.waitForFunction(()=>window.WH?.mobile&&document.querySelector('#boot.done'));
 await page.screenshot({path:resolve(out,'title.png')});await page.locator('#btn-begin').tap();await page.waitForTimeout(1800);
 await page.screenshot({path:resolve(out,'strategy.png')});await page.locator('#touch-commander').tap();await page.waitForTimeout(500);
 await page.screenshot({path:resolve(out,'commander.png')});await page.locator('#touch-menu-open').tap();
 await page.screenshot({path:resolve(out,'menu.png')});
 writeFileSync(resolve(out,'report.json'),JSON.stringify({errors,state:await page.evaluate(()=>({enabled:WH.mobile.enabled,active:WH.possession.active,html:document.querySelector('#touch-hud').outerHTML,overflow:document.body.scrollWidth,viewport:innerWidth}))},null,2));
}catch(e){errors.push(String(e));writeFileSync(resolve(out,'failure.json'),JSON.stringify(errors));await page.screenshot({path:resolve(out,'failure.png')});}finally{await browser.close();}console.log(JSON.stringify({errors}));if(errors.length)process.exitCode=1;
