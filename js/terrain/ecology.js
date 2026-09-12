import {makeNoise3D, mulberry32, smoothstep} from '../noise.js';
import {planetEnvironment} from '../run/planet-environments.js';
import {NEW_PLANET_THEMES} from '../run/world-catalogue.js';

export const BIOME_REGIMES = Object.freeze({
  auto:{name:'Planet mix'},
  temperate:{name:'Temperate',warmth:0,wetness:0,volcano:.36},
  desert:{name:'Desert',warmth:.25,wetness:-.3,volcano:.42},
  boreal:{name:'Boreal',warmth:-.2,wetness:.06,volcano:.44},
  jungle:{name:'Jungle',warmth:.25,wetness:.3,volcano:.42},
  volcanic:{name:'Volcanic',warmth:.18,wetness:-.1,volcano:-.1},
  wetland:{name:'Wetlands',warmth:.08,wetness:.2,volcano:.46},
});

// Climate and tectonic activity are independent of the formation seed stream.
// An inspector override dresses the same geometry rather than rerolling it.
export function createEcology(seed, key='auto',environment=planetEnvironment((seed>>>0)||1)) {
  if(!Object.hasOwn(BIOME_REGIMES,key))key='auto';
  const rng=mulberry32(seed^0x38a534cd);
  const regime=key==='auto'?{name:'Planet mix',warmth:environment.warmth,wetness:environment.wetness,volcano:.53-environment.tectonics*.53}:BIOME_REGIMES[key];
  const warmth=regime.warmth+(rng()-.5)*.08,wetness=regime.wetness+(rng()-.5)*.08;
  const heat=makeNoise3D(seed^0x316afa13),rain=makeNoise3D(seed^0x491f6e23),tectonic=makeNoise3D(seed^0x661ce021);
  const latitude=(x,y,z)=>Math.asin(Math.min(1,Math.abs(y)))*180/Math.PI;
  const extreme=key==='auto'?environment.theme:null;
  const custom=NEW_PLANET_THEMES[extreme];
  const thermal=extreme==='frozen'?-.85:extreme==='monsoon'?.55:extreme==='volcanic'?.8:extreme==='arid'?.35:0;
  const temperature=(x,y,z,height=0)=>.52-Math.pow(Math.abs(y),1.15)*1.12+heat(x*3.2+43,y*3.2,z*3.2)*.1+warmth+thermal-Math.max(0,height)*.006;
  function moisture(x,y,z){
    const lat=latitude(x,y,z),noise=rain(x*3.7+17,y*3.7,z*3.7);
    // Rising equatorial air, dry subtropics and a wetter temperate belt remain
    // readable from orbit. Local weather bends a border without erasing it.
    const band=.38*Math.exp(-((lat/13)**2))-.3*Math.exp(-(((lat-29)/10)**2))
      +.25*Math.exp(-(((lat-53)/12)**2))-.16*smoothstep(66,83,lat);
    return band+noise*.14+rain(x*10.5,y*10.5+51,z*10.5)*.04+wetness;
  }
  const volcanic=(x,y,z)=>extreme==='volcanic'||((!custom||['sulfurfurnace','stormglass'].includes(extreme))&&!['frozen','monsoon','oceanic','fungal','crystalline','ferrous','twilight','arid'].includes(extreme)&&tectonic(x*3+19,y*3,z*3)>regime.volcano);
  function biome(x,y,z,height,element='neutral',water=height<0) {
    if(custom){
      const list=custom.biomes,lat=latitude(x,y,z)+rain(x*4,y*4,z*4)*5;
      if(water)return list.includes('kelp')?(height<-.8?'kelp':list.includes('coralreef')?'coralreef':'ocean'):'ocean';
      if(element==='hot'&&list.includes('sulfur'))return height>25?'obsidian':'sulfur';
      const belt=height>22?2:lat<19?0:lat<39?1:lat<65?2:list.length-1;
      return list[Math.min(belt,list.length-1)];
    }
    if(water)return 'ocean';
    if(element==='hot')return 'volcanic';
    if(element==='cold')return height>10?'alpine':'tundra';
    if(['crystalline','fungal','ferrous','twilight'].includes(extreme))return extreme;
    if(extreme==='frozen')return height>10?'alpine':'tundra';
    if(extreme==='arid')return 'desert';
    if(extreme==='monsoon')return height<1.1?'mangrove':height>35?'woodland':'jungle';
    if(extreme==='oceanic')return height<1.5?'mangrove':'jungle';
    if(volcanic(x,y,z))return 'volcanic';
    const t=temperature(x,y,z,height),m=moisture(x,y,z);
    if(t<-.12)return 'tundra';
    if(key==='wetland'&&m>.03&&height<1.5)return 'wetland';
    if(m<-.13&&t>.08)return 'desert';
    if(m<.03&&t>.15)return 'savanna';
    if(m>.2&&t>.18&&height<1.1)return 'mangrove';
    if(m>.2&&t>.18)return 'jungle';
    if(m>.13&&height<.9)return 'wetland';
    if(m>.16)return 'woodland';
    return 'meadow';
  }
  return {temperature,moisture,biome,volcanic,
    forest(x,y,z){return smoothstep(-.06,.35,moisture(x,y,z))*smoothstep(-.35,-.08,temperature(x,y,z));},
    latitude,
    manifest(){return {version:4,seed,key,regime:regime.name,warmth,wetness,environment,bands:['Wet equator','Dry subtropics','Temperate woodlands','Polar tundra']};},
  };
}
