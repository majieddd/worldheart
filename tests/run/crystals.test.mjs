import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCrystalLedger} from '../../js/run/crystals.js';
import {createRun} from '../../js/run/run.js';
function fresh(){const c=createCrystalLedger();for(const id of ['a','b','c','d'])c.register(id);return c;}
test('only registered crystals can be picked up once, with capacity three',()=>{
  const c=fresh();assert.equal(c.pickup('unknown'),false);assert.equal(c.pickup('a'),true);assert.equal(c.pickup('a'),false);
  c.pickup('b');c.pickup('c');assert.equal(c.pickup('d'),false);assert.equal(c.carried.length,3);
  const copy=c.carried;copy.length=0;assert.equal(c.carried.length,3);
});
test('a return deposits once and cannot expand the frontier or create tower gold',()=>{
  const c=fresh(),run=createRun({seed:2,playerIds:['solo']});const theta=run.getFrontierTheta();
  c.pickup('a');assert.deepEqual(c.deposit({alive:true,nearHeart:false}),{count:0,credit:0});
  assert.deepEqual(c.deposit({alive:false,nearHeart:true}),{count:0,credit:0});
  assert.deepEqual(c.deposit({alive:true,nearHeart:true}),{count:1,credit:100});
  assert.deepEqual(c.deposit({alive:true,nearHeart:true}),{count:0,credit:0});
  assert.equal(c.credit,100);assert.equal(c.pickup('a'),false);assert.equal(run.getFrontierTheta(),theta);
});
test('mixed payment conserves credit and refuses partial unaffordable purchases',()=>{
  const c=fresh();c.pickup('a');c.pickup('b');c.deposit({alive:true,nearHeart:true});
  assert.deepEqual(c.quote(250,40),{credit:200,gold:50,shortfall:10,afford:false});assert.equal(c.spend(250,40),null);assert.equal(c.credit,200);
  const paid=c.spend(250,50);assert.equal(paid.gold,50);assert.equal(c.credit,0);assert.equal(paid.credit+paid.gold,250);
});
test('credit-only purchase retains surplus, and invalid amounts cannot mint credit',()=>{
  const c=fresh();for(const id of ['a','b','c'])c.pickup(id);c.deposit({alive:true,nearHeart:true});
  assert.equal(c.spend(250,0).gold,0);assert.equal(c.credit,50);
  for(const bad of [null,NaN,Infinity,-1])assert.equal(c.spend(bad,100),null);
  assert.equal(c.credit,50);
});
test('death loses cargo once without duplicating previously claimed identities',()=>{
  const c=fresh();c.pickup('a');assert.equal(c.loseCarried(),1);assert.equal(c.loseCarried(),0);
  assert.equal(c.pickup('a'),false);assert.equal(c.credit,0);
  const snapshot=c.snapshot();assert.deepEqual(JSON.parse(JSON.stringify(snapshot)),snapshot);
});
