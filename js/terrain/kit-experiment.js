import {createFormationField} from './formations.js';
import {TERRAIN_PACKS} from '../run/world-catalogue.js';
import {smoothstep} from '../noise.js';
import {KIT_VERSION,createQuadPatch,positionAt,inverseQuad,terraceHeight,graphPath,segmentDistance} from './quad-kit.js';

export const PRESETS=['varied','badlands','canyon'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const nearest=(points,p,score=()=>0)=>points.reduce((best,v,i)=>distance(v,p)+score(i)<distance(points[best],p)+score(best)?i:best,0);

export function createExperiment(seed=12345,preset='varied') {
  if(!Number.isInteger(seed)||seed<0||seed>4294967295||!PRESETS.includes(preset))throw Error('Invalid experiment recipe');
  const started=performance.now(),pack=TERRAIN_PACKS[preset];
  const field=createFormationField(seed,240,{range:pack.range,canyon:pack.canyon},preset),anchor=field.modules[0];
  const macro=(x,z)=>{
    const dir=anchor.dir.map((v,i)=>v+(anchor.axis[i]*x+anchor.side[i]*z)/240),length=Math.hypot(...dir);
    return field.height(...dir.map(v=>v/length));
  };
  const patch=createQuadPatch(seed),{points,quads,adjacency}=patch,heights=points.map(p=>macro(...p));
  const boundaryEdges=patch.edgeCounts.filter(([,n])=>n===1).map(([k])=>k.split(':').map(Number));
  const margin=points.map(p=>Math.min(...boundaryEdges.map(([a,b])=>segmentDistance(p,points[a],points[b]))));
  const heart=nearest(points,[0,0],i=>Math.hypot(...points[i])>55||margin[i]<8?Infinity:Math.abs(heights[i])*3);
  const starts=[0,2.1,4.2].map(angle=>nearest(points,[Math.cos(angle)*66,Math.sin(angle)*66],i=>{
    const r=Math.hypot(...points[i]),dot=(points[i][0]*Math.cos(angle)+points[i][1]*Math.sin(angle))/(r||1);
    return margin[i]<8||r<45||dot<.8?Infinity:Math.abs(heights[i])*2;
  }));
  const routeGraph=adjacency.map(neighbors=>neighbors.filter(i=>margin[i]>6));
  const guides=starts.map(start=>graphPath(points,routeGraph,start,heart,(a,b)=>1+(Math.abs(heights[a])+Math.abs(heights[b]))*.18)).map(p=>p.map(i=>points[i]));
  const routeDistance=(x,z)=>{let best=Infinity;for(const route of guides)for(let i=1;i<route.length;i++)best=Math.min(best,segmentDistance([x,z],route[i-1],route[i]));return best;};
  const levels=heights.map(h=>clamp(Math.round(h/8),-12,18));
  const bins=new Map(),binKey=(x,z)=>`${Math.floor(x/12)},${Math.floor(z/12)}`;
  quads.forEach((f,i)=>{
    const xs=f.map(v=>points[v][0]),zs=f.map(v=>points[v][1]);
    for(let x=Math.floor(Math.min(...xs)/12);x<=Math.floor(Math.max(...xs)/12);x++)for(let z=Math.floor(Math.min(...zs)/12);z<=Math.floor(Math.max(...zs)/12);z++){const key=`${x},${z}`;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(i);}
  });
  const locate=(x,z)=>{for(const face of bins.get(binKey(x,z))||[]){const uv=inverseQuad(points,quads[face],x,z);if(uv)return {face,uv};}return null;};
  // Fit a multi-cell overlook beside a corridor. The entire footprint must fit
  // and the connected ramp faces the route; failed fits are omitted, not forced.
  let overlook=null;
  const ranked=points.map((p,i)=>({p,i,d:routeDistance(...p)})).filter(v=>v.d>23&&v.d<32&&Math.hypot(...v.p)<62&&heights[v.i]>3&&heights[v.i]<48).sort((a,b)=>Math.abs(a.d-27)-Math.abs(b.d-27));
  for(const {p}of ranked){
    let closest=null,best=Infinity;
    for(const route of guides)for(const q of route){const d=distance(p,q);if(d<best){best=d;closest=q;}}
    if(best<26||best>36)continue;
    const cells=new Set(),checks=Array.from({length:16},(_,i)=>[p[0]+Math.cos(i*Math.PI/8)*11,p[1]+Math.sin(i*Math.PI/8)*11]);
    if(checks.some(q=>!locate(...q)))continue;
    checks.forEach(q=>cells.add(locate(...q).face));
    if(cells.size<3)continue;
    overlook={center:p.slice(),entry:closest.slice(),height:8,radius:6,faces:[...cells]};break;
  }
  function candidateAt(face,u,v) {
    const p=positionAt(points,quads[face],u,v),d=routeDistance(...p);
    let h=terraceHeight(quads[face].map(i=>levels[i]),u,v);
    if(overlook){
      const delta=p.map((x,i)=>x-overlook.center[i]),r=Math.hypot(...delta),len=distance(overlook.center,overlook.entry),axis=overlook.entry.map((x,i)=>(x-overlook.center[i])/len);
      const along=delta[0]*axis[0]+delta[1]*axis[1],across=Math.abs(delta[0]*axis[1]-delta[1]*axis[0]);
      const platform=1-smoothstep(6,11,r),ramp=(1-smoothstep(4.5,8,across))*(1-smoothstep(len-2,len+1,along))*smoothstep(-2,2,along);
      const target=8*(1-smoothstep(4,len,along));
      h=h*(1-platform)+8*platform;h=h*(1-ramp)+target*ramp;
    }
    // Flat 10 m passage plus shoulders. The route is a global constraint, not a
    // promise inferred from neighboring masks. Both geometry and navigation use it.
    return h*smoothstep(5,10,d);
  }
  const surfaceStart=performance.now(),surfaces=['current','guided'].map(mode=>buildSurface(mode));
  function buildSurface(mode) {
    const divisions=8,tiles=[],positions=[],indices=[];
    for(let face=0;face<quads.length;face++){
      const offset=positions.length/3,vertices=[];
      for(let y=0;y<=divisions;y++)for(let x=0;x<=divisions;x++){
        const u=x/divisions,v=y/divisions,p=positionAt(points,quads[face],u,v),h=mode==='current'?macro(...p):candidateAt(face,u,v);
        positions.push(p[0],h,p[1]);vertices.push([p[0],h,p[1]]);
      }
      for(let y=0;y<divisions;y++)for(let x=0;x<divisions;x++){const a=offset+y*(divisions+1)+x,b=a+1,c=a+divisions+1,d=c+1;indices.push(a,c,b,b,c,d);}
      tiles.push(vertices);
    }
    // Query the same triangles that are rendered, including a conservative
    // neighbor-cell search for the inverse of a bilinearly deformed quad.
    function heightAt(x,z) {
      const hit=locate(x,z);if(!hit)return null;
      const tile=tiles[hit.face],cx=clamp(Math.floor(hit.uv[0]*divisions),0,divisions-1),cy=clamp(Math.floor(hit.uv[1]*divisions),0,divisions-1);
      for(let ring=0;ring<=1;ring++)for(let oy=-ring;oy<=ring;oy++)for(let ox=-ring;ox<=ring;ox++){
        const px=cx+ox,py=cy+oy;if(px<0||py<0||px>=divisions||py>=divisions)continue;
        const a=py*(divisions+1)+px,b=a+1,c=a+divisions+1,d=c+1;
        for(const ids of [[a,c,b],[b,c,d]]){
          const [p,q,r]=ids.map(i=>tile[i]),det=(q[2]-r[2])*(p[0]-r[0])+(r[0]-q[0])*(p[2]-r[2]);
          const u=((q[2]-r[2])*(x-r[0])+(r[0]-q[0])*(z-r[2]))/det,v=((r[2]-p[2])*(x-r[0])+(p[0]-r[0])*(z-r[2]))/det;
          if(u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6)return p[1]*u+q[1]*v+r[1]*(1-u-v);
        }
      }
      return null;
    }
    function gradeAt(x,z,radius=1.2){const h=heightAt(x,z);if(h===null)return Infinity;let grade=0;for(const [dx,dz]of [[radius,0],[-radius,0],[0,radius],[0,-radius]]){const n=heightAt(x+dx,z+dz);if(n===null)return Infinity;grade=Math.max(grade,Math.abs(h-n)/radius);}return grade;}
    return {mode,positions,indices,tiles,heightAt,gradeAt};
  }
  let surfaceMs=performance.now()-surfaceStart,overlookRejected=false;
  for(let side=0;side<surfaces.length;side++){
    let surface=surfaces[side];const navStart=performance.now();
    surface.nav=createLocalNavigation(surface,patch.radius,points[heart],starts.map(i=>points[i]));
    if(side===1&&overlook&&!surface.nav.find(points[heart],overlook.center).length){
      // A spatial fit is insufficient. Reject a stamp whose actual triangle
      // surface cannot support its ramp, and rebuild once without that stamp.
      overlook=null;overlookRejected=true;const rebuild=performance.now();surface=surfaces[side]=buildSurface('guided');surfaceMs+=performance.now()-rebuild;
      surface.nav=createLocalNavigation(surface,patch.radius,points[heart],starts.map(i=>points[i]));
    }
    surface.navigationMs=performance.now()-navStart;
    let pads=0,highPads=0,samples=0;
    for(let z=-70;z<=70;z+=5)for(let x=-70;x<=70;x+=5){const h=surface.heightAt(x,z);if(h===null)continue;samples++;if(surface.gradeAt(x,z,3)<.22){pads++;if(h>5)highPads++;}}
    surface.metrics={reachable:surface.nav.routes.filter(p=>p.length).length,sites:pads,raisedSites:highPads,samples,triangles:surface.indices.length/3};
  }
  const seamError=(surface)=>{
    const seen=new Map();let max=0;
    quads.forEach((face,k)=>{for(let side=0;side<4;side++)for(let t=0;t<=8;t++){
      const uv=[[t,0],[8,t],[8-t,8],[0,8-t]][side],p=surface.tiles[k][uv[1]*9+uv[0]],a=face[side],b=face[(side+1)%4],tag=a<b?`${a}:${b}:${t}`:`${b}:${a}:${8-t}`;
      if(seen.has(tag))max=Math.max(max,Math.hypot(...p.map((v,i)=>v-seen.get(tag)[i])));else seen.set(tag,p);
    }});return max;
  };
  surfaces.forEach(s=>s.metrics.seamError=seamError(s));
  return {version:KIT_VERSION,seed,preset,patch,surfaces,guides,overlook,overlookRejected,heart:points[heart],starts:starts.map(i=>points[i]),anchor:{id:anchor.id,type:anchor.type,dir:anchor.dir},locate,routeDistance,
    timings:{totalMs:performance.now()-started,surfaceMs,navigationMs:surfaces.map(s=>s.navigationMs)}};
}

export function createLocalNavigation(surface,radius,heart,starts) {
  const step=3,points=[],map=new Map(),valid=[],adjacency=[];
  for(let z=-radius;z<=radius;z+=step)for(let x=-radius;x<=radius;x+=step){
    const h=surface.heightAt(x,z);if(h===null)continue;const id=points.length;points.push([x,z]);map.set(`${x},${z}`,id);valid.push(surface.gradeAt(x,z,1.2)<=.7);adjacency.push([]);
  }
  function passable(a,b) {
    if(!valid[a]||!valid[b])return false;
    for(const t of [.25,.5,.75])if(surface.gradeAt(points[a][0]*(1-t)+points[b][0]*t,points[a][1]*(1-t)+points[b][1]*t,1.2)>.7)return false;
    return true;
  }
  points.forEach(([x,z],i)=>{if(!valid[i])return;for(const [dx,dz]of [[step,0],[0,step],[step,step],[-step,step]]){const j=map.get(`${x+dx},${z+dz}`);if(j===undefined||!passable(i,j))continue;
    if(dx&&dz){const a=map.get(`${x+dx},${z}`),b=map.get(`${x},${z+dz}`);if(a===undefined||b===undefined||!valid[a]||!valid[b])continue;}
    adjacency[i].push(j);adjacency[j].push(i);
  }});
  const snap=p=>{let best=-1,d=6;points.forEach((q,i)=>{const n=distance(p,q);if(valid[i]&&n<d){d=n;best=i;}});return best;};
  const target=snap(heart),routes=starts.map(p=>{const start=snap(p);return start<0||target<0?[]:graphPath(points,adjacency,start,target).map(i=>points[i]);});
  const find=(from,to)=>{const a=snap(from),b=snap(to);return a<0||b<0?[]:graphPath(points,adjacency,a,b).map(i=>points[i]);};
  return {points,valid,adjacency,routes,find,snap};
}
