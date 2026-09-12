import * as THREE from 'three';
import {DISASTERS,environmentalPulse,disasterTargets,faultProfile} from './run/environment-catalogue.js';
export function buildTornadoArt(){
 const root=new THREE.Group(),rings=[],material=new THREE.MeshBasicMaterial({color:0xd9e9d9,transparent:true,opacity:.3,depthWrite:false});
 for(let i=0;i<12;i++){const mesh=new THREE.Mesh(new THREE.TorusGeometry(1.3+i*.39,.16+i*.013,4,22),material);mesh.rotation.x=Math.PI/2;mesh.position.y=i;root.add(mesh);rings.push(mesh);}
 const cone=new THREE.Mesh(new THREE.CylinderGeometry(5.5,1.3,12,14,8,true),new THREE.MeshBasicMaterial({color:0xa2bcaf,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));cone.position.y=6;root.add(cone);
 root.userData.rings=rings;root.userData.update=time=>{for(let i=0;i<rings.length;i++){rings[i].position.x=Math.sin(time*5+i*.6)*.5;rings[i].position.z=Math.cos(time*5+i*.6)*.5;}};return root;
}
export function buildDisasterArt(key,ground=()=>0){
 if(key==='tornado')return buildTornadoArt();
 if(key==='quake'){
  const root=new THREE.Group(),geo=new THREE.PlaneGeometry(84,72,48,40);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++)pos.setY(i,4+faultProfile(pos.getX(i),pos.getZ(i)));
  geo.computeVertexNormals();const fill=new THREE.MeshBasicMaterial({color:0xef465a,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false});root.add(new THREE.Mesh(geo,fill));root.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo,8),new THREE.LineBasicMaterial({color:0xff8790,transparent:true,opacity:.6})));
  root.userData.update=time=>{fill.opacity=.27+.1*Math.sin(time*Math.PI*2);};return root;
 }
 const f=DISASTERS[key],root=new THREE.Group(),matrix=new THREE.Matrix4();
 const material=new THREE.MeshBasicMaterial({color:f.color,transparent:true,opacity:.65,depthWrite:false});
 const pieces=new THREE.InstancedMesh(key==='tsunami'?new THREE.BoxGeometry(1,1,1):new THREE.IcosahedronGeometry(1,0),material,48);pieces.frustumCulled=false;root.add(pieces);
 const marks=new THREE.InstancedMesh(new THREE.TorusGeometry(1,.05,4,32),new THREE.MeshBasicMaterial({color:0xff655c,transparent:true,opacity:.8,depthWrite:false}),4);marks.frustumCulled=false;root.add(marks);
 const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2),p=new THREE.Vector3(),size=new THREE.Vector3();
 const outline=new THREE.TorusGeometry(f.radius,.12,4,64);outline.rotateX(Math.PI/2);const vertices=outline.attributes.position;for(let i=0;i<vertices.count;i++)vertices.setY(i,vertices.getY(i)+ground(vertices.getX(i),vertices.getZ(i)));
 const boundary=new THREE.Mesh(outline,new THREE.MeshBasicMaterial({color:0xff7768,transparent:true,opacity:.55,depthWrite:false}));boundary.position.y=.15;root.add(boundary);
 root.userData.update=(time,warning=false)=>{
  const pulse=environmentalPulse(f,time),targets=disasterTargets(key,time),pointHazard=['meteor','thunder','eruption'].includes(key);
  boundary.material.opacity=warning?.3+.35*Math.sin(time*5)**2:.18;marks.visible=pointHazard;
  for(let i=0;i<4;i++){const t=targets[i%targets.length];p.set(t.u,.22+ground(t.u,t.v),t.v);size.setScalar(t.radius);matrix.compose(p,q,size);marks.setMatrixAt(i,matrix);}marks.instanceMatrix.needsUpdate=true;
  for(let i=0;i<48;i++){
   const a=i*2.399+time*.8,t=(time*.45+i/48)%1,r=Math.sqrt(i/48)*f.radius;
   let x=Math.cos(a)*r,z=Math.sin(a)*r,y=1+t*14,s=.22,sx=1,sy=1,sz=1;
   if(key==='meteor'||key==='eruption'){const target=targets[i%targets.length],fall=pulse.phase;x=target.u;z=target.v;y=key==='eruption'?Math.sin(fall*Math.PI)*18:pulse.active?0:24*(1-(fall-f.on/f.period)/(1-f.on/f.period));s=i<4?1:.25;y+=i<4?0:i%12*.5;}
   else if(key==='thunder'){const target=targets[0];x=target.u+Math.sin(i*3)*.6;z=target.v;y=i/48*24;s=pulse.active?.34:.06;sy=2;}
   else if(key==='hail'){y=20*(1-t);s=.22;}
   else if(key==='blizzard'){y=t*8;s=.35;x+=Math.sin(time+i)*3;}
   else if(key==='sandstorm'){x=Math.sin(time*.2)*f.radius*.6;y=(i%8)*2;z=(Math.floor(i/8)-3)*7;s=3;sx=.7;sy=1.3;sz=1.5;}
   else if(key==='tsunami'){x=((time/f.duration)*2-1)*f.radius;z=(i/47*2-1)*f.radius;y=1.2+Math.sin(i*.18)*.3;s=1;sx=3;sy=2.5;sz=1.3;}
   else if(key==='ashfall'){y=18*(1-t);s=.6;x=Math.cos(a)*r*.7;}
   else if(key==='solar'){x=(i%8-4)*6;z=Math.floor(i/8)*5-12;y=3+Math.sin(time+i*.7)*2;s=.5;sy=8;}
   else if(key==='cryoburst'){x=Math.cos(a)*(time%5)*4;z=Math.sin(a)*(time%5)*4;y=t*8;s=.5;}
   p.set(x,y+(pointHazard?ground(x,z):0),z);size.set(s*sx,s*sy,s*sz);matrix.compose(p,new THREE.Quaternion(),size);pieces.setMatrixAt(i,matrix);
  }pieces.instanceMatrix.needsUpdate=true;pieces.visible=!warning;
 };
 root.userData.update(0);return root;
}
