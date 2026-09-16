import * as THREE from 'three';
import {createSurfaceMaterials} from './arena-materials.js';
import {GRAPHICS_DEFAULTS,GRAPHICS_PRESETS} from './arena-presets.js';
import {createActor} from './playground-actor.js';
import {createDemoUnit,poseUnitGear} from './arena-unit.js';
import {UNIT_TYPES} from './arena-rules.js';
import {kit} from './arena-kit.js';
import {createWeapons} from './arena-weapons.js';
import {SWORD_DURATIONS} from './arena-motion.js';
import {createEffects,plasmaMesh} from './arena-effects.js';
import {referenceModel} from './arena-reference.js';
import {createWorlds} from './arena-world.js';

const $=s=>document.querySelector(s),canvas=$('#world'),pane=$('#stage'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.05,200),handsScene=new THREE.Scene(),handsCamera=new THREE.PerspectiveCamera(65,1,.025,10);
camera.layers.enable(1);handsCamera.layers.enable(1);scene.background=new THREE.Color('#c8d5cb');scene.fog=new THREE.FogExp2('#c8d5cb',GRAPHICS_DEFAULTS.fog);
const sun=new THREE.DirectionalLight('#ffe6b8',2.1);sun.position.set(-13,24,13);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-26,right:26,top:24,bottom:-24,near:1,far:85});sun.shadow.bias=-.0001;sun.shadow.normalBias=.035;sun.shadow.radius=1.6;
scene.add(sun,new THREE.HemisphereLight('#e2ebdc','#83765f',1.15));const fill=new THREE.DirectionalLight('#bdced7',.35);fill.position.set(15,10,-15);scene.add(fill);
const handLight=new THREE.DirectionalLight('#ffe6b8',2.1);handLight.position.set(-3,5,4);handsScene.add(handLight,new THREE.HemisphereLight('#e2ebdc','#83765f',1.15));
const items=[],graphics={...GRAPHICS_DEFAULTS},state={selected:0,category:'all',playing:!reduced.matches,speed:1,time:0,clip:'Idle',fps:false,turn:false,preset:'default',overview:true};
const orbit={yaw:.08,pitch:.68,distance:36,target:new THREE.Vector3(0,.5,2)},timings=[];
let exhibitTime=0,renderer,paint,k,rig,fx,worlds,ready=false,last=performance.now(),drag=null,shotTime=-1,shotOrigin=new THREE.Vector3(),lost=false;
const projectile=plasmaMesh();projectile.visible=false;scene.add(projectile);
function add(name,category,root,description,extra={}){
  const index=items.length,station=new THREE.Group();station.position.set((index%5-2)*6,0,(1.5-Math.floor(index/5))*6);station.add(root);scene.add(station);
  const pedestal=k.mesh(station,new THREE.CylinderGeometry(2.4,2.55,.22,48),paint.material('#aebcad'),[0,-.12,0],[0,0,0],false);pedestal.receiveShadow=true;
  const label=document.createElement('button');label.className='asset-label';label.setAttribute('aria-label','Focus '+name);label.title=name;label.textContent=String(index+1).padStart(2,'0')+' / '+name;label.onclick=()=>select(index,true);$('#labels').append(label);
  const button=document.createElement('button');button.innerHTML=`<b>${String(index+1).padStart(2,'0')}</b><span>${name}<small>${category==='reference'?'Static painted reference':category}</small></span>`;button.onclick=()=>select(index,true);$('#assets').append(button);
  const item={name,category,root,station,description,label,button,index,...extra};items.push(item);return item;
}
function current(){return items[state.selected];}
function clipOptions(item){
  if(item.actor)return ['Idle','Walking','Running',...Object.keys(item.actor.clips).filter(n=>!['Idle','Walking','Running'].includes(n))];
  if(item.weapon)return item.weapon==='sword'?['Cut 1','Cut 2','Cut 3','Guard']:['Recoil','Vent'];
  if(item.tower)return ['Track & fire'];
  return ['Still'];
}
function duration(){const i=current();if(i?.actor)return i.actor.clips[state.clip]?.duration||1;if(i?.weapon==='sword')return SWORD_DURATIONS[Number(state.clip.slice(-1))-1]||1;if(i?.weapon==='rifle')return state.clip==='Vent'?1:.6;return 3;}
function setPlaying(value){state.playing=value;$('#play').textContent=value?'Pause':'Play';$('#play').setAttribute('aria-pressed',String(value));}
function select(index,focus=false){
  state.selected=index;const i=current();state.time=0;state.clip=clipOptions(i)[0];if(!i.weapon)setFPS(false);
  $('#asset-name').textContent=i.name;$('#asset-kind').textContent='SPECIMEN '+String(index+1).padStart(2,'0')+' / '+i.category.toUpperCase();$('#asset-description').textContent=i.description;
  $('#clip').replaceChildren(...clipOptions(i).map(name=>new Option(name,name)));$('#animation').hidden=!i.actor&&!i.weapon&&!i.tower;
  $('#motion-note').textContent=i.actor?'Authored clip · in-place inspection':i.weapon?'Actual FPS rig · windup / contact / recovery':'Articulated turret · aim / recoil';
  $('#fps').disabled=!i.weapon;$('#scrub').max=duration();if(i.weapon)rig.update(1,{weapon:i.weapon,bob:0});
  for(const item of items){item.button.setAttribute('aria-pressed',String(item===i));item.label.setAttribute('aria-pressed',String(item===i));}
  if(focus){focusCurrent();if(i.weapon)setFPS(true);}pose();
}
function focusCurrent(){const i=current();state.overview=false;orbit.target.copy(i.station.position).add(new THREE.Vector3(0,1.15,0));orbit.distance=i.category==='worlds'?10:7.6;orbit.yaw=.5;orbit.pitch=.27;}
function overview(){state.overview=true;setFPS(false);orbit.target.set(0,.5,2);orbit.yaw=.08;orbit.pitch=.68;orbit.distance=36;}
function setFPS(value){state.fps=value&&!!current()?.weapon;$('#fps').setAttribute('aria-pressed',String(state.fps));$('#view-note').textContent=state.fps?'Actual held rig · Use timeline to inspect every pose · Play loops the selected action':'Drag to orbit · Scroll to zoom · Click a label to focus';}
function applyPreset(id){if(!GRAPHICS_PRESETS[id])id='default';state.preset=id;Object.assign(graphics,GRAPHICS_PRESETS[id].graphics);if(renderer){renderer.setPixelRatio(Math.min(devicePixelRatio,2)*graphics.resolution);renderer.toneMappingExposure=graphics.exposure;}document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===id)));}
function pose(){
  if(!ready)return;
  for(const i of items){
    const selected=i===current(),t=selected?state.time:0;
    if(i.actor){const clip=selected?state.clip:({1:'Walking',2:'Running'}[i.index]||'Idle');i.actor.pose(clip,selected?t:exhibitTime);if(i.unit)poseUnitGear(i.unit,clip==='Punch'?t/(i.actor.clips.Punch.duration||1):0);}
    if(i.tower){i.tower.head.rotation.y=selected?Math.sin(t*1.1)*.65:0;i.tower.head.position.y=1.4+(selected?Math.max(0,1-(t%1.5)/.18)*.10:0);}
    if(i.world)i.world.animate(t);
  }
  const i=current();if(i.weapon){
    const cut=Math.max(0,Number(state.clip.slice(-1))-1),attack=i.weapon==='sword'&&state.clip!=='Guard'?Math.min(1,state.time/duration()):0;
    if(i.weapon==='rifle'&&state.clip==='Recoil'){rig.fire();rig.update(state.time,{weapon:'rifle',bob:0});}else rig.update(0,{weapon:i.weapon,attack,combo:cut,aim:state.clip==='Guard',vent:state.clip==='Vent'?1-state.time:0,bob:0});
    if(!state.fps){i.root.rotation.set(i.weapon==='sword'?-.12:0,i.weapon==='rifle'?-.7:0,i.weapon==='sword'?-.38:0);}
  }
  $('#scrub').value=state.time;$('#time').value=state.time.toFixed(2)+' s';
}
function effect(kind){
  const p=current().station.position.clone().add(new THREE.Vector3(0,1.5,0));
  if(kind==='beacon')fx.ring(current().station.position.clone().add(new THREE.Vector3(0,.1,0)),{radius:2.1,color:'#b3e1c0',life:.8});
  else if(kind==='blade')fx.hit(p,'#f3cc86');
  else{shotOrigin.copy(p).add(new THREE.Vector3(-2,0,0));shotTime=0;projectile.visible=true;projectile.position.copy(shotOrigin);projectile.rotation.z=-Math.PI/2;}
  setPlaying(true);
}
function advance(dt){
  if(!ready)return;exhibitTime+=dt;state.time=(state.time+dt)%duration();pose();fx.tick(dt);
  if(shotTime>=0){shotTime+=dt;projectile.position.copy(shotOrigin).add(new THREE.Vector3(shotTime*12,0,0));if(shotTime>=.33){shotTime=-1;projectile.visible=false;fx.hit(shotOrigin.clone().add(new THREE.Vector3(4,0,0)),'#a3ead6');}}
  if(state.turn)orbit.yaw+=dt*.3;
}
function draw(){
  if(!ready||lost)return;const w=pane.clientWidth,h=pane.clientHeight,dpr=renderer.getPixelRatio();if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr))renderer.setSize(w,h,false);
  camera.aspect=handsCamera.aspect=w/h;handsCamera.fov=w/h<.8?85:65;handsCamera.updateProjectionMatrix();camera.updateProjectionMatrix();
  // Narrow panels need more camera distance to retain the complete exhibition.
  const d=orbit.distance*(state.overview?Math.max(1,1.5/camera.aspect):1);camera.position.copy(orbit.target).add(new THREE.Vector3(Math.sin(orbit.yaw)*Math.cos(orbit.pitch),Math.sin(orbit.pitch),Math.cos(orbit.yaw)*Math.cos(orbit.pitch)).multiplyScalar(d));camera.lookAt(orbit.target);camera.updateMatrixWorld(true);
  for(const group of [scene,handsScene])paint.setVariant('v5',{ink:graphics.line>0,paint:true,light:'golden'},w,h,group);paint.tune(graphics);scene.fog.density=graphics.fog;fx.faceCamera(camera);
  renderer.info.reset();renderer.autoClear=true;renderer.render(scene,camera);
  if(state.fps){renderer.autoClear=false;renderer.clearDepth();renderer.render(handsScene,handsCamera);}
  for(const i of items){i.label.textContent=w<600?String(i.index+1).padStart(2,'0'):String(i.index+1).padStart(2,'0')+' / '+i.name;const p=i.station.position.clone().add(new THREE.Vector3(0,-.18,1.85)).project(camera);i.label.hidden=state.fps||!i.station.visible||p.z>1||!state.overview;i.label.style.left=(p.x*.5+.5)*w+'px';i.label.style.top=(-p.y*.5+.5)*h+'px';}
  $('#readout').textContent=`${items.filter(i=>i.station.visible).length} specimens · ${fx.active} active effects · ${Math.round(renderer.info.render.triangles/1000)}k triangles`;
}
function frame(now){requestAnimationFrame(frame);const elapsed=Math.max(0,now-last),dt=Math.min(.05,elapsed/1000);last=now;if(!ready||lost||document.hidden)return;if(state.playing){timings.push(elapsed);if(timings.length>600)timings.shift();advance(dt*state.speed);}draw();}

