// Readable, exaggerated analogues, not scale models or claims of habitable
// surfaces. The four giants use fictional walkable cloud decks.
const body=(name,orbit,biomes,weights,extra={})=>({name,orbit,wetness:-.5,activity:0,pack:'varied',coverage:1,exclusive:true,biomes,weights,water:0x3d5666,shore:0x9eacac,tags:['rock','airless'],solar:true,...extra});
export const SOLAR_THEMES=Object.freeze({
 earth:body('Earth',1,['jungle','desert','woodland','tundra'],{range:6,hills:9,plateau:3,valley:2,gorge:3,basin:6,volcano:1},{wetness:0,activity:.14,tags:['rock','wet','ocean','atmosphere'],water:0x1a577b,shore:0x3ca5aa,note:'Recognizable continents, polar caps, equatorial forests and subtropical deserts.'}),
 moon:body('Moon',1,['regolith','basalt'],{impact:15,catena:7,basin:8,escarpment:2},{note:'Airless grey highlands, dark volcanic maria and bright impact ejecta.'}),
 mars:body('Mars',1.524,['marsdust','ferrous','waterice'],{impact:6,shields:4,grand:4,scablands:6,yardangs:3},{tags:['rock','dry','cold','atmosphere'],note:'Rusty highlands, northern lowlands, polar ice, Olympus shield and the Valles Marineris trench.'}),
 venus:body('Venus',.723,['venusrock','basalt'],{shields:10,stripes:9,volcano:2,plateau:3},{activity:.7,tags:['rock','volcanic','dry','atmosphere'],note:'Ochre volcanic plains, folded tessera highlands and broad shield volcanoes under a hazy atmosphere.'}),
 mercury:body('Mercury',.387,['regolith','basalt'],{impact:14,catena:9,escarpment:7},{note:'Grey-brown cratered plains, contraction scarps and the great Caloris impact basin.'}),
 jupiter:body('Jupiter',5.203,['ammonia','ochrecloud','stormcloud'],{hills:6,cells:3},{tags:['cloud','atmosphere','wet'],cloud:true,note:'Cream and ochre cloud belts with a Great Red Spot. Fictional walkable cloud deck; Jupiter has no solid surface.'}),
 saturn:body('Saturn',9.537,['ammonia','ochrecloud'],{hills:8,coil:2},{tags:['cloud','atmosphere','wet'],cloud:true,rings:true,note:'Pale gold cloud belts, a north-polar hexagon and broad divided rings. Fictional walkable cloud deck.'}),
 neptune:body('Neptune',30.07,['bluecloud','cyancloud'],{wave:3,hills:5},{tags:['cloud','atmosphere','cold'],cloud:true,rings:true,note:'Blue-green methane clouds, dark storm ovals and bright wind streaks. Fictional walkable cloud deck.'}),
 uranus:body('Uranus',19.19,['cyancloud','ammonia'],{hills:8},{tags:['cloud','atmosphere','cold'],cloud:true,rings:true,tilt:98,note:'Pale cyan bands, a bright polar hood and narrow rings tipped on their side. Fictional walkable cloud deck.'}),
 titan:body('Titan',9.537,['tholins','waterice'],{dunes:12,delta:6,scablands:4,fan:4},{tags:['rock','ice','cold','atmosphere'],water:0x473723,shore:0x927444,note:'Orange organic dunes, icy uplands and dark methane lakes concentrated near the poles.'}),
 europa:body('Europa',5.203,['waterice','fracturedice'],{stripes:12,chaos:6,crevice:6},{tags:['ice','airless','cold'],note:'Bright water-ice crust crossed by long rust-stained fractures and broken chaos rafts.'}),
 ganymede:body('Ganymede',5.203,['fracturedice','basalt','waterice'],{stripes:12,impact:5,chaos:4},{tags:['ice','rock','airless','cold'],note:'A patchwork of old dark terrain and bright, densely grooved ice provinces.'}),
 triton:body('Triton',30.07,['nitrogen','tholins','fracturedice'],{cells:12,spider:7,crevice:3},{tags:['ice','cold','airless'],note:'A bright southern nitrogen cap, cantaloupe-textured plains and dark polar plume fans.'}),
 io:body('Io',5.203,['ioplains','sulfur','basalt'],{volcano:15,caldera:8,shields:6},{activity:1,tags:['rock','volcanic','airless'],note:'Sulfur-yellow plains, orange plume deposits and dark, actively glowing volcanic centres.'}),
 callisto:body('Callisto',5.203,['basalt','regolith','waterice'],{impact:18,catena:8,basin:3},{tags:['rock','ice','airless','cold'],note:'Dark ancient crust crowded with bright craters around a broad Valhalla multi-ring basin.'}),
 pluto:body('Pluto',39.48,['tholins','nitrogen','waterice'],{cells:12,chaos:8,impact:4,crevice:3},{tags:['ice','cold','airless'],note:'A pale heart-shaped nitrogen plain with convection cells, rust-red margins and blocky water-ice mountains.'}),
});
export const ASTRONOMICAL_BIOMES=Object.freeze({
 regolith:{name:'Impact regolith',color:0xaaa59b,rock:0x747375,decor:'regolith',note:'Angular rubble and low ejecta fragments on airless dusty ground.'},
 basalt:{name:'Basalt plains',color:0x505158,rock:0x383b44,decor:'basalt',note:'Low black lava plates and worn crater blocks; no vegetation.'},
 marsdust:{name:'Martian dust',color:0xc18159,rock:0x83523e,decor:'marsdust',note:'Fine rust dunes and scattered wind-worn cobbles.'},
 venusrock:{name:'Venusian tessera',color:0xbb9865,rock:0x827551,decor:'venusrock',note:'Intersecting ochre rock ribs above hot basalt plains.'},
 ammonia:{name:'Ammonia cloud tops',color:0xe8ddbc,rock:0xd0b997,decor:'ammonia',note:'Soft pale cloud domes on a fictional walkable atmospheric layer.'},
 ochrecloud:{name:'Ochre cloud belts',color:0xc79770,rock:0xa87655,decor:'ochrecloud',note:'Long warm cloud filaments tracing atmospheric jets.'},
 stormcloud:{name:'Giant storm clouds',color:0xc87355,rock:0x925e50,decor:'stormcloud',note:'Concentric turbulent cloud curls around a storm eye.'},
 cyancloud:{name:'Methane cloud veil',color:0x99cccc,rock:0x74b1bd,decor:'cyancloud',note:'Low pale cyan rolls and fine white cloud streaks.'},
 bluecloud:{name:'Deep methane clouds',color:0x507eaa,rock:0x3e6594,decor:'bluecloud',note:'Blue-green atmospheric bands with brilliant thin storm streaks.'},
 tholins:{name:'Organic frost dunes',color:0xa57452,rock:0x785344,decor:'tholins',note:'Russet organic crust, low dark dunes and frosted cobbles.'},
 nitrogen:{name:'Nitrogen ice plains',color:0xdfddd0,rock:0xa7afb0,decor:'nitrogen',note:'Smooth pale polygon plates separated by dark sublimation seams.'},
 waterice:{name:'Water-ice crust',color:0xc2d5d5,rock:0x91a9b4,decor:'waterice',note:'Broad fractured ice blocks with low frost and no living plants.'},
 fracturedice:{name:'Stained ice fractures',color:0xaaa99c,rock:0x8c6a54,decor:'fracturedice',note:'Paired bright ice ridges flank narrow rusty fracture lines.'},
 ioplains:{name:'Sulfur plume plains',color:0xd8c56f,rock:0xa46a41,decor:'ioplains',note:'Yellow sulfur deposits and orange-red volcanic crust.'},
});

