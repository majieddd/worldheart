import { eraForPlanet } from './weapons.js';
import { planetEnvironment } from './planet-environments.js';

export const CAMPAIGN_LENGTH=99;
export const CONTENT_VERSION=1;
const REGIONS=['Verdant Reach','Ember Chain','Glass March','Copper Halo','Signal Sea','Iron Meridian','Luminous Rift','Ashen Crown','Memory Wilds','Celestial Scar','Firstlight'];
const PLACES=['Haven','Crossing','Crown','Shoals','Bastion','Hollow','Spire','Drift','Threshold'];
// Mixed geometry is the campaign default. Seeds and climate carry planet diversity.
const PRESSURES=['mixed','wings','armor','swarm','raids'];
const BRIEFS={mixed:'Balance your defense against a mixed assault.',wings:'More flying creatures cross ordinary ridges. Cover the sky.',armor:'Extra Aegis shield the advance. Prepare piercing damage and area control.',swarm:'Larger, faster-arriving Mite packs test coverage and splash damage.',raids:'Nests raid more often. Expand or venture out to silence them.'};
// Milestones reuse the faceted Colossus rig with authored attack tells and
// plate colors. These are tactical variants, not claims of new model sets.
export const MILESTONES={
  9:{name:'Briar Sovereign',style:'sweep',tint:0x87b87d},
  18:{name:'Chasm Warden',style:'lance',tint:0xbf916f},
  27:{name:'Glass Regent',style:'bastion',tint:0x83c7d8},
  33:{name:'Last Bronze King',style:'sweep',tint:0xd1a363},
  36:{name:'Circuit Sentinel',style:'lance',tint:0x78b4df},
  45:{name:'Signal Reaver',style:'sweep',tint:0xa697e0},
  54:{name:'Iron Custodian',style:'bastion',tint:0x9cabb8},
  63:{name:'Reactor Sovereign',style:'lance',tint:0x80d8bd},
  66:{name:'The Silent Machine',style:'bastion',tint:0x91c7ee},
  72:{name:'Ashen Oracle',style:'sweep',tint:0xcda382},
  81:{name:'Memory Keeper',style:'lance',tint:0xd5a2dc},
  90:{name:'Starless Regent',style:'bastion',tint:0xaaa2e9},
  99:{name:'The Returning Crown',style:'sweep',tint:0xf5ce7b},
};
export function planetDefinition(index,seed) {
  if(!Number.isInteger(index)||index<1||index>CAMPAIGN_LENGTH||!Number.isInteger(seed)||seed<1||seed>0xffffffff)return null;
  const region=Math.floor((index-1)/9),place=(index-1)%9;
  const terrain='varied',pressure=PRESSURES[(index-1+region*2)%5];
  const planet={index,region:REGIONS[region],name:`${REGIONS[region]} ${PLACES[place]}`,terrain,
    seed:((seed+Math.imul(index-1,104729))>>>0)||1,era:eraForPlanet(index),
    enemyHealth:1+(index-1)/98*.35,pressure,brief:BRIEFS[pressure],boss:MILESTONES[index]?{...MILESTONES[index]}:null};
  // Keep the naturally verified opening stable as the route grows.
  if(index<=3)Object.assign(planet,[
    {name:'Hearthwild',terrain:'varied',seed,enemyHealth:1,pressure:'mixed',brief:'Defend the meadows between peaks and carved uplands. Carry crystals home to claim the high ground.'},
    {name:'Riftshore',terrain:'varied',seed:((seed+104729)>>>0)||1,enemyHealth:1,pressure:'wings',brief:'Ravines, plateaus and mountain passes reward safe crossings. Prepare for more flying creatures.'},
    {name:'Crownfall',terrain:'varied',seed:((seed+209458)>>>0)||1,enemyHealth:1.04,pressure:'armor',brief:'Giant peaks rise above lower hills and canyon routes. Cryo claims ice; Mortars claim hot stone. Expect heavy armor.'},
  ][index-1]);
  planet.environment=planetEnvironment(planet.seed);
  return planet;
}
export function campaignRoute(seed){return Array.from({length:CAMPAIGN_LENGTH},(_,i)=>planetDefinition(i+1,seed));}
