import test from 'node:test';
import assert from 'node:assert/strict';
import {STRUCTURES,structureReward,wallIntersects} from '../js/run/structures.js';
import {createInventory} from '../js/run/weapons.js';
import {validateHome,starterEarthHome,homeDefeatCheckpoint} from '../js/run/homeworld.js';
test('supply chest rewards replay independently of combat random order',()=>{
  for(const kind of Object.keys(STRUCTURES)){
    const a=structureReward(123,4,kind);structureReward(100,0,kind);
    assert.deepEqual(a,structureReward(123,4,kind));assert.ok(a.scraps||a.weapon||a.crystals);
  }
});
test('thin walls catch crossing steps and permit travel beside the ends',()=>{
  assert.ok(wallIntersects([0,-4],[0,4]));assert.ok(wallIntersects([1.7,-2],[1.7,2],.4));
  assert.equal(wallIntersects([3,-4],[3,4]),false);assert.equal(wallIntersects([0,-2],[0,-1]),false);
});
test('scrap purchases are atomic and reject unsupported rewards',()=>{
  const inventory=createInventory('commander');let stock=0;
  assert.equal(inventory.spendScrap(1,()=>++stock),null);assert.equal(stock,0);
  assert.ok(inventory.awardScrap(2));assert.equal(inventory.awardScrap(Infinity),false);
  assert.equal(inventory.spendScrap(1,()=>false),null);assert.equal(inventory.scrap,2);
  inventory.spendScrap(1,()=>{stock+=5;return true;});assert.equal(stock,5);assert.equal(inventory.scrap,1);
});
test('home checkpoints preserve wall health and reject malformed construction data',()=>{
  const h=starterEarthHome();h.checkpoint.walls={stock:4,sequence:1,items:[{id:1,dir:[0,1,0],angle:.4,hp:90}]};h.checkpoint.structures={claimed:['site-12345-1']};
  assert.ok(validateHome(h));const rollback=homeDefeatCheckpoint(h.checkpoint,{structures:{claimed:['site-12345-1','site-12345-2']}});assert.equal(rollback.structures.claimed.length,2);
  h.checkpoint.walls.items[0].hp=-1;assert.equal(validateHome(h),false);
});
