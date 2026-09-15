import {FEATURES,R} from '../world.js';
import {ACTIVE_FEATURES,environmentalPulse} from '../run/environment-catalogue.js';

// Timed vents lift real bodies. Allies use their ballistic jump model; enemies
// retain floor routing while an independent, pooled vertical impulse settles.
export class GeyserField {
 constructor(world,allies,enemies,audio=null){Object.assign(this,{world,allies,enemies,audio});this.audioPulses=new Map();this.time=0;this.launches=0;this.effects={};}
 update(dt){
  this.time+=dt;this.world.featureArt?.userData.update?.(this.time);
  for(const a of this.allies.active)a.environmentSpeed=1;
  for(const e of this.enemies.active){if(e.geyserLift>0||e.geyserVelocity>0){e.geyserVelocity-=12*dt;e.geyserLift=Math.max(0,e.geyserLift+e.geyserVelocity*dt);if(!e.geyserLift)e.geyserVelocity=0;}}
  if(!(dt>0)||!FEATURES)return;
  for(const vent of FEATURES.active.length?FEATURES.active:FEATURES.vents){
   const recipe=ACTIVE_FEATURES[vent.key||'geyser'],time=this.time+vent.phase,pulse=environmentalPulse(recipe,time);if(!pulse.active)continue;
   const stamp=(vent.key||'geyser')+':'+(vent.id??vent.m.id)+':'+pulse.cycle,limit=Math.cos(vent.radius/R);
   const soundKey=vent.id??vent.m.id;
   if(this.audio&&this.audioPulses.get(soundKey)!==pulse.cycle){this.audioPulses.set(soundKey,pulse.cycle);const scale=R+vent.height;this.audio.play(vent.key==='geyser'?'geyser':vent.key==='boulder'?'quake':vent.key==='whirlpool'?'tsunami':'feature',{position:{x:vent.dir.x*scale,y:vent.dir.y*scale,z:vent.dir.z*scale},gain:.5});}
   for(const [units,friendly]of [[this.allies.active,true],[this.enemies.active,false]])for(const unit of units){
    if(!unit.active||unit.dead||unit.type.flying||unit.dir.dot(vent.dir)<limit)continue;
    const feet=unit.height+(friendly?(unit.hop||0)+(unit.mountFlight||0):(unit.geyserLift||0));
    if(Math.abs(feet-vent.height)>3)continue;
    this.effects[vent.key||'geyser']=(this.effects[vent.key||'geyser']||0)+1;
    if(recipe.damage)(friendly?this.allies:this.enemies).damage(unit,recipe.damage*dt,{armorPierce:99});
    if(recipe.heal)unit.hp=Math.min(unit.hpMax,unit.hp+recipe.heal*dt);
    if(recipe.slow<1){if(friendly)unit.environmentSpeed=Math.min(unit.environmentSpeed,recipe.slow);else this.enemies.applySlow(unit,1-recipe.slow,.25);}
    if(recipe.pull){const distance=unit.dir.angleTo(vent.dir)*R;if(distance>.05)unit.dir.lerp(vent.dir,Math.min(1,dt*recipe.pull/distance)).normalize();}
    if(recipe.lift&&unit.geyserStamp!==stamp){unit.geyserStamp=stamp;this.launches++;
     if(friendly){unit.vertVel=Math.max(unit.vertVel,recipe.lift);unit.airT=Math.max(.001,unit.airT);}
     else unit.geyserVelocity=recipe.lift;
    }
   }
  }
 }
}
