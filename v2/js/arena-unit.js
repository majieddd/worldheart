import * as THREE from 'three';
import {kit} from './arena-kit.js';
import {createActor} from './playground-actor.js';

export async function createDemoUnit(paint,type,index=0){
  const k=kit(paint),actor=await createActor(paint,{color:type.color}),gear=k.weapon(type.weapon);
  gear.root.scale.setScalar(type.weapon==='sword'?.8:.65);actor.root.add(gear.root);
  const badge=k.mesh(actor.root,k.box(index===2?.9:.55,.32,.27),paint.material(type.color),[0,1.65,-.45]);
  if(index===2)k.mesh(actor.root,k.box(.7,1.1,.14),k.mats.gold,[-.8,1.15,.3],[0,-.3,-.1]);
  return {actor,gear,badge,hand:actor.model.getObjectByName('Palm2R'),type};
}
export function poseUnitGear(unit,phase=0){
  const {actor,gear,hand,type}=unit;if(!hand)return;
  const p=hand.getWorldPosition(new THREE.Vector3());actor.root.worldToLocal(p);gear.root.position.copy(p);
  gear.root.rotation.set(type.weapon==='rifle'?0:-.7-Math.sin(phase*Math.PI)*1.5,Math.PI,0);
}
