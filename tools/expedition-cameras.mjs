import {createRequire} from 'node:module';import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(process.env.WH_NODE_MODULES+'/package.json'),{chromium}=require('playwright'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8139';
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
for(const map of ['pocket','giant','titan','ninetynine','reach']){const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 try{await page.goto(base+'/?map='+map+'&campaign=0&seed=12345');await page.waitForFunction(()=>WH?.ui&&document.querySelector('#boot.done'),{},{timeout:180000});await page.locator('#btn-begin').click();const report=await page.evaluate(()=>{WH.rig.cancelFlight();WH.step(1);return WH.camTest();});results.push({map,report,errors});console.log(JSON.stringify({map,pass:report.pass,failed:report.checks.filter(c=>!c.ok),errors}));}
 catch(e){results.push({map,error:String(e),errors});console.log(map,String(e));}await page.close();}
mkdirSync('artifacts/expedition/cameras',{recursive:true});writeFileSync('artifacts/expedition/cameras/report.json',JSON.stringify(results,null,2));if(results.some(x=>!x.report?.pass||x.errors.length))process.exitCode=1;await browser.close();
