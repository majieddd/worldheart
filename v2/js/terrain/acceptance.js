// Certify the accepted battlefield, not the recipe manifest. Tiny submerged
// slivers do not count as a second landform, and a flat plain is not a route.
export function surveyBattlefield(nav, field, heightAt, radius, center=null, theta=0) {
  const exposed={},p=[0,0,0];let dry=0,connected=0,deep=0,deepConnected=0,channels=0,peak=0,depth=0,pits=0;
  for(let i=0;i<nav.n;i++){
    if(center&&nav.dirs[i*3]*center.x+nav.dirs[i*3+1]*center.y+nav.dirs[i*3+2]*center.z<Math.cos(theta))continue;
    const h=nav.baseHeight[i];peak=Math.max(peak,h);depth=Math.max(depth,-h);
    // Sinkholes and kettles are explicitly authored traps. They never supply
    // nest clearings. Keep their floors visible in the audit, separate from
    // the connected passages which must still meet the 95 percent gate.
    if(h<-1&&!nav.march.floorReach[i]&&nav.waterDepth?.[i]===0){const type=field.inspect(nav.dirs[i*3],nav.dirs[i*3+1],nav.dirs[i*3+2]).type;if(['karst','kettles'].includes(type)){pits++;continue;}}
    if(nav.floorWalk[i]&&(nav.waterDepth?nav.waterDepth[i]===0:h>=.18)){dry++;if(nav.march.floorReach[i])connected++;}
    if(h<-1&&nav.floorWalk[i]&&nav.waterDepth?.[i]===0){deep++;if(nav.march.floorReach[i])deepConnected++;}
    if(i%53)continue;
    for(let k=0;k<3;k++)p[k]=nav.dirs[i*3+k];
    const shape=field.inspect(...p);
    if(Math.abs(h)>2&&Math.abs(shape.relief)>1){const f=exposed[shape.type]||={samples:0,peak:0};f.samples++;f.peak=Math.max(f.peak,Math.abs(h));}
    if((nav.waterDepth?nav.waterDepth[i]>0:h<.18)||h>1.5||!nav.march.floorReach[i])continue;
    const axis=Math.abs(p[1])<.93?[-p[2],0,p[0]]:[0,p[2],-p[1]],l=Math.hypot(...axis);
    for(let k=0;k<3;k++)axis[k]/=l;
    const side=[p[1]*axis[2]-p[2]*axis[1],p[2]*axis[0]-p[0]*axis[2],p[0]*axis[1]-p[1]*axis[0]];
    let enclosed=false;
    for(let a=0;a<4&&!enclosed;a++){
      const angle=a*Math.PI/4;
      // A floor with raised ground on opposite sides, at either scale.
      for(const distance of [10,22]){
        const heights=[-1,1].map(sign=>{
          const q=p.map((v,k)=>v+sign*(axis[k]*Math.cos(angle)+side[k]*Math.sin(angle))*distance/radius),len=Math.hypot(...q);
          return heightAt(...q.map(v=>v/len),false);
        });
        if(Math.min(...heights)>h+2.5){enclosed=true;break;}
      }
    }
    if(enclosed)channels++;
  }
  const families=Object.keys(exposed).filter(k=>exposed[k].samples>=4);
  const islands=field.mix==='ocean'||field.settings.composition?.pack==='ocean'&&field.settings.composition.coverage>=.95;
  const requiredFamilies=Math.min(islands?2:3,new Set(field.modules.filter(m=>m.height>0).map(m=>m.type)).size);
  return {exposed,families,requiredFamilies,dry,connected,dryConnected:dry?connected/dry:0,deep,deepConnected,pits,channels,peak,depth,
    pass:families.length>=requiredFamilies&&dry>0&&connected/dry>=.95&&(!deep||deepConnected/deep>=.95)&&channels>=8&&Math.max(peak,depth)>=(islands?8:16)};
}
