import * as THREE from 'three';
import {DISASTERS,environmentalPulse,disasterTargets} from './run/environment-catalogue.js';

const rock=color=>new THREE.MeshStandardMaterial({color,roughness:.92,flatShading:true});
const glow=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:false,side:THREE.DoubleSide});
function ring(radius,material){const mesh=new THREE.Mesh(new THREE.TorusGeometry(radius,.09,5,48),material);mesh.rotation.x=Math.PI/2;return mesh;}
function batch(root,geometry,material,count){const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.frustumCulled=false;root.add(mesh);return mesh;}
function fireTail(radius,length){
 const geometry=new THREE.ConeGeometry(radius,length,14,10,true),p=geometry.attributes.position,colors=[],c=new THREE.Color();
 for(let i=0;i<p.count;i++){const t=(p.getY(i)+length/2)/length;c.setHex(t<.25?0xffdc96:t<.65?0xef9b58:0xc56349);colors.push(c.r,c.g,c.b,Math.pow(1-t,1.6)*.75);}
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
}

// The four impact points are the gameplay targets, not independent decoration.
// A visible approach, contact flash, expanding dust and cooling scar explain
// the full strike. Only instances move; no per-frame geometry allocations.
export function buildMeteorShower(key='meteor',ground=()=>0){
 const root=new THREE.Group(),f=DISASTERS[key],volcanic=key==='eruption',pieces=[];
 const shell=rock(0x4e4446),core=glow(0xffcb75),ember=glow(0xe7864d,.7),warning=glow(0xef746c,.72),scar=rock(0x514746);
 const matrix=new THREE.Matrix4(),spin=new THREE.Quaternion(),axis=new THREE.Vector3(.4,.7,.2).normalize(),position=new THREE.Vector3(),scale=new THREE.Vector3(),offset=new THREE.Vector3();
 const dust=batch(root,new THREE.IcosahedronGeometry(1,1),glow(0xb09a7b,.4),32),sparks=batch(root,new THREE.OctahedronGeometry(1),core,40);
 for(let i=0;i<4;i++){
  const body=new THREE.Group(),crust=new THREE.IcosahedronGeometry(1.5,1),points=crust.attributes.position,centroid=new THREE.Vector3(),corner=new THREE.Vector3();
  // Separate crust facets expose a luminous interior through irregular cracks.
  for(let j=0;j<points.count;j+=3){centroid.set(0,0,0);for(let k=0;k<3;k++)centroid.add(corner.fromBufferAttribute(points,j+k));centroid.multiplyScalar(1/3);for(let k=0;k<3;k++){corner.fromBufferAttribute(points,j+k).lerp(centroid,.12);points.setXYZ(j+k,corner.x,corner.y,corner.z);}}
  const mesh=new THREE.Mesh(crust,shell);mesh.scale.set(1,.85,1.2);const molten=new THREE.Mesh(new THREE.IcosahedronGeometry(1.39,2),core);molten.scale.copy(mesh.scale);mesh.add(molten);body.add(mesh);
  const wake=fireTail(1.45,9);wake.position.y=4.6;body.add(wake);
  const streak=fireTail(.7,6);streak.position.y=3.1;body.add(streak);
  for(let k=0;k<3;k++){const a=k*Math.PI*2/3,curve=new THREE.CatmullRomCurve3(Array.from({length:9},(_,j)=>new THREE.Vector3(Math.cos(a+j*.22)*(1-j/12),j*.8,Math.sin(a+j*.22)*(1-j/12))));body.add(new THREE.Mesh(new THREE.TubeGeometry(curve,24,.08,4,false),core));}
  const mark=ring(4,warning),clock=ring(3.6,glow(0xffd8a0,.85)),shock=ring(1,ember),crater=new THREE.Mesh(new THREE.CircleGeometry(3.5,24),scar),flash=new THREE.Mesh(new THREE.IcosahedronGeometry(1,2),glow(0xffda93,.8));crater.rotation.x=-Math.PI/2;
  const t=disasterTargets(key,0)[i],h=ground(t.u,t.v),path=new THREE.LineDashedMaterial({color:0xffc58d,transparent:true,opacity:.4,dashSize:.65,gapSize:.6});
  const trace=new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({length:25},(_,j)=>{const y=j/24*32;return new THREE.Vector3(t.u+y*.36,h+y,t.v-y*.16);})),path);trace.computeLineDistances();root.add(trace);
  root.add(body,mark,clock,shock,crater,flash);pieces.push({body,mesh,wake,mark,clock,shock,crater,trace,flash});
 }
 root.userData.update=(time,forecast=false)=>{
  const pulse=environmentalPulse(f,time),targets=disasterTargets(key,time),fall=(pulse.phase-f.on/f.period)/(1-f.on/f.period),impact=pulse.active,age=pulse.phase*f.period;
  for(let i=0;i<4;i++){
   const p=pieces[i],t=targets[i],h=ground(t.u,t.v),rise=forecast?20:impact?0:volcanic?Math.sin(Math.max(0,fall)*Math.PI)*27:32*(1-Math.max(0,fall));
   p.trace.visible=!volcanic&&(forecast||!impact);p.body.visible=!impact&&!forecast;p.body.position.set(t.u+(volcanic?0:rise*.36),h+rise,t.v-rise*.16);p.body.rotation.z=volcanic?-.2:.34;p.mesh.rotation.set(time*1.7+i,time*.9,time*.3);
   p.mark.position.set(t.u,h+.12,t.v);p.clock.position.set(t.u,h+.16,t.v);p.mark.visible=forecast||!impact;p.mark.material.opacity=.45+.25*Math.sin(time*8)**2;
   p.clock.visible=forecast||!impact;p.clock.scale.setScalar(forecast?.65:Math.max(.08,1-fall));
   p.shock.visible=impact;p.shock.position.set(t.u,h+.22,t.v);p.shock.scale.setScalar(1+age*13);p.crater.visible=!forecast;p.crater.position.set(t.u,h+.035,t.v);
   p.flash.visible=impact&&!forecast;p.flash.position.set(t.u,h+.5,t.v);p.flash.scale.set(1+age*12,.5+age*3,1+age*12);p.flash.material.opacity=.8*Math.max(0,1-age/f.on);
   for(let k=0;k<8;k++){const a=k*2.399+i,r=impact?age*9:1.6,at=i*8+k;position.set(t.u+Math.cos(a)*r,h+.4+age*3+(k%3)*.3,t.v+Math.sin(a)*r);scale.setScalar(impact?.5+age*1.5:0);matrix.compose(position,spin,scale);dust.setMatrixAt(at,matrix);}
   for(let k=0;k<10;k++){const a=k*2.399,life=(time*1.8+k/10)%1;if(impact)position.set(t.u+Math.sin(a)*age*15,h+.6+Math.sin(age/f.on*Math.PI)*2+(k%3)*.3,t.v+Math.cos(a)*age*15);else position.copy(p.body.position).add(offset.set(Math.sin(a)*life,life*6,Math.cos(a)*life));scale.setScalar(forecast?0:impact?.13:.07+(1-life)*.14);spin.setFromAxisAngle(axis,time+k);matrix.compose(position,spin,scale);sparks.setMatrixAt(i*10+k,matrix);}
  }
  dust.visible=!forecast;dust.instanceMatrix.needsUpdate=true;sparks.instanceMatrix.needsUpdate=true;
 };
 root.userData.update(0);return root;
}

