import test from 'node:test';
import assert from 'node:assert/strict';
import {createInventory,generateWeapon} from '../../js/run/weapons.js';
import {createScrapForge} from '../../js/run/expedition.js';
import {createAbilityClock,COMMANDER_ABILITIES,WEAPON_ABILITIES} from '../../js/run/abilities.js';

test('salvage funds rising forge prices without spending on failed or remote grants',()=>{
  const inventory=createInventory('commander'),forge=createScrapForge(inventory);
  for(let i=0;i<12;i++){const item=generateWeapon({id:'scrap-'+i,seed:i,tier:1,family:'sword',rng:()=>.1});inventory.register(item);assert.ok(inventory.salvage(item.id));assert.equal(inventory.salvage(item.id),false);}
  assert.equal(forge.balance,12);assert.equal(forge.craft(false,()=>true),null);assert.equal(forge.craft(true,()=>false),null);assert.equal(forge.balance,12);
  assert.equal(forge.craft(true,()=> 'bolt'),'bolt');assert.equal(forge.balance,9);assert.equal(forge.cost,5);
  assert.equal(forge.craft(true,()=> 'frost'),'frost');assert.equal(forge.balance,4);assert.equal(forge.cost,7);
  let called=false;assert.equal(forge.craft(true,()=>{called=true;return 'bolt';}),null);assert.equal(called,false);
  assert.equal(createInventory('commander',inventory.snapshot()).scrap,4);
});
test('ability cooldowns advance only with simulation time and cannot be bypassed by swapping',()=>{
  const clock=createAbilityClock();assert.equal(Object.keys(COMMANDER_ABILITIES).length,5);assert.equal(Object.keys(WEAPON_ABILITIES).length,6);
  for(const [group,defs] of Object.entries({commander:COMMANDER_ABILITIES,weapon:WEAPON_ABILITIES}))for(const [key,def] of Object.entries(defs)){
    const id=group+':'+key;assert.equal(clock.activate(id,def.cooldown,()=>false),false);assert.equal(clock.remaining(id),0);
    assert.ok(clock.activate(id,def.cooldown,()=>true));assert.equal(clock.activate(id,def.cooldown,()=>true),false);
  }
  clock.tick(-1);clock.tick(NaN);clock.tick(0);assert.equal(clock.remaining('weapon:sword'),12);
  clock.tick(11.9);assert.ok(clock.remaining('weapon:sword')>0);clock.tick(.1);assert.equal(clock.remaining('weapon:sword'),0);
  assert.ok(clock.remaining('commander:oracle')>0);assert.ok(clock.activate('weapon:sword',12,()=>true));
});