const PI=Math.PI,rad=PI/180,clamp=x=>Math.max(0,Math.min(1,x)),smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const lon=(x,z)=>Math.atan2(z,x)/rad,wrap=a=>(a+540)%360-180;
const oval=(lng,lat,cx,cy,w,h)=>Math.hypot(wrap(lng-cx)/w,(lat-cy)/h);
const continents=[
 [[-168,70],[-139,60],[-127,49],[-122,34],[-110,25],[-97,16],[-82,9],[-76,8],[-88,22],[-81,25],[-66,45],[-53,51],[-65,60],[-90,70],[-125,73]],
 [[-81,12],[-64,10],[-49,0],[-35,-8],[-42,-23],[-57,-37],[-68,-55],[-76,-40],[-71,-18],[-81,-4]],
 [[-17,35],[0,37],[13,32],[32,31],[43,12],[51,12],[41,-12],[32,-26],[18,-35],[11,-16],[6,4],[-10,6],[-17,15]],
 [[-10,36],[-9,44],[5,49],[5,58],[20,71],[42,69],[58,72],[90,75],[132,69],[179,65],[170,52],[138,35],[124,22],[108,4],[99,1],[96,21],[80,7],[69,24],[50,30],[41,12],[35,30],[26,40],[10,44]],
 [[113,-22],[115,-34],[132,-36],[151,-38],[154,-24],[142,-11],[130,-13],[120,-18]],
 [[-53,60],[-43,61],[-20,70],[-25,82],[-51,83],[-64,76]],
 [[46,-13],[50,-17],[47,-26],[43,-25]],[[166,-35],[178,-39],[172,-47],[166,-45]],
];
function polygonDistance(lng,lat,poly){let inside=false,min=1e8;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const [a,b]=poly[i],[c,d]=poly[j];if((b>lat)!==(d>lat)&&lng<(c-a)*(lat-b)/(d-b)+a)inside=!inside;
 const dx=c-a,dy=d-b,t=clamp(((lng-a)*dx+(lat-b)*dy)/(dx*dx+dy*dy));min=Math.min(min,(lng-a-t*dx)**2+(lat-b-t*dy)**2);
 }min=Math.sqrt(min);return inside?min:-min;}
