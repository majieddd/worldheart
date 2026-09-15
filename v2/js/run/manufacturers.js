import { makeRng } from './rng.js';

// Identity rolls use a private seed stream. Adding a maker never consumes the
// expedition's drop/part RNG, and legacy weapons retain their original stats.
export const MANUFACTURERS = {
  skibidi:{name:'Skibidi Inc.',mark:'SI',color:'#9ee7ed',motif:'pressure',tagline:'Make an entrance.',trait:'Pressure chamber',note:'+60% knockback and +8% impact; 6% slower attacks.',effects:{damage:1.08,cadence:1.06,knockback:.6},skills:['pressure','resonance']},
  anomalous:{name:'Anomalous',mark:'AX',color:'#baaaff',motif:'specimen',tagline:'The specimen chose you.',trait:'Living tissue',note:'Recover 5% of direct enemy damage as health; 6% less impact.',effects:{damage:.94,leech:.05},skills:['siphon','containment']},
  bang:{name:'BANG BANG',mark:'BB',color:'#ffc078',motif:'overdrive',tagline:'Subtle was never an option.',trait:'Overcranked',note:'+16% impact; 10% slower attacks and +25% recoil.',effects:{damage:1.16,cadence:1.10,recoil:1.25},skills:['overdrive','demolition']},
  rainbow:{name:'Rainbow Arms',mark:'RA',color:'#92edbb',motif:'prism',tagline:'Every color has a consequence.',trait:'Spectrum lens',note:'Burn for 2 damage/s and slow 12%; 8% less impact.',effects:{damage:.92,burn:2,slow:.12},skills:['prism','refraction']},
};
export const MODIFIERS = {
  accelerated:{name:'Accelerated',note:'Faster attacks, lighter impact.',effects:{cadence:.87,damage:.94}},
  brutal:{name:'Brutal',note:'Heavier impact, slower attacks.',effects:{damage:1.18,cadence:1.10}},
  farreach:{name:'Far-reaching',note:'Longer reach or shell velocity, lighter impact.',effects:{reach:1.22,velocity:1.16,damage:.94}},
  sanguine:{name:'Sanguine',note:'Heal from direct enemy damage.',effects:{leech:.035}},
  rime:{name:'Rimebound',note:'Chill targets, trading some impact.',effects:{slow:.22,damage:.94}},
  searing:{name:'Searing',note:'Ignite targets, trading some impact.',effects:{burn:5,damage:.90}},
  puncture:{name:'Puncturing',note:'Penetrate enemy armor.',effects:{armorPierce:3,pierce:2}},
  repulsor:{name:'Repulsor',note:'Throw targets back with heavier force.',effects:{knockback:1.1}},
};
export const MAKER_SKILLS = {
  pressure:{name:'Pressure Release',cooldown:16,color:0x9ee7ed,description:'Next attack: +65% reach, triple knockback and +35% impact.',strike:{reach:1.65,knockback:2,damage:1.35}},
  resonance:{name:'Resonant Burst',cooldown:19,color:0x9ee7ed,description:'Next attack: wide coverage, +3 armor penetration and a 45% slow.',strike:{arc:2,blast:1.6,pierce:3,slow:.45}},
  siphon:{name:'Specimen Siphon',cooldown:20,color:0xbaaaff,description:'Next attack: heal 25% of direct enemy damage and pierce armor.',strike:{leech:.25,armorPierce:8}},
  containment:{name:'Containment Breach',cooldown:18,color:0xbaaaff,description:'Next attack: slow targets 60% and burn for 12 damage/s.',strike:{slow:.6,burn:12}},
  overdrive:{name:'Redline',cooldown:22,color:0xffc078,description:'For 5 seconds, attacks have 45% shorter recovery and 35% stronger recoil. Beams gain 45% damage instead.',duration:5,buff:'redline'},
  demolition:{name:'Big Punchline',cooldown:21,color:0xffc078,description:'Next attack: double impact and 50% wider coverage.',strike:{damage:2,arc:1.5,blast:1.5}},
  prism:{name:'Prismatic Lance',cooldown:19,color:0x92edbb,description:'Next attack: +50% reach, +6 armor penetration and a searing 10 damage/s burn.',strike:{reach:1.5,velocity:1.3,pierce:6,burn:10}},
  refraction:{name:'Spectrum Overload',cooldown:20,color:0x92edbb,description:'Next attack: +60% impact, a 45% slow and armor penetration.',strike:{damage:1.6,slow:.45,armorPierce:6}},
};
export function rollMake(seed,manufacturer=null,modifier=null) {
  const rng=makeRng((seed^0x49fe023b)>>>0),brands=Object.keys(MANUFACTURERS),mods=Object.keys(MODIFIERS);
  const brandRoll=rng(),perkRoll=rng(),qualityRoll=rng(),skillRoll=rng();
  const brand=manufacturer??brands[Math.floor(brandRoll*brands.length)];
  if(!Object.hasOwn(MANUFACTURERS,brand))throw Error('Unknown manufacturer');
  const perk=modifier??mods[Math.floor(perkRoll*mods.length)],quality=1+Math.floor(qualityRoll*3);
  return {version:1,brand,perk,quality,skill:MANUFACTURERS[brand].skills[Math.floor(skillRoll*2)]};
}
export function validMake(m) {
  return m===undefined||!!m&&m.version===1&&Object.hasOwn(MANUFACTURERS,m.brand)&&Object.hasOwn(MODIFIERS,m.perk)
    &&Number.isInteger(m.quality)&&m.quality>=1&&m.quality<=3&&MANUFACTURERS[m.brand].skills.includes(m.skill);
}
export function makeEffects(make) {
  if(!make)return [];
  const multiplier=.8+make.quality*.1;
  const rolled=Object.fromEntries(Object.entries(MODIFIERS[make.perk].effects).map(([key,value])=>
    [key,['damage','cadence','recoil','reach','velocity','arc','blast'].includes(key)?1+(value-1)*multiplier:value*multiplier]));
  return [MANUFACTURERS[make.brand].effects,rolled];
}
export function applyMakeEffects(s,effects) {
  for(const p of effects){
    s.dmg*=p.damage??1;s.cd*=p.cadence??1;s.kick*=p.recoil??1;
    if(s.radius)s.radius*=p.reach??1;if(s.range)s.range*=p.reach??1;
    if(s.kind==='lob'&&p.reach){s.speed*=Math.sqrt(p.reach);s.fuse*=Math.sqrt(p.reach);}
    if(s.arcDeg)s.arcDeg=Math.min(360,s.arcDeg*(p.arc??1));if(s.aoe)s.aoe*=p.blast??1;
    if(s.corridor&&p.arc)s.corridor*=p.arc;
    if(s.speed)s.speed*=p.velocity??1;
    s.pierce+=p.pierce??0;
    s.armorPierce=(s.armorPierce||0)+(p.armorPierce||0);
    s.leech=Math.min(.35,(s.leech||0)+(p.leech||0));
    if(p.knockback)s.knockback=(s.knockback||.25)*(1+p.knockback);
    if(p.slow)s.slow=Math.min(.7,Math.max(s.slow||0,p.slow));
    if(p.burn)s.burn=Math.max(s.burn||0,p.burn);
  }
  if(s.kind==='beam')s.dps=s.dmg;
  return s;
}
