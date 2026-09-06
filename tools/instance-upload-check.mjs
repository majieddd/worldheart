// Read actual WebGL uploads for packed actor buffers, including shrink/reuse.
import{createRequire}from'node:module';import{resolve}from'node:path';import{mkdirSync,writeFileSync}from'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/instance-uploads');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),checks=[],faults=[];
try{
 page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 await page.goto(`${process.env.WH_BASE_URL||'http://127.0.0.1:8139'}/?map=ninetynine&seed=12345&campaign=0`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
 const records=await page.evaluate(async()=>{
  __qaFramesEnabled=false;document.getElementById('btn-begin').click();const W=WH;W.game.paused=true;
  const THREE=await import(new URL('lib/three.module.min.js',location.href)),{surfacePoint}=await import(new URL('js/world.js',location.href));
  for(let i=0;i<100;i++)W.enemies.spawn(['mite','husk','wisp','aegis'][i%4],W.nav.heartNode,1);
  W.enemies._render(0);W.allies._render(0);W.post.render(W.scene,W.rig.camera,0);
  const gl=W.renderer.getContext(),original=gl.bufferSubData,uploads=[];
  gl.bufferSubData=function(target,offset,data,srcOffset=0,length){
   const result=original.apply(this,arguments);
   if(target===gl.ARRAY_BUFFER&&ArrayBuffer.isView(data)){
    const count=length??data.length,actual=new data.constructor(count);
    gl.getBufferSubData(target,offset,actual);
    let equal=true;for(let i=0;i<count;i++)if(actual[i]!==data[srcOffset+i]){equal=false;break;}
    uploads.push({array:data,bytes:count*data.BYTES_PER_ELEMENT,equal});
   }
   return result;
  };
  const results=[];
  for(const phase of ['full','shrunk','empty','reused']){
   if(phase==='shrunk')for(const e of [...W.enemies.active].slice(7))W.enemies._release(e);
   if(phase==='empty')for(const e of [...W.enemies.active])W.enemies._release(e);
   if(phase==='reused')for(let i=0;i<13;i++)W.enemies.spawn(['mite','wisp'][i%2],W.nav.heartNode,1);
   uploads.length=0;W.enemies._render(.016);W.allies._render(.016);W.post.render(W.scene,W.rig.camera,0);
   const matrices=new Map();W.scene.traverse(o=>{if(o.isInstancedMesh&&o.instanceMatrix)matrices.set(o.instanceMatrix.array,{count:o.count,name:o.name});});
   const actorUploads=uploads.filter(x=>matrices.has(x.array));
   results.push({phase,active:W.enemies.active.length,totalBytes:uploads.reduce((sum,x)=>sum+x.bytes,0),matrixBytes:actorUploads.reduce((sum,x)=>sum+x.bytes,0),writes:uploads.length,gpuMatches:uploads.every(x=>x.equal),oversized:actorUploads.filter(x=>x.bytes>matrices.get(x.array).count*16*4).map(x=>({bytes:x.bytes,count:matrices.get(x.array).count}))});
  }
  gl.bufferSubData=original;
  const field=W.possession.caches,c=field.caches[0],oldDir=c.dir.clone();
  let cache=null;
  if(field._surface){
   const before=field._surface(c,new THREE.Vector3()),expected=surfacePoint(c.dir,new THREE.Vector3());
   c.dir.applyAxisAngle(new THREE.Vector3(0,1,0),.001);const changed=field._surface(c,new THREE.Vector3());
   cache={same:before.distanceTo(expected)<1e-12,invalidated:changed.distanceTo(surfacePoint(c.dir,new THREE.Vector3()))<1e-12&&changed.distanceTo(before)>.001};
   c.dir.copy(oldDir);field._surface(c,new THREE.Vector3());
  }
  const n=W.nav,dir=n.nodeDir(n.heartNode,new THREE.Vector3()),dijkstra=n._dijkstra;let calls=0;n._dijkstra=function(...args){calls++;return dijkstra.apply(this,args);};const path=n.findPath(dir,dir);n._dijkstra=dijkstra;
  return {results,cache,sameNode:{calls,path:[...path],cost:path.cost,heart:n.heartNode}};
 });
 for(const record of records.results){checks.push({name:`${record.phase}: real GPU values match written transforms`,ok:record.gpuMatches,actual:record});checks.push({name:`${record.phase}: packed matrices upload only their live prefix`,ok:record.oversized.length===0});}
 checks.push({name:'Static cache positions stay exact and invalidate on movement',ok:records.cache?.same&&records.cache?.invalidated,actual:records.cache});
 checks.push({name:'A same-cell route avoids searching the whole graph',ok:records.sameNode.calls===0&&records.sameNode.cost===0&&records.sameNode.path.length===1,actual:records.sameNode});
 await page.screenshot({path:resolve(out,'reused-actors.png')});
}catch(error){faults.push(String(error));}
finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Injected actor population and direct GPU buffer readback; not a campaign or timing benchmark.',checks,faults},null,2)+'\n');console.log(JSON.stringify({passed:checks.filter(x=>x.ok).length,total:checks.length,failed:checks.filter(x=>!x.ok),faults}));await browser.close();}
if(faults.length||checks.some(x=>!x.ok))process.exitCode=1;
