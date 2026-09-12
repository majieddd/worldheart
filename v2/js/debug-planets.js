import * as THREE from 'three';
import {CONFIG,TERRAIN_PROFILES} from './config.js';
import {planetEnvironment} from './run/planet-environments.js';
import {buildIcosphere} from './geodesic.js';
import {R,initTerrainField,terrainHeight,oceanAt,biomeAt,faceColor,terrainThermal,FORMATIONS,FEATURES,makePineGeometry,makeBroadleafGeometry,makeCactusGeometry} from './world.js';
import {BIOME_VISUALS,THEME_SURFACES,biomeDressingGeometry} from './biome-visuals.js';

export const MINIATURE_SEED=4206018157;
const stone=new THREE.Color(),sea=new THREE.Color(),v=new THREE.Vector3(),normal=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
const material=extra=>new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.7,...extra});
let miniatureSphere;

// A 300 metre patch, large enough to read a terrain recipe's grouping of
// several landforms. Samples the exact production height and biome functions.
export function terrainCollection(key,seed=MINIATURE_SEED){
  if(!/\/debug\.html$/.test(location.pathname))throw Error('Terrain collections require Debug World');
  const saved={seed:CONFIG.seed,environment:CONFIG.environment,terrain:CONFIG.terrain,terrainKey:CONFIG.terrainKey,biomeKey:CONFIG.biomeKey};
  try{
    const environment=planetEnvironment(seed,'temperate');
    Object.assign(CONFIG,{seed,environment,terrain:{...TERRAIN_PROFILES[key],ocean:TERRAIN_PROFILES[key].ocean+environment.oceanShift},terrainKey:key,biomeKey:'auto'});initTerrainField(seed);
    const modules=FORMATIONS.modules.filter(m=>m.height>0),centre=new THREE.Vector3();let chosen=modules[0],score=-1;
    for(const candidate of modules){const c=new THREE.Vector3(...candidate.dir);if(Math.abs(c.y)>.65)continue;const nearby=modules.filter(m=>c.dot(new THREE.Vector3(...m.dir))>Math.cos(.55));const n=new Set(nearby.map(m=>m.type)).size;
      const match=key==='alpine'?['range','caldera','forest'].includes(candidate.type):key==='canyon'?['grand','gorge','ravine'].includes(candidate.type):false;
      const tangent=new THREE.Vector3().crossVectors(c,new THREE.Vector3(0,1,0)).normalize(),across=new THREE.Vector3().crossVectors(tangent,c).normalize();let land=0;
      for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++){v.copy(c).addScaledVector(tangent,x*.22).addScaledVector(across,z*.22).normalize();if(!oceanAt(v.x,v.y,v.z)||terrainHeight(v.x,v.y,v.z,false)>0)land++;}
      const rank=n*3+(match?30:0)+(key==='ocean'?-Math.abs(land-12):land*2)+Math.min(1,candidate.height*.005);
      if(rank>score){score=rank;chosen=candidate;}}
    centre.set(...chosen.dir);const axis=new THREE.Vector3(0,Math.abs(centre.y)<.9?1:0,Math.abs(centre.y)<.9?0:1),side=new THREE.Vector3().crossVectors(centre,axis).normalize();axis.crossVectors(side,centre).normalize();
    const geo=new THREE.PlaneGeometry(60,60,150,150);geo.rotateX(-Math.PI/2);const p=geo.attributes.position,dirs=[],heights=[];let min=Infinity,max=-Infinity;
    for(let i=0;i<p.count;i++){v.copy(centre).addScaledVector(axis,p.getX(i)/48).addScaledVector(side,p.getZ(i)/48).normalize();const h=terrainHeight(v.x,v.y,v.z,false);dirs.push(v.clone());heights.push(h);p.setY(i,h*.2);min=Math.min(min,h);max=Math.max(max,h);}
    const col=[],wet=[],wetColors=[],index=geo.index.array;geo.computeVertexNormals();
    for(let i=0;i<p.count;i++){faceColor(dirs[i],heights[i],(1-Math.abs(geo.attributes.normal.getY(i)))*3.2,.5,stone);col.push(stone.r,stone.g,stone.b);}
    geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    for(let i=0;i<index.length;i+=3){const ids=[index[i],index[i+1],index[i+2]];v.copy(dirs[ids[0]]).add(dirs[ids[1]]).add(dirs[ids[2]]).normalize();
      if(!oceanAt(v.x,v.y,v.z)||terrainHeight(v.x,v.y,v.z,false)>.1)continue;
      for(const j of ids){wet.push(p.getX(j),.02,p.getZ(j));sea.setHex(0x329fa6);wetColors.push(sea.r,sea.g,sea.b);}}
    const group=new THREE.Group();group.add(new THREE.Mesh(geo,material({})));const water=new THREE.BufferGeometry();water.setAttribute('position',new THREE.Float32BufferAttribute(wet,3));water.setAttribute('color',new THREE.Float32BufferAttribute(wetColors,3));water.computeVertexNormals();group.add(new THREE.Mesh(water,material({roughness:.35})));
    const art=FEATURES.build({scale:.2,spherical:false,include:dir=>centre.dot(new THREE.Vector3(...dir))>Math.cos(.5),point:(dir,h)=>{const d=new THREE.Vector3(...dir),dot=d.dot(centre);return new THREE.Vector3(d.dot(axis)*48/dot,h*.2,d.dot(side)*48/dot);}});group.add(art);group.userData.update=art.userData.update;
    group.userData.terrain={key,seed,min,max,formations:[...new Set(modules.filter(m=>centre.dot(new THREE.Vector3(...m.dir))>Math.cos(.65)).map(m=>m.type))]};return group;
  }finally{Object.assign(CONFIG,saved);initTerrainField(saved.seed);}
}

