export const SWORD_DURATIONS=Object.freeze([.62,.64,.76]);
export const SWORD_REST=Object.freeze({p:[.34,-.48,-.66],r:[-.73,.1,-.25]});
// Tangents carry velocity through contact. A smoothstep on every segment used
// to stop the wrist at the middle of each cut, despite that being its fastest phase.
const cuts=[
  [[0,SWORD_REST.p,SWORD_REST.r],[.23,[.40,-.23,-.58],[-.65,.18,-.3]],[.44,[.04,-.24,-.68],[-.95,-.12,.55]],[.66,[-.08,-.34,-.56],[-1.08,-.25,1.05]],[1,SWORD_REST.p,SWORD_REST.r]],
  [[0,SWORD_REST.p,SWORD_REST.r],[.24,[-.06,-.18,-.52],[-.66,-.1,.6]],[.45,[.25,-.20,-.69],[-.98,.15,-.55]],[.66,[.40,-.32,-.65],[-1.05,.25,-.70]],[1,SWORD_REST.p,SWORD_REST.r]],
  [[0,SWORD_REST.p,SWORD_REST.r],[.28,[.2,-.05,-.57],[-.35,0,-.08]],[.48,[.16,-.24,-.72],[-1.2,0,.06]],[.69,[.12,-.37,-.67],[-1.5,0,.08]],[1,SWORD_REST.p,SWORD_REST.r]]
];
export function swordPose(cut,t){
  const keys=cuts[((cut%3)+3)%3];t=Math.max(0,Math.min(1,t));let i=0;
  while(i<keys.length-2&&t>keys[i+1][0])i++;
  const a=keys[i],b=keys[i+1],span=b[0]-a[0],u=(t-a[0])/span,u2=u*u,u3=u2*u;
  const tangent=(n,field,c)=>n===0||n===keys.length-1||n===1?0:(keys[n+1][field][c]-keys[n-1][field][c])/(keys[n+1][0]-keys[n-1][0]);
  const values=field=>a[field].map((v,c)=>(2*u3-3*u2+1)*v+(u3-2*u2+u)*span*tangent(i,field,c)+(-2*u3+3*u2)*b[field][c]+(u3-u2)*span*tangent(i+1,field,c));
  return {p:values(1),r:values(2)};
}
