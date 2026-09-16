import * as THREE from '../lib/three.module.min.js';
import {mulberry32} from './noise.js';

const $=id=>document.getElementById(id),panes=[...document.querySelectorAll('.viewport')],stage=$('stage'),status=$('runtime-status');
const renderer=new THREE.WebGLRenderer({canvas:$('terrain-view'),antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xb5cdd6);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const camera=new THREE.PerspectiveCamera(43,1,.5,1500),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const state={mode:'split',yaw:.68,pitch:.73,distance:290,paused:matchMedia('(prefers-reduced-motion: reduce)').matches,routes:true,grid:false,ready:false,seed:12345,preset:'varied',walks:0,arrivals:0,regenerations:0};
const worlds=[],frames=[];let worker,recipe,drag=null,walkId=0,previous=0,accumulated=0;
$('pause').setAttribute('aria-pressed',String(state.paused));$('pause').textContent=state.paused?'Resume motion':'Pause motion';
const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.85,flatShading:true,...extra});
function mesh(geometry,mat,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function dispose(world){world.scene.traverse(o=>{o.geometry?.dispose();o.shadow?.dispose();if(o.material)for(const m of [o.material].flat())m.dispose();});}
function curve(points,color,parent,dashed=false){if(points.length<2)return null;const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p[0],p[1]+.35,p[2])));const line=new THREE.Line(geometry,dashed?new THREE.LineDashedMaterial({color,dashSize:1.5,gapSize:1,depthTest:true}):new THREE.LineBasicMaterial({color}));line.computeLineDistances();parent.add(line);return line;}
function buildWorld(data,side){
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xb5cdd6);
  scene.add(new THREE.HemisphereLight(0xe4f5ff,0x526b55,2.5));
  const sun=new THREE.DirectionalLight(0xffefd8,3);sun.position.set(-70,130,70);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-115,right:115,top:115,bottom:-115,near:1,far:330});sun.shadow.bias=-.001;scene.add(sun);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));geometry.setIndex(new THREE.BufferAttribute(data.indices,1));geometry.computeVertexNormals();
  const normal=geometry.getAttribute('normal'),colors=new Float32Array(data.positions.length);
  const turf=new THREE.Color(recipe.preset==='badlands'?0xbb9760:recipe.preset==='canyon'?0xc29a63:0x759955),rock=new THREE.Color(recipe.preset==='varied'?0x82948b:0xb88466),dark=new THREE.Color(0x6a7770);
  for(let i=0;i<normal.count;i++){
    const y=data.positions[i*3+1],steep=1-Math.abs(normal.getY(i)),c=turf.clone().lerp(rock,Math.min(1,steep*2.7));
    if(y<0)c.lerp(dark,Math.min(.45,-y/50));c.multiplyScalar(.96+.035*Math.sin(y*1.35));c.toArray(colors,i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const terrain=mesh(geometry,material(0xffffff,{vertexColors:true}),scene);terrain.castShadow=false;
  const skirtGeometry=new THREE.BufferGeometry();skirtGeometry.setAttribute('position',new THREE.Float32BufferAttribute(data.skirts,3));skirtGeometry.computeVertexNormals();mesh(skirtGeometry,material(0x526572,{side:THREE.DoubleSide}),scene);
  mesh(new THREE.CylinderGeometry(103,108,4,6),material(0x425968),scene,0,data.bottom-2,0);
  const routeGroup=new THREE.Group(),gridGroup=new THREE.Group();scene.add(routeGroup,gridGroup);
  data.routes.forEach(route=>curve(route,0xb3ffe4,routeGroup,true));routeGroup.visible=state.routes;
  const gridGeo=new THREE.BufferGeometry();gridGeo.setAttribute('position',new THREE.Float32BufferAttribute(data.grid,3));gridGroup.add(new THREE.LineSegments(gridGeo,new THREE.LineBasicMaterial({color:0x324f60,transparent:true,opacity:.55})));gridGroup.visible=state.grid;
  const core=new THREE.Group();core.position.set(...data.heart);scene.add(core);
  mesh(new THREE.CylinderGeometry(4,5,.8,8),material(0xe4d4ac),core,0,.4);
  const crystal=mesh(new THREE.OctahedronGeometry(2.7),material(0x7ef7dd,{emissive:0x187e6d,emissiveIntensity:.25}),core,0,4);
  data.starts.forEach(p=>{const g=new THREE.Group();g.position.set(...p);scene.add(g);mesh(new THREE.TorusGeometry(3.1,.7,5,9),material(0xc45759),g,0,.5).rotation.x=Math.PI/2;mesh(new THREE.IcosahedronGeometry(2,0),material(0x4d2f45),g,0,1.6);});
  const hero=new THREE.Group();hero.position.set(...data.heart);scene.add(hero);
  mesh(new THREE.ConeGeometry(1.15,2.2,5),material(0x354d85),hero,0,1.3);mesh(new THREE.SphereGeometry(.65,7,5),material(0xf3d6a0),hero,0,2.65);
  const ring=mesh(new THREE.TorusGeometry(1.7,.12,5,24),material(0xf1e8b4),hero,0,.25);ring.rotation.x=Math.PI/2;
  if(side===1&&recipe.overlook){const [x,z]=recipe.overlook.center;const flag=new THREE.Group();flag.position.set(x,recipe.overlook.height,z);scene.add(flag);mesh(new THREE.CylinderGeometry(2.3,2.6,.45,8),material(0xd6c38b),flag,0,.22);mesh(new THREE.CylinderGeometry(.14,.2,5,5),material(0x63533d),flag,0,2.5);mesh(new THREE.BoxGeometry(2,1.2,.07),material(0xf5ce68),flag,1,4.2);}
  // Identical cosmetic coordinates on both sides. Placement never affects routes.
  const rng=mulberry32(recipe.seed+331),verticalRay=new THREE.Raycaster();
  for(let i=0;i<90;i++){
    const x=(rng()-.5)*145,z=(rng()-.5)*130;verticalRay.set(new THREE.Vector3(x,180,z),new THREE.Vector3(0,-1,0));const hit=verticalRay.intersectObject(terrain)[0];
    if(!hit||hit.face.normal.y<.9||data.routes.some(path=>path.some(p=>Math.hypot(p[0]-x,p[2]-z)<4))||Math.hypot(x-data.heart[0],z-data.heart[2])<8)continue;
    const tree=new THREE.Group();tree.position.copy(hit.point);scene.add(tree);
    const height=2+rng()*2;mesh(new THREE.CylinderGeometry(.25,.4,height,5),material(0x6b6352),tree,0,height*.5);
    mesh(new THREE.IcosahedronGeometry(height*.8,0),material(recipe.preset==='varied'?0x3e7251:0x8c935c),tree,0,height+1);
  }
  const world={scene,terrain,routeGroup,gridGroup,hero,crystal,data,side,scouts:[],walk:null,walkLine:null,walkLatest:0};return world;
}
function metrics(){
  const [a,b]=recipe.surfaces.map(s=>s.metrics),rows=[['Nest routes to heart',a.reachable+'/3',b.reachable+'/3'],['Flat sites (3 m footprint)',a.sites,b.sites],['Raised flat sites (>5 m)',a.raisedSites,b.raisedSites],['Largest tile seam',a.seamError.toExponential(1)+' m',b.seamError.toExponential(1)+' m'],['Terrain triangles',a.triangles.toLocaleString(),b.triangles.toLocaleString()]];
  $('metrics').replaceChildren(...rows.map(row=>{const tr=document.createElement('tr');row.forEach((text,i)=>{const cell=document.createElement(i?'td':'th');if(!i)cell.scope='row';cell.textContent=text;tr.append(cell);});return tr;}));
  $('recipe-note').textContent=`Seed ${recipe.seed} · source region ${recipe.anchor.id} (${recipe.anchor.type}) · ${recipe.quads} irregular pieces · ${(recipe.timings.totalMs/1000).toFixed(2)} s worker generation + navigation.`;
  $('landmark-note').textContent=recipe.overlook?`Overlook fitted across ${recipe.overlook.faces.length} cells. This is a dry terrain-shaping sample; biomes, ocean coverage and campaign physics are outside this comparison.`:'No overlook fit on this seed. The matcher leaves the terrain alone. This dry local sample does not compare biomes, water or campaign physics.';
  $('overlook').disabled=!recipe.overlook;
  recipe.surfaces.forEach((s,i)=>$(i?'label-guided':'label-current').textContent=`${s.metrics.reachable}/3 connected approaches · ${s.metrics.raisedSites} raised flat samples`);
}
function generate(seed,preset){
  if(!Number.isInteger(seed)||seed<0||seed>4294967295)return;
  state.ready=false;state.seed=seed;state.preset=preset;state.arrivals=0;state.walks=0;state.regenerations++;$('seed').value=seed;$('preset').value=preset;
  $('loading').hidden=false;$('load-status').textContent='Building matching patches in a worker…';$('scouts').disabled=true;$('overlook').disabled=true;status.textContent='Generating terrain; the interface remains responsive.';
  worker?.terminate();worker=new Worker(new URL('./terrain/kit-worker.js',import.meta.url),{type:'module'});
  worker.onerror=event=>fail(event.message);
  worker.onmessage=({data})=>{
    if(data.type==='error'){fail(data.message);return;}
    if(data.type==='walk'){
      const w=worlds[data.side];if(data.id!==w.walkLatest)return;
      if(!data.path.length){status.textContent=`${data.side?'Guided kit':'Current'}: no clear route to that point. Choose an open floor.`;return;}
      w.walk={path:data.path,index:0};if(w.walkLine){w.scene.remove(w.walkLine);w.walkLine.geometry.dispose();w.walkLine.material.dispose();}
      w.walkLine=curve(data.path,0xffe7a6,w.scene);state.walks++;status.textContent='Commander moving along the checked route.';
    }
    if(data.type==='ready'){
      worlds.splice(0).forEach(dispose);recipe=data;worlds.push(...data.surfaces.map(buildWorld));metrics();state.ready=true;$('loading').hidden=true;$('scouts').disabled=false;
      const u=new URL(location.href);u.searchParams.set('seed',seed);u.searchParams.set('terrain',preset);history.replaceState(null,'',u);status.textContent='Ready. Send scouts or tap the ground to explore.';
    }
  };
  worker.postMessage({type:'generate',seed,preset});
}
function fail(message){state.ready=false;$('loading').hidden=false;$('load-status').textContent='Generation failed. Try another seed with Generate.';status.textContent=message;window.PROCGEN_ERROR=message;}
function sendScouts(){
  if(!state.ready)return;let count=0;
  worlds.forEach(w=>{
    for(const unit of w.scouts){w.scene.remove(unit.model);unit.model.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}w.scouts=[];
    w.data.routes.forEach((path,lane)=>{if(!path.length)return;for(let n=0;n<3;n++){
      const g=new THREE.Group();mesh(new THREE.IcosahedronGeometry(1,0),material(0xb34355),g,0,1.1);mesh(new THREE.ConeGeometry(.65,.9,4),material(0xe9d4a9),g,0,2).rotation.z=Math.PI;
      g.position.set(...path[0]);w.scene.add(g);w.scouts.push({model:g,path,index:0,delay:n*.8+lane*.1,done:false});count++;
    }});
  });status.textContent=`${count} scouts dispatched. Blocked routes are omitted, never teleported.`;
}
function setMode(mode){state.mode=mode;stage.classList.toggle('compare',mode==='split');stage.classList.toggle('single',mode!=='split');panes.forEach((p,i)=>p.hidden=mode!=='split'&&mode!==['current','guided'][i]);document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('recipe').onsubmit=event=>{event.preventDefault();generate(Number($('seed').value),$('preset').value);};
$('random').onclick=()=>generate(crypto.getRandomValues(new Uint32Array(1))[0],$('preset').value);
$('scouts').onclick=sendScouts;
$('overlook').onclick=()=>{if(!state.ready||!recipe.overlook)return;const w=worlds[1],id=++walkId;w.walkLatest=id;worker.postMessage({type:'walk',side:1,id,from:[w.hero.position.x,w.hero.position.z],to:recipe.overlook.center});};
$('routes').onchange=()=>{state.routes=$('routes').checked;worlds.forEach(w=>w.routeGroup.visible=state.routes);};
$('grid').onchange=()=>{state.grid=$('grid').checked;worlds.forEach(w=>w.gridGroup.visible=state.grid);};
$('pause').onclick=()=>{state.paused=!state.paused;$('pause').setAttribute('aria-pressed',String(state.paused));$('pause').textContent=state.paused?'Resume motion':'Pause motion';};
$('reset-view').onclick=()=>{state.yaw=.68;state.pitch=.73;state.distance=290;};
$('zoom-in').onclick=()=>state.distance=Math.max(90,state.distance-25);
$('zoom-out').onclick=()=>state.distance=Math.min(480,state.distance+25);
function aim(rect){camera.aspect=rect.width/rect.height;const distance=state.distance*Math.max(1,1.2/camera.aspect);camera.position.set(Math.sin(state.yaw)*Math.cos(state.pitch)*distance,8+Math.sin(state.pitch)*distance,Math.cos(state.yaw)*Math.cos(state.pitch)*distance);camera.lookAt(0,8,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();}
function walk(event,pane){
  if(!state.ready)return;const side=Number(pane.dataset.side),rect=pane.getBoundingClientRect();aim(rect);pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObject(worlds[side].terrain)[0];if(!hit)return;
  const id=++walkId;
  worlds.forEach((w,i)=>{w.walkLatest=id;worker.postMessage({type:'walk',side:i,id,from:[w.hero.position.x,w.hero.position.z],to:[hit.point.x,hit.point.z]});});
}
panes.forEach(p=>{
  p.onpointerdown=e=>{if(e.button!==0)return;p.focus({preventScroll:true});p.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,total:0};};
  p.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.total+=Math.abs(dx)+Math.abs(dy);if(drag.total>5){state.yaw-=dx*.006;state.pitch=Math.max(.22,Math.min(1.48,state.pitch+dy*.005));}drag.x=e.clientX;drag.y=e.clientY;};
  p.onpointerup=e=>{if(!drag||drag.id!==e.pointerId)return;const click=drag.total<=5;drag=null;if(click)walk(e,p);};p.onpointercancel=()=>drag=null;
  p.onwheel=e=>{e.preventDefault();state.distance=Math.max(90,Math.min(480,state.distance*Math.exp(e.deltaY*.001)));};
  p.onkeydown=e=>{const actions={ArrowLeft:()=>state.yaw-=.12,ArrowRight:()=>state.yaw+=.12,ArrowUp:()=>state.pitch=Math.min(1.48,state.pitch+.08),ArrowDown:()=>state.pitch=Math.max(.22,state.pitch-.08),'+':()=>state.distance=Math.max(90,state.distance-15),'-':()=>state.distance=Math.min(480,state.distance+15)};if(actions[e.key]){e.preventDefault();actions[e.key]();}};
});
function advance(object,track,dt,speed){
  let budget=dt*speed;
  while(budget>0&&track.index<track.path.length){const target=new THREE.Vector3(...track.path[track.index]),d=object.position.distanceTo(target);if(d<=budget){object.position.copy(target);track.index++;budget-=d;}else{object.position.lerp(target,budget/d);budget=0;}}
  return track.index>=track.path.length;
}
function frame(now){
  requestAnimationFrame(frame);const elapsed=previous?Math.max(0,now-previous):16.67;previous=now;if(document.hidden)return;frames.push(elapsed);if(frames.length>240)frames.shift();const dt=Math.min(.05,elapsed/1000);if(!state.paused)accumulated+=dt;
  if(!state.paused)for(const w of worlds){
    w.crystal.rotation.y=accumulated*.35;
    if(w.walk&&advance(w.hero,w.walk,dt,13))w.walk=null;
    for(const u of w.scouts){if(u.done)continue;if(u.delay>0){u.delay-=dt;continue;}if(advance(u.model,u,dt,10)){u.done=true;state.arrivals++;}u.model.rotation.z=Math.sin(accumulated*10)*.08;}
  }
  const box=stage.getBoundingClientRect(),size=renderer.getSize(new THREE.Vector2());if(size.x!==Math.floor(box.width)||size.y!==Math.floor(box.height))renderer.setSize(box.width,box.height,false);
  renderer.setScissorTest(true);
  panes.forEach((pane,i)=>{if(pane.hidden||!worlds[i])return;const r=pane.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;const left=r.left-box.left,bottom=box.bottom-r.bottom;renderer.setViewport(left,bottom,r.width,r.height);renderer.setScissor(left,bottom,r.width,r.height);aim(r);renderer.render(worlds[i].scene,camera);});
}
window.PROCGEN_LAB={state,get recipe(){return recipe;},get metrics(){return {geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,frameMs:frames.slice(),walks:state.walks,arrivals:state.arrivals};},get heroes(){return worlds.map(w=>w.hero.position.toArray());},get scouts(){return worlds.map(w=>w.scouts.map(u=>({position:u.model.position.toArray(),done:u.done})));}};
const params=new URLSearchParams(location.search),inputSeed=Number(params.get('seed')||12345),inputPreset=params.get('terrain');
generate(Number.isInteger(inputSeed)&&inputSeed>=0&&inputSeed<=4294967295?inputSeed:12345,['varied','badlands','canyon'].includes(inputPreset)?inputPreset:'varied');requestAnimationFrame(frame);
