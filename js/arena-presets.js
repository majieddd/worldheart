// Screenshot comparisons are named overrides. The approved recipe stays immutable.
export const GRAPHICS_DEFAULTS=Object.freeze({line:1.4,fog:.0115,shadowDepth:.10,saturation:1.16,texture:1,exposure:1,resolution:1.25,fov:78,bob:.35,shake:.45,sensitivity:1});
export const GRAPHICS_LIMITS={line:[0,4],fog:[0,.035],shadowDepth:[0,.35],saturation:[.6,1.65],texture:[0,2],exposure:[.65,1.4],resolution:[.65,1.75],fov:[60,100],bob:[0,1],shake:[0,1],sensitivity:[.4,2]};
export const GRAPHICS_PRESETS=Object.freeze({
  default:Object.freeze({name:'1.3.1 original',graphics:GRAPHICS_DEFAULTS}),
  vivid:Object.freeze({name:'Vivid paint',graphics:Object.freeze({line:1.74,fog:.0185,shadowDepth:.35,saturation:1.65,texture:1.77,exposure:1.19,resolution:1,fov:80,bob:.44,shake:.45,sensitivity:1})}),
  deep:Object.freeze({name:'Deep ink',graphics:Object.freeze({line:2.8,fog:.021,shadowDepth:.3,saturation:1.5,texture:1.69,exposure:.84,resolution:1.25,fov:81,bob:.45,shake:.45,sensitivity:1})})
});
export function normalizeGraphics(input={}){return Object.fromEntries(Object.entries(GRAPHICS_DEFAULTS).map(([k,v])=>[k,typeof input[k]==='number'&&Number.isFinite(input[k])?Math.max(GRAPHICS_LIMITS[k][0],Math.min(GRAPHICS_LIMITS[k][1],input[k])):v]));}
export function matchingPreset(graphics){return Object.keys(GRAPHICS_PRESETS).find(id=>Object.entries(GRAPHICS_PRESETS[id].graphics).every(([k,v])=>Math.abs(graphics[k]-v)<1e-6))||'custom';}
