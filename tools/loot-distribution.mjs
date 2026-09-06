import {mkdirSync,writeFileSync} from 'node:fs';import {dirname,resolve} from 'node:path';
import {makeRng} from '../js/run/rng.js';import {generateWeapon,shouldDrop,weaponStats,validWeapon,FAMILIES,COMPATIBILITY} from '../js/run/weapons.js';
const rng=makeRng(424242),ordinaryRng=makeRng(115),eliteRng=makeRng(116),n=20000;
const rarities={},families={},eras={},partSignatures=new Set();let ordinary=0,elite=0,invalid=0,nonfinite=0;
for(let i=0;i<n;i++){
  const item=generateWeapon({id:`distribution-${i}`,seed:i,tier:1+i%99,rng});
  if(!validWeapon(item))invalid++;
  rarities[item.rarity]=(rarities[item.rarity]||0)+1;families[item.family]=(families[item.family]||0)+1;eras[item.era]=(eras[item.era]||0)+1;
  partSignatures.add(JSON.stringify([item.family,item.parts,item.affixes]));
  for(const commander of Object.keys(COMPATIBILITY)){const stats=weaponStats(item,commander);if(stats&&Object.values(stats).some(v=>typeof v==='number'&&!Number.isFinite(v)))nonfinite++;}
  ordinary+=shouldDrop({},ordinaryRng);elite+=shouldDrop({elite:true},eliteRng);
}
const result={scope:'Deterministic balance sampling, not natural pickup frequency',seed:424242,n,rarities,families,eras,partSignatures:partSignatures.size,ordinary,elite,invalid,nonfinite,
  pass:invalid===0&&nonfinite===0&&ordinary>250&&ordinary<550&&elite>1650&&elite<2350&&rarities.relic>180&&rarities.relic<420&&Object.keys(families).length===Object.keys(FAMILIES).length};
const out=resolve(process.argv[2]||'artifacts/loot-distribution.json');mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;
