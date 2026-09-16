import * as THREE from 'three';
import {kit} from './arena-kit.js';
import {SWORD_REST as rest,swordPose} from './arena-motion.js';

const smooth=t=>t*t*(3-2*t),v3=a=>new THREE.Vector3(...a),quat=a=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...a));
export function createWeapons(paint){
  const k=kit(paint,{detail:true}),root=new THREE.Group(),sword=k.weapon('sword'),rifle=k.weapon('rifle');root.add(sword.root,rifle.root);sword.root.scale.setScalar(.82);rifle.root.scale.setScalar(.72);
  const arms=[];
  for(const side of [-1,1]){
    const shoulder=v3([side*.48,-.37,.07]),upper=k.mesh(root,new THREE.CylinderGeometry(.073,.09,1,10),k.mats.cloth),fore=k.mesh(root,new THREE.CylinderGeometry(.07,.085,1,10),k.mats.gold),elbow=k.mesh(root,new THREE.SphereGeometry(.095,10,8),k.mats.dark),hand=new THREE.Group();root.add(hand);
    k.mesh(hand,k.box(.145,.19,.13),k.mats.cloth,[0,-.025,0]);const fingers=[];for(let i=0;i<3;i++){const joint=new THREE.Group();joint.position.set(-.052+i*.05,-.12,-.045);hand.add(joint);k.mesh(joint,new THREE.CapsuleGeometry(.025,.07,3,6),k.mats.gold,[0,-.04,0],[.3,0,0]);k.mesh(joint,new THREE.CapsuleGeometry(.024,.055,3,6),k.mats.cloth,[0,-.083,-.033],[1.0,0,0]);fingers.push(joint);}k.mesh(hand,new THREE.CapsuleGeometry(.03,.075,3,6),k.mats.gold,[side*.09,-.04,-.05],[.45,0,side*.45]);arms.push({side,shoulder,upper,fore,elbow,hand,fingers});
  }
  const flash=k.mesh(rifle.root,new THREE.IcosahedronGeometry(.13,0),new THREE.MeshBasicMaterial({color:'#c5fff0'}),[0,.14,-1.2],[0,0,0],false);flash.visible=false;
  let kick=0,lookX=0,lookY=0,phase=0,lastWeapon='sword',equip=1;const tip=new THREE.Vector3(),base=new THREE.Vector3();
  function link(mesh,a,b){mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=a.distanceTo(b);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());}
  function arm(a,target,q){const delta=target.clone().sub(a.shoulder),d=THREE.MathUtils.clamp(delta.length(),.08,.875),dir=delta.normalize(),end=a.shoulder.clone().addScaledVector(dir,d),pole=v3([a.side,-.65,.2]);pole.addScaledVector(dir,-pole.dot(dir)).normalize();const along=(.45*.45-.44*.44+d*d)/(2*d),height=Math.sqrt(Math.max(0,.45*.45-along*along)),elbow=a.shoulder.clone().addScaledVector(dir,along).addScaledVector(pole,height);link(a.upper,a.shoulder,elbow);link(a.fore,elbow,end);a.elbow.position.copy(elbow);a.hand.position.copy(end);a.hand.quaternion.copy(q);return end;}
  function update(dt,{weapon='sword',attack=0,combo=0,moving=0,aim=false,vent=0,bob=.35,look=[0,0],time=0}={}){
    if(lastWeapon!==weapon){lastWeapon=weapon;equip=0;}equip=Math.min(1,equip+dt*6);kick*=Math.exp(-dt*22);lookX=THREE.MathUtils.damp(lookX,THREE.MathUtils.clamp(look[0]*-.001,-.025,.025),18,dt);lookY=THREE.MathUtils.damp(lookY,THREE.MathUtils.clamp(look[1]*-.001,-.02,.02),18,dt);phase+=dt*moving*3.2;
    sword.root.visible=weapon==='sword';rifle.root.visible=weapon==='rifle';let pose=weapon==='sword'&&attack>0?(()=>{const p=swordPose(combo,attack);return {p:v3(p.p),q:quat(p.r)};})():{p:v3(weapon==='sword'?rest.p:[aim?.04:.32,aim?-.34:-.43,-.61]),q:quat(weapon==='sword'?rest.r:[kick*.13,0,0])};
    if(aim&&weapon==='sword'&&!attack)pose={p:v3([.03,-.3,-.73]),q:quat([-.25,-.2,1.2])};
    if(innerWidth/innerHeight<.8){pose.p.x*=.65;pose.p.z-=.15;}pose.p.x+=lookX+Math.sin(phase)*.009*bob*moving;pose.p.y+=lookY+Math.abs(Math.cos(phase))*.013*bob*moving-(1-smooth(equip))*.48;pose.p.z+=kick*.075;if(vent>0){pose.p.y-=Math.sin(vent*Math.PI)*.2;pose.q.multiply(quat([0,0,-Math.sin(vent*Math.PI)*.65]));}
    const held=weapon==='sword'?sword:rifle;held.root.position.copy(arm(arms[1],pose.p,pose.q));held.root.quaternion.copy(pose.q);
    held.root.updateMatrixWorld(true);const support=weapon==='rifle'?root.worldToLocal(held.root.localToWorld(v3([-.1,-.02,-.44]))):v3([-.35,-.53,-.5]);arm(arms[0],support,quat(weapon==='rifle'?[-.1,0,-.15]:[.1,0,.2]));for(const a of arms)for(const f of a.fingers)f.rotation.x=weapon==='sword'?.2:.42;
    flash.visible=kick>.18;flash.scale.setScalar(.7+kick*1.6);root.updateMatrixWorld(true);held.tip.getWorldPosition(tip);held.base.getWorldPosition(base);return {tip,base};
  }
  return {root,sword,rifle,arms,update,get tip(){return tip;},get base(){return base;},fire(){kick=1;},get recoil(){return kick;},get joints(){return arms.flatMap(a=>[a.shoulder,a.elbow.position,a.hand.position]).map(v=>v.toArray());}};
}
