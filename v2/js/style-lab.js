import * as THREE from 'three';
import {recipes,createMaterialSystem} from './style-lab-materials.js';
import {createStudyScene} from './style-lab-scene.js';

const $=s=>document.querySelector(s),panels=[...document.querySelectorAll('.viewport')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const options={view:'world',focus:null,light:'sunset',outlines:true,textures:true,motion:!reduced.matches};
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas:$('#render'),antialias:true,preserveDrawingBuffer:true});}
catch(error){$('#loading').textContent='This study needs WebGL. Enable hardware acceleration and reload to view the 3D comparison.';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.autoClear=false;renderer.outputColorSpace=THREE.SRGBColorSpace;
const shadowTarget=new THREE.WebGLRenderTarget(1536,1536,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
shadowTarget.depthTexture=new THREE.DepthTexture(1536,1536,THREE.UnsignedIntType);
const lightCamera=new THREE.OrthographicCamera(-24,24,24,-24,0.5,95),shadowMatrix=new THREE.Matrix4();
const bias=new THREE.Matrix4().set(0.5,0,0,0.5,0,0.5,0,0.5,0,0,0.5,0.5,0,0,0,1);
const system=createMaterialSystem(shadowTarget.depthTexture,shadowMatrix),study=createStudyScene(system);
const depthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.BackSide});
const camera=new THREE.PerspectiveCamera(39,1,0.3,160);camera.layers.enable(1);
const backgroundScene=new THREE.Scene(),backgroundCamera=new THREE.Camera();
const skyMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{top:{value:new THREE.Color()},bottom:{value:new THREE.Color()},sun:{value:new THREE.Color()},sunset:{value:1},aspect:{value:1}},vertexShader:'varying vec2 uvSky;void main(){uvSky=uv;gl_Position=vec4(position.xy,0.99,1.0);}',fragmentShader:`varying vec2 uvSky;uniform vec3 top;uniform vec3 bottom;uniform vec3 sun;uniform float sunset;uniform float aspect;void main(){vec3 c=mix(bottom,top,smoothstep(0.0,1.0,uvSky.y));vec2 q=(uvSky-vec2(0.29,0.75))*vec2(aspect,1.0);float disc=1.0-smoothstep(0.113,0.117,length(q));c=mix(c,sun,disc*sunset*0.86);float grain=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);c*=1.0+(grain-0.5)*0.025;gl_FragColor=vec4(c,1.0);
#include <colorspace_fragment>
}`});
backgroundScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),skyMaterial));
let yaw=0.05,pitch=0.55,distance=35,time=0,last=performance.now(),frames=0,dirty=true,shadowDirty=true,lost=false;
let target=new THREE.Vector3(0,0.8,0),frameTimes=[],lastStats=0;
const defaults={world:{yaw:0.05,pitch:0.55,distance:39,target:[0,0.2,0]},ground:{yaw:0.05,pitch:0.13,distance:18,target:[-0.5,1.25,-1]},materials:{yaw:0.08,pitch:0.3,distance:24,target:[0,0.6,0]}};
function reset(){const d=defaults[options.view];yaw=d.yaw;pitch=d.pitch;distance=d.distance;target.set(...d.target);dirty=true;}
function setView(view){options.view=view;study.world.visible=view!=='materials';study.specimens.visible=view==='materials';document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));$('#gesture-hint').textContent=view==='materials'?'Left to right: stone · armor · foliage · crystal. Drag to orbit; scroll or + / - to zoom.':'Drag any scene to orbit all three · Scroll to zoom · Arrow keys also work';reset();shadowDirty=true;updateURL();}
function setFocus(id){options.focus=id;panels.forEach(p=>{p.hidden=!!id&&p.dataset.style!==id;});$('#stage').classList.toggle('focused',!!id);$('#compare').hidden=!id;document.querySelectorAll('[data-focus]').forEach(b=>{b.textContent=id?'Compare all ↙':'Inspect ↗';});dirty=true;updateURL();}
function updateURL(){const p=new URLSearchParams();if(options.focus)p.set('style',options.focus);if(options.view!=='world')p.set('view',options.view);if(options.light!=='sunset')p.set('light',options.light);history.replaceState(null,'',location.pathname+(p.size?'?'+p:''));}
function setLight(){const day=options.light==='day';system.shared.sunDirection.value.set(day?-0.5:-0.65,day?0.95:0.65,0.5).normalize();lightCamera.position.copy(system.shared.sunDirection.value).multiplyScalar(38);lightCamera.lookAt(0,0,0);lightCamera.updateMatrixWorld();shadowMatrix.copy(bias).multiply(lightCamera.projectionMatrix).multiply(lightCamera.matrixWorldInverse);dirty=true;shadowDirty=true;}
function updateMotion(){const b=$('#motion');b.textContent=options.motion?'Pause motion':'Play motion';b.setAttribute('aria-pressed',String(options.motion));dirty=true;}
function shadowPass(){renderer.setScissorTest(false);renderer.setRenderTarget(shadowTarget);renderer.setClearColor(0xffffff,1);renderer.clear();study.scene.overrideMaterial=depthMaterial;renderer.render(study.scene,lightCamera);study.scene.overrideMaterial=null;renderer.setRenderTarget(null);shadowDirty=false;}
function draw(){
  const stage=$('#stage').getBoundingClientRect();const width=Math.round(stage.width),height=Math.round(stage.height);
  if(renderer.domElement.width!==Math.round(width*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(height*renderer.getPixelRatio())){renderer.setSize(width,height,false);dirty=true;}
  if(shadowDirty||options.motion)shadowPass();
  renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.setClearColor(0x281b2c);renderer.clear();renderer.setScissorTest(true);
  let calls=0,triangles=0;
  for(let index=0;index<panels.length;index++){
    const panel=panels[index];if(panel.hidden)continue;const rect=panel.getBoundingClientRect(),w=Math.round(rect.width),h=Math.round(rect.height),x=Math.round(rect.left-stage.left),y=Math.round(stage.bottom-rect.bottom);
    renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);renderer.clear();
    camera.aspect=w/h;camera.updateProjectionMatrix();
    // A portrait comparison needs a wider distance than a full-width inspection.
    const fit=options.view==='materials'?1/camera.aspect:Math.max(1,1/camera.aspect*0.94);const d=distance*fit;
    camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*d,target.y+Math.sin(pitch)*d,target.z+Math.cos(yaw)*Math.cos(pitch)*d);camera.lookAt(target);
    system.apply(index,options,w,h);for(const shell of study.outlines)shell.visible=options.outlines;
    const day=options.light==='day',sky=skyMaterial.uniforms;
    sky.top.value.set(day?'#8ca9ba':index===0?'#a76b64':index===1?'#79634d':'#662b3d');sky.bottom.value.set(day?'#e4d6bd':index===0?'#efb989':index===1?'#d2a86b':'#e69370');sky.sun.value.set(index===2?'#f16654':'#f6c67e');sky.sunset.value=day?0:1;sky.aspect.value=camera.aspect;
    renderer.render(backgroundScene,backgroundCamera);renderer.render(study.scene,camera);calls+=renderer.info.render.calls;triangles+=renderer.info.render.triangles;
  }
  renderer.setScissorTest(false);frames++;dirty=false;
  window.STYLE_LAB.metrics={frames,calls,triangles,contexts:1,unitCount:study.units.length,towerCount:study.turrets.length,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};
}
function frame(now){requestAnimationFrame(frame);if(lost||document.hidden)return;const elapsed=now-last,dt=Math.min(elapsed/1000,1/30);last=now;if(options.motion){time+=dt;study.animate(time,true);dirty=true;}if(dirty)draw();if(options.motion&&frameTimes.length<600)frameTimes.push(elapsed);if(now-lastStats>1200){$('#render-status').textContent=options.motion?'Live 3D · synchronized':'Still frame · synchronized';lastStats=now;}}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.querySelectorAll('[data-focus]').forEach(b=>b.addEventListener('click',()=>setFocus(options.focus?null:b.dataset.focus)));
$('#compare').addEventListener('click',()=>setFocus(null));$('#reset').addEventListener('click',reset);
$('#motion').addEventListener('click',()=>{options.motion=!options.motion;updateMotion();});
$('#lighting').addEventListener('change',e=>{options.light=e.target.value;setLight();updateURL();});
for(const name of ['outlines','textures'])$('#'+name).addEventListener('change',e=>{options[name]=e.target.checked;dirty=true;});
$('#export').addEventListener('click',()=>{draw();const a=document.createElement('a');a.download='worldheart-'+(options.focus||'three-styles')+'-'+options.view+'.png';a.href=renderer.domElement.toDataURL('image/png');a.click();});
const pointers=new Map();
for(const p of panels){
  p.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;p.focus({preventScroll:true});pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,panel:p});p.setPointerCapture(e.pointerId);});
  p.addEventListener('pointermove',e=>{const prev=pointers.get(e.pointerId);if(!prev)return;const dx=e.clientX-prev.x,dy=e.clientY-prev.y;yaw-=dx*0.007;pitch=THREE.MathUtils.clamp(pitch+dy*0.004,0.04,1.35);prev.x=e.clientX;prev.y=e.clientY;dirty=true;});
  const release=e=>pointers.delete(e.pointerId);p.addEventListener('pointerup',release);p.addEventListener('pointercancel',release);p.addEventListener('lostpointercapture',release);
  p.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance*Math.exp(e.deltaY*0.001),8,60);dirty=true;},{passive:false});
  p.addEventListener('keydown',e=>{if(e.target!==p)return;let handled=true;switch(e.key){case 'ArrowLeft':yaw-=0.1;break;case 'ArrowRight':yaw+=0.1;break;case 'ArrowUp':pitch= Math.min(1.35,pitch+0.08);break;case 'ArrowDown':pitch=Math.max(0.04,pitch-0.08);break;case '+':case '=':distance=Math.max(8,distance*0.9);break;case '-':distance=Math.min(60,distance*1.1);break;case 'Home':reset();break;default:handled=false;}if(handled){e.preventDefault();dirty=true;}});
}
window.addEventListener('blur',()=>pointers.clear());window.addEventListener('resize',()=>{dirty=true;});
document.addEventListener('visibilitychange',()=>{last=performance.now();dirty=true;});
reduced.addEventListener('change',e=>{if(e.matches){options.motion=false;updateMotion();}});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;$('#loading').hidden=false;$('#loading').textContent='The graphics context was interrupted. Restore this tab or reload to continue.';});
renderer.domElement.addEventListener('webglcontextrestored',()=>{lost=false;shadowDirty=true;dirty=true;$('#loading').hidden=true;});
window.STYLE_LAB={options,metrics:{},get camera(){return {yaw,pitch,distance,target:target.toArray()};},get time(){return time;},get frameTimes(){return frameTimes.slice();},recipes:recipes.map(r=>({...r})),render:()=>{dirty=true;draw();}};
const initial=new URLSearchParams(location.search),initialStyle=initial.get('style'),initialView=initial.get('view');
if(['anime','ink','hybrid'].includes(initialStyle))setFocus(initialStyle);
if(['world','ground','materials'].includes(initialView))setView(initialView);
if(initial.get('light')==='day'){options.light='day';$('#lighting').value='day';}
reset();setLight();updateMotion();updateURL();study.animate(0,false);draw();$('#loading').hidden=true;requestAnimationFrame(frame);
