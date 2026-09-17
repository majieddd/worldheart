import * as THREE from '../lib/three.module.min.js';
import {ModelPreview} from './asset-model-viewer.js';
const $=s=>document.querySelector(s),base='../../lib/99-art/vey-refinement-v1/',old='../../lib/99-art/vey-benchmark-v1/';
const preview=new ModelPreview($('#viewer'),{contourMode:'silhouette'});
preview.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
preview.scene.children.filter(o=>o.isLight).forEach(o=>o.intensity*=.55);
const state=window.VEY_REFINEMENT={preview,ready:false};window.VEY_BENCHMARK=state;
window.VEY_PILOT={preview,selectClip:(name,fade)=>selectClip(name,fade),step(time){preview.playing=false;preview.mixer.setTime(time);preview.draw();}};
const grid=new THREE.GridHelper(12,40,0x9fa99f,0xc4ccc1);preview.scene.add(grid);
const manifest=await fetch(base+'manifest.json').then(r=>r.json());
const charts=await fetch(old+'motion-chart.json').then(r=>r.json());
let loaded=false,last=performance.now(),travel=0;
function selectClip(name,fade=true){$('#clip').value=name;const clip=preview.clips.find(c=>c.name.startsWith(name));if(clip)preview.clip(clip.name,{fade:fade?.22:0});$('#play').textContent='Pause';}
const originalDraw=preview.draw.bind(preview);
preview.draw=function(){const now=performance.now(),dt=Math.min((now-last)/1000,.08);last=now;if(grid.visible&&preview.playing&&!preview.paused){travel=(travel+dt*preview.speed*(charts[$('#clip').value]?.speed||0))%.3;grid.position.z=-travel;}originalDraw();};
async function load(){
 state.ready=false;preview.pauseRendering(true);$('#status').textContent='Loading model…';
 const camera={yaw:preview.yaw,pitch:preview.pitch,distance:preview.distance,target:preview.target.clone()},playing=preview.playing,time=preview.mixer?.time||0;
 const kind=$('#candidate').value,item=manifest.models[kind],file=(kind.startsWith('old-')?old:base)+item.file;
 await preview.load(file);const animated=kind.includes('motion');
 if(animated){selectClip($('#clip').value,false);preview.mixer.setTime(time);}
 if(loaded){preview.yaw=camera.yaw;preview.pitch=camera.pitch;preview.distance=camera.distance;preview.target.copy(camera.target);preview.playing=playing;}
 else{preview.yaw=.35;preview.focus('body');}
 $('#clip').disabled=$('#play').disabled=$('#scrub').disabled=!animated;grid.visible=animated&&$('#floor').checked;
 preview.surfaceMode($('#surface').value);preview.pauseRendering(false);preview.draw();preview.ink(+$('#ink').value);
 $('#status').textContent=item.summary;$('#verdict').textContent=manifest.verdict;$('#download').href=file;$('#play').textContent=preview.playing?'Pause':'Play';loaded=true;state.ready=true;
}
$('#candidate').onchange=()=>load().catch(e=>{state.error=e.message;$('#status').textContent=e.message;});
$('#clip').onchange=e=>selectClip(e.target.value);$('#play').onclick=()=>$('#play').textContent=preview.toggle()?'Pause':'Play';
$('#focus').onchange=e=>preview.focus(e.target.value);$('#surface').onchange=e=>preview.surfaceMode(e.target.value);
$('#scrub').oninput=e=>{preview.seek(+e.target.value);$('#play').textContent='Play';};$('#speed').oninput=e=>preview.speed=+e.target.value;
$('#ink').oninput=e=>preview.ink(+e.target.value);$('#floor').onchange=e=>grid.visible=e.target.checked&&$('#candidate').value.includes('motion');
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{preview.yaw=+b.dataset.view;preview.pitch=.06;preview.draw();});
const timing=await fetch(base+'timing-ledger.json').then(r=>r.json()),duration=n=>n<60?n.toFixed(1)+' s':Math.floor(n/60)+'m '+Math.round(n%60)+'s';
for(const step of timing.steps){const row=document.createElement('tr');for(const value of [step.step,duration(step.seconds),step.result||step.status]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}$('#timing-rows').append(row);}
$('#elapsed').textContent='Elapsed at release checkpoint: '+duration(timing.totalSeconds)+'. '+timing.timeBasis;
const initial=new URLSearchParams(location.search).get('stage');if(manifest.models[initial])$('#candidate').value=initial;
try{await load();}catch(e){state.error=e.message;$('#status').textContent=e.message;}
