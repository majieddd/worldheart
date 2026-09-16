import * as THREE from 'three';
import {createPaintedEnvironment} from '../art-candidates/hard-cel-v1/js/painted-environment.js';
import {kit} from './arena-kit.js';
import {attachCanopyLeaves} from './arena-foliage.js';

export function createWorlds(paint){
  const k=kit(paint),meadow=attachCanopyLeaves(createPaintedEnvironment(paint));
  const worlds=[{id:'meadow',name:'Painted meadow',...meadow,sky:'#c8d5cb',sun:'#ffe6b8',ambient:'#e2ebdc',obstacles:[[-10,1,2],[13,-7,2],[-9,-12,1.7],[14,11,1.5],[-14,-10,4],[-5,-4,2.6],[-1,-4,1]]}];
  for(const kind of ['canyon','ruins']){
    const root=new THREE.Group(),height=(x,z)=>.15+Math.sin(x*.19)*.3+Math.cos(z*.22)*.22,obstacles=[],details=[];
    const earth=paint.material(kind==='canyon'?'#c19869':'#788b83'),rock=paint.material(kind==='canyon'?'#b37e66':'#8e9c9c'),edge=paint.material(kind==='canyon'?'#d6ad7e':'#b5b9a1'),deep=paint.material(kind==='canyon'?'#785956':'#4b676e'),green=paint.material(kind==='canyon'?'#869365':'#648c7f',{plant:true}),crystal=paint.material(kind==='canyon'?'#b7d5b5':'#82c9c3',{emissive:.3});
    const terrain=new THREE.PlaneGeometry(120,110,100,90);terrain.rotateX(-Math.PI/2);const p=terrain.attributes.position,colors=[];for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,height(x,z));const c=new THREE.Color(kind==='canyon'?'#f0d2aa':'#b9c3ad');c.multiplyScalar(.85+Math.sin(x*.38+Math.cos(z*.3))*.12);colors.push(c.r,c.g,c.b);}terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();earth.vertexColors=true;k.mesh(root,terrain,earth,[0,0,0],[0,0,0],false);
    function rockAt(x,z,size){const g=new THREE.DodecahedronGeometry(1,1),ps=g.attributes.position;for(let i=0;i<ps.count;i++){const xx=ps.getX(i),yy=ps.getY(i),zz=ps.getZ(i);ps.setXYZ(i,xx*(1+Math.sin(yy*7+zz*5)*.13),yy*(1+Math.cos(xx*6)*.08),zz);}g.computeVertexNormals();const m=k.mesh(root,g,rock,[x,height(x,z)+size*.65,z]);m.scale.set(size,size*.9,size*.85);m.rotation.y=x*.2;}
    for(let i=0;i<15;i++){const a=i/15*Math.PI*2,r=29+(i%3)*2,x=Math.cos(a)*r,z=Math.sin(a)*r;rockAt(x,z,5+i%4);if(kind==='canyon')for(let j=0;j<3;j++){const m=k.mesh(root,new THREE.CylinderGeometry(4.8-j*.7,5.6-j*.6,.5,7),j%2?edge:deep,[x,2+j*1.9,z],[0,i*.2,.03*j]);m.scale.z=.8;}}
    for(const [x,z,r] of [[-12,-2,2],[11,-8,2],[-8,-13,1.6],[13,12,1.6]]){rockAt(x,z,r);obstacles.push([x,z,r*.9]);}
    if(kind==='ruins'){
      for(const [x,z,rot] of [[-12,1,.4],[10,-11,-.35],[0,-20,0]]){const arch=new THREE.Group();root.add(arch);arch.position.set(x,height(x,z),z);arch.rotation.y=rot;for(const side of [-1,1]){obstacles.push([x+side*2.2*Math.cos(rot),z-side*2.2*Math.sin(rot),.65]);k.mesh(arch,k.box(.85,4.4,.9),edge,[side*2.2,2.2,0]);for(let j=0;j<5;j++)k.mesh(arch,k.box(.93,.08,.98),deep,[side*2.2,.7+j*.72,0]);}const curve=new THREE.EllipseCurve(0,4.4,2.2,1.5,0,Math.PI,false,0);const points=curve.getPoints(30).map(p=>new THREE.Vector3(p.x,p.y,0));k.mesh(arch,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),30,.43,8,false),edge);}
      for(let i=0;i<12;i++){const x=-19+(i%4)*12,z=-16+Math.floor(i/4)*14;const c=k.mesh(root,new THREE.OctahedronGeometry(.8),crystal,[x,height(x,z)+1.1,z]);c.scale.set(.6,1.5,.6);details.push(c);}
      for(let i=0;i<8;i++){const x=-19+(i%4)*12,z=17-Math.floor(i/4)*29;const m=k.mesh(root,new THREE.CylinderGeometry(.6,.85,2.4,8),deep,[x,height(x,z)+1.2,z]);m.rotation.z=(i%2?.1:-.14);}
    }else{
      for(let i=0;i<16;i++){const x=Math.cos(i*2.399)*(16+i%3*3),z=Math.sin(i*2.399)*(14+i%4*2);for(let j=0;j<3;j++){const m=k.mesh(root,new THREE.ConeGeometry(.45,1.1,6),green,[x+j*.3,height(x,z)+.45,z],[.1,0,(j-1)*.35]);m.scale.y=1+j*.15;}}
      for(let i=0;i<7;i++)k.mesh(root,k.box(1.7,.18,2.2),edge,[Math.sin(i*.7)*.4,height(0,-10+i*3)+.02,-10+i*3],[0,i*.04,0]);
    }
    // One merged field of curved, tapered leaves gives the close ground scale
    // and painted color variation without a draw call for every blade.
    const leaves=[],leafColors=[],leafColor=new THREE.Color(kind==='canyon'?'#9b9a63':'#86ae8d');
    let seed=kind==='canyon'?731:919;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<330;i++){const x=(random()-.5)*44,z=(random()-.5)*44;if(Math.abs(x)<2.2||obstacles.some(([a,b,r])=>Math.hypot(x-a,z-b)<r+.3))continue;for(let j=0;j<6;j++){const a=random()*Math.PI*2,h=.22+random()*.45,w=.025+random()*.035,bend=.1+random()*.18,bx=x+(random()-.5)*.6,bz=z+(random()-.5)*.6,by=height(bx,bz)+.02,side=[Math.cos(a)*w,0,Math.sin(a)*w],tip=[bx+Math.sin(a)*bend,by+h,bz+Math.cos(a)*bend],mid=[bx+Math.sin(a)*bend*.28,by+h*.55,bz+Math.cos(a)*bend*.28],left=[bx-side[0],by,bz-side[2]],right=[bx+side[0],by,bz+side[2]],ml=[mid[0]-side[0]*.6,mid[1],mid[2]-side[2]*.6],mr=[mid[0]+side[0]*.6,mid[1],mid[2]+side[2]*.6];for(const p of [left,right,ml,right,mr,ml,ml,mr,tip]){leaves.push(...p);const c=leafColor.clone().multiplyScalar(.78+random()*.25);leafColors.push(c.r,c.g,c.b);}}}
    const field=new THREE.BufferGeometry();field.setAttribute('position',new THREE.Float32BufferAttribute(leaves,3));field.setAttribute('color',new THREE.Float32BufferAttribute(leafColors,3));field.computeVertexNormals();const leafMat=paint.material('#ffffff',{plant:true});leafMat.vertexColors=true;k.mesh(root,field,leafMat,[0,0,0],[0,0,0],false);
    for(let i=0;i<45;i++){const x=(random()-.5)*45,z=(random()-.5)*43;if(Math.abs(x)<2.5)continue;const r=.12+random()*.24,m=k.mesh(root,new THREE.DodecahedronGeometry(r,0),i%3?rock:edge,[x,height(x,z)+r*.25,z]);m.scale.set(1.4,.55,.9);m.rotation.y=random()*6;}
    if(kind==='ruins')for(let i=0;i<10;i++){const z=-16+i*3.2,m=k.mesh(root,k.box(1.7,.16,2.0),rock,[Math.sin(i)*.25,height(0,z)+.04,z],[0,Math.sin(i)*.12,0]);m.scale.x=.8+random()*.3;}
    worlds.push({id:kind,name:kind==='canyon'?'Amber canyon':'Moonlit ruins',root,height,obstacles,sky:kind==='canyon'?'#d5b7a0':'#94acb5',sun:kind==='canyon'?'#ffe0b3':'#cce6e1',ambient:kind==='canyon'?'#e0d3b2':'#9cc7d0',animate(t){for(const [i,c] of details.entries())c.rotation.y=Math.sin(t*.25+i)*.2;}});
  }
  for(const w of worlds){w.root.visible=false;w.obstacles.push([-7,9,.95],[7,7,.95],[0,15,.95]);w.blocked=(x,z,r=.4)=>Math.abs(x)>21-r||z>21-r||z< -18+r||w.obstacles.some(([a,b,c])=>Math.hypot(x-a,z-b)<c+r);}
  return worlds;
}

