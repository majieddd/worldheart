import * as THREE from 'three';
import {GLTFLoader} from '../art-candidates/hard-cel-v1/lib/addons/loaders/GLTFLoader.js';

// Original embedded UV color maps are kept at source resolution. These are
// static reference specimens, not rigged replacements for the accepted actor.
export async function referenceModel(paint,path,height=2.5){
  const {scene:model}=await new GLTFLoader().loadAsync(path),root=new THREE.Group(),meshes=[];root.add(model);model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=height/size.y;
  model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
  model.traverse(o=>{if(o.isMesh)meshes.push(o);});const textures=[];
  for(const mesh of meshes){const map=mesh.material.map;if(map){map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=16;textures.push({width:map.image.width,height:map.image.height});}mesh.material=paint.material('#ffffff',{map});mesh.castShadow=mesh.receiveShadow=true;paint.contour(mesh);}
  return {root,textures,static:true};
}
