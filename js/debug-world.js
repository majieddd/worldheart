import * as THREE from 'three';
import {TOWER_TYPES,AUTHORED_TIERS,buildTowerVisual,tierStats,MAT,TOWER_SCALE} from './towers.js';
import {ALLY_TYPES} from './allies.js';
import {ENEMY_TYPES,buildEnemyModel} from './enemies.js';
import {buildSoldier,poseSoldier,freshSoldierState} from './soldier.js';
import {buildWeapon,weaponAppearanceMaterial} from './weapon-model.js';
import {FAMILIES,ERAS,PARTS,validPart} from './run/weapons.js';
import {PALETTE} from './config.js';
import {LANDFORM_RECIPES} from './terrain/recipes.js';
import {formationSample} from './terrain/samples.js';
import {BIOME_VISUALS,THEME_SURFACES,paintBiome,biomeDressingGeometry} from './biome-visuals.js';
import {PLANET_THEMES} from './run/planet-environments.js';
import {makePineGeometry,makeBroadleafGeometry,makeCactusGeometry} from './world.js';
import {animationClip} from './debug-animation.js';
import {miniaturePlanet,MINIATURE_SEED} from './debug-planets.js';

const SCALE=.2;
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.65,flatShading:true,...extra});
const modelMats=()=>({body:MAT.body,trim:MAT.trim,dark:MAT.dark,grip:mat(0x755744),gold:MAT.gemGold,energy:MAT.energy,cloth:mat(0x385e75)});
const waitFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));

function articulated(build,isEnemy,key){
  const group=new THREE.Group(),skeleton=isEnemy?build.skel:build.skeleton,bindings=[];
  for(const part of build.parts){
    const attachments=isEnemy?part.on.map(([name,off])=>({joint:skeleton.get(name),off})):part.at;
    for(const at of attachments){const mesh=new THREE.Mesh(part.geo,part.mat);mesh.matrixAutoUpdate=false;group.add(mesh);bindings.push({mesh,...at});}
  }
  const type=(isEnemy?ENEMY_TYPES:ALLY_TYPES)[key],state=freshSoldierState(),clip={},root=new THREE.Matrix4();
  const unit={type,phase:0,hop:0,airT:0,vertVel:0,flashT:0,swingT:0,swingDur:.85,heat:0,hopPrev:0,plates:4,alt:type.flying?1:0};
  const context={t:0,phase:0,gait:0,move:0,wind:0,strike:1,lunge:0,flinch:0,stun:0,shield:0,turn:0,dying:0,scale:1};
  function update(t,motion){
    animationClip(t,motion,isEnemy,clip);
    const name=clip.name,local=clip.local,k=clip.strength,walk=name==='walk'||name==='sprint'||name==='strafe'?k:0;
    group.userData.animation=name;root.identity();
    skeleton.reset();
    if(isEnemy){
      const strikeTime=local%type.swing;
      context.t=t;context.gait=t*.65;context.move=walk;
      context.wind=name==='attack'&&strikeTime<type.wind?strikeTime/type.wind:0;
      context.strike=name==='attack'&&strikeTime>=type.wind?Math.min(1,(strikeTime-type.wind)/.25):1;
      context.lunge=Math.sin(context.strike*Math.PI);
      context.flinch=name==='hurt'?k*(1-local/2.4):0;
      context.stun=name==='stun'?k:0;context.shield=name==='shield'?k:0;
      context.turn=name==='turn'?Math.sin(local*3)*k:0;
      context.dying=name==='collapse'?Math.min(1,local/1.1)*k:0;
      build.pose(unit,context);
    }else{
      state.moveT=walk;state.sprint=name==='sprint';state.strafeT=name==='strafe'?Math.sin(local*3)*k:0;state.gaitT=t*(state.sprint?9:7);
      const jump=name==='jump'&&local<.95;
      unit.airT=jump?local:0;unit.vertVel=jump?Math.cos(local/.95*Math.PI):0;
      unit.hop=jump?Math.sin(local/.95*Math.PI)*.65:0;root.makeTranslation(0,unit.hop,0);
      state.landT=name==='jump'&&local>=.95?Math.max(0,.28-(local-.95)):0;
      unit.flashT=name==='hurt'?.1*k*Math.max(0,1-local/1.2):0;
      unit.swingT=name==='attack'&&local%1.2<.85?.85-local%1.2:0;
      unit.swingSide=Math.floor(local/1.2)%2?-1:1;unit.beamOn=name==='attack'&&k>.1;unit.heat=unit.beamOn?k*.7:0;
      poseSoldier(skeleton,build.spec,unit,state,t);
    }
    skeleton.compute(root);for(const b of bindings)b.mesh.matrix.multiplyMatrices(b.joint.world,b.off);
  }
  update(0,'still');return {group,update};
}

