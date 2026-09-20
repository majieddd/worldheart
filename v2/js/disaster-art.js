import * as THREE from 'three';
import {DISASTERS,environmentalPulse,disasterTargets,faultProfile,FAULT_BRANCHES} from './run/environment-catalogue.js';
import {buildArcStorm,buildSurge} from './storm-art.js';
import {buildMeteorShower,buildWeatherFront} from './disaster-weather-art.js';
export function buildTornadoArt(){
 const root=new THREE.Group(),rings=[],material=new THREE.MeshStandardMaterial({color:0xb4c4bb,roughness:1,flatShading:true,transparent:true,opacity:.68,depthWrite:false,side:THREE.DoubleSide});
 const profile=Array.from({length:20},(_,i)=>new THREE.Vector2(.8+Math.pow(i/19,1.4)*5.6,i*.76));
 const cone=new THREE.Mesh(new THREE.LatheGeometry(profile,28),material);root.add(cone);
 for(let k=0;k<6;k++){const points=[];for(let i=0;i<100;i++){const t=i/99,a=t*Math.PI*6+k,rad=1+Math.pow(t,1.4)*5.8;points.push(new THREE.Vector3(Math.cos(a)*rad,t*14,Math.sin(a)*rad));}
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),100,.075+(k%2)*.045,4,false),new THREE.MeshBasicMaterial({color:k%2?0xe0e7cf:0x647e78,transparent:true,opacity:.6,depthWrite:false}));root.add(mesh);rings.push(mesh);}
 const debris=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.2,1),new THREE.MeshStandardMaterial({color:0x887e5e,roughness:1}),26);root.add(debris);const matrix=new THREE.Matrix4();
 root.userData.rings=rings;root.userData.update=time=>{cone.rotation.y=time*.7;for(let i=0;i<rings.length;i++){rings[i].rotation.y=time*(i%2?1.7:1.3);rings[i].position.x=Math.sin(time*2+i)*.15;}
  for(let i=0;i<26;i++){const t=(time*.22+i/26)%1,a=time*4+i*2.399,r=1.2+t*5;matrix.makeRotationY(a);matrix.setPosition(Math.cos(a)*r,t*13,Math.sin(a)*r);debris.setMatrixAt(i,matrix);}debris.instanceMatrix.needsUpdate=true;};return root;
}
export function buildDisasterArt(key,ground=()=>0){
 if(key==='meteor'||key==='eruption')return buildMeteorShower(key,ground);
 if(['hail','blizzard','sandstorm'].includes(key))return buildWeatherFront(key,ground);
 if(key==='tornado')return buildTornadoArt();
 if(key==='thunder'||key==='solar')return buildArcStorm(key,ground);
 if(key==='tsunami')return buildSurge(ground);
 if(key==='quake'){
  const root=new THREE.Group(),geo=new THREE.PlaneGeometry(84,72,48,40);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++)pos.setY(i,4+faultProfile(pos.getX(i),pos.getZ(i)));
  geo.computeVertexNormals();const colors=[],shade=new THREE.Color();for(let i=0;i<pos.count;i++){shade.setHex(pos.getY(i)<2.5?0x796044:0x829267);shade.multiplyScalar(.72+.28*Math.max(0,pos.getY(i)/5));colors.push(shade.r,shade.g,shade.b);}geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const land=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9,side:THREE.DoubleSide}));root.add(land);
  const fill=new THREE.MeshBasicMaterial({color:0xef465a,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),forecast=new THREE.Mesh(geo,fill);root.add(forecast);
  for(const branch of FAULT_BRANCHES){const points=branch.map(([u,v])=>new THREE.Vector3(u,4.2+faultProfile(u,v),v));root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xffb09e})));}
  root.userData.update=(time,warning=false)=>{forecast.visible=warning;fill.opacity=.27+.1*Math.sin(time*Math.PI*2);};root.userData.update(0);return root;
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
   else if(key==='hail'){y=20*(1-t);s=.22;}
   else if(key==='blizzard'){y=t*8;s=.35;x+=Math.sin(time+i)*3;}
   else if(key==='sandstorm'){x=Math.sin(time*.2)*f.radius*.6;y=(i%8)*2;z=(Math.floor(i/8)-3)*7;s=3;sx=.7;sy=1.3;sz=1.5;}
   p.set(x,y+(pointHazard?ground(x,z):0),z);size.set(s*sx,s*sy,s*sz);matrix.compose(p,new THREE.Quaternion(),size);pieces.setMatrixAt(i,matrix);
  }pieces.instanceMatrix.needsUpdate=true;pieces.visible=!warning;
 };
 root.userData.update(0);return root;
}
