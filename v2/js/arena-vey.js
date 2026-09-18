import * as THREE from 'three';
import {GLTFLoader} from '../art-candidates/hard-cel-v1/lib/addons/loaders/GLTFLoader.js';
import {animatedContour} from './playground-actor.js';
import {HANDLING} from './arena-handling.js';

// Measured source-clip travel. Keep the accepted gait at its natural pace in
// third person; the existing first-person combat handling stays available.
export const VEY_PACE=Object.freeze({...HANDLING,walk:1.389573589,sprint:3.461958244,crouch:1,aim:1.15,slide:4.5});

export async function createVeyActor(paint,{url='lib/99-art/vey-articulation-v1/vey-motion.glb',pace=VEY_PACE,onProgress}={}){
  const gltf=await new GLTFLoader().loadAsync(url,onProgress);
  const root=new THREE.Group(),model=gltf.scene;root.add(model);
  const meshes=[];let hand;
  model.traverse(o=>{if(o.isMesh)meshes.push(o);if(o.isBone&&o.name.replace(/[^a-z0-9]/gi,'')==='handR')hand=o;});
  for(const mesh of meshes){
    const original=mesh.material;
    if(original.map){original.map.colorSpace=THREE.SRGBColorSpace;original.map.anisotropy=16;}
    // The actual arena material, including its cel ramp, pigment, saturation,
    // shadow depth and shared pixel-width contours. Retain the accepted UV paint.
    mesh.material=paint.material(original.color.clone(),{map:original.map});
    mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
    const shell=animatedContour(mesh,paint);
    // Vey's mesh has a transformed bind space. A child shell would apply that
    // transform twice and leave a detached dark silhouette elsewhere in the scene.
    mesh.remove(shell);mesh.parent.add(shell);
    shell.position.copy(mesh.position);shell.quaternion.copy(mesh.quaternion);shell.scale.copy(mesh.scale);
    if(mesh.isSkinnedMesh){shell.bindMode=mesh.bindMode;shell.bind(mesh.skeleton,mesh.bindMatrix);shell.bindMatrixInverse.copy(mesh.bindMatrixInverse);}
  }
  const mixer=new THREE.AnimationMixer(model),clips={},actions={};
  for(const clip of gltf.animations){const name=clip.name.split(' ')[0];clips[name]=clip;actions[name]=mixer.clipAction(clip).play();actions[name].setEffectiveWeight(name==='Idle'?1:0);}
  let current='Idle';
  return {root,model,hand,meshes,mixer,clips,pace,groundSpeeds:{Walking:pace.walk,Running:pace.sprint},
    get current(){return current;},get locked(){return false;},
    // Vey has accepted locomotion, not an authored attack/jump clip. Existing
    // weapon choreography and combat feedback remain in the arena weapon rig.
    action(){return false;},
    tick(dt,speed){
      const moving=THREE.MathUtils.smoothstep(speed,.015,.35),running=THREE.MathUtils.smoothstep(speed,pace.walk*1.15,pace.sprint*.81);
      const weights={Idle:1-moving,Walk:moving*(1-running),Run:moving*running};
      current=moving<.1?'Idle':running>.5?'Run':'Walk';
      for(const [name,a]of Object.entries(actions)){a.setEffectiveWeight(THREE.MathUtils.damp(a.getEffectiveWeight(),weights[name]||0,14,dt));a.timeScale=name==='Idle'?1:Math.max(.12,speed/(name==='Walk'?pace.walk:pace.sprint));}
      mixer.update(dt);root.updateMatrixWorld(true);
    },
    reset(){for(const [name,a]of Object.entries(actions))a.reset().play().setEffectiveWeight(name==='Idle'?1:0);current='Idle';}
  };
}
