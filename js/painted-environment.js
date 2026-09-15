import * as THREE from 'three';
import {mergeGeometries,mergeVertices} from '../lib/addons/utils/BufferGeometryUtils.js';

export function createPaintedEnvironment(paint){
  const root=new THREE.Group(),wind=[],ripples=[];let seed=80291;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const riverX=z=>4.5+Math.sin(z*0.16)*2.3;
  const height=(x,z)=>{const base=0.18+Math.sin(x*0.22)*0.42+Math.sin(z*0.25+x*0.1)*0.38;const bank=Math.min(1,Math.abs(x-riverX(z))/2.4);return base*bank-0.42*(1-bank)+0.007*Math.min(24,Math.max(0,-z-3))**2;};
  const mats={grass:paint.material('#9cae70'),earth:paint.material('#cfbb8c'),rock:paint.material('#b4a89a'),pale:paint.material('#c8bca5'),moss:paint.material('#849a62'),bark:paint.material('#777759'),leaf:paint.material('#7e9b58',{plant:true}),lightLeaf:paint.material('#bac178',{plant:true}),darkLeaf:paint.material('#5e824e',{plant:true}),stem:paint.material('#789353',{plant:true}),flower:paint.material('#e8d7ad',{plant:true}),purple:paint.material('#aaa3ba',{plant:true}),wood:paint.material('#9e845e'),trim:paint.material('#d6bc84')};
  function add(geo,mat,pos=[0,0,0],scale=[1,1,1],outlined=false,parent=root){const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);if(outlined)paint.contour(m);return m;}
  const terrain=new THREE.PlaneGeometry(130,110,220,190);terrain.rotateX(-Math.PI/2);const p=terrain.attributes.position,colors=[];
  mats.leaf.color.set('#648e51');mats.lightLeaf.color.set('#a9bd6a');mats.darkLeaf.color.set('#426e4e');mats.moss.color.set('#718e58');mats.rock.color.set('#a9a293');
  const greens=[new THREE.Color('#9bb571'),new THREE.Color('#74975b'),new THREE.Color('#b9be85')],sand=new THREE.Color('#d5c39b');
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,height(x,z));const n=(Math.sin(x*0.32+Math.cos(z*0.28))*Math.cos(z*0.39)+1)*0.5;const col=greens[0].clone().lerp(greens[1],n*0.7).lerp(greens[2],Math.max(0,Math.sin(x*0.7+z*0.21))*0.4);const river=Math.abs(x-riverX(z));const path=Math.abs(x+2.5+Math.sin(z*0.25)*1.3);const wear=Math.max(1-THREE.MathUtils.smoothstep(river,1.6,3),1-THREE.MathUtils.smoothstep(path,0.6,1.5));col.lerp(sand,wear*0.93);colors.push(col.r,col.g,col.b);}
  terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();const terrainMat=paint.material('#fff5e1');terrainMat.vertexColors=true;add(terrain,terrainMat);
  function stone(x,z,sx=1,sy=1,sz=1,{at=null,material=mats.rock,detail=2,outline=true}={}){
    if(sx<2&&[[-3,4,1.8],[-5,-2,2.5],[6,-7,2.3],[8,3,2.4]].some(([ax,az,r])=>(x-ax)**2+(z-az)**2<r*r))return null;
    let g=new THREE.IcosahedronGeometry(1,detail+2);const ps=g.attributes.position;const phase=random()*8;
    for(let i=0;i<ps.count;i++){const x=ps.getX(i),y=ps.getY(i),z=ps.getZ(i);const n=1+0.12*Math.sin(x*6+y*3+phase)*Math.cos(z*5-y*3)+0.035*Math.sin(y*15+x*2);ps.setXYZ(i,x*n,y*n,z*n);}g.deleteAttribute('normal');g.deleteAttribute('uv');g=mergeVertices(g);g.computeVertexNormals();
    const m=add(g,material,[x,at??height(x,z)+sy*0.34,z],[sx,sy,sz],outline);m.rotation.y=random()*6.28;return m;
  }
  // Interlocking weathered masses replace the first study's identical cylinders.
  for(const [x,z,sx,sy,sz] of [[-14,-10,6,6,5],[-10,-17,6,7,4],[-2,-22,7,6,4],[10,-19,5,7,5],[18,-11,6,6,5],[-20,1,5,4,7]]){
    stone(x,z,sx,sy,sz);stone(x+1,z+1,sx*0.8,sy*0.55,sz*0.8,{at:height(x,z)+sy*0.85,material:mats.pale});
    stone(x-1,z+2,sx*.68,sy*.25,sz*.65,{at:height(x,z)+sy*1.16,material:mats.moss,detail:2,outline:false});
  }
  for(let i=0;i<55;i++){const z=-18+random()*38,x=riverX(z)+(random()<0.5?-1:1)*(1.7+random()*1.7),s=0.18+random()*0.65;stone(x,z,s,s*0.65,s*0.8,{material:i%4===0?mats.moss:mats.pale,outline:i%3===0});}
  for(let i=0;i<20;i++){const x=-18+random()*36,z=-17+random()*35;if(Math.abs(x-riverX(z))<3||Math.abs(x+2.5)<2)continue;const s=.2+random()*.7;stone(x,z,s,s*.65,s*.8,{material:mats.moss,outline:true});}
  const distant=paint.material('#8eaa98');for(let i=0;i<8;i++){stone(-55+i*15,-40-random()*8,13,6+random()*5,9,{material:distant,outline:false,detail:3});}
  // The stream is a physical ribbon following the river bed, with a slow,
  // restrained paint pattern and separate foam rather than a flat blue plane.
  const verts=[],idx=[],uv=[];
  for(let i=0;i<=110;i++){const z=-27+i/110*54,x=riverX(z),w=1.1+Math.sin(z*.6)*.13;for(const s of [-1,1]){verts.push(x+w*s,-.18+Math.max(0,-z-3)**2*.0065,z);uv.push(s===-1?0:1,i/110*8);}if(i<110){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}}
  const waterGeo=new THREE.BufferGeometry();waterGeo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));waterGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));waterGeo.setIndex(idx);waterGeo.computeVertexNormals();
  const waterMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:{value:0},skyTint:{value:new THREE.Color('#b5ccc2')}},vertexShader:'varying vec2 wUv;varying vec3 wWorld;void main(){wUv=uv;vec4 p=modelMatrix*vec4(position,1.0);wWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',fragmentShader:`varying vec2 wUv;varying vec3 wWorld;uniform float time;uniform vec3 skyTint;void main(){float band=sin(wUv.y*22.0+sin(wUv.x*13.0+time*.35)*1.5-time*.45);float streak=smoothstep(.88,.99,band)*.21;float bank=pow(abs(wUv.x-.5)*2.0,9.0);vec3 c=mix(vec3(.19,.38,.35),skyTint,.38+streak);c+=bank*.12;gl_FragColor=vec4(c,.87);
#include <colorspace_fragment>
}`});
  const water=add(waterGeo,waterMaterial);water.castShadow=false;water.receiveShadow=false;
  for(let i=0;i<12;i++){const z=-17+i*3.3,x=riverX(z);const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x-.8,-.14+Math.max(0,-z-3)**2*.0065,z),new THREE.Vector3(x-.1,-.14+Math.max(0,-z-3)**2*.0065,z+.12),new THREE.Vector3(x+.45,-.14+Math.max(0,-z-3)**2*.0065,z)]);const line=new THREE.Mesh(new THREE.TubeGeometry(curve,14,.016,3,false),new THREE.MeshBasicMaterial({color:'#dbe1bc',transparent:true,opacity:.4}));root.add(line);ripples.push(line);}
  function branch(parent,a,b,r){const mid=a.clone().add(b).multiplyScalar(.5);const m=add(new THREE.CylinderGeometry(r*.48,r,a.distanceTo(b),7),mats.bark,mid.toArray(),[1,1,1],r>.18,parent);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());}
  function tree(x,z,size=1){const group=new THREE.Group();group.position.set(x,height(x,z),z);group.scale.setScalar(size);root.add(group);
    branch(group,new THREE.Vector3(0,0,0),new THREE.Vector3(.3,5,0),.46);
    const crowns=[];
    for(let j=0;j<5;j++){const a=j*2.399,r=1.3+random()*.8;const end=new THREE.Vector3(Math.cos(a)*r,4.4+random()*1.5,Math.sin(a)*r);branch(group,new THREE.Vector3(.2,2.2+j*.4,0),end,.19);crowns.push(end);}
    const crown=new THREE.Group();group.add(crown);wind.push({group:crown,phase:random()*6});
    const leaves=[[],[],[]],centers=[];
    for(const c of crowns)for(let j=0;j<7;j++){const a=random()*6.28,r=random()*1.5,center=new THREE.Vector3(c.x+Math.cos(a)*r,c.y+(random()-.4)*1.2,c.z+Math.sin(a)*r);centers.push(center);const leaf=add(new THREE.SphereGeometry(1,12,8),j%3===0?mats.lightLeaf:j%3===1?mats.leaf:mats.darkLeaf,center.toArray(),[1.3+random()*.5,.45+random()*.35,1.0+random()*.6],false,crown);leaf.rotation.y=a;leaf.castShadow=j%2===0;}
    // Small leaves break up every crown's silhouette, merged by paint color.
    for(const c of centers)for(let j=0;j<32;j++){const a=random()*6.28,r=.6+random()*1.1,y=(random()-.3)*.7;const leaf=new THREE.SphereGeometry(1,5,3);leaf.scale(.17+random()*.19,.035,.08+random()*.09);leaf.rotateZ((random()-.5)*.9);leaf.rotateY(a);leaf.translate(c.x+Math.cos(a)*r,c.y+y,c.z+Math.sin(a)*r);leaves[j%3].push(leaf);}
    leaves.forEach((geos,i)=>{const m=add(mergeGeometries(geos),[mats.lightLeaf,mats.leaf,mats.darkLeaf][i],[0,0,0],[1,1,1],false,crown);m.castShadow=false;geos.forEach(g=>g.dispose());});
    return group;
  }
  tree(-10,1,1.25);tree(13,-7,1.15);tree(-9,-12,.9);tree(14,11,.85);
  // Hundreds of small blades are merged into a few draw calls. Their pointed
  // silhouettes and varied hue do more for a meadow than many round shrubs.
  const grassGeo=[],flowerGeo=[],purpleGeo=[];
  for(let i=0;i<2100;i++){const x=-23+random()*46,z=-23+random()*46;if(Math.abs(x-riverX(z))<2.4||Math.abs(x+2.5+Math.sin(z*.25)*1.3)<1.05||((x+3)**2+(z-4)**2)<2)continue;
    for(let j=0;j<6;j++){const bx=x+(random()-.5)*.34,bz=z+(random()-.5)*.34,h=.18+random()*.48,w=.018+random()*.023,y=height(bx,bz),a=random()*6.28,lean=.08+random()*.26,pts=[],indices=[],cols=[];const color=new THREE.Color().setHSL(.20+random()*.04,.26+random()*.16,.35+random()*.2);
      for(let k=0;k<=4;k++){const t=k/4,dx=Math.cos(a)*w*(1-t),dz=Math.sin(a)*w*(1-t),bend=t*t*lean;for(const side of [-1,1]){pts.push(bx+dx*side+Math.sin(a)*bend,y+t*h,bz+dz*side+Math.cos(a)*bend);cols.push(color.r*(.7+t*.3),color.g*(.7+t*.3),color.b*(.7+t*.3));}if(k<4){const n=k*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}
      const blade=new THREE.BufferGeometry();blade.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));blade.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));blade.setIndex(indices);blade.computeVertexNormals();grassGeo.push(blade);
      if(j===0&&i%5===0){const blossom=new THREE.SphereGeometry(.065+random()*.05,6,3);blossom.scale(1,.3,1);blossom.translate(bx+Math.sin(a)*lean,y+h,bz+Math.cos(a)*lean);(i%10===0?flowerGeo:purpleGeo).push(blossom);}}}
  mats.stem.color.set('#d7dea6');mats.stem.vertexColors=true;
  for(const [geos,mat] of [[grassGeo,mats.stem],[flowerGeo,mats.flower],[purpleGeo,mats.purple]]){const m=add(mergeGeometries(geos),mat);m.castShadow=false;geos.forEach(g=>g.dispose());}
  // A low broken wall and stone crossing add authored landmarks without
  // turning the small slice into a full gameplay map.
  for(let i=0;i<8;i++){const x=-7+i*.65,z=-4+Math.sin(i*.4)*.18;const m=add(new THREE.BoxGeometry(.64,.44,.55,2,2,2),mats.pale,[x,height(x,z)+.2,z],[1,1,1],true);m.rotation.y=(random()-.5)*.2;if(i<5)add(new THREE.BoxGeometry(.62,.38,.52),mats.rock,[x+.15,height(x,z)+.58,z],[1,1,1],true);}
  for(let i=0;i<6;i++){const z=7.6,x=riverX(z)-1.5+i*.58;stone(x,z,.43,.15,.43,{at:-.07,material:mats.pale});}
  const heart=new THREE.Group();heart.position.set(-1,height(-1,-4),-4);root.add(heart);
  add(new THREE.CylinderGeometry(.8,1.1,.4,12),mats.pale,[0,.2,0],[1,1,1],true,heart);
  const crystalMat=paint.material('#79cbb6',{emissive:.3});
  const crystal=add(new THREE.OctahedronGeometry(1),crystalMat,[0,1.45,0],[.57,1.05,.57],true,heart);
  function animate(t){for(const w of wind)w.group.rotation.z=Math.sin(t*.7+w.phase)*.012;waterMaterial.uniforms.time.value=t;for(let i=0;i<ripples.length;i++)ripples[i].material.opacity=.27+Math.sin(t*.7+i)*.08;crystal.rotation.y=Math.sin(t*.25)*.15;}
  return {root,height,riverX,animate,wind,water,grassCount:grassGeo.length,flowerCount:flowerGeo.length+purpleGeo.length};
}
