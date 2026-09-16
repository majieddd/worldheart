import * as THREE from '../lib/three.module.min.js';
export function buildPlanetAdornment(environment,radius){
 const group=new THREE.Group();
 if(environment.rings){
  const saturn=environment.theme==='saturn',uranus=environment.theme==='uranus';
  const bands=saturn?[[1.28,1.49,0x998d74],[1.51,1.75,0xd4c6a3],[1.79,2.12,0xb8aa91]]:[[1.65,1.68,uranus?0x879ea0:0x667a8e],[1.79,1.8,0x8f9c9f]];
  for(const [inner,outer,color]of bands){const ring=new THREE.Mesh(new THREE.RingGeometry(radius*inner,radius*outer,160),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:saturn?.55:.3,depthWrite:false}));ring.rotation.x=Math.PI/2;if(uranus)ring.rotateY(98*Math.PI/180);group.add(ring);}
 }
 return group;
}
