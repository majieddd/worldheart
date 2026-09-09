// Fixed effective seeds, independent of the navigation retry chooser. The
// inspection mesh samples the real field; whole-game route checks are separate.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const base=(process.env.WH_BASE_URL||'http://127.0.0.1:8139').replace(/\/$/,''),out=resolve(process.argv[2]||'artifacts/landforms');
const reference=process.argv[3]?JSON.parse(readFileSync(process.argv[3],'utf8')):null;
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[],faults=[],checks=[];
try {
 for(const profile of ['varied','alpine','canyon','ocean']) {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>faults.push(String(e)));
  await page.route('**/__landform__*',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"${base}/lib/three.module.min.js"}}</script></head><body style="margin:0;background:#0a0e21"><script type="module">window.field=await import('${base}/js/world.js');window.THREE=await import('three');</script></body></html>`}));
  await page.goto(`${base}/__landform__?map=ninetynine&campaign=0&terrain=${profile}`);
  await page.waitForFunction(()=>window.field&&window.THREE);
  for(const seed of [12345,51940,389884]) {
   const fixed=reference?.results.find(r=>r.profile===profile&&r.seed===seed)?.peakDir;
   const record=await page.evaluate(({seed,fixed})=>{
    const W=field,T=THREE,R=W.R;W.initTerrainField(seed);
    const v=new T.Vector3(),t=new T.Vector3(),q=new T.Vector3(),slopes=[],heights=[];
    let peak=-Infinity,low=Infinity,peakDir=null,steep=0,land=0;
    for(let i=0;i<6144;i++){
     const y=1-2*(i+.5)/6144,r=Math.sqrt(1-y*y),a=i*2.399963229728653;v.set(Math.cos(a)*r,y,Math.sin(a)*r);
     const h=W.terrainHeight(v.x,v.y,v.z,false);heights.push(h);low=Math.min(low,h);
     if(h>peak){peak=h;peakDir=v.toArray();}
     if(h<.13)continue;land++;
     t.set(0,1,0);if(Math.abs(v.y)>.93)t.set(1,0,0);t.addScaledVector(v,-t.dot(v)).normalize();
     let gradient=0;
     for(let axis=0;axis<2;axis++) {q.copy(v).addScaledVector(t,.5/R).normalize();const a=W.terrainHeight(q.x,q.y,q.z,false);q.copy(v).addScaledVector(t,-.5/R).normalize();const b=W.terrainHeight(q.x,q.y,q.z,false);gradient+=(a-b)**2;t.crossVectors(v,t).normalize();}
     const s=Math.sqrt(gradient);slopes.push(s);if(s>2)steep++;
    }
    slopes.sort((a,b)=>a-b);heights.sort((a,b)=>a-b);
    const center=new T.Vector3().fromArray(fixed||peakDir),e1=new T.Vector3(0,1,0);if(Math.abs(center.y)>.93)e1.set(1,0,0);e1.addScaledVector(center,-e1.dot(center)).normalize();const e2=new T.Vector3().crossVectors(center,e1).normalize();
    const transects=[];let worstCurvature=0,worstSlope=0;
    for(let k=0;k<4;k++){const a=k*Math.PI/4,bearing=e1.clone().multiplyScalar(Math.cos(a)).addScaledVector(e2,Math.sin(a)),h=[];
     for(let x=-100;x<=100;x+=.5){q.copy(center).multiplyScalar(Math.cos(x/R)).addScaledVector(bearing,Math.sin(x/R));h.push(W.terrainHeight(q.x,q.y,q.z,false));}
     for(let i=1;i<h.length-1;i++){worstCurvature=Math.max(worstCurvature,Math.abs(h[i+1]-2*h[i]+h[i-1])/.25);worstSlope=Math.max(worstSlope,Math.abs(h[i+1]-h[i-1]));}transects.push(h);
    }
    window.sample={center,e1,e2,seed};
    return {seed,peak,low,peakDir,inspectionDir:center.toArray(),land,steepFraction:steep/land,p95Slope:slopes[Math.floor(slopes.length*.95)],p99Slope:slopes[Math.floor(slopes.length*.99)],maxSlope:slopes.at(-1),p90Height:heights[Math.floor(heights.length*.9)],worstCurvature,worstSlope,transects};
   },{seed,fixed});
   record.profile=profile;results.push(record);
   const old=reference?.results.find(r=>r.profile===profile&&r.seed===seed);
   if(old){
    checks.push({name:`${profile}/${seed}: steepest one-percent slope reduced by at least 35 percent`,ok:record.p99Slope<old.p99Slope*.65,actual:{before:old.p99Slope,after:record.p99Slope}});
    checks.push({name:`${profile}/${seed}: abrupt bend on fixed old-peak transects reduced by at least 80 percent`,ok:record.worstCurvature<old.worstCurvature*.2,actual:{before:old.worstCurvature,after:record.worstCurvature}});
    checks.push({name:`${profile}/${seed}: retains at least 70 percent of sampled extreme elevation`,ok:record.peak>=old.peak*.7,actual:{before:old.peak,after:record.peak}});
   }
   if(seed===12345){
    await page.evaluate(()=>{
     const T=THREE,W=field,{center,e1,e2}=sample,positions=[],colors=[],v=new T.Vector3(),p=new T.Vector3();
     const point=(x,z)=>{v.copy(center).addScaledVector(e1,x/W.R).addScaledVector(e2,z/W.R).normalize();const h=W.terrainHeight(v.x,v.y,v.z);p.copy(v).multiplyScalar(W.R+h).addScaledVector(center,-W.R);const c=new T.Color(h<.13?0x17578f:h>38?0xe9f1fb:h>8?0x93a3ba:0x4ec98a);positions.push(p.dot(e1),p.dot(center),p.dot(e2));colors.push(c.r,c.g,c.b);};
     for(let x=-120;x<120;x+=3)for(let z=-120;z<120;z+=3){point(x,z);point(x,z+3);point(x+3,z);point(x+3,z);point(x,z+3);point(x+3,z+3);}
     const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
     const scene=new T.Scene();scene.background=new T.Color(0x0a0e21);scene.add(new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1})));scene.add(new T.HemisphereLight(0xd8e6fa,0x233127,2));const sun=new T.DirectionalLight(0xffe9c4,2.2);sun.position.set(-50,120,60);scene.add(sun);
     const camera=new T.PerspectiveCamera(46,1280/720,.5,1200);camera.position.set(160,130,190);camera.lookAt(0,15,0);const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1280,720);renderer.setPixelRatio(1);document.body.appendChild(renderer.domElement);renderer.render(scene,camera);
    });
    await page.screenshot({path:resolve(out,`${profile}.png`)});
    await page.evaluate(()=>document.querySelector('canvas')?.remove());
   }
   console.log(JSON.stringify({profile,seed,peak:record.peak,p99Slope:record.p99Slope,worstCurvature:record.worstCurvature}));
  }await page.close();
 }
}catch(e){faults.push(String(e));}
finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Exact seeded field samples and inspection mesh, independent of nav retries; not natural play',base,results,checks,faults},null,2)+'\n');console.log(JSON.stringify({passed:checks.filter(x=>x.ok).length,total:checks.length,failed:checks.filter(x=>!x.ok).map(x=>x.name),faults}));await browser.close();}
if(faults.length||checks.some(x=>!x.ok))process.exitCode=1;
