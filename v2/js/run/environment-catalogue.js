// Environment rules use their own seed stream. No combat or loot RNG is consumed.
const wet=['wetland','mangrove','jungle','woodland','cloudforest','bamboo','carnivorous','fungal','ocean','kelp','coralreef'];
const hot=['volcanic','sulfur','obsidian','basalt','venusrock','ioplains'];
const cold=['tundra','alpine','aurora','nitrogen','waterice','fracturedice','tholins'];
const low=['basin','hills','dunes','delta','fan','cells','shields','grotto','valley','oxbow','scablands','forest','mesa','plateau','sky','arcade','caverns','ribbons'];
const feature=(name,biomes,formations,extra)=>Object.freeze({name,biomes,formations,water:false,slope:.45,radius:3,period:12,on:3,damage:0,slow:1,lift:0,heal:0,...extra});
export const ACTIVE_FEATURES=Object.freeze({
 geyser:feature('Geyser pockets',[...wet,...hot,...cold],low,{color:0xb0e7e6,radius:3.8,lift:14,note:'Quiet flat mineral pockets erupt, launching bodies that cross them.'}),
 trunks:feature('Fallen tree bridge',['redwood','woodland','jungle','cloudforest','autumn','cherry','fungal','lichen'],low,{color:0x8c7355,radius:7,period:1,on:0,note:'A weathered fallen trunk spans a shallow hollow; its upper surface is walkable.'}),
 mudpot:feature('Bubbling mud pots',[...hot,'wetland','carnivorous','salt'],low,{color:0x998267,radius:4,period:7,on:7,slow:.45,note:'Acidic clay bubbles mark sticky ground that slows both armies.'}),
 fumarole:feature('Breathing fumarole',hot,[...low,'volcano','caldera','chaos'],{color:0xd8d5a0,period:9,on:3,damage:8,note:'A sulfur-stained crack exhales a damaging cone of steam.'}),
 seep:feature('Lava seep',hot,[...low,'volcano','caldera','chaos','stripes'],{color:0xff732d,radius:4,period:16,on:6,damage:12,note:'A crusted basalt pool glows before spilling damaging lava.'}),
 cryovent:feature('Cryovolcanic jet',cold,[...low,'stripes','spiral','chaos'],{color:0x9ad6ff,period:14,on:3,lift:10,slow:.55,note:'Ice fractures vent a brief cold plume, launching and chilling passing bodies.'}),
 crystal:feature('Resonant crystal',['crystalline','aurora','obsidian','twilight'],[...low,'spine','fulgurite','pedestals'],{color:0xc28bff,radius:5,period:10,on:1.5,damage:10,note:'A forked mineral cluster charges, then pulses across the marked ring.'}),
 spores:feature('Puffball colony',['fungal','sponge','carnivorous','jungle','cloudforest'],low,{color:0xbdc968,radius:4,period:8,on:4,damage:5,slow:.7,note:'Swollen sacs release a low drifting spore cloud that stings and slows.'}),
 updraft:feature('Thermal updraft',['desert','savanna','cloudforest','aurora','volcanic','ammonia','cyancloud','bluecloud'],[...low,'escarpment','cuesta','range'],{color:0xd9eed2,radius:4,period:6,on:6,lift:8,note:'A visible spiral of dust or cloud lifts bodies along a rising air column.'}),
 spring:feature('Worldheart spring',['meadow','woodland','jungle','bamboo','cherry','cloudforest','lichen'],low,{color:0x6ee9bd,radius:3.5,period:8,on:8,heal:5,note:'A fantasy mineral spring restores health to any body standing in its shallow basin.'}),
 boulder:feature('Rockfall runnel',['desert','ferrous','obsidian','alpine','lichen','regolith','basalt'],[...low,'escarpment','cuesta','range','buttes','yardangs'],{color:0x9e8874,radius:3,period:11,on:4,damage:14,slope:.9,note:'Loose stones tumble along a short, visible runnel; crossing the moving rock hurts.'}),
 whirlpool:feature('Tidal whirlpool',['ocean','kelp','coralreef'],['atoll','delta','drumlins','fan','basin','sky','ribbons'],{color:0x42bbc9,radius:6,water:true,period:15,on:9,slow:.4,damage:3,pull:3,note:'A rotating ocean funnel draws nearby swimmers toward its centre.'}),
});
export function featureFits(key,{biome,formation,water,slope}){
 const f=ACTIVE_FEATURES[key];return !!f&&f.biomes.includes(biome)&&f.formations.includes(formation)&&f.water===water&&slope<=f.slope;
}
const hazard=(name,tags,extra)=>Object.freeze({name,tags,radius:18,duration:16,damage:0,slow:1,lift:0,period:1,on:1,...extra});
export const DISASTERS=Object.freeze({
 quake:hazard('Earthquake',['rock','ice'],{color:0xff6456,note:'A red forecast shows the actual fault shift; disrupted nests collapse.'}),
 tornado:hazard('Tornado',['atmosphere'],{color:0xbcd4c5,radius:8,lift:8,note:'A travelling funnel sweeps units into a rotating column.'}),
 meteor:hazard('Meteor shower',['rock','ice','cloud'],{color:0xff9964,radius:21,damage:28,period:4,on:.45,note:'Falling stones strike predicted points, leaving short-lived impact scorch.'}),
 thunder:hazard('Lightning storm',['atmosphere'],{color:0xd8bdff,radius:20,damage:23,period:3,on:.3,note:'Forked lightning strikes after a flashing ground warning.'}),
 hail:hazard('Hail squall',['wet','cloud'],{color:0xcceaff,radius:23,damage:5,slow:.8,note:'Dense falling ice pellets damage exposed units and slow their advance.'}),
 blizzard:hazard('Whiteout',['ice','cold'],{color:0xe3f1f4,radius:28,damage:2,slow:.45,note:'A broad spinning snow curtain slows passage through its footprint.'}),
 sandstorm:hazard('Sand wall',['dry'],{color:0xd9ab64,radius:30,damage:3,slow:.6,note:'An advancing wall of grit abrades and pushes exposed bodies.'}),
 tsunami:hazard('Tsunami surge',['ocean'],{color:0x55cfdd,radius:25,damage:9,slow:.65,lift:4,coast:true,note:'An ocean surge advances across a coastline; high ground provides refuge.'}),
 solar:hazard('Radiation storm',['airless','cloud'],{color:0xb17bff,radius:26,damage:18,period:6,on:.65,emp:8,note:'Purple storm clouds discharge branching arcs. Struck towers lose power for eight seconds.'}),
 eruption:hazard('Volcanic bomb eruption',['volcanic'],{color:0xff7238,radius:22,damage:18,period:3,on:1,note:'Incandescent bombs rise from active geology and fall around the vent.'}),
});
const hash=n=>{n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);return ((n^(n>>>15))>>>0)/4294967296;};
export function environmentalHostility(seed,planet=0,override=null){
 const t=Math.max(0,Math.min(98,planet))/98,floor=.15+t*.65,ceiling=.6+t*1.0;
 const value=Number.isFinite(override)?Math.max(0,Math.min(2,override)):floor+hash(seed^0x51a47e09)*(ceiling-floor);
 return {value,floor,ceiling,interval:Math.max(38,150/(.65+value)),scale:.7+value*.55};
}
export function environmentTags(environment){
 if(environment.tags)return environment.tags;
 const k=environment.theme;
 if(k==='skyarchipelago')return ['cloud','atmosphere','cold'];
 if(['volcanic','sulfurfurnace'].includes(k))return ['rock','volcanic','dry','atmosphere'];
 if(k==='frozen')return ['rock','ice','cold','atmosphere'];
 if(['arid','ferrous','saltmirror','fossil'].includes(k))return ['rock','dry','atmosphere'];
 if(['oceanic','reefocean'].includes(k))return ['rock','wet','ocean','atmosphere'];
 return ['rock','wet','ocean','atmosphere'];
}
export function compatibleDisasters(environment){const tags=environmentTags(environment);return Object.keys(DISASTERS).filter(k=>DISASTERS[k].tags.some(t=>tags.includes(t)));}
export function disasterChoice(environment,index){const choices=compatibleDisasters(environment);return choices[Math.floor(hash(environment.seed^Math.imul(index+1,0x496c7a91))*choices.length)];}
// Same time-window contract drives rendered warnings and gameplay impacts.
export function environmentalPulse(recipe,time){const t=((time%recipe.period)+recipe.period)%recipe.period;return {active:t<recipe.on,phase:t/recipe.period,cycle:Math.floor(time/recipe.period)};}
export function disasterTargets(key,time,scale=1){
 const cycle=0;
 return Array.from({length:key==='thunder'?1:key==='solar'?3:4},(_,i)=>{const a=i*2.399+cycle*1.7,r=(4+(i%3)*4)*scale;return {u:Math.cos(a)*r,v:Math.sin(a)*r,radius:(key==='thunder'?3:key==='solar'?5:4)*scale};});
}
export function disasterExposure(key,u,v,height,time,scale=1){
 const f=DISASTERS[key],r=Math.hypot(u,v);if(r>f.radius*scale||!environmentalPulse(f,time).active)return 0;
 if(['meteor','thunder','eruption','solar'].includes(key))return disasterTargets(key,time,scale).some(p=>Math.hypot(u-p.u,v-p.v)<p.radius)?1:0;
 if(key==='tsunami')return height<6*scale&&Math.abs(u-((time/f.duration)*2-1)*f.radius*scale)<5*scale?1:0;
 if(key==='sandstorm')return Math.abs(u-Math.sin(time*.2)*f.radius*scale*.6)<8*scale?1:0;
 return 1;
}
// Shared by the real terrain mutation and the isolated disaster exhibit.
export const FAULT_BRANCHES=Object.freeze([
 [[-37,-2],[-28,1],[-19,-2],[-9,2],[0,0],[10,3],[19,0],[28,4],[37,1]],
 [[-19,-2],[-15,-8],[-9,-12],[-5,-20]],
 [[0,0],[4,9],[12,15],[15,23]],
 [[19,0],[23,-7],[28,-12]],
]);
const faultSegments=FAULT_BRANCHES.map(line=>line.slice(1).map(([bx,by],i)=>{const [ax,ay]=line[i],dx=bx-ax,dy=by-ay;return {ax,ay,dx,dy,inverse:1/(dx*dx+dy*dy)};}));
export function faultProfile(u,v){
 let cut=0,uplift=0;
 for(let b=0;b<faultSegments.length;b++){let nearest=Infinity;for(const {ax,ay,dx,dy,inverse}of faultSegments[b]){
  const t=Math.max(0,Math.min(1,((u-ax)*dx+(v-ay)*dy)*inverse));nearest=Math.min(nearest,(u-ax-t*dx)**2+(v-ay-t*dy)**2);
  }const d=Math.sqrt(nearest);
  const end=Math.max(0,Math.min(1,(40-Math.abs(u))/7)),width=b?3.3:5;
  cut=Math.max(cut,(b?3.4:5.6)*Math.exp(-((d/width)**2))*end);
  uplift=Math.max(uplift,1.7*Math.exp(-(((d-width*1.6)/(width*.8))**2))*end);
 }
 return uplift*(1-Math.min(1,cut/3))-cut;
}
