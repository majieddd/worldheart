import * as THREE from 'three';

// Adapt the live meadow after construction. The approved archived environment
// stays byte-identical. Its accent leaves were scattered independently from the
// ellipsoids underneath, leaving separate hovering plates at close range.
export function attachCanopyLeaves(environment){
  const report={leaves:0,reattached:0,maxRadiusBefore:0,maxRadiusAfter:0},point=new THREE.Vector3(),local=new THREE.Vector3(),shift=new THREE.Vector3();
  const template=new THREE.SphereGeometry(1,5,3),stride=template.attributes.position.count;template.dispose();
  for(const {group} of environment.wind){
    const crowns=group.children.filter(m=>m.geometry?.type==='SphereGeometry');
    for(const mesh of group.children.filter(m=>m.isMesh&&m.geometry.type==='BufferGeometry')){
      const positions=mesh.geometry.attributes.position;
      if(positions.count%stride)throw Error('Canopy leaf topology changed; inspect the live adaptation.');
      for(let offset=0;offset<positions.count;offset+=stride){
        const bounds=new THREE.Box3();for(let j=0;j<stride;j++)bounds.expandByPoint(point.fromBufferAttribute(positions,offset+j));bounds.getCenter(point);
        let closest=null,radius=Infinity;
        for(const crown of crowns){local.copy(point).sub(crown.position).applyQuaternion(crown.quaternion.clone().invert()).divide(crown.scale);const r=local.length();if(r<radius){radius=r;closest=crown;}}
        report.leaves++;report.maxRadiusBefore=Math.max(report.maxRadiusBefore,radius);
        if(radius>.965){
          // Embed the accent's center just below the surface, retaining its tip
          // and paint variation without a gap between the leaf and crown.
          shift.copy(point).sub(closest.position).multiplyScalar(.965/radius).add(closest.position).sub(point);
          for(let j=0;j<stride;j++){local.fromBufferAttribute(positions,offset+j).add(shift);positions.setXYZ(offset+j,local.x,local.y,local.z);}report.reattached++;
        }
        report.maxRadiusAfter=Math.max(report.maxRadiusAfter,Math.min(radius,.965));
      }
      positions.needsUpdate=true;mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
    }
  }
  environment.foliage=report;return environment;
}
