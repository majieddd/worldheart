// Necessary acceptance test, using the existing full-resolution graph. Reachability
// needs no priority queue: all finite edges are nonnegative and floorReach is the
// floor-only component of the same heart. Never use this to accept a world.
export function floorCoverage(nav,field,heart,center=null,theta=0){
  const reach=new Uint8Array(nav.n),queue=new Int32Array(nav.n);let head=0,tail=1;queue[0]=heart;reach[heart]=1;
  while(head<tail){const a=queue[head++];for(let e=nav.adjOff[a];e<nav.adjOff[a+1];e++){
    const b=nav.adj[e];if(reach[b]||!nav.floorWalk[b]||nav.block[b]||!Number.isFinite(nav.cost[e]))continue;reach[b]=1;queue[tail++]=b;
  }}
  let dry=0,connected=0,deep=0,deepConnected=0;const limit=Math.cos(theta);
  for(let i=0;i<nav.n;i++){
    if(center&&nav.dirs[i*3]*center.x+nav.dirs[i*3+1]*center.y+nav.dirs[i*3+2]*center.z<limit)continue;
    const h=nav.baseHeight[i];if(!nav.floorWalk[i]||nav.waterDepth[i]!==0)continue;
    if(h<-1&&!reach[i]){const type=field.inspect(nav.dirs[i*3],nav.dirs[i*3+1],nav.dirs[i*3+2]).type;if(type==='karst'||type==='kettles')continue;}
    dry++;if(reach[i])connected++;
    if(h<-1){deep++;if(reach[i])deepConnected++;}
  }
  return {dry,connected,deep,deepConnected,possible:dry>0&&connected/dry>=.95&&(!deep||deepConnected/deep>=.95)};
}
