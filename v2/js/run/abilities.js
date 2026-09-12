// Cooldowns belong to families, so changing inventory slots cannot reset them.
export const COMMANDER_ABILITIES = {
  commander:{name:'Aegis Ward',cooldown:24,duration:6,color:0x6ee8bc,description:'Take 75% less damage for 6 seconds.'},
  duelist:{name:'Slipstream',cooldown:16,duration:4,color:0xc0a8ff,description:'Dash forward, then move 65% faster for 4 seconds.'},
  marksman:{name:'Deadeye',cooldown:22,duration:6,color:0x95ddff,description:'Double weapon reach and pierce armor for 6 seconds.'},
  bombardier:{name:'Seismic Charge',cooldown:28,duration:0,color:0xffae67,description:'Blast and slow enemies in a 9m area ahead.'},
  oracle:{name:'Renewal Flame',cooldown:30,duration:5,color:0xff91ad,description:'Restore nearby allies and burn nearby enemies for 5 seconds.'},
};
export const WEAPON_ABILITIES = {
  sword:{name:'Cyclone Slash',cooldown:12,description:'A sweeping strike in every direction, with longer reach.'},
  spear:{name:'Impaling Lunge',cooldown:13,description:'A long, narrow thrust that pierces armor.'},
  twinblade:{name:'Blade Dance',cooldown:18,description:'Double slash cadence for 5 seconds.'},
  carbine:{name:'Railshot',cooldown:14,description:'An instant armor-piercing shot at extended range.'},
  lobber:{name:'Siege Shell',cooldown:18,description:'A heavy shell with a much wider explosion.'},
  scepter:{name:'Phoenix Ring',cooldown:20,description:'Vent heat and ignite a ring around you for 4 seconds.'},
};
export function createAbilityClock() {
  const remaining = new Map();
  return {
    remaining:key=>remaining.get(key)||0,
    activate(key,cooldown,perform){
      if((remaining.get(key)||0)>0||!Number.isFinite(cooldown)||cooldown<=0)return false;
      if(!perform())return false;remaining.set(key,cooldown);return true;
    },
    tick(dt){if(!Number.isFinite(dt)||dt<=0)return;for(const [key,t] of remaining)remaining.set(key,Math.max(0,t-dt));},
  };
}
