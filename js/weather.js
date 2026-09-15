import * as THREE from 'three';
import { R, terrainHeight, surfaceElevation, addTerrainFault, createTerrainFault, terrainFaultDelta, TERRAIN_FAULTS, orientOnSurface, oceanAt, overheadHeight, supportHeight, FORMATIONS, floatingWorld } from './world.js';
import {CONFIG} from './config.js';
import {DISASTERS,compatibleDisasters,environmentalHostility,disasterChoice,disasterExposure,environmentalPulse} from './run/environment-catalogue.js';
import {buildDisasterArt,buildTornadoArt} from './disaster-art.js';
import {FaultForecast} from './disaster-preview.js';
import {isNestClearing,NEST_SCHEDULE_CAPACITY,NEST_SEPARATION} from './nest-sites.js';
// A bounded simulation system. Quakes change the shared analytic field and
// refresh existing graph costs; they never replace a live graph or footprints.
export class PlanetWeather {
  constructor({scene,nav,world,allies,enemies,game,commander,centre,ui}){
    Object.assign(this,{scene,nav,world,allies,enemies,game,commander,centre,ui});
    this.phase='calm';this.remaining=0;this.clock=0;this.kind=null;this.events=[];
    this.environment=CONFIG.environment;this.hostility=environmentalHostility(CONFIG.seed,CONFIG.planetIndex-1,CONFIG.hostility);this.nextEvent=this.hostility.interval;this.eventIndex=0;this.hazardArt=null;this.effectCounts={};
    this.forecast=new FaultForecast(scene);
    this.dir=new THREE.Vector3();this.axis=new THREE.Vector3();this.tmp=new THREE.Vector3();this.step=new THREE.Vector3();this.bearing=new THREE.Vector3();this.turn=new THREE.Vector3();this.position=new THREE.Vector3();
    this.group=buildTornadoArt();this.rings=this.group.userData.rings;scene.add(this.group);this.group.visible=false;
    this.warning=new THREE.Mesh(new THREE.RingGeometry(7.6,8,48),new THREE.MeshBasicMaterial({color:0xffb463,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));this.warning.rotation.x=-Math.PI/2;this.warnRoot=new THREE.Group();this.warnRoot.add(this.warning);scene.add(this.warnRoot);this.warnRoot.visible=false;
  }
  get label(){return this.phase==='forecasting'?'Seismic activity building.':this.phase==='shifting'?'The ground is shifting. Combat resumes as the tremor settles.':this.phase==='warning'?`${DISASTERS[this.kind].name} in ${Math.ceil(this.remaining)}s. ${this.kind==='quake'?'Red shows the predicted ground shift; disrupted nests will collapse.':'Move clear of the marked area.'}`:this.phase==='active'?`${DISASTERS[this.kind].name} · ${Math.ceil(this.remaining)}s`:`Weather calm · hostility ${this.hostility.value.toFixed(2)}`;}
  wave(number){this.waveNumber=number;}
  trigger(kind,dir=null){
    if(this.phase!=='calm'||!compatibleDisasters(this.environment).includes(kind)||kind==='quake'&&(TERRAIN_FAULTS.length>=8||floatingWorld()))return false;
    const a=this.commander();this.dir.copy(dir||a?.dir||this.centre);
    this.axis.copy(a?.fwd||this.tmp.set(1,0,0)).addScaledVector(this.dir,-this.axis.dot(this.dir)).normalize();
    if(!dir)this.dir.addScaledVector(this.axis,20/R).normalize();
    const node=this.nav.nearestWalkableNode(this.dir);if(node>=0)this.nav.nodeDir(node,this.dir);
    if(kind==='tsunami'){
      let found=false;for(let n=0;n<this.nav.n;n+=7){this.nav.nodeDir(n,this.tmp);const h=terrainHeight(...this.tmp.toArray(),false);if(oceanAt(...this.tmp.toArray())&&h>-.9&&h<.2){this.dir.copy(this.tmp);found=true;break;}}
      if(!found)return false;
    }
    if(kind==='eruption'){
      const volcano=FORMATIONS.modules.find(m=>m.type==='volcano'&&m.height>0);if(!volcano)return false;this.dir.set(...volcano.dir);
    }
    this.axis.addScaledVector(this.dir,-this.axis.dot(this.dir)).normalize();
    this.kind=kind;this.phase='warning';this.remaining=8;this.warnRoot.visible=true;
    if(kind==='quake'){
      this.plannedFault=createTerrainFault(this.dir,this.axis,this.centre);this.warnRoot.visible=false;
      this.plannedFault.strength=this.hostility.scale;
      this.phase='forecasting';this.game.terrainBusy=true;this.nav.terrainBusy=true;this.shift=this.prepareQuakeSteps();
    }
    this.position.copy(this.dir).multiplyScalar(R+surfaceElevation(this.dir)+.15);orientOnSurface(this.warnRoot,this.position);this.warnRoot.scale.setScalar(this.hostility.scale);this.group.scale.setScalar(this.hostility.scale);
    if(kind!=='quake'&&kind!=='tornado'){
      if(this.hazardArt){this.scene.remove(this.hazardArt);this.hazardArt.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
      const centre=this.dir.clone(),axis=this.axis.clone(),side=new THREE.Vector3().crossVectors(axis,centre),origin=this.position.clone(),cache=new Map(),scale=this.hostility.scale;
      const ground=(u,v)=>{const key=u.toFixed(3)+','+v.toFixed(3);if(!cache.has(key)){const d=centre.clone().addScaledVector(axis,u*scale/R).addScaledVector(side,v*scale/R).normalize();const p=d.multiplyScalar(R+surfaceElevation(d));cache.set(key,p.sub(origin).dot(centre)/scale);}return cache.get(key);};
      this.hazardArt=buildDisasterArt(kind,ground);this.hazardArt.scale.setScalar(this.hostility.scale);this.hazardArt.position.copy(this.position);this.bearing.crossVectors(this.axis,this.dir).normalize();this.hazardArt.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(this.axis,this.dir,this.bearing));this.scene.add(this.hazardArt);this.hazardArt.userData.update(0,true);this.warnRoot.visible=false;
    }
    this.eventTime=0;this.nextEvent=this.clock+this.hostility.interval;
    if(kind!=='quake')this.ui.audio?.play('warning');this._audioPulse=-1;
    if(kind!=='quake')this.ui.toast(`${DISASTERS[kind].name} approaching. Leave the marked area.`,'warn');return true;
  }
  *prepareQuakeSteps(){
    const fault=this.plannedFault,draft=yield* this.nav.forecastGraphSteps();
    const protectedNodes=[this.nav.heartNode,...this.enemies.active.filter(e=>!e.type.flying).map(e=>e.node),...this.allies.active.filter(a=>!a.type.flying&&!a.mountFlying).map(a=>this.nav.nearestWalkableNode(a.dir))].filter(n=>n>=0&&Number.isFinite(this.nav.dist[n]));
    for(let attempt=0;attempt<5;attempt++){
      yield* draft.refreshTerrainSteps(fault,true);
      const used=this.world.portals.filter(p=>p.established).map(p=>p.group.position.clone());let capacity=0;
      for(let node=0;node<draft.n&&capacity<NEST_SCHEDULE_CAPACITY;node++){
        if(node%128===0)yield;
        if(!draft.march.floorReach[node])continue;
        draft.nodeDir(node,this.tmp);if(this.tmp.dot(this.centre)>Math.cos(10/R))continue;
        draft.nodePos(node,this.tmp);if(used.some(p=>p.distanceToSquared(this.tmp)<NEST_SEPARATION**2))continue;
        if(!isNestClearing(draft,node,this.tmp))continue;
        used.push(this.tmp.clone());capacity++;
      }
      if(protectedNodes.every(n=>Number.isFinite(draft.dist[n]))&&capacity===NEST_SCHEDULE_CAPACITY)break;
      fault.strength=attempt===4?0:fault.strength*.5;
    }
    yield* this.forecast.showSteps(fault);
    this.ui.audio?.play('warning');
    this.ui.toast('Earthquake in 8s. Red predicts the new ground; nests in the disruption will collapse.','danger');
  }
  *quakeSteps(){
    this.ui.audio?.play('quake',{position:this.position});
    const fault=addTerrainFault(this.dir,this.axis,this.centre,this.plannedFault);if(!fault)return;
    const beforeRevision=this.nav.revision,blocks=this.nav.block;
    const changed=yield* this.nav.refreshTerrainSteps(fault);
    const vertices=yield* this.world.refreshFaultSteps(fault);
    const disrupted=[];
    for(const p of this.world.portals)if(p.established&&!p.destroyed){
      this.tmp.copy(p.group.position).normalize();
      if(Math.abs(terrainFaultDelta(fault,this.tmp.x,this.tmp.y,this.tmp.z))<.65)continue;
      if(this.world.damagePortal(p,p.hp,true)){disrupted.push(p.node);this.allies.onPortalDestroyed?.(p);}
    }
    for(const tower of this.game.towerMgr.towers){this.tmp.copy(tower.pos).normalize();if(this.tmp.dot(fault.dir)<fault.limit)continue;const height=supportHeight(this.tmp,tower.pos.length()-R+.5);tower.pos.copy(this.tmp).multiplyScalar(R+surfaceElevation(this.tmp,height));orientOnSurface(tower.holder,tower.pos);}
    for(const p of this.world.portals){this.tmp.copy(p.group.position).normalize();if(this.tmp.dot(fault.dir)<fault.limit)continue;this.position.copy(this.tmp).multiplyScalar(R+surfaceElevation(this.tmp));orientOnSurface(p.group,this.position);}
    this.game._validateT=0;this.game.pathFlow?.setPaths(this.nav.previewPaths());
    this.events.push({kind:'quake',strength:fault.strength,changedNodes:changed,vertices,disruptedNests:disrupted,revisionBefore:beforeRevision,revisionAfter:this.nav.revision,footprintsPreserved:blocks===this.nav.block});
    this.ui.toast(fault.strength?'A fissure opened. Ground routes now follow the new landscape.':'The tremor subsided; routes held.', 'info');
  }

  advanceShift(){
    if(!this.shift)return;
    // Presentation work is spread across frames. Combat and placement hold
    // during the short seismic transition; camera and settings stay responsive.
    const start=performance.now();let step;
    do{step=this.shift.next();}while(!step.done&&performance.now()-start<3);
    if(step.done){
      this.shift=null;this.game.terrainBusy=false;this.nav.terrainBusy=false;this.warnRoot.visible=false;
      if(this.phase==='forecasting'){this.phase='warning';this.remaining=8;}
      else{this.phase='calm';this.forecast.hide();}
    }
  }
  sweep(unit,dt,friendly){
    if(!unit.active||unit.dead)return;
    const arc=Math.acos(Math.max(-1,Math.min(1,unit.dir.dot(this.dir))))*R;
    const scale=this.hostility.scale,inside=arc<7.5*scale,weight=unit.type.boss?.18:1;
    unit.weatherLift+=( (inside?Math.max(0,1-arc/(8*scale))*8*scale*weight:0)-unit.weatherLift)*(1-Math.exp(-dt*5));
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
    for(const a of this.allies.active)a.weatherSpeed=1;
    if(this.phase==='calm'&&dt>0&&this.clock>=this.nextEvent){this.trigger(disasterChoice(this.environment,this.eventIndex++));this.nextEvent=this.clock+this.hostility.interval;}
    this.forecast.update(this.clock);
    if(this.phase==='warning'&&this.kind!=='quake')this.hazardArt?.userData.update(this.clock,true);
    if(this.phase==='warning'&&this.remaining<=0){activeDt=-this.remaining;if(this.kind==='quake'){this.phase='shifting';this.game.terrainBusy=true;this.nav.terrainBusy=true;this.shift=this.quakeSteps();}else{this.warnRoot.visible=false;this.phase='active';this.remaining=DISASTERS[this.kind].duration-activeDt;this.group.visible=this.kind==='tornado';this.events.push({kind:this.kind,time:this.clock,hostility:this.hostility.value});}}
    if(this.phase==='active'&&this.kind==='tornado'){
      this.dir.addScaledVector(this.axis,activeDt*1.4/R).normalize();this.axis.addScaledVector(this.dir,-this.axis.dot(this.dir)).normalize();
      this.position.copy(this.dir).multiplyScalar(R+surfaceElevation(this.dir));orientOnSurface(this.group,this.position);
      this.group.userData.update(this.clock);
      const pulse=Math.floor(this.clock/2);if(pulse!==this._audioPulse){this._audioPulse=pulse;this.ui.audio?.play('tornado',{position:this.position});}
      for(const unit of this.allies.active)this.sweep(unit,activeDt,true);for(const unit of this.enemies.active)this.sweep(unit,activeDt,false);
      if(this.remaining<=0){this.phase='calm';this.group.visible=false;}
    }else{
      for(const a of this.allies.active)a.weatherLift=Math.max(0,a.weatherLift-dt*5);
      for(const e of this.enemies.active)e.weatherLift=Math.max(0,e.weatherLift-dt*5);
    }
    if(this.phase==='active'&&this.kind!=='tornado'){
      const recipe=DISASTERS[this.kind],scale=this.hostility.scale;this.eventTime+=activeDt;
      this.hazardArt.userData.update(this.eventTime);
      const soundPulse=environmentalPulse(recipe,this.eventTime),soundCycle=recipe.period<2?Math.floor(this.eventTime/2):soundPulse.cycle;
      if(soundPulse.active&&soundCycle!==this._audioPulse){this._audioPulse=soundCycle;this.ui.audio?.play(this.kind==='solar'?'radiation':this.kind,{position:this.position});}
      this.bearing.crossVectors(this.axis,this.dir).normalize();
      for(const [units,friendly]of [[this.allies.active,true],[this.enemies.active,false]])for(const a of units){
        if(!a.active||a.dead||a.dir.dot(this.dir)<Math.cos(recipe.radius*scale/R))continue;
        const h=a.height+(a.hop||0)+(a.mountFlight||0),u=a.dir.dot(this.axis)*R,v=a.dir.dot(this.bearing)*R;
        if(Number.isFinite(overheadHeight(a.dir,h+2))&&this.kind!=='solar')continue;
        if(!disasterExposure(this.kind,u,v,h,this.eventTime,scale))continue;
        this.effectCounts[this.kind]=(this.effectCounts[this.kind]||0)+1;
        if(recipe.damage)(friendly?this.allies:this.enemies).damage(a,recipe.damage*activeDt*scale,{armorPierce:99});
        if(recipe.slow<1){if(friendly)a.weatherSpeed=recipe.slow;else this.enemies.applySlow(a,1-recipe.slow,.3);}
        if(recipe.lift){const stamp=this.kind+':'+this.events.length+':'+Math.floor(this.eventTime/recipe.period);if(a.geyserStamp!==stamp){a.geyserStamp=stamp;if(friendly){a.vertVel=Math.max(a.vertVel,recipe.lift*scale);a.airT=Math.max(.001,a.airT);}else a.geyserVelocity=recipe.lift*scale;}}
      }
      if(recipe.emp){const stamp=this.events.length+':'+environmentalPulse(recipe,this.eventTime).cycle;
        for(const tower of this.game.towerMgr.towers){this.tmp.copy(tower.pos).normalize();if(this.tmp.dot(this.dir)<Math.cos(recipe.radius*scale/R)||tower.empStamp===stamp)continue;
          if(!disasterExposure(this.kind,this.tmp.dot(this.axis)*R,this.tmp.dot(this.bearing)*R,tower.pos.length()-R,this.eventTime,scale))continue;
          tower.empStamp=stamp;tower.disableFor(recipe.emp);this.effectCounts.emp=(this.effectCounts.emp||0)+1;
        }
      }
      if(this.remaining<=0){this.phase='calm';this.hazardArt.visible=false;this.nextEvent=this.clock+this.hostility.interval;}
    }
  }
}
