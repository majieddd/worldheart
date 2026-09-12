import * as THREE from 'three';
import {mulberry32} from '../noise.js';
import {ACTIVE_FEATURES,featureFits,environmentalPulse} from '../run/environment-catalogue.js';

export function placeActiveFeatures(field,radius,ground,biome,water,seed){
 const rng=mulberry32(seed^0x18ea673b),sites=[],keys=Object.keys(ACTIVE_FEATURES),dir=new THREE.Vector3();
 // Shuffle the full globe before the budget is consumed; a polar-first module
 // array must not leave the other hemisphere empty on larger worlds.
 const modules=field.modules.filter(m=>m.height>0).slice(),budget=Math.min(192,Math.round(96*radius/240));
 for(let i=modules.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[modules[i],modules[j]]=[modules[j],modules[i]];}
 for(const m of modules){
  for(let slot=0;slot<5&&sites.length<budget;slot++){
   const u=(rng()*2-1)*m.extent*.7,v=(rng()*2-1)*m.extent*.7,d=field.project(m,u,v),height=ground(...d);
   const slope=Math.max(Math.abs(ground(...field.project(m,u+2,v))-height),Math.abs(ground(...field.project(m,u,v+2))-height))/2;
   const context={biome:biome(dir.set(...d),height),formation:m.type,water:water(...d)&&height<0,slope};
   const choices=keys.filter(k=>featureFits(k,context));if(!choices.length)continue;
   const key=choices[Math.floor(rng()*choices.length)],recipe=ACTIVE_FEATURES[key];
   if(sites.some(s=>s.dir.dot(dir)>Math.cos((s.radius+recipe.radius+5)/radius)))continue;
   sites.push({id:sites.length,key,m,u,v,dir:dir.clone(),height,radius:recipe.radius,phase:rng()*recipe.period,context});
  }
 }
 return sites;
}

