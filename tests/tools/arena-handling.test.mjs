import test from 'node:test';
import assert from 'node:assert/strict';
import {newHandling,updateHandling,HANDLING} from '../../js/arena-handling.js';
import {GRAPHICS_DEFAULTS,GRAPHICS_ORIGINAL} from '../../js/arena-presets.js';
const advance=(s,input,time,hz=120)=>{for(let i=0;i<time*hz;i++)updateHandling(s,1/hz,input);};
test('FPS pace is normalized, starts briskly and brakes without drifting',()=>{
  const a=newHandling(),b=newHandling();advance(a,{z:-1},.2);advance(b,{z:-1,x:1},.2);
  assert.ok(Math.abs(Math.hypot(a.vx,a.vz)-Math.hypot(b.vx,b.vz))<1e-6);assert.ok(-a.vz>HANDLING.walk*.99);
  advance(a,{},.2);assert.ok(Math.hypot(a.vx,a.vz)<.003);
});
test('slide requires grounded forward sprint, retains momentum and cannot be held to chain',()=>{
  const s=newHandling();advance(s,{z:-1,run:true},.4);updateHandling(s,1/120,{z:-1,run:true,crouch:true});assert.ok(s.slide>.7&&-s.vz>8.8);
  advance(s,{z:-1,run:true,crouch:true},1.5);assert.equal(s.slide,0);assert.ok(Math.abs(s.vz)<2.3);
  const slow=newHandling();advance(slow,{z:-1,crouch:true,run:true},1);assert.equal(slow.slide,0);
  const air=newHandling();advance(air,{z:-1,run:true},.4);updateHandling(air,.01,{z:-1,run:true,crouch:true,grounded:false});assert.equal(air.slide,0);
});
test('aim interrupts sprint, preserves movement and blends over 200ms',()=>{
  const s=newHandling();advance(s,{z:-1,run:true},.4);advance(s,{z:-1,run:true,aim:true},.1);assert.ok(s.ads>.49&&s.ads<.51);assert.equal(s.mode,'aim');assert.ok(-s.vz<3.1);
  advance(s,{aim:true},.1);assert.ok(s.ads>.99);advance(s,{},.2);assert.equal(s.ads,0);
});
test('handling terminal speeds and camera are consistent at 30/60/120Hz',()=>{
  const samples=[30,60,120].map(hz=>{const s=newHandling();advance(s,{z:-1,run:true},.5,hz);advance(s,{z:-1,run:true,crouch:true},.3,hz);return s;});
  for(const s of samples){assert.ok(Math.abs(s.slideSpeed-samples[0].slideSpeed)<1e-10);assert.ok(Math.abs(s.eye-samples[0].eye)<1e-10);}
});
test('new Vivid startup does not mutate original Atmospheric Ink',()=>{
  assert.notEqual(GRAPHICS_DEFAULTS,GRAPHICS_ORIGINAL);assert.equal(GRAPHICS_DEFAULTS.exposure,.77);assert.equal(GRAPHICS_ORIGINAL.exposure,1);assert.equal(GRAPHICS_ORIGINAL.fog,.0115);assert.ok(Object.isFrozen(GRAPHICS_ORIGINAL));
});

test('a fitted third-person pace preserves source speed and keeps FPS defaults separate',()=>{
 const pace={...HANDLING,walk:1.389573589,sprint:3.461958244,slide:4.5};const walk=newHandling(),run=newHandling();
 advance(walk,{z:-1,pace},.5);advance(run,{z:-1,run:true,pace},.5);
 assert.ok(Math.abs(-walk.vz-pace.walk)<.001);assert.ok(Math.abs(-run.vz-pace.sprint)<.001);
 updateHandling(run,.01,{z:-1,run:true,crouch:true,pace});assert.ok(run.slide>0);assert.equal(HANDLING.walk,4.4);
});
