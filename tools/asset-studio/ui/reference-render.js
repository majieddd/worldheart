import * as THREE from '/lib/three.module.min.js';
import {ModelPreview} from '/js/asset-model-viewer.js';
const p=new ModelPreview(document.querySelector('canvas'),{contourMode:'silhouette'});
const url=new URL(location.href).searchParams.get('asset');if(!url?.startsWith('/files/projects/'))throw Error('Local project asset required');
await p.load(url);p.pauseRendering(true);p.playing=false;p.mixer.stopAllAction();p.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.pose();});p.root.updateMatrixWorld(true);
const box=new THREE.Box3().setFromObject(p.root),center=box.getCenter(new THREE.Vector3()),height=box.getSize(new THREE.Vector3()).length()*.64;
const camera=new THREE.OrthographicCamera(-height*.75,height*.75,height,-height,.01,100),basis={front:[0,0,1],left:[1,0,0],right:[-1,0,0],back:[0,0,-1],top:[0,1,0],bottom:[0,-1,0]};
p.renderer.setPixelRatio(1);p.renderer.setSize(768,1024,false);p.scene.background=new THREE.Color('#eeeee7');
const rest=new Map();p.root.traverse(o=>{if(o.isBone)rest.set(o.name,o.quaternion.clone());});
function pose(){p.mixer.stopAllAction();p.root.traverse(o=>{if(o.isBone&&rest.has(o.name))o.quaternion.copy(rest.get(o.name));});}
function view(name){pose();camera.up.set(0,1,0);if(name==='top')camera.up.set(0,0,-1);if(name==='bottom')camera.up.set(0,0,1);camera.position.copy(center).addScaledVector(new THREE.Vector3(...basis[name]),7);camera.lookAt(center);camera.updateProjectionMatrix();p.renderer.render(p.scene,camera);return {position:camera.position.toArray(),target:center.toArray(),up:camera.up.toArray(),orthographic:[camera.left,camera.right,camera.top,camera.bottom],resolution:[768,1024]};}
function motion(name,fraction){view('right');const clip=p.clips.find(c=>c.name.toLowerCase().startsWith(name.toLowerCase()));if(!clip)return {available:false,reason:'No '+name+' clip in this model'};p.mixer.clipAction(clip).reset().play();p.mixer.setTime(clip.duration*fraction);p.renderer.render(p.scene,camera);return {available:true,clip:clip.name,time:clip.duration*fraction};}
function strike(phase){
 view('right');const find=name=>{let match;p.root.traverse(o=>{if(o.isBone&&o.name.replace(/[^a-z0-9]/gi,'')===name)match=o;});return match;};const upper=find('upperarmR'),lower=find('forearmR'),hand=find('handR');
 if(!upper||!lower||!hand)return {available:false,reason:'Fit an arm profile before proposing a strike'};
 function aim(bone,child,direction){p.root.updateMatrixWorld(true);const current=child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize(),q=new THREE.Quaternion().setFromUnitVectors(current,direction.normalize()),world=bone.getWorldQuaternion(new THREE.Quaternion());q.multiply(world);bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));p.root.updateMatrixWorld(true);}
 // A separate, labeled palm-strike pose study. The accepted animation is untouched.
 const reach=[.15,1,.35][phase];aim(upper,lower,new THREE.Vector3(-.10,-.48+reach*.43,-.10+reach*.8));aim(lower,hand,new THREE.Vector3(.05,.18*(1-reach),.65));
 p.renderer.render(p.scene,camera);return {available:true,source:'authored pose proposal; not an approved or baked attack',phase:['anticipation','extension','recovery'][phase]};
}
window.REFERENCE_RENDER={ready:true,view,motion,strike,clips:p.clips.map(c=>c.name)};view('front');
