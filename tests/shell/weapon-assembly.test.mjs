import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
globalThis.location={search:'?map=ninetynine'};globalThis.matchMedia=()=>({matches:false});
registerHooks({resolve(spec,context,next){if(spec==='three')return{url:new URL('../../lib/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(spec,context);}});
const T=await import('../../lib/three.module.min.js'),{buildWeapon}=await import('../../js/weapon-model.js'),{buildSoldier,poseSoldier,freshSoldierState}=await import('../../js/soldier.js');
const mats=Object.fromEntries(['dark','grip','body','trim','energy','gold','skin','cloth'].map(k=>[k,new T.MeshStandardMaterial()]));
function solidBounds(geo){
 const vertices=[],ids=new Map(),parent=[],position=geo.attributes.position,root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(let i=0;i<position.count;i+=3){const triangle=[];for(let j=0;j<3;j++){const v=new T.Vector3().fromBufferAttribute(position,i+j),key=v.toArray().map(x=>x.toFixed(5)).join(',');let id=ids.get(key);if(id===undefined){id=vertices.length;ids.set(key,id);vertices.push(v);parent.push(id);}triangle.push(id);}parent[root(triangle[1])]=root(triangle[0]);parent[root(triangle[2])]=root(triangle[0]);}
 const boxes=new Map();for(let i=0;i<vertices.length;i++){const r=root(i);if(!boxes.has(r))boxes.set(r,new T.Box3());boxes.get(r).expandByPoint(vertices[i]);}return [...boxes.values()];
}
test('separate weapon solids form a connected assembly of touching bounds around the grip',()=>{
 for(const visual of ['sword','spear','rifle','mortar'])for(const era of ['ancient','technological','empowered']){
  const boxes=buildWeapon(visual,era,mats).parts.flatMap(p=>solidBounds(p.geo)),seen=new Set(),origin=new T.Vector3();
  boxes.forEach((b,i)=>{if(b.containsPoint(origin))seen.add(i);});
  for(let pass=0;pass<boxes.length;pass++)for(let i=0;i<boxes.length;i++)if(!seen.has(i)&&[...seen].some(j=>boxes[i].clone().expandByScalar(.006).intersectsBox(boxes[j])))seen.add(i);
  assert.equal(seen.size,boxes.length,`${visual}/${era} unsupported solid bounds: ${JSON.stringify(boxes.filter((b,i)=>!seen.has(i)).map(b=>[b.min.toArray(),b.max.toArray()]))}`);
 }
});
test('all twelve family-era assemblies have finite geometry and distinct silhouettes',()=>{
 for(const visual of ['sword','spear','rifle','mortar']){
  const signatures=[];
  for(const era of ['ancient','technological','empowered']){
   const kit=buildWeapon(visual,era,mats),geometry=kit.parts.map(p=>p.geo),group=new T.Group();
   for(const g of geometry){assert.ok(Array.from(g.attributes.position.array).every(Number.isFinite));assert.ok(Array.from(g.attributes.normal.array).every(Number.isFinite));group.add(new T.Mesh(g));}
   const bounds=new T.Box3().setFromObject(group);assert.ok(bounds.containsPoint(new T.Vector3()),'the firing grip exists at the attachment');
   assert.ok(bounds.min.z<-.9&&bounds.max.z>.1);assert.ok(kit.parts.length<=5);
   signatures.push(geometry.map(g=>Array.from(g.attributes.position.array).join(',')).join('|'));
  }
  assert.equal(new Set(signatures).size,3,`${visual} has three authored shapes`);
 }
});
test('both sword cuts carry the edge sideways through contact without an elbow thrust or pause',()=>{
 const b=buildSoldier('commander',mats,'sword'),a={type:{strike:{kind:'melee'}},swingDur:.85,swingT:0,phase:0};
 for(const side of [-1,1]){
  const tips=[],axes=[];
  for(const p of [.39,.40,.41]){a.swingT=.85*(1-p);a.swingSide=side;poseSoldier(b.skeleton,b.spec,a,freshSoldierState(),0);b.skeleton.compute(new T.Matrix4());const m=b.skeleton.get('weaponR').world;tips.push(new T.Vector3(0,0,-1.44).applyMatrix4(m));axes.push(new T.Vector3(0,0,-1).transformDirection(m));}
  const delta=tips[2].clone().sub(tips[0]);assert.ok(delta.length()>.10,'contact keeps moving');
  assert.ok(Math.abs(delta.x)>Math.abs(delta.z)*3,'edge travel dominates forward tip extension');
  assert.ok(Math.abs(delta.normalize().dot(axes[1]))<.3,'contact velocity is across the blade');
  assert.ok(-axes[1].z>.9,'edge crosses the forward damage sector');
 }
});
