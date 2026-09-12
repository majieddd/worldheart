import {smoothstep} from '../noise.js';
const clamp=x=>Math.max(0,Math.min(1,x));

// Continental cuts cross several ordinary terrain cells. Depth has its own
// long entrance budget; widening the steep side walls is not the exit path.
// Their endpoints fade back into the shared terrain, with no stacked depths.
export function riftSample(m,x,y,z,radius,out){
  const forward=x*m.dir[0]+y*m.dir[1]+z*m.dir[2];
  if(forward<.55)return 0;
  const u=(x*m.axis[0]+y*m.axis[1]+z*m.axis[2])*radius;
  const v=(x*m.side[0]+y*m.side[1]+z*m.side[2])*radius;
  const length=Math.min(radius*.86,m.extent*(m.type==='grand'?4.3:2.3));
  // Most movers are nowhere near this rift. Reject the footprint before its
  // trigonometric bends; full-field geometry and simulation share this path.
  const reach=m.type==='grand'?length*.98+m.extent*.25+10:m.extent*1.5;
  if(Math.abs(v)>reach)return 0;
  const ramp=length*.82,progress=clamp(Math.min((length-Math.abs(u))/ramp,radius*(Math.acos(.55)-Math.acos(Math.min(1,forward)))/ramp));
  if(!progress)return 0;
  const bend=Math.sin(u/length*4+m.phase)*m.extent*.3;
  let distance=Math.abs(v+bend),along=u,tributary=0;
  if(m.type==='labyrinth'){
    // Offset cross faults leave polygonal islands, unlike the one main trunk
    // and small tributaries of an erosion ravine.
    for(let k=-1;k<=1;k++){
      const cross=Math.abs(u-k*m.extent*.75+Math.sin(v/m.extent*2+m.phase)*3);
      const tip=1-smoothstep(m.extent*.65,m.extent*1.25,Math.abs(v));
      if(tip>0){const d=cross+(1-tip)*30;if(d<distance){distance=d;along=v;}}
    }
  }else{
    for(let k=-2;k<=2;k++)for(const sign of [-1,1]){
      const join=k*length*.23,branch=Math.abs(v-sign*(u-join)*.64)+Math.max(0,join-u)*1.4;
      tributary=Math.max(tributary,1-smoothstep(6.5,11,branch));
    }
  }
  const width=m.type==='grand'?8+m.extent*.09:5.8;
  const cut=Math.max(1-smoothstep(width,width+m.extent*.24,distance),tributary)*smoothstep(0,.15,progress);
  if(!cut)return 0;
  const depth=Math.min(m.height,ramp*.32)*smoothstep(0,1,progress);
  if(out)Object.assign(out,{cut,depth,along,length});
  return cut;
}
