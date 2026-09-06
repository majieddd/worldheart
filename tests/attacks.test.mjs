import test from 'node:test';import assert from 'node:assert/strict';
import {insideStrike,enemyStrike,STRIKE_AT} from '../js/attacks.js';
test('strike volume includes boundaries but rejects rear, height and range escapes',()=>{
 const up={x:0,y:1,z:0},forward={x:0,y:0,z:-1},hit=v=>insideStrike(v,up,forward,3,90);
 assert.equal(hit({x:0,y:0,z:-3}),true);assert.equal(hit({x:0,y:0,z:-3.001}),false);
 assert.equal(hit({x:0,y:0,z:1}),false);assert.equal(hit({x:0,y:3.01,z:0}),false);
 assert.equal(hit({x:1,y:0,z:-1}),true);assert.equal(hit({x:1.01,y:0,z:-1}),false);
 // A rotated planet frame has exactly the same coverage.
 assert.equal(insideStrike({x:3,y:0,z:0},{x:0,y:0,z:1},{x:1,y:0,z:0},3,90),true);
});
test('authored enemy shapes and release phases are finite and ordered',()=>{
 const small=enemyStrike({reach:1.5,wind:.3,atk:12}),boss=enemyStrike({reach:4,wind:1,atk:30,boss:true});
 assert.equal(small.radius,1.85);assert.ok(boss.arcDeg>small.arcDeg);
 for(const kind of ['melee','twin','hitscan','projectile','lob'])assert.ok(STRIKE_AT[kind]>0&&STRIKE_AT[kind]<1);
});
