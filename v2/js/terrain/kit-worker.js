import {createExperiment} from './kit-experiment.js';
let experiment;
function path3D(surface,path) {
  const result=[];
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],count=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.65);
    for(let n=0;n<count;n++){const t=n/count,x=a[0]*(1-t)+b[0]*t,z=a[1]*(1-t)+b[1]*t;result.push([x,surface.heightAt(x,z),z]);}
  }
  if(path.length){const p=path.at(-1);result.push([p[0],surface.heightAt(...p),p[1]]);}return result;
}
self.onmessage=({data})=>{
  try{
    if(data.type==='generate'){
      experiment=createExperiment(data.seed,data.preset);
      const {version,seed,preset,patch,guides,overlook,overlookRejected,heart,starts,anchor,timings}=experiment;
      let bottom=0;for(const s of experiment.surfaces)for(let i=1;i<s.positions.length;i+=3)bottom=Math.min(bottom,s.positions[i]-8);
      const boundary=new Set(patch.edgeCounts.filter(([,n])=>n===1).map(([k])=>k));
      const skirts=surface=>{const p=[];patch.quads.forEach((f,face)=>f.forEach((a,side)=>{
        const b=f[(side+1)%4],key=a<b?`${a}:${b}`:`${b}:${a}`;if(!boundary.has(key))return;
        const edge=t=>{const uv=[[t,0],[8,t],[8-t,8],[0,8-t]][side];return surface.tiles[face][uv[1]*9+uv[0]];};
        for(let t=0;t<8;t++){const a=edge(t),b=edge(t+1),c=[a[0],bottom,a[2]],d=[b[0],bottom,b[2]];p.push(...a,...b,...c,...b,...d,...c);}
      }));return p;};
      const surfaces=experiment.surfaces.map(s=>({mode:s.mode,positions:new Float32Array(s.positions),indices:new Uint32Array(s.indices),metrics:s.metrics,skirts:skirts(s),bottom,
        routes:s.nav.routes.map(p=>path3D(s,p)),heart:[heart[0],s.heightAt(...heart),heart[1]],starts:starts.map(p=>[p[0],s.heightAt(...p),p[1]]),
        grid:patch.quads.flatMap(f=>f.flatMap((a,i)=>[a,f[(i+1)%4]].map(v=>[patch.points[v][0],s.heightAt(...patch.points[v])+.12,patch.points[v][1]]))).flat(),
      }));
      self.postMessage({type:'ready',version,seed,preset,quads:patch.quads.length,guides,overlook,overlookRejected,anchor,timings,surfaces},surfaces.flatMap(s=>[s.positions.buffer,s.indices.buffer]));
    }else if(data.type==='walk'&&experiment){
      const s=experiment.surfaces[data.side],path=s.nav.find(data.from,data.to);
      self.postMessage({type:'walk',side:data.side,id:data.id,path:path3D(s,path)});
    }
  }catch(error){self.postMessage({type:'error',message:String(error)});}
};
