import {smoothstep as smooth} from '../noise.js';

// Reference morphology and deliberate gameplay departures are catalogued in
// docs/qa/implementation/EXTREME-WORLDS.md. These are surface fields, not caves.
export const EXOTIC_RECIPES = Object.freeze({
  impact:{label:'Meteor impact zone',relief:'range',gain:.48,roughness:.08},
  yardangs:{label:'Wind-carved yardangs',relief:'range',gain:.58,roughness:.06},
  drumlins:{label:'Drumlin shoal',relief:'range',gain:.36,roughness:.04},
  fan:{label:'Alluvial fan',relief:'range',gain:.36,roughness:.08},
  karst:{label:'Joined karst sinkholes',relief:'canyon',gain:1.6,roughness:.06},
  spiral:{label:'Spiral polar troughs',relief:'canyon',gain:.85,roughness:.06},
  blades:{label:'Penitente blade field',relief:'range',gain:.68,roughness:.05},
  spider:{label:'Araneiform star channels',relief:'canyon',gain:.8,roughness:.08},
  cells:{label:'Convection cell mosaic',relief:'canyon',gain:.55,roughness:.04},
  stripes:{label:'Tiger-stripe fractures',relief:'canyon',gain:.8,roughness:.05},
});
const clamp=x=>Math.max(0,Math.min(1,x));
const ridge=(d,w)=>1-smooth(0,w,Math.abs(d));

export function exoticHeight(m,u,v,extent,rise) {
  const x=u/extent,y=v/extent,r=Math.hypot(x,y),a=Math.atan2(y,x);
  const edge=smooth(0,.26,rise),envelope=edge*(1-smooth(.72,1.15,r));
  const depth=Math.min(m.height,m.extent*.29),ramp=edge*rise;
  switch(m.type){
    case 'impact': {
      // One excavated meteor bowl, a broken raised rim and radial ejecta.
      // A wide graded breach connects the crater floor to the outer ground.
      const gate=smooth(.08,.32,Math.abs(a-.12));
      const rim=.48*ridge(r-.65,.18)*gate;
      const bowl=(1-smooth(.28,.61,r))*smooth(-.9,-.2,x);
      const ejecta=.12*ridge(r-.85,.22)*Math.abs(Math.cos(a*7));
      return envelope*(m.height*(rim+ejecta)-depth*.75*bowl);
    }
    case 'yardangs': {
      // Five long high rock fins, aligned with the wind; staggered ends and
      // one transverse wind gap. No repetitive sawtooth dune slip faces.
      let h=0;
      for(let k=-2;k<=2;k++){
        const across=y-k*.40-.06*Math.sin(x*3+m.phase);
        const end=1-smooth(.5+.08*(k%2),.95,Math.abs(x));
        h=Math.max(h,ridge(across,.095)*end*(.7+.12*(k+2)));
      }
      return m.height*envelope*h*smooth(.055,.15,Math.abs(x-.26));
    }
    case 'drumlins': {
      let h=0;
      for(let k=-1;k<=1;k++)for(let j=-1;j<=1;j++){
        const dx=x-j*.76-(k%2)*.13,dy=y-k*.66;
        const length=dx<0?.24:.46,q=Math.hypot(dx/length,dy/.18);
        h=Math.max(h,Math.pow(clamp(1-q*q),1.5));
      }
      return m.height*envelope*h;
    }
    case 'fan': {
      // One apex opens into a broad, scalloped depositional wedge. Radial
      // shallow distributaries divide a walkable sloping apron.
      const dx=x+.68,rr=Math.hypot(dx,y),angle=Math.atan2(y,dx);
      const wedge=1-smooth(.68,.85,Math.abs(angle));
      const toe=1-smooth(.94+.06*Math.cos(angle*11),1.3,rr);
      const drainage=.73+.27*smooth(.08,.5,Math.abs(Math.sin(angle*7)));
      const apron=m.height*envelope*wedge*toe*clamp(1-rr/1.4)*drainage;
      const apex=m.height*.35*(1-smooth(.12,.25,Math.hypot(x+.5,y)));
      return Math.max(Math.min(m.height*.35,apron*(smooth(.12,.3,rr))),apex);
    }
    case 'karst': {
      // Three deep joined dolines. These intentionally trap careless falls;
      // nests use connected clearings outside their steep bowls.
      let cut=0;
      for(const cx of [-.55,0,.55])cut=Math.max(cut,1-smooth(.10,.36,Math.hypot(x-cx,y)));
      cut=Math.max(cut,.55*ridge(y,.14));
      return -Math.min(m.height,m.extent*.85)*ramp*cut;
    }
    case 'spiral': {
      // A single Archimedean spiral, continuous across atan2's seam. Radial
      // spacing leaves a full route above and below rather than paired cuts.
      const angle=((a-m.phase)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
      let distance=9;
      for(let turn=0;turn<2;turn++){const radius=.08+(angle+turn*Math.PI*2)*.066;distance=Math.min(distance,Math.abs(r-radius));}
      const cut=1-smooth(.045,.115,distance);
      return -depth*ramp*cut;
    }
    case 'blades': {
      // Many small pointed blades, not seven broad flat-topped buttes.
      const qx=x*3,qy=y*3,ix=Math.round(qx),iy=Math.round(qy);
      const dx=qx-ix,dy=qy-iy-.12*Math.sin(ix*2);
      const spike=Math.pow(clamp(1-Math.abs(dx)/.22-Math.abs(dy)/.43),.8);
      return m.height*envelope*spike*(.65+.35*Math.abs(Math.sin(ix*4+iy*7+m.phase)));
    }
    case 'spider': {
      // Drainage radiates inward to one vent instead of a ravine's trunk.
      const legs=Math.abs(Math.sin(a*4+.26*Math.sin(r*9)))*r;
      const forks=Math.abs(Math.sin(a*8+.35))*r;
      const cut=Math.max(1-smooth(.075,.19,legs),(1-smooth(.035,.085,forks))*smooth(.3,.55,r));
      return -depth*ramp*Math.max(cut,1-smooth(.16,.32,r));
    }
    case 'cells': {
      // Low convex polygon rafts divided by a continuous depressed network.
      // Smooth tops distinguish these from tall angular chaos blocks.
      let first=Infinity,second=Infinity;
      for(let row=-2;row<=2;row++)for(let col=-2;col<=2;col++){
        const d=Math.hypot(x-col*.72-(row%2)*.36,y-row*.624);
        if(d<first){second=first;first=d;}else if(d<second)second=d;
      }
      const seam=1-smooth(.17,.27,second-first);
      return Math.min(m.height,16)*envelope*((1-seam)*.75-seam*.3);
    }
    case 'stripes': {
      let cut=0;
      for(let k=-1.5;k<=1.5;k++)cut=Math.max(cut,1-smooth(.055,.14,Math.abs(y-k*.34+.08*Math.sin(x*2))));
      return -depth*ramp*cut;
    }
    default: return 0;
  }
}
