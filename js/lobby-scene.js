import * as THREE from 'three';
import {paintedBox} from './painted-geometry.js';
import {makePineGeometry,makeBroadleafGeometry} from './world.js';
import {solarGeography} from './run/solar-worlds.js';
import {batchStaticScenery} from './static-batches.js';

export function buildLobbyCourtyard(scene){
 const palette={grass:0x879a59,stone:0xb3b099,wood:0x675649,trim:0xd8c89c,roof:0x54746e,path:0xc9c3a4},materials=Object.fromEntries(Object.entries(palette).map(([k,c])=>[k,new THREE.MeshStandardMaterial({color:c,roughness:.9,flatShading:true})]));
 const cache=new Map(),material=color=>{if(!cache.has(color))cache.set(color,new THREE.MeshStandardMaterial({color,roughness:.86,flatShading:true}));return cache.get(color);};
 const mesh=(geo,mat,x,y,z,parent=scene)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 const box=(w,h,d,x,y,z,mat=materials.stone,parent=scene)=>mesh(paintedBox(w,h,d),mat,x,y,z,parent);
 function sign(text,x,y,z,color='#e8e4c8',width=14){const c=document.createElement('canvas');c.width=1024;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle='#213842';ctx.fillRect(0,0,1024,160);ctx.strokeStyle='#879d89';ctx.lineWidth=9;ctx.strokeRect(7,7,1010,146);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 66px Barlow Condensed, sans-serif';ctx.strokeStyle='#10222b';ctx.lineWidth=5;ctx.strokeText(text,512,83,960);ctx.fillStyle=color;ctx.fillText(text,512,83,960);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return mesh(new THREE.PlaneGeometry(width,width*160/1024),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}),x,y,z);}
 box(104,4,98,0,-2.2,-6,materials.grass);box(82,.3,78,0,-.2,-4,materials.stone);box(30,.08,64,0,-.01,-3,materials.path);
 materials.path.userData.noContour=true;
 // Shallow paving seams are shared instances, with staggered joints rather
 // than a dense grid of independent meshes.
 const paving=new THREE.InstancedMesh(paintedBox(3.8,.07,2.75),materials.path,224),matrix=new THREE.Matrix4();let index=0;
 for(let row=0;row<14;row++)for(let col=0;col<16;col++){matrix.makeTranslation((col-7.5)*4+(row%2)*1.7,.015,(row-6.5)*3);paving.setMatrixAt(index,matrix);paving.setColorAt(index++,new THREE.Color().setScalar(.87+Math.sin(row*9.4+col*13.2)*.07));}paving.receiveShadow=true;scene.add(paving);
 const stations=[{key:'commanders',name:'COMMANDER SHOP',x:-27,z:-17,color:0xbfd4aa},{key:'foundry',name:'TOWER FOUNDRY',x:27,z:-17,color:0xe6c17c},{key:'weapons',name:'WEAPONS ROLLER',x:0,z:-34,color:0xe7b49b},{key:'mounts',name:'MOUNT STABLE',x:-31,z:14,color:0xb9cbd1},{key:'homeworld',name:'HOMEWORLD',x:31,z:14,color:0xa6e0cf},{key:'mission',name:'START EXPEDITION',x:-8,z:-4,color:0xb7df9c},{key:'mission-return',name:'CONTINUE ROUTE',x:8,z:-4,color:0xe7ce88,action:'mission'}];
 const stationHits=[],colliders=[];
 function facade(s){const g=new THREE.Group();g.position.set(s.x,0,s.z-5);scene.add(g);const color=material(s.key==='commanders'?0xa99b83:0x819797),roof=s.key==='commanders'?material(0x7b6151):materials.roof;
  box(21,.7,13,0,.2,0,materials.stone,g);box(21,8.8,1,0,4.5,-5.8,color,g);
  for(const x of [-9.6,9.6])box(1,8.8,12,x,4.5,0,color,g);
  for(const x of [-7,7])box(6.3,6.6,1,x,3.5,5.8,color,g);
  box(21,3,12,0,8.8,0,color,g);box(22,.5,13.5,0,10.5,0,materials.trim,g);
  for(const side of [-1,1]){const r=box(12,.4,15,side*5.4,11.85,0,roof,g);r.rotation.z=-side*.24;}
  for(const x of [-8,-4,0,4,8]){box(1.8,1.9,.12,x,8.65,6.08,material(0xdac58d),g);box(.12,2,.2,x,8.65,6.18,materials.wood,g);box(2,.15,.35,x,7.62,6.2,materials.trim,g);}
  for(const x of [-9.7,-3.5,3.5,9.7])box(.32,7,.42,x,3.65,6.4,materials.wood,g);
  box(23,.35,4,0,6.15,7,roof,g);for(const x of [-10,10])box(.45,6.1,.45,x,3.05,8.3,materials.wood,g);
  const label=sign(s.name,s.x,11.2,s.z+2,'#f2dfaf',21);label.userData.station=s.key;stationHits.push(label);
  for(const x of [-1,1])colliders.push({x:s.x+x*7,z:s.z-4,w:6.5,d:11});colliders.push({x:s.x,z:s.z-10.5,w:20,d:1});
 }
 facade(stations[0]);facade(stations[1]);
 for(const s of stations){
  const join=s.key.startsWith('mission'),r=join?4.4:3.6;s.pad=mesh(new THREE.CylinderGeometry(r,r,.08,48),material(s.color),s.x,.1,s.z+2);s.pad.userData.station=s.key;stationHits.push(s.pad);
  const rim=mesh(new THREE.TorusGeometry(r,.13,6,64),material(s.color),s.x,.16,s.z+2);rim.rotation.x=Math.PI/2;
  if(join){sign(s.name,s.x,3.9,s.z-1.7,s.key==='mission'?'#d4efb3':'#f3d8a1',7.7);sign('1 PLAYER  /  SOLO',s.x,.65,s.z+4.8,'#d2e7ce',5);continue;}
  if(['commanders','foundry'].includes(s.key))continue;
  for(const x of [-5,5])box(.45,5,.45,s.x+x,2.5,s.z-3,materials.wood);
  box(12,.35,7,s.x,5.2,s.z-3,materials.roof);sign(s.name,s.x,6.8,s.z+1,'#e5ecd0',12);
 }
 // Roller is a physical machine with three visible reels, a lever and chute.
 box(7,3.3,3,0,1.75,-34,materials.wood);for(let k=-1;k<=1;k++){box(1.75,1.7,.2,k*2,2.1,-32.4,material(0xdccca7));mesh(new THREE.OctahedronGeometry(.55),material([0x8fc9b4,0xe8b86d,0xb2a9d3][k+1]),k*2,2.1,-32.1);}
 box(7,.4,1.2,0,.6,-31.6,materials.trim);box(.18,2,.18,4,2,-32.5,materials.wood);mesh(new THREE.SphereGeometry(.32,10,8),material(0xc9795d),4,3,-32.5);
 const lamps=[];for(const x of [-15,15])for(const z of [-22,8,28]){box(.26,6,.26,x,3,z,materials.wood);box(1.2,.17,1.2,x,6.1,z,materials.roof);const bulb=mesh(new THREE.SphereGeometry(.32,10,8),new THREE.MeshBasicMaterial({color:0xffdc98}),x,5.65,z);lamps.push(bulb);}
 for(const x of [-18,18])for(const z of [8,25]){box(6,.7,3,x,.35,z,materials.stone);box(5.6,.3,2.6,x,.85,z,materials.grass);for(let i=0;i<4;i++)mesh(new THREE.IcosahedronGeometry(.7,1),materials.grass,x-2+i*1.3,1.2,z+Math.sin(i)*.25);box(5,.24,1.4,x,.7,z-2.6,materials.wood);for(const side of [-1,1])box(.24,.8,.9,x+side*1.9,.35,z-2.6,materials.wood);}
 const foliage=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true}),pines=makePineGeometry(),leaves=makeBroadleafGeometry();
 for(let i=0;i<70;i++){const a=i*2.399,r=48+Math.sin(i*4.8)*4,x=Math.cos(a)*r,z=Math.sin(a)*r-5;const t=mesh(i%3?pines:leaves,foliage,x,0,z);t.scale.setScalar(6+Math.sin(i*1.7)*1.4);}
 for(let i=0;i<18;i++){const a=i*Math.PI/9,stone=mesh(new THREE.IcosahedronGeometry(5+(i%3),1),materials.stone,Math.cos(a)*52,1,Math.sin(a)*52-5);stone.scale.set(1.5,1.3,1);}
 for(const side of [-1,1]){box(.8,4,78,side*43,2,-6,materials.stone);for(let z=-40;z<33;z+=8)box(1.3,4.8,1.4,side*43,2.4,z,materials.trim);}
 box(86,4,.9,0,2,-44,materials.stone);
 const heart=mesh(new THREE.OctahedronGeometry(1.5),material(0xa4e0ca),0,3,15);mesh(new THREE.CylinderGeometry(3.3,4,.7,16),materials.trim,0,.35,15);sign('DEFEND  •  EXPLORE  •  RETURN',0,1.2,18,'#ecdeb8',6.5);
 const geo=new THREE.SphereGeometry(2.3,64,40),colors=[],pos=geo.attributes.position,color=new THREE.Color();for(let i=0;i<pos.count;i++){const d=new THREE.Vector3().fromBufferAttribute(pos,i).normalize(),g=solarGeography('earth',d.x,d.y,d.z);color.setHex(g.land<.3?0x467f96:g.biome==='tundra'?0xd1dcca:g.biome==='desert'?0xd5bd80:0x809c61);colors.push(color.r,color.g,color.b);}geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const globe=mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9}),31,3,14);
 batchStaticScenery(scene,new Set([heart,globe]));
 return {material,materials,mesh,sign,stations,stationHits,colliders,heart,update:time=>{heart.rotation.y=time*.3;heart.position.y=3+Math.sin(time*1.4)*.12;globe.rotation.y=time*.08;}};
}
