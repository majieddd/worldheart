import * as THREE from 'three';
import {NEW_BIOMES,NEW_PLANET_THEMES} from './run/world-catalogue.js';
import {appendBiomeDressing} from './biome-dressing.js';

// Shared visual catalogue for the battlefield and Debug World. Colors are
// surface identities; placement still uses the visible hot/cold rules.
export const BIOME_VISUALS = Object.freeze({
  ...Object.fromEntries(Object.entries(NEW_BIOMES).map(([key,b])=>[key,{...b,color:b.ground}])),
  meadow:{name:'Meadow',color:0x70964e,decor:'leaf'},
  woodland:{name:'Woodland',color:0x3f6a42,decor:'pine'},
  jungle:{name:'Jungle',color:0x205236,decor:'jungle'},
  desert:{name:'Desert',color:0xd4a45e,decor:'cactus'},
  savanna:{name:'Savanna',color:0xa4a058,decor:'leaf'},
  wetland:{name:'Wetlands',color:0x477e68,decor:'reed'},
  mangrove:{name:'Mangrove delta',color:0x467665,decor:'mangrove'},
  tundra:{name:'Tundra',color:0xc0d9e1,decor:'ice'},
  alpine:{name:'Alpine ice',color:0xe0edf0,decor:'ice'},
  volcanic:{name:'Lava crust',color:0x38303a,decor:'vent'},
  ocean:{name:'Ocean',color:0x238eae,decor:'coral'},
  crystalline:{name:'Crystal gardens',color:0x82679f,decor:'crystalline'},
  fungal:{name:'Fungal carpet',color:0x793c6a,decor:'fungal'},
  ferrous:{name:'Iron badlands',color:0xa7432e,decor:'ferrous'},
  twilight:{name:'Luminous thicket',color:0x263c79,decor:'twilight'},
});
export const THEME_SURFACES = Object.freeze({
  ...Object.fromEntries(Object.entries(NEW_PLANET_THEMES).map(([key,t])=>[key,{biome:t.biomes[0],water:t.water,shore:t.shore,note:t.note}])),
  temperate:{biome:'meadow',water:0x176278,shore:0x2fb4ae,note:'Meadows, forests and latitude belts. Balanced terrain.'},
  monsoon:{biome:'jungle',water:0x154c47,shore:0x42a783,note:'Dense canopy and humid green highlands. Ravines and karst divide forest routes.'},
  arid:{biome:'desert',water:0x427e7c,shore:0x74bda2,note:'Sandstone, cactus and sparse oases. More exposed land and eroded terrain.'},
  frozen:{biome:'tundra',water:0x6fadc6,shore:0xb1e7ea,note:'Ice and pale seas. Cryo towers claim cold raised ground.'},
  volcanic:{biome:'volcanic',water:0x8c2917,shore:0xf8a137,note:'Molten seas and fissured basalt. Cooled floor routes; Mortars claim hot heights. Seas slow movement.'},
  crystalline:{biome:'crystalline',water:0x433466,shore:0xaf93d1,note:'Violet mineral crust and tall prism clusters. Blade fields and impact rings.'},
  fungal:{biome:'fungal',water:0x44224e,shore:0xc475b9,note:'Plum-colored soil and giant mushroom groves. Broad basins and joined sinkholes.'},
  oceanic:{biome:'wetland',water:0x095686,shore:0x37d0ca,note:'Turquoise seas, coral and island canopies. More swimming and coastal approaches.'},
  ferrous:{biome:'ferrous',water:0x543626,shore:0xb87a48,note:'Rust-red stone and dark iron blades. Dry wind fins and radial channels.'},
  twilight:{biome:'twilight',water:0x171e58,shore:0x5b77ce,note:'Cobalt terrain and luminous branching flora. Spirals and polygon fields.'},
});
const cliff=new THREE.Color();
export function paintBiome(out,key,height,slope,variation=.5){
  const recipe=BIOME_VISUALS[key]||BIOME_VISUALS.meadow;
  out.setHex(recipe.color);
  cliff.setHex(recipe.rock??(key==='desert'?0x9a6243:key==='ferrous'?0x572f36:key==='crystalline'?0xcba8df:0x65787b));
  if(!['tundra','alpine','volcanic','twilight'].includes(key))out.lerp(cliff,Math.min(.48,Math.max(0,slope-.25)*.35));
  if(height<0&&key!=='ocean')out.multiplyScalar(.82);
  out.multiplyScalar(.92+variation*.16);
  return out;
}

