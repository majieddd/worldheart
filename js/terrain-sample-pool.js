export class SamplePoints {
  constructor(capacity){this.data=new Float64Array(capacity*4);this.length=0;}
  push(id,x,y,z){const i=this.length;this.data[i]=id;this.data[i+1]=x;this.data[i+2]=y;this.data[i+3]=z;this.length+=4;}
  finish(){return this.data.subarray(0,this.length);}
}
// Opt-in experiment. Independent field instances, ordered results and transferable
// buffers preserve every sample. Failure falls back to the synchronous sampler.
export class TerrainSamplePool {
  constructor(count=Math.min(4,Math.max(1,(navigator.hardwareConcurrency||2)-1))){
    this.workers=[];this.count=count;this.failed=false;this.sequence=0;this.metrics={batches:0,points:0,workers:count,failures:[],timings:[]};this.timers=new Set();
  }
  async sample(points,options){
    if(this.failed||typeof Worker==='undefined')return null;
    const start=performance.now();
    try{
      if(!this.workers.length)for(let i=0;i<this.count;i++){
        const url=new URL('./terrain-sample-worker.js',import.meta.url);url.search=location.search;
        this.workers.push(new Worker(url,{type:'module'}));
      }
      this.metrics.batches++;this.metrics.points+=points.length/4;
      const batch=++this.sequence,total=points.length/4,stride=Math.ceil(total/this.workers.length);
      const jobs=this.workers.map((worker,i)=>new Promise((resolve,reject)=>{
        const chunk=points.slice(i*stride*4,Math.min(total,(i+1)*stride)*4);
        const timeout=setTimeout(()=>reject(Error('Terrain worker timeout')),120000);this.timers.add(timeout);
        worker.onmessage=({data})=>{if(data.batch!==batch)return;clearTimeout(timeout);this.timers.delete(timeout);data.error?reject(Error(data.error)):resolve(data.samples);};
        worker.onerror=error=>{clearTimeout(timeout);this.timers.delete(timeout);reject(Error(error.message));};
        worker.postMessage({...options,points:chunk,batch},[chunk.buffer]);
      }));
      const chunks=await Promise.all(jobs),width=options.width||7,result=new Float64Array(options.n*width).fill(NaN);
      for(const chunk of chunks)for(let i=0;i<chunk.length;i+=width+1){const to=chunk[i]*width;for(let j=0;j<width;j++)result[to+j]=chunk[i+j+1];}
      this.metrics.timings.push({kind:options.kind||'vertices',points:total,ms:performance.now()-start});return result;
    }catch(error){this.failed=true;this.metrics.failures.push(error.message);this.dispose();console.warn('Terrain parallel experiment fell back:',error.message);return null;}
  }
  dispose(){for(const timer of this.timers)clearTimeout(timer);this.timers.clear();for(const worker of this.workers)worker.terminate();this.workers=[];}
}
