// Import through the browser: measurements are taken from the exported GLB.
export async function review(){
 const {Vector3}=await import('../../../../lib/three.module.min.js');
 const {preview,selectClip,step}=window.VEY_PILOT;const results=[];const bones=[];preview.root.traverse(o=>{if(o.isBone)bones.push(o);});const bone=name=>bones.find(b=>b.name.replace(/[._]/g,'')===name.replace(/[._]/g,''));
 function check(name,pass,metrics){results.push({name,status:pass?'pass':'fail',metrics});}
 check('Model loaded',!!preview.root,{clips:preview.clips.map(c=>c.name)});
 for(const name of ['Walk','Run']){
  selectClip(name,false);preview.playing=false;const clip=preview.clips.find(c=>c.name.startsWith(name)),hips=preview.root.getObjectByName('hips');const vals=[];const feet=[];
  for(let i=0;i<=90;i++){step(Math.min(clip.duration*i/90,clip.duration-1/60000));preview.root.updateMatrixWorld(true);vals.push(hips.getWorldPosition(new Vector3()).toArray());feet.push(['toe.L','toe.R'].map(n=>bone(n).getWorldPosition(new Vector3()).toArray()));}
  const range=axis=>Math.max(...vals.map(v=>v[axis]))-Math.min(...vals.map(v=>v[axis]));
  check(name+' has captured pelvis translation',range(1)>.025&&range(1)<.14,{verticalMeters:range(1),lateralMeters:range(0),duration:clip.duration});
  const seam=Math.max(...feet[0].map((v,i)=>Math.hypot(...v.map((x,k)=>x-feet.at(-1)[i][k]))));check(name+' complete cycle seam',seam<.012,{seamMeters:seam,duration:clip.duration});
  check(name+' cadence',name==='Walk'?clip.duration>.85&&clip.duration<1.3:clip.duration>.55&&clip.duration<.9,{stepsPerMinute:120/clip.duration});
 }
 // Known original defect: zero pelvis translation must fail this retained gate.
 check('Frozen-pelvis negative control',!([0,0,0].some(v=>v>.025)),{frozenFixtureVerticalMeters:0,criterionMinimum:.025});
 check('No page overflow',document.documentElement.scrollWidth<=innerWidth,{width:innerWidth,scrollWidth:document.documentElement.scrollWidth});
 selectClip('Walk',false);return {status:results.every(r=>r.status==='pass')?'pass':'fail',checks:results};
}
