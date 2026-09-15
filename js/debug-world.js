import {AudioEngine} from './audio.js';
import {audioSettings} from './audio-settings.js';
import {patchScatter} from './terrain/scatter.js';
import {TouchGesture,bindTouchActivation,hasTouch,clamp} from './touch-input.js';
import {createTerrainFeatures} from './terrain/features.js';
import {ACTIVE_FEATURES,DISASTERS} from './run/environment-catalogue.js';
import {buildActiveFeature} from './terrain/active-features.js';
import {buildDisasterArt} from './disaster-art.js';
import * as THREE from 'three';
import {buildMount} from './mounts.js';
import {MOUNTS} from './run/expedition.js';
import {TOWER_TYPES,AUTHORED_TIERS,buildTowerVisual,tierStats,MAT,TOWER_SCALE} from './towers.js';
import {ALLY_TYPES} from './allies.js';
import {ENEMY_TYPES,buildEnemyModel} from './enemies.js';
import {buildSoldier,poseSoldier,freshSoldierState} from './soldier.js';
import {buildWeapon,weaponAppearanceMaterial} from './weapon-model.js';
import {FAMILIES,ERAS,WEAPON_MATERIALS,PARTS,validPart} from './run/weapons.js';
import {PALETTE,TERRAIN_PROFILES} from './config.js';
import {LANDFORM_RECIPES} from './terrain/recipes.js';
import {formationSample} from './terrain/samples.js';
import {BIOME_VISUALS,THEME_SURFACES,paintBiome,biomeDressingGeometry} from './biome-visuals.js';
import {PLANET_THEMES} from './run/planet-environments.js';
import {makePineGeometry,makeBroadleafGeometry,makeCactusGeometry} from './world.js';
import {animationClip} from './debug-animation.js';
import {miniaturePlanet,MINIATURE_SEED,terrainCollection} from './debug-planets.js';

const SCALE=.2;
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.65,flatShading:true,...extra});
const modelMats=()=>({body:MAT.body,trim:MAT.trim,dark:MAT.dark,grip:mat(0x755744),gold:MAT.gemGold,energy:MAT.energy,cloth:mat(0x385e75)});
const waitFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));

// Hundreds of centimetre-sized feature props are subpixel in the catalogue
// overview. Keep their full production models for close inspection, and batch
// the fixed surface meshes without changing any of their vertices or colors.
function preparePreview(group){
  const details=[];
  group.traverse(root=>{
    if(root.name.startsWith('active-'))details.push(root);
    const meshes=root.children.filter(o=>o.isMesh&&o.userData.surface);
    if(meshes.length<2)return;
    const geometry=new THREE.BufferGeometry();
    for(const key of ['position','normal','color']){
      const arrays=meshes.map(m=>m.geometry.attributes[key].array),data=new Float32Array(arrays.reduce((n,a)=>n+a.length,0));let offset=0;
      for(const a of arrays){data.set(a,offset);offset+=a.length;}geometry.setAttribute(key,new THREE.BufferAttribute(data,3));
    }
    const material=meshes[0].material;
    for(const mesh of meshes){root.remove(mesh);mesh.geometry.dispose();if(mesh.material!==material)mesh.material.dispose();}
    const mesh=new THREE.Mesh(geometry,material);mesh.name='preview-surface-batch';root.add(mesh);
  });
  return details;
}