// Small navigation grid, rebuilt only when the selected environment changes.
// Steering follows collision-clear waypoints; diagonal corners cannot cut rocks.
export function navigation(world){
  const step=1.2,N=36,origin=-21,blocked=Array.from({length:N*N},(_,i)=>world.blocked(origin+(i%N)*step,origin+Math.floor(i/N)*step,.7));
  const index=(x,z)=>THREE.MathUtils.clamp(Math.round((z-origin)/step),0,N-1)*N+THREE.MathUtils.clamp(Math.round((x-origin)/step),0,N-1),point=i=>new THREE.Vector3(origin+(i%N)*step,0,origin+Math.floor(i/N)*step);
  function route(from,to){const start=index(from.x,from.z),goal=index(to.x,to.z),queue=[start],came=new Int16Array(N*N).fill(-1);came[start]=start;let cursor=0,end=start,best=Infinity;
    while(cursor<queue.length){const at=queue[cursor++],x=at%N,z=Math.floor(at/N),d=(x-goal%N)**2+(z-Math.floor(goal/N))**2;if(d<best){end=at;best=d;}if(at===goal)break;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const nx=x+dx,nz=z+dz,next=nz*N+nx;if(nx<0||nx>=N||nz<0||nz>=N||came[next]>=0||blocked[next]||(dx&&dz&&(blocked[z*N+nx]||blocked[nz*N+x])))continue;came[next]=at;queue.push(next);}}
    const out=[];while(end!==start&&end>=0){out.unshift(point(end));end=came[end];}return out;
  }
  return {route};
}
