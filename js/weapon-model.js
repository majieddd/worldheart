import {box,slab,cone,shift,spin,merge} from './rig.js';
export const MATERIAL_FINISH = {
  wood:{color:0xa67540,metalness:0,roughness:.88},iron:{color:0xb3c4cb,metalness:.62,roughness:.4},
  gold:{color:0xe6b74c,metalness:.7,roughness:.28},diamond:{color:0x6fe7e0,metalness:.35,roughness:.15},
  onyx:{color:0x303142,metalness:.68,roughness:.24},
};

export function weaponAppearanceMaterial(mats,source,appearance){
  if(!appearance)return source;
  const material=source.clone();
  if(source===mats.energy){
    const color={tempered:0xffd399,ember:0xff794d,frost:0x91ddff,pulse:0xa9a0ff}[appearance.core];
    material.color.setHex(color);material.emissive.setHex(color);
    material.emissiveIntensity={ancient:.12,technological:1.3,empowered:2.2}[appearance.era];
  }else if(source===mats.trim||source===mats.gold){const finish=MATERIAL_FINISH[appearance.material]||MATERIAL_FINISH.iron;material.color.setHex(finish.color);material.emissive?.setHex(0);material.metalness=finish.metalness;material.roughness=finish.roughness;}
  return material;
}

