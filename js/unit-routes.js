import * as THREE from 'three';
import {PALETTE} from './config.js';
import {R,surfacePoint} from './world.js';

// The line consumes the unit's current route and routeAt, never a second
// pathfinder. Each segment is sampled onto the same surface as locomotion.
export class UnitRoutes {
  constructor(scene,allies,nav) {
    Object.assign(this,{allies,nav});
    this.points=new Float32Array(24576);
    this.geometry=new THREE.BufferGeometry();
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.points,3).setUsage(THREE.DynamicDrawUsage));
    this.line=new THREE.LineSegments(this.geometry,new THREE.LineBasicMaterial({color:PALETTE.energy,transparent:true,opacity:.8,depthWrite:false}));
    this.line.frustumCulled=false;scene.add(this.line);
    this.visibleUnitIds=[];
  }
  update() {
    let count=0;this.visibleUnitIds.length=0;
    const put=dir=>{surfacePoint(dir,_pos).addScaledVector(dir,.15);this.points[count++]=_pos.x;this.points[count++]=_pos.y;this.points[count++]=_pos.z;};
    for(const a of this.allies.active) {
      if(!a.active||a.dead||!a.selected||a.possessed||!a.order||!a.route?.length||a.routeRevision!==this.nav.revision)continue;
      this.visibleUnitIds.push(a.id);_from.copy(a.dir);
      for(let i=a.routeAt;i<=a.route.length;i++) {
        if(i<a.route.length)this.nav.nodeDir(a.route[i],_to);else _to.copy(a.routeGoal||a.order);
        const steps=Math.max(1,Math.ceil(_from.angleTo(_to)*R/.35));
        for(let j=0;j<steps&&count+6<=this.points.length;j++) {
          _dir.copy(_from).lerp(_to,j/steps).normalize();put(_dir);
          _dir.copy(_from).lerp(_to,(j+1)/steps).normalize();put(_dir);
        }
        _from.copy(_to);
      }
    }
    this.geometry.setDrawRange(0,count/3);this.geometry.attributes.position.needsUpdate=true;
    this.line.visible=count>0;
  }
}
const _from=new THREE.Vector3(),_to=new THREE.Vector3(),_dir=new THREE.Vector3(),_pos=new THREE.Vector3();
