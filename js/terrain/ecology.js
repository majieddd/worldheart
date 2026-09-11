import {makeNoise3D, mulberry32, smoothstep} from '../noise.js';

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
export function createEcology(seed, key='auto') {
  if(!Object.hasOwn(BIOME_REGIMES,key))key='auto';
  const rng=mulberry32(seed^0x38a534cd),choice=Math.floor(rng()*6);
  const regime=BIOME_REGIMES[key==='auto'?['temperate','desert','boreal','jungle','volcanic','wetland'][choice]:key];
  const warmth=regime.warmth+(rng()-.5)*.08,wetness=regime.wetness+(rng()-.5)*.08;
  const heat=makeNoise3D(seed^0x316afa13),rain=makeNoise3D(seed^0x491f6e23),tectonic=makeNoise3D(seed^0x661ce021);
  const temperature=(x,y,z,height=0)=>.34-Math.abs(y)*.62+heat(x*3.2+43,y*3.2,z*3.2)*.46+warmth-Math.max(0,height)*.006;
  const moisture=(x,y,z)=>rain(x*3.7+17,y*3.7,z*3.7)*.7+rain(x*10.5,y*10.5+51,z*10.5)*.12+wetness;
  const volcanic=(x,y,z)=>tectonic(x*3+19,y*3,z*3)>regime.volcano;
  function biome(x,y,z,height,element='neutral',water=height<0) {
    if(water)return 'ocean';
    if(element==='hot')return 'volcanic';
    if(element==='cold')return height>10?'alpine':'tundra';
    if(volcanic(x,y,z))return 'volcanic';
    const t=temperature(x,y,z,height),m=moisture(x,y,z);
    if(t<-.12)return 'tundra';
    if(m<-.13&&t>.08)return 'desert';
    if(m<.03&&t>.15)return 'savanna';
    if(m>.2&&t>.18)return 'jungle';
    if(m>.13&&height<.9)return 'wetland';
    if(m>.16)return 'woodland';
    return 'meadow';
  }
  return {temperature,moisture,biome,volcanic,
    forest(x,y,z){return smoothstep(-.06,.35,moisture(x,y,z))*smoothstep(-.35,-.08,temperature(x,y,z));},
    manifest(){return {version:2,seed,key,regime:regime.name,warmth,wetness};},
  };
}
