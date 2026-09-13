import * as THREE from 'three';
import {DISASTERS,disasterTargets,environmentalPulse} from './run/environment-catalogue.js';

// Connected channels, including their forks, share endpoints. Two instanced
// batches provide a bright core and a soft halo without a light per segment.
export function buildArcStorm(key,ground){
 const root=new THREE.Group(),radiation=key==='solar',recipe=DISASTERS[key],targets=disasterTargets(key,0),matrix=new THREE.Matrix4(),up=new THREE.Vector3(0,1,0),q=new THREE.Quaternion(),scale=new THREE.Vector3(),p=new THREE.Vector3(),delta=new THREE.Vector3();
 const bolts=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,5),new THREE.MeshBasicMaterial({color:radiation?0xe8c8ff:0xf5f5ff}),targets.length*24);
 const halo=new THREE.InstancedMesh(bolts.geometry,new THREE.MeshBasicMaterial({color:radiation?0x953cff:0x9dafff,transparent:true,opacity:.26,depthWrite:false}),bolts.count);
 bolts.name='connected-lightning-core';halo.name='lightning-halo';bolts.frustumCulled=halo.frustumCulled=false;root.add(halo,bolts);
 const cloud=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:radiation?0x693e99:0x475771,transparent:true,opacity:.7,depthWrite:false}),17);cloud.name='storm-clouds';root.add(cloud);
 const marks=new THREE.InstancedMesh(new THREE.TorusGeometry(1,.055,5,32),new THREE.MeshBasicMaterial({color:radiation?0xcc7aff:0xff7067,transparent:true,opacity:.65,depthWrite:false}),targets.length);root.add(marks);
 let lastCycle=-1;
 function channels(cycle){let count=0;const emit=(a,b,width)=>{p.copy(a).add(b).multiplyScalar(.5);delta.copy(b).sub(a);q.setFromUnitVectors(up,delta.clone().normalize());scale.set(width,delta.length(),width);matrix.compose(p,q,scale);bolts.setMatrixAt(count,matrix);scale.x*=3;scale.z*=3;matrix.compose(p,q,scale);halo.setMatrixAt(count++,matrix);};
  for(let n=0;n<targets.length;n++){
   const target=targets[n],base=ground(target.u,target.v),points=[];
   for(let j=0;j<=12;j++){const t=j/12,spread=Math.sin(t*Math.PI),x=target.u+Math.sin(j*2.8+cycle*1.3+n)*2.2*spread,z=target.v+Math.cos(j*2.2+cycle+n)*1.8*spread;points.push(new THREE.Vector3(x,base+24*(1-t),z));if(j)emit(points[j-1],points[j],.10);}
   for(const k of [3,6,9]){let a=points[k];for(let j=1;j<=3;j++){const b=a.clone().add(new THREE.Vector3((k%2?1:-1)*(1+j*.35),-1.7,Math.sin(k+j+cycle)*1.6));emit(a,b,.045);a=b;}}
  }bolts.count=halo.count=count;bolts.instanceMatrix.needsUpdate=halo.instanceMatrix.needsUpdate=true;
 }
 root.userData.update=(time,warning=false)=>{
  const pulse=environmentalPulse(recipe,time);if(lastCycle!==pulse.cycle){channels(pulse.cycle);lastCycle=pulse.cycle;}
  bolts.visible=halo.visible=!warning&&pulse.active;cloud.visible=true;
  for(let i=0;i<17;i++){const angle=i*2.813+Math.sin(time*.17+i)*.12,r=(3+((i*7)%15))*(radiation?1:.9),x=Math.cos(angle)*r,z=Math.sin(angle)*r;p.set(x,ground(0,0)+22+Math.sin(i*2.1)*2,z);q.identity();scale.set(6+(i%3),2.6+Math.sin(time*.3+i)*.15,4+i%4);matrix.compose(p,q,scale);cloud.setMatrixAt(i,matrix);}cloud.instanceMatrix.needsUpdate=true;
  marks.material.opacity=warning?.42+.2*Math.sin(time*3)**2:pulse.active?.8:.24+.25*pulse.phase;
  targets.forEach((t,i)=>{p.set(t.u,ground(t.u,t.v)+.18,t.v);q.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);scale.setScalar(t.radius);matrix.compose(p,q,scale);marks.setMatrixAt(i,matrix);});marks.instanceMatrix.needsUpdate=true;
 };
 root.userData.update(0,true);return root;
}

