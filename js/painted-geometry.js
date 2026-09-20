import * as THREE from 'three';

// Same one-step chamfer language as the approved arena kit. Only large armor
// and housing blocks need it; small trim stays inexpensive and crisp.
export function paintedBox(w,h,d){
  const r=Math.min(w,h,d)*.065;
  if(Math.min(w,h,d)<.24)return new THREE.BoxGeometry(w,h,d);
  const x=w/2-r,y=h/2-r,s=new THREE.Shape();s.moveTo(-x,-y);s.lineTo(x,-y);s.lineTo(x,y);s.lineTo(-x,y);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:1,steps:1});g.translate(0,0,-d/2+r);return g;
}
