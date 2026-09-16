import test from 'node:test';
import assert from 'node:assert/strict';
import {swordPose,SWORD_REST} from '../../js/arena-motion.js';
import {GRAPHICS_PRESETS,GRAPHICS_DEFAULTS,normalizeGraphics,matchingPreset} from '../../js/arena-presets.js';

const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('all sword cuts return continuously to rest and move through contact',()=>{
  for(let cut=0;cut<3;cut++){
    assert.deepEqual(swordPose(cut,0),SWORD_REST);assert.deepEqual(swordPose(cut,1),SWORD_REST);
    const poses=Array.from({length:241},(_,i)=>swordPose(cut,i/240));
    assert.ok(poses.every(p=>[...p.p,...p.r].every(Number.isFinite)));
    assert.ok(Math.max(...poses.slice(1).map((p,i)=>distance(p.p,poses[i].p)))<.04);
    const contact=[.44,.45,.48][cut],h=.0001,a=swordPose(cut,contact-h),b=swordPose(cut,contact),c=swordPose(cut,contact+h);
    const before=b.p.map((v,i)=>(v-a.p[i])/h),after=c.p.map((v,i)=>(v-b.p[i])/h);
    assert.ok(distance(before,after)<.02,'No stop or velocity seam at contact');
    const angular=b.r.map((v,i)=>(v-a.r[i])/h);
    // A downward cut is driven mostly by wrist rotation, not wrist travel.
    assert.ok(Math.hypot(...before)>.05&&Math.hypot(...angular)>1,'Contact must reject a frozen or stop-at-every-key control');
    assert.ok(distance(poses[0].p,poses[1].p)<.002&&distance(poses[239].p,poses[240].p)<.002);
  }
});
test('owner screenshot presets preserve all supplied values and original reset',()=>{
  const keys=['line','fog','shadowDepth','saturation','texture','exposure','resolution','fov','bob','shake','sensitivity'];
  assert.deepEqual(keys.map(k=>GRAPHICS_PRESETS.vivid.graphics[k]),[2.8,.0225,.35,1.3,1.5,.77,1.25,81,.45,.45,1]);
  assert.deepEqual(keys.map(k=>GRAPHICS_PRESETS.deep.graphics[k]),[2.8,.021,.3,1.5,1.69,.84,1.25,81,.45,.45,1]);
  const before=JSON.stringify(GRAPHICS_DEFAULTS),custom=normalizeGraphics({...GRAPHICS_PRESETS.vivid.graphics,line:99,texture:NaN});
  assert.equal(custom.line,4);assert.equal(custom.texture,1.5);assert.equal(matchingPreset(custom),'custom');assert.equal(matchingPreset(GRAPHICS_DEFAULTS),'vivid');assert.equal(JSON.stringify(GRAPHICS_DEFAULTS),before);assert.ok(Object.isFrozen(GRAPHICS_PRESETS.vivid.graphics));
});
