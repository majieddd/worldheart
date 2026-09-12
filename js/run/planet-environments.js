// A stylized orbital model, not a climate simulator. Separate seed mixing keeps
// environment additions from consuming combat, loot or campaign random streams.
export const PLANET_THEMES = Object.freeze({
  auto:{name:'From star and orbit'},
  temperate:{name:'Garden world',orbit:1,wetness:0,activity:.18},
  monsoon:{name:'Canopy world',orbit:.91,wetness:.40,activity:.12},
  arid:{name:'Dune world',orbit:.69,wetness:-.65,activity:.12},
  frozen:{name:'Cryosphere',orbit:1.8,wetness:-.04,activity:.02},
  volcanic:{name:'Molten world',orbit:.58,wetness:-.4,activity:.98},
  crystalline:{name:'Crystal world',orbit:1.24,wetness:-.08,activity:.18},
  fungal:{name:'Spore world',orbit:1.08,wetness:.28,activity:.12},
  oceanic:{name:'Pelagic world',orbit:.98,wetness:.5,activity:.10},
  ferrous:{name:'Iron desert',orbit:.78,wetness:-.55,activity:.3},
  twilight:{name:'Luminous twilight',orbit:1.34,wetness:.2,activity:.08},
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
  const chemistry=hash(seed^0x937dec21);
  const naturalTheme=naturalOrbit>1.5?'frozen':naturalOrbit<.75?(activity>.55?'volcanic':'ferrous')
    :naturalOrbit<.87?'arid':naturalOrbit>1.25?(chemistry>.48?'crystalline':'twilight')
    :chemistry<.2?'oceanic':chemistry<.4?'fungal':chemistry<.65?'monsoon':'temperate';
  const theme=key==='auto'?naturalTheme:key;
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
    :theme==='monsoon'?{forest:10,ravine:5,hills:5,karst:5}
    :theme==='crystalline'?{blades:10,impact:5,spine:5}
    :theme==='fungal'?{basin:6,karst:7,fan:5}
    :theme==='oceanic'?{caldera:7,drumlins:8,plateau:5}
    :theme==='ferrous'?{yardangs:9,spider:7,buttes:6}
    :theme==='twilight'?{spiral:8,cells:8,stripes:6}:{};
  // Humidity and ocean volume are related but not identical. Preserve enough
  // continents for certified nests even on a wet, island-rich pelagic world.
  const oceanShift=theme==='oceanic'?.18:Math.max(-.17,Math.min(.1,recipe.wetness*.3));
  return {version:2,seed,key,theme,name:recipe.name,star,orbitAU,relativeOrbit,flux,warmth,wetness,tectonics,oceanShift,weights};
}
