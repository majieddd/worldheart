import test from 'node:test';
import assert from 'node:assert/strict';
import {newRound,beginRound,advanceRound,registerKill,swordActive,segmentDistanceSquared} from '../../js/arena-rules.js';
test('three-wave demo counts only active kills and can replay',()=>{const s=newRound();registerKill(s);assert.equal(s.kills,0);beginRound(s);for(const count of [3,5,7]){assert.equal(advanceRound(s,3),true);assert.equal(s.remaining,count);for(let i=0;i<count;i++)registerKill(s);registerKill(s);assert.equal(s.remaining,0);}assert.equal(advanceRound(s,3),false);assert.equal(s.phase,'complete');assert.equal(s.kills,15);beginRound(s);assert.equal(s.kills,0);assert.equal(s.wave,0);});
test('sword damage excludes anticipation and recovery',()=>{assert.equal(swordActive(.1),false);assert.equal(swordActive(.4),true);assert.equal(swordActive(.8),false);});
test('swept collision catches a fast bolt even when both endpoints miss',()=>{const p={x:0,y:1,z:0},a={x:-4,y:1,z:0},b={x:4,y:1,z:0};assert.equal(segmentDistanceSquared(p,a,b),0);assert.equal(segmentDistanceSquared({x:0,y:3,z:0},a,b),4);assert.equal(segmentDistanceSquared({x:6,y:1,z:0},a,b),4);assert.equal(segmentDistanceSquared(p,a,a),16);});
