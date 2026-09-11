// Build a small inspection catalogue once, not during the frame loop. Probe
// actual exposed relief, since a recipe anchor can be submerged or its cut
// displaced by domain warping. Prefer representatives inside the playfield.
export function surveyLandmarks(field, heightAt, center, theta) {
  const best=new Map(),all=new Map();
  for(const m of field.modules) {
    for(let a=-3;a<=3;a++)for(let b=-3;b<=3;b++){
      const u=a*m.extent/4/field.radius,v=b*m.extent/4/field.radius;
      const p=m.dir.map((n,k)=>n+m.axis[k]*u+m.side[k]*v),length=Math.hypot(...p),dir=p.map(n=>n/length);
      const sample=field.inspect(...dir);if(sample.id!==m.id)continue;
      const height=heightAt(...dir,false);
      const crater=sample.type==='caldera';
      const cut=['ravine','crevice','canyon','valley','caldera'].includes(sample.type);
      let depth=0;
      if(cut&&sample.incision>1){
        // Measure the visible banks too: a large theoretical cut beneath an
        // ocean must not win a camera jump to an empty patch of water.
        const banks=(crater?Array.from({length:8},(_,i)=>i*Math.PI/4):[-Math.PI/2,Math.PI/2]).map(angle=>{
          let raised=0;
          for(const distance of (crater?[.35,.5,.65].map(v=>v*m.extent):[12,20,28])){
            const bank=dir.map((n,k)=>n+(m.side[k]*Math.sin(angle)+m.axis[k]*Math.cos(angle))*distance/field.radius),l=Math.hypot(...bank),p=bank.map(n=>n/l);
            if(field.inspect(...p).id===m.id)raised=Math.max(raised,heightAt(...p,false)-Math.max(.03,height));
          }
          return raised;
        });
        // A lone sea cliff is not an exposed incision through an upland.
        depth=crater?banks.sort((a,b)=>a-b)[2]:Math.min(...banks);
      }
      const score=cut?depth:(height>.2?height:0);
      if(score<2)continue;
      const inside=dir[0]*center.x+dir[1]*center.y+dir[2]*center.z>=Math.cos(theta);
      const record={type:sample.type,dir,height,relief:sample.relief,depth,score,inside,scale:m.height};
      if(!all.has(sample.type)||all.get(sample.type).score<score)all.set(sample.type,record);
      if(inside&&(!best.has(sample.type)||best.get(sample.type).score<score))best.set(sample.type,record);
    }
  }
  for(const [key,value]of all)if(!best.has(key))best.set(key,value);
  return [...best.values()].sort((a,b)=>a.type.localeCompare(b.type));
}
