import * as THREE from '../lib/three.module.min.js';
import {ModelPreview} from './asset-model-viewer.js';

const $=s=>document.querySelector(s),base='../../lib/99-art/motion-research-v1/';
const preview=new ModelPreview($('#viewer'),{contourMode:'silhouette'});
preview.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
preview.scene.children.filter(o=>o.isLight).forEach(o=>o.intensity*=.55);
const grid=new THREE.GridHelper(12,48,0x91a496,0xb9c5ba);
grid.position.y=.001;preview.scene.add(grid);
let manifest,current,travel=0,last=performance.now();
const controls=[...document.querySelectorAll('footer button,footer select,footer input')];
const draw=preview.draw.bind(preview);
preview.draw=function(){
  const now=performance.now(),dt=Math.min((now-last)/1000,.1);last=now;
  if(current&&this.playing&&$('#travel').checked){travel+=dt*this.speed*(current.groundSpeeds[$('#clip').value]||0);grid.position.z=-(travel%.25);}
  draw();
};
function clip(name){preview.clip(name,{fade:.22});$('#clip').value=name;$('#play').textContent='Pause';}
const label=name=>name.replace(/^Mixamo (?:Mixamo )?/,'Captured · ');
async function select(method){
  controls.forEach(el=>el.disabled=true);$('#viewer').setAttribute('aria-busy','true');
  window.COMMANDER_RESEARCH.ready=false;
  try{
    current=manifest.candidates[method]||manifest.candidates.mixamo;$('#method').value=method;
    await preview.load(base+current.model,e=>{$('#status').textContent='Loading / '+(e.total?Math.round(e.loaded/e.total*100)+'%':(e.loaded/1048576).toFixed(1)+' MB');});
    preview.yaw=.35;preview.pitch=.07;preview.distance=preview.height*2.35;
    $('#clip').replaceChildren(...preview.clips.map(c=>new Option(label(c.name),c.name)));
    if(preview.clips.length)clip(current.preferredClip||preview.clips[0].name);
    preview.surfaceMode($('#surface').value);preview.pauseRendering(false);
    $('#download').href=base+current.model;$('#status').textContent=current.status;
    $('#views').hidden=method!=='instantmesh';
    controls.forEach(el=>el.disabled=false);
    for(const id of ['clip','play','speed','scrub','travel'])$('#'+id).disabled=!preview.clips.length;
    travel=0;grid.position.z=0;
    const query=new URL(location.href);query.searchParams.set('method',method);history.replaceState(null,'',query);
    window.COMMANDER_RESEARCH.ready=true;
  }catch(error){$('#status').textContent=error.message;$('#method').disabled=false;window.COMMANDER_RESEARCH.error=error.message;}
  $('#viewer').setAttribute('aria-busy','false');
}
$('#method').onchange=e=>select(e.target.value);$('#clip').onchange=e=>clip(e.target.value);
$('#play').onclick=()=>$('#play').textContent=preview.toggle()?'Pause':'Play';
$('#speed').onchange=e=>preview.speed=+e.target.value;
$('#scrub').oninput=e=>{preview.seek(+e.target.value);$('#play').textContent='Play';};
$('#surface').onchange=e=>preview.surfaceMode(e.target.value);
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{preview.yaw=+b.dataset.view;preview.pitch=.07;preview.draw();});
$('#show-reference').onclick=()=>{const hidden=!$('#reference').hidden;$('#reference').hidden=hidden;$('#show-reference').setAttribute('aria-pressed',String(!hidden));};
window.COMMANDER_RESEARCH={preview,ready:false,select,clip};
try{
  const response=await fetch(base+'manifest.json');if(!response.ok)throw Error('Comparison manifest unavailable');
  manifest=await response.json();window.COMMANDER_RESEARCH.manifest=manifest;
  $('#reference').src=base+manifest.hero;
  const requested=new URL(location.href).searchParams.get('method');
  await select(manifest.candidates[requested]?requested:manifest.default);
}catch(error){$('#status').textContent=error.message;window.COMMANDER_RESEARCH.error=error.message;}
