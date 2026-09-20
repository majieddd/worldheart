// Run with Aegis tools/headless.js URL OUTDIR ABSOLUTE_PATH_TO_THIS_FILE.
// Console/shader errors must make headless exit nonzero, including in static views.
const fs = require('node:fs');
const path = require('node:path');
const review = fs.readFileSync(path.join(__dirname, 'runtime-review.js'), 'utf8')
 .replace('export async function review()', 'async function review()')
 .replace("'../../../../lib/three.module.min.js'", "new URL('../../lib/three.module.min.js',location.href).href");
const ready = "for(let i=0;i<150&&!window.VEY_PILOT?.ready;i++)await new Promise(r=>setTimeout(r,100));if(!window.VEY_PILOT?.ready)throw Error('Vey failed to load');";
const stages = `(async()=>{
 document.querySelector('#show-rig').click();
 const stage=document.querySelector('#stage');
 for(const value of ['paint','old','motion']){
  stage.value=value;stage.dispatchEvent(new Event('change'));${ready}
  if(value!=='motion'&&VEY_PILOT.preview.scene.children.some(o=>o.type==='SkeletonHelper'))throw Error('stale rig in static view');
 }
 document.querySelector('#clip').value='Run';document.querySelector('#clip').dispatchEvent(new Event('change'));
 await new Promise(r=>setTimeout(r,350));document.querySelector('[data-view=side]').click();
 return {stages:3,clips:VEY_PILOT.preview.clips.length,transition:'walk to run',ready:VEY_PILOT.ready};
})()`;
module.exports = [
 {size:[1280,1000]},
 {eval:`(async()=>{${ready}${review};const r=await review();if(r.status!=='pass')throw Error(JSON.stringify(r));return r;})()`},
 {eval:stages},
 {eval:"window.scrollTo({top:document.querySelector('#model').offsetTop,behavior:'instant'})"},
 {shot:'motion'},
 {size:[390,844]},
 {eval:"window.scrollTo({top:document.querySelector('#viewer').getBoundingClientRect().top+scrollY-20,behavior:'instant'});if(document.documentElement.scrollWidth>innerWidth)throw Error('mobile overflow');({viewport:innerWidth,overflow:false})"},
 {shot:'mobile'}
];
