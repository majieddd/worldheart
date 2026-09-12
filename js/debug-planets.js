import * as THREE from 'three';
import {CONFIG,TERRAIN_PROFILES} from './config.js';
import {planetEnvironment} from './run/planet-environments.js';
import {buildIcosphere} from './geodesic.js';
import {R,initTerrainField,terrainHeight,oceanAt,biomeAt,faceColor,terrainThermal,FORMATIONS,makePineGeometry,makeBroadleafGeometry,makeCactusGeometry} from './world.js';
import {BIOME_VISUALS,THEME_SURFACES,biomeDressingGeometry} from './biome-visuals.js';

export const MINIATURE_SEED=4206018157;
const stone=new THREE.Color(),sea=new THREE.Color(),v=new THREE.Vector3(),normal=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
const material=extra=>new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.7,...extra});

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
    const sphere=buildIcosphere(6),points=sphere.verts.map(p=>{const h=terrainHeight(p[0],p[1],p[2],false);data.min=Math.min(data.min,h);data.max=Math.max(data.max,h);return new THREE.Vector3(...p).multiplyScalar((R+h)*scale);});
    const positions=[],colors=[],wetPositions=[],wetColors=[];
    for(const f of sphere.faces){
      const a=points[f[0]],b=points[f[1]],c=points[f[2]];v.copy(a).add(b).add(c).normalize();
      const h=terrainHeight(v.x,v.y,v.z,false),wet=oceanAt(v.x,v.y,v.z),biome=biomeAt(v,h);
      data.biomes[biome]=(data.biomes[biome]||0)+1;
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
      if(!kind||wet&&h<-.8||i%3!==0)continue;
      let list=dressing.get(kind);if(!list){list=[];dressing.set(kind,list);}list.push({dir:v.clone(),h});
    }
    for(const [kind,list]of dressing){
      const geometry=kind==='pine'?makePineGeometry():kind==='leaf'||kind==='jungle'?makeBroadleafGeometry():kind==='cactus'?makeCactusGeometry():biomeDressingGeometry(kind);
      const props=new THREE.InstancedMesh(geometry,material({emissive:kind==='twilight'?0x416768:0x10212a,emissiveIntensity:.3}),list.length);
      props.name='miniature-scenery';
      for(let i=0;i<list.length;i++){const p=list[i];transform.position.copy(p.dir).multiplyScalar((R+p.h)*scale);transform.quaternion.setFromUnitVectors(up,p.dir);transform.scale.setScalar(scale*(kind==='jungle'?3.2:1.8));transform.updateMatrix();props.setMatrixAt(i,transform.matrix);}
      props.instanceMatrix.needsUpdate=true;group.add(props);
    }
    data.vertices=points.length;data.formations=[...new Set(FORMATIONS.modules.filter(m=>m.height>0).map(m=>m.type))];
    group.position.y=15;
    const holder=new THREE.Group();holder.add(group);holder.userData.miniature=data;return holder;
  }finally{Object.assign(CONFIG,saved);initTerrainField(saved.seed);}
}
