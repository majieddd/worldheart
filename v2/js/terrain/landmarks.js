// Build a small inspection catalogue once, not during the frame loop. Probe
// actual exposed relief, since a recipe anchor can be submerged or its cut
// displaced by domain warping. Prefer representatives inside the playfield.
export function surveyLandmarks(field, heightAt, center, theta, waterAt=()=>false, biomeAt=()=>null,features=null) {
  const best=new Map(),all=new Map();
  for(const m of field.modules) {
    const continental=['grand','labyrinth'].includes(m.type);
    for(let a=-3;a<=3;a++)for(let b=-3;b<=3;b++){
      const u=a*m.extent/(continental?1.7:4)/field.radius,v=b*m.extent/4/field.radius;
      const p=m.dir.map((n,k)=>n+m.axis[k]*u+m.side[k]*v),length=Math.hypot(...p),dir=p.map(n=>n/length);
      const sample=field.inspect(...dir);if(sample.id!==m.id)continue;
      const height=heightAt(...dir,false);
      const crater=['caldera','volcano'].includes(sample.type);
      const cut=['ravine','crevice','canyon','gorge','valley','caldera','grand','labyrinth','volcano','karst','spiral','spider','stripes'].includes(sample.type);
      let depth=0;
      if(cut&&sample.incision>1){
        // Measure the visible banks too: a large theoretical cut beneath an
        // ocean must not win a camera jump to an empty patch of water.
        const banks=(crater?Array.from({length:8},(_,i)=>i*Math.PI/4):[-Math.PI/2,Math.PI/2]).map(angle=>{
          let raised=0;
          for(const distance of (crater?[.35,.5,.65].map(v=>v*m.extent):[12,20,28])){
            const bank=dir.map((n,k)=>n+(m.side[k]*Math.sin(angle)+m.axis[k]*Math.cos(angle))*distance/field.radius),l=Math.hypot(...bank),p=bank.map(n=>n/l);
            if(field.inspect(...p).id===m.id)raised=Math.max(raised,heightAt(...p,false)-(waterAt(...dir,height)?Math.max(.03,height):height));
          }
          return raised;
        });
        // A lone sea cliff is not an exposed incision through an upland.
        depth=crater?banks.sort((a,b)=>a-b)[2]:Math.min(...banks);
      }
      // A canopy formation's snow-capped summit is a poor forest showcase.
      // Prefer its vegetated shoulders while retaining the massif in frame.
      const biome=sample.type==='forest'?biomeAt(...dir,height):null;
      const canopy=sample.type==='forest'?Math.max(0,1-Math.max(0,height-24)/18)*(biome===null||biome==='jungle'?1:.08):1;
      const score=cut?depth:(height>.2?height*canopy:0);
      if(score<2||waterAt(...dir,height))continue;
      const inside=dir[0]*center.x+dir[1]*center.y+dir[2]*center.z>=Math.cos(theta);
      const record={type:sample.type,dir,height,relief:sample.relief,depth,score,inside,scale:continental?m.extent*1.6:m.height};
      if(!all.has(sample.type)||all.get(sample.type).score<score)all.set(sample.type,record);
      if(inside&&(!best.has(sample.type)||best.get(sample.type).score<score))best.set(sample.type,record);
    }
  }
  for(const s of features?.surfaces||[]){const dir=s.dir,height=s.top(0,0),inside=dir[0]*center.x+dir[1]*center.y+dir[2]*center.z>=Math.cos(theta),record={type:s.m.type,dir,height,relief:height,depth:0,score:Math.max(3,height),inside,scale:s.m.extent*1.6};if(!all.has(s.m.type)||all.get(s.m.type).score<record.score)all.set(s.m.type,record);if(inside&&(!best.has(s.m.type)||best.get(s.m.type).score<record.score))best.set(s.m.type,record);}
  // Do not choose a shallow local fragment over a much clearer complete
  // formation elsewhere. The selector already labels out-of-field examples.
  for(const [key,value]of all)if(!best.has(key)||best.get(key).score<value.score*.65)best.set(key,value);
  return [...best.values()].sort((a,b)=>a.type.localeCompare(b.type));
}
