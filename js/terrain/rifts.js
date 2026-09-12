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
  const length=Math.min(radius*.68,m.extent*(m.type==='grand'?2.8:2.3));
  // Most movers are nowhere near this rift. Reject the footprint before its
  // trigonometric bends; full-field geometry and simulation share this path.
  const reach=m.type==='grand'?length*.6+m.extent*.5+10:m.extent*1.5;
  if(Math.abs(v)>reach)return 0;
  const ramp=length*.82,progress=clamp((length-Math.abs(u))/ramp);
  if(!progress)return 0;
  const bend=Math.sin(u/length*4+m.phase)*m.extent*.3;
  let distance=Math.abs(v+bend),along=u;
  if(m.type==='labyrinth'){
    // Offset cross faults leave polygonal islands, unlike the one main trunk
    // and small tributaries of an erosion ravine.
    for(let k=-1;k<=1;k++){
      const cross=Math.abs(u-k*m.extent*.75+Math.sin(v/m.extent*2+m.phase)*3);
      const tip=1-smoothstep(m.extent*.65,m.extent*1.25,Math.abs(v));
      if(tip>0){const d=cross+(1-tip)*30;if(d<distance){distance=d;along=v;}}
    }
  }else{
    const branch=Math.abs(v-(u+m.extent*.15)*.6)+Math.max(0,-u-m.extent*.15);
    distance=Math.min(distance,branch);
  }
  const width=m.type==='grand'?7+m.extent*.07:4.8;
  const cut=(1-smoothstep(width,width+m.extent*.24,distance))*smoothstep(0,.15,progress);
  if(!cut)return 0;
  const depth=Math.min(m.height,ramp*.28)*smoothstep(0,1,progress);
  if(out)Object.assign(out,{cut,depth,along,length});
  return cut;
}
