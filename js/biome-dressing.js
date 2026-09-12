import * as THREE from 'three';
import {NEW_BIOMES} from './run/world-catalogue.js';

// Each added habitat owns a silhouette, not just a tint of the same tree.
// The caller merges these pieces into one instanced geometry per habitat.
export function appendBiomeDressing(kind,add){
 if(!NEW_BIOMES[kind])return false;
 const c=NEW_BIOMES[kind].accent;
 const cylinder=(r1,r2,h,color,x=0,y=h/2,z=0)=>add(new THREE.CylinderGeometry(r1,r2,h,7),color,x,y,z);
 const crown=(x,y,z,r,color,squash=1)=>{const g=new THREE.IcosahedronGeometry(r,1);g.scale(1,squash,1);add(g,color,x,y,z);};
 const limb=(a,b,r,color)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),g=new THREE.CylinderGeometry(r*.65,r,start.distanceTo(end),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize()));const p=start.add(end).multiplyScalar(.5);add(g,color,p.x,p.y,p.z);};
 if(kind==='redwood'){
  cylinder(.3,.68,8,0x8b4738);for(let k=0;k<4;k++)add(new THREE.ConeGeometry(2.1-k*.38,2.2,9),k%2?0x356b51:0x487b5a,0,5.5+k*1.05);
 }else if(kind==='bamboo'){
  for(let k=0;k<5;k++){const x=Math.cos(k*2.4)*.65,z=Math.sin(k*2.4)*.65,h=3.5+k*.25;cylinder(.095,.12,h,0x6d9d48,x,h/2,z);for(let j=1;j<7;j++)cylinder(.14,.14,.065,0xc0ca74,x,j*h/7,z);for(let j=0;j<3;j++){const g=new THREE.IcosahedronGeometry(.6,0);g.scale(1,.12,.25);g.rotateZ(j*.8-.8);add(g,0x5b9447,x+.3,2+j*.6,z);}}
 }else if(kind==='cherry'){
  cylinder(.18,.3,2.6,0x6f505c);for(let k=0;k<6;k++){const a=k*Math.PI/3,x=Math.cos(a)*1.3,z=Math.sin(a)*1.3;limb([0,1.6,0],[x,2.7,z],.12,0x755761);crown(x,3,z,1.2,k%2?0xf4c4cc:0xeaa0bb,.55);}
 }else if(kind==='autumn'){
  cylinder(.16,.3,3.8,0x69513d);for(let k=0;k<4;k++)crown(Math.sin(k*2)*.7,3+k*.45,Math.cos(k*2)*.7,1.15,[0xd36e35,0xb74a39,0xe7ac4a,0xce7e34][k],1.3);
 }else if(kind==='baobab'){
  cylinder(.72,1.05,3.6,0x8f7e64);for(let k=0;k<5;k++){const a=k*1.256,x=Math.cos(a),z=Math.sin(a);limb([x*.4,2.8,z*.4],[x*1.8,4.3,z*1.8],.23,0x96866b);crown(x*1.8,4.45,z*1.8,1,0x87934e,.4);}
 }else if(kind==='cloudforest'){
  cylinder(.18,.35,4,0x5e8070);for(let k=0;k<5;k++){const x=Math.cos(k*2.4),z=Math.sin(k*2.4);crown(x,4.2+(k%2)*.6,z,1.45,0x94bfa6,.6);for(let j=0;j<3;j++)limb([x+j*.18,4,z],[x+.15,1.8+j*.5,z+.1],.035,0x79a994);}
 }else if(kind==='salt'){
  for(let k=0;k<5;k++){const g=new THREE.CylinderGeometry(.8,.9,.11,6);add(g,k%2?0xd9ded5:0xf0e5d5,Math.cos(k*1.3),.04,Math.sin(k*1.3));}cylinder(.62,.62,.025,0x9cced0,0,.12);
 }else if(kind==='sulfur'){
  for(let k=0;k<3;k++)cylinder(1.2-k*.26,1.4-k*.24,.26,k%2?0xdfcf50:0xb9a936,0,.13+k*.25);cylinder(.32,.36,.1,0x625848,0,.82);for(let k=0;k<3;k++)crown(Math.sin(k)*.18,1.1+k*.45,0,.22+k*.08,0xd9dcb9,.7);
 }else if(kind==='obsidian'){
  for(let k=0;k<5;k++){const g=new THREE.BoxGeometry(.8,1.2+(k%3)*.65,.3);g.rotateZ((k-2)*.4);g.rotateY(k*.7);add(g,k%2?0x27253d:0x434559,(k-2)*.4,.65,Math.sin(k)*.3);}
 }else if(kind==='coralreef'){
  for(let k=0;k<4;k++){const x=(k-1.5)*.55,z=Math.sin(k)*.3;limb([x,0,z],[x,1.5,z],.14,k%2?0xe29993:0xe8bb88);for(let j=0;j<3;j++){const y=.55+j*.37;for(const sign of [-1,1]){limb([x,y,z],[x+sign*.4,y+.35,z],.075,0xe29aab);limb([x+sign*.4,y+.35,z],[x+sign*.4,y+.65,z],.055,0xecd0a2);}}}
 }else if(kind==='kelp'){
  for(let k=0;k<5;k++){const g=new THREE.PlaneGeometry(.55,3.4+k*.32,1,9),p=g.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i)+2;p.setXYZ(i,p.getX(i)+Math.sin(y*1.3+k)*.35,y,Math.cos(y*.9+k)*.25);}g.computeVertexNormals();g.rotateY(k*1.2);add(g,k%2?0x95a75a:0x597d54,Math.sin(k)*.55,0,Math.cos(k)*.55);}
 }else if(kind==='lichen'){
  for(let k=0;k<8;k++)crown(Math.cos(k*2.4)*(k%3)*.45,.18,Math.sin(k*2.4)*(k%3)*.45,.4,k%3===0?0xd6aa71:k%2?0xa9b3a4:0x829491,.45);
 }else if(kind==='sponge'){
  for(let k=0;k<4;k++){const h=1.1+k*.28,x=Math.sin(k*2.4)*.8,z=Math.cos(k*2.4)*.8;add(new THREE.CylinderGeometry(.36,.48,h,9,1,true),k%2?0xd5aa7b:0xc19271,x,h/2,z);cylinder(.26,.26,.04,0x665562,x,h-.16,z);add(new THREE.TorusGeometry(.32,.07,5,9).rotateX(Math.PI/2),0xe6c59a,x,h,z);}
 }else if(kind==='carnivorous'){
  for(let k=0;k<3;k++){const x=Math.sin(k*2.4)*.7,z=Math.cos(k*2.4)*.7,h=1.4+k*.35;add(new THREE.CylinderGeometry(.43,.15,h,9,1,true),0x975e7d,x,h/2,z);cylinder(.32,.32,.03,0x51384e,x,h-.14,z);add(new THREE.TorusGeometry(.39,.06,5,10).rotateX(Math.PI/2),0xd2a2a5,x,h,z);crown(x,h+.35,z-.3,.5,0x54816e,.24);for(let j=0;j<4;j++){const g=new THREE.ConeGeometry(.24,1,4);g.rotateZ(1.1);g.rotateY(j*Math.PI/2);add(g,0x608570,x,.2,z);}}
 }else if(kind==='aurora'){
  for(let k=0;k<5;k++){const a=k*Math.PI*2/5,x=Math.cos(a),z=Math.sin(a);limb([0,0,0],[x*.6,2,z*.6],.11,0x567e91);limb([x*.6,2,z*.6],[x*1.5,2.6,z*1.5],.065,0x7caeb0);for(let j=0;j<4;j++){const g=new THREE.IcosahedronGeometry(.55,0);g.scale(.3,.1,1);g.rotateY(-a);add(g,c,x*(.7+j*.2),2.2+j*.1,z*(.7+j*.2));}crown(x*1.5,2.1,z*1.5,.14,0xb4f8df);}
 }
 return true;
}
