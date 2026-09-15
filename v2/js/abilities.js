import * as THREE from 'three';
import {COMMANDER_ABILITIES,WEAPON_ABILITIES,createAbilityClock} from './run/abilities.js';
import { MAKER_SKILLS, applyMakeEffects } from './run/manufacturers.js';

const nativeFamily={commander:'sword',duelist:'twinblade',marksman:'carbine',bombardier:'lobber',oracle:'scepter'};
export class CommanderAbilities {
  constructor({game,allies,enemies,commander,ui}){
    Object.assign(this,{game,allies,enemies,commander,ui});this.clock=createAbilityClock();this.effects=[];this.events=[];
    this.point=new THREE.Vector3();this.target=new THREE.Vector3();this.vector=new THREE.Vector3();
  }
  family(){const a=this.commander();return a.weaponFamily||nativeFamily[a.typeKey]||'sword';}
  describe(which){
    const key=which==='commander'?this.commander().typeKey:this.family();
    const skill=which==='weapon'?this.commander().type.strike.weaponSkill:null;
    const def=MAKER_SKILLS[skill]||(which==='commander'?COMMANDER_ABILITIES:WEAPON_ABILITIES)[key];
    return {...def,key,skill,remaining:this.clock.remaining(which+':'+key)};
  }
  activate(which){
    const a=this.commander(),def=this.describe(which);
    if(!def||!a.active||a.dead||this.game.paused||this.game.terrainBusy||this.game.state!=='playing')return false;
    if(which==='weapon'&&(a.swingT>0||a.strikePending))return false;
    return this.clock.activate(which+':'+def.key,def.cooldown,()=>{
      const pos=this.allies.worldPos(a,this.point).clone();
      this.game.fx.rings.spawn(pos,def.color||0xffd68c,which==='commander'?8:5,.65);
      this.game.fx.burstGlow(pos,def.color||0xffd68c,12,3,.5,.6);
      if(which==='commander')this._commander(a,def,pos);else this._weapon(a,def,pos);
      this.events.push({which,key:def.key,unit:a.id});if(this.events.length>64)this.events.shift();
      this.ui.toast(def.name,'info');this.ui.audio?.play('upgrade');return true;
    });
  }
  _commander(a,def,pos){
    if(def.key==='commander')this._buff(a,'guard',def.duration);
    if(def.key==='duelist'){this._buff(a,'haste',def.duration);this.effects.push({a,kind:'dash',left:.3});}
    if(def.key==='marksman')this._buff(a,'deadeye',def.duration);
    if(def.key==='bombardier'){
      pos.addScaledVector(a.fwd,7);this.game.fx.explosion(pos,9);this._area(pos,9,(a.type.strike.dmg||50)*2.4,.65);
    }
    if(def.key==='oracle')this.effects.push({a,kind:'renew',left:5,pulse:0});
  }
  _buff(a,kind,duration){this.effects.push({a,kind,left:duration});}
  _weapon(a,def,pos){
    const s={...a.type.strike};
    if(def.skill&&MAKER_SKILLS[def.skill]){
      if(def.buff){this._buff(a,def.buff,def.duration);return;}
      applyMakeEffects(s,[def.strike]);
      // A beam special is a discrete pulse, with normal anticipation and hit
      // effects, rather than an unbounded replacement for its heat loop.
      if(s.kind==='beam'){s.kind='hitscan';s.cd=.55;}
      this.allies._beginStrike(a,Math.max(.35,s.cd),s,null);return;
    }
    if(def.key==='scepter'){a.heat=0;a.heatLock=0;this.effects.push({a,kind:'fire',left:4,pulse:0,power:s.dps||s.dmg||48});return;}
    if(def.key==='twinblade'){this._buff(a,'dance',5);return;}
    if(def.key==='sword')Object.assign(s,{radius:s.radius*1.6,arcDeg:360,dmg:s.dmg*1.8,cleave:1});
    if(def.key==='spear')Object.assign(s,{radius:s.radius*2,arcDeg:25,dmg:s.dmg*2.2,pierce:99,cleave:1});
    if(def.key==='carbine')Object.assign(s,{kind:'hitscan',range:s.range*1.65,dmg:s.dmg*3,pierce:99,corridor:.4});
    if(def.key==='lobber')Object.assign(s,{aoe:s.aoe*1.8,dmg:s.dmg*1.8,pierce:99});
    this.allies._beginStrike(a,Math.max(.35,s.cd),s,null);
  }
  _area(pos,radius,damage,slow=0){
    for(const e of [...this.enemies.active])if(e.active&&!e.dead&&this.enemies.enemyPos(e,this.target).distanceTo(pos)<radius){
      this.enemies.damage(e,damage,{armorPierce:12});if(slow)this.enemies.applySlow(e,slow,3);
    }
    for(const p of this.game.world.portals)if(!p.destroyed&&p.group.position.distanceTo(pos)<radius){if(this.game.world.damagePortal(p,damage))this.allies.onPortalDestroyed?.(p);}
  }
  modifyStrike(a,s){
    if(a!==this.commander())return s;
    if(!a.abilityDeadeye&&!a.abilityDance&&!a.abilityRedline)return s;
    const out={...s};if(a.abilityDeadeye){if(out.range)out.range*=2;if(out.radius)out.radius*=1.6;out.pierce=99;}
    if(a.abilityDance&&s.kind==='melee')out.cd*=.5;
    if(a.abilityRedline){out.cd*=.55;out.kick*=1.35;if(out.kind==='beam'){out.dps*=1.45;out.dmg=out.dps;}}
    return out;
  }
  update(dt){
    if(dt<=0)return;this.clock.tick(dt);
    const a=this.commander();a.abilityGuard=false;a.abilitySpeed=1;a.abilityDeadeye=false;a.abilityDance=false;a.abilityRedline=false;
    for(const effect of this.effects){
      if(effect.a!==a||!a.active||a.dead){effect.left=0;continue;}
      effect.left-=dt;if(effect.left<=0)continue;
      if(effect.kind==='guard')a.abilityGuard=true;
      if(effect.kind==='haste')a.abilitySpeed=1.65;
      if(effect.kind==='deadeye')a.abilityDeadeye=true;
      if(effect.kind==='dance')a.abilityDance=true;
      if(effect.kind==='redline')a.abilityRedline=true;
      if(effect.kind==='dash')this.allies.driveUnit(a,1,0,Math.min(dt,effect.left),4);
      if(effect.kind==='fire'||effect.kind==='renew'){
        effect.pulse-=dt;if(effect.pulse>0)continue;effect.pulse+=.5;
        const pos=this.allies.worldPos(a,this.point),radius=effect.kind==='fire'?6:8;
        this._area(pos,radius,effect.kind==='fire'?effect.power*.45:18);
        this.game.fx.rings.spawn(pos,effect.kind==='fire'?0xff702a:0xff91ad,radius,.5);
        if(effect.kind==='renew')for(const unit of this.allies.active)if(!unit.dead&&this.allies.worldPos(unit,this.target).distanceTo(pos)<radius)unit.hp=Math.min(unit.hpMax,unit.hp+unit.hpMax*.035);
      }
    }
    this.effects=this.effects.filter(e=>e.left>0);
  }
}