export function articulated(build,isEnemy,key){
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

function terrainPaint(c,dir,h,slope){
  paintBiome(c,h>3||h<-.8?'desert':'meadow',h,slope,.5);
  if(h>3)c.lerp(new THREE.Color(0x937765),.45+.15*Math.sin(h*.6));
}

function terrainTile(type,seed){
  const sample=formationSample(type,seed),n=type==='grand'||type==='labyrinth'?128:96,half=sample.half;
  const features=createTerrainFeatures(sample.field,240,(x,y,z)=>sample.field.height(x,y,z)),a=sample.anchor;
  const geo=new THREE.PlaneGeometry(half*2*SCALE,half*2*SCALE,n,n);geo.rotateX(-Math.PI/2);
  const p=geo.attributes.position;let low=0,high=0;
  for(let i=0;i<p.count;i++){const h=sample.height(p.getX(i)/SCALE,p.getZ(i)/SCALE);p.setY(i,h*SCALE);low=Math.min(low,h);high=Math.max(high,h);}
  geo.computeVertexNormals();const flat=geo.toNonIndexed();geo.dispose();
  const colors=[],c=new THREE.Color(),pos=flat.attributes.position;
  for(let i=0;i<pos.count;i+=3){
    const h=(pos.getY(i)+pos.getY(i+1)+pos.getY(i+2))/3/SCALE;
    const slope=1-Math.abs(flat.attributes.normal.getY(i));
    terrainPaint(c,null,h,slope);
    if(features.surfaces.length){const u=(pos.getX(i)+pos.getX(i+1)+pos.getX(i+2))/3/SCALE,v=(pos.getZ(i)+pos.getZ(i+1)+pos.getZ(i+2))/3/SCALE,d=a.dir.map((x,k)=>x+(a.axis[k]*u+a.side[k]*v)/240),length=Math.hypot(...d);if(Number.isFinite(features.ceiling(d.map(x=>x/length),h+1.7)))c.multiplyScalar(.65);}
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
  const point=(dir,h)=>{const dot=dir.reduce((sum,v,k)=>sum+v*a.dir[k],0),u=240*dir.reduce((sum,v,k)=>sum+v*a.axis[k],0)/dot,v=240*dir.reduce((sum,v,k)=>sum+v*a.side[k],0)/dot;return new THREE.Vector3(u*SCALE,h*SCALE,v*SCALE);};
  const art=features.build({paint:terrainPaint,tint:0xdce8e8,roughness:.65,point,scale:SCALE,spherical:false,color:()=>0xa58d60,topColor:()=>0xb4a076,include:dir=>dir.reduce((s,v,k)=>s+v*a.dir[k],0)>.7});group.add(art);
  art.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(art);if(!bounds.isEmpty())high=Math.max(high,bounds.max.y/SCALE);
  return {group,low,high,width:half*2*SCALE,seed,update:art.userData.update};
}

function biomeTile(key,theme=null){
  const group=new THREE.Group(),v=BIOME_VISUALS[key],color=new THREE.Color();
  const geo=new THREE.PlaneGeometry(24,24,20,20);geo.rotateX(-Math.PI/2);const p=geo.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,['ocean','coralreef','kelp'].includes(key)?-1.2:.45*Math.sin(p.getX(i)*.3)*Math.cos(p.getZ(i)*.4));
  geo.computeVertexNormals();const g=geo.toNonIndexed();geo.dispose();const colors=[];
  for(let i=0;i<g.attributes.position.count;i++){paintBiome(color,key,0,0,.5);colors.push(color.r,color.g,color.b);}
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));group.add(new THREE.Mesh(g,mat(0xdce8e8,{vertexColors:true})));
  let kind=v.decor;
  if(theme==='oceanic')kind='coral';
  const make=kind==='pine'?makePineGeometry:kind==='leaf'||kind==='jungle'?makeBroadleafGeometry:kind==='cactus'?makeCactusGeometry:()=>biomeDressingGeometry(kind);
  const dressing=make(),material=mat(0xdce8e8,{side:THREE.DoubleSide,vertexColors:true,emissive:key==='twilight'?0x497a6a:0x18232b,emissiveIntensity:.2});
  const count=kind==='jungle'?25:kind==='leaf'?8:12;
  for(const p of patchScatter([...key].reduce((s,c)=>Math.imul(s,31)+c.charCodeAt(0),771),count)){const prop=new THREE.Mesh(dressing,material);
    prop.position.set(p.x,.2,p.z);prop.rotation.y=p.angle;prop.scale.setScalar((kind==='jungle'?3.2:1.4)*p.scale);group.add(prop);}
  if(['ocean','coralreef','kelp'].includes(key)||theme){
    const w=new THREE.Mesh(new THREE.PlaneGeometry(theme?5:24,24),mat(theme?THEME_SURFACES[theme].shore:BIOME_VISUALS.ocean.color,{transparent:true,opacity:.76,roughness:.22}));
    w.rotation.x=-Math.PI/2;w.position.set(theme?9.5:0,.5,0);group.add(w);
  }
  return group;
}

