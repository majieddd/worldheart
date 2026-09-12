import * as THREE from 'three';

// Additional surfaces make actual open space under bridges, cave roofs and
// floating slabs. Ground navigation continues underneath; controlled bodies
// can land on a roof they reach from above. Mesh and collision share these data.
export function createTerrainFeatures(field,radius,ground){
 const surfaces=[],vents=[];
 const at=(m,u,v)=>ground(...field.project(m,u,v));
 const add=(m,key,u,v,halfU,halfV,top,bottom,round=false,angle=0)=>{
  surfaces.push({m,key,u,v,halfU,halfV,top,bottom,round,angle,dir:field.project(m,u,v),bound:(Math.hypot(u,v)+Math.hypot(halfU,halfV))*1.2/radius});
 };
 for(const m of field.modules){
  if(!m.height)continue;const e=m.extent*Math.min(1,m.size),h=at(m,0,0);
  if(m.type==='valley'||m.type==='grotto'){
   const cave=m.type==='grotto',span=e*(cave?.48:.55),width=cave?e*.42:3.2+e*.025;
   const left=at(m,0,-span),right=at(m,0,span);
   const top=(u,v)=>left+(right-left)*(v/span+1)/2+(cave?6.8:2.5)*(1-(v/span)**2)+(cave?.65*Math.sin(u*.35)*Math.sin(v*.18):0);
   add(m,cave?'cave-roof':'glacial-bridge',0,0,width,span,top,(u,v)=>top(u,v)-(cave?2.8:1.8));
  }else if(m.type==='sky'){
   for(let k=0;k<3;k++){const u=(k-1)*e*.43,v=(k%2?.12:-.1)*e,r=e*(k===1?.30:.24);
    const level=Math.max(0,h)+7+k*7;
    add(m,'floating-slab',u,v,r,r,()=>level,(x,y)=>level-3-8*Math.max(0,1-Math.hypot(x/r,y/r)),true);
    surfaces.at(-1).rim=a=>.9+.06*Math.sin(a*3+m.phase)+.04*Math.cos(a*5);
   }
  }else if(m.type==='pedestals'){
   for(const [x,y]of [[-.4,-.3],[.38,-.28],[0,.4]]){const r=e*.23,top=at(m,x*e,y*e)+m.height*.24;
    add(m,'pedestal-cap',x*e,y*e,r,r,()=>top,(u,v)=>top-1.8-2*Math.max(0,1-Math.hypot(u/r,v/r)),true);
   }
  }else if(m.type==='trunks'){
   for(let k=0;k<3;k++){const u=(k-1)*e*.2,v=(k-1)*e*.32,r=3.5+(k%2)*.8,level=h+6+k*.6;
    add(m,'fossil-log',u,v,e*.62,r,(_,y)=>level+Math.sqrt(Math.max(0,r*r-y*y)),(_,y)=>level-Math.sqrt(Math.max(0,r*r-y*y)),false,k%2?.7:-.4);
   }
  }else if(m.type==='geyser'){
   const u=e*.47,v=Math.sin(5.4)*e*.22;vents.push({m,dir:new THREE.Vector3(...field.project(m,u,v)),height:at(m,u,v),radius:3.8,phase:m.phase});
  }
 }
 function local(s,dir){
  if(dir[0]*s.dir[0]+dir[1]*s.dir[1]+dir[2]*s.dir[2]<Math.cos(s.bound+.025))return null;
  const p=field.coordinates(s.m,dir),x=p.u-s.u,y=p.v-s.v,c=Math.cos(s.angle),n=Math.sin(s.angle),u=x*c+y*n,v=y*c-x*n;
  if(Math.abs(u)>s.halfU||Math.abs(v)>s.halfV||s.round&&Math.hypot(u/s.halfU,v/s.halfV)>(s.rim?.(Math.atan2(v/s.halfV,u/s.halfU))??1))return null;
  return {u,v};
 }
 function support(dir,ceiling,floor){
  let best=floor;for(const s of surfaces){const p=local(s,dir);if(!p)continue;const h=s.top(p.u,p.v);if(h<=ceiling+.12&&h>best)best=h;}return best;
 }
 function ceiling(dir,feet){let best=Infinity;for(const s of surfaces){const p=local(s,dir);if(!p)continue;const h=s.bottom(p.u,p.v);if(h>feet+.1)best=Math.min(best,h);}return best;}
 function intersects(dir,feet,height){for(const s of surfaces){const p=local(s,dir);if(p&&feet<s.top(p.u,p.v)-.1&&feet+height>s.bottom(p.u,p.v)+.05)return true;}return false;}
 function build({point,color=()=>0x987f65,topColor=()=>0x859e63,scale=1,spherical=!point,include=()=>true}={}){
  const group=new THREE.Group(),steam=[],roots=[];let projectionCache;
  const vertex=(s,u,v,h)=>{const key=u+','+v;let dir=projectionCache.get(key);if(!dir){const c=Math.cos(s.angle),n=Math.sin(s.angle);dir=field.project(s.m,s.u+u*c-v*n,s.v+v*c+u*n);projectionCache.set(key,dir);}return point?point(dir,h):new THREE.Vector3(...dir).multiplyScalar(radius+h);};
  for(const s of surfaces){
   if(!include(s.dir))continue;
   projectionCache=new Map();
   const positions=[],colors=[],n=24,meshColor=new THREE.Color(color(s.dir));
   const emit=(u,v,top)=>{const p=vertex(s,u,v,(top?s.top:s.bottom)(u,v));positions.push(p.x,p.y,p.z);const c=(top&&s.key==='floating-slab'?new THREE.Color(topColor(s.dir)):meshColor.clone()).multiplyScalar((top?1:.66)*(s.key==='fossil-log'?.88+.12*Math.cos(u*.65):1));colors.push(c.r,c.g,c.b);};
   if(s.round)for(let ring=0;ring<10;ring++)for(let k=0;k<64;k++){
    const uv=(r,a)=>[Math.cos(a)*r*s.halfU*(s.rim?.(a)??1),Math.sin(a)*r*s.halfV*(s.rim?.(a)??1)],a=k*Math.PI/32,b=(k+1)*Math.PI/32,r=ring/10,t=(ring+1)/10;
    for(const top of [true,false])for(const p of [uv(r,a),uv(t,a),uv(r,b),uv(r,b),uv(t,a),uv(t,b)])emit(...p,top);
   }
   else for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const ua=(x/n*2-1)*s.halfU,ub=((x+1)/n*2-1)*s.halfU,va=(y/n*2-1)*s.halfV,vb=((y+1)/n*2-1)*s.halfV;
    for(const top of [true,false])for(const [u,v]of [[ua,va],[ua,vb],[ub,va],[ub,va],[ua,vb],[ub,vb]])emit(u,v,top);
   }
   // Vertical edge faces close the finite slabs, keeping cave interiors open.
   const edge=s.round?64:4*n;
   for(let k=0;k<edge;k++){
    const xy=i=>{if(s.round){const a=i/edge*Math.PI*2;return [Math.cos(a)*s.halfU*(s.rim?.(a)??1),Math.sin(a)*s.halfV*(s.rim?.(a)??1)];}const side=Math.floor(i/n)%4,t=(i%n)/n*2-1;return side===0?[t*s.halfU,-s.halfV]:side===1?[s.halfU,t*s.halfV]:side===2?[-t*s.halfU,s.halfV]:[-s.halfU,-t*s.halfV];};
    const a=xy(k),b=xy((k+1)%edge);for(const [p,top]of [[a,true],[a,false],[b,true],[b,true],[a,false],[b,false]])emit(...p,top);
   }
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
   const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9,side:THREE.DoubleSide}));mesh.name=s.key;mesh.userData.surface=s;group.add(mesh);
   if(s.key==='pedestal-cap'){
    const base=at(s.m,s.u,s.v),top=s.bottom(0,0),middle=(base+top)/2,pos=vertex(s,0,0,middle),geo=new THREE.CylinderGeometry(1.1,1.65,Math.max(.1,top-base),9),prop=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:meshColor,flatShading:true}));
    if(spherical)prop.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...s.dir));prop.scale.setScalar(scale);prop.position.copy(pos);group.add(prop);
   }
  }
  for(const vent of vents){
   if(!include(vent.dir.toArray()))continue;
   const root=new THREE.Group(),pos=point?point(vent.dir.toArray(),vent.height):vent.dir.clone().multiplyScalar(radius+vent.height);root.position.copy(pos);root.scale.setScalar(scale);if(spherical)root.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vent.dir);
   roots.push({root,vent,height:vent.height});
   const rim=new THREE.Mesh(new THREE.TorusGeometry(1.5,.36,6,14),new THREE.MeshStandardMaterial({color:0xd9c478,flatShading:true}));rim.rotation.x=Math.PI/2;root.add(rim);
   for(let k=0;k<7;k++){const cloud=new THREE.Mesh(new THREE.IcosahedronGeometry(.65+k*.12,0),new THREE.MeshBasicMaterial({color:0xd4eeee,transparent:true,opacity:.48,depthWrite:false}));root.add(cloud);steam.push({cloud,k,vent});}group.add(root);
  }
  group.userData.update=time=>{for(const r of roots)if(r.height!==r.vent.height){r.height=r.vent.height;r.root.position.copy(point?point(r.vent.dir.toArray(),r.height):r.vent.dir.clone().multiplyScalar(radius+r.height));}for(const p of steam){const phase=(time+p.vent.phase)%12,on=phase<2.8;p.cloud.visible=on;if(on){const h=((time*5+p.k*.9)%9);p.cloud.position.set(Math.sin(p.k+time)*.5,h,Math.cos(p.k+time)*.5);p.cloud.scale.setScalar(.4+h*.12);}}};
  return group;
 }
 return {surfaces,vents,support,ceiling,intersects,build,field};
}
