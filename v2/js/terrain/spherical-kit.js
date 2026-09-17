// Production counterpart of the frozen flat-patch experiment. A closed sphere
// needs shared 3D edge parameters, not independent tangent-plane projections.
import {buildIcosphere} from '../geodesic.js';
import {mulberry32,smoothstep} from '../noise.js';

const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=p=>{const l=Math.hypot(...p);return p.map(v=>v/l);};
const mean=ps=>unit([0,1,2].map(k=>ps.reduce((s,p)=>s+p[k],0)));
const convex=(f,p)=>f.every((v,i)=>dot(cross(p[v],p[f[(i+1)%f.length]]),p[f[(i+2)%f.length]])>1e-10);
const order=(ids,p)=>{
  const n=mean(ids.map(i=>p[i])),a=unit(cross(n,Math.abs(n[1])<.9?[0,1,0]:[1,0,0])),b=cross(n,a);
  return ids.sort((i,j)=>Math.atan2(dot(p[i],b),dot(p[i],a))-Math.atan2(dot(p[j],b),dot(p[j],a)));
};

export function createSphericalQuads(seed,radius=240){
  if(!Number.isFinite(radius)||radius<30||radius>1000)throw Error('Unsupported guided planet radius');
  const detail=radius>320?5:4,{verts:points,faces:triangles}=buildIcosphere(detail),rng=mulberry32(seed^0x671d3);
  const edges=new Map();
  triangles.forEach((t,i)=>t.forEach((a,k)=>{const key=edgeKey(a,t[(k+1)%3]);if(!edges.has(key))edges.set(key,[]);edges.get(key).push(i);}));
  const pairs=[...edges.values()];
  for(let i=pairs.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[pairs[i],pairs[j]]=[pairs[j],pairs[i]];}
  const used=new Uint8Array(triangles.length),polygons=[];
  for(const [a,b] of pairs){if(used[a]||used[b])continue;const f=order([...new Set([...triangles[a],...triangles[b]])],points);if(convex(f,points)){polygons.push(f);used[a]=used[b]=1;}}
  triangles.forEach((t,i)=>{if(!used[i])polygons.push(t);});
  const mids=new Map(),quads=[];
  const mid=(a,b)=>{const key=edgeKey(a,b);if(!mids.has(key)){mids.set(key,points.length);points.push(mean([points[a],points[b]]));}return mids.get(key);};
  for(const f of polygons){const c=points.length;points.push(mean(f.map(i=>points[i])));f.forEach((v,i)=>quads.push([v,mid(v,f[(i+1)%f.length]),c,mid(f[(i+f.length-1)%f.length],v)]));}
  const neighbors=points.map(()=>new Set());
  quads.forEach(f=>f.forEach((a,i)=>{const b=f[(i+1)%4];neighbors[a].add(b);neighbors[b].add(a);}));
  const adjacency=neighbors.map(s=>[...s]);
  for(let iteration=0;iteration<8;iteration++){
    const target=points.map((p,i)=>mean(adjacency[i].map(j=>points[j])));
    for(let rate=.35;rate>.01;rate*=.5){
      const next=points.map((p,i)=>unit(p.map((v,k)=>v+(target[i][k]-v)*rate)));
      if(quads.every(f=>convex(f,next))){for(let i=0;i<points.length;i++)points[i]=next[i];break;}
    }
  }
  return {seed,radius,points,quads,adjacency};
}

export function spherePosition(points,face,u,v){
  const w=[(1-u)*(1-v),u*(1-v),u*v,(1-u)*v];
  return unit([0,1,2].map(k=>w.reduce((s,a,i)=>s+a*points[face[i]][k],0)));
}

// Inverse normalized bilinear cage: project corners onto the plane normal to
// the QUERY ray. Identical edge endpoints then give identical u/v on both sides.
export function sphereUV(cage,x,y,z,out=[0,0]){
  const a=cage.axis,b=cage.side,n=cage.normal,p=cage.projected;
  const den=x*n[0]+y*n[1]+z*n[2],sx=(x*a[0]+y*a[1]+z*a[2])/den,sy=(x*b[0]+y*b[1]+z*b[2])/den;
  const px=p[0]-sx*p[2],py=p[1]-sy*p[2],qx=p[3]-sx*p[5],qy=p[4]-sy*p[5],rx=p[6]-sx*p[8],ry=p[7]-sy*p[8],tx=p[9]-sx*p[11],ty=p[10]-sy*p[11];
  const ax=qx-px,ay=qy-py,bx=tx-px,by=ty-py,cx=px-qx+rx-tx,cy=py-qy+ry-ty;
  const A=ay*cx-ax*cy,B=-px*cy+py*cx-ax*by+ay*bx,C=-px*by+py*bx;
  const disc=B*B-4*A*C;if(disc< -1e-14)return null;
  const q=-.5*(B+(B>=0?1:-1)*Math.sqrt(Math.max(0,disc)));
  for(let i=0;i<2;i++){
    const u=Math.abs(A)<1e-12?-C/B:i===0?q/A:Math.abs(q)>1e-15?C/q:-B/(2*A);
    if(u< -1e-6||u>1.000001||!Number.isFinite(u))continue;
    const dx=bx+cx*u,dy=by+cy*u,v=Math.abs(dx)>Math.abs(dy)?(-px-ax*u)/dx:(-py-ay*u)/dy;
    if(v>=-1e-6&&v<=1.000001){out[0]=Math.max(0,Math.min(1,u));out[1]=Math.max(0,Math.min(1,v));return out;}
  }
  return null;
}

