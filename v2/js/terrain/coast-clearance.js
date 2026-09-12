// A bounded spherical distance field gives dry cuts enough room to rise back
// to the shoreline. Multiplying depth by noisy continentality made steep dams
// across otherwise gentle longitudinal ramps. This field is built once per
// seed and sampled without allocations by every height consumer.
export function createCoastClearance(radius,waterAt,width=192,rows=96){
  const count=width*(rows+1),dist=new Float32Array(count).fill(Infinity),heap=[],keys=[];
  const push=(id,d)=>{let i=heap.length;heap.push(id);keys.push(d);while(i){const p=(i-1)>>1;if(keys[p]<=d)break;heap[i]=heap[p];keys[i]=keys[p];i=p;}heap[i]=id;keys[i]=d;};
  const pop=()=>{const id=heap[0],d=keys[0],last=heap.pop(),key=keys.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&keys[c+1]<keys[c])c++;if(keys[c]>=key)break;heap[i]=heap[c];keys[i]=keys[c];i=c;}heap[i]=last;keys[i]=key;}return [id,d];};
  const sin=[],cos=[];
  for(let y=0;y<=rows;y++){
    const lat=(y/rows-.5)*Math.PI;sin[y]=Math.sin(lat);cos[y]=Math.cos(lat);
    for(let x=0;x<width;x++){
      const a=x/width*Math.PI*2,id=y*width+x;
      if(waterAt(cos[y]*Math.cos(a),sin[y],cos[y]*Math.sin(a))){dist[id]=0;push(id,0);}
    }
  }
  const meridian=radius*Math.PI/rows,diagonal=[],parallel=[];
  for(let y=0;y<=rows;y++){
    parallel[y]=radius*2*Math.PI/width*Math.max(0,cos[y]);
    if(y<rows)diagonal[y]=Math.hypot(meridian,(parallel[y]+radius*2*Math.PI/width*cos[y+1])*.5);
  }
  while(heap.length){
    const [id,d]=pop();if(d>dist[id]+.001)continue;
    const y=Math.floor(id/width),x=id%width;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if((!dx&&!dy)||y+dy<0||y+dy>rows)continue;
      const j=(y+dy)*width+(x+dx+width)%width;
      const step=!dy?parallel[y]:!dx?meridian:diagonal[Math.min(y,y+dy)];
      const next=d+step;if(next+1e-4<dist[j]){dist[j]=next;push(j,next);}
    }
  }
  const margin=radius*2*Math.PI/width*1.1;
  return {width,rows,margin,sample(x,y,z){
    const u=((Math.atan2(z,x)/(Math.PI*2)+1)%1)*width,v=(Math.asin(Math.max(-1,Math.min(1,y)))/Math.PI+.5)*rows;
    const ix=Math.floor(u)%width,iy=Math.min(rows-1,Math.floor(v)),tx=u-Math.floor(u),ty=v-iy;
    const a=dist[iy*width+ix],b=dist[iy*width+(ix+1)%width],c=dist[(iy+1)*width+ix],d=dist[(iy+1)*width+(ix+1)%width];
    if(!Number.isFinite(a+b+c+d))return radius;
    return Math.max(0,(a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty-margin);
  }};
}
