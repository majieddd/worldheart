import * as THREE from '../lib/three.module.min.js';
import {ModelPreview} from './asset-model-viewer.js';
const $=s=>document.querySelector(s),base='../../lib/99-art/reptilian-pilot-v1/';
const preview=new ModelPreview($('#viewer'),{contourMode:'silhouette'});
preview.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
preview.scene.children.filter(o=>o.isLight).forEach(o=>o.intensity*=.55);
const grid=new THREE.GridHelper(12,48,0x91a496,0xb9c5ba);grid.position.y=.001;preview.scene.add(grid);
let manifest,travel=0,last=performance.now();
const draw=preview.draw.bind(preview);
preview.draw=function(){const now=performance.now(),dt=Math.min((now-last)/1000,.1);last=now;if(manifest&&this.playing&&$('#travel').checked){travel+=dt*this.speed*(manifest.groundSpeeds[$('#clip').value]||0);grid.position.z=-(travel%.25);}draw();};
function clip(name){const selected=preview.clips.find(c=>c.name.startsWith(name));if(selected)preview.clip(selected.name,{fade:.22});$('#play').textContent='Pause';}
$('#clip').onchange=e=>clip(e.target.value);$('#play').onclick=()=>$('#play').textContent=preview.toggle()?'Pause':'Play';$('#speed').onchange=e=>preview.speed=+e.target.value;
$('#scrub').oninput=e=>{preview.seek(+e.target.value);$('#play').textContent='Play';};$('#surface').onchange=e=>preview.surfaceMode(e.target.value);
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{preview.yaw=+b.dataset.view;preview.pitch=.07;preview.draw();});
$('#show-reference').onclick=()=>{const hidden=!$('#reference').hidden;$('#reference').hidden=hidden;$('#show-reference').setAttribute('aria-pressed',String(!hidden));};
window.COMMANDER_PREVIEW={preview,ready:false,clip};
try{manifest=await fetch(base+'manifest.json').then(r=>{if(!r.ok)throw Error('Candidate manifest unavailable');return r.json();});await preview.load(base+manifest.model);preview.yaw=.35;preview.pitch=.07;preview.distance=preview.height*2.35;clip('Idle');preview.pauseRendering(false);$('#reference').src=base+manifest.hero;$('#download').href=base+manifest.model;$('#status').textContent=manifest.status;window.COMMANDER_PREVIEW.ready=true;window.COMMANDER_PREVIEW.manifest=manifest;}catch(error){$('#status').textContent=error.message;window.COMMANDER_PREVIEW.error=error.message;}