export function createSphereIndex(grid){
  const size=40,buckets=new Map(),coordinate=v=>Math.max(0,Math.min(size-1,Math.floor((v+1)*size/2))),key=(x,y,z)=>(x*size+y)*size+z;
  const cages=grid.quads.map(face=>{
    const ps=face.map(i=>grid.points[i]),normal=mean(ps),axis=unit(cross(normal,Math.abs(normal[1])<.9?[0,1,0]:[1,0,0])),side=cross(normal,axis);
    return {normal,axis,side,projected:ps.flatMap(p=>[dot(p,axis),dot(p,side),dot(p,normal)]),edges:ps.map((p,i)=>cross(p,ps[(i+1)%4])).flat()};
  });
  grid.quads.forEach((f,i)=>{
    const ps=f.map(v=>grid.points[v]),centre=cages[i].normal,arc=Math.max(...ps.map(p=>Math.acos(Math.min(1,dot(p,centre))))),pad=arc*arc+.00001;
    const min=[0,1,2].map(k=>coordinate(Math.min(...ps.map(p=>p[k]))-pad)),max=[0,1,2].map(k=>coordinate(Math.max(...ps.map(p=>p[k]))+pad));
    for(let x=min[0];x<=max[0];x++)for(let y=min[1];y<=max[1];y++)for(let z=min[2];z<=max[2];z++){const id=key(x,y,z);if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(i);}
  });
  const contains=(i,x,y,z)=>{const e=cages[i].edges;for(let k=0;k<12;k+=3)if(e[k]*x+e[k+1]*y+e[k+2]*z< -1e-12)return false;return true;};
  let last=0;
  function find(x,y,z){
    if(contains(last,x,y,z))return last;
    const list=buckets.get(key(coordinate(x),coordinate(y),coordinate(z)))||[];
    for(const i of list)if(contains(i,x,y,z)){last=i;return i;}
    return -1;
  }
  return {cages,find,contains};
}

