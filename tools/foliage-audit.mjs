// Geometry and real-render inspection across every map and campaign terrain.
// The camera is a diagnostic fixture; this does not represent ordinary play.
import {createRequire} from 'node:module';import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/foliage-audit');mkdirSync(out,{recursive:true});
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139/').replace(/\/?$/,'/');
const browser=await chromium.launch({channel:'chrome',headless:true}),records=[],faults=[];
try{
 for(const mode of ['pocket','giant','titan','reach','varied','alpine','canyon','ocean']){
  const context=await browser.newContext(),page=await context.newPage({viewport:{width:960,height:720}});
  page.on('pageerror',e=>faults.push({mode,error:String(e)}));page.on('console',m=>{if(m.type()==='error')faults.push({mode,error:m.text()});});
  await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
  const campaign=['varied','alpine','canyon','ocean'].includes(mode);
  await page.goto(`${base}?map=${campaign?'ninetynine':mode}&terrain=${mode}&seed=12345&campaign=0`,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.WH?.game&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
  const record=await page.evaluate(async()=>{
    __qaFramesEnabled=false;WH.game.paused=true;
    document.getElementById('hud').style.display='none';document.getElementById('title-overlay').style.display='none';
    WH.world.fogVeil&&(WH.world.fogVeil.mesh.visible=false);WH.world.fieldWall&&(WH.world.fieldWall.mesh.visible=false);
    const T=await import(new URL('lib/three.module.min.js',location.href));window.__foliageT=T;
    const sets=WH.world.decor.sets.map((set,index)=>{
      const g=set.mesh.geometry,p=g.getAttribute('position'),normal=g.getAttribute('normal'),a=new T.Vector3(),b=a.clone(),c=a.clone(),n=a.clone(),matrix=new T.Matrix4();
      let reversed=0,invalid=0,degenerate=0,minArea=Infinity,badInstances=0;
      for(let i=0;i<p.count;i+=3){
        a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1).sub(a);c.fromBufferAttribute(p,i+2).sub(a);n.fromBufferAttribute(normal,i);
        const cross=b.cross(c),area=cross.length();
        if(![a.x,a.y,a.z,n.x,n.y,n.z,area].every(Number.isFinite))invalid++;
        if(area<1e-10)degenerate++;else{minArea=Math.min(minArea,area);if(cross.dot(n)<-1e-7)reversed++;}
      }
      for(let i=0;i<set.mesh.count;i++){set.mesh.getMatrixAt(i,matrix);if(!matrix.elements.every(Number.isFinite)||matrix.determinant()<=0)badInstances++;}
      const color=set.mesh.material.userData.swayUniforms,depth=set.mesh.customDepthMaterial?.userData.swayUniforms;
      return {kind:['pine','broadleaf','rock','crystal'][index],instances:set.mesh.count,triangles:p.count/3,reversed,invalid,degenerate,minArea,badInstances,windShadowUniformsShared:index>1||color===depth};
    });
    return {seed:WH.CONFIG.seed,map:WH.CONFIG.map.key,terrain:WH.CONFIG.terrainKey,sets};
  });
  for(let set=0;set<4;set++){
    if(!record.sets[set].instances)continue;
    for(const [view,angle,time,distance] of [['front',0,0,2.8],['side',Math.PI/2,1.16,2.8],['near',Math.PI,2.33,1.1]]){
      await page.evaluate(({set,angle,time,distance})=>{
        const T=__foliageT,s=WH.world.decor.sets[set],m=new T.Matrix4();s.mesh.getMatrixAt(0,m);
        const center=new T.Vector3(0,set<2?.8:.25,0).applyMatrix4(m),up=new T.Vector3(0,1,0).transformDirection(m);
        const offset=new T.Vector3(Math.sin(angle),.18,Math.cos(angle)).transformDirection(m).multiplyScalar(distance);
        const cam=WH.rig.camera;cam.near=.08;cam.far=900;cam.fov=55;cam.position.copy(center).add(offset);cam.up.copy(up);cam.lookAt(center);cam.updateProjectionMatrix();cam.updateMatrixWorld();
        const uniforms=WH.world.decor.treeMat.userData.swayUniforms;uniforms.uTime.value=time;
        WH.post.render(WH.scene,cam,.016);
      },{set,angle,time,distance});
      if(view!=='near'||set<2)await page.screenshot({path:resolve(out,`${mode}-${record.sets[set].kind}-${view}.jpg`),quality:82});
    }
  }
  record.pass=record.sets.every(s=>!s.reversed&&!s.invalid&&!s.badInstances&&s.windShadowUniformsShared);
  records.push({mode,...record});console.log(JSON.stringify({mode,pass:record.pass,counts:record.sets.map(s=>s.instances)}));
  await context.close();
 }
}catch(error){faults.push({error:String(error)});}
finally{
 writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Eight-map geometry and near/orbit render fixtures; primitive pole degeneracies reported, not falsely called reversed faces',base,records,faults},null,2)+'\n');
 await browser.close();
}
if(records.length!==8||records.some(r=>!r.pass)||faults.length)process.exitCode=1;
