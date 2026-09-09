// Test camera occlusion against the real instance geometry, not arbitrary
// points above every piece of decor. Body movement remains a separate test.
import{createRequire}from'node:module';import{resolve}from'node:path';import{mkdirSync,writeFileSync}from'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/decor-clearance');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],faults=[];
try{const page=await browser.newPage();page.on('pageerror',e=>faults.push(String(e)));await page.goto(`${base}/?map=ninetynine&campaign=0&seed=12345`);await page.waitForFunction(()=>window.WH?.world?.decor&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
 checks.push(...await page.evaluate(async()=>{const T=await import(new URL('lib/three.module.min.js',location.href)),{R}=await import(new URL('js/world.js',location.href)),w=WH.world,sets=w.decor.sets,checks=[];
  try{for(const which of [0,1,2]){const set=sets[which];set.mesh.geometry.computeBoundingBox();set.mesh.geometry.computeBoundingSphere();let count=0;
   for(let i=0;i<set.list.length&&count<3;i++){const it=set.list[i],g=set.mesh.geometry,m=new T.Matrix4();if(!it.alive||which===2&&g.boundingSphere.radius*it.s>1.1)continue;set.mesh.getMatrixAt(i,m);w.decor.sets=[{...set,list:[it]}];const center=g.boundingBox.getCenter(new T.Vector3()).applyMatrix4(m),t=new T.Vector3(1,0,0).transformDirection(m),a=center.clone().addScaledVector(t,-4),b=center.clone().addScaledVector(t,4);const through=w.decorHit(a,b,.2);checks.push({name:`${which===0?'pine':which===1?'broadleaf':'rock'} ${count}: trees pass through and rocks occlude the boom`,ok:which===2?through>=0&&through<=1:through<0,actual:through});
    if(which===2){const above=it.dir.clone().multiplyScalar(R+it.h+2.5),clear=w.decorHit(a.copy(above).addScaledVector(t,-4),b.copy(above).addScaledVector(t,4),.2);checks.push({name:`rock ${count}: empty space above actual geometry leaves boom clear`,ok:clear<0,actual:{clear,radius:g.boundingSphere.radius*it.s,scale:it.s}});}
    it.alive=false;const gone=w.decorHit(a,b,.2);it.alive=true;checks.push({name:`decor ${which}/${count}: crushed objects cannot hold the camera`,ok:gone<0});count++;
   }
  }}finally{w.decor.sets=sets;}return checks;}));
}catch(e){faults.push(String(e));}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Isolated real decor instances and geometry probes',checks,faults},null,2)+'\n');console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,total:checks.length,failed:checks.filter(c=>!c.ok).map(c=>c.name),faults}));await browser.close();}if(faults.length||checks.some(c=>!c.ok))process.exitCode=1;