export function buildWeatherFront(key,ground=()=>0){
 const root=new THREE.Group(),f=DISASTERS[key],sand=key==='sandstorm',hail=key==='hail',matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),euler=new THREE.Euler(),v=new THREE.Vector3(),s=new THREE.Vector3(),heights=new Map();
 const groundAt=(x,z)=>{const a=Math.round(x/2),b=Math.round(z/2),k=a+','+b;if(!heights.has(k))heights.set(k,ground(a*2,b*2));return heights.get(k);};
 const cloudMat=rock(sand?0xb6a07a:hail?0x667986:0xb6c6c9);cloudMat.userData.noContour=true;
 const cloud=batch(root,new THREE.IcosahedronGeometry(1,2),cloudMat,38);
 // One continuous dust face carries the front; billows add depth rather than
 // reading as a row of disconnected balls. Ground warnings share its footprint.
 let curtain=null;
 if(sand){const positions=[],colors=[],indices=[],color=new THREE.Color(),rows=13,columns=40;
  for(let j=0;j<=columns;j++)for(let k=0;k<=rows;k++){const z=(j/columns*2-1)*f.radius*.95,t=k/rows,edge=Math.sqrt(Math.max(0,1-(z/f.radius)**2)),y=t*(17+Math.sin(z*.24)*2)*edge,x=Math.sin(t*Math.PI)*4+Math.sin(z*.2+t*3)*1.1;
   positions.push(x,groundAt(x,z)+y,z);color.setHex(k>9?0xc6b591:k<3?0x88785e:0xaa926d);color.multiplyScalar(.91+.09*Math.sin(j*2+k));colors.push(color.r,color.g,color.b);
   if(j<columns&&k<rows){const a=j*(rows+1)+k;indices.push(a,a+rows+1,a+1,a+1,a+rows+1,a+rows+2);}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide,transparent:true,opacity:.82,depthWrite:false});material.userData.noContour=true;curtain=new THREE.Mesh(geometry,material);root.add(curtain);
 }
 const areaGeometry=new THREE.CircleGeometry(f.radius,64);areaGeometry.rotateX(-Math.PI/2);const ap=areaGeometry.attributes.position;for(let i=0;i<ap.count;i++)ap.setY(i,groundAt(ap.getX(i),ap.getZ(i))+.18);
 const area=new THREE.Mesh(areaGeometry,glow(0xef746c,.2));root.add(area);
 const flecks=batch(root,hail?new THREE.OctahedronGeometry(1):new THREE.PlaneGeometry(1,1),glow(sand?0xdfbe83:0xeaf9f8,.7),128);
 const gusts=[];for(let k=0;k<6;k++){const points=[];for(let i=0;i<40;i++){const a=i/39*Math.PI*1.35,r=8+k*1.8;points.push(new THREE.Vector3(Math.cos(a)*r,1+k*1.3+Math.sin(a*2),Math.sin(a)*r));}const line=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),40,.045,4,false),glow(sand?0xf3d394:0xccedf2,.42));root.add(line);gusts.push(line);}
 root.userData.update=(time,warning=false)=>{
  const front=sand?Math.sin(time*.2)*f.radius*.6:0;
  for(let i=0;i<38;i++){const a=i*2.399,r=Math.sqrt((i+.5)/38)*f.radius*.78,x=sand?front+Math.sin(a)*3.5:Math.sin(a)*r,z=sand?Math.cos(a)*f.radius*.9:Math.cos(a)*r,y=sand?3+((i*.618)%1)*13:18+Math.sin(i*1.73)*2;
   v.set(x,groundAt(x,z)+y+Math.sin(time+i)*.4,z);s.set(sand?3.8:5.5,(sand?3.2:4.1)+(i%4)*.65,4+(i%3)*.55);q.setFromEuler(euler.set(.08*Math.sin(i),i*.63,.12*Math.cos(i)));matrix.compose(v,q,s);cloud.setMatrixAt(i,matrix);}
  for(let i=0;i<128;i++){const t=(time*(hail?.9:.22)+i*.618)%1,a=i*2.399,r=Math.sqrt((i+.5)/128)*f.radius,x=sand?front+(t-.5)*13:Math.cos(a)*r+(hail?0:Math.sin(time+i)*3),z=Math.sin(a)*r,y=hail?22*(1-t):1+(i%11)*1.45;
   v.set(x,groundAt(x,z)+y,z);s.set(hail?.16:.22,hail?.27:.055,hail?.16:1);q.setFromEuler(euler.set(.7,time*.2+a,a));matrix.compose(v,q,s);flecks.setMatrixAt(i,matrix);}
  area.visible=warning;area.material.opacity=.15+.14*Math.sin(time*4)**2;if(curtain)curtain.position.x=front;
  flecks.visible=!warning;cloud.instanceMatrix.needsUpdate=true;flecks.instanceMatrix.needsUpdate=true;gusts.forEach((g,i)=>{g.rotation.y=time*(sand?.18:.32)+i;g.visible=!warning;g.position.x=front;});
 };
 root.userData.update(0);return root;
}