// The Debug route has no game or nav graph. Sample each theme synchronously,
// restore its configuration and field before yielding, and keep only meshes.
// This guarded adapter cannot replace a live game's terrain underneath it.
export function miniaturePlanet(theme,seed=MINIATURE_SEED){
  if(!/\/debug\.html$/.test(location.pathname)||R!==240)throw Error('Planet miniatures require the isolated Debug World');
  const saved={seed:CONFIG.seed,environment:CONFIG.environment,terrain:CONFIG.terrain,terrainKey:CONFIG.terrainKey,biomeKey:CONFIG.biomeKey};
  const environment=planetEnvironment(seed,theme),scale=10/R,group=new THREE.Group();
  const data={theme,seed,biomes:{},formations:[],min:Infinity,max:-Infinity,waterFaces:0,vertices:0};
  try{
    Object.assign(CONFIG,{seed,environment,terrain:{...TERRAIN_PROFILES.varied,ocean:TERRAIN_PROFILES.varied.ocean+environment.oceanShift},terrainKey:'varied',biomeKey:'auto'});
    initTerrainField(seed);
    const sphere=miniatureSphere||=(buildIcosphere(6)),heights=[],points=sphere.verts.map(p=>{const h=terrainHeight(p[0],p[1],p[2],false);heights.push(h);data.min=Math.min(data.min,h);data.max=Math.max(data.max,h);return new THREE.Vector3(...p).multiplyScalar((R+h)*scale);});
    const positions=[],colors=[],wetPositions=[],wetColors=[];
    for(const f of sphere.faces){
      const a=points[f[0]],b=points[f[1]],c=points[f[2]];v.copy(a).add(b).add(c).normalize();
      const h=(heights[f[0]]+heights[f[1]]+heights[f[2]])/3,wet=oceanAt(v.x,v.y,v.z);
      if(f[0]%7===0){const biome=biomeAt(v,h);data.biomes[biome]=(data.biomes[biome]||0)+1;}
      normal.crossVectors(ab.copy(b).sub(a),ac.copy(c).sub(a)).normalize();
      faceColor(v,h,(1-Math.abs(normal.dot(v)))*3.2,.5,stone);
      const thermal=terrainThermal(v,h);if(thermal?.lava>.12)stone.lerp(sea.setHex(0xffab42),thermal.lava);
      for(const p of [a,b,c]){positions.push(p.x,p.y,p.z);colors.push(stone.r,stone.g,stone.b);}
      if(wet&&h<.13){
        data.waterFaces++;sea.setHex(THEME_SURFACES[theme].water).lerp(stone.setHex(THEME_SURFACES[theme].shore),Math.max(0,1+h/1.8));
        for(const i of f){const p=sphere.verts[i];wetPositions.push(p[0]*10.005,p[1]*10.005,p[2]*10.005);wetColors.push(sea.r,sea.g,sea.b);}
      }
    }
    const mesh=(pos,col,mat)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();return new THREE.Mesh(g,mat);};
    const crust=mesh(positions,colors,material({}));crust.name='miniature-terrain';group.add(crust);
    const water=mesh(wetPositions,wetColors,material({roughness:.35,emissive:theme==='volcanic'?0x873012:0x10212a,emissiveIntensity:theme==='volcanic'?.6:.15}));water.name='miniature-sea';group.add(water);
    const dressing=new Map(),up=new THREE.Vector3(0,1,0),transform=new THREE.Object3D();
    for(let i=0;i<1200;i++){
      const y=1-2*(i+.5)/1200,a=i*2.3999632297,r=Math.sqrt(1-y*y);v.set(r*Math.cos(a),y,r*Math.sin(a));
      const h=terrainHeight(v.x,v.y,v.z,false),wet=oceanAt(v.x,v.y,v.z)&&h<0,key=biomeAt(v,h),kind=BIOME_VISUALS[key]?.decor;
      if(!kind||wet&&h<-.8&&!['kelp','coralreef'].includes(kind)||i%3!==0)continue;
      let list=dressing.get(kind);if(!list){list=[];dressing.set(kind,list);}list.push({dir:v.clone(),h});
    }
    for(const [kind,list]of dressing){
      const geometry=kind==='pine'?makePineGeometry():kind==='leaf'||kind==='jungle'?makeBroadleafGeometry():kind==='cactus'?makeCactusGeometry():biomeDressingGeometry(kind);
      const props=new THREE.InstancedMesh(geometry,material({side:THREE.DoubleSide,emissive:kind==='twilight'?0x416768:0x10212a,emissiveIntensity:.3}),list.length);
      props.name='miniature-scenery';
      for(let i=0;i<list.length;i++){const p=list[i];transform.position.copy(p.dir).multiplyScalar((R+p.h)*scale);transform.quaternion.setFromUnitVectors(up,p.dir);transform.scale.setScalar(scale*(kind==='jungle'?3.2:1.8));transform.updateMatrix();props.setMatrixAt(i,transform.matrix);}
      props.instanceMatrix.needsUpdate=true;group.add(props);
    }
    const art=FEATURES.build({scale,spherical:true,point:(dir,h)=>new THREE.Vector3(...dir).multiplyScalar((R+h)*scale),color:dir=>BIOME_VISUALS[biomeAt(new THREE.Vector3(...dir),terrainHeight(...dir,false))]?.rock||0x8c9084,topColor:dir=>BIOME_VISUALS[biomeAt(new THREE.Vector3(...dir),terrainHeight(...dir,false))]?.color||0x859e63});group.add(art);
    for(const surface of FEATURES.surfaces)data.max=Math.max(data.max,surface.top(0,0));
    data.features=FEATURES.surfaces.length;data.vertices=points.length;data.formations=[...new Set(FORMATIONS.modules.filter(m=>m.height>0).map(m=>m.type))];
    group.position.y=15;
    const holder=new THREE.Group();holder.add(group);holder.userData.miniature=data;holder.userData.update=art.userData.update;return holder;
  }finally{Object.assign(CONFIG,saved);initTerrainField(saved.seed);}
}
