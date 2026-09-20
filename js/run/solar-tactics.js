// Geographic landmarks are deliberately enlarged for readable tower-defense
// routes. Names/locations reference real geology; cloud-world terrain is fiction.
const site=(name,lon,lat,shape,width,depth,turn=0)=>({name,lon,lat,shape,width,depth,turn});
export const SOLAR_LANDMARKS=Object.freeze({
 earth:[site('Rocky Mountain passes',-113,44,'ridge',21,20,-.6),site('Andean escarpments',-70,-24,'ridge',24,24,1.4),site('Himalayan valleys',85,29,'ridge',23,28,.1),site('Tibetan shelves',90,34,'mesa',19,16),site('Grand Canyon',-112,36,'rift',12,10,-.2),site('East African rift',33,-3,'rift',21,12,1.3),site('Alpine passes',10,46,'ridge',12,14,.1),site('Saharan dune corridors',15,24,'dunes',27,10,.2),site('Ethiopian highlands',39,9,'mesa',12,14),site('Great Dividing Range',148,-29,'ridge',18,13,1.1),site('Antarctic mountains',50,-79,'ridge',25,19),site('Patagonian ice fields',-73,-48,'ridge',12,16,1.5)],
 moon:[site('Imbrium terraces',-16,33,'crater',24,15),site('Serenitatis rim',19,28,'crater',18,12),site('Orientale rings',-95,-19,'crater',23,19),site('Tycho ejecta',-11,-43,'crater',12,18),site('South Pole Aitken',170,-53,'crater',36,17),site('Alpine Valley',3,49,'rift',18,11,.9)],
 mercury:[site('Caloris rim',160,30,'crater',32,19),site('Rembrandt basin',88,-33,'crater',23,16),site('Discovery scarp',-38,-56,'ridge',26,15,.5),site('Rachmaninoff terraces',57,28,'crater',17,15),site('Beethoven basin',-124,-20,'crater',26,13),site('Northern contraction scarps',-40,62,'ridge',28,13)],
 mars:[site('Olympus Mons',-134,18,'shield',28,26),site('Tharsis ramparts',-106,0,'shield',30,22),site('Valles Marineris',-65,-12,'rift',37,24),site('Hellas basin',70,-42,'crater',32,16),site('Elysium rise',147,25,'shield',22,18),site('Noctis labyrinth',-101,-7,'rift',20,17,.7),site('Polar troughs',30,81,'dunes',23,12)],
 venus:[site('Maxwell Montes',3,65,'ridge',27,25,.4),site('Aphrodite tessera',100,-8,'mesa',34,19),site('Atla Regio',200,9,'shield',25,22),site('Beta Regio',-78,25,'ridge',26,17,1),site('Artemis corona',133,-35,'crater',30,15),site('Lada folded terrain',20,-62,'ridge',30,15,-.4)],
 jupiter:[site('Great Red Spot terraces',-50,-22,'storm',30,17),site('North equatorial jets',45,17,'ridge',35,12),site('White oval chain',75,-33,'cells',32,12),site('Polar cyclone crown',-100,76,'storm',30,18),site('Southern cyclone passages',110,-73,'storm',27,15),site('Equatorial plume steps',-135,-3,'mesa',30,13)],
 saturn:[site('Polar hexagon shelves',0,78,'cells',30,19),site('Great white storm',90,34,'storm',32,16),site('Equatorial jet ridges',-45,0,'ridge',40,12),site('Southern vortex',140,-73,'storm',28,17),site('Temperate cloud rolls',-125,-35,'dunes',32,12),site('North cloud terraces',-65,53,'mesa',26,15)],
 uranus:[site('Polar hood shelves',0,78,'mesa',32,15),site('Methane cloud rolls',70,30,'dunes',34,11),site('Equatorial cloud channels',-50,0,'rift',31,12),site('South cloud gyre',100,-48,'storm',28,13),site('Bright storm complex',-130,35,'storm',25,16),site('Southern veil terraces',-35,-68,'cells',27,12)],
 neptune:[site('Dark Spot',45,-28,'storm',32,21),site('Scooter cloud lanes',5,-42,'ridge',35,14),site('Northern storm',-90,34,'storm',29,19),site('Equatorial wind shelves',140,0,'mesa',31,14),site('Polar jet troughs',-25,72,'rift',30,15),site('Southern cloud crests',-120,-67,'dunes',28,14)],
 titan:[site('Shangri-La dunes',-165,-10,'dunes',36,16),site('Belet corridors',-105,-7,'dunes',32,14),site('Xanadu uplands',100,-12,'ridge',30,18),site('Doom Mons',40,-15,'shield',20,15),site('Sotra depression',40,-20,'crater',16,14),site('Ligeia shoreline hills',116,67,'mesa',20,12)],
 europa:[site('Thrace chaos',173,-46,'cells',29,13),site('Conamara rafts',87,9,'cells',29,15),site('Agenor band',173,-43,'rift',34,14),site('Pwyll rim',-89,-25,'crater',13,10),site('Northern double ridges',-30,45,'ridge',34,12,.5),site('Southern lineae',45,-62,'rift',34,15,-.7)],
 ganymede:[site('Galileo Regio',140,36,'crater',31,13),site('Uruk Sulcus',160,5,'ridge',32,17,.5),site('Tiamat grooves',-15,-5,'ridge',34,16,-.7),site('Osiris basin',-166,-38,'crater',23,16),site('Marius dark terrain',-160,17,'mesa',25,15),site('Polar ice plateaus',60,73,'cells',25,12)],
 triton:[site('Cantaloupe province',30,28,'cells',36,15),site('Sulci crossings',-50,23,'rift',30,15,.5),site('South polar cap',35,-69,'mesa',35,11),site('Plume field gullies',-45,-51,'rift',24,10,-.3),site('Ruach basin',24,28,'crater',18,11),site('Northern frost blocks',130,51,'cells',30,14)],
 io:[site('Loki Patera',-52,13,'crater',23,17),site('Pele volcanic rise',-104,-19,'shield',28,22),site('Tvashtar chain',120,63,'shield',24,19),site('Boosaule Montes',-89,-10,'ridge',23,29),site('Prometheus flow field',-154,-2,'shield',26,19),site('Danube plateau',27,-22,'mesa',21,21),site('Southern paterae',60,-65,'crater',26,16)],
 callisto:[site('Valhalla rings',60,20,'crater',38,19),site('Asgard rings',-140,31,'crater',31,18),site('Adlinda basin',36,-57,'crater',25,16),site('Gipul catena',-50,7,'ridge',26,14),site('Lofn ejecta',23,-57,'crater',16,15),site('Northern crater terraces',-70,63,'cells',29,14)],
 pluto:[site('Sputnik cell margins',100,20,'cells',35,13),site('Norgay mountains',100,-25,'ridge',25,24),site('Hillary mountains',110,-18,'ridge',20,21,.4),site('Tartarus blades',160,20,'ridge',27,20,1.2),site('Virgil Fossae',30,-12,'rift',33,19,.3),site('Cthulhu escarpments',25,-2,'mesa',30,17),site('Northern ice ridges',-60,65,'ridge',27,16)],
});
export function solarTerrainSeed(theme){let n=0x531a72;for(const c of theme)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function createSolarTactics(theme,radius=240){
 const sites=(SOLAR_LANDMARKS[theme]||[]).map((s,i)=>{const a=s.lon*Math.PI/180*(theme==='earth'?-1:1),b=s.lat*Math.PI/180,dir=[Math.cos(b)*Math.cos(a),Math.sin(b),Math.cos(b)*Math.sin(a)],east=[-Math.sin(a),0,Math.cos(a)],north=[-Math.sin(b)*Math.cos(a),Math.cos(b),-Math.sin(b)*Math.sin(a)],ca=Math.cos(s.turn),sa=Math.sin(s.turn),width=s.width*radius/240;
  return {...s,id:i,dir,width,axis:east.map((x,k)=>x*ca+north[k]*sa),side:north.map((x,k)=>x*ca-east[k]*sa),limit:Math.cos(width*1.55/radius)};});
 const bins=new Map(),axis=v=>Math.max(0,Math.min(23,Math.floor((v+1)*12))),key=(x,y,z)=>(x*24+y)*24+z;
 for(const s of sites){const reach=2*Math.sin(s.width*1.6/radius/2);for(let x=axis(s.dir[0]-reach);x<=axis(s.dir[0]+reach);x++)for(let y=axis(s.dir[1]-reach);y<=axis(s.dir[1]+reach);y++)for(let z=axis(s.dir[2]-reach);z<=axis(s.dir[2]+reach);z++){const k=key(x,y,z);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(s);}}
 function height(x,y,z){let result=0;for(const s of bins.get(key(axis(x),axis(y),axis(z)))||[]){if(x*s.dir[0]+y*s.dir[1]+z*s.dir[2]<s.limit)continue;
  const u=(x*s.axis[0]+y*s.axis[1]+z*s.axis[2])*radius/s.width,v=(x*s.side[0]+y*s.side[1]+z*s.side[2])*radius/s.width,r=Math.hypot(u,v),edge=1-smooth(.72,1.42,r),gate=smooth(.07,.22,Math.abs(u+.14*Math.sin(v*4)));
  let h=0;
  if(s.shape==='ridge'){const lane=v+.15*Math.sin(u*4),spines=Math.exp(-(((Math.abs(lane)-.37)/.22)**2)),passes=smooth(.07,.2,Math.abs(u-.28));h=spines*passes;}
  else if(s.shape==='crater'||s.shape==='storm'){h=Math.exp(-(((r-.73)/.18)**2))*gate-.38*(1-smooth(.34,.65,r));if(s.shape==='storm')h+=.2*Math.sin(Math.atan2(v,u)*5+r*9)*smooth(.25,.8,r)*gate;}
  else if(s.shape==='rift'){const lane=v+.17*Math.sin(u*4),cut=1-smooth(.09,.32,Math.abs(lane)),entry=smooth(1.35,.45,Math.abs(u));h=-cut*entry+.18*Math.exp(-(((Math.abs(lane)-.43)/.2)**2));}
  else if(s.shape==='mesa'){const shelf=1-smooth(.46,.78,r),ramp=1-smooth(.12,.36,Math.abs(v));h=shelf*(1-.7*ramp*smooth(-.2,.8,u));}
  else if(s.shape==='shield'){h=(1-smooth(.12,1.35,r))**1.5*(.65+.35*gate)-.32*(1-smooth(.08,.2,r));}
  else if(s.shape==='dunes'){h=Math.max(0,Math.cos((v+.09*Math.sin(u*4))*11))**2*.64*(1-smooth(.75,1.2,Math.abs(u)));}
  else {const a=Math.abs(Math.sin(u*8+Math.sin(v*3)*.25)),b=Math.abs(Math.sin(v*8));h=smooth(.25,.5,Math.min(a,b))*.68;}
  result+=h*edge*s.depth;
 }return result;}
 return {sites,height};
}
