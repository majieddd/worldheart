import * as THREE from 'three';
import {placeActiveFeatures,buildActiveFeature} from './active-features.js';

// Additional surfaces make actual open space under bridges, cave roofs and
// floating slabs. Ground navigation continues underneath; controlled bodies
// can land on a roof they reach from above. Mesh and collision share these data.
export function createTerrainFeatures(field,radius,ground,ecology=null){
 const surfaces=[],vents=[];
 const active=ecology?placeActiveFeatures(field,radius,ground,ecology.biome,ecology.water,ecology.seed):[];
 const at=(m,u,v)=>ground(...field.project(m,u,v));
 const add=(m,key,u,v,halfU,halfV,top,bottom,round=false,angle=0)=>{
  surfaces.push({m,key,u,v,halfU,halfV,top,bottom,round,angle,dir:field.project(m,u,v),bound:(Math.hypot(u,v)+Math.hypot(halfU,halfV))*1.2/radius});
 };
 for(const m of field.modules){
  if(!m.height)continue;const e=m.extent*Math.min(1,m.size),h=at(m,0,0);
  if(m.type==='valley'||m.type==='grotto'){
   const cave=m.type==='grotto',span=e*(cave?.50:.64),width=e*(cave?.68:.34);
   // Sample the actual banks once. The roof grows from those same shoulders,
   // rather than balancing a rectangular slab on two unrelated heights.
   const banks=Array.from({length:33},(_,i)=>{const u=(i/16-1)*width;return [at(m,u,-span),at(m,u,span)];});
   const bank=(u,side)=>{const t=Math.max(0,Math.min(31.999,(u/width+1)*16)),i=Math.floor(t);return banks[i][side]+(banks[i+1][side]-banks[i][side])*(t-i);};
   const top=(u,v)=>{const t=(v/span+1)/2,cap=Math.max(0,1-(v/span)**2);return bank(u,0)*(1-t)+bank(u,1)*t+(cave?3.8:3.2)*cap*(.75+.25*Math.cos(u/width*Math.PI/2));};
   add(m,cave?'cave-roof':'glacial-bridge',0,0,width,span,top,(u,v)=>top(u,v)-2.8-5.5*(v/span)**2,true);
   surfaces.at(-1).rim=a=>1/Math.pow(Math.abs(Math.cos(a))**6+Math.abs(Math.sin(a))**6,1/6);
  }else if(m.type==='arcade'||m.type==='caverns'){
   const cavern=m.type==='caverns';
   for(let k=-1;k<=1;k++){
    const x=k*e*.49,span=e*(cavern?.55:.65),width=e*(cavern?.21:.11),left=at(m,x,-span),right=at(m,x,span);
    const top=(u,v)=>left+(right-left)*(v/span+1)/2+(cavern?8:10)*Math.max(0,1-(v/span)**2);
    add(m,cavern?'cavern-vault':'stone-arch',x,0,width,span,top,(u,v)=>top(u,v)-3-7*(v/span)**4,true);
    surfaces.at(-1).rim=a=>1/Math.pow(Math.abs(Math.cos(a))**8+Math.abs(Math.sin(a))**8,1/8);
   }
  }else if(m.type==='ribbons'){
   for(let k=-1;k<=1;k++){
    const level=ecology?.floating?28:17+(k+1)*7,half=e*.8,width=e*.11;
    add(m,'floating-ribbon',0,k*e*.37,half,width,(u)=>level+(ecology?.floating?0:u*.12),(u)=>level+(ecology?.floating?0:u*.12)-3,false);
    // The same continuous curved centreline is used by geometry and collision.
    const s=surfaces.at(-1);s.bend=u=>Math.sin(u/e*3+k)*e*.15;
    s.dir=field.project(m,s.u,s.v+s.bend(0));
   }
   if(ecology?.floating)for(const sign of [-1,1])add(m,'ribbon-crossing',e*.48*sign,0,e*.09,e*.6,()=>28,()=>25,false);
  }else if(m.type==='sky'){
   for(let k=0;k<3;k++){const u=(k-1)*e*.43,v=(k%2?.12:-.1)*e,r=e*(ecology?.floating?.4:k===1?.30:.24);
    const level=ecology?.floating?28:Math.max(0,h)+18+k*9;
    add(m,'floating-slab',u,v,r,r,()=>level,(x,y)=>level-3-8*Math.max(0,1-Math.hypot(x/r,y/r)),true);
    surfaces.at(-1).rim=a=>.9+.06*Math.sin(a*3+m.phase)+.04*Math.cos(a*5);
   }
  }else if(m.type==='pedestals'){
   for(const [x,y]of [[-.4,-.3],[.38,-.28],[0,.4]]){const r=e*.23,top=at(m,x*e,y*e)+m.height*.24;
    const base=at(m,x*e,y*e),span=Math.max(1,top-base-2.4);
    add(m,'pedestal-cap',x*e,y*e,r,r,()=>top,(u,v)=>{const q=Math.min(1,Math.hypot(u/r,v/r)),t=Math.max(0,Math.min(1,(q-.28)/.48));return base+span*t*t*(3-2*t);},true);
   }
  }else if(m.type==='trunks'){
   for(let k=0;k<3;k++){const u=(k-1)*e*.2,v=(k-1)*e*.32,r=3.5+(k%2)*.8,level=h+6+k*.6;
    add(m,'fossil-log',u,v,e*.62,r,(_,y)=>level+Math.sqrt(Math.max(0,r*r-y*y)),(_,y)=>level-Math.sqrt(Math.max(0,r*r-y*y)),false,k%2?.7:-.4);
   }
  }else if(m.type==='geyser'){
   const u=e*.47,v=Math.sin(5.4)*e*.22;vents.push({m,dir:new THREE.Vector3(...field.project(m,u,v)),height:at(m,u,v),radius:3.8,phase:m.phase});
  }
 }
 if(ecology?.floating){
  const linked=new Set();
  for(const m of field.modules){
   const near=field.modules.filter(n=>n!==m).sort((a,b)=>a.dir.reduce((s,x,k)=>s+(x-m.dir[k])**2,0)-b.dir.reduce((s,x,k)=>s+(x-m.dir[k])**2,0)).slice(0,3);
   for(const other of near){const key=[m.id,other.id].sort((a,b)=>a-b).join(':');if(linked.has(key))continue;linked.add(key);
    const otherDir=field.project(other,0,0),p=field.coordinates(m,otherDir),length=Math.hypot(p.u,p.v),angle=Math.atan2(p.v,p.u);
    add(m,'island-causeway',p.u/2,p.v/2,length/2+5,5,()=>28,()=>24,false,angle);
   }
  }
 }
 for(const site of active){
  if(site.key==='geyser')vents.push(site);
  if(site.key==='trunks'){
   add(site.m,'fossil-log',site.u,site.v,1.05,6,(u,v)=>site.height+1.35+Math.sqrt(Math.max(0,(.975-v*.0125)**2-u*u)),(u,v)=>site.height+1.35-Math.sqrt(Math.max(0,(.975-v*.0125)**2-u*u)),false);
  }
 }
 function local(s,dir,w){
  if(dir[0]*s.dir[0]+dir[1]*s.dir[1]+dir[2]*s.dir[2]<Math.cos(s.bound+.025))return null;
  const p=w?{u:(w[0]*s.m.axis[0]+w[1]*s.m.axis[1]+w[2]*s.m.axis[2])*radius,v:(w[0]*s.m.side[0]+w[1]*s.m.side[1]+w[2]*s.m.side[2])*radius}:field.coordinates(s.m,dir),x=p.u-s.u,y=p.v-s.v,c=Math.cos(s.angle),n=Math.sin(s.angle),u=x*c+y*n,v=y*c-x*n-(s.bend?.(u)||0);
  if(Math.abs(u)>s.halfU||Math.abs(v)>s.halfV||s.round&&Math.hypot(u/s.halfU,v/s.halfV)>(s.rim?.(Math.atan2(v/s.halfV,u/s.halfU))??1))return null;
  return {u,v};
 }
 const buckets=new Map();
 function nearby(dir){const b=dir.map(v=>Math.max(0,Math.min(15,Math.floor((v+1)*8)))),key=b.join(':');if(!buckets.has(key)){const d=new THREE.Vector3(...b.map(v=>(v+.5)/8-1)).normalize();buckets.set(key,surfaces.filter(s=>d.dot(new THREE.Vector3(...s.dir))>Math.cos(s.bound+.24)));}return buckets.get(key);}
 function support(dir,ceiling,floor){
  const w=field.warped(dir);let best=floor;for(const s of nearby(dir)){const p=local(s,dir,w);if(!p)continue;const h=s.top(p.u,p.v);if(h<=ceiling+.12&&h>best)best=h;}return best;
 }
 function ceiling(dir,feet){const w=field.warped(dir);let best=Infinity;for(const s of nearby(dir)){const p=local(s,dir,w);if(!p)continue;const h=s.bottom(p.u,p.v);if(h>feet+.1)best=Math.min(best,h);}return best;}
 function intersects(dir,feet,height){const w=field.warped(dir);for(const s of nearby(dir)){const p=local(s,dir,w);if(p&&feet<s.top(p.u,p.v)-.1&&feet+height>s.bottom(p.u,p.v)+.05)return true;}return false;}
 function build({point,color=()=>0x987f65,topColor=()=>0x859e63,scale=1,spherical=!point,include=()=>true}={}){
  const group=new THREE.Group(),steam=[],roots=[];let projectionCache;
  const vertex=(s,u,v,h)=>{const key=u+','+v;let dir=projectionCache.get(key);if(!dir){const c=Math.cos(s.angle),n=Math.sin(s.angle),b=v+(s.bend?.(u)||0);dir=field.project(s.m,s.u+u*c-b*n,s.v+b*c+u*n);projectionCache.set(key,dir);}return point?point(dir,h):new THREE.Vector3(...dir).multiplyScalar(radius+h);};
  for(const s of surfaces){
   if(!include(s.dir))continue;
   if(s.key==='fossil-log'&&active.length)continue;
   projectionCache=new Map();
   const positions=[],colors=[],n=scale<.1?12:24,rings=scale<.1?5:10,segments=scale<.1?32:64,meshColor=new THREE.Color(color(s.dir));
   const emit=(u,v,top)=>{const p=vertex(s,u,v,(top?s.top:s.bottom)(u,v));positions.push(p.x,p.y,p.z);const c=(top&&s.key!=='fossil-log'?new THREE.Color(topColor(s.dir)).lerp(meshColor,.2):meshColor.clone()).multiplyScalar((top?1:.72)*(s.key==='fossil-log'?.88+.12*Math.cos(u*.65):1));colors.push(c.r,c.g,c.b);};
   if(s.round)for(let ring=0;ring<rings;ring++)for(let k=0;k<segments;k++){
    const uv=(r,a)=>[Math.cos(a)*r*s.halfU*(s.rim?.(a)??1),Math.sin(a)*r*s.halfV*(s.rim?.(a)??1)],a=k*Math.PI*2/segments,b=(k+1)*Math.PI*2/segments,r=ring/rings,t=(ring+1)/rings;
    for(const top of [true,false])for(const p of [uv(r,a),uv(t,a),uv(r,b),uv(r,b),uv(t,a),uv(t,b)])emit(...p,top);
   }
   else for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const ua=(x/n*2-1)*s.halfU,ub=((x+1)/n*2-1)*s.halfU,va=(y/n*2-1)*s.halfV,vb=((y+1)/n*2-1)*s.halfV;
    for(const top of [true,false])for(const [u,v]of [[ua,va],[ua,vb],[ub,va],[ub,va],[ua,vb],[ub,vb]])emit(u,v,top);
   }
   // Vertical edge faces close the finite slabs, keeping cave interiors open.
   const edge=s.round?segments:4*n;
   for(let k=0;k<edge;k++){
    const xy=i=>{if(s.round){const a=i/edge*Math.PI*2;return [Math.cos(a)*s.halfU*(s.rim?.(a)??1),Math.sin(a)*s.halfV*(s.rim?.(a)??1)];}const side=Math.floor(i/n)%4,t=(i%n)/n*2-1;return side===0?[t*s.halfU,-s.halfV]:side===1?[s.halfU,t*s.halfV]:side===2?[-t*s.halfU,s.halfV]:[-s.halfU,-t*s.halfV];};
    const a=xy(k),b=xy((k+1)%edge);for(const [p,top]of [[a,true],[a,false],[b,true],[b,true],[a,false],[b,false]])emit(...p,top);
   }
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
   const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9,side:THREE.DoubleSide}));mesh.name=s.key;mesh.userData.surface=s;group.add(mesh);
  }
  for(const vent of vents.filter(v=>!v.key)){
   if(!include(vent.dir.toArray()))continue;
   const root=new THREE.Group(),pos=point?point(vent.dir.toArray(),vent.height):vent.dir.clone().multiplyScalar(radius+vent.height);root.position.copy(pos);root.scale.setScalar(scale);if(spherical)root.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vent.dir);
   roots.push({root,vent,height:vent.height});
   const rim=new THREE.Mesh(new THREE.TorusGeometry(1.5,.36,6,14),new THREE.MeshStandardMaterial({color:0xd9c478,flatShading:true}));rim.rotation.x=Math.PI/2;root.add(rim);
   for(let k=0;k<7;k++){const cloud=new THREE.Mesh(new THREE.IcosahedronGeometry(.65+k*.12,0),new THREE.MeshBasicMaterial({color:0xd4eeee,transparent:true,opacity:.48,depthWrite:false}));root.add(cloud);steam.push({cloud,k,vent});}group.add(root);
  }
  const activeArt=[];
  for(const site of active){
   if(!include(site.dir.toArray()))continue;
   const model=buildActiveFeature(site.key),origin=point?point(site.dir.toArray(),site.height):site.dir.clone().multiplyScalar(radius+site.height);model.position.copy(origin);
   if(site.key==='trunks'){
    // Bend the visible log through the same projected coordinates as its
    // collider. A straight tangent prop otherwise misses the warped end caps.
    const geo=model.children[0].geometry,p=geo.attributes.position;model.children[0].material.side=THREE.DoubleSide;
    for(let i=0;i<p.count;i++){const d=field.project(site.m,site.u+p.getX(i),site.v+p.getZ(i)),h=site.height+p.getY(i),v=(point?point(d,h):new THREE.Vector3(...d).multiplyScalar(radius+h)).sub(origin);p.setXYZ(i,v.x,v.y,v.z);}
    p.needsUpdate=true;geo.computeVertexNormals();
   }else{
    model.scale.setScalar(scale);if(spherical){const x=new THREE.Vector3(...site.m.axis).addScaledVector(site.dir,-new THREE.Vector3(...site.m.axis).dot(site.dir)).normalize(),z=new THREE.Vector3().crossVectors(x,site.dir);model.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,site.dir,z));}
   }
   group.add(model);activeArt.push({site,model});
  }
  group.userData.update=time=>{for(const a of activeArt){a.model.position.copy(point?point(a.site.dir.toArray(),a.site.height):a.site.dir.clone().multiplyScalar(radius+a.site.height));a.model.userData.update(time+a.site.phase);}for(const r of roots)if(r.height!==r.vent.height){r.height=r.vent.height;r.root.position.copy(point?point(r.vent.dir.toArray(),r.height):r.vent.dir.clone().multiplyScalar(radius+r.height));}for(const p of steam){const phase=(time+p.vent.phase)%12,on=phase<2.8;p.cloud.visible=on;if(on){const h=((time*5+p.k*.9)%9);p.cloud.position.set(Math.sin(p.k+time)*.5,h,Math.cos(p.k+time)*.5);p.cloud.scale.setScalar(.4+h*.12);}}};
  return group;
 }
 return {surfaces,vents,active,support,ceiling,intersects,build,field};
}
