import test from 'node:test';
import assert from 'node:assert/strict';
import {createInventory,generateWeapon} from '../../js/run/weapons.js';
import {forgeWeapon} from '../../js/run/weapon-forge.js';
const item=(id,family='sword',rarity='common')=>({...generateWeapon({id,seed:3,rng:()=>.1,family}),rarity});
const options={id:'new',seed:123,rng:()=>.99,maxRarity:'rare'};
test('roller charges exactly three scrap, caps home rarity and leaves input immutable',()=>{
 const i=createInventory('commander');i.awardScrap(5);const snapshot=i.snapshot(),copy=JSON.stringify(snapshot),result=forgeWeapon('commander',snapshot,{kind:'roll'},options);
 assert.equal(result.ok,true);assert.equal(result.inventory.scrap,2);assert.equal(result.item.rarity,'rare');assert.equal(JSON.stringify(snapshot),copy);
});
test('full bag and insufficient funds reject without consumption',()=>{
 const i=createInventory('commander');i.awardScrap(3);for(let n=0;n<12;n++){i.register(item('w'+n));i.pickup('w'+n);}
 assert.equal(forgeWeapon('commander',i.snapshot(),{kind:'roll'},options).ok,false);assert.equal(i.scrap,3);
 assert.equal(forgeWeapon('commander',createInventory('commander').snapshot(),{kind:'roll'},options).ok,false);
});
test('merge consumes exactly three matching unequipped weapons and preserves best identity parts',()=>{
 const i=createInventory('commander');for(const w of [item('a'),item('b','sword','uncommon'),item('c'),item('keep','spear')]){i.register(w);i.pickup(w.id);}
 const r=forgeWeapon('commander',i.snapshot(),{kind:'merge',ids:['a','b','c']},options);
 assert.equal(r.ok,true);assert.equal(r.item.rarity,'rare');assert.deepEqual(r.item.parts,item('b').parts);assert.deepEqual(r.inventory.items.map(w=>w.id),['keep','new']);assert.equal(r.inventory.scrap,0);
 for(const ids of [['a','b','b'],['a','b','keep']])assert.equal(forgeWeapon('commander',i.snapshot(),{kind:'merge',ids},options).ok,false);
 i.request({kind:'equip',id:'a',slot:0});assert.equal(forgeWeapon('commander',i.snapshot(),{kind:'merge',ids:['a','b','c']},options).ok,false);
});
test('merge cannot bypass home rarity cap or duplicate weapon identities',()=>{
 const i=createInventory('commander');for(const id of ['a','b','c']){i.register(item(id,'sword','rare'));i.pickup(id);}
 assert.equal(forgeWeapon('commander',i.snapshot(),{kind:'merge',ids:['a','b','c']},options).ok,false);
 assert.equal(forgeWeapon('commander',i.snapshot(),{kind:'merge',ids:['a','b','c']},{...options,maxRarity:'relic',id:'a'}).ok,false);
 assert.equal(forgeWeapon('commander',i.snapshot(),{kind:'merge',ids:['a','b','c']},{...options,maxRarity:'relic'}).item.rarity,'epic');
});
