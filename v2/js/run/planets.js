// The two-world pilot is deliberately small until actual continuation passes.
export const CAMPAIGN_LENGTH=2;
export function planetDefinition(index,seed) {
  if(!Number.isInteger(index)||index<1||index>CAMPAIGN_LENGTH)return null;
  return index===1
    ? {index,name:'Hearthwild',terrain:'varied',seed,era:'ancient',enemyHealth:1,pressure:'mixed',brief:'Carry crystals home and build a lasting defense.'}
    : {index,name:'Riftshore',terrain:'canyon',seed,era:'ancient',enemyHealth:1,pressure:'wings',brief:'Deep cuts reward safe crossings. Prepare for more flying creatures.'};
}