const topologyCache=new Map();
export function protectedLandforms(field){
  return field.modules.filter(m=>m.height&&['valley','grotto','caverns','arcade','ribbons','sky','skyreef','skycrown','skyshards'].includes(m.type))
    .map(m=>({dir:field.project(m,0,0),radius:m.extent*Math.min(1,m.size)*1.45+18}));
}
export function createGuidedSurface(seed,radius,source,{water=()=>false,landmarks=true,protectedSites=[]}={}){
  const key=`${seed}:${radius}`;
  if(!topologyCache.has(key)){
    const grid=createSphericalQuads(seed,radius);topologyCache.set(key,{grid,index:createSphereIndex(grid)});
    if(topologyCache.size>2)topologyCache.delete(topologyCache.keys().next().value);
  }
  const {grid,index}=topologyCache.get(key),step=8,datum=.55;
  const heights=Float64Array.from(grid.points,p=>source(...p)),levels=Int16Array.from(heights,h=>Math.round((h-datum)/step));
  // Multi-layer roofs and their natural abutments already form an authored kit.
  // Do not terrace one bank independently of its connected bridge. Shared
  // vertex weights give a continuous transition back to surrounding shelves.
  const protection=Float64Array.from(grid.points,p=>protectedSites.reduce((w,s)=>Math.min(w,1-smoothstep(Math.cos((s.radius+20)/radius),Math.cos(s.radius/radius),dot(p,s.dir))),1));
  const floors=Float64Array.from(heights,(h,i)=>Math.min(h,...grid.adjacency[i].map(j=>heights[j])));
  const tiles=grid.quads.map(f=>{
    const ls=f.map(i=>levels[i]),lo=Math.min(...ls),hi=Math.max(...ls);
    if(lo===hi)return lo;
    const masks=[];
    for(let level=lo+1;level<=hi;level++)masks.push(ls.map(l=>l>=level?1:0));
    return {lo,masks};
  }),uv=[0,0],fitted=[];
  function base(x,y,z,raw=source(x,y,z)){
    // Existing low routes, coastlines and canyon bottoms stay at their actual
    // elevation. The flat experiment's zero-level lane stamp is not applicable.
    if(Math.abs(raw-datum)<1.25||raw<0&&water(x,y,z))return raw;
    const id=index.find(x,y,z);if(id<0)return raw;
    const tile=tiles[id],f=grid.quads[id];if(!sphereUV(index.cages[id],x,y,z,uv))return raw;
    const u=uv[0],v=uv[1],w0=(1-u)*(1-v),w1=u*(1-v),w2=u*v,w3=(1-u)*v;
    let h=datum+(typeof tile==='number'?tile:tile.lo)*step;
    if(typeof tile!=='number')for(const m of tile.masks)h+=step*smoothstep(.24,.76,m[0]*w0+m[1]*w1+m[2]*w2+m[3]*w3);
    const floor=floors[f[0]]*w0+floors[f[1]]*w1+floors[f[2]]*w2+floors[f[3]]*w3;
    const route=smoothstep(1.25,4.5,Math.abs(raw-datum)),bottom=raw<0?smoothstep(.8,4,raw-floor):1;
    // Retain a little authored detail and narrow peaks smaller than one cage.
    const weight=protection[f[0]]*w0+protection[f[1]]*w1+protection[f[2]]*w2+protection[f[3]]*w3;
    const strength=.9*weight*route*bottom*(1-smoothstep(12,28,Math.abs(raw-h)));
    return raw+(h-raw)*strength;
  }
  function stamp(l,x,y,z,h){
    const d=x*l.dir[0]+y*l.dir[1]+z*l.dir[2];if(d<l.limit)return h;
    const u=(x*l.axis[0]+y*l.axis[1]+z*l.axis[2])*radius,v=(x*l.side[0]+y*l.side[1]+z*l.side[2])*radius;
    const top=1-smoothstep(6,12,Math.hypot(u,v));
    const t=Math.max(0,Math.min(1,(-u-6)/(l.run-6))),ramp=(1-smoothstep(4.8,8.5,Math.abs(v)))*(1-smoothstep(l.run-2,l.run+4,-u))*(1-smoothstep(0,6,u));
    const influence=Math.max(top,ramp),rampHeight=l.entryHeight+(l.height-l.entryHeight)*(1-smoothstep(0,1,t));
    const target=top*l.height+(1-top)*rampHeight;
    return h+(target-h)*influence;
  }
  if(landmarks){
    // Bounded seeded multi-cell matching. A candidate must already sit beside
    // dry floor, fit a complete walkable ramp, and offer a flat tower footprint.
    const rng=mulberry32(seed^0x0a11ce),order=grid.points.map((_,i)=>i);
    for(let i=order.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    let tried=0;
    for(const id of order){
      if(fitted.length>=24||tried>=160)break;
      const dir=grid.points[id],h=heights[id];if(h<4||h>16||water(...dir)||protectedSites.some(s=>dot(dir,s.dir)>Math.cos((s.radius+40)/radius))||fitted.some(l=>dot(dir,l.dir)>Math.cos(76/radius)))continue;
      tried++;
      const a=unit(cross(dir,Math.abs(dir[1])<.9?[0,1,0]:[1,0,0])),b=cross(dir,a);
      for(let angle=0;angle<8;angle++){
        const az=angle*Math.PI/4,axis=a.map((v,k)=>v*Math.cos(az)+b[k]*Math.sin(az)),side=cross(dir,axis),run=30;
        const project=(u,v)=>unit(dir.map((d,k)=>d+(axis[k]*u+side[k]*v)/radius)),entry=project(-run,0),entryHeight=source(...entry);
        if(entryHeight<.15||entryHeight>1.5||water(...entry))continue;
        const l={dir,axis,side,entry,entryHeight,height:entryHeight+8,run,limit:Math.cos(38/radius)};
        let ok=true;
        for(const offset of [-1.2,0,1.2]){
          let prev=null;
          for(let u=-run-5;u<=4;u+=1){const p=project(u,offset),s=stamp(l,...p,base(...p));if(water(...p)||prev!==null&&Math.abs(s-prev)>.54){ok=false;break;}prev=s;}
          if(!ok)break;
        }
        if(ok)for(let k=0;k<12;k++){const p=project(Math.cos(k*Math.PI/6)*3,Math.sin(k*Math.PI/6)*3);if(Math.abs(stamp(l,...p,base(...p))-l.height)>.1){ok=false;break;}}
        if(ok){fitted.push(l);break;}
      }
    }
  }
  // A navigation bake makes millions of queries. Most have no landmark nearby;
  // index their conservative spherical bounds instead of scanning all 24 fits.
  const bins=Array(4096),cell=v=>Math.max(0,Math.min(15,Math.floor((v+1)*8))),keyOf=(x,y,z)=>(x*16+y)*16+z;
  const reach=2*Math.sin(38/radius/2);
  for(const l of fitted){
    const min=l.dir.map(v=>cell(v-reach)),max=l.dir.map(v=>cell(v+reach));
    for(let x=min[0];x<=max[0];x++)for(let y=min[1];y<=max[1];y++)for(let z=min[2];z<=max[2];z++)(bins[keyOf(x,y,z)]||=[]).push(l);
  }
  function height(x,y,z,raw){
    let h=base(x,y,z,raw);const nearby=bins[keyOf(cell(x),cell(y),cell(z))];
    if(nearby)for(const l of nearby)h=stamp(l,x,y,z,h);
    return h;
  }
  return {upperBound:Math.max(datum+Math.max(...levels)*step,...fitted.map(l=>Math.max(l.height,l.entryHeight))),version:1,grid,index,heights,levels,landmarks:fitted,height,base,metrics:{quads:grid.quads.length,vertices:grid.points.length,landmarks:fitted.length}};
}
