export class SamplePoints {
  constructor(capacity){this.data=new Float64Array(capacity*4);this.length=0;}
  push(id,x,y,z){const i=this.length;this.data[i]=id;this.data[i+1]=x;this.data[i+2]=y;this.data[i+3]=z;this.length+=4;}
  finish(){return this.data.subarray(0,this.length);}
}
// Opt-in experiment. Independent field instances, ordered results and transferable
// buffers preserve every sample. Failure falls back to the synchronous sampler.
export class TerrainSamplePool {
  // Worker count: 4 was the old hard cap and it left ~40% of the batch wall time unspent
  // on this 24-core box (hardwareConcurrency reports 12). 8 workers measured a reproducible
  // ~0.4 s less pool wait per cold boot with the world byte-identical (nav gate: 23 typed
  // arrays, 64,297,734 B, hash 959505510 for map ninetynine / seed 555, unchanged for
  // 4/8/12/16). 16 workers regressed (+3.8%) - past 8 the batches are latency bound again.
  // window.__POOLN overrides it for A/B measurement.
  constructor(count=(typeof window!=='undefined'&&window.__POOLN)||Math.min(8,Math.max(1,(navigator.hardwareConcurrency||2)-1))){
    this.workers=[];this.count=count;this.failed=false;this.sequence=0;this.metrics={batches:0,points:0,workers:count,failures:[],timings:[]};this.timers=new Set();
  }
  async sample(points,options){
    if(this.failed||typeof Worker==='undefined')return null;
    const start=performance.now();
    try{
      if(!this.workers.length)this._spawn();
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
  _spawn(){
    // Adopt the workers index.html started at parse time (see the note there). They are
    // already past worker-thread creation and module evaluation, so the warm-up job
    // below reaches them as an ordinary message. Without this the last few workers'
    // jobs sat in the early-message queue until the main thread's first long task
    // ended (measured 260-320 ms late), and their field init landed inside the first
    // sampling batch. A count mismatch falls back to creating exactly what is needed.
    const early=(typeof window!=='undefined'&&Array.isArray(window.__WH_SAMPLERS))?window.__WH_SAMPLERS:null;
    if(early&&typeof window!=='undefined')window.__WH_SAMPLERS=null;
    if(early)while(early.length>this.count)early.pop().terminate();
    for(let i=0;i<this.count;i++){
      const url=new URL('./terrain-sample-worker.js',import.meta.url);url.search=location.search;
      this.workers.push(early&&early[i]?early[i]:new Worker(url,{type:'module'}));
    }
  }
  // Start the workers - and, crucially, pay their cold start - BEFORE the first
  // real batch needs them. `new Worker()` itself is ~1 ms, but the first round
  // trip through each one measured 578 ms on this box: the worker module graph
  // (three.module.min.js alone is 339 KB, plus world.js/config.js/traversal.js)
  // has to be fetched, parsed and evaluated, and the terrain field initialised,
  // before the first real sample can return. All of that used to land inside the
  // first `vertices` batch - 185,789 points took 773 ms there against 0.86 us per
  // point (215 ms for 249,237 points) on the very next vertices batch, i.e.
  // ~600 ms of that batch was cold start. A warm round trip is 1 ms.
  //
  // Calling this early lets the fetch overlap main-thread boot work. No handshake
  // is needed and none is awaited: the warm-up job is queued on the worker ahead
  // of any real batch, and its reply carries batch -1, which sample()'s
  // `data.batch!==batch` check already discards. Failure paths are the same as
  // sample()'s - any throw disables the pool and the caller falls back to the
  // synchronous sampler.
  prewarm(options){
    if(this.failed||typeof Worker==='undefined')return false;
    try{
      if(!this.workers.length)this._spawn();
      for(const worker of this.workers){
        const warm=new Float64Array([-1,0,1,0]);
        worker.postMessage({...options,points:warm,batch:-1},[warm.buffer]);
      }
      return true;
    }catch(error){
      this.failed=true;this.metrics.failures.push(error.message);this.dispose();
      console.warn('Terrain parallel experiment fell back:',error.message);return false;
    }
  }
  dispose(){for(const timer of this.timers)clearTimeout(timer);this.timers.clear();for(const worker of this.workers)worker.terminate();this.workers=[];}
}
