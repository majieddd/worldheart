import {createInventory,generateWeapon,RARITIES,BACKPACK_SIZE,validWeapon} from './weapons.js';

export const WEAPON_ROLL_COST=3;
// Work on a disposable checkpoint. Rejected recipes never consume resources.
export function forgeWeapon(commander,snapshot,operation,{id,seed,rng,maxRarity='relic',tier=1}={}){
 const inventory=createInventory(commander,snapshot),next=inventory.snapshot();
 const reject=reason=>({ok:false,reason});
 if(!RARITIES.includes(maxRarity))return reject('Unknown rarity limit.');
 if(operation.kind==='salvage'){
  if(!inventory.salvage(operation.id))return reject('Unequip this weapon before salvaging it.');
  return {ok:true,inventory:inventory.snapshot(),message:'Salvaged for 1 scrap.'};
 }
 if(typeof id!=='string'||next.items.some(w=>w.id===id))return reject('A new weapon identity is required.');
 let item;
 if(operation.kind==='roll'){
  if(next.scrap<WEAPON_ROLL_COST)return reject('Find or salvage weapons to collect 3 scrap.');
  if(next.items.length-next.slots.filter(Boolean).length>=BACKPACK_SIZE)return reject('Your backpack is full. Salvage a weapon first.');
  item=generateWeapon({id,seed,rng,tier,maxRarity});next.scrap-=WEAPON_ROLL_COST;
 }else if(operation.kind==='merge'){
  const ids=operation.ids;
  if(!Array.isArray(ids)||ids.length!==3||new Set(ids).size!==3)return reject('Select three different weapons of the same family.');
  const chosen=ids.map(key=>next.items.find(w=>w.id===key));
  if(chosen.some(w=>!w)||chosen.some(w=>next.slots.includes(w.id)))return reject('Only unequipped weapons can be merged.');
  if(chosen.some(w=>w.family!==chosen[0].family))return reject('All three weapons must be the same family.');
  const best=[...chosen].sort((a,b)=>RARITIES.indexOf(b.rarity)-RARITIES.indexOf(a.rarity)||b.tier-a.tier)[0];
  const rank=RARITIES.indexOf(best.rarity),cap=RARITIES.indexOf(maxRarity);
  if(rank>=cap)return reject(`This pack is capped at ${maxRarity}. Keep your best weapon.`);
  item={...JSON.parse(JSON.stringify(best)),id,rarity:RARITIES[rank+1]};
  next.items=next.items.filter(w=>!ids.includes(w.id));
 }else return reject('Unknown forge recipe.');
 if(!validWeapon(item))return reject('Invalid weapon recipe.');
 next.items.push(item);createInventory(commander,next);
 return {ok:true,inventory:next,item,message:operation.kind==='merge'?'Merged into a higher rarity. Parts, manufacturer and skill are preserved.':'Rolled a new weapon.'};
}
