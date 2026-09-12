import * as THREE from 'three';
import { MOUNTS } from './run/expedition.js';
import { R, surfaceElevation, overheadHeight, supportHeight } from './world.js';

export function buildMount(key){
  const group=new THREE.Group(),moving=[],m=MOUNTS[key]||MOUNTS.strider;
  const body=new THREE.MeshStandardMaterial({color:m.color||0xaabbbb,flatShading:true,roughness:.65});
  const dark=new THREE.MeshStandardMaterial({color:0x344553,flatShading:true,roughness:.65});
  const glow=new THREE.MeshStandardMaterial({color:0xadebdf,emissive:0x63b8a4,emissiveIntensity:.6,flatShading:true});
  const add=(g,mat,x,y,z)=>{const mesh=new THREE.Mesh(g,mat);mesh.position.set(x,y,z);group.add(mesh);return mesh;};
  if(key==='skyray'){
    add(new THREE.CylinderGeometry(.57,1.14,.22,24),body,0,.77,0);
    add(new THREE.CylinderGeometry(1.14,.4,.25,24),dark,0,.535,0);
    const rim=add(new THREE.TorusGeometry(1.10,.045,5,32),glow,0,.66,0);rim.rotation.x=Math.PI/2;
    const canopy=add(new THREE.SphereGeometry(.43,16,8,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0x85d9df,transparent:true,opacity:.72,roughness:.15,metalness:.25}),0,.88,-.42);canopy.scale.z=.8;
    add(new THREE.CylinderGeometry(.32,.24,.08,12),glow,0,.37,0);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;add(new THREE.SphereGeometry(.07,6,4),glow,Math.cos(a)*.9,.69,Math.sin(a)*.9);}
    moving.push({mesh:rim,spin:true});
  }else{
    const torso=add(key==='tideback'?new THREE.IcosahedronGeometry(.8,1):new THREE.BoxGeometry(.85,.65,1.5),body,0,.9,0);torso.scale.set(1,key==='tideback'?.65:1,1.1);
    add(new THREE.BoxGeometry(.46,.45,.65),body,0,1.3,-.85);
    for(const side of [-1,1])for(const z of [-.5,.5]){const leg=add(new THREE.BoxGeometry(key==='tideback'?.5:.2,.7,key==='tideback'?.45:.23),dark,side*(key==='tideback'?.65:.4),.38,z);moving.push({mesh:leg,side:side*(z<0?1:-1)});}
    for(const x of [-.18,.18])add(new THREE.BoxGeometry(.09,.09,.06),glow,x,1.4,-1.18);
    if(key==='strider')for(const side of [-1,1]){const horn=add(new THREE.ConeGeometry(.09,.7,5),glow,side*.22,1.8,-.78);horn.rotation.z=side*.25;}
  }
  add(new THREE.BoxGeometry(.55,.15,.65),dark,0,key==='skyray'?.84:1.24,0);
  return {group,update(t,motion=0){for(const p of moving)if(p.spin)p.mesh.rotation.z=t*.7;else p.mesh.rotation.x=Math.sin(t*9)*motion*.55*p.side;}};
}
const v=new THREE.Vector3(),back=new THREE.Vector3(),right=new THREE.Vector3(),basis=new THREE.Matrix4();
export class MountController {
  constructor({scene,allies,possession,commander,choice,ui}){
    Object.assign(this,{scene,allies,possession,commander,choice,ui});this.energy=12;this.time=0;this.models={};this.list=[];
    for(const key of Object.keys(MOUNTS))if(key!=='none'){const model=buildMount(key);model.group.visible=false;scene.add(model.group);this.models[key]=model;this.list.push(model);}
  }
  toggle(){
    const a=this.commander();if(!a?.active||a.dead)return false;
    if(a.mountFlight>0){this.ui.toast('Land before dismounting. Release Space to descend.','info');return false;}
    a.mountKey=a.mountKey&&a.mountKey!=='none'?'none':this.choice;
    const m=MOUNTS[a.mountKey]||MOUNTS.none;a.mountOffset=m.height;
    this.ui.toast(a.mountKey==='none'?'Dismounted':`${m.name}: ${m.description}`,'info');return true;
  }
  update(dt){
    this.time+=dt;const a=this.commander();for(const model of this.list)model.group.visible=false;
    if(!a?.active||a.dead)return;
    const key=a.mountKey||'none',m=MOUNTS[key]||MOUNTS.none;a.mountOffset=m.height;a.mountSpeed=m.speed;a.mountWater=m.water;
    if(key==='skyray'){
      const wants=this.possession.unit===a&&!this.possession.suspended&&this.possession.keys.has('Space');
      if(wants&&this.energy>0){this.energy=Math.max(0,this.energy-dt);const feet=surfaceElevation(a.dir,a.height)+(a.hop||0);a.mountFlight=Math.max(0,Math.min(8,a.mountFlight+dt*5,overheadHeight(a.dir,feet+a.mountFlight)-feet-a.mountOffset-1.7));}
      else {const feet=surfaceElevation(a.dir,a.height)+(a.hop||0)+a.mountFlight,h=supportHeight(a.dir,feet);a.mountFlight=Math.max(0,a.mountFlight-dt*5);if(h>a.height+.1&&surfaceElevation(a.dir,a.height)+(a.hop||0)+a.mountFlight<=surfaceElevation(a.dir,h)){a.height=h;a.mountFlight=0;a.hop=0;a.airT=0;a.vertVel=0;}}
      if(!wants&&a.mountFlight===0)this.energy=Math.min(12,this.energy+dt*2);
      a.mountFlying=a.mountFlight>.65;
    }else{a.mountFlight=0;a.mountFlying=false;}
    const model=this.models[key];if(!model)return;
    model.group.visible=true;v.copy(a.dir).multiplyScalar(R+surfaceElevation(a.dir,a.height)+(a.hop||0)+(a.mountFlight||0)+(a.weatherLift||0));
    right.crossVectors(a.fwd,a.dir).normalize();back.copy(a.fwd).negate();basis.makeBasis(right,a.dir,back);
    model.group.position.copy(v);model.group.quaternion.setFromRotationMatrix(basis);model.update(this.time,a.cos?.moveT||0);
  }
}
