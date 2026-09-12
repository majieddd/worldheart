import {smoothstep as smooth} from '../noise.js';
// Twenty additional shapes. Separate supports/roofs are built by features.js;
// this field is the ground underneath them and remains a single navigation floor.
export const ADDITIONAL_RECIPES=Object.freeze({
 grotto:{label:'Vaulted grotto',relief:'range',gain:.43,roughness:.02},
 sky:{label:'Sky mesa',relief:'range',gain:.7,roughness:.02},
 geyser:{label:'Geyser staircase',relief:'range',gain:.2,roughness:.02},
 delta:{label:'Braided delta',relief:'canyon',gain:.4,roughness:.02},
 amphitheatre:{label:'Horseshoe amphitheatre',relief:'range',gain:.68,roughness:.04},
 cuesta:{label:'Tilted cuesta comb',relief:'range',gain:.55,roughness:.06},
 crescents:{label:'Crescent dune caravan',relief:'range',gain:.29,roughness:.02},
 dome:{label:'Whaleback dome',relief:'range',gain:.7,roughness:.015},
 pedestals:{label:'Pedestal orchard',relief:'range',gain:.45,roughness:.02},
 honeycomb:{label:'Honeycomb hoodoos',relief:'range',gain:.26,roughness:.02},
 wave:{label:'Folded wave rock',relief:'range',gain:.72,roughness:.03},
 scablands:{label:'Flood scablands',relief:'canyon',gain:.6,roughness:.06},
 box:{label:'Box canyon',relief:'canyon',gain:1,roughness:.01},
 kame:{label:'Kame staircase',relief:'range',gain:.38,roughness:.02},
 atoll:{label:'Reef atoll',relief:'range',gain:.16,roughness:.03},
 trunks:{label:'Petrified trunk maze',relief:'range',gain:.32,roughness:.04},
 oxbow:{label:'Oxbow terraces',relief:'canyon',gain:.8,roughness:.03},
 shields:{label:'Pancake lava shields',relief:'range',gain:.3,roughness:.015},
 kettles:{label:'Kettle chain',relief:'canyon',gain:.6,roughness:.02},
 fulgurite:{label:'Fulgurite crown',relief:'range',gain:.75,roughness:.03},
});
const clamp=x=>Math.max(0,Math.min(1,x)),ridge=(d,w)=>1-smooth(0,w,Math.abs(d));
const segment=(x,y,ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy));return Math.hypot(x-ax-t*dx,y-ay-t*dy);};
export function additionalHeight(m,u,v,extent,rise){
 const x=u/extent,y=v/extent,r=Math.hypot(x,y),a=Math.atan2(y,x),edge=smooth(0,.24,rise),env=edge*(1-smooth(.8,1.15,r));
 const h=m.height,depth=Math.min(h,extent*.72),ramp=smooth(0,.8,rise);
 switch(m.type){
  case 'grotto': return h*env*(.7*ridge(Math.abs(y)-.42,.23)*(1-smooth(.5,.9,Math.abs(x))))-depth*.15*env*ridge(y,.3);
  case 'sky': return -depth*.25*env*(1-smooth(.2,.64,r));
  case 'geyser': {
   let level=0;for(let k=0;k<4;k++){const q=Math.hypot(x+.55-k*.34,y-Math.sin(k*1.8)*.22);level=Math.max(level,(k+1)*.2*(1-smooth(.15,.33,q)));}
   return h*env*level;
  }
  case 'delta': {
   const t=clamp((x+1)/2),spread=.1+t*.7;let channel=0;
   for(let k=-2;k<=2;k++){const line=k*spread*.45+.08*Math.sin(x*8+k);channel=Math.max(channel,1-smooth(.04+.025*t,.18+.06*t,Math.abs(y-line)));}
   return depth*.24*env*(.3-channel)*(1-smooth(.75,1.05,Math.abs(y)));
  }
  case 'amphitheatre': {
   const opening=smooth(.06,.33,Math.abs(a));
   const benches=.3*(1-smooth(.32,.39,r))+.3*(1-smooth(.56,.65,r));
   return h*env*opening*(ridge(r-.72,.22)-benches*.12);
  }
  case 'cuesta': {
   let shape=0;for(let k=-1;k<=1;k++){const p=(y-k*.5+.12*x)/.32;shape=Math.max(shape,clamp((p+1)/2)*(1-smooth(.05,.2,p))*(1-smooth(.5+.1*k,.95,Math.abs(x))));}
   return h*env*shape;
  }
  case 'crescents': {
   let shape=0;for(const [cx,cy,s]of [[-.4,-.34,.39],[.33,.3,.47],[.35,-.47,.25]]){
    const dx=x-cx,dy=y-cy,q=Math.hypot(dx,dy),bowl=Math.hypot(dx-s*.55,dy);
    shape=Math.max(shape,(1-smooth(s*.35,s,q))*smooth(s*.4,s*.8,bowl));
   }return h*env*shape;
  }
  case 'dome': {const q=Math.hypot(x/.92,y/.58),cleft=1-.5*ridge(x-.22-.1*Math.sin(y*6),.14);return h*env*Math.sqrt(clamp(1-q*q))*cleft;}
  case 'pedestals': {let feet=0;for(const [cx,cy]of [[-.4,-.3],[.38,-.28],[0,.4]])feet=Math.max(feet,ridge(Math.hypot(x-cx,y-cy),.15));return h*.2*env*feet;}
  case 'honeycomb': {
   let first=9,second=9;for(let row=-1;row<=1;row++)for(let col=-1;col<=1;col++){const d=Math.hypot(x-col*.62-(row%2)*.31,y-row*.537);if(d<first){second=first;first=d;}else second=Math.min(second,d);}
   const wall=1-smooth(.04,.16,second-first),gate=smooth(.07,.16,Math.abs(Math.sin(a*3)*r));return h*env*wall*gate;
  }
  case 'wave': {const bend=y-.22*Math.sin(x*4.5);return h*env*ridge(bend,.30)*(.45+.55*smooth(-.22,.02,bend))*(1-smooth(.7,1,Math.abs(x)));}
  case 'scablands': {
   let island=0;for(const [cx,cy]of [[-.5,-.3],[.15,.34],[.52,-.25]]){const dx=x-cx,dy=y-cy;island=Math.max(island,1-smooth(.1,.9,Math.hypot(dx/(dx<0?.18:.48),dy/.22)));}
   const scour=1-smooth(.25,.65,Math.abs(y+.12*Math.sin(x*7)));return depth*env*(.6*island-.32*scour);
  }
  case 'box': {const q=Math.max(Math.abs(y)/.64,(x+.15)/.74),cut=1-smooth(.65,1,q),mouth=smooth(-.98,-.1,x);return -depth*ramp*cut*mouth;}
  case 'kame': {let top=0;for(let k=0;k<5;k++){const cx=-.65+k*.31,cy=(k%2?1:-1)*.27,q=Math.hypot((x-cx)/.3,(y-cy)/.25);top=Math.max(top,(.25+k*.16)*(1-smooth(.45,1,q)));}return h*env*top;}
  case 'atoll': {const ring=ridge(r-.57-.06*Math.sin(a*3),.18),breach=smooth(.24,.42,Math.abs(Math.sin(a*1.5)));return h*env*ring*breach-depth*.1*env*(1-smooth(.28,.4,r));}
  case 'trunks': return h*.06*env*(.5+.5*Math.sin(x*6)*Math.sin(y*4));
  case 'oxbow': {const bend=Math.hypot((x+.05)/.7,y/.63),cut=1-smooth(.08,.23,Math.abs(bend-.68)),mouth=smooth(-.95,-.2,x);return depth*env*(.16*(1-smooth(.18,.33,bend))-.8*cut*mouth);}
  case 'shields': {let top=0;for(const [cx,cy,s,g]of [[-.35,-.24,.48,.75],[.3,.2,.53,1],[.3,-.42,.32,.55]]){const q=Math.hypot(x-cx,y-cy)/s;top=Math.max(top,g*(1-smooth(.62,1,q)));}return h*env*top;}
  case 'kettles': {let cut=0;for(let k=0;k<5;k++){const q=Math.hypot(x+.67-k*.33,y-Math.sin(k*2)*.3);cut=Math.max(cut,(1-smooth(.07,.23,q))*(.55+.1*k));}return -depth*.7*ramp*cut;}
  case 'fulgurite': {
   let distance=9;for(let k=0;k<5;k++){const t=k*Math.PI*2/5+.14,ax=Math.cos(t)*.28,ay=Math.sin(t)*.28,bx=Math.cos(t+.16)*.72,by=Math.sin(t+.16)*.72;distance=Math.min(distance,segment(x,y,ax,ay,bx,by));for(const sign of [-1,1])distance=Math.min(distance,segment(x,y,bx,by,Math.cos(t+sign*.28)*1.03,Math.sin(t+sign*.28)*1.03));}
   return h*env*ridge(distance,.105);
  }
  default:return 0;
 }
}