function weaponExhibit(assembly){
  // Held weapons point below their local origin. Lift the complete assembly
  // above the plinth, then wrap it so lane placement cannot erase that lift.
  assembly.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(assembly),center=bounds.getCenter(new THREE.Vector3());
  assembly.position.set(-center.x,.65-bounds.min.y,-center.z);
  const group=new THREE.Group();group.add(assembly);
  group.userData.focusY=.65+(bounds.max.y-bounds.min.y)/2;return group;
}

function terrainTile(type,seed){
  const sample=formationSample(type,seed),n=type==='grand'||type==='labyrinth'?100:64,half=sample.half;
  const geo=new THREE.PlaneGeometry(half*2*SCALE,half*2*SCALE,n,n);geo.rotateX(-Math.PI/2);
  const p=geo.attributes.position;let low=0,high=0;
  for(let i=0;i<p.count;i++){const h=sample.height(p.getX(i)/SCALE,p.getZ(i)/SCALE);p.setY(i,h*SCALE);low=Math.min(low,h);high=Math.max(high,h);}
  geo.computeVertexNormals();const flat=geo.toNonIndexed();geo.dispose();
  const colors=[],c=new THREE.Color(),pos=flat.attributes.position;
  for(let i=0;i<pos.count;i+=3){
    const h=(pos.getY(i)+pos.getY(i+1)+pos.getY(i+2))/3/SCALE;
    const slope=1-Math.abs(flat.attributes.normal.getY(i));
    paintBiome(c,h>3||h<-.8?'desert':'meadow',h,slope,.5);
    if(h>3)c.lerp(new THREE.Color(0x937765),.45+.15*Math.sin(h*.6));
    for(let k=0;k<3;k++)colors.push(c.r,c.g,c.b);
  }
  flat.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));flat.computeVertexNormals();
  const group=new THREE.Group();group.add(new THREE.Mesh(flat,mat(0xdce8e8,{vertexColors:true})));
  // Vertical cut edges expose depth below the shared floor without a water
  // sheet hiding the sample. The actual globe applies its coastline mask.
  const wall=[];
  for(let side=0;side<4;side++)for(let i=0;i<n;i++){
    const at=j=>{const a=-half+2*half*j/n;return side===0?[a,-half]:side===1?[half,a]:side===2?[-a,half]:[-half,-a];};
    const a=at(i),b=at(i+1),ay=sample.height(...a)*SCALE,by=sample.height(...b)*SCALE,bottom=Math.min(-2,low*SCALE-1);
    wall.push(a[0]*SCALE,ay,a[1]*SCALE,b[0]*SCALE,by,b[1]*SCALE,a[0]*SCALE,bottom,a[1]*SCALE,
      b[0]*SCALE,by,b[1]*SCALE,b[0]*SCALE,bottom,b[1]*SCALE,a[0]*SCALE,bottom,a[1]*SCALE);
  }
  const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(wall,3));wg.computeVertexNormals();group.add(new THREE.Mesh(wg,mat(0x4c4e55,{side:THREE.DoubleSide})));
  return {group,low,high,width:half*2*SCALE,seed};
}

