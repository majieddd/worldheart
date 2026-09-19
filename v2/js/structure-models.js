import * as THREE from 'three';
import {STRUCTURES} from './run/structures.js';
import {paintedBox} from './painted-geometry.js';

const mats=new Map();
function mat(color){if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.85,flatShading:true}));return mats.get(color);}
function box(root,size,pos,color){const m=new THREE.Mesh(paintedBox(...size),mat(color));m.position.set(...pos);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
function mergeBuilding(root){
  const p=[],n=[],c=[],normal=new THREE.Vector3(),point=new THREE.Vector3();
  for(const mesh of [...root.children])if(mesh.isMesh&&mesh.material.isMeshStandardMaterial){mesh.updateMatrix();const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,transform=new THREE.Matrix3().getNormalMatrix(mesh.matrix),color=mesh.material.color;
    for(let i=0;i<g.attributes.position.count;i++){point.fromBufferAttribute(g.attributes.position,i).applyMatrix4(mesh.matrix);normal.fromBufferAttribute(g.attributes.normal,i).applyMatrix3(transform).normalize();p.push(point.x,point.y,point.z);n.push(normal.x,normal.y,normal.z);c.push(color.r,color.g,color.b);}
    if(g!==mesh.geometry)g.dispose();mesh.geometry.dispose();root.remove(mesh);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,flatShading:true}));m.castShadow=m.receiveShadow=true;root.add(m);
}
export function buildWall(){
  const root=new THREE.Group();
  for(const x of [-1.45,1.45]){box(root,[.24,2,.24],[x,1,0],0x5e402d);const cap=new THREE.Mesh(new THREE.ConeGeometry(.2,.35,4),mat(0x86603b));cap.rotation.y=Math.PI/4;cap.position.set(x,2.17,0);root.add(cap);}
  for(let i=0;i<7;i++)box(root,[.36,1.65+(i%3)*.06,.16],[-1.14+i*.38,.9,.03],i%2?0x92704b:0x765239);
  for(const y of [.45,1.25])box(root,[3.15,.16,.22],[0,y,.16],0x523c2b);
  mergeBuilding(root);return root;
}
export function buildStructure(kind){
  const spec=STRUCTURES[kind]||STRUCTURES.outpost,root=new THREE.Group();root.name='structure-'+kind;
  box(root,[7,.28,6],[0,0,0],spec.color);
  for(const x of [-3,3])for(const z of [-2.4,2.4])box(root,[.5,3.8,.5],[x,1.8,z],spec.color);
  box(root,[6.5,2.6,.4],[0,1.4,-2.6],spec.color);
  // Doorway is a real opening. Side windows and a cut-away front leave the
  // chest readable and the player enough room to enter from either side.
  for(const x of [-3,3])box(root,[.35,1.2,4.8],[x,.7,0],spec.color);
  if(kind==='ruin'||kind==='temple'){
    for(const x of [-2.3,2.3])box(root,[1.3,2.9,.55],[x,1.5,2.4],spec.color);
    box(root,[6,.6,.8],[0,3.1,2.4],spec.color);
    for(const x of [-2.4,0,2.4])box(root,[.8,.6,.8],[x,3.5,-2.5],spec.roof);
    box(root,[2.5,.25,2.8],[-1.7,3.4,-1],spec.roof);
    if(kind==='temple'){
      for(const x of [-2.3,2.3])for(const z of [-1.6,.8]){const column=new THREE.Mesh(new THREE.CylinderGeometry(.3,.4,4.4,10),mat(spec.color));column.position.set(x,2.2,z);root.add(column);box(root,[.9,.25,.9],[x,4.4,z],spec.roof);}
      for(let i=0;i<3;i++)box(root,[5.8-i*.8,.3,4.4-i*.6],[0,4.6+i*.3,-.5],spec.roof);
      for(let i=0;i<3;i++)box(root,[3.8-i*.25,.14,1.1],[0,.02+i*.08,3.6-i*.6],spec.color);
    }else{
      const fallen=box(root,[.8,.7,3.6],[-2.7,.42,.9],spec.color);fallen.rotation.y=-.5;
      for(let i=0;i<6;i++){const rubble=new THREE.Mesh(new THREE.DodecahedronGeometry(.22+i%3*.1),mat(i%2?spec.roof:spec.color));rubble.scale.y=.65;rubble.position.set(-1.5+Math.sin(i*2.4)*1.8,.2,2.7+Math.cos(i*2.4)*.7);root.add(rubble);}
    }
  }else if(kind==='cottage'){
    for(const side of [-1,1]){const roof=box(root,[4.6,.32,7.2],[side*1.82,4.62,0],spec.roof);roof.rotation.z=-side*.48;}
    box(root,[.55,2,.6],[2.1,5.2,-1.5],0x887c71);
    for(const x of [-3,0,3])box(root,[.2,3.7,.25],[x,1.7,-2.85],0x614937);
    for(const z of [-1,1]){const beam=box(root,[.18,2.1,.19],[3.24,1.7,z],0x715943);beam.rotation.x=.55;}
    for(const x of [-3,3])box(root,[.25,3.2,.25],[x,1.6,3.8],0x614937);
    box(root,[7,.22,2],[0,3.1,3.2],spec.roof);
  }else{
    const roof=box(root,[7.5,.3,6.7],[0,3.7,0],spec.roof);roof.rotation.z=kind==='outpost'?.06:0;
    for(const x of [-2.5,2.5])box(root,[.2,.2,6.4],[x,3.95,0],0xc2b691);
    if(kind==='tenement'){
      box(root,[6.4,3.4,5.7],[0,5.6,0],spec.color);box(root,[7,.32,6.3],[0,7.45,0],spec.roof);
      for(const x of [-2,0,2])for(const y of [4.6,6.25]){box(root,[1.1,1.1,.18],[x,y,2.92],0x344958);box(root,[1.35,.15,.35],[x,y-.58,3],0xd3c4a6);box(root,[.07,1.15,.2],[x,y,3.04],0xb2c4bb);}
      const awning=box(root,[5.8,.16,2],[0,3,3.1],0xa45e4f);awning.rotation.x=.16;
    }else if(kind==='relay'){
      box(root,[.4,3.2,.4],[0,5.2,0],spec.roof);const dish=new THREE.Mesh(new THREE.SphereGeometry(1.8,20,12,0,Math.PI*2,0,Math.PI*.42),mat(spec.color));dish.rotation.x=.7;dish.position.set(0,6.8,0);root.add(dish);box(root,[.12,2.1,.12],[0,7.3,.5],spec.roof);
    }else if(kind==='observatory'){
      const dome=new THREE.Mesh(new THREE.SphereGeometry(2.65,24,12,5.1,Math.PI*2-1.1,0,Math.PI/2),mat(spec.roof));dome.position.y=3.75;root.add(dome);
      const collar=new THREE.Mesh(new THREE.CylinderGeometry(2.8,2.9,.3,24),mat(spec.color));collar.position.y=3.82;root.add(collar);
      const scope=new THREE.Group();scope.position.set(0,5.1,0);scope.rotation.x=-.55;root.add(scope);
      const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.48,.6,3.5,10),mat(spec.color));scope.add(barrel);
      box(root,[1.2,.9,1.2],[0,4,0],spec.roof);
    }else if(kind==='bunker')for(const x of [-3.6,3.6])box(root,[.6,3.5,6],[x,1.6,0],spec.color);
    else{box(root,[.12,2,.12],[2.6,4.7,-2],0x283747);box(root,[.8,.45,.1],[2.2,5.4,-2],0xd8b45c);}
  }
  // Shared building grammar: readable foundations, lintels, window frames,
  // stone courses, a lamp and supplies instead of featureless cuboids.
  for(const y of [.2,1.4,2.8])box(root,[6.7,.16,.16],[0,y,-2.85],spec.roof);
  for(const x of [-3.03,3.03])for(const z of [-1.6,1.6]){box(root,[.4,1.1,1.1],[x,2.4,z],0x354f59);box(root,[.52,.12,1.35],[x,1.82,z],spec.roof);}
  for(let i=0;i<8;i++)box(root,[.75,.15,.48],[-2.85+(i%4)*1.9,-.08,3.35+Math.floor(i/4)*.7],i%2?0x8e937c:0xa6a68b);
  box(root,[.55,.65,.45],[-2.1,1.15,-1.75],0x806042);box(root,[.66,.12,.55],[-2.1,1.5,-1.75],0xb7a16f);
  box(root,[.16,.5,.18],[2.7,2.8,2.75],0x343e43);const lamp=new THREE.Mesh(new THREE.SphereGeometry(.19,8,6),new THREE.MeshBasicMaterial({color:0xffd995}));lamp.position.set(2.7,2.75,2.87);root.add(lamp);
  mergeBuilding(root);
  const chest=new THREE.Group();chest.position.set(0,.3,-.7);root.add(chest);
  box(chest,[1.5,.65,.9],[0,.35,0],0x785538);for(const x of [-.55,.55])box(chest,[.12,.7,.96],[x,.36,0],0xc8ad6b);
  const lid=new THREE.Group();lid.position.set(0,.68,-.45);chest.add(lid);box(lid,[1.6,.25,1],[0,.12,.45],0x9a794d);
  box(chest,[.22,.24,.06],[0,.5,.48],0x76dfe1);
  return {root,chest,lid};
}
