// A stylized orbital model, not a climate simulator. Separate seed mixing keeps
// environment additions from consuming combat, loot or campaign random streams.
export const PLANET_THEMES = Object.freeze({
  auto:{name:'From star and orbit'},
  temperate:{name:'Garden world',orbit:1,wetness:0,activity:.18},
  monsoon:{name:'Monsoon world',orbit:.91,wetness:.12,activity:.2},
  arid:{name:'Sunbaked world',orbit:.69,wetness:-.19,activity:.22},
  frozen:{name:'Frost world',orbit:1.8,wetness:-.04,activity:.12},
  volcanic:{name:'Ember world',orbit:.58,wetness:-.12,activity:.85},
});
const STARS=[
  {type:'M',name:'Red dwarf',luminosity:.06,color:0xffb58b},
  {type:'K',name:'Amber dwarf',luminosity:.4,color:0xffd59d},
  {type:'G',name:'Yellow star',luminosity:1,color:0xffe9c4},
  {type:'F',name:'White star',luminosity:2.8,color:0xe6edff},
];
const hash=n=>{n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);return ((n^(n>>>15))>>>0)/4294967296;};
export function stellarFlux(luminosity,orbitAU){return luminosity/(orbitAU*orbitAU);}
export function planetEnvironment(seed,key='auto'){
  if(!Number.isInteger(seed)||seed<1||seed>0xffffffff)throw Error('Invalid environment seed');
  if(!Object.hasOwn(PLANET_THEMES,key))throw Error('Unknown planet theme');
  const star={...STARS[Math.floor(hash(seed^0x507ea123)*STARS.length)]};
  const naturalOrbit=.6+hash(seed^0x447bb091)*1.25,activity=hash(seed^0x62db3741);
  const theme=key==='auto'?(naturalOrbit>1.5?'frozen':naturalOrbit<.75?(activity>.55?'volcanic':'arid'):naturalOrbit<.87?'arid':hash(seed^0x937dec21)>.62?'monsoon':'temperate'):key;
  const recipe=PLANET_THEMES[theme],relativeOrbit=key==='auto'?naturalOrbit:recipe.orbit;
  const orbitAU=Math.sqrt(star.luminosity)*relativeOrbit,flux=stellarFlux(star.luminosity,orbitAU);
  // Flux supplies the thermal bias; water inventory and tectonics remain
  // independent. Close orbits do not automatically mean active volcanism.
  const warmth=Math.max(-.34,Math.min(.28,Math.log2(flux)*.2));
  const wetness=recipe.wetness+(hash(seed^0x651bdd19)-.5)*.05;
  const tectonics=recipe.activity+(activity-.5)*.08;
  const weights=theme==='volcanic'?{volcano:7,caldera:4,chaos:3}
    :theme==='frozen'?{chaos:5,spine:4,valley:5}
    :theme==='arid'?{grand:4,labyrinth:3,mesa:3,buttes:4}
    :theme==='monsoon'?{forest:7,ravine:4,hills:5}:{};
  const oceanShift=recipe.wetness*.85;
  return {version:1,seed,key,theme,name:recipe.name,star,orbitAU,relativeOrbit,flux,warmth,wetness,tectonics,oceanShift,weights};
}
