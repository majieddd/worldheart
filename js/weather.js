import * as THREE from 'three';
import { R, terrainHeight, surfaceElevation, addTerrainFault, TERRAIN_FAULTS, orientOnSurface } from './world.js';
// A bounded simulation system. Quakes change the shared analytic field and
// refresh existing graph costs; they never replace a live graph or footprints.
export class PlanetWeather {
  constructor({scene,nav,world,allies,enemies,game,commander,centre,ui,oreField}){
    Object.assign(this,{scene,nav,world,allies,enemies,game,commander,centre,ui,oreField});
    this.phase='calm';this.remaining=0;this.clock=0;this.kind=null;this.events=[];
    this.dir=new THREE.Vector3();this.axis=new THREE.Vector3();this.tmp=new THREE.Vector3();this.step=new THREE.Vector3();this.bearing=new THREE.Vector3();this.turn=new THREE.Vector3();this.position=new THREE.Vector3();
    this.group=new THREE.Group();this.rings=[];
    const material=new THREE.MeshBasicMaterial({color:0xd9e9d9,transparent:true,opacity:.3,depthWrite:false});
    for(let i=0;i<12;i++){const mesh=new THREE.Mesh(new THREE.TorusGeometry(1.3+i*.39,.16+i*.013,4,22),material);mesh.rotation.x=Math.PI/2;mesh.position.y=i;this.group.add(mesh);this.rings.push(mesh);}
    const cone=new THREE.Mesh(new THREE.CylinderGeometry(5.5,1.3,12,14,8,true),new THREE.MeshBasicMaterial({color:0xa2bcaf,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));cone.position.y=6;this.group.add(cone);scene.add(this.group);this.group.visible=false;
    this.warning=new THREE.Mesh(new THREE.RingGeometry(7.6,8,48),new THREE.MeshBasicMaterial({color:0xffb463,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));this.warning.rotation.x=-Math.PI/2;this.warnRoot=new THREE.Group();this.warnRoot.add(this.warning);scene.add(this.warnRoot);this.warnRoot.visible=false;
  }
  get label(){return this.phase==='shifting'?'The ground is shifting. Combat resumes as the tremor settles.':this.phase==='warning'?`${this.kind==='quake'?'Earthquake':'Tornado'} in ${Math.ceil(this.remaining)}s. Move clear of the amber marker.`:this.phase==='active'?`Tornado crossing the field · ${Math.ceil(this.remaining)}s`:this.kind==='quake'?'Earthquake changed the ground. Review routes and tower positions.':'Weather calm';}
  wave(number){if(number>=3&&number%3===0&&this.phase==='calm')this.trigger(number%6===0&&TERRAIN_FAULTS.length<8?'quake':'tornado');}
  trigger(kind,dir=null){
    if(this.phase!=='calm'||!['quake','tornado'].includes(kind))return false;
    const a=this.commander();this.dir.copy(dir||a?.dir||this.centre);
    this.axis.copy(a?.fwd||this.tmp.set(1,0,0)).addScaledVector(this.dir,-this.axis.dot(this.dir)).normalize();
    if(!dir)this.dir.addScaledVector(this.axis,20/R).normalize();
    const node=this.nav.nearestWalkableNode(this.dir);if(node>=0)this.nav.nodeDir(node,this.dir);
    this.kind=kind;this.phase='warning';this.remaining=8;this.warnRoot.visible=true;
    this.position.copy(this.dir).multiplyScalar(R+surfaceElevation(this.dir)+.15);orientOnSurface(this.warnRoot,this.position);
    this.ui.toast(kind==='quake'?'Earthquake approaching. The marked ground will rise and split.':'Tornado approaching. Leave the marked area.', 'warn');return true;
  }
  *quakeSteps(){
    const fault=addTerrainFault(this.dir,this.axis,this.centre);if(!fault)return;
    const beforeRevision=this.nav.revision,blocks=this.nav.block;
    const protectedNodes=[this.nav.heartNode,...this.world.portals.filter(p=>p.established&&!p.destroyed).map(p=>p.node),...this.enemies.active.map(e=>e.node),...this.allies.active.map(a=>this.nav.nearestWalkableNode(a.dir))].filter(n=>n>=0&&Number.isFinite(this.nav.dist[n]));
    let changed=0,tries=0;
    do{changed=yield* this.nav.refreshTerrainSteps(fault);if(protectedNodes.every(n=>Number.isFinite(this.nav.dist[n])))break;fault.strength*=.5;}while(++tries<4);
    if(protectedNodes.some(n=>!Number.isFinite(this.nav.dist[n]))){fault.strength=0;yield* this.nav.refreshTerrainSteps(fault);}
    const vertices=yield* this.world.refreshFaultSteps(fault);
    for(const tower of this.game.towerMgr.towers){this.tmp.copy(tower.pos).normalize();if(this.tmp.dot(fault.dir)<fault.limit)continue;tower.pos.copy(this.tmp).multiplyScalar(R+surfaceElevation(this.tmp));orientOnSurface(tower.holder,tower.pos);}
    for(const p of this.world.portals){this.tmp.copy(p.group.position).normalize();if(this.tmp.dot(fault.dir)<fault.limit)continue;this.position.copy(this.tmp).multiplyScalar(R+surfaceElevation(this.tmp));orientOnSurface(p.group,this.position);}
    this.game._validateT=0;this.game.pathFlow?.setPaths(this.nav.previewPaths());
    this.events.push({kind:'quake',strength:fault.strength,changedNodes:changed,vertices,revisionBefore:beforeRevision,revisionAfter:this.nav.revision,footprintsPreserved:blocks===this.nav.block});
    this.ui.toast(fault.strength?'The fault rose. Ground routes now follow the new landscape.':'The tremor subsided; routes held.', 'info');
  }

  advanceShift(){
    if(!this.shift)return;
    // Presentation work is spread across frames. Combat and placement hold
    // during the short seismic transition; camera and settings stay responsive.
    const start=performance.now();let step;
    do{step=this.shift.next();}while(!step.done&&performance.now()-start<5);
    if(step.done){this.shift=null;this.phase='calm';this.game.terrainBusy=false;this.nav.terrainBusy=false;this.warnRoot.visible=false;}
  }
  sweep(unit,dt,friendly){
    if(!unit.active||unit.dead)return;
    const arc=Math.acos(Math.max(-1,Math.min(1,unit.dir.dot(this.dir))))*R;
    const inside=arc<7.5,weight=unit.type.boss?.18:1;
    unit.weatherLift+=( (inside?Math.max(0,1-arc/8)*8*weight:0)-unit.weatherLift)*(1-Math.exp(-dt*5));
    if(!inside)return;
    this.bearing.crossVectors(this.dir,unit.dir);if(this.bearing.lengthSq()<1e-6)this.bearing.copy(this.axis);
    this.bearing.addScaledVector(unit.dir,-this.bearing.dot(unit.dir)).normalize();this.step.copy(unit.dir).addScaledVector(this.bearing,dt*3*weight/R).normalize();
    const node=friendly?unit.moveNode:unit.node;
    if(this.nav.canStep(unit.dir,this.step,!!unit.type.flying||!!unit.mountFlying,node)){
      this.turn.crossVectors(unit.dir,this.step).normalize();const angle=Math.acos(Math.max(-1,Math.min(1,unit.dir.dot(this.step))));unit.dir.copy(this.step);unit.fwd.applyAxisAngle(this.turn,angle).addScaledVector(unit.dir,-unit.fwd.dot(unit.dir)).normalize();unit.height=terrainHeight(unit.dir.x,unit.dir.y,unit.dir.z);
      if(friendly){unit.moveNode=this.nav.nearestNode(unit.dir);unit.route=null;}else unit.node=this.nav.nearestNode(unit.dir);
    }
  }
  update(dt){
    let activeDt=dt;
    this.clock+=dt;if(this.phase!=='calm')this.remaining-=dt;
    if(this.phase==='warning'&&this.remaining<=0){activeDt=-this.remaining;if(this.kind==='quake'){this.phase='shifting';this.game.terrainBusy=true;this.nav.terrainBusy=true;this.shift=this.quakeSteps();}else{this.warnRoot.visible=false;this.phase='active';this.remaining=18-activeDt;this.group.visible=true;this.events.push({kind:'tornado',time:this.clock});}}
    if(this.phase==='active'){
      this.dir.addScaledVector(this.axis,activeDt*1.4/R).normalize();this.axis.addScaledVector(this.dir,-this.axis.dot(this.dir)).normalize();
      this.position.copy(this.dir).multiplyScalar(R+surfaceElevation(this.dir));orientOnSurface(this.group,this.position);
      for(let i=0;i<this.rings.length;i++){const ring=this.rings[i];ring.position.x=Math.sin(this.clock*5+i*.6)*.5;ring.position.z=Math.cos(this.clock*5+i*.6)*.5;}
      for(const unit of this.allies.active)this.sweep(unit,activeDt,true);for(const unit of this.enemies.active)this.sweep(unit,activeDt,false);
      if(this.remaining<=0){this.phase='calm';this.group.visible=false;}
    }else{
      for(const a of this.allies.active)a.weatherLift=Math.max(0,a.weatherLift-dt*5);
      for(const e of this.enemies.active)e.weatherLift=Math.max(0,e.weatherLift-dt*5);
    }
  }
}
