import * as THREE from 'three';

export function createStudyScene(system){
  const scene=new THREE.Scene(),world=new THREE.Group(),specimens=new THREE.Group();scene.add(world,specimens);specimens.visible=false;
  const units=[],turrets=[],details=[],outlines=[];
  const {materials,outline,edges}=system;
  let randomSeed=73921;
  const rand=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
  const surface=(x,z)=>-0.014*(x*x+z*z)+Math.sin(x*0.6)*Math.cos(z*0.5)*0.17;
  function mesh(parent,geometry,material,position=[0,0,0],scale=[1,1,1],lined=true){
    const m=new THREE.Mesh(geometry,materials.get(material));m.position.set(...position);m.scale.set(...scale);parent.add(m);
    if(lined){const shell=new THREE.Mesh(geometry,outline);shell.layers.set(1);m.add(shell);outlines.push(shell);}
    return m;
  }
  function box(parent,size,position,material='armor',seams=false){const m=mesh(parent,new THREE.BoxGeometry(...size),material,position);if(seams){const e=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry,30),edges);e.layers.set(1);m.add(e);details.push(e);}return m;}
  function cylinder(parent,r1,r2,h,position,material='armor',sides=8){return mesh(parent,new THREE.CylinderGeometry(r1,r2,h,sides),material,position);}
  function rock(parent,x,z,rx,rz,height,ground=surface(x,z),seed=0){
    const vertices=[],indices=[],sides=11,levels=6;
    for(let j=0;j<levels;j++)for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2;const f=1.0-j*0.045+(j%2)*0.1+Math.sin(i*8.3+seed)*0.06;vertices.push(Math.cos(a)*rx*f,ground+j/(levels-1)*height+Math.sin(i*2.4+seed)*0.16,Math.sin(a)*rz*f);}
    vertices.push(0,ground+height,0);const top=vertices.length/3-1;
    for(let j=0;j<levels-1;j++)for(let i=0;i<sides;i++){const n=(i+1)%sides,a=j*sides+i,b=j*sides+n,c=(j+1)*sides+i,d=(j+1)*sides+n;indices.push(a,c,b,b,c,d);}
    for(let i=0;i<sides;i++)indices.push(top,(levels-1)*sides+(i+1)%sides,(levels-1)*sides+i);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
    const r=mesh(parent,geo,'rock',[x,0,z]);return r;
  }
  const terrainVertices=[0,surface(0,0),0],terrainIndices=[],rings=18,segs=100,radius=13;
  for(let j=1;j<=rings;j++)for(let i=0;i<segs;i++){const a=i/segs*Math.PI*2,rr=j/rings*radius*(1+0.035*Math.sin(a*5)+0.02*Math.cos(a*9)),x=Math.cos(a)*rr,z=Math.sin(a)*rr;terrainVertices.push(x,surface(x,z),z);}
  for(let i=0;i<segs;i++)terrainIndices.push(0,1+(i+1)%segs,1+i);
  for(let j=1;j<rings;j++)for(let i=0;i<segs;i++){const a=1+(j-1)*segs+i,b=1+(j-1)*segs+(i+1)%segs,c=a+segs,d=b+segs;terrainIndices.push(a,b,c,b,d,c);}
  const terrain=new THREE.BufferGeometry();terrain.setAttribute('position',new THREE.Float32BufferAttribute(terrainVertices,3));terrain.setIndex(terrainIndices);terrain.computeVertexNormals();mesh(world,terrain,'soil',undefined,undefined,false);
  rock(world,0,0,13.0,13.0,5.2,-7.5,8);
  // These layered buttresses leave a valley between the foreground scouts and
  // the heart. Broad silhouettes expose the lighting without dense game clutter.
  for(const [x,z,rx,rz,h,s] of [[-8,-4,3.5,3.6,5.5,2],[-5,-8,4.0,2.8,6.3,3],[1,-10,3.2,2.0,4.9,4],[7,-6,3.6,3.3,6.5,6],[10,-1,2.5,3.2,4.1,8],[-10,2,2.0,2.7,3.4,7]])rock(world,x,z,rx,rz,h,undefined,s);
  for(let i=0;i<25;i++){const a=rand()*6.28,r=4+rand()*8,x=Math.cos(a)*r,z=Math.sin(a)*r;rock(world,x,z,0.18+rand()*0.55,0.18+rand()*0.5,0.15+rand()*0.6,undefined,i);}
  function shrub(parent,x,z,size=1,ground=surface(x,z)){
    const g=new THREE.Group();g.position.set(x,ground,z);parent.add(g);
    for(let i=0;i<6;i++){const a=i*2.4,r=0.35*size;const m=mesh(g,new THREE.IcosahedronGeometry(1,0),'foliage',[Math.cos(a)*r,0.45*size+rand()*0.25,Math.sin(a)*r],[size*0.43,size*0.7,size*0.43]);m.rotation.z=(rand()-0.5)*0.7;}
    return g;
  }
  for(const [x,z,s] of [[-8,5,1.2],[7,6,1.4],[-5,9,1.1],[8,2,1],[3,-5,0.7],[-3,-5,0.8],[-10,0,1.1],[4,9,0.7],[-7,-1,0.8],[10,4,0.8]])shrub(world,x,z,s);
  function pad(parent,r,y=0){return cylinder(parent,r,r+0.15,0.25,[0,y,0],'dark',10);}
  const heart=new THREE.Group();heart.position.set(0,surface(0,-1.7),-1.7);world.add(heart);pad(heart,1.5);cylinder(heart,1.05,1.35,0.5,[0,0.35,0],'trim');
  const crystal=mesh(heart,new THREE.OctahedronGeometry(1,0),'crystal',[0,2.1,0],[0.9,1.85,0.9]);
  for(let i=0;i<3;i++){const a=i*2.094;mesh(heart,new THREE.OctahedronGeometry(1,0),'crystal',[Math.cos(a)*0.85,0.85,Math.sin(a)*0.85],[0.28,0.75,0.28]);}
  function tower(x,z,type){const g=new THREE.Group();g.position.set(x,surface(x,z),z);world.add(g);pad(g,1.15);cylinder(g,0.6,0.9,1.5,[0,0.95,0]);box(g,[1.3,0.25,1.3],[0,1.7,0],'trim');
    for(let i=0;i<4;i++){const a=i*Math.PI/2;const leg=box(g,[0.25,1.0,0.35],[Math.sin(a)*0.8,0.55,Math.cos(a)*0.8],'dark');leg.rotation.z=Math.cos(a)*0.2;}
    const head=new THREE.Group();head.position.y=2;g.add(head);
    if(type==='cannon'){box(head,[1.6,0.8,1.4],[0,0,0],'armor',true);box(head,[0.5,0.4,2.1],[0,0,1.15],'dark',true);box(head,[0.65,0.6,0.4],[0,0,2.1],'trim');box(head,[1,0.15,0.6],[0,0.48,0],'crystal');}
    else{cylinder(head,0.55,0.8,0.6,[0,0.2,0],'armor');mesh(head,new THREE.OctahedronGeometry(0.7),'crystal',[0,1.2,0],[0.7,1.5,0.7]);for(let i=0;i<3;i++){const a=i*2.094;box(head,[0.2,1.3,0.2],[Math.sin(a)*0.72,0.55,Math.cos(a)*0.72],'trim');}}
    turrets.push(head);return g;
  }
  tower(-4,1,'cannon');tower(4,-1,'energy');tower(5.5,4,'cannon');
  function scout(x,z,scale=1){const root=new THREE.Group();root.position.set(x,surface(x,z),z);root.scale.setScalar(scale);world.add(root);const body=new THREE.Group();root.add(body);
    box(body,[0.94,0.95,0.55],[0,1.4,0],'armor',true);box(body,[0.76,0.2,0.66],[0,0.88,0],'dark');box(body,[0.66,0.75,0.28],[0,1.42,-0.4],'dark',true);box(body,[0.45,0.13,0.03],[0,1.62,0.29],'crystal');
    cylinder(body,0.31,0.34,0.62,[0,2.17,0],'skin',10);box(body,[0.48,0.12,0.17],[0,2.2,0.28],'dark');
    const limbs=[];
    for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*0.65,1.72,0);body.add(arm);box(arm,[0.36,0.8,0.45],[0,-0.28,0],'armor');box(arm,[0.29,0.21,0.33],[0,-0.76,0],'skin');arm.rotation.x=-0.23;
      const leg=new THREE.Group();leg.position.set(side*0.26,0.84,0);root.add(leg);box(leg,[0.39,0.63,0.46],[0,-0.27,0],'armor');box(leg,[0.44,0.22,0.63],[0,-0.64,0.09],'dark');limbs.push({arm,leg,side});
      if(side===1){box(arm,[0.18,0.22,1.15],[0,-0.55,0.55],'dark',true);box(arm,[0.23,0.24,0.2],[0,-0.55,1.12],'trim');}}
    units.push({root,body,limbs,x,z});return root;
  }
  scout(-1.7,5.0,1.25);scout(1.1,7.0,1);scout(-4.2,6.8,0.95);
  // The defense ring and paint dashes are physical geometry on the terrain.
  const ringPts=[];for(let i=0;i<=100;i++){const a=i/100*6.283,r=3.1,x=Math.cos(a)*r,z=Math.sin(a)*r-1.7;ringPts.push(new THREE.Vector3(x,surface(x,z)+0.035,z));}
  const curve=new THREE.CatmullRomCurve3(ringPts);mesh(world,new THREE.TubeGeometry(curve,100,0.035,4,false),'crystal',undefined,undefined,false);
  for(let i=0;i<10;i++){const z=1+i*0.75;const mark=box(world,[0.10,0.015,0.27],[-0.15,surface(-0.15,z)+0.03,z],'trim');mark.rotation.y=0.08;}
  for(let i=0;i<4;i++){const x=(i-1.5)*3.2;const p=new THREE.Group();p.position.x=x;specimens.add(p);pad(p,1.15,-0.25);
    if(i===0)rock(p,0,0,0.85,0.75,1.9,-0.12,4);
    if(i===1){box(p,[1.4,1.6,1.2],[0,0.7,0],'armor',true);box(p,[1.5,0.25,1.3],[0,1.25,0],'trim',true);box(p,[0.8,0.15,0.04],[0,0.8,0.62],'crystal');}
    if(i===2)shrub(p,0,0,1.3,-0.2);
    if(i===3)mesh(p,new THREE.OctahedronGeometry(1,0),'crystal',[0,1,0],[0.78,1.5,0.78]);
  }
  function animate(t,moving){for(let i=0;i<units.length;i++){const u=units[i],phase=t*2.8+i*1.6;u.root.rotation.y=0.4+Math.sin(t*0.4+i)*0.3;u.body.position.y=moving?Math.sin(phase*2)*0.035:0;for(const l of u.limbs){l.leg.rotation.x=moving?Math.sin(phase)*0.22*l.side:0;l.arm.rotation.x=-0.23+(moving?Math.sin(phase)*-0.17*l.side:0);}}for(let i=0;i<turrets.length;i++)turrets[i].rotation.y=-0.4+Math.sin(t*0.35+i)*0.5;crystal.rotation.y=t*0.18;}
  return {scene,world,specimens,units,turrets,outlines,details,animate,surface};
}
