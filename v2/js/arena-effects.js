import * as THREE from 'three';
import {createEffects as createDust} from './playground-fx.js';

// The original soft particles remain useful for dust. Contact uses a short,
// opaque ink burst and angular streaks, never a full-screen haze or bloom pass.
export function createEffects(scene){
  const dust=createDust(scene),bursts=[],ribbons=[];
  const shape=new THREE.Shape();for(let i=0;i<16;i++){const a=i*Math.PI/8,r=i%2?.19:(i%4?.48:.75);const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);}shape.closePath();
  const star=new THREE.ShapeGeometry(shape),shard=new THREE.ConeGeometry(.04,.55,4);
  for(let i=0;i<24;i++){
    const root=new THREE.Group(),face=new THREE.Mesh(star,new THREE.MeshBasicMaterial({color:'#ffeac1',side:THREE.DoubleSide,depthWrite:false}));
    const ink=new THREE.Mesh(star,new THREE.MeshBasicMaterial({color:'#293146',side:THREE.DoubleSide,depthWrite:false}));ink.scale.setScalar(1.16);ink.position.z=-.008;root.add(ink,face);
    const rays=[];for(let j=0;j<7;j++){const r=new THREE.Mesh(shard,new THREE.MeshBasicMaterial({color:'#edc182'}));root.add(r);rays.push(r);}root.visible=false;scene.add(root);bursts.push({root,face,ink,rays,age:0,life:.32});
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(18),3));const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:'#efdbb1',side:THREE.DoubleSide,transparent:true,depthWrite:false}));mesh.visible=false;mesh.frustumCulled=false;scene.add(mesh);ribbons.push({mesh,life:0});
  }
  let cursor=0,ribbonCursor=0,emitted=0;
  function hit(position,color='#f3ca78'){
    const b=bursts[cursor++%bursts.length];b.root.position.copy(position);b.root.quaternion.identity();b.age=0;b.root.visible=true;b.face.material.color.set(color);b.root.scale.setScalar(.55);b.face.visible=b.ink.visible=true;
    for(const [i,r] of b.rays.entries()){r.material.color.set(color);const a=i*Math.PI*2/7+.3;r.position.set(Math.cos(a)*.2,Math.sin(a)*.2,0);r.rotation.z=a-Math.PI/2;r.scale.setScalar(1);}
    dust.puff(position,{count:6,color,speed:2.2,up:.8,size:.045,life:.28});emitted++;
  }
  function slash(base,tip,lastBase,lastTip){const r=ribbons[ribbonCursor++%ribbons.length],p=r.mesh.geometry.attributes.position;[lastBase,lastTip,tip,lastBase,tip,base].forEach((v,i)=>p.setXYZ(i,v.x,v.y,v.z));p.needsUpdate=true;r.life=.095;r.mesh.visible=true;r.mesh.material.opacity=.45;}
  function tick(dt){dust.tick(dt);for(const b of bursts){if(!b.root.visible)continue;b.age+=dt;const t=b.age/b.life;if(t>=1){b.root.visible=false;continue;}b.face.visible=b.ink.visible=t<.32;b.root.scale.setScalar(.55+Math.min(t,.32)*1.3);for(const [i,r] of b.rays.entries()){const a=i*Math.PI*2/7+.3,d=.25+t*1.6;r.position.set(Math.cos(a)*d,Math.sin(a)*d,0);r.scale.set(.8,Math.max(.01,1-t),.8);}}for(const r of ribbons){r.life=Math.max(0,r.life-dt);r.mesh.visible=r.life>0;r.mesh.material.opacity=r.life/.095*.45;}}
  function faceCamera(camera){for(const b of bursts)if(b.root.visible)b.root.quaternion.copy(camera.quaternion);}
  return {...dust,hit,slash,tick,faceCamera,get active(){return dust.active+bursts.filter(b=>b.root.visible).length+ribbons.filter(r=>r.life>0).length;},get emitted(){return dust.emitted+emitted;},clear(){dust.clear();for(const b of bursts)b.root.visible=false;for(const r of ribbons){r.life=0;r.mesh.visible=false;}}};
}

export function plasmaMesh(){
  const root=new THREE.Mesh(new THREE.CapsuleGeometry(.055,.45,2,6),new THREE.MeshBasicMaterial({color:'#a0ead4'}));
  const ink=new THREE.Mesh(new THREE.CapsuleGeometry(.076,.46,2,6),new THREE.MeshBasicMaterial({color:'#293146',side:THREE.BackSide}));root.add(ink);
  const core=new THREE.Mesh(new THREE.CapsuleGeometry(.023,.49,2,6),new THREE.MeshBasicMaterial({color:'#effff0'}));core.position.z=.045;root.add(core);return root;
}
