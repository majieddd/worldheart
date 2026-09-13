import * as THREE from 'three';
import {R,terrainHeight,terrainFaultDelta} from './world.js';
import {FAULT_BRANCHES} from './run/environment-catalogue.js';

// Preview and mutation sample the same fault. A fixed mesh and slowly pulsing
// red opacity show the predicted surface without per-frame geometry rebuilds.
export class FaultForecast {
  constructor(scene){
    this.group=new THREE.Group();scene.add(this.group);this.group.visible=false;
    this.fill=new THREE.MeshBasicMaterial({color:0xef465a,transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false});
    this.line=new THREE.LineBasicMaterial({color:0xff7680,transparent:true,opacity:.85,depthWrite:false});
    this.seam=new THREE.MeshBasicMaterial({color:0xff6257});
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.samples=[];
  }
  show(fault){
    for(const _ of this.showSteps(fault)){/* Synchronous debug exhibit path. */}
  }
  *showSteps(fault){
    for(const child of this.group.children)child.geometry.dispose();this.group.clear();
    this.samples=[];const indices=[],base=[],next=[],stems=[],cols=32,rows=28;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      if(i===0)yield;
      const dir=fault.dir.clone().addScaledVector(fault.axis,(i/cols-.5)*84/R).addScaledVector(fault.side,(j/rows-.5)*72/R).normalize();
      const h=terrainHeight(dir.x,dir.y,dir.z),delta=terrainFaultDelta(fault,dir.x,dir.y,dir.z);
      this.samples.push({dir,height:h,delta});base.push(...dir.clone().multiplyScalar(R+h+.18).toArray());next.push(...dir.clone().multiplyScalar(R+h+delta+.22).toArray());
      if(i<cols&&j<rows&&Math.abs(delta)>.15){const a=j*(cols+1)+i;indices.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);}
      if(i%4===0&&j%4===0&&Math.abs(delta)>.6)stems.push(...dir.clone().multiplyScalar(R+h+.18).toArray(),...dir.clone().multiplyScalar(R+h+delta+.22).toArray());
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(next,3));geometry.setIndex(indices);
    this.mesh=new THREE.Mesh(geometry,this.fill);this.mesh.frustumCulled=false;this.group.add(this.mesh);
    const wire=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,2),this.line);wire.frustumCulled=false;this.group.add(wire);
    const stemGeometry=new THREE.BufferGeometry();stemGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stems,3));this.group.add(new THREE.LineSegments(stemGeometry,this.line));
    const footprint=geometry.clone();footprint.setAttribute('position',new THREE.Float32BufferAttribute(base,3));this.group.add(new THREE.LineSegments(new THREE.EdgesGeometry(footprint,2),this.line));footprint.dispose();
    // The bright branching seam sits on today's ground, while the translucent
    // lower faces show exactly where it will open. Both use the same fault.
    for(const branch of FAULT_BRANCHES){const points=[];for(let j=1;j<branch.length;j++)for(let k=0;k<5;k++){
      const t=k/4,u=branch[j-1][0]*(1-t)+branch[j][0]*t,v=branch[j-1][1]*(1-t)+branch[j][1]*t,dir=fault.dir.clone().addScaledVector(fault.axis,u/R).addScaledVector(fault.side,v/R).normalize();
      points.push(dir.clone().multiplyScalar(R+terrainHeight(dir.x,dir.y,dir.z)+.3));}
      const seam=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),points.length,.13,4,false),this.seam);seam.name='predicted-fissure';this.group.add(seam);
    }
    this.group.visible=true;this.fault=fault;
  }
  update(time){this.fill.opacity=this.reduced?.32:.27+.1*Math.sin(time*Math.PI*2);this.line.opacity=this.reduced?.85:.74+.16*Math.sin(time*Math.PI*2);}
  hide(){this.group.visible=false;}
}
