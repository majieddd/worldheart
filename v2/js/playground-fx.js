import * as THREE from 'three';

// Bounded world-space shapes, with ink silhouettes instead of a lens overlay.
export function createEffects(scene){
  const particles=[],rings=[],geos=[new THREE.IcosahedronGeometry(1,0),new THREE.SphereGeometry(1,7,5)];
  const inks=[];for(let i=0;i<160;i++){
    const mat=new THREE.MeshBasicMaterial({color:'#e9be73',transparent:true}),mesh=new THREE.Mesh(geos[i%2],mat);
    const ink=new THREE.Mesh(geos[i%2],new THREE.MeshBasicMaterial({color:'#35303a',side:THREE.BackSide,transparent:true}));ink.scale.setScalar(1.09);mesh.add(ink);mesh.visible=false;scene.add(mesh);inks.push(ink);
    particles.push({mesh,ink,velocity:new THREE.Vector3(),age:0,life:0,size:1,gravity:0});
  }
  const ringGeometry=new THREE.TorusGeometry(1,.035,5,48);
  for(let i=0;i<14;i++){const mat=new THREE.MeshBasicMaterial({color:'#f7d994',transparent:true,side:THREE.DoubleSide,depthWrite:false}),mesh=new THREE.Mesh(ringGeometry,mat);mesh.visible=false;scene.add(mesh);rings.push({mesh,age:0,life:0,radius:1});}
  let cursor=0,ringCursor=0,emitted=0;const rand=()=>Math.random();
  function puff(position,{count=12,color='#e7c99b',speed=2,life=.55,size=.11,gravity=3,up=1.2}={}){
    for(let i=0;i<count;i++){const p=particles[cursor++%particles.length],a=rand()*Math.PI*2,r=.35+rand()*.65;p.mesh.position.copy(position);p.mesh.material.color.set(color);p.velocity.set(Math.cos(a)*speed*r,up+rand()*speed,Math.sin(a)*speed*r);p.age=0;p.life=life*(.7+rand()*.6);p.size=size*(.7+rand()*.7);p.gravity=gravity;p.mesh.scale.setScalar(p.size);p.mesh.visible=true;p.mesh.rotation.set(rand()*6,rand()*6,rand()*6);emitted++;}
  }
  function ring(position,{radius=2,color='#f2d49b',life=.45,vertical=false}={}){const r=rings[ringCursor++%rings.length];r.mesh.position.copy(position);r.mesh.rotation.set(vertical?0:Math.PI/2,0,0);r.mesh.material.color.set(color);r.age=0;r.life=life;r.radius=radius;r.mesh.visible=true;}
  function hit(position,color='#f3ca78'){puff(position,{color,count:18,speed:3.4,up:1.3,size:.09,life:.44});ring(position,{color,radius:.8,life:.25,vertical:true});}
  function tick(dt){for(const p of particles){if(!p.mesh.visible)continue;p.age+=dt;if(p.age>=p.life){p.mesh.visible=false;continue;}p.velocity.y-=p.gravity*dt;p.mesh.position.addScaledVector(p.velocity,dt);const t=p.age/p.life;p.mesh.scale.setScalar(p.size*(1-t*.7));p.mesh.material.opacity=p.ink.material.opacity=1-t*t;p.mesh.rotation.z+=dt*2;}
    for(const r of rings){if(!r.mesh.visible)continue;r.age+=dt;const t=r.age/r.life;if(t>=1){r.mesh.visible=false;continue;}r.mesh.scale.setScalar(.1+r.radius*(1-(1-t)**3));r.mesh.material.opacity=(1-t)**2;}}
  return {puff,ring,hit,tick,get emitted(){return emitted;},get active(){return particles.filter(p=>p.mesh.visible).length+rings.filter(r=>r.mesh.visible).length;},clear(){for(const p of particles)p.mesh.visible=false;for(const r of rings)r.mesh.visible=false;}};
}