function biomeTile(key,theme=null){
  const group=new THREE.Group(),v=BIOME_VISUALS[key],color=new THREE.Color();
  const geo=new THREE.PlaneGeometry(24,24,20,20);geo.rotateX(-Math.PI/2);const p=geo.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,key==='ocean'?-1.2:.45*Math.sin(p.getX(i)*.3)*Math.cos(p.getZ(i)*.4));
  geo.computeVertexNormals();const g=geo.toNonIndexed();geo.dispose();const colors=[];
  for(let i=0;i<g.attributes.position.count;i++){paintBiome(color,key,0,0,.5);colors.push(color.r,color.g,color.b);}
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));group.add(new THREE.Mesh(g,mat(0xdce8e8,{vertexColors:true})));
  let kind=v.decor;
  if(theme==='oceanic')kind='coral';
  const make=kind==='pine'?makePineGeometry:kind==='leaf'||kind==='jungle'?makeBroadleafGeometry:kind==='cactus'?makeCactusGeometry:()=>biomeDressingGeometry(kind);
  const dressing=make(),material=mat(0xdce8e8,{vertexColors:true,emissive:key==='twilight'?0x497a6a:0x18232b,emissiveIntensity:.2});
  const count=kind==='jungle'?25:kind==='leaf'?8:12;
  for(let i=0;i<count;i++){const prop=new THREE.Mesh(dressing,material),a=i*2.39996,r=2+Math.sqrt(i/count)*7;
    prop.position.set(Math.cos(a)*r,.2,Math.sin(a)*r);prop.rotation.y=a;prop.scale.setScalar(kind==='jungle'?3.2:1.2+(i%3)*.2);group.add(prop);}
  if(key==='ocean'||theme){
    const w=new THREE.Mesh(new THREE.PlaneGeometry(theme?5:24,24),mat(theme?THEME_SURFACES[theme].shore:BIOME_VISUALS.ocean.color,{transparent:true,opacity:.76,roughness:.22}));
    w.rotation.x=-Math.PI/2;w.position.set(theme?9.5:0,.5,0);group.add(w);
  }
  return group;
}

