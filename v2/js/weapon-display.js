import * as THREE from 'three';
import { buildWeapon, weaponAppearanceMaterial } from './weapon-model.js';
import { FAMILIES, materialForWeapon } from './run/weapons.js';

export function weaponDisplay(item){
  const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.55,flatShading:true});
  const mats={body:mat(0x43576d),trim:mat(0xb6c5ce),dark:mat(0x1b2637),grip:mat(0x674b35),gold:mat(0xd1b77b),energy:mat(0xaaddff)};
  const kit=buildWeapon(FAMILIES[item.family].visual,item.era,mats,item.make?.brand),group=new THREE.Group();
  const appearance={era:item.era,core:item.parts.core,material:materialForWeapon(item)};
  for(const p of kit.parts){
    const mesh=new THREE.Mesh(p.geo,weaponAppearanceMaterial(mats,p.mat,appearance));group.add(mesh);
    if(kit.paired){const left=mesh.clone();left.position.set(-.42,0,.10);group.add(left);}
  }
  for(const material of new Set([...Object.values(mats),...kit.parts.map(p=>p.mat)]))material.dispose();
  group.scale.z=item.parts.head==='long'?1.2:1;
  group.userData.weapon=item;return group;
}
export function disposeWeaponDisplay(group){
  const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
}
let renderer,scene,camera;
const cache=new Map();
export function weaponThumbnail(item){
  const key=JSON.stringify([item.family,item.era,item.rarity,item.parts,item.make?.brand]);
  if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
  if(!renderer){
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(480,176);renderer.setPixelRatio(1);
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
    scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xe3efff,0x354761,3));
    const light=new THREE.DirectionalLight(0xffe7c4,3.4);light.position.set(-2,4,5);scene.add(light);
    camera=new THREE.OrthographicCamera(-2,2,1,-1,.01,30);camera.position.z=8;
  }
  const group=weaponDisplay(item);group.rotation.set(.15,-Math.PI/2,-.22);scene.add(group);
  const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3());group.position.sub(bounds.getCenter(new THREE.Vector3()));
  const half=Math.max(size.y/2,size.x/2/(480/176)) *1.22;
  camera.top=half;camera.bottom=-half;camera.left=-half*480/176;camera.right=-camera.left;camera.updateProjectionMatrix();
  renderer.render(scene,camera);const url=renderer.domElement.toDataURL('image/png');scene.remove(group);disposeWeaponDisplay(group);
  cache.set(key,url);if(cache.size>48)cache.delete(cache.keys().next().value);return url;
}
