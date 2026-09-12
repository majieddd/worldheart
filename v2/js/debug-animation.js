// Exhibition timelines feed the production rigs. They never advance combat.
export const ALLY_CLIPS=[['idle',1.5],['walk',1.8],['sprint',1.8],['strafe',1.6],['jump',1.7],['attack',3.6],['hurt',1.2]];
export const ENEMY_CLIPS=[['idle',1.5],['walk',2],['turn',1.5],['attack',2.8],['hurt',1.2],['stun',1.5],['shield',1.5],['collapse',1.5]];
export function animationClip(time,mode,enemy,out){
  const clips=enemy?ENEMY_CLIPS:ALLY_CLIPS;
  if(mode==='still'){out.name='still';out.local=0;out.strength=0;return out;}
  let duration=2.4,local=time%2.4,name=mode;
  if(mode==='cycle'){
    let total=0;for(const [,d]of clips)total+=d;local=time%total;
    for(const [n,d]of clips){name=n;duration=d;if(local<d)break;local-=d;}
  }
  const f=Math.max(0,Math.min(1,local/.18,(duration-local)/.18));
  out.name=name;out.local=local;out.strength=f*f*(3-2*f);return out;
}