export async function startDebugWorld(){
  const el=id=>document.getElementById(id),viewport=el('viewport'),labels=el('labels');
  const audio=new AudioEngine();audio.ambience='none';audio.state='none';window.WH_AUDIO=audio;audioSettings(audio,document.querySelector('aside'),{audition:true});
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x152334);viewport.prepend(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.1,10000);
  scene.add(new THREE.HemisphereLight(0xdbecff,0x566276,2.4));
  const sun=new THREE.DirectionalLight(0xffedcf,3);sun.position.set(100,180,70);scene.add(sun);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(3300,900),mat(0x1d3040));floor.rotation.x=-Math.PI/2;floor.position.set(1100,-12,315);scene.add(floor);
  const lanes=[['units','Units'],['mounts','Mounts'],['towers','Towers'],['weapons','Weapons'],['formations','Land formations'],['terrain','Terrain'],['biomes','Biomes'],['features','Active land features'],['disasters','Natural disasters'],['themes','Planet themes']].map(([key,name],i)=>({key,name,z:i*90,items:[],width:0}));
  const exhibits=[],animated=[],target=new THREE.Vector3(),view={yaw:.65,pitch:.65,distance:40},reduced=matchMedia('(prefers-reduced-motion: reduce)');let selected=null,time=0,last=performance.now(),disposed=false;
  function add(lane,key,name,group,description,metrics={},width=30,update=null){
    const x=lane.width+width/2;lane.width+=width+8;group.position.set(x,0,lane.z);scene.add(group);
    if(['units','towers','weapons'].includes(lane.key)){
      const pad=new THREE.Mesh(new THREE.BoxGeometry(width-2,.5,18),mat(0x344a5b));pad.position.set(x,-.3,lane.z);scene.add(pad);
    }
    const label=document.createElement('div');label.className='label';label.textContent=name;labels.append(label);
    const details=['themes','terrain','formations'].includes(lane.key)?preparePreview(group):[];
    const item={lane:lane.key,key,name,group,description,metrics,width,x,z:lane.z,label,details};lane.items.push(item);exhibits.push(item);if(update)animated.push({item,update});return item;
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
    if(lane.key==='mounts')for(const [key,m]of Object.entries(MOUNTS))if(key!=='none'){const model=buildMount(key);model.group.scale.setScalar(4);add(lane,key,m.name,model.group,m.description,{Speed:m.speed+'x',Water:m.water+'x',Damage:m.damage+'x'},20,(t,mode)=>model.update(t,mode==='still'?0:1));}
    if(lane.key==='towers')for(const [key,type]of Object.entries(TOWER_TYPES))for(const tier of [0,1,2,5,11]){
      const b=buildTowerVisual(key,tier);b.group.scale.setScalar(4*TOWER_SCALE);const s=tierStats(key,tier);
      add(lane,`${key}-${tier}`,`${type.name} · Mk ${tier+1}`,b.group,'Production tower with reinforced family-specific structure. Higher marks add armor, capacitors, ice petals or fortified supports while preserving targeting.',{Range:`${s.range.toFixed(2)} m`,Scale:'4x',Tier:tier+1},22);
    }
    if(lane.key==='weapons')for(const [key,family]of Object.entries(FAMILIES))for(const material of WEAPON_MATERIALS){
      const era=material==='diamond'?'technological':material==='onyx'?'empowered':'ancient';
      const mats=modelMats(),b=buildWeapon(family.visual,era,mats),group=new THREE.Group();for(const p of b.parts){const mesh=new THREE.Mesh(p.geo,weaponAppearanceMaterial(mats,p.mat,{era,material,core:'tempered'}));mesh.userData.energy=p.mat===mats.energy;group.add(mesh);if(b.paired){const left=mesh.clone();left.position.x=-.42;left.position.z=.08;group.add(left);}}group.rotation.x=-.4;group.rotation.y=-.6;group.scale.setScalar(4);
      const item=add(lane,`${key}-${material}`,`${family.name} · ${material}`,weaponExhibit(group),'Shared held, loot and soldier geometry. Wood, iron, gold, diamond and onyx correspond to five rarity steps; core choice changes the energy channel.',{Family:family.kind,Material:material,Era:era,Scale:'4x'},18);
      item.weapon={family:key,era,material,mats,core:'tempered'};
    }
    if(lane.key==='weapons')for(const [key,name]of [['duelist','Native twin swords'],['oracle','Native beam staff']]){
      const build=buildSoldier(key,modelMats()),b=articulated(build,false,key);b.update(0,'still');const group=new THREE.Group();
      for(const part of build.parts)for(const at of part.at)if(['weaponR','weaponL'].includes(at.joint.name)){const mesh=new THREE.Mesh(part.geo,part.mat);mesh.applyMatrix4(new THREE.Matrix4().multiplyMatrices(at.joint.world,at.off));group.add(mesh);}
      group.scale.setScalar(4);add(lane,`native-${key}`,name,weaponExhibit(group),'Native commander equipment from the shared soldier builder. Loot variations appear beside it.',{Source:ALLY_TYPES[key].name,Scale:'4x'},18);
    }
    if(lane.key==='formations')for(const [key,recipe]of Object.entries(LANDFORM_RECIPES)){
      const sample=terrainTile(key,771);add(lane,key,recipe.label,sample.group,'Production formation at 1:5 scale. Bridges, cave roofs and floating decks use the same additional surfaces as gameplay. Inward cuts are dry in this exhibit.',{Peak:`${sample.high.toFixed(1)} m`,Depth:`${(-sample.low).toFixed(1)} m`,Width:`${(sample.width/SCALE).toFixed(0)} m`,Seed:sample.seed},sample.width+4,sample.update);
      await waitFrame();
    }
    if(lane.key==='terrain')for(const [key,profile]of Object.entries(TERRAIN_PROFILES)){
      const group=terrainCollection(key),data=group.userData.terrain;
      add(lane,key,profile.name,group,'A 300 metre production terrain patch showing how landforms combine into routes. The terrain recipe sets formation grouping; the planet theme supplies its climate and biomes.',{Area:'300 x 300 m',Formations:data.formations.map(k=>LANDFORM_RECIPES[k].label).join(', '),Peak:data.max.toFixed(1)+' m',Depth:(-data.min).toFixed(1)+' m',Seed:data.seed},66,group.userData.update);await waitFrame();
    }
    if(lane.key==='biomes')for(const [key,b]of Object.entries(BIOME_VISUALS))add(lane,key,b.name,biomeTile(key),b.note||'Production biome palette and scenery geometry on a flat sample plot.',{Dressing:b.decor},28);
    if(lane.key==='features'||lane.key==='disasters')for(const [key,f]of Object.entries(lane.key==='features'?ACTIVE_FEATURES:DISASTERS)){
      const hazard=lane.key==='disasters',art=hazard?buildDisasterArt(key):buildActiveFeature(key),group=new THREE.Group(),width=hazard?(key==='quake'?90:60):24;
      const groundColor={tsunami:0x326a79,whirlpool:0x326a79,cryovent:0xa2bbc4,blizzard:0x9baeb1,fumarole:0x716344,seep:0x45424a,eruption:0x45424a,mudpot:0x7b7860,sandstorm:0xb39b6d,solar:0x6a6675}[key]||0x718565;
      const pad=new THREE.Mesh(new THREE.BoxGeometry(width,.5,width),mat(groundColor));pad.position.y=key==='quake'?-3:-.3;group.add(pad,art);
      let item;const update=t=>{const elapsed=Math.max(0,t-(item?.animationStart||0)),cycle=hazard?elapsed%(f.duration+8):elapsed,warning=hazard&&cycle>=f.duration;art.userData.update(warning?cycle-f.duration:cycle,warning);};
      item=add(lane,key,f.name,group,f.note,hazard?{Compatibility:f.tags.join(', '),Duration:f.duration+' s',Warning:'8 s',Hostility:'Independent size and frequency'}:{Biomes:f.biomes.join(', '),Formations:f.formations.map(k=>LANDFORM_RECIPES[k]?.label||k).join(', '),Period:f.period+' s'},width,update);
    }
    if(lane.key==='themes')for(const [key,theme]of Object.entries(PLANET_THEMES))if(key!=='auto'){
      const s=THEME_SURFACES[key],group=miniaturePlanet(key),sample=group.userData.miniature;
      const item=add(lane,key,theme.name,group,`${s.note} A miniature of the production terrain field with its biome belts, formations and scenery.`,{Biomes:Object.keys(sample.biomes).length,Formations:sample.formations.length,Peak:`${sample.max.toFixed(0)} m`,Depth:`${(-sample.min).toFixed(0)} m`,Seed:sample.seed},32);
      item.planet=key;
      animated.push({item,update:t=>{const longitude={earth:-20,moon:0,mercury:160,mars:-100,jupiter:-50,pluto:100,callisto:60}[key]??30;group.children[0].rotation.y=(longitude-53)*Math.PI/180+(t-(item.animationStart||0))*.06;group.userData.update?.(t);}});await waitFrame();
    }
    const strip=new THREE.Mesh(new THREE.PlaneGeometry(lane.width,2),mat(0x4e7588));strip.rotation.x=-Math.PI/2;strip.position.set(lane.width/2,-.5,lane.z+22);scene.add(strip);
    lane.label=document.createElement('div');lane.label.className='label lane-title';lane.label.textContent=`${lane.name} / ${lane.items.length}`;labels.append(lane.label);
  }
  function frame(){
    camera.position.set(target.x+Math.sin(view.yaw)*Math.cos(view.pitch)*view.distance,target.y+Math.sin(view.pitch)*view.distance,target.z+Math.cos(view.yaw)*Math.cos(view.pitch)*view.distance);camera.lookAt(target);
  }
  function focus(item){
    item.animationStart=time;
    for(const e of exhibits)e.group.visible=e===item;
    target.set(item.x,item.lane==='themes'?15:item.group.userData.focusY??Math.max(item.lane==='units'?3:0,Number.parseFloat(item.metrics.Peak||0)*SCALE*.25),item.z);
    view.distance=item.lane==='weapons'?17:item.lane==='units'?25:Math.max(25,item.width*1.7);
    if(item.lane==='themes'){
      const radius=(item.group.userData.miniature.frameRadius||10+item.group.userData.miniature.max/24)+.6,angle=Math.atan(Math.tan(camera.fov*Math.PI/360)*Math.min(1,camera.aspect));
      view.distance=Math.max(40,radius/Math.sin(angle)*1.08);
    }
    view.pitch=item.lane==='themes'?.3:['sky','skyreef','skycrown','skyshards','ribbons','valley','grotto','caverns','arcade'].includes(item.key)?.3:.65;frame();
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
  el('row').onclick=()=>{for(const e of exhibits)e.group.visible=e.lane===selected.lane;const lane=lanes.find(l=>l.key===selected.lane);target.set(lane.width/2,0,lane.z);view.distance=lane.width*1.35;view.pitch=1.05;view.yaw=0;};
  el('overview').onclick=()=>{for(const e of exhibits)e.group.visible=true;const width=Math.max(...lanes.map(l=>l.width));target.set(width/2,0,(lanes[0].z+lanes.at(-1).z)/2);view.distance=width*1.3;view.pitch=1.2;view.yaw=0;};
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
  new TouchGesture(viewport,{
    drag:(dx,dy)=>{view.yaw-=dx*.006;view.pitch=clamp(view.pitch+dy*.006,.12,1.5);},
    pinch:(zoom,dx,dy)=>{view.distance=clamp(view.distance*Math.exp(zoom),8,2200);pan(dx,dy);}
  });
  const inspect=document.createElement('button');inspect.id='debug-inspect';inspect.textContent='Exhibits and controls';inspect.setAttribute('aria-expanded','false');
  inspect.onclick=()=>{const on=document.body.classList.toggle('debug-inspecting');inspect.setAttribute('aria-expanded',String(on));inspect.textContent=on?'Close controls':'Exhibits and controls';};
  document.querySelector('header').append(inspect);
  if(hasTouch())document.body.classList.add('debug-touch');
  bindTouchActivation(document,()=>document.body.classList.contains('debug-touch'));
  viewport.setAttribute('aria-label','3D Debug World. Drag to orbit. Pinch to zoom. Two fingers drag to pan. Mouse wheel and arrows also work.');
  viewport.onkeydown=e=>{const moves={ArrowLeft:[30,0],ArrowRight:[-30,0],ArrowUp:[0,30],ArrowDown:[0,-30]};if(moves[e.key]){e.preventDefault();pan(...moves[e.key]);}};
  const observer=new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});observer.observe(viewport);
  const hash=()=>{let [lane,key]=location.hash.slice(1).split('/');if(lane==='weapons')key=key?.replace(/-(ancient|technological|empowered)$/,(_,era)=>'-'+({ancient:'wood',technological:'diamond',empowered:'onyx'}[era]));if(lane==='formations'&&['geyser','trunks'].includes(key))lane='features';if(lane==='formations'&&key==='amphitheatre')key='arcade';select(lane,key,false);};addEventListener('hashchange',hash);hash();
  reduced.addEventListener('change',()=>{if(reduced.matches)el('motion').value='still';});
  const projected=new THREE.Vector3();
  function render(now){
    if(disposed)return;const dt=Math.min(1/30,(now-last)/1000);last=now;audio.update(dt);
    const motion=reduced.matches?'still':el('motion').value;if(motion!=='still')time+=dt;
    frame();
    for(const item of exhibits)for(const root of item.details)root.visible=item.group.visible&&view.distance<160;
    for(const {item,update}of animated)if(item.lane==='units'||item.group.visible)update(motion==='still'?0:time,motion);
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
