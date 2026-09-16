import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8141').replace(/\/$/,''),out=process.argv[2]||'artifacts/procgen-fast/public-game';mkdirSync(out,{recursive:true});
const oracle=JSON.parse(readFileSync('docs/qa/implementation/PROCGEN-FAST/final-results.json')).find(r=>r.theme==='arid'&&r.version==='before');
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],failedRequests=[];let report;
page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>failedRequests.push(r.url()));
try{
 await page.goto(base+'/?map=ninetynine&campaign=0&worldgen=1&seed=9137&planet=arid&terrain=canyon&generation=parallel',{timeout:180000,waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.WH?.worldgen||document.querySelector('#boot-status')?.textContent.startsWith('Boot failed'),null,{timeout:180000});
 report=await page.evaluate(async()=>{
  const n=WH.nav,hashes={},digest=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a))).map(x=>x.toString(16).padStart(2,'0')).join('');
  for(const k of ['dirs','pos','height','baseHeight','waterDepth','walk','floorWalk','block','dist','next','flow','airWalk','airDist','airNext','adjOff','adj','cost','airCost','layer','deckIndex'])if(n[k])hashes[k]=await digest(n[k]);
  for(const [k,a]of Object.entries(n.march||{}))if(ArrayBuffer.isView(a))hashes['march.'+k]=await digest(a);
  for(const [k,a]of Object.entries({terrain:WH.world.terrain.geometry.attributes.position.array,colors:WH.world.terrain.geometry.attributes.color.array,fog:WH.world.fogVeil?.mesh.geometry.attributes.position.array}))if(a)hashes[k]=await digest(a);
  const w=await import('./js/world.js'),{CONFIG}=await import('./js/config.js'),v=n.nodeDir(n.heartNode,WH.rig.camera.position.clone()).normalize(),axis=v.clone().set(-v.z,0,v.x).normalize();
  const compare=()=>{let mismatches=0;for(let i=0;i<n.n;i+=397){const d=n.nodeDir(i,v.clone()).normalize();CONFIG.fastGeneration=false;const expected=w.canFlyAt(d,w.FLIGHT_CLEARANCE+2);CONFIG.fastGeneration=true;if(w.canFlyAt(d,w.FLIGHT_CLEARANCE+2)!==expected)mismatches++;}return mismatches;};
  const before=compare(),shortcuts=w.clearanceMetrics.shortcuts;w.addTerrainFault(v,axis,v.clone().negate());const after=compare();
  return{seed:CONFIG.seed,n:n.n,heart:n.heartNode,portals:n.portalNodes,hashes,parallel:n.parallelMetrics,faultCheck:{before,after,shortcuts,faults:w.TERRAIN_FAULTS.length,noFaultShortcut:w.clearanceMetrics.shortcuts===shortcuts},camera:WH.camTest()};
 });
 report.mismatches=['seed','n','heart','portals','hashes'].filter(k=>JSON.stringify(report[k])!==JSON.stringify(oracle[k]));
 report.pass=report.camera.pass&&!report.mismatches.length&&!errors.length&&!failedRequests.length&&!report.parallel.failures.length&&report.parallel.batches>0&&report.faultCheck.shortcuts>0&&!report.faultCheck.before&&!report.faultCheck.after&&report.faultCheck.noFaultShortcut;
 await page.screenshot({path:out+'/runtime.png'});
}catch(error){report={...report,pass:false,failure:String(error)};}finally{await browser.close();writeFileSync(out+'/report.json',JSON.stringify({...report,errors,failedRequests},null,2));console.log(JSON.stringify({...report,hashes:undefined,parallel:report?.parallel?{batches:report.parallel.batches,failures:report.parallel.failures}:undefined,errors,failedRequests}));if(!report?.pass)process.exitCode=1;}
