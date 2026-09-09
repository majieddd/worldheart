// Render the actual shared soldier rig at controlled phases, from a clear
// three-quarter review camera. This is an art fixture, not an FPS benchmark.
import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';import {spawn} from 'node:child_process';import {once} from 'node:events';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),{chromium}=require('playwright');
const out=resolve(process.argv[2]||'artifacts/slash-review'),base=process.env.WH_BASE_URL||'http://127.0.0.1:8139';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),faults=[];
try{
 const page=await browser.newPage({viewport:{width:960,height:720}});page.on('pageerror',e=>faults.push(String(e)));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__qaFramesEnabled=true;window.requestAnimationFrame=fn=>raf(t=>{if(__qaFramesEnabled)fn(t);});});
 await page.goto(`${base}/?map=ninetynine&campaign=0&seed=12345`);await page.waitForFunction(()=>window.WH?.mode99&&document.getElementById('boot').classList.contains('done'),{},{timeout:180000});
 await page.evaluate(async()=>{
  __qaFramesEnabled=false;document.getElementById('btn-begin').click();WH.game.paused=true;
  const T=await import('/lib/three.module.min.js'),{poseSoldier,freshSoldierState}=await import('/js/soldier.js'),sp=WH.allies.species.commander;
  const scene=new T.Scene();scene.background=new T.Color(0x101629);scene.add(new T.HemisphereLight(0xd8e6fa,0x233127,2));const sun=new T.DirectionalLight(0xffe9c4,2.2);sun.position.set(-3,5,-2);scene.add(sun);
  const parts=[];for(const p of sp.parts)for(const at of p.at){const mesh=new T.Mesh(p.mesh.geometry,p.mesh.material);mesh.matrixAutoUpdate=false;scene.add(mesh);parts.push({mesh,at});}
  const cam=new T.PerspectiveCamera(43,960/720,.05,40);cam.position.set(2.1,1.7,-3.6);cam.lookAt(0,.65,0);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(960,720);const cover=document.createElement('div');cover.style.cssText='position:fixed;inset:0;z-index:999999;background:#101629';cover.appendChild(renderer.domElement);document.body.appendChild(cover);
  const label=document.createElement('div');label.style.cssText='position:absolute;top:24px;left:28px;color:#e8ecf8;font:18px system-ui';cover.appendChild(label);
  const a={type:{strike:{kind:'melee'}},swingDur:.85,swingT:0,phase:0};
  window.reviewPose=(phase,side)=>{a.swingT=.85*(1-phase);a.swingSide=side;poseSoldier(sp.skeleton,sp.spec,a,freshSoldierState(),0);sp.skeleton.compute(new T.Matrix4());for(const {mesh,at}of parts)mesh.matrix.multiplyMatrices(at.joint.world,at.off);label.textContent=`Sword slash / ${side>0?'forehand':'backhand'} / ${Math.round(phase*100)}%`;renderer.render(scene,cam);};
  reviewPose(0,1);
 });
 for(const side of [1,-1])for(const phase of [0,.24,.36,.4,.44,.56,.8]){await page.evaluate(({phase,side})=>reviewPose(phase,side),{phase,side});await page.screenshot({path:resolve(out,`slash-${side}-${phase}.jpg`),quality:86});}
 const encoder=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-framerate','30','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',resolve(out,'slash.mp4')],{windowsHide:true,stdio:['pipe','ignore','pipe']});let errors='';encoder.stderr.on('data',d=>errors+=d);const closed=once(encoder,'close');
 for(let frame=0;frame<120;frame++){await page.evaluate(f=>reviewPose((f%60)/60,f<60?1:-1),frame);const data=await page.screenshot({type:'jpeg',quality:88});if(!encoder.stdin.write(data))await once(encoder.stdin,'drain');}
 encoder.stdin.end();const [code]=await closed;if(code)throw Error(errors);
}catch(e){faults.push(String(e));}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Actual rig, geometry and material, slowed controlled phase review with an isolated camera',faults},null,2)+'\n');console.log(JSON.stringify({faults}));await browser.close();}if(faults.length)process.exitCode=1;