export function buildSurge(ground){
 const root=new THREE.Group(),radius=DISASTERS.tsunami.radius,segments=64;
 // Continuous bore with a curling crest; white foam traces the same crest.
 const section=[[-6,0],[-5,.5],[-3,1.5],[-1,3.4],[0,5.4],[1.3,6.2],[2.5,5.8],[3.1,4.7],[2.5,3.7],[2,4.3],[1.5,4.8],[1,4],[2,.1]];
 const positions=[],colors=[],indices=[],c=new THREE.Color(),rows=section.length;
 for(let j=0;j<=segments;j++)for(let i=0;i<rows;i++){positions.push(section[i][0],section[i][1],(j/segments*2-1)*radius);c.setHex(i>=4&&i<=7?0xbceff1:i>7?0x60c4d3:0x27899e);colors.push(c.r,c.g,c.b);if(j<segments&&i<rows-1){const a=j*rows+i;indices.push(a,a+rows,a+1,a+1,a+rows,a+rows+1);}}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const wave=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.25,metalness:.1,transparent:true,opacity:.91,side:THREE.DoubleSide}));wave.name='continuous-tsunami-bore';wave.frustumCulled=false;root.add(wave);
 const foamGeometry=new THREE.BufferGeometry(),foam=new Float32Array((segments+1)*3);foamGeometry.setAttribute('position',new THREE.BufferAttribute(foam,3));const crest=new THREE.Line(foamGeometry,new THREE.LineBasicMaterial({color:0xf1ffff}));crest.frustumCulled=false;root.add(crest);
 const heights=Array.from({length:33},(_,j)=>Array.from({length:33},(_,i)=>ground((i/32*2-1)*(radius+8),(j/32*2-1)*radius)));
 const heightAt=(x,z)=>{const a=Math.max(0,Math.min(31.999,(x/(radius+8)+1)*16)),b=Math.max(0,Math.min(31.999,(z/radius+1)*16)),i=Math.floor(a),j=Math.floor(b),u=a-i,v=b-j;return (heights[j][i]*(1-u)+heights[j][i+1]*u)*(1-v)+(heights[j+1][i]*(1-u)+heights[j+1][i+1]*u)*v;};
 const warningGeometry=new THREE.CircleGeometry(radius,64);warningGeometry.rotateX(-Math.PI/2);const wp=warningGeometry.attributes.position;for(let i=0;i<wp.count;i++)wp.setY(i,heightAt(wp.getX(i),wp.getZ(i))+.2);
 const warningArea=new THREE.Mesh(warningGeometry,new THREE.MeshBasicMaterial({color:0xff665e,transparent:true,opacity:.24,side:THREE.DoubleSide,depthWrite:false}));warningArea.name='surge-warning';root.add(warningArea);
 const arrow=new THREE.Line(new THREE.BufferGeometry().setFromPoints([[-17,0],[16,0],[9,-5],[16,0],[9,5]].map(([x,z])=>new THREE.Vector3(x,heightAt(x,z)+.4,z))),new THREE.LineBasicMaterial({color:0xffb18b}));root.add(arrow);
 root.userData.update=(time,warning=false)=>{
  const centre=((time/DISASTERS.tsunami.duration)*2-1)*radius,attribute=geometry.attributes.position;
  for(let j=0;j<=segments;j++){const z=(j/segments*2-1)*radius,edge=Math.sqrt(Math.max(0,1-(z/radius)**2)),ripple=Math.sin(z*.6+time*2)*.25;
   for(let i=0;i<rows;i++){const x=centre+section[i][0],h=section[i][1]*edge+ripple*edge;attribute.setXYZ(j*rows+i,x,Math.min(heightAt(x,z),1)+h,z);}
   foam[j*3]=centre+1.3;foam[j*3+1]=Math.min(heightAt(centre+1.3,z),1)+(6.3+ripple)*edge;foam[j*3+2]=z;
  }attribute.needsUpdate=true;geometry.computeVertexNormals();foamGeometry.attributes.position.needsUpdate=true;wave.visible=crest.visible=!warning;warningArea.visible=arrow.visible=warning;warningArea.material.opacity=.2+.1*Math.sin(time*3)**2;
 };
 root.userData.update(0);return root;
}
