import test from 'node:test';
import assert from 'node:assert/strict';
import {createScrapForge} from '../../js/run/expedition.js';
import {FAMILIES,RARITIES,WEAPON_MATERIALS,generateWeapon,materialForWeapon,weaponStats,validWeapon,createInventory} from '../../js/run/weapons.js';
import {makeRng} from '../../js/run/rng.js';

test('forging charges increasing prices only after a successful tower grant',()=>{
  const inventory=createInventory('commander',{version:1,items:[],slots:[null,null],active:'native',scrap:40}),forge=createScrapForge(inventory);
  for(const cost of [3,5,7,9]){
    assert.equal(forge.cost,cost);const before=forge.balance,forged=forge.forged;
    assert.equal(forge.craft(false,()=> 'bolt'),null);assert.equal(forge.craft(true,()=>null),null);
    assert.equal(forge.balance,before);assert.equal(forge.forged,forged);
    assert.equal(forge.craft(true,()=> 'bolt'),'bolt');assert.equal(forge.balance,before-cost);
  }
  assert.equal(forge.cost,11);
});
test('six weapon families have five material steps and beam damage follows the same rarity contract',()=>{
  assert.equal(Object.keys(FAMILIES).length,6);assert.equal(WEAPON_MATERIALS.length,5);
  for(const family of Object.keys(FAMILIES)){
    const item=generateWeapon({id:family,seed:91,family,rng:makeRng(91)});let damage=0;
    for(let i=0;i<RARITIES.length;i++){
      item.rarity=RARITIES[i];assert.ok(validWeapon(item));assert.equal(materialForWeapon(item),WEAPON_MATERIALS[i]);
      const stats=weaponStats(item,family==='scepter'?'oracle':'commander',true);assert.ok(stats.dmg>damage);damage=stats.dmg;
      if(family==='scepter'){assert.equal(stats.dps,stats.dmg);assert.ok(stats.heatUp>0&&stats.heatDown>0);}
    }
  }
});
