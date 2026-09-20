import { AudioEngine } from './audio.js';
import { Soundtrack } from './soundtrack.js';
import { homeworldStation } from './lobby-homes.js';
import * as THREE from 'three';
import {TouchGesture,TouchStick,bindTouchActivation,hasTouch,clamp} from './touch-input.js';
import { COMMANDERS, commanderStats, MOUNTS } from './run/expedition.js';
import { preparation, savePreparation } from './preparation.js';
import { campaignStore } from './modes/campaign-store.js';
import { startExpedition } from './run/campaign.js';
import { planetDefinition } from './run/planets.js';
import { buildSoldier } from './soldier.js';
import { articulated } from './debug-world.js';
import { buildMount } from './mounts.js';
import { MAT, TOWER_TYPES, buildTowerVisual } from './towers.js';
import {buildLobbyCourtyard} from './lobby-scene.js';
import {weaponStation} from './lobby-weapons.js';
import {productionPaint} from './production-paint.js';

const el=id=>document.getElementById(id),canvas=el('lobby-view'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xb4c9c3);scene.fog=new THREE.Fog(0xb4c9c3,95,190);
const camera=new THREE.PerspectiveCamera(47,1,.1,250),sun=new THREE.DirectionalLight(0xffe4b3,2.2);sun.position.set(-20,50,15);scene.add(sun,new THREE.HemisphereLight(0xc8e4e0,0x3e5243,1.5));
const courtyard=buildLobbyCourtyard(scene),{material,stations,stationHits,colliders}=courtyard;
const actors=[],mountModels=[];
const mats={body:MAT.body,trim:MAT.trim,dark:MAT.dark,gold:MAT.gemGold,energy:MAT.energy,cloth:material(0x476577)};
const heroActors={};for(const [i,key]of Object.keys(COMMANDERS).entries()){
  const actor=articulated(buildSoldier(key,mats),false,key);actor.group.scale.setScalar(2.2);actor.group.position.set(-32+i*2.5,.45,-20);scene.add(actor.group);actors.push(actor);
  const hero=articulated(buildSoldier(key,mats),false,key);hero.group.scale.setScalar(1.8);scene.add(hero.group);heroActors[key]=hero;
}
let featured=null;function featureTower(key){if(featured)scene.remove(featured);const b=buildTowerVisual(key,0);featured=b.group;featured.scale.setScalar(1.7);featured.position.set(27,.45,-19);scene.add(featured);}
featureTower('bolt');
for(const [i,key]of ['cryo','mortar'].entries()){const b=buildTowerVisual(key,0);b.group.scale.setScalar(1.2);b.group.position.set(21+i*12,.4,-21);scene.add(b.group);}
for(const [i,key]of ['strider','tideback','skyray'].entries()){const m=buildMount(key);m.group.scale.setScalar(1.7);m.group.position.set(-35+i*4,.45,11);scene.add(m.group);mountModels.push(m);}
const paint=await productionPaint(renderer);paint.apply(scene);
let selected=preparation(),profile=campaignStore.snapshot().account,open=null,near=null,moveGoal=null;
let lobbyStick=null,lobbyGesture=null;
const touchMove={x:0,y:0};
const player=new THREE.Vector3(0,0,25),target=new THREE.Vector3(),keys=new Set(),ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0),point=new THREE.Vector3();
const view={yaw:0,distance:11,pitch:.26};let jump=0,vy=0,time=0,last=performance.now(),drag=null;
function save(){savePreparation(selected);refresh();}
function refresh(){profile=campaignStore.snapshot().account;el('coins').textContent=profile.coins+' coins';el('loadout-summary').textContent=COMMANDERS[selected.commander].name+' · '+MOUNTS[selected.mount].name+' · '+TOWER_TYPES[profile.loadout].name;el('save-status').textContent=campaignStore.status().saved?'Solo preparation · Progress saved':'Save pending. Keep this tab open and retry before launching.';}
function close(){open=null;el('station-panel').hidden=true;keys.clear();document.body.classList.remove('station-open');lobbyStick?.reset();canvas.focus();}
el('close-station').onclick=close;
function openStation(key){
  const freshRequested=key==='mission';
  key=stations.find(s=>s.key===key)?.action||key;
  lobbyStick?.reset();lobbyGesture?.cancel();document.body.classList.add('station-open');document.body.classList.remove('stations-open');el('lobby-prepare')?.setAttribute('aria-expanded','false');
  open=key;keys.clear();moveGoal=null;el('station-panel').hidden=false;el('station-message').textContent='';el('station-title').textContent=stations.find(s=>s.key===key).name.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
  const content=el('station-content');
  if(key==='commanders'){
    content.innerHTML='<p>Choose who leads your next expedition. Base levels improve health, power, movement and weapon range.</p><div class="choices">'+Object.entries(COMMANDERS).map(([k,c])=>{const s=commanderStats(k);return `<button class="choice" data-commander="${k}" aria-pressed="${selected.commander===k}"><strong>${c.name}</strong><span>${c.role}<br>${s.health} health · ${s.power.toFixed(2)}x power · ${s.speed.toFixed(2)}x speed</span></button>`;}).join('')+'</div>';
    for(const b of content.querySelectorAll('[data-commander]'))b.onclick=()=>{selected.commander=b.dataset.commander;save();openStation(key);};
  }else if(key==='mounts'){
    content.innerHTML='<p>Every commander can ride. Your commander speed bonus also applies while mounted. Press M on a planet to mount or dismount.</p><div class="choices">'+Object.entries(MOUNTS).map(([k,m])=>`<button class="choice" data-mount="${k}" aria-pressed="${selected.mount===k}"><strong>${m.name}</strong><span>${m.description}</span></button>`).join('')+'</div>';
    for(const b of content.querySelectorAll('[data-mount]'))b.onclick=()=>{selected.mount=b.dataset.mount;save();openStation(key);};
  }else if(key==='foundry'){
    const pool=Object.keys(TOWER_TYPES).filter(k=>!profile.towers.includes(k));
    content.innerHTML=`<p>Spend 60 earned wave coins to discover a random unowned tower. Every remaining tower has the same chance. No duplicates.</p><button class="primary" id="roll-tower" ${profile.coins<60||!pool.length?'disabled':''}>${pool.length?'Discover tower · 60 coins':'Collection complete'}</button><p>${pool.length?'Pool: '+pool.map(k=>TOWER_TYPES[k].name).join(', ')+'. '+(100/pool.length).toFixed(1)+'% each.':'All six tower families are available.'}</p><h3>Opening tower</h3><p>Your chosen card starts the run. Owned towers can appear in later draws.</p><div class="choices">${profile.towers.map(k=>`<button class="choice" data-tower="${k}" aria-pressed="${profile.loadout===k}"><strong>${TOWER_TYPES[k].name}</strong><span>${TOWER_TYPES[k].desc}</span></button>`).join('')}</div>`;
    for(const b of content.querySelectorAll('[data-tower]'))b.onclick=()=>{campaignStore.commit(s=>{if(!s.account.towers.includes(b.dataset.tower))return false;s.account.loadout=b.dataset.tower;return true;});featureTower(b.dataset.tower);refresh();openStation(key);};
    el('roll-tower').onclick=()=>{
      const random=crypto.getRandomValues(new Uint32Array(1))[0]/0x100000000;
      const result=campaignStore.commit(s=>{const available=Object.keys(TOWER_TYPES).filter(k=>!s.account.towers.includes(k));if(s.account.coins<60||!available.length)return false;const tower=available[Math.floor(random*available.length)];s.account.coins-=60;s.account.towers.push(tower);return tower;});
      refresh();openStation(key);if(result.ok){featureTower(result.value);el('station-message').textContent='Discovered '+TOWER_TYPES[result.value].name+'. Choose it below to make it your opening card.';}
    };
  }else if(key==='homeworld'){
    homeworldStation(content,el('station-message'),()=>openStation('homeworld'));
  }else if(key==='weapons'){
    weaponStation(content,el('station-message'));
  }else{
    const e=campaignStore.snapshot().expedition,planet=planetDefinition(e?.planet||1,e?.seed||12345);
    content.innerHTML=`<p><strong>${e?planet.name:'A new galaxy awaits'}</strong><br>Solo expedition · 10 waves per planet<br>Defeat wave ten to extract or continue in Endless.</p><p>${COMMANDERS[selected.commander].name} · ${MOUNTS[selected.mount].name}<br>Opening tower: ${TOWER_TYPES[profile.loadout].name}</p>${e?'<label><input id="fresh-expedition" type="checkbox">Start a fresh expedition. Replace this route and carried arsenal; keep account coins and tower unlocks.</label>':''}<p id="mission-rule"></p><button id="launch" class="primary">${e?'Continue expedition':'Launch expedition'}</button><p>Inside your base: a fallen commander returns after 30 seconds. Outside the base: death ends the attempt.</p>`;
    const updateLaunch=()=>{const reset=el('fresh-expedition')?.checked,locked=e?.commander&&e.commander!==selected.commander&&!reset;el('launch').textContent=reset||!e?'Launch expedition':'Continue expedition';el('launch').disabled=!!locked||!campaignStore.status().saved;el('mission-rule').textContent=locked?'This expedition follows '+COMMANDERS[e.commander].name+'. Choose that commander or start fresh.':'';};
    if(el('fresh-expedition')){el('fresh-expedition').checked=freshRequested;el('fresh-expedition').onchange=updateLaunch;}updateLaunch();
    el('launch').onclick=()=>{
      if(!campaignStore.status().saved){el('station-message').textContent='Save the checkpoint before launching.';return;}
      if(!e||el('fresh-expedition')?.checked){const seed=crypto.getRandomValues(new Uint32Array(1))[0]||12345;const r=campaignStore.commit(s=>startExpedition(s,{seed,limit:99}));if(!r.ok||!r.saved){refresh();return;}}
      const url=new URL('./',location.href);url.searchParams.set('map','ninetynine');url.searchParams.set('campaign','1');url.searchParams.set('commander',selected.commander);url.searchParams.set('mount',selected.mount);location.href=url.href;
    };

  }
}
for(const b of document.querySelectorAll('[data-station]'))b.onclick=()=>{const s=stations.find(s=>s.key===b.dataset.station);player.set(s.x,0,s.z+5);openStation(s.key);};
el('interact').onclick=()=>{if(near)openStation(near.key);};
addEventListener('keydown',e=>{if(e.target?.matches('input,select,textarea'))return;if(e.code==='Escape'){close();return;}if(e.code==='KeyE'&&near&&!e.repeat){openStation(near.key);return;}if(open)return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);moveGoal=null;if(e.code==='Space'&&jump===0)vy=7;});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();drag=null;});
canvas.oncontextmenu=e=>e.preventDefault();canvas.onpointerdown=e=>{if(e.pointerType==='touch')return;canvas.focus();canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,button:e.button};};
canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.button===2){view.yaw-=dx*.006;view.pitch=Math.max(.2,Math.min(1.2,view.pitch+dy*.005));}drag.x=e.clientX;drag.y=e.clientY;};
const inCourtyard=p=>Math.abs(p.x)<40&&p.z>-41&&p.z<34;
canvas.onpointerup=e=>{if(drag&&drag.button===0&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<6){ndc.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(ndc,camera);const hit=ray.intersectObjects(stationHits,false)[0];if(hit)openStation(hit.object.userData.station);else if(ray.ray.intersectPlane(ground,point)&&inCourtyard(point)){close();moveGoal=point.clone();}}drag=null;};canvas.onpointercancel=()=>{drag=null;};
canvas.addEventListener('wheel',e=>{e.preventDefault();view.distance=clamp(view.distance*Math.exp(e.deltaY*.001),5,22);},{passive:false});
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}addEventListener('resize',resize);resize();refresh();
const touchHud=document.createElement('div');touchHud.id='lobby-touch';
touchHud.innerHTML='<div id="lobby-stick" class="touch-stick" role="group" aria-label="Movement joystick"><span class="touch-stick-thumb"></span><small>Move</small></div><button id="lobby-jump">Jump</button>';
document.body.append(touchHud);
const prepare=document.createElement('button');prepare.id='lobby-prepare';prepare.textContent='Prepare';prepare.setAttribute('aria-expanded','false');
prepare.onclick=()=>{const on=document.body.classList.toggle('stations-open');prepare.setAttribute('aria-expanded',String(on));};document.body.append(prepare);
const useTouch=()=>{document.body.classList.add('lobby-touch');canvas.setAttribute('aria-label','Drag to look. Pinch to zoom. Tap ground to walk or use the movement joystick. Prepare opens all stations.');document.querySelector('footer p').textContent='Drag to look · Pinch to zoom · Tap to walk · Prepare for stations';};
if(hasTouch())useTouch();
bindTouchActivation(document,()=>document.body.classList.contains('lobby-touch'));
lobbyStick=new TouchStick(el('lobby-stick'),(x,y)=>{touchMove.x=x;touchMove.y=y;if(x||y)moveGoal=null;},()=>!open,{floating:true});
lobbyGesture=new TouchGesture(canvas,{accept:()=>!open,start:useTouch,
  drag:(dx,dy)=>{view.yaw-=dx*.006;view.pitch=clamp(view.pitch+dy*.005,.2,1.2);},
  pinch:zoom=>{view.distance=clamp(view.distance*Math.exp(zoom),5,22);},
  tap:(x,y)=>{ndc.set(x/innerWidth*2-1,-y/innerHeight*2+1);ray.setFromCamera(ndc,camera);const hit=ray.intersectObjects(stationHits,false)[0];if(hit)openStation(hit.object.userData.station);else if(ray.ray.intersectPlane(ground,point)&&inCourtyard(point))moveGoal=point.clone();}
});
el('lobby-jump').onclick=()=>{if(!open&&jump===0)vy=7;};
const releaseTouch=()=>{lobbyStick.reset();lobbyGesture.cancel();keys.clear();moveGoal=null;};
for(const name of ['blur','resize','pagehide'])addEventListener(name,releaseTouch);
document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseTouch();});
const velocity=new THREE.Vector3();let disposed=false;
function render(now){
  if(disposed)return;const dt=Math.min((now-last)/1000,.04);last=now;time+=dt;
  let x=0,z=0;if(!open){x=touchMove.x+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);z=-touchMove.y+(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);}
  point.set(x*Math.cos(view.yaw)+z*Math.sin(view.yaw),0,z*Math.cos(view.yaw)-x*Math.sin(view.yaw));if(moveGoal){point.copy(moveGoal).sub(player).setY(0);if(point.length()<.35){moveGoal=null;point.set(0,0,0);}}
  if(point.length()>1)point.normalize();point.multiplyScalar(7.2);velocity.lerp(point,1-Math.exp(-dt*12));player.addScaledVector(velocity,dt);player.x=clamp(player.x,-40,40);player.z=clamp(player.z,-41,34);
  for(const c of colliders){const dx=player.x-c.x,dz=player.z-c.z,px=c.w/2+.5-Math.abs(dx),pz=c.d/2+.5-Math.abs(dz);if(px>0&&pz>0){if(px<pz)player.x+=Math.sign(dx||1)*px;else player.z+=Math.sign(dz||1)*pz;}}
  if(Math.hypot(player.x,player.z-15)<3.8){point.set(player.x,0,player.z-15).normalize().multiplyScalar(3.8);player.set(point.x,0,point.z+15);}
  vy-=dt*20;jump=Math.max(0,jump+vy*dt);if(jump===0)vy=0;
  for(const [key,hero]of Object.entries(heroActors)){hero.group.visible=key===selected.commander;if(!hero.group.visible)continue;hero.group.position.copy(player);hero.group.position.y=jump;if(velocity.length()>.12)hero.group.rotation.y=Math.atan2(-velocity.x,-velocity.z);hero.update(time,velocity.length()>.12?'walk':'idle');}
  for(const a of actors)a.update(time,'idle');for(const m of mountModels)m.update(time,.15);courtyard.update(time);
  near=null;let distance=6;for(const s of stations){const d=Math.hypot(player.x-s.x,player.z-s.z);if(d<distance){distance=d;near=s;}}
  el('approach').hidden=!near||!!open;if(near)el('interact').textContent='E · '+near.name.toLowerCase();
  target.copy(player);target.y=2.5+jump*.5;point.set(target.x+Math.sin(view.yaw)*view.distance*Math.cos(view.pitch),target.y+Math.sin(view.pitch)*view.distance,target.z+Math.cos(view.yaw)*view.distance*Math.cos(view.pitch));camera.position.lerp(point,1-Math.exp(-dt*9));camera.lookAt(target);paint.update(time,scene);renderer.render(scene,camera);requestAnimationFrame(render);
}
if(location.hash==='#homeworld')openStation('homeworld');
camera.position.set(0,6,36);requestAnimationFrame(render);
window.LOBBY={scene,camera,renderer,player,stations,openStation,close,view,get selected(){return selected;},get profile(){return campaignStore.snapshot().account;}};
addEventListener('pagehide',e=>{if(!e.persisted){disposed=true;renderer.dispose();}});

const lobbySoundtrack = new Soundtrack(new AudioEngine(), () => ({ lobby: true }));
lobbySoundtrack.controls(document.querySelector('header .account'));
window.lobbySoundtrack = lobbySoundtrack;

// Opening presentation is independent of campaign saves and can be replayed.
const {playOpening,showStory}=await import('./first-expedition.js');
const replayOpening=document.createElement('button');replayOpening.className='first-replay';replayOpening.textContent='Replay opening';
replayOpening.onclick=async()=>{keys.clear();moveGoal=null;await playOpening({replay:true});await showStory();};
document.querySelector('header .account').append(replayOpening);
if(!campaignStore.snapshot().expedition||new URLSearchParams(location.search).get('onboarding')==='1')void playOpening();
