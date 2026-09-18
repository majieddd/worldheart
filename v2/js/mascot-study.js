import {ModelPreview} from './asset-model-viewer.js';
const $=s=>document.querySelector(s),preview=new ModelPreview($('canvas'));
try{const clips=await preview.load('../../lib/99-art/mascot-v1/gray-hybrid-original.glb');$('#clips').replaceChildren(...clips.map(name=>new Option(name,name)));$('#clips').disabled=false;$('#clips').value='Idle';preview.clip('Idle');preview.pauseRendering(false);$('#model-status').textContent=`Original geometry / ${clips.length} supplied clips / drag to orbit, scroll to zoom`;if(matchMedia('(prefers-reduced-motion:reduce)').matches){preview.toggle();$('#play').textContent='Play';}}
catch(error){$('#model-status').textContent='Model could not load: '+error.message;}
$('#clips').onchange=e=>{preview.clip(e.target.value);$('#play').textContent='Pause';};$('#play').onclick=()=>{$('#play').textContent=preview.toggle()?'Pause':'Play';};$('#speed').oninput=e=>preview.speed=+e.target.value;$('#contour').oninput=e=>preview.ink(+e.target.value);$('#reset').onclick=()=>preview.reset();
new IntersectionObserver(entries=>preview.pauseRendering(!entries[0].isIntersecting),{rootMargin:'100px'}).observe($('canvas'));
