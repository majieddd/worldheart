import {makeRng} from './rng.js';

export const STRUCTURES=Object.freeze({
  outpost:{name:'Survey outpost',note:'An open research shelter. Search its supply chest.',color:0x628e9c,roof:0x344557,reward:'scraps'},
  ruin:{name:'Overgrown watchtower',note:'A broken stone lookout with a chest behind its open arch.',color:0x939783,roof:0x64715a,reward:'weapon'},
  observatory:{name:'Abandoned observatory',note:'A hilltop telescope station with a crystal cache.',color:0xc2b796,roof:0x446c87,reward:'crystals'},
  bunker:{name:'Planetary defense bunker',note:'An open reinforced defense store. Salvage the supplies within.',color:0x87929a,roof:0x394655,reward:'mixed'},
});
export function structureReward(seed,index,kind){
  const rng=makeRng((seed^Math.imul(index+1,0x45d9f3b))>>>0),type=STRUCTURES[kind]?.reward;
  return {scraps:type==='scraps'||type==='mixed'?1+Math.floor(rng()*2):0,crystals:type==='crystals'||type==='mixed'?1:0,weapon:type==='weapon'||type==='mixed',weaponSeed:(rng()*0xffffffff)>>>0};
}
export function wallIntersects(localStart,localEnd,radius=.35){
  // Slab intersection also catches a fast enemy crossing the entire thin wall.
  let enter=0,leave=1;
  for(const [axis,half]of [[0,1.65+radius],[1,.32+radius]]){
    const a=localStart[axis],d=localEnd[axis]-a;
    if(Math.abs(d)<1e-9){if(Math.abs(a)>half)return false;continue;}
    const p=(-half-a)/d,q=(half-a)/d;enter=Math.max(enter,Math.min(p,q));leave=Math.min(leave,Math.max(p,q));
    if(enter>leave)return false;
  }
  return true;
}
