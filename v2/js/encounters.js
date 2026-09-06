// Plain combat adapters accept a planet definition from the mode's config.
// Authored groups and global enemy templates remain immutable.
export function planetGroups(groups,planet) {
  return groups.map(g=>{
    const out={...g};
    if(planet?.pressure==='wings'&&g.type==='wisp')out.count=Math.ceil(g.count*1.25);
    if(planet?.pressure==='armor'&&g.type==='aegis')out.count++;
    if(planet?.pressure==='swarm'&&g.type==='mite'){out.count=Math.ceil(g.count*1.2);out.gap*=.85;}
    return out;
  });
}
export function planetBoss(base,boss) {
  if(!base.boss||!boss)return base;
  const type={...base,name:boss.name,plateTint:boss.tint};
  if(boss.style==='sweep')Object.assign(type,{arcDeg:155,wind:.9,swing:2.7,atk:80});
  if(boss.style==='lance')Object.assign(type,{arcDeg:60,wind:.75,swing:2.2,atk:110});
  if(boss.style==='bastion')Object.assign(type,{hp:base.hp*1.18,armor:base.armor+2,wind:1,swing:2.9,atk:100});
  return type;
}
