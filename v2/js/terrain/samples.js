import {createFormationField} from './formations.js';
import {LANDFORM_RECIPES} from './recipes.js';

// An isolated patch of the production field, with every neighboring group's
// relief disabled. Domain warp, shared valley shoulders and recipe shapes
// remain the same as on the globe. No separate gallery-only terrain formulas.
export function formationSample(type,seed=771) {
  if(!Object.hasOwn(LANDFORM_RECIPES,type))throw Error('Unknown formation');
  const weights=Object.fromEntries(Object.keys(LANDFORM_RECIPES).map(k=>[k,k===type?1:0]));
  const profile={range:90,canyon:38};
  const layout=createFormationField(seed,240,profile,'varied',{weights});
  const groups=layout.modules.map(m=>({id:m.id,disabled:m.id!==0}));
  const field=createFormationField(seed,240,profile,'varied',{weights,groups});
  const anchor=field.modules[0];
  const half=type==='grand'||type==='labyrinth'?135:65;
  function height(u,v){
    const p=anchor.dir.map((d,k)=>d+(anchor.axis[k]*u+anchor.side[k]*v)/240),l=Math.hypot(...p);
    return field.height(...p.map(d=>d/l));
  }
  return {field,anchor,half,height,type,seed};
}
