// Standalone experiment: no campaign state, rendering or save dependencies.
import {mulberry32, smoothstep} from '../noise.js';

export const KIT_VERSION = 1;
const key = (a,b) => a<b ? `${a}:${b}` : `${b}:${a}`;
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
const mean = points => [0,1].map(k=>points.reduce((s,p)=>s+p[k],0)/points.length);
const ordered = (ids,points) => {const c=mean(ids.map(i=>points[i]));return ids.sort((a,b)=>Math.atan2(points[a][1]-c[1],points[a][0]-c[0])-Math.atan2(points[b][1]-c[1],points[b][0]-c[0]));};
export const convex = (face,points) => face.every((v,i)=>cross(points[v],points[face[(i+1)%4]],points[face[(i+2)%4]])>1e-7);

export function createQuadPatch(seed, rings=5, spacing=18) {
  if(!Number.isInteger(rings)||rings<2||rings>12||!Number.isFinite(spacing)||spacing<4)throw Error('Invalid patch dimensions');
  const rng=mulberry32(seed), points=[], ids=new Map(), triangles=[];
  for(let q=-rings;q<=rings;q++)for(let r=-rings;r<=rings;r++){
    if(Math.abs(q+r)>rings)continue;
    ids.set(`${q},${r}`,points.length);points.push([(q+r*.5)*spacing,r*spacing*Math.sqrt(3)/2]);
  }
  const triangle = coords => {const t=coords.map(c=>ids.get(c.join(',')));if(t.every(i=>i!==undefined))triangles.push(t);};
  for(let q=-rings;q<rings;q++)for(let r=-rings;r<rings;r++){
    triangle([[q,r],[q+1,r],[q,r+1]]);triangle([[q+1,r],[q+1,r+1],[q,r+1]]);
  }
  const edges=new Map();
  triangles.forEach((t,i)=>t.forEach((a,k)=>{const e=key(a,t[(k+1)%3]);if(!edges.has(e))edges.set(e,[]);edges.get(e).push(i);}));
  const pairs=[...edges.values()].filter(e=>e.length===2);
  for(let i=pairs.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[pairs[i],pairs[j]]=[pairs[j],pairs[i]];}
  const used=new Set(), polygons=[];
  for(const [a,b] of pairs){if(used.has(a)||used.has(b))continue;const f=ordered([...new Set([...triangles[a],...triangles[b]])],points);if(!convex(f,points))continue;polygons.push(f);used.add(a);used.add(b);}
  triangles.forEach((t,i)=>{if(!used.has(i))polygons.push(t);});
  const mids=new Map(), quads=[];
  const midpoint=(a,b)=>{const k=key(a,b);if(!mids.has(k)){mids.set(k,points.length);points.push(mean([points[a],points[b]]));}return mids.get(k);};
  // One subdivision of ORIGINAL triangles and merged quads. Shared midpoint IDs
  // prevent hanging vertices where a triangle meets a quad.
  for(const f of polygons){const c=points.length;points.push(mean(f.map(i=>points[i])));f.forEach((a,i)=>quads.push([a,midpoint(a,f[(i+1)%f.length]),c,midpoint(f[(i+f.length-1)%f.length],a)]));}
  const adjacency=points.map(()=>new Set()), incidence=points.map(()=>[]), counts=new Map();
  quads.forEach((f,i)=>f.forEach((a,k)=>{incidence[a].push(i);const b=f[(k+1)%4];adjacency[a].add(b);adjacency[b].add(a);const e=key(a,b);counts.set(e,(counts.get(e)||0)+1);}));
  const boundary=new Set([...counts].filter(([,n])=>n===1).flatMap(([k])=>k.split(':').map(Number)));
  for(let iteration=0;iteration<10;iteration++){
    const targets=points.map((p,i)=>boundary.has(i)?p:mean([...adjacency[i]].map(j=>points[j])));
    for(let rate=.35;rate>.01;rate*=.5){const next=points.map((p,i)=>p.map((x,k)=>x+(targets[i][k]-x)*rate));if(quads.every(f=>convex(f,next))){points.splice(0,points.length,...next);break;}}
  }
  return {seed,points,quads,adjacency:adjacency.map(s=>[...s]),incidence,boundary:[...boundary],edgeCounts:[...counts],radius:rings*spacing};
}

export function bilerp(values,u,v) {return values[0]*(1-u)*(1-v)+values[1]*u*(1-v)+values[2]*u*v+values[3]*(1-u)*v;}
export function positionAt(points,face,u,v) {return [0,1].map(k=>bilerp(face.map(i=>points[i][k]),u,v));}

export function inverseQuad(points,face,x,z) {
  const [p,q,r,s]=face.map(i=>points[i]),ax=q[0]-p[0],az=q[1]-p[1],bx=s[0]-p[0],bz=s[1]-p[1],cx=p[0]-q[0]+r[0]-s[0],cz=p[1]-q[1]+r[1]-s[1],px=x-p[0],pz=z-p[1];
  // Analytic inversion avoids Newton iterates escaping a highly skewed quad.
  // Such a miss used to look like a hole in a perfectly closed rendered patch.
  const a=az*cx-ax*cz,b=px*cz-pz*cx-ax*bz+az*bx,c=px*bz-pz*bx;
  let roots;
  if(Math.abs(a)<1e-10){if(Math.abs(b)<1e-12)return null;roots=[-c/b];}
  else{const disc=b*b-4*a*c;if(disc<0)return null;const q=-.5*(b+(b>=0?1:-1)*Math.sqrt(disc));roots=Math.abs(q)<1e-14?[-b/(2*a)]:[q/a,c/q];}
  for(const u of roots){
    if(u< -1e-7||u>1+1e-7)continue;
    const dx=bx+cx*u,dz=bz+cz*u,v=Math.abs(dx)>Math.abs(dz)?(px-ax*u)/dx:(pz-az*u)/dz;
    if(v>=-1e-7&&v<=1+1e-7)return [Math.max(0,Math.min(1,u)),Math.max(0,Math.min(1,v))];
  }
  return null;
}

// Four shared corner levels define stacked versions of the six symmetry cases.
// The transition curve is authored once. No per-piece random edge displacement.
export function terraceHeight(levels,u,v,step=8) {
  const lo=Math.min(...levels),hi=Math.max(...levels);let height=lo*step;
  for(let layer=lo+1;layer<=hi;layer++){
    const occupancy=bilerp(levels.map(h=>h>=layer?1:0),u,v);
    height+=step*smoothstep(.24,.76,occupancy);
  }
  return height;
}

export function graphPath(points,adjacency,start,goal,cost=()=>1) {
  const distances=new Float64Array(points.length).fill(Infinity),prev=new Int32Array(points.length).fill(-1),closed=new Uint8Array(points.length);
  distances[start]=0;
  for(let n=0;n<points.length;n++){
    let current=-1,best=Infinity;for(let i=0;i<points.length;i++)if(!closed[i]&&distances[i]<best){current=i;best=distances[i];}
    if(current<0)break;if(current===goal){const path=[];for(let i=goal;i!==-1;i=prev[i])path.push(i);return path.reverse();}
    closed[current]=1;
    for(const next of adjacency[current]){const d=Math.hypot(points[current][0]-points[next][0],points[current][1]-points[next][1])*cost(current,next);if(best+d<distances[next]){distances[next]=best+d;prev[next]=current;}}
  }
  return [];
}

export function segmentDistance(p,a,b) {
  const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);
}
