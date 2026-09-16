import * as THREE from 'three';
import {GLTFLoader} from '../art-candidates/hard-cel-v1/lib/addons/loaders/GLTFLoader.js';

const median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)]||0;

// Reuse authored skeletal clips. Sample the planted foot's backward travel to
// couple movement and playback, rather than estimating speed from limb length.
function calibrate(root,mixer,clip,feet){
  mixer.stopAllAction();const action=mixer.clipAction(clip).play(),samples=160,tracks=feet.map(()=>[]);
  for(let i=0;i<=samples;i++){mixer.setTime(clip.duration*i/samples);root.updateMatrixWorld(true);feet.forEach((f,n)=>tracks[n].push(f.getWorldPosition(new THREE.Vector3())));}
  const values=[];for(const track of tracks){const signed=[];for(let i=1;i<track.length;i++)signed.push((track[i].z-track[i-1].z)*samples/clip.duration);const pos=signed.filter(v=>v>.02),neg=signed.filter(v=>v<-.02).map(Math.abs);const stance=median(pos)<median(neg)?pos:neg;values.push(...stance);}
  action.stop();mixer.setTime(0);return Math.max(.3,median(values));
}

function animatedContour(mesh,paint){
  const template=paint.shells[0].material;
  const material=new THREE.ShaderMaterial({side:THREE.BackSide,uniforms:template.uniforms,fragmentShader:template.fragmentShader,vertexShader:`
uniform vec2 resolution;uniform float lineWidth;
#include <common>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
void main(){
#include <beginnormal_vertex>
#include <morphnormal_vertex>
#include <skinbase_vertex>
#include <skinnormal_vertex>
#include <begin_vertex>
#include <morphtarget_vertex>
#include <skinning_vertex>
vec4 mv=modelViewMatrix*vec4(transformed,1.0);vec3 n=normalize(normalMatrix*objectNormal);
vec4 clip=projectionMatrix*mv;vec2 d=(projectionMatrix*vec4(n,0.0)).xy;float len=length(d);
if(len>.0001)clip.xy+=d/len*lineWidth*2.0/resolution*clip.w;
clip.z+=.000015*clip.w;gl_Position=clip;
}`});
  const shell=mesh.isSkinnedMesh?new THREE.SkinnedMesh(mesh.geometry,material):new THREE.Mesh(mesh.geometry,material);
  shell.name='Animated ink contour';shell.layers.set(1);shell.frustumCulled=false;
  if(mesh.isSkinnedMesh){shell.bindMode=THREE.DetachedBindMode;shell.bind(mesh.skeleton,mesh.bindMatrix);shell.bindMatrixInverse.copy(mesh.bindMatrixInverse);}
  if(mesh.morphTargetInfluences){shell.morphTargetInfluences=mesh.morphTargetInfluences;shell.morphTargetDictionary=mesh.morphTargetDictionary;}
  mesh.add(shell);paint.shells.push(shell);return shell;
}

export async function createActor(paint,{color='#aebbad'}={}){
  const gltf=await new GLTFLoader().loadAsync('lib/playground/RobotExpressive.glb');
  const root=new THREE.Group(),model=gltf.scene;root.add(model);model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),scale=2.4/size.y;
  model.scale.multiplyScalar(scale);model.position.y-=box.min.y*scale;
  const meshes=[];model.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const palette={Main:color,Grey:'#586d77',Black:'#28333b'};
  for(const mesh of meshes){const old=mesh.material;mesh.material=paint.material(palette[old.name]||'#b4bbaa');mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;animatedContour(mesh,paint);}
  const mixer=new THREE.AnimationMixer(model),clips=Object.fromEntries(gltf.animations.map(c=>[c.name,c]));
  const feet=['FootL','FootR','Foot.L','Foot.R'].map(n=>model.getObjectByName(n)).filter(Boolean);
  // FBX2glTF names are sanitized by GLTFLoader; both forms are accepted.
  if(feet.length<2)model.traverse(n=>{if(n.isBone&&/^Foot[._]?[LR]$/.test(n.name)&&!feet.includes(n))feet.push(n);});
  if(feet.length<2)throw Error('Animated specimen has no measurable foot joints');
  const groundSpeeds={Walking:calibrate(root,mixer,clips.Walking,feet),Running:calibrate(root,mixer,clips.Running,feet)};
  mixer.stopAllAction();let current='Idle',locked=0,actionTime=0,contactSent=false,contactAt=.34,active=mixer.clipAction(clips.Idle).play();
  const actions=Object.fromEntries(gltf.animations.map(c=>[c.name,mixer.clipAction(c)]));
  function play(name,{once=false,duration=0,fade=.18}={}){
    const next=actions[name];if(!next)throw Error('Missing authored clip '+name);
    if(current===name&&!once)return;next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
    next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;
    if(duration)next.timeScale=clips[name].duration/duration;
    next.play();active.crossFadeTo(next,fade,false);active=next;current=name;
  }
  const actor={root,model,mixer,feet,clips,groundSpeeds,meshes,
    get current(){return current;},get locked(){return locked>0;},get actionTime(){return actionTime;},
    action(name,duration=.72){if(locked>0)return false;locked=duration;actionTime=0;contactSent=false;contactAt=duration*.43;play(name,{once:true,duration,fade:.09});return true;},
    tick(dt,speed,onContact){
      if(locked>0){actionTime+=dt;locked=Math.max(0,locked-dt);if(!contactSent&&actionTime>=contactAt){contactSent=true;onContact?.(current);}if(locked===0)current='';}
      if(!locked){const name=speed<.08?'Idle':speed<(groundSpeeds.Walking+groundSpeeds.Running)/2?'Walking':'Running';play(name);active.timeScale=name==='Idle'?1:speed/groundSpeeds[name];}
      mixer.update(dt);root.updateMatrixWorld(true);
    },
    pose(name,t){mixer.stopAllAction();const a=actions[name].reset().stopFading().stopWarping().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(THREE.LoopRepeat,Infinity).play();mixer.setTime(t);root.updateMatrixWorld(true);return a;},
    reset(){locked=0;current='';play('Idle',{fade:0});},
    bonePose(){return feet.map(f=>f.getWorldPosition(new THREE.Vector3()).toArray());}
  };
  return actor;
}
