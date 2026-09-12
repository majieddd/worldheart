import {FEATURES,R} from '../world.js';

// Timed vents lift real bodies. Allies use their ballistic jump model; enemies
// retain floor routing while an independent, pooled vertical impulse settles.
export class GeyserField {
 constructor(world,allies,enemies){Object.assign(this,{world,allies,enemies});this.time=0;this.launches=0;}
 update(dt){
  this.time+=dt;this.world.featureArt?.userData.update?.(this.time);
  for(const e of this.enemies.active){if(e.geyserLift>0||e.geyserVelocity>0){e.geyserVelocity-=12*dt;e.geyserLift=Math.max(0,e.geyserLift+e.geyserVelocity*dt);if(!e.geyserLift)e.geyserVelocity=0;}}
  if(!(dt>0)||!FEATURES?.vents.length)return;
  for(const vent of FEATURES.vents){
   const time=this.time+vent.phase;if(time%12>=2.8)continue;const stamp=vent.m.id+':'+Math.floor(time/12),limit=Math.cos(vent.radius/R);
   for(const [units,friendly]of [[this.allies.active,true],[this.enemies.active,false]])for(const unit of units){
    if(!unit.active||unit.dead||unit.type.flying||unit.geyserStamp===stamp||unit.dir.dot(vent.dir)<limit)continue;
    const feet=unit.height+(friendly?(unit.hop||0)+(unit.mountFlight||0):(unit.geyserLift||0));
    if(Math.abs(feet-vent.height)>3)continue;
    unit.geyserStamp=stamp;this.launches++;
    if(friendly){unit.vertVel=Math.max(unit.vertVel,14);unit.airT=Math.max(.001,unit.airT);}
    else unit.geyserVelocity=14;
   }
  }
 }
}
