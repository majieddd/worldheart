import { buildIcosphere } from '../geodesic.js';
import { isFloorTerrain, travelCost } from '../traversal.js';
import { NEST_CLEARANCE } from '../nest-sites.js';

const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm = v => {const l=Math.hypot(...v);return v.map(n=>n/l);};

// A bounded global inspection graph, separate from the fine combat graph.
// Sample every edge between nodes, so a coarse line cannot bridge a ridge.
// Coarse habitat is deliberately labelled potential; only the battle graph
// certifies current spawn clearance, air access and the 160 m route budget.
export async function createTerrainAtlas({radius, heightAt, slopeAt, heart, pause = async()=>{}}) {
  let yielded=performance.now();
  const cooperate=async()=>{if(performance.now()-yielded>=5){await pause();yielded=performance.now();}};
  const {verts,faces}=buildIcosphere(6),n=verts.length;
  const heights=new Float32Array(n),floor=new Uint8Array(n),habitat=new Uint8Array(n),adj=Array.from({length:n},()=>[]);
  for(let i=0;i<n;i++){
    const p=verts[i],h=heightAt(...p);heights[i]=h;floor[i]=isFloorTerrain(h,slopeAt(...p))?1:0;
    if(floor[i]&&h>=.18&&h<=1.5){
      const axis=norm(Math.abs(p[1])<.93?[-p[2],0,p[0]]:[0,p[2],-p[1]]);
      const side=[p[1]*axis[2]-p[2]*axis[1],p[2]*axis[0]-p[0]*axis[2],p[0]*axis[1]-p[1]*axis[0]];
      let clear=true;
      for(let k=0;k<8;k++){
        const a=k*Math.PI/4,q=norm(p.map((v,j)=>v+(axis[j]*Math.cos(a)+side[j]*Math.sin(a))*NEST_CLEARANCE/radius));
        const hq=heightAt(...q);
        if(hq<.18||hq>1.5||!isFloorTerrain(hq,slopeAt(...q))){clear=false;break;}
      }
      habitat[i]=clear?1:0;
    }
    if(i%32===31)await cooperate();
  }
  function edge(a,b){
    const length=Math.acos(Math.max(-1,Math.min(1,dot(a,b))))*radius,steps=Math.max(1,Math.ceil(length/1.2));
    let previous=heightAt(...a);
    for(let k=1;k<=steps;k++){
      const p=norm(a.map((v,j)=>v+(b[j]-v)*k/steps)),h=heightAt(...p);
      if(!isFloorTerrain(h,slopeAt(...p))||!Number.isFinite(travelCost(previous,h,length/steps)))return false;
      previous=h;
    }
    return true;
  }
  const visitedEdges=new Set();let edgeCount=0;
  for(let f=0;f<faces.length;f++){
    const face=faces[f];
    for(let k=0;k<3;k++){
      const a=face[k],b=face[(k+1)%3],key=Math.min(a,b)*n+Math.max(a,b);
      if(visitedEdges.has(key))continue;visitedEdges.add(key);
      if(floor[a]&&floor[b]&&edge(verts[a],verts[b])){adj[a].push(b);adj[b].push(a);edgeCount++;}
    }
    if(f%32===31)await cooperate();
  }
  // Root at a sampled floor that can actually reach the true base position.
  const near=verts.map((p,i)=>({i,d:dot(p,heart)})).filter(p=>floor[p.i]).sort((a,b)=>b.d-a.d);
  const root=near.slice(0,32).find(p=>edge(verts[p.i],heart))?.i??-1;
  const next=new Int32Array(n).fill(-1),distance=new Float32Array(n).fill(Infinity),queue=new Int32Array(n);
  let head=0,tail=0;
  if(root>=0){queue[tail++]=root;distance[root]=Math.acos(Math.max(-1,Math.min(1,dot(verts[root],heart))))*radius;}
  while(head<tail){
    const a=queue[head++];
    for(const b of adj[a])if(!Number.isFinite(distance[b])){
      next[b]=a;distance[b]=distance[a]+Math.acos(Math.max(-1,Math.min(1,dot(verts[a],verts[b]))))*radius;queue[tail++]=b;
    }
  }
  // Accumulate habitat served by each branch. Display shared corridors,
  // rather than a dense fishbone covering every square metre with a line.
  // Every habitat region still has a contour, including disconnected regions.
  const served=new Uint32Array(n),routes=new Uint8Array(n);let potential=0,connected=0;
  for(let i=0;i<n;i++)if(habitat[i]){
    potential++;if(!Number.isFinite(distance[i]))continue;connected++;served[i]=1;
  }
  for(let k=tail-1;k>=0;k--){const i=queue[k];if(next[i]>=0){served[next[i]]+=served[i];if(served[i]>=10)routes[i]=1;}}
  const contours=[];
  for(const face of faces){
    const crossings=[];
    for(let k=0;k<3;k++){const a=face[k],b=face[(k+1)%3];if(habitat[a]!==habitat[b])crossings.push([a,b]);}
    if(crossings.length===2)contours.push(crossings);
  }
  return {verts,heights,habitat,next,distance,routes,contours,root,
    stats:{nodes:n,edgeCount,potential,connected,disconnected:potential-connected,floor:floor.reduce((a,b)=>a+b,0),reached:tail}};
}
