import * as THREE from 'three';
import { COMMANDERS, commanderStats, MOUNTS } from './run/expedition.js';
import { preparation, savePreparation } from './preparation.js';
import { campaignStore } from './modes/campaign-store.js';
import { startExpedition } from './run/campaign.js';
import { planetDefinition } from './run/planets.js';
import { buildSoldier } from './soldier.js';
import { articulated } from './debug-world.js';
import { buildMount } from './mounts.js';
import { MAT, TOWER_TYPES, buildTowerVisual } from './towers.js';
import { makePineGeometry, makeBroadleafGeometry } from './world.js';

const el=id=>document.getElementById(id),canvas=el('lobby-view'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x637d77);scene.fog=new THREE.Fog(0x637d77,65,150);
const camera=new THREE.PerspectiveCamera(47,1,.1,250),sun=new THREE.DirectionalLight(0xffe4b3,2.7);sun.position.set(-20,50,15);scene.add(sun,new THREE.HemisphereLight(0xc8e4e0,0x3e5243,2.3));
const material=color=>new THREE.MeshStandardMaterial({color,flatShading:true,roughness:.88});
const materials={grass:material(0x637b4c),stone:material(0x81887b),wood:material(0x524a3d),trim:material(0xbbb793),roof:material(0x355e58),path:material(0xb3aa87)};
function mesh(geo,mat,x,y,z,parent=scene){const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);parent.add(o);return o;}
mesh(new THREE.CylinderGeometry(34,39,5,12),materials.grass,0,-2.55,0);
mesh(new THREE.CylinderGeometry(25,27,.45,12),materials.stone,0,-.24,0);
mesh(new THREE.CylinderGeometry(18,18,.12,12),materials.path,0,-.02,0);
for(const axis of [0,1]){const road=mesh(new THREE.BoxGeometry(6,.12,50),materials.path,0,.02,0);road.rotation.y=axis*Math.PI/2;}
for(let i=0;i<40;i++){const a=i*Math.PI/20,r=31+(i%3)*1.7;const tree=mesh(i%3?makePineGeometry():makeBroadleafGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1}),Math.sin(a)*r,0,Math.cos(a)*r);tree.scale.setScalar(2+(i%4)*.45);}
for(let i=0;i<24;i++){const a=i*Math.PI/12;const rock=mesh(new THREE.DodecahedronGeometry(1.5+(i%3)*.3,0),materials.stone,Math.sin(a)*28,0,Math.cos(a)*28);rock.scale.y=.55;}

