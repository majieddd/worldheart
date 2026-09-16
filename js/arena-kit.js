import * as THREE from 'three';

export function kit(paint){
  const mats={metal:paint.material('#647982'),edge:paint.material('#c7d0c3'),dark:paint.material('#293844'),gold:paint.material('#c6ab6d'),cloth:paint.material('#829d91'),glow:paint.material('#90dfcd',{emissive:.55}),red:paint.material('#a75447'),stone:paint.material('#aaa68c')};
  const box=(w,h,d)=>{const s=new THREE.Shape(),r=Math.min(w,h)*.12;s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelSize:.025,bevelThickness:.015,bevelSegments:1,steps:1,curveSegments:3});g.translate(0,0,-d/2);return g;};
  function mesh(parent,geo,material,pos=[0,0,0],rot=[0,0,0],outline=true){const m=new THREE.Mesh(geo,material);m.position.set(...pos);m.rotation.set(...rot);m.castShadow=m.receiveShadow=true;parent.add(m);if(outline)paint.contour(m);return m;}
  function blade(parent){const s=new THREE.Shape();s.moveTo(-.09,.15);s.lineTo(.09,.15);s.lineTo(.085,1.18);s.lineTo(0,1.49);s.lineTo(-.085,1.18);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:.04,bevelEnabled:true,bevelSize:.025,bevelThickness:.015,bevelSegments:1,steps:1});g.translate(0,0,-.02);mesh(parent,g,mats.edge);mesh(parent,box(.026,1.04,.045),mats.glow,[0,.72,.015],[0,0,0],false);}
  function weapon(kind){const root=new THREE.Group(),tip=new THREE.Object3D(),base=new THREE.Object3D();root.name=kind==='sword'?'Sable edge':'Pulse carbine';
    if(kind==='sword'){
      blade(root);mesh(root,new THREE.CylinderGeometry(.055,.065,.32,10),mats.dark,[0,-.035,0]);for(let i=0;i<5;i++)mesh(root,new THREE.TorusGeometry(.064,.011,4,12),mats.gold,[0,-.15+i*.053,0],[Math.PI/2,0,0],false);
      mesh(root,box(.4,.06,.12),mats.gold,[0,.15,0]);mesh(root,new THREE.OctahedronGeometry(.095),mats.glow,[0,-.245,0]);tip.position.set(0,1.5,0);base.position.set(0,.18,0);
    }else{
      mesh(root,box(.22,.26,.65),mats.cloth,[0,.12,-.22]);mesh(root,box(.13,.16,.35),mats.dark,[0,.13,.28]);mesh(root,box(.16,.25,.09),mats.gold,[0,.13,.46]);mesh(root,box(.115,.27,.14),mats.dark,[0,-.12,.03],[.3,0,0]);
      mesh(root,new THREE.CylinderGeometry(.072,.09,.55,12),mats.metal,[0,.14,-.75],[Math.PI/2,0,0]);mesh(root,new THREE.CylinderGeometry(.115,.105,.11,12),mats.gold,[0,.14,-1.025],[Math.PI/2,0,0]);mesh(root,new THREE.CylinderGeometry(.058,.058,.12,12),mats.glow,[0,.14,-1.09],[Math.PI/2,0,0],false);
      for(const side of [-1,1]){mesh(root,box(.035,.11,.4),mats.glow,[side*.133,.13,-.32],[0,0,0],false);for(let i=0;i<4;i++)mesh(root,box(.04,.19,.035),mats.metal,[side*.15,.12,-.48+i*.105]);}
      mesh(root,box(.075,.065,.5),mats.dark,[0,.31,-.2]);mesh(root,box(.1,.1,.14),mats.gold,[0,.36,-.04]);mesh(root,new THREE.SphereGeometry(.035,8,6),mats.glow,[0,.36,-.125],[0,0,0],false);tip.position.set(0,.14,-1.17);base.position.set(0,.1,-.25);
    }
    root.add(tip,base);return {root,tip,base,kind};
  }
  function tower(kind){const root=new THREE.Group(),head=new THREE.Group();root.add(head);head.position.y=1.4;
    mesh(root,new THREE.CylinderGeometry(.7,.95,.35,10),mats.stone,[0,.175,0]);mesh(root,new THREE.CylinderGeometry(.42,.58,1.1,10),mats.metal,[0,.85,0]);for(let i=0;i<3;i++)mesh(root,new THREE.TorusGeometry(.49,.045,5,18),mats.gold,[0,.52+i*.3,0],[Math.PI/2,0,0]);
    const muzzles=[];
    if(kind==='beacon'){mesh(head,new THREE.OctahedronGeometry(.58),mats.glow,[0,.55,0]);for(let i=0;i<3;i++)mesh(head,new THREE.TorusGeometry(.73,.045,5,32),mats.gold,[0,.6,0],[.4+i*.6,0,i*1.1]);muzzles.push(new THREE.Object3D());muzzles[0].position.y=.6;head.add(muzzles[0]);}
    else{mesh(head,box(1.05,.62,.8),kind==='plasma'?mats.cloth:mats.red,[0,.35,0]);const barrels=kind==='plasma'?[-.3,.3]:[-.2,0,.2];for(const x of barrels){mesh(head,new THREE.CylinderGeometry(.105,.12,1.2,10),mats.dark,[x,.4,-.74],[Math.PI/2,0,0]);mesh(head,new THREE.TorusGeometry(.13,.035,5,12),kind==='plasma'?mats.glow:mats.gold,[x,.4,-1.29],[0,0,0]);const end=new THREE.Object3D();end.position.set(x,.4,-1.36);head.add(end);muzzles.push(end);}mesh(head,new THREE.SphereGeometry(.16,12,8),mats.glow,[0,.79,-.23]);}
    return {root,head,muzzles,kind,cooldown:0,recoil:0};
  }
  return {mats,box,mesh,weapon,tower};
}
