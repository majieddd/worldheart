import {makeNoise3D,mulberry32} from '../noise.js';
// Independent streams and spatially correlated density form copses and gaps.
// The same field drives globe, miniature and active-feature placement. There
// is no golden-angle lattice and no dependency on combat or loot randomness.
export function ecologyScatter(seed){
 const noise=makeNoise3D(seed^0x236ef17a),rng=mulberry32(seed^0x674cc54d);
 const density=(x,y,z)=>Math.max(.06,Math.min(.95,.45+noise(x*13,y*13,z*13)*.8+noise(x*39+11,y*39,z*39)*.22));
 return {rng,density,point(){const y=rng()*2-1,a=rng()*Math.PI*2,r=Math.sqrt(1-y*y);return [r*Math.cos(a),y,r*Math.sin(a)];},accept(d){return rng()<density(...d);}};
}

export function patchScatter(seed,count,half=9){
 const {rng,density}=ecologyScatter(seed),points=[];
 for(let attempt=0;attempt<count*60&&points.length<count;attempt++){
  const x=(rng()*2-1)*half,z=(rng()*2-1)*half;
  if(rng()>density(x*.012,.24,z*.012)||points.some(p=>Math.hypot(x-p.x,z-p.z)<1.2))continue;
  points.push({x,z,angle:rng()*Math.PI*2,scale:.8+rng()*.6});
 }
 return points;
}
