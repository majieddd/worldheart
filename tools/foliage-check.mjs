import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/m4-foliage');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}}),faults=[];
 page.on('pageerror',e=>faults.push(String(e)));page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(window.__qaFramesEnabled)fn(t);});});
 await page.goto('http://127.0.0.1:8139/?map=ninetynine&seed=12345',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:120000});
 const results=await page.evaluate(async()=>{
   __qaFramesEnabled=false;WH.game.paused=true;document.getElementById('hud').style.display='none';document.getElementById('title-overlay').style.display='none';
   WH.world.fogVeil.mesh.visible=false;WH.world.fieldWall.mesh.visible=false;
   const T=await import('/lib/three.module.min.js');window.__foliageT=T;
   return WH.world.decor.sets.slice(0,2).map(set=>{
    const g=set.mesh.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),a=new T.Vector3(),b=a.clone(),c=a.clone(),normal=a.clone(),bad=[];
    for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1).sub(a);c.fromBufferAttribute(p,i+2).sub(a);normal.fromBufferAttribute(n,i);if(b.cross(c).dot(normal)<-1e-7)bad.push(i/3);}
    return {instances:set.mesh.count,triangles:p.count/3,reversedFaces:bad.length,flatShading:set.mesh.material.flatShading,shadowDeforms:!!set.mesh.customDepthMaterial};
   });
 });
 for(let set=0;set<2;set++)for(const angle of [0,Math.PI/2]){
  await page.evaluate(({set,angle})=>{
   const T=__foliageT,s=WH.world.decor.sets[set],matrix=new T.Matrix4();s.mesh.getMatrixAt(0,matrix);
   const center=new T.Vector3(0,1,0).applyMatrix4(matrix),up=center.clone().normalize();
   const offset=new T.Vector3(Math.sin(angle)*3.7,.8,Math.cos(angle)*3.7).transformDirection(matrix).multiplyScalar(4.2);
   const cam=WH.rig.camera;cam.near=.06;cam.fov=55;cam.position.copy(center).add(offset);cam.up.copy(up);cam.lookAt(center);cam.updateProjectionMatrix();cam.updateMatrixWorld();
   WH.world.update(2.5,cam.position);WH.post.render(WH.scene,cam,.016);
  },{set,angle});
  await page.screenshot({path:resolve(out,`${set?'broadleaf':'pine'}-${angle?90:0}.jpg`),quality:86});
 }
 writeFileSync(resolve(out,'foliage.json'),JSON.stringify({scope:'Close-up render fixtures with fog/UI hidden; winding checks are source geometry only',results,faults},null,2)+'\n');
 console.log(JSON.stringify({results,faults}));if(faults.length||results.some(r=>r.reversedFaces))process.exitCode=1;
}finally{await browser.close();}