export function createSolarSampler(theme){
 const cache=new Map();
 return (x,y,z)=>{
  // Millimetre-scale angular quantisation shares geology between height,
  // ecology and rendering queries without moving a visible coastline.
  const qx=Math.round((x+1)*65535),qy=Math.round((y+1)*65535),qz=Math.round((z+1)*65535),key=qx*17179869184+qy*131072+qz;
  if(cache.has(key))return cache.get(key);
  const a=qx/65535-1,b=qy/65535-1,c=qz/65535-1,length=Math.hypot(a,b,c)||1,g=solarGeography(theme,a/length,b/length,c/length);
  if(cache.size>=131072)cache.clear();cache.set(key,g);return g;
 };
}
export function solarGeography(theme,x,y,z){
 const lng=lon(x,z),lat=Math.asin(Math.max(-1,Math.min(1,y)))/rad,abs=Math.abs(lat);let biome=null,land=.8,relief=1,extra=0,tint=null;
 const q=(a,b,w,h)=>oval(lng,lat,a,b,w,h);
 switch(theme){
  case 'earth':{let distance=lat< -67?(-lat-67):Math.max(...continents.map(p=>polygonDistance(lng,lat,p)));land=.3+distance*.035;
   biome=abs>66?'tundra':abs<13?'jungle':lat>14&&lat<33&&lng>-20&&lng<62?'desert':abs<32&&lng>112&&lng<151?'desert':abs<25?'savanna':abs>48?'woodland':'meadow';
   relief=.18+.8*Math.max(1-smooth(.4,1,q(87,31,28,9)),1-smooth(.4,1,q(-71,-22,8,38)),1-smooth(.4,1,q(-114,44,10,22)));break;}
  case 'moon':{const maria=Math.min(q(-20,20,28,24),q(22,10,25,23),q(0,48,16,13),q(55,-20,13,12));biome=maria<1?'basalt':'regolith';relief=maria<1?.12:.4;extra=-3*(1-smooth(.65,1,maria));break;}
  case 'mercury':{const basin=q(160,30,27,24);biome=basin<.8?'basalt':'regolith';tint=0x9b8d79;relief=.5;extra=5*Math.exp(-(((basin-1)/.11)**2))-4*(1-smooth(.7,1,basin));break;}
  case 'mars':{biome=abs>76?'waterice':lat>20?'marsdust':'ferrous';relief=.25;const trench=Math.abs(lat+12+2*Math.sin(lng*.06)),end=1-smooth(35,50,Math.abs(wrap(lng+65))),cut=(1-smooth(2,12,trench))*end;relief*=1-.8*cut;extra=-15*cut+26*Math.exp(-(q(-134,18,15,13)**2));break;}
  case 'venus':biome=Math.sin(lng*.03)*Math.cos(lat*.05)>.18?'venusrock':'basalt';relief=.4;extra=8*(1-smooth(.5,1,q(125,-7,38,16)));break;
  case 'jupiter':case 'saturn':case 'uranus':case 'neptune':{
   const axis=theme==='uranus'?Math.asin(x)/rad:lat,bands=Math.sin(axis*(theme==='jupiter'?.36:.22)+Math.sin(lng*.035)*.18);
   biome=theme==='neptune'?(bands>-.6?'bluecloud':'cyancloud'):theme==='uranus'?(Math.abs(axis)>64?'ammonia':'cyancloud'):bands>0?'ammonia':'ochrecloud';
   if(theme==='jupiter'&&q(-50,-22,20,9)<1)biome='stormcloud';
   if(theme==='saturn'&&lat>60&&Math.abs(Math.hypot(x,z)-.31*(1+.065*Math.cos(lng*rad*6)))<.025)biome='ochrecloud';
   if(theme==='neptune'&&q(45,-28,14,7)<1)tint=0x334c77;
   relief=.035;extra=1.5+Math.sin(axis*.5)*.55;break;}
  case 'titan':{const lakes=Math.min(q(45,73,32,12),q(116,69,24,10),q(-45,-74,25,8));land=.3+(lakes-1)*.35;biome=abs<34?'tholins':'waterice';relief=abs<34?.35:.18;break;}
  case 'europa':{const lines=Math.min(Math.abs(Math.sin(lng*.06+lat*.04)),Math.abs(Math.sin(lng*.023-lat*.08+1)));biome=lines<.17?'fracturedice':'waterice';relief=.1;extra=-3*(1-smooth(.02,.15,lines));break;}
  case 'ganymede':biome=Math.sin(lng*.044+Math.sin(lat*.04)*2)*Math.cos(lat*.06)>.1?'basalt':'fracturedice';relief=.22;break;
  case 'triton':{biome=lat<-25?'nitrogen':Math.cos(lng*.033)*Math.cos(lat*.07)>.3?'tholins':'fracturedice';relief=.23;
   for(const centre of [-125,-45,38,110]){const along=lat+58,across=wrap(lng-centre)-along*.35;if(along>0&&along<18&&Math.abs(across)<1+along*.18)tint=0x716d6b;}break;}
  case 'io':biome=Math.sin(lng*.09+lat*.03)*Math.cos(lat*.06)>.5?'sulfur':'ioplains';relief=.45;break;
  case 'callisto':{biome='basalt';const qv=q(60,20,32,28);if(Math.abs(Math.sin(qv*22))<.11&&qv<1.5)biome='waterice';relief=.35;extra=2*Math.sin(qv*22)*Math.exp(-qv*qv);break;}
  case 'pluto':{const px=wrap(lng-100)/32,py=(lat-12)/32;const heart=(px*px+py*py-1)**3-px*px*py**3;biome=heart<0?'nitrogen':abs>60?'waterice':'tholins';relief=heart<0?.12:.35;break;}
 }
 return {biome,land,relief,extra,tint};
}
