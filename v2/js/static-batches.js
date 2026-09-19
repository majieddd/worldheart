import * as THREE from 'three';
// Bake only explicitly static scenery. Interactive hit meshes and animated
// roots retain their identity; shared geometry is never disposed here.
export function batchStaticScenery(root,exclude=new Set()){
 root.updateMatrixWorld(true);const groups=new Map(),p=new THREE.Vector3(),n=new THREE.Vector3(),normal=new THREE.Matrix3();
 root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||exclude.has(o)||o.userData.station||!o.material?.isMeshStandardMaterial||o.material.transparent)return;let g=groups.get(o.material);if(!g){g=[];groups.set(o.material,g);}g.push(o);});
 for(const [material,meshes]of groups){
  if(meshes.length<2)continue;const positions=[],normals=[],colors=[];
  for(const o of meshes){const g=o.geometry,idx=g.index,pos=g.attributes.position,nrm=g.attributes.normal,col=g.attributes.color;normal.getNormalMatrix(o.matrixWorld);
   for(let j=0;j<(idx?.count||pos.count);j++){const i=idx?idx.getX(j):j;p.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);n.fromBufferAttribute(nrm,i).applyMatrix3(normal).normalize();positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);if(material.vertexColors)colors.push(col?.getX(i)??1,col?.getY(i)??1,col?.getZ(i)??1);}
   o.removeFromParent();
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));if(material.vertexColors)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();const batch=new THREE.Mesh(geometry,material);batch.name='courtyard-static';batch.castShadow=batch.receiveShadow=true;root.add(batch);
 }
}
