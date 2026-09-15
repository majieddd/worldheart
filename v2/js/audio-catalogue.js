// Presentation-only audio. No cue consumes the simulation's seeded RNG.
const families = {
  ui: [['click','Confirm'],['deny','Unavailable'],['equip','Equip weapon'],['salvage','Salvage weapon'],['order','Unit order'],['rally','Rally'],['aim','Aim down sights']],
  reward: [['build','Place tower'],['upgrade','Tower upgrade'],['sell','Sell tower'],['forge','Forge tower'],['coin','Collect weapon'],['crystal','Collect crystal'],['deposit','Deposit crystals'],['talent','New power'],['begin','Launch expedition'],['waveStart','Wave approaching'],['waveClear','Wave secured'],['victory','Planet defended'],['defeat','Worldheart lost'],['reconnect','Territory reconnected']],
  weapon: [['swing','Sword slash'],['spear','Spear thrust'],['twinblade','Twin fang slash'],['rifle','Carbine shot'],['lob','Lobber launch'],['fire','Ember sceptre flame'],['shot','Bolt turret'],['cryo','Cryo turret'],['mortar','Mortar launch'],['zap','Tesla arc'],['beam','Helios beam']],
  impact: [['meleeHit','Confirmed hit'],['blocked','Armour deflection'],['explosion','Heavy blast'],['enemyHit','Commander hurt'],['kill','Creature defeated'],['leak','Worldheart damaged'],['shed','Armour breaks']],
  creature: [['spawn','Nest emergence'],['crawler','Chitin skitter'],['flier','Wing flutter'],['brute','Heavy creature movement'],['boss','Boss arrival'],['portal','Nest opening'],['breach','Nest destroyed']],
  movement: [['possess','Take control'],['release','Return to strategy'],['jump','Jump'],['land','Land'],['step','Grass footstep'],['stepHard','Stone footstep'],['stepWater','Water footstep'],['stepIce','Ice footstep'],['mount','Mount up'],['dismount','Dismount'],['flight','Saucer lift']],
  ability: [['guard','Aegis guard'],['haste','Duelist dash'],['deadeye','Marksman focus'],['barrage','Bombardier barrage'],['renew','Oracle renewal'],['weaponPower','Weapon special'],['disconnect','Outside territory'],['respawn','Commander returns']],
  weather: [['warning','Environmental warning'],['quake','Earthquake fracture'],['thunder','Lightning strike'],['tsunami','Breaking wave'],['tornado','Tornado gust'],['radiation','Radiation discharge'],['eruption','Volcanic eruption'],['hail','Hail impact'],['meteor','Meteor impact'],['sandstorm','Sand gust'],['blizzard','Blizzard gust'],['geyser','Geyser release'],['feature','Active terrain pulse']],
  ambience: [['forest','Woodland air'],['ocean','Ocean shore'],['desert','Dry winds'],['ice','Frozen winds'],['lava','Molten crust'],['cosmic','Alien atmosphere']],
};
const gains={ui:.45,reward:.48,weapon:.58,impact:.55,creature:.32,movement:.3,ability:.5,weather:.6,ambience:.2};
export const AUDIO_CUES=Object.fromEntries(Object.entries(families).flatMap(([family,list])=>list.map(([key,label])=>[key,{key,label,family,
  bus:family==='ambience'?'ambience':family==='ui'||family==='reward'?'ui':'effects',
  gain:gains[family],priority:family==='ambience'?0:family==='ui'||family==='ability'?3:family==='reward'?4:2,
  interval:family==='ambience'?0:family==='weather'?650:key==='fire'||key==='beam'?180:family==='movement'?100:family==='creature'?240:35,
}])));
export const AUDIO_DEFAULTS=Object.freeze({master:.7,music:.42,effects:.85,ambience:.55,ui:.7,muted:false});
export const AUDIO_LIMITS=Object.freeze({voices:24,perCue:4,bankBytes:24*1024*1024,decodedBytes:40*1024*1024});
export const MUSIC_STATES=['lobby','explore','battle','danger','victory','defeat'];
export function cleanAudioSettings(value={}){
  if(!value||typeof value!=='object')value={};
  const out={...AUDIO_DEFAULTS};
  for(const key of Object.keys(out))if(key==='muted')out[key]=value[key]===true;
  else if(Number.isFinite(value[key]))out[key]=Math.max(0,Math.min(1,value[key]));
  return out;
}
export function musicState({state,paused,waveActive,boss,health=1}={}){
  if(state==='victory'||state==='defeat')return state;
  if(state!=='playing')return 'lobby';
  if(paused||!waveActive)return 'explore';
  return boss||health<.3?'danger':'battle';
}
export function ambienceKind(environment={}){
  const tags=[environment.theme,environment.key,...(environment.tags||[])].join(' ').toLowerCase();
  if(/lava|molten|volcan|io\b|mercury|venus/.test(tags))return 'lava';
  if(/ocean|water|island|archipelago/.test(tags))return 'ocean';
  if(/ice|frozen|tundra|alpine|snow|europa|triton|pluto/.test(tags))return 'ice';
  if(/desert|arid|mars|dune/.test(tags))return 'desert';
  if(/moon|void|cosmic|gas|jupiter|saturn|uranus|neptune/.test(tags))return 'cosmic';
  return 'forest';
}
