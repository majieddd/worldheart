import * as THREE from 'three';
import { insideStrike } from './attacks.js';

function shape(arc) {
  const half = arc * Math.PI / 360, fill = [], lines = [], steps = 28;
  const point = (angle, latitude = 0) => [Math.sin(angle)*Math.cos(latitude), Math.sin(latitude), -Math.cos(angle)*Math.cos(latitude)];
  for (let i=0;i<steps;i++) {
    const a=-half+i/steps*half*2,b=-half+(i+1)/steps*half*2;
    fill.push(0,0,0,...point(a),...point(b));
    for (const lat of [-Math.PI/3,0,Math.PI/3]) lines.push(...point(a,lat),...point(b,lat));
  }
  for (const angle of [-half,half]) {
    lines.push(0,0,0,...point(angle));
    for(let i=0;i<18;i++) lines.push(...point(angle,-Math.PI/2+i*Math.PI/18),...point(angle,-Math.PI/2+(i+1)*Math.PI/18));
  }
  const geometry = list => new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(list,3));
  return {fill:geometry(fill),lines:geometry(lines)};
}
export class ThreatGuides {
  constructor(scene,enemies) { this.scene=scene;this.enemies=enemies;this.pool=[];this.shapes=new Map(); }
  contains(enemy,point) {
    const plan=enemy.attackPlan;
    return !!plan && insideStrike(_offset.copy(point).sub(enemy.attackOrigin),enemy.attackUp,enemy.attackFacing,plan.radius,plan.arcDeg);
  }
  update() {
    let i=0;
    for(const e of this.enemies.active) {
      if(!e.active||e.dead||!e.attackPlan||e.windT<=0)continue;
      let group=this.pool[i++];
      if(!group) {
        group=new THREE.Group();
        group.add(new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0xff3c4e,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide})),new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xff4959,transparent:true,opacity:.8,depthWrite:false})));
        this.pool.push(group);this.scene.add(group);
      }
      const plan=e.attackPlan;
      if(!this.shapes.has(plan.arcDeg))this.shapes.set(plan.arcDeg,shape(plan.arcDeg));
      const geometry=this.shapes.get(plan.arcDeg);
      group.children[0].geometry=geometry.fill;group.children[1].geometry=geometry.lines;
      group.children[0].material.opacity=.12+.16*(1-e.windT/plan.wind);
      _right.crossVectors(e.attackFacing,e.attackUp).normalize();_back.copy(e.attackFacing).negate();
      _basis.makeBasis(_right,e.attackUp,_back);
      group.quaternion.setFromRotationMatrix(_basis);group.position.copy(e.attackOrigin);group.scale.setScalar(plan.radius);
      group.visible=true;group.userData.enemyId=e.id;group.userData.attack=plan;
    }
    for(;i<this.pool.length;i++)this.pool[i].visible=false;
  }
}
const _offset=new THREE.Vector3(),_right=new THREE.Vector3(),_back=new THREE.Vector3(),_basis=new THREE.Matrix4();