function sign(text,x,y,z,color='#ddedcc',width=12){const c=document.createElement('canvas');c.width=1024;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle='#1f3936';ctx.fillRect(0,0,1024,160);ctx.strokeStyle='#8faba0';ctx.lineWidth=8;ctx.strokeRect(5,5,1014,150);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 55px sans-serif';ctx.fillText(text,512,82,980);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const o=mesh(new THREE.PlaneGeometry(width,width*160/1024),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}),x,y,z);return o;}
const stations=[{key:'commanders',name:'COMMANDERS',x:-18,z:-7,color:0x8bcbb2},{key:'foundry',name:'TOWER FOUNDRY',x:18,z:-7,color:0xe2ba68},{key:'mounts',name:'MOUNTS',x:-18,z:13,color:0xa6b9df},{key:'mission',name:'MISSION GATE',x:0,z:-23,color:0xc4e4cf}];
const actors=[],mountModels=[],stationHits=[];
for(const s of stations){
  s.pad=mesh(new THREE.CylinderGeometry(s.key==='mission'?6.7:7,7,.35,8),material(s.color),s.x,.18,s.z);s.pad.userData.station=s.key;stationHits.push(s.pad);
  const z=s.z-4;
  for(const x of [s.x-6,s.x+6])mesh(new THREE.BoxGeometry(.65,5.7,.65),materials.wood,x,2.85,z);
  if(s.key!=='mission'){const roof=mesh(new THREE.ConeGeometry(8,2.3,4),materials.roof,s.x,6.1,z+1);roof.rotation.y=Math.PI/4;roof.scale.z=.65;}
  else{mesh(new THREE.BoxGeometry(12.8,.9,1.6),materials.trim,s.x,6.3,z);const portal=mesh(new THREE.TorusGeometry(4,.24,6,32),new THREE.MeshStandardMaterial({color:0x9fffe1,emissive:0x57c49e,emissiveIntensity:1.4}),s.x,4,s.z-1.5);portal.scale.y=1.1;}
  const label=sign(s.name,s.x,s.key==='mission'?9.3:8.4,z+.45,s.key==='foundry'?'#efd495':'#dcf0d9');label.userData.station=s.key;stationHits.push(label);
}
const mats={body:MAT.body,trim:MAT.trim,dark:MAT.dark,gold:MAT.gemGold,energy:MAT.energy,cloth:material(0x476577)};
const heroActors={};for(const [i,key]of Object.keys(COMMANDERS).entries()){
  const actor=articulated(buildSoldier(key,mats),false,key);actor.group.scale.setScalar(2.2);actor.group.position.set(-23+i*2.5,.45,-7);scene.add(actor.group);actors.push(actor);
  const hero=articulated(buildSoldier(key,mats),false,key);hero.group.scale.setScalar(2.5);scene.add(hero.group);heroActors[key]=hero;
}
let featured=null;function featureTower(key){if(featured)scene.remove(featured);const b=buildTowerVisual(key,0);featured=b.group;featured.scale.setScalar(1.9);featured.position.set(18,.45,-6);scene.add(featured);}
featureTower('bolt');
for(const [i,key]of ['cryo','mortar'].entries()){const b=buildTowerVisual(key,0);b.group.scale.setScalar(1.2);b.group.position.set(13+i*10,.4,-8);scene.add(b.group);}
for(const [i,key]of ['strider','tideback','skyray'].entries()){const m=buildMount(key);m.group.scale.setScalar(1.7);m.group.position.set(-22+i*4,.45,13);scene.add(m.group);mountModels.push(m);}
mesh(new THREE.CylinderGeometry(2.7,3.7,.75,8),materials.trim,0,.38,0);
const heart=mesh(new THREE.OctahedronGeometry(1.45,0),new THREE.MeshStandardMaterial({color:0x9ce7ca,emissive:0x40aa91,emissiveIntensity:.75,roughness:.4}),0,2.5,0);
sign('WORLDHEART',0,1.1,3.2,'#e0f5d6',5);

mesh(new THREE.BoxGeometry(7,.7,2),materials.wood,17,.4,15);sign('EXPEDITION RECORD',17,3.1,15,'#d3e8d4',8);
sign(campaignStore.snapshot().account.planetsBeaten+' PLANETS DEFENDED',17,1.8,16.1,'#efd495',6);

let selected=preparation(),profile=campaignStore.snapshot().account,open=null,near=null,moveGoal=null;
const player=new THREE.Vector3(0,0,17),target=new THREE.Vector3(),keys=new Set(),ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0),point=new THREE.Vector3();
const view={yaw:0,distance:44,pitch:.63};let jump=0,vy=0,time=0,last=performance.now(),drag=null;
function save(){savePreparation(selected);refresh();}
function refresh(){profile=campaignStore.snapshot().account;el('coins').textContent=profile.coins+' coins';el('loadout-summary').textContent=COMMANDERS[selected.commander].name+' · '+MOUNTS[selected.mount].name+' · '+TOWER_TYPES[profile.loadout].name;el('save-status').textContent=campaignStore.status().saved?'Solo preparation · Progress saved':'Save pending. Keep this tab open and retry before launching.';}
function close(){open=null;el('station-panel').hidden=true;keys.clear();canvas.focus();}
el('close-station').onclick=close;
function openStation(key){
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
  }else{
    const e=campaignStore.snapshot().expedition,planet=planetDefinition(e?.planet||1,e?.seed||12345);
    content.innerHTML=`<p><strong>${e?planet.name:'A new galaxy awaits'}</strong><br>Solo expedition · 10 waves per planet<br>Defeat wave ten to extract or continue in Endless.</p><p>${COMMANDERS[selected.commander].name} · ${MOUNTS[selected.mount].name}<br>Opening tower: ${TOWER_TYPES[profile.loadout].name}</p>${e?'<label><input id="fresh-expedition" type="checkbox">Start a fresh expedition. Replace this route and carried arsenal; keep account coins and tower unlocks.</label>':''}<p id="mission-rule"></p><button id="launch" class="primary">${e?'Continue expedition':'Launch expedition'}</button><p>Inside your base: a fallen commander returns after 30 seconds. Outside the base: death ends the attempt.</p>`;
    const updateLaunch=()=>{const reset=el('fresh-expedition')?.checked,locked=e?.commander&&e.commander!==selected.commander&&!reset;el('launch').disabled=!!locked||!campaignStore.status().saved;el('mission-rule').textContent=locked?'This expedition follows '+COMMANDERS[e.commander].name+'. Choose that commander or start fresh.':'';};
    if(el('fresh-expedition'))el('fresh-expedition').onchange=updateLaunch;updateLaunch();
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
canvas.oncontextmenu=e=>e.preventDefault();canvas.onpointerdown=e=>{canvas.focus();canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,button:e.button};};
canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.button===2){view.yaw-=dx*.006;view.pitch=Math.max(.2,Math.min(1.2,view.pitch+dy*.005));}drag.x=e.clientX;drag.y=e.clientY;};
canvas.onpointerup=e=>{if(drag&&drag.button===0&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<6){ndc.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(ndc,camera);const hit=ray.intersectObjects(stationHits,false)[0];if(hit)openStation(hit.object.userData.station);else if(ray.ray.intersectPlane(ground,point)&&point.length()<27){close();moveGoal=point.clone();}}drag=null;};canvas.onpointercancel=()=>{drag=null;};
canvas.addEventListener('wheel',e=>{e.preventDefault();view.distance=Math.max(14,Math.min(50,view.distance*Math.exp(e.deltaY*.001)));},{passive:false});
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}addEventListener('resize',resize);resize();refresh();
const velocity=new THREE.Vector3();let disposed=false;
function render(now){
  if(disposed)return;const dt=Math.min((now-last)/1000,.04);last=now;time+=dt;
  let x=0,z=0;if(!open){x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);}
  point.set(x*Math.cos(view.yaw)+z*Math.sin(view.yaw),0,z*Math.cos(view.yaw)-x*Math.sin(view.yaw));if(moveGoal){point.copy(moveGoal).sub(player).setY(0);if(point.length()<.35){moveGoal=null;point.set(0,0,0);}}
  if(point.length()>1)point.normalize();point.multiplyScalar(7.2);velocity.lerp(point,1-Math.exp(-dt*12));player.addScaledVector(velocity,dt);if(player.length()>27)player.setLength(27);
  if(player.length()<3.5){point.copy(player).setY(0).normalize().multiplyScalar(3.5);player.copy(point);}
  vy-=dt*20;jump=Math.max(0,jump+vy*dt);if(jump===0)vy=0;
  for(const [key,hero]of Object.entries(heroActors)){hero.group.visible=key===selected.commander;if(!hero.group.visible)continue;hero.group.position.copy(player);hero.group.position.y=jump;if(velocity.length()>.12)hero.group.rotation.y=Math.atan2(-velocity.x,-velocity.z);hero.update(time,velocity.length()>.12?'walk':'idle');}
  for(const a of actors)a.update(time,'idle');for(const m of mountModels)m.update(time,.15);heart.rotation.y=time*.4;heart.position.y=2.5+Math.sin(time*1.5)*.1;
  near=null;let distance=6;for(const s of stations){const d=Math.hypot(player.x-s.x,player.z-s.z);if(d<distance){distance=d;near=s;}}
  el('approach').hidden=!near||!!open;if(near)el('interact').textContent='E · '+near.name.toLowerCase();
  target.copy(player).multiplyScalar(.45);target.y=2.5;point.set(target.x+Math.sin(view.yaw)*view.distance*Math.cos(view.pitch),target.y+Math.sin(view.pitch)*view.distance,target.z+Math.cos(view.yaw)*view.distance*Math.cos(view.pitch));camera.position.lerp(point,1-Math.exp(-dt*9));camera.lookAt(target);renderer.render(scene,camera);requestAnimationFrame(render);
}
camera.position.set(0,20,40);requestAnimationFrame(render);
window.LOBBY={scene,camera,renderer,player,stations,openStation,close,view,get selected(){return selected;},get profile(){return campaignStore.snapshot().account;}};
addEventListener('pagehide',e=>{if(!e.persisted){disposed=true;renderer.dispose();}});
