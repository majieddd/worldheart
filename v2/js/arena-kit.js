import * as THREE from 'three';

export function kit(paint,{detail=false}={}){
  const material=(color,options={})=>paint.material(color,{...options,detail});
  const mats={metal:material('#647982'),edge:material('#c7d0c3'),dark:material('#293844'),gold:material('#c6ab6d'),cloth:material('#829d91'),glow:material('#90dfcd',{emissive:.55}),red:material('#a75447'),stone:material('#aaa68c')};
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
      // Small physical panel seams and paint chips remain sharp in the held view.
      for(const side of [-1,1]){
        mesh(root,box(.015,.13,.21),mats.metal,[side*.143,.14,-.04],[0,0,0],false);
        for(const z of [-.115,.025])for(const y of [.095,.195])mesh(root,new THREE.CylinderGeometry(.013,.013,.019,6),mats.gold,[side*.159,y,z],[0,0,Math.PI/2],false);
        for(let i=0;i<5;i++)mesh(root,box(.009,.008,.04+(i%2)*.026),mats.edge,[side*.13,.255,-.4+i*.065],[0,0,.12],false);
        mesh(root,box(.008,.018,.13),mats.dark,[side*.15,.17,-.04],[0,0,0],false);
      }
      for(let i=0;i<6;i++)mesh(root,box(.12,.016,.026),mats.metal,[0,.354,-.43+i*.06],[0,0,0],false);
      mesh(root,box(.075,.065,.5),mats.dark,[0,.31,-.2]);mesh(root,box(.1,.1,.14),mats.gold,[0,.36,-.04]);mesh(root,new THREE.SphereGeometry(.035,8,6),mats.glow,[0,.36,-.125],[0,0,0],false);tip.position.set(0,.14,-1.17);base.position.set(0,.1,-.25);
    }
    root.add(tip,base);return {root,tip,base,kind};
  }
  function tower(kind){
    if(kind==='cannon')return cannon();
    const root=new THREE.Group(),head=new THREE.Group();root.add(head);head.position.y=1.4;
    mesh(root,new THREE.CylinderGeometry(.7,.95,.35,10),mats.stone,[0,.175,0]);mesh(root,new THREE.CylinderGeometry(.42,.58,1.1,10),mats.metal,[0,.85,0]);for(let i=0;i<3;i++)mesh(root,new THREE.TorusGeometry(.49,.045,5,18),mats.gold,[0,.52+i*.3,0],[Math.PI/2,0,0]);
    const muzzles=[];
    if(kind==='beacon'){mesh(head,new THREE.OctahedronGeometry(.58),mats.glow,[0,.55,0]);for(let i=0;i<3;i++)mesh(head,new THREE.TorusGeometry(.73,.045,5,32),mats.gold,[0,.6,0],[.4+i*.6,0,i*1.1]);muzzles.push(new THREE.Object3D());muzzles[0].position.y=.6;head.add(muzzles[0]);}
    else{mesh(head,box(1.05,.62,.8),kind==='plasma'?mats.cloth:mats.red,[0,.35,0]);const barrels=kind==='plasma'?[-.3,.3]:[-.2,0,.2];for(const x of barrels){mesh(head,new THREE.CylinderGeometry(.105,.12,1.2,10),mats.dark,[x,.4,-.74],[Math.PI/2,0,0]);mesh(head,new THREE.TorusGeometry(.13,.035,5,12),kind==='plasma'?mats.glow:mats.gold,[x,.4,-1.29],[0,0,0]);const end=new THREE.Object3D();end.position.set(x,.4,-1.36);head.add(end);muzzles.push(end);}mesh(head,new THREE.SphereGeometry(.16,12,8),mats.glow,[0,.79,-.23]);}
    return {root,head,muzzles,kind,cooldown:0,recoil:0};
  }
  function cannon(){
    const root=new THREE.Group(),head=new THREE.Group();head.position.y=1.4;root.add(head);
    mesh(root,new THREE.CylinderGeometry(.68,1.04,1.25,8),mats.red,[0,.625,0]);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,x=Math.sin(a),z=Math.cos(a),brace=new THREE.Group();root.add(brace);brace.rotation.y=a;
      mesh(brace,box(.16,1.26,.08),mats.dark,[0,.65,.85],[.27,0,0]);
      for(const y of [.15,.52,1.03])mesh(brace,new THREE.SphereGeometry(.04,8,5),mats.metal,[0,y,.99-y*.22],[0,0,0],false);
      mesh(root,new THREE.DodecahedronGeometry(.21,0),mats.red,[x*.9,.2,z*.9]);
    }
    mesh(root,new THREE.CylinderGeometry(.79,.84,.27,12),mats.dark,[0,1.32,0]);
    mesh(head,box(.73,.55,.72),mats.metal,[0,.3,0]);
    for(const side of [-1,1]){mesh(head,box(.08,.48,.56),mats.dark,[side*.43,.18,0],[0,0,side*.16]);for(const z of [-.2,.2])mesh(head,new THREE.SphereGeometry(.048,8,5),mats.gold,[side*.48,.28,z],[0,0,0],false);}
    mesh(head,box(.25,.23,1.48),mats.metal,[0,.45,-.93]);mesh(head,box(.33,.3,.23),mats.dark,[0,.45,-1.7]);mesh(head,box(.21,.17,.012),mats.glow,[0,.45,-1.828],[0,0,0],false);
    for(let i=0;i<4;i++)mesh(head,box(.265,.018,.026),mats.edge,[0,.584,-.5-i*.29],[0,0,0],false);
    mesh(head,new THREE.SphereGeometry(.27,16,12),mats.glow,[0,.45,.51]);mesh(head,new THREE.TorusGeometry(.32,.06,5,16),mats.dark,[0,.45,.53]);
    const end=new THREE.Object3D();end.position.set(0,.45,-1.86);head.add(end);return {root,head,muzzles:[end],kind:'cannon',cooldown:0,recoil:0};
  }
  return {mats,box,mesh,weapon,tower};
}
