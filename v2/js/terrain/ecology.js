import {makeNoise3D, mulberry32, smoothstep} from '../noise.js';

const REGIMES = Object.freeze([
  {name:'Temperate',warmth:0,wetness:0},
  {name:'Arid',warmth:.12,wetness:-.16},
  {name:'Boreal',warmth:-.14,wetness:.06},
  {name:'Lush',warmth:.04,wetness:.17},
]);

// Independent climate fields dress every landform family. A planet-wide bias
// and latitude create regions; smaller moisture variation breaks their edges
// without making every tree its own biome.
export function createEcology(seed) {
  const rng=mulberry32(seed^0x38a534cd),regime=REGIMES[Math.floor(rng()*REGIMES.length)];
  const warmth=regime.warmth+(rng()-.5)*.08,wetness=regime.wetness+(rng()-.5)*.08;
  const heat=makeNoise3D(seed^0x316afa13),rain=makeNoise3D(seed^0x491f6e23);
  const temperature=(x,y,z,height=0)=>.34-Math.abs(y)*.62+heat(x*3.2+43,y*3.2,z*3.2)*.46+warmth-Math.max(0,height)*.006;
  const moisture=(x,y,z)=>rain(x*3.7+17,y*3.7,z*3.7)*.7+rain(x*10.5,y*10.5+51,z*10.5)*.12+wetness;
  function biome(x,y,z,height,element='neutral') {
    if(height<0)return 'ocean';
    if(height<.13)return 'coast';
    if(element==='hot')return 'volcanic';
    if(element==='cold')return height>10?'alpine':'tundra';
    const t=temperature(x,y,z,height),m=moisture(x,y,z);
    if(t<-.12)return 'tundra';
    if(m<-.13&&t>.08)return 'desert';
    if(m<.03&&t>.15)return 'savanna';
    if(m>.24)return 'woodland';
    if(m>.13&&height<.9)return 'wetland';
    return 'meadow';
  }
  return {temperature,moisture,biome,
    forest(x,y,z){return smoothstep(-.06,.35,moisture(x,y,z))*smoothstep(-.35,-.08,temperature(x,y,z));},
    manifest(){return {version:1,seed,regime:regime.name,warmth,wetness};},
  };
}