// Shared by the actual planet and Debug World. Static details are merged into
// one coloured mesh and moving particles into one instance batch per feature.
export function buildActiveFeature(key){
 const f=ACTIVE_FEATURES[key],root=new THREE.Group(),parts=[],c=new THREE.Color(),matrix=new THREE.Matrix4();
 const add=(geo,color,x=0,y=0,z=0,rx=0)=>{geo.rotateX(rx);geo.translate(x,y,z);parts.push([geo.index?geo.toNonIndexed():geo,color]);};
 const ring=(r,color,y=.08)=>add(new THREE.TorusGeometry(r,.16,5,24),color,0,y,0,Math.PI/2);
 const pool=(r,color)=>add(new THREE.CylinderGeometry(r,r,.08,24),color,0,.05);
 if(key==='trunks'){
  add(new THREE.CylinderGeometry(.9,1.05,12,12),0x735b43,0,1.35,0,Math.PI/2);
  for(const z of [-6,6])add(new THREE.CylinderGeometry(.84,.84,.04,12),0xb39a6a,0,1.35,z,Math.PI/2);
  for(let i=0;i<5;i++)add(new THREE.BoxGeometry(.2,.28,1.5),0x495b3f,Math.sin(i*2)*.5,2.2,i*2-4);
 }else if(key==='crystal'){
  for(let i=0;i<3;i++){const g=new THREE.ConeGeometry(.55,3+i*.6,5);g.rotateZ((i-1)*.4);add(g,i===1?0xd9b4ff:0x8066bd,(i-1)*.8,1.5+i*.3);}
  ring(f.radius,0x8d7bae);
 }else if(key==='spores'){
  for(let i=0;i<5;i++){const x=Math.cos(i*2.4)*1.5,z=Math.sin(i*2.4)*1.5;add(new THREE.SphereGeometry(.65,9,6),i%2?0xba956f:0x92964b,x,.7,z);add(new THREE.CylinderGeometry(.15,.3,.3,6),0x584646,x,1.28,z);}
 }else if(key==='boulder'){
  for(let i=0;i<7;i++)add(new THREE.IcosahedronGeometry(.3,0),0x766b5b,(i%2?1:-1)*1.7,.2,i-3);
 }else if(key==='updraft'){
  for(let i=0;i<8;i++)add(new THREE.ConeGeometry(.2,.6,4),0xaaa48b,Math.cos(i)*3,.2,Math.sin(i)*3);
 }else{
  const r=key==='whirlpool'?5:key==='mudpot'?2.8:key==='seep'?3:1.4;
  pool(r,key==='mudpot'?0x736050:key==='seep'?0x7e3127:key==='whirlpool'?0x276e89:0x67ada5);
  if(key!=='whirlpool')ring(r,key==='seep'?0x34303a:key==='cryovent'?0xbbdee8:0xb5a884);
  if(key==='spring')for(let i=0;i<6;i++)add(new THREE.IcosahedronGeometry(.45,0),0x789778,Math.cos(i)*2,.22,Math.sin(i)*2);
  if(key==='fumarole'){
   add(new THREE.ConeGeometry(.8,.55,7),0xb6a447,0,.25);
   for(let i=0;i<5;i++){const g=new THREE.BoxGeometry(.12,.06,1.4+i*.15);g.rotateY(i*1.256);add(g,0x675941,Math.sin(i*1.256)*1.5,.07,Math.cos(i*1.256)*1.5);}
  }
  if(key==='cryovent')for(let i=0;i<6;i++){const a=i*Math.PI/3,g=new THREE.BoxGeometry(.6,.25,1.4);g.rotateY(a);add(g,i%2?0x94c9da:0xd9edef,Math.sin(a)*1.7,.1,Math.cos(a)*1.7);}
  if(key==='seep')for(let i=0;i<7;i++){const a=i*2.4,g=new THREE.BoxGeometry(.22,.1,1.5);g.rotateY(a);add(g,0xe17738,Math.sin(a)*1.5,.11,Math.cos(a)*1.5);}
  if(key==='geyser')for(const [x,z,r]of [[2.3,1.3,.55],[-1.8,1.1,.4],[-.5,-2.1,.65]])add(new THREE.CylinderGeometry(r,r,.04,12),0xa5c5bd,x,.03,z);
  if(key==='whirlpool')for(let j=0;j<3;j++)ring(1.3+j*1.4,0x93dddd,.1+j*.04);
 }
 const pos=[],colors=[];
 for(const [g,hex]of parts){c.setHex(hex);for(let i=0;i<g.attributes.position.count;i++){pos.push(g.attributes.position.getX(i),g.attributes.position.getY(i),g.attributes.position.getZ(i));colors.push(c.r,c.g,c.b);}g.dispose();}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
 root.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,flatShading:true})));
 const particles=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:f.color,transparent:true,opacity:key==='boulder'?.95:.48,depthWrite:false}),12);root.add(particles);particles.frustumCulled=false;
 root.userData.update=(time)=>{
  const pulse=environmentalPulse(f,time),active=pulse.active;particles.visible=active&&key!=='trunks';
  for(let i=0;i<12;i++){
   const t=(time*(key==='boulder'?.25:.5)+i/12)%1,a=i*2.4+time,r=key==='whirlpool'?5*(1-t):key==='spores'?t*4:key==='crystal'?t*f.radius:key==='seep'?2:1;
   let y=key==='boulder'?.8:key==='whirlpool'?.2:key==='crystal'?.2:key==='spring'?.25+Math.sin(a)*.1: t*(key==='geyser'?10:key==='updraft'?12:key==='spores'?2:5);
   const size=key==='boulder'?.8:key==='crystal'?.14:key==='spring'?.15:.25+t*.7;
   matrix.makeScale(size,size,size);matrix.setPosition(key==='boulder'?Math.sin(i)*.6:Math.cos(a)*r,y,key==='boulder'?5-t*10:Math.sin(a)*r);particles.setMatrixAt(i,matrix);
  }particles.instanceMatrix.needsUpdate=true;
 };
 root.userData.update(0);return root;
}