export async function startDebugWorld(){
  const el=id=>document.getElementById(id),viewport=el('viewport'),labels=el('labels');
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x152334);viewport.prepend(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.1,2500);
  scene.add(new THREE.HemisphereLight(0xdbecff,0x566276,2.4));
  const sun=new THREE.DirectionalLight(0xffedcf,3);sun.position.set(100,180,70);scene.add(sun);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(2300,700),mat(0x1d3040));floor.rotation.x=-Math.PI/2;floor.position.set(700,-12,160);scene.add(floor);
  const lanes=[['units','Units'],['towers','Towers'],['weapons','Weapons'],['formations','Land formations'],['biomes','Biomes'],['themes','Planet themes']].map(([key,name],i)=>({key,name,z:i*90,items:[],width:0}));
  const exhibits=[],animated=[],target=new THREE.Vector3(),view={yaw:.65,pitch:.65,distance:40},reduced=matchMedia('(prefers-reduced-motion: reduce)');let selected=null,time=0,last=performance.now(),disposed=false;
  function add(lane,key,name,group,description,metrics={},width=30,update=null){
    const x=lane.width+width/2;lane.width+=width+8;group.position.set(x,0,lane.z);scene.add(group);
    if(['units','towers','weapons'].includes(lane.key)){
      const pad=new THREE.Mesh(new THREE.BoxGeometry(width-2,.5,18),mat(0x344a5b));pad.position.set(x,-.3,lane.z);scene.add(pad);
    }
    const label=document.createElement('div');label.className='label';label.textContent=name;labels.append(label);
    const item={lane:lane.key,key,name,group,description,metrics,width,x,z:lane.z,label};lane.items.push(item);exhibits.push(item);if(update)animated.push({item,update});return item;
  }
  for(const lane of lanes){
    el('status').textContent=`Building ${lane.name.toLowerCase()}…`;await waitFrame();
    if(lane.key==='units'){
      for(const [key,type]of Object.entries(ALLY_TYPES)){
        const b=articulated(buildSoldier(key,modelMats()),false,key);b.group.scale.setScalar(4);
        add(lane,key,type.name,b.group,'Production commander or Warden rig, with its native weapon and shared animation.',{Scale:'4x',Role:key},18,b.update);
      }
      for(const [key,type]of Object.entries(ENEMY_TYPES)){
        const m={body:mat(PALETTE.voidBody),plate:mat(PALETTE.voidPlate),glow:mat(PALETTE.voidEmissive,{emissive:PALETTE.voidEmissive,emissiveIntensity:.8})};
        const b=articulated(buildEnemyModel(key,m),true,key);b.group.scale.setScalar(4);if(type.flying)b.group.position.y=4;
        const item=add(lane,key,type.name,b.group,'Production articulated enemy rig. The Colossus is also the base model for campaign boss variants.',{Scale:'4x',Movement:type.flying?'Flying':'Ground'},18,b.update);if(type.flying)item.group.position.y=4;
      }
    }
    if(lane.key==='towers')for(const [key,type]of Object.entries(TOWER_TYPES))for(let tier=0;tier<AUTHORED_TIERS;tier++){
      const b=buildTowerVisual(key,tier);b.group.scale.setScalar(4*TOWER_SCALE);const s=tierStats(key,tier);
      add(lane,`${key}-${tier}`,`${type.name} · Mk ${tier+1}`,b.group,'Production authored tower model. Higher upgrades retain the third silhouette and continue statistical progression.',{Range:`${s.range.toFixed(2)} m`,Scale:'4x',Tier:tier+1},22);
    }
    if(lane.key==='weapons')for(const [key,family]of Object.entries(FAMILIES))for(const era of ERAS){
      const mats=modelMats(),b=buildWeapon(family.visual,era,mats),group=new THREE.Group();for(const p of b.parts){const mesh=new THREE.Mesh(p.geo,weaponAppearanceMaterial(mats,p.mat,{era,core:'tempered'}));mesh.userData.energy=p.mat===mats.energy;group.add(mesh);}group.rotation.x=-.4;group.rotation.y=-.6;group.scale.setScalar(4);
      const item=add(lane,`${key}-${era}`,`${family.name} · ${era}`,weaponExhibit(group),'Shared held, loot and soldier weapon geometry. Core selection previews the actual energy tint; stat-only grip/head rolls do not add separate models.',{Family:family.kind,Era:era,Scale:'4x'},18);
      item.weapon={family:key,era,mats,core:'tempered'};
    }
    if(lane.key==='weapons')for(const [key,name]of [['duelist','Native twin swords'],['oracle','Native beam staff']]){
      const build=buildSoldier(key,modelMats()),b=articulated(build,false,key);b.update(0,'still');const group=new THREE.Group();
      for(const part of build.parts)for(const at of part.at)if(['weaponR','weaponL'].includes(at.joint.name)){const mesh=new THREE.Mesh(part.geo,part.mat);mesh.applyMatrix4(new THREE.Matrix4().multiplyMatrices(at.joint.world,at.off));group.add(mesh);}
      group.scale.setScalar(4);add(lane,`native-${key}`,name,weaponExhibit(group),'Native commander equipment from the soldier builder. Separate from the four loot families.',{Source:ALLY_TYPES[key].name,Scale:'4x'},18);
    }
    if(lane.key==='formations')for(const [key,recipe]of Object.entries(LANDFORM_RECIPES)){
      const sample=terrainTile(key,771);add(lane,key,recipe.label,sample.group,'An isolated sample of the real spherical formation field. Terrain dimensions retain a common 1:5 display scale. Inward cuts are dry in this exhibit.',{Peak:`${sample.high.toFixed(1)} m`,Depth:`${(-sample.low).toFixed(1)} m`,Width:`${(sample.width/SCALE).toFixed(0)} m`,Seed:sample.seed},sample.width+4);
      await waitFrame();
    }
    if(lane.key==='biomes')for(const [key,b]of Object.entries(BIOME_VISUALS))add(lane,key,b.name,biomeTile(key),'Production biome palette and scenery geometry on a flat sample plot.',{Dressing:b.decor},28);
    if(lane.key==='themes')for(const [key,theme]of Object.entries(PLANET_THEMES))if(key!=='auto'){
      const s=THEME_SURFACES[key],group=miniaturePlanet(key),sample=group.userData.miniature;
      const item=add(lane,key,theme.name,group,`${s.note} A miniature of the production terrain field with its biome belts, formations and scenery.`,{Biomes:Object.keys(sample.biomes).length,Formations:sample.formations.length,Peak:`${sample.max.toFixed(0)} m`,Depth:`${(-sample.min).toFixed(0)} m`,Seed:sample.seed},32);
      item.planet=key;
      animated.push({item,update:t=>{group.children[0].rotation.y=t*.09;}});await waitFrame();
    }
    const strip=new THREE.Mesh(new THREE.PlaneGeometry(lane.width,2),mat(0x4e7588));strip.rotation.x=-Math.PI/2;strip.position.set(lane.width/2,-.5,lane.z+22);scene.add(strip);
    lane.label=document.createElement('div');lane.label.className='label lane-title';lane.label.textContent=`${lane.name} / ${lane.items.length}`;labels.append(lane.label);
  }
  function frame(){
    camera.position.set(target.x+Math.sin(view.yaw)*Math.cos(view.pitch)*view.distance,target.y+Math.sin(view.pitch)*view.distance,target.z+Math.cos(view.yaw)*Math.cos(view.pitch)*view.distance);camera.lookAt(target);
  }
  function focus(item){
    target.set(item.x,item.lane==='themes'?15:item.group.userData.focusY??Math.max(item.lane==='units'?3:0,Number.parseFloat(item.metrics.Peak||0)*SCALE*.25),item.z);
    view.distance=item.lane==='weapons'?17:item.lane==='units'?25:Math.max(25,item.width*1.7);
    if(item.lane==='themes'){
      const radius=10+item.group.userData.miniature.max/24+.6,angle=Math.atan(Math.tan(camera.fov*Math.PI/360)*Math.min(1,camera.aspect));
      view.distance=Math.max(40,radius/Math.sin(angle)*1.08);
    }
    view.pitch=item.lane==='themes'?.3:.65;frame();
  }
  function select(laneKey,key,hash=true){
    const lane=lanes.find(x=>x.key===laneKey)||lanes[0];selected=lane.items.find(x=>x.key===key)||lane.items[0];
    el('exhibit').replaceChildren(...lane.items.map(item=>{const o=new Option(item.name,item.key);o.selected=item===selected;return o;}));
    for(const b of el('lanes').children)b.setAttribute('aria-current',String(b.dataset.lane===lane.key));
    el('name').textContent=selected.name;el('description').textContent=selected.description;
    el('metrics').innerHTML=Object.entries(selected.metrics).map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('');
    el('core').disabled=!selected.weapon;
    el('core').value=selected.weapon?.core||'tempered';
    if(selected.planet){const a=document.createElement('a');a.textContent='Explore a complete planet';a.href=`./?map=ninetynine&campaign=0&worldgen=1&terrain=varied&seed=${MINIATURE_SEED}&planet=${selected.planet}`;a.target='_blank';a.rel='noopener';el('description').append(document.createElement('br'),a);}
    el('status').textContent=`${lane.name}: ${lane.items.indexOf(selected)+1} of ${lane.items.length}. ${exhibits.length} exhibits across ${lanes.length} lanes.`;
    focus(selected);if(hash)history.replaceState(null,'',`#${lane.key}/${selected.key}`);
  }
  for(const lane of lanes){const b=document.createElement('button');b.textContent=`${lane.name} (${lane.items.length})`;b.dataset.lane=lane.key;b.onclick=()=>select(lane.key);el('lanes').append(b);}
  el('exhibit').onchange=()=>select(selected.lane,el('exhibit').value);
  const next=delta=>{const lane=lanes.find(l=>l.key===selected.lane),i=lane.items.indexOf(selected);select(lane.key,lane.items[(i+delta+lane.items.length)%lane.items.length].key);};
  el('previous').onclick=()=>next(-1);el('next').onclick=()=>next(1);el('focus').onclick=()=>focus(selected);
  el('row').onclick=()=>{const lane=lanes.find(l=>l.key===selected.lane);target.set(lane.width/2,0,lane.z);view.distance=lane.width*1.35;view.pitch=1.05;view.yaw=0;};
  el('overview').onclick=()=>{const width=Math.max(...lanes.map(l=>l.width));target.set(width/2,0,225);view.distance=width*1.3;view.pitch=1.2;view.yaw=0;};
  el('core').onchange=()=>{if(!selected.weapon)return;const w=selected.weapon,key=el('core').value;
    if(!validPart(w.family,'core',key)){el('core').value=w.core;el('status').textContent='Pulse cores fit ranged weapons only.';return;}
    w.core=key;
    const hex={tempered:0xffd399,ember:0xff794d,frost:0x91ddff,pulse:0xa9a0ff}[key];
    // Each weapon owns its energy material; do not recolor the tower/ally kit.
    selected.group.traverse(mesh=>{if(mesh.isMesh&&mesh.userData.energy){mesh.material.color.setHex(hex);mesh.material.emissive.setHex(hex);}});
    el('status').textContent=`${PARTS.core[key].name} core: ${PARTS.core[key].note}`;
  };
  let drag=null;
  viewport.oncontextmenu=e=>e.preventDefault();
  viewport.onpointerdown=e=>{e.preventDefault();viewport.focus();viewport.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,pan:e.shiftKey||e.button===2||e.button===1};};
  viewport.onpointerup=()=>{drag=null;};viewport.onpointercancel=()=>{drag=null;};
  function pan(dx,dy){
    // Grab the floor in screen space. Vertical drag must account for the
    // orbit pitch and move the scene in the same direction as the pointer.
    const s=2*view.distance*Math.tan(camera.fov*Math.PI/360)/viewport.clientHeight,y=dy/Math.sin(view.pitch);
    target.x+=(-dx*Math.cos(view.yaw)-y*Math.sin(view.yaw))*s;
    target.z+=(dx*Math.sin(view.yaw)-y*Math.cos(view.yaw))*s;
  }
  viewport.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;if(drag.pan)pan(dx,dy);else{view.yaw-=dx*.006;view.pitch=Math.max(.12,Math.min(1.5,view.pitch+dy*.006));}};
  viewport.addEventListener('wheel',e=>{e.preventDefault();view.distance=Math.max(8,Math.min(2200,view.distance*Math.exp(e.deltaY*.001)));},{passive:false});
  viewport.onkeydown=e=>{const moves={ArrowLeft:[30,0],ArrowRight:[-30,0],ArrowUp:[0,30],ArrowDown:[0,-30]};if(moves[e.key]){e.preventDefault();pan(...moves[e.key]);}};
  const observer=new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});observer.observe(viewport);
  const hash=()=>{const [lane,key]=location.hash.slice(1).split('/');select(lane,key,false);};addEventListener('hashchange',hash);hash();
  reduced.addEventListener('change',()=>{if(reduced.matches)el('motion').value='still';});
  const projected=new THREE.Vector3();
  function render(now){
    if(disposed)return;const dt=Math.min(1/30,(now-last)/1000);last=now;
    const motion=reduced.matches?'still':el('motion').value;if(motion!=='still')time+=dt;
    frame();
    for(const {update}of animated)update(motion==='still'?0:time,motion);
    const clip=reduced.matches?'Motion paused by reduced-motion preference':motion==='still'?'Motion paused':selected.lane==='units'?`Playing: ${selected.group.userData.animation}`:motion==='cycle'?'Units cycle in their lane; planet previews rotate.':`Unit motion: ${motion}. Planet previews rotate.`;
    if(el('clip').textContent!==clip)el('clip').textContent=clip;
    renderer.render(scene,camera);
    for(const item of exhibits){projected.set(item.x,0,item.z+item.width*.45).project(camera);
      const visible=item.lane===selected.lane&&(item.lane!=='themes'||item===selected)&&projected.z>0&&projected.z<1&&Math.abs(projected.x)<.94&&Math.abs(projected.y)<.92&&view.distance<190;
      item.label.hidden=!visible;if(visible){item.label.style.left=`${(projected.x*.5+.5)*viewport.clientWidth}px`;item.label.style.top=`${(-projected.y*.5+.5)*viewport.clientHeight}px`;}}
    for(const lane of lanes){projected.set(lane.width/2,0,lane.z+26).project(camera);const visible=view.distance>=190&&projected.z>0&&projected.z<1&&Math.abs(projected.x)<.94&&Math.abs(projected.y)<.95;lane.label.hidden=!visible;if(visible){lane.label.style.left=`${(projected.x*.5+.5)*viewport.clientWidth}px`;lane.label.style.top=`${(-projected.y*.5+.5)*viewport.clientHeight}px`;}}
    requestAnimationFrame(render);
  }
  window.DEBUG_WORLD={scene,camera,renderer,lanes,exhibits,select,focus,view,target,previewAnimation:(t,mode='cycle')=>{for(const {update}of animated)update(t,mode);},get selected(){return selected;},get time(){return time;}};
  addEventListener('pagehide',event=>{if(!event.persisted){disposed=true;observer.disconnect();renderer.dispose();}});requestAnimationFrame(render);
}