export function biomeDressingGeometry(kind){
  const parts=[];
  const add=(g,color,x=0,y=0,z=0,rz=0)=>{g.rotateZ(rz);g.translate(x,y,z);const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();parts.push([flat,color]);};
  if(appendBiomeDressing(kind,add)){/* Habitat-specific geometry added above. */}
  else if(kind==='mangrove'){
    add(new THREE.CylinderGeometry(.22,.36,2.5,7),0x74674c,0,1.8);
    for(let k=0;k<6;k++){
      const a=k*Math.PI/3,x=Math.cos(a),z=Math.sin(a);
      const root=new THREE.CylinderGeometry(.08,.18,1.8,5);root.rotateZ(-x*.65);root.rotateX(z*.65);
      add(root,0x807951,x*.6,.75,z*.6);
      add(new THREE.IcosahedronGeometry(1.15,0),k%2?0x3b9360:0x5baf68,x*.7,3.1+(k%2)*.4,z*.7);
    }
  }else if(kind==='fungal'){
    for(const [x,z,h,r]of [[0,0,2.7,1.4],[1,.4,1.5,.85],[-.8,.5,1.1,.65]]){
      add(new THREE.CylinderGeometry(.13,.25,h,7),0xb298b6,x,h/2,z);
      add(new THREE.SphereGeometry(r,12,5,0,Math.PI*2,0,Math.PI/2),0xe883ba,x,h,z);
      add(new THREE.CylinderGeometry(r,r*.8,.10,12),0x68ded0,x,h-.02,z);
    }
  }else if(kind==='twilight'||kind==='coral'){
    add(new THREE.CylinderGeometry(.12,.24,2,6),kind==='coral'?0xe2ab7c:0x677eab,0,1);
    for(let k=0;k<5;k++){
      const a=k*Math.PI*2/5,x=Math.cos(a),z=Math.sin(a),h=1.5+(k%2)*.6;
      add(new THREE.CylinderGeometry(.09,.15,1.3,6),kind==='coral'?0xe69093:0x819cc3,x*.5,h,z*.5,-x*.6);
      add(kind==='coral'?new THREE.IcosahedronGeometry(.3,0):new THREE.TorusGeometry(.34,.065,4,9),kind==='coral'?0xe6c779:0x83efb1,x*.8,h+.65,z*.8);
    }
  }else if(kind==='ferrous'){
    for(let k=-2;k<=2;k++)add(new THREE.ConeGeometry(.42,2.4-Math.abs(k)*.35,3),k%2?0x3e3944:0x694338,k*.35,1,0,-k*.32);
  }else if(kind==='vent'){
    add(new THREE.CylinderGeometry(.35,.9,1.6,7),0x39313c,0,.8);
    add(new THREE.CylinderGeometry(.27,.29,.08,7),0xff983c,0,1.6);
    for(let k=0;k<3;k++)add(new THREE.OctahedronGeometry(.17),0xffc270,(k-1)*.15,1.9+k*.35,0);
  }else if(kind==='reed'){
    for(let k=0;k<7;k++)add(new THREE.ConeGeometry(.13,1.3+(k%3)*.3,4),0x759961,Math.sin(k)*.5,.7,Math.cos(k)*.5);
  }else{
    for(let k=0;k<5;k++){
      const h=3.1-(k%3)*.7,x=k===0?0:Math.cos(k*1.57)*.7,z=k===0?0:Math.sin(k*1.57)*.7;
      add(new THREE.CylinderGeometry(.3,.4,h,5),kind==='ice'?0xa4e4ef:0xa995dc,x,h/2,z);
      add(new THREE.ConeGeometry(.3,.6,5),kind==='ice'?0xd6f0ef:0x6de2d2,x,h+.3,z);
    }
  }
  const positions=[],colors=[],normals=[];
  for(const [g,hex]of parts){const c=new THREE.Color(hex),p=g.attributes.position,n=g.attributes.normal;
    for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i));colors.push(c.r,c.g,c.b);}g.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;
}