// A single grip-space assembly serves the held prop, soldier and loot model.
// Forward is -Z. Stock, receiver, barrel and attachments overlap physically;
// an era changes the silhouette, never the location of the firing hand.
export function buildWeapon(visual,era='ancient',mats) {
  const tech=era==='technological',magic=era==='empowered',groups=new Map();
  const add=(geo,key)=>{const mat=mats[key]||mats.dark;if(!groups.has(mat))groups.set(mat,[]);groups.get(mat).push(geo);};
  const block=(w,h,d,x,y,z,key)=>add(shift(box(w,h,d),x,y,z),key);
  const tube=(front,back,length,x,y,z,key)=>add(shift(spin(cone(front,back,length,8),-Math.PI/2,0,0),x,y,z),key);
  const blade=(base,tip,start,end,thick,key)=>add(spin(slab(tip,thick,base,thick,start,end),-Math.PI/2,0,0),key);
  const metal='trim',grip=tech?'dark':'grip';
  let support=null,line=null;
  if(visual==='twin'){
    tube(.035,.04,.24,0,0,0,grip);block(tech?.28:.32,.065,.09,0,0,-.14,metal);
    blade(tech?.19:.14,.04,.15,.68,.045,metal);blade(.15,.005,.67,.92,.035,metal);
    block(.027,.05,.55,0,0,-.43,'energy');
    if(tech)for(const x of [-.09,.09])block(.04,.08,.25,x,0,-.24,'body');
    if(magic){block(.4,.08,.11,0,0,-.16,'gold');for(const x of [-.15,.15])tube(.004,.035,.22,x,0,-.29,'energy');}
    line=[0,0,-.2,0,0,-.92];
  }else if(visual==='staff'){
    tube(.042,.055,1.9,0,0,-.4,metal);tube(.06,.06,.28,0,0,0,grip);tube(.10,.085,.20,0,0,-1.29,metal);
    for(const x of [-.16,.16]){block(.075,.09,.38,x,0,-1.46,metal);block(.21,.08,.075,x*.5,0,-1.3,metal);}
    tube(.09,.17,.30,0,0,-1.53,'energy');tube(.018,.09,.22,0,0,-1.78,'energy');
    if(tech){for(const z of [-.55,-.84,-1.13])tube(.09,.09,.055,0,0,z,'body');block(.1,.16,.24,0,0,-.3,'energy');}
    if(magic){for(const x of [-.25,.25]){block(.07,.07,.34,x,0,-1.40,'gold');tube(.005,.06,.21,x,0,-1.65,'energy');}}
    support=[-.015,0,-.48];
  }else if(visual==='sword'){
    tube(.042,.042,.30,0,0,0,grip);
    tube(.065,.052,.08,0,0,.16,'gold');
    block(tech?.40:magic?.58:.46,.08,.11,0,0,-.17,metal);
    blade(tech?.25:magic?.26:.20,tech?.21:.17,.18,1.19,.045,metal);
    blade(tech?.21:.17,tech?.08:.005,1.18,1.44,.035,metal);
    block(.026,.052,.92,0,0,-.71,'energy');
    if(tech){for(const x of [-.115,.115])block(.035,.065,.48,x,0,-.46,'body');block(.13,.095,.11,0,0,-.20,'energy');}
    if(magic){for(const x of [-.22,.22]){block(.09,.09,.20,x,0,-.23,'gold');block(.055,.10,.09,x,0,-.31,'energy');}blade(.29,.19,.30,.56,.05,'gold');}
    line=[0,0,-.25,0,0,-1.44];
  }else if(visual==='spear'){
    tube(.035,.04,1.70,0,0,-.40,metal);tube(.048,.048,.28,0,0,0,grip);
    tube(.05,.05,.16,0,0,-1.18,metal);
    blade(tech?.18:.22,.008,1.20,1.83,.055,metal);
    block(.03,.06,.34,0,0,-1.43,'energy');
    if(tech){for(const x of [-.09,.09])block(.035,.085,.29,x,0,-1.29,'body');tube(.075,.075,.10,0,0,-.68,'energy');}
    if(magic){block(.35,.06,.08,0,0,-1.22,'gold');for(const x of [-.14,.14])tube(.006,.045,.25,x,0,-1.36,'energy');}
    support=[-.015,0,-.55];line=[0,0,-1.23,0,0,-1.83];
  }else {
    const lob=visual==='mortar';
    // Both guns have a palm-sized grip under a receiver and a stock running
    // back into the shoulder. Muzzle details sit on the barrel's exact axis.
    block(.10,.26,.13,0,-.01,0,grip);
    block(lob?.28:.20,lob?.25:.21,.54,0,.14,-.22,tech?'body':grip);
    block(.13,.17,.39,0,.13,.17,grip);
    block(.18,.29,.09,0,.10,.37,tech?'body':grip);
    block(.08,.25,.14,0,.02,-.49,grip);
    const front=lob?-1.10:-1.48,back=-.36;
    tube(lob?(tech?.16:.21):.039,lob?.14:.048,back-front,0,.18,(front+back)/2,metal);
    tube(lob?.23:.064,lob?.21:.06,.10,0,.18,front,tech?'dark':'gold');
    tube(lob?.165:.042,lob?.165:.042,.012,0,.18,front-.057,'dark');
    block(.06,.08,.45,0,lob?.315:.21,-.49,metal);
    block(lob?.035:.025,.024,.45,0,lob?.36:.255,-.49,'energy');
    block(.065,.075,.10,0,.275,-.14,metal);
    if(tech){
      block(lob?.31:.23,.15,.43,0,.24,-.46,'body');
      block(.16,.24,.23,lob?.20:.13,.10,-.23,'dark');
      block(.04,.14,.16,lob?.285:.225,.10,-.23,'energy');
      for(const z of [-.68,-.81,-.94])tube(lob?.18:.07,lob?.18:.07,.045,0,.18,z,'body');
      if(!lob){block(.075,.075,.38,0,.30,-.34,'dark');block(.09,.07,.08,0,.30,-.57,'energy');}
    }else if(magic){
      for(const z of [-.46,-.77]){tube(lob?.19:.075,lob?.19:.075,.07,0,.18,z,'gold');block(.03,.10,.09,lob?.18:.062,.18,z,'energy');}
      block(lob?.35:.20,.15,.13,0,.315,-.33,'gold');
      tube(.006,.10,.19,0,.41,-.33,'energy');
    }else {
      block(lob?.25:.16,.065,.34,0,.035,-.57,grip);
      for(const z of [-.45,-.70])tube(lob?.17:.057,lob?.17:.057,.05,0,.18,z,'gold');
    }
    support=[-.025,-.055,-.49];
  }
  return {parts:[...groups].map(([mat,geos])=>({mat,geo:merge(geos)})),support,blade:line,paired:visual==='twin'};
}