$('#overview').onclick=overview;$('#focus').onclick=focusCurrent;$('#fps').onclick=()=>{setFPS(!state.fps);if(state.fps)focusCurrent();};$('#turn').onclick=()=>{state.turn=!state.turn;$('#turn').setAttribute('aria-pressed',String(state.turn));};$('#play').onclick=()=>setPlaying(!state.playing);$('#step').onclick=()=>{setPlaying(false);advance(1/60);};$('#restart').onclick=()=>{state.time=0;fx.clear();projectile.visible=false;shotTime=-1;pose();};$('#speed').onchange=e=>state.speed=Number(e.target.value);$('#scrub').oninput=e=>{setPlaying(false);state.time=Number(e.target.value);pose();};$('#clip').onchange=e=>{state.clip=e.target.value;state.time=0;$('#scrub').max=duration();pose();};$('#clear-fx').onclick=()=>{fx.clear();projectile.visible=false;shotTime=-1;};$('#retry').onclick=()=>location.reload();
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>applyPreset(b.dataset.preset));document.querySelectorAll('[data-effect]').forEach(b=>b.onclick=()=>effect(b.dataset.effect));
$('#category').onchange=e=>{state.category=e.target.value;for(const i of items){i.station.visible=state.category==='all'||i.category===state.category;i.button.hidden=!i.station.visible;}if(!current().station.visible)select(items.findIndex(i=>i.station.visible));overview();};
canvas.onpointerdown=e=>{canvas.focus();drag={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(drag?.id!==e.pointerId)return;orbit.yaw-=(e.clientX-drag.x)*.008;orbit.pitch=THREE.MathUtils.clamp(orbit.pitch+(e.clientY-drag.y)*.006,.04,1.4);drag.x=e.clientX;drag.y=e.clientY;};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;canvas.onwheel=e=>{e.preventDefault();orbit.distance=THREE.MathUtils.clamp(orbit.distance*Math.exp(e.deltaY*.001),3,80);};
canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','Equal','Minus','Space','Period'].includes(e.code))return;e.preventDefault();if(e.code==='Home')overview();if(e.code==='Space')setPlaying(!state.playing);if(e.code==='Period'){$('#step').click();}if(e.code==='ArrowLeft')orbit.yaw-=.08;if(e.code==='ArrowRight')orbit.yaw+=.08;if(e.code==='ArrowUp')orbit.pitch=Math.min(1.4,orbit.pitch+.06);if(e.code==='ArrowDown')orbit.pitch=Math.max(.04,orbit.pitch-.06);if(e.code==='Equal')orbit.distance=Math.max(3,orbit.distance*.9);if(e.code==='Minus')orbit.distance=Math.min(80,orbit.distance*1.1);});
document.addEventListener('visibilitychange',()=>{last=performance.now();drag=null;});reduced.addEventListener('change',()=>{if(reduced.matches){setPlaying(false);state.turn=false;$('#turn').setAttribute('aria-pressed','false');}});

async function boot(){try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;renderer.info.autoReset=false;applyPreset(new URLSearchParams(location.search).get('preset')||'default');
  paint=await createSurfaceMaterials();k=kit(paint);fx=createEffects(scene);rig=createWeapons(paint);handsScene.add(rig.root);
  k.mesh(scene,new THREE.PlaneGeometry(160,160),paint.material('#a2b29a'),[0,-.25,0],[-Math.PI/2,0,0],false);
  const hero=await createActor(paint,{color:'#c1b388'});add('Commander','units',hero.root,'Accepted automaton rig. Fourteen authored clips, with articulated fingers and calibrated locomotion.',{actor:hero});
  for(const [index,type] of Object.values(UNIT_TYPES).entries()){const unit=await createDemoUnit(paint,type,index);add(['Blade skirmisher','Plasma ranger','Heavy guard'][index],'units',unit.actor.root,'Live demo loadout. Inspect the complete clip, including anticipation and recovery.',{actor:unit.actor,unit});}
  for(const [kind,name] of [['cannon','Bastion cannon'],['plasma','Twin plasma'],['beacon','Pulse beacon']]){const tower=k.tower(kind);add(name,'towers',tower.root,kind==='cannon'?'Articulated study: red tapered armor, dark braces, rivets, long barrel and cyan chamber. Informed by the supplied tower.':'Live demo tower assembly and animated head.',{tower});}
  $('#load-status').textContent='Loading the collaborator’s Paintline tower…';
  const tower=await referenceModel(paint,'lib/paintline/tower.gltf',2.5);add('Paintline tower','towers',tower.root,'Collaborator reference with its original UV texture. Static unrigged source, kept separate from the articulated study.',{reference:tower});
  const detail=kit(paint,{detail:true});for(const [kind,name] of [['sword','Sable edge'],['rifle','Pulse carbine']]){const model=detail.weapon(kind);model.root.position.y=kind==='sword'?.5:1.4;add(name,'weapons',model.root,'Fine surface-attached pigment, machined seams and edge wear. Held weapon opens the actual two-arm FPS rig.',{weapon:kind});}
  for(const name of ['commander','enemy','tower']){const ref=await referenceModel(paint,'lib/painted/'+name+'.gltf',2.4);add('Painted '+name,'reference',ref.root,'Earlier detailed painted study. Original textured static reference, not an animated game unit.',{reference:ref});}
  worlds=createWorlds(paint);for(const world of worlds){world.root.visible=true;world.root.scale.setScalar(.035);add(world.name,'worlds',world.root,'Miniature of the actual walkable environment, with the same geometry and material builders.',{world});}
  const target=new THREE.Group();k.mesh(target,new THREE.OctahedronGeometry(.65),k.mats.glow,[0,1.3,0]);k.mesh(target,new THREE.CylinderGeometry(.4,.6,.65,8),k.mats.stone,[0,.32,0]);add('Effects target','worlds',target,'Use the contact buttons for warm blade sparks, cool plasma streaks and a clean healing ring. Pause and frame-step to inspect.');
  ready=true;select(0);setPlaying(state.playing);$('#loading').hidden=true;draw();last=performance.now();requestAnimationFrame(frame);
  window.INK_STAGE={ready:true,state,items,graphics,rig,select,advance,draw,applyPreset,effect,setPlaying,get duration(){return duration();},get orbit(){return {yaw:orbit.yaw,pitch:orbit.pitch,distance:orbit.distance};},get metrics(){return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,effects:fx.active};},get timings(){return timings.slice();}};
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;setPlaying(false);$('#loading').hidden=false;$('#load-status').textContent='Graphics interrupted. Waiting for recovery…';});canvas.addEventListener('webglcontextrestored',()=>{lost=false;$('#loading').hidden=true;last=performance.now();});
}catch(e){window.INK_STAGE_ERROR=String(e);$('#load-status').textContent=e.message;$('#retry').hidden=false;console.error(e);}}
boot();
