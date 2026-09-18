// No renderer, save writes or shared mutable field state in this worker.
globalThis.matchMedia=()=>({matches:false});
let field,config,three,traversal,seed;
self.onmessage=async({data})=>{
  const {points,batch,floorDatum,coarse,walkAll,kind}=data;
  try{
    config||=await import('./config.js');Object.assign(config.CONFIG,data.config);
    field||=await import('./world.js');three||=await import('../lib/three.module.min.js');traversal||=await import('./traversal.js');
    if(seed!==data.config.seed){field.initTerrainField(data.config.seed);seed=data.config.seed;}
    if(kind==='air'||kind==='edge'){
      const samples=new Float64Array(points.length/2),v=new three.Vector3(),a=new three.Vector3(),b=new three.Vector3(),probe=new three.Vector3();
      const offsets=kind==='air'?Array.from({length:24},(_,sample)=>{const angle=sample%8*Math.PI/4,distance=(1+Math.floor(sample/8))*data.spacing*.3;return[Math.cos(angle)*distance/field.R,Math.sin(angle)*distance/field.R];}):null;
      for(let i=0,j=0;i<points.length;i+=4,j+=2){
        v.set(points[i+1],points[i+2],points[i+3]).normalize();let safe=true;
        if(kind==='edge')safe=field.canFlyAt(v,field.FLIGHT_CLEARANCE+2);
        else{
          a.set(0,Math.abs(v.y)<.9?1:0,Math.abs(v.y)<.9?0:1);b.crossVectors(v,a).normalize();a.crossVectors(b,v).normalize();
          for(const offset of offsets){probe.copy(v).addScaledVector(a,offset[0]).addScaledVector(b,offset[1]).normalize();if(!field.canFlyAt(probe,field.FLIGHT_CLEARANCE+1)){safe=false;break;}}
        }
        samples[j]=points[i];samples[j+1]=safe?1:0;
      }
      self.postMessage({batch,samples},[samples.buffer]);return;
    }
    const samples=new Float64Array(points.length/4*8),v=new three.Vector3();
    for(let i=0,j=0;i<points.length;i+=4,j+=8){
      const x=points[i+1],y=points[i+2],z=points[i+3];v.set(x,y,z);
      const h=field.navigationHeight(x,y,z),base=Math.fround(field.navigationHeight(x,y,z,false)),water=Math.fround(field.waterDepthAt(v,base));
      const air=field.canFlyAt(v,field.FLIGHT_CLEARANCE+2)?1:0,radius=field.surfaceElevation(v,h)+field.R;
      const walk=walkAll?(h<.55?1:0):coarse?(field.isLandDir(v)?1:0):(field.isWalkableDir(v)?1:0);
      const floor=walk&&traversal.isFloorTerrain(base-floorDatum,field.slopeAt(v),water)?1:0;
      samples[j]=points[i];samples[j+1]=h;samples[j+2]=base;samples[j+3]=water;samples[j+4]=walk;samples[j+5]=floor;samples[j+6]=air;samples[j+7]=radius;
    }
    self.postMessage({batch,samples},[samples.buffer]);
  }catch(error){self.postMessage({batch,error:String(error.stack||error)});}
};
