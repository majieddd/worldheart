import * as THREE from 'three';
import {STRUCTURES} from './run/structures.js';
import {paintedBox} from './painted-geometry.js';

const mats=new Map();
function mat(color){if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.85,flatShading:true}));return mats.get(color);}
function box(root,size,pos,color){const m=new THREE.Mesh(paintedBox(...size),mat(color));m.position.set(...pos);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
export function buildWall(){
  const root=new THREE.Group();
  for(const x of [-1.45,1.45]){box(root,[.24,2,.24],[x,1,0],0x5e402d);const cap=new THREE.Mesh(new THREE.ConeGeometry(.2,.35,4),mat(0x86603b));cap.rotation.y=Math.PI/4;cap.position.set(x,2.17,0);root.add(cap);}
  for(let i=0;i<7;i++)box(root,[.36,1.65+(i%3)*.06,.16],[-1.14+i*.38,.9,.03],i%2?0x92704b:0x765239);
  for(const y of [.45,1.25])box(root,[3.15,.16,.22],[0,y,.16],0x523c2b);
  return root;
}
export function buildStructure(kind){
  const spec=STRUCTURES[kind]||STRUCTURES.outpost,root=new THREE.Group();root.name='structure-'+kind;
  box(root,[7,.28,6],[0,0,0],spec.color);
  for(const x of [-3,3])for(const z of [-2.4,2.4])box(root,[.5,3.8,.5],[x,1.8,z],spec.color);
  box(root,[6.5,2.6,.4],[0,1.4,-2.6],spec.color);
  // Doorway is a real opening. Side windows and a cut-away front leave the
  // chest readable and the player enough room to enter from either side.
  for(const x of [-3,3])box(root,[.35,1.2,4.8],[x,.7,0],spec.color);
  if(kind==='ruin'){
    for(const x of [-2.3,2.3])box(root,[1.3,2.9,.55],[x,1.5,2.4],spec.color);
    box(root,[6,.6,.8],[0,3.1,2.4],spec.color);
    for(const x of [-2.4,0,2.4])box(root,[.8,.6,.8],[x,3.5,-2.5],spec.roof);
    box(root,[2.5,.25,2.8],[-1.7,3.4,-1],spec.roof);
  }else{
    const roof=box(root,[7.5,.3,6.7],[0,3.7,0],spec.roof);roof.rotation.z=kind==='outpost'?.06:0;
    for(const x of [-2.5,2.5])box(root,[.2,.2,6.4],[x,3.95,0],0xc2b691);
    if(kind==='observatory'){
      const scope=new THREE.Group();scope.position.set(0,4.2,0);scope.rotation.x=-.55;root.add(scope);
      const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.48,.6,3.5,10),mat(spec.color));scope.add(barrel);
      box(root,[1.2,.9,1.2],[0,4,0],spec.roof);
    }else if(kind==='bunker')for(const x of [-3.6,3.6])box(root,[.6,3.5,6],[x,1.6,0],spec.color);
    else{box(root,[.12,2,.12],[2.6,4.7,-2],0x283747);box(root,[.8,.45,.1],[2.2,5.4,-2],0xd8b45c);}
  }
  const chest=new THREE.Group();chest.position.set(0,.3,-.7);root.add(chest);
  box(chest,[1.5,.65,.9],[0,.35,0],0x785538);for(const x of [-.55,.55])box(chest,[.12,.7,.96],[x,.36,0],0xc8ad6b);
  const lid=new THREE.Group();lid.position.set(0,.68,-.45);chest.add(lid);box(lid,[1.6,.25,1],[0,.12,.45],0x9a794d);
  box(chest,[.22,.24,.06],[0,.5,.48],0x76dfe1);
  return {root,chest,lid};
}
