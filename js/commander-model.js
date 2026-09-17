import * as THREE from '../lib/three.module.min.js';
import {GLTFLoader} from '../lib/addons/loaders/GLTFLoader.js';
const canvas=document.querySelector('canvas'),status=document.querySelector('#status');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color('#c7cbc8');
const camera=new THREE.PerspectiveCamera(34,1,.05,30),target=new THREE.Vector3(0,1.1,0);
scene.add(new THREE.HemisphereLight(0xeaf3ff,0x79717f,2));const sun=new THREE.DirectionalLight(0xffead1,2.4);sun.position.set(-3,5,4);scene.add(sun);
let yaw=.45,pitch=.12,distance=4.3,drag=null,model,contours=[];
function draw(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(target);renderer.render(scene,camera);}
function reset(){yaw=.45;pitch=.12;distance=4.3;draw();}
canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;yaw-=(e.clientX-drag[0])*.009;pitch=Math.max(-.6,Math.min(.9,pitch+(e.clientY-drag[1])*.006));drag=[e.clientX,e.clientY];draw();};canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(2.5,Math.min(7,distance+e.deltaY*.004));draw();},{passive:false});
canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key))return;e.preventDefault();yaw+=e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0;pitch=Math.max(-.6,Math.min(.9,pitch+(e.key==='ArrowUp'?.1:e.key==='ArrowDown'?-.1:0)));distance=Math.max(2.5,Math.min(7,distance+(e.key==='-'?.2:['+','='].includes(e.key)?-.2:0)));draw();};
document.querySelector('#reset').onclick=reset;document.querySelector('#ink').oninput=e=>{const n=+e.target.value;contours.forEach(o=>{o.visible=n>0;o.scale.copy(o.userData.baseScale).multiplyScalar((1+.018*n)/1.018);});draw();};
new ResizeObserver(draw).observe(canvas);
try{const gltf=await new GLTFLoader().loadAsync('../../lib/99-art/identity-v2/vey-blender.gltf');model=gltf.scene;model.traverse(o=>{if(o.isLight)o.visible=false;if(o.isMesh){if(o.name.includes('contour')){contours.push(o);o.userData.baseScale=o.scale.clone();}else if(o.material){o.material.roughness=.9;}}});scene.add(model);const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3());target.copy(center);draw();const maps=new Set();model.traverse(o=>{if(o.isMesh&&o.material?.map)maps.add(o.material.map.uuid);});window.COMMANDER_MODEL={ready:true,meshes:0,textures:maps.size,contours:contours.length};model.traverse(o=>{if(o.isMesh)window.COMMANDER_MODEL.meshes++;});status.textContent='Drag to orbit · Scroll to zoom · Unrigged Blender comparison';}catch(e){status.textContent='Model could not load: '+e.message;window.COMMANDER_MODEL={ready:false,error:e.message};}
