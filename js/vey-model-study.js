import {ModelPreview} from './asset-model-viewer.js';
const $=s=>document.querySelector(s),preview=new ModelPreview($('canvas'));
async function load(){try{const name=$('#variant').value==='shape'?'vey-hunyuan.glb':'vey-hunyuan-painted.glb';await preview.load('../../lib/99-art/identity-v2/'+name);preview.pauseRendering(false);$('#status').textContent='Local Hunyuan3D-2mini / 30 steps / drag to orbit, scroll to zoom';}catch(e){$('#status').textContent=e.message;}}
$('#variant').onchange=load;$('#contour').oninput=e=>preview.ink(+e.target.value);$('#reset').onclick=()=>preview.reset();await load();
