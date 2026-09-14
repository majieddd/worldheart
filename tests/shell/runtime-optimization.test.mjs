import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
globalThis.location={search:'?map=ninetynine&campaign=0',pathname:'/'};globalThis.matchMedia=()=>({matches:false});
registerHooks({resolve(s,c,n){return s==='three'?{url:new URL('../../lib/three.module.min.js',import.meta.url).href,shortCircuit:true}:n(s,c);}});
const T=await import('../../lib/three.module.min.js'),{NavGraph}=await import('../../js/nav.js'),{TerrainChunks,DecorChunks}=await import('../../js/terrain-chunks.js'),{buildActiveFeature}=await import('../../js/terrain/active-features.js'),{ACTIVE_FEATURES}=await import('../../js/run/environment-catalogue.js');
function graph(){
 const n=new NavGraph();n.n=5;n.revision=1;n.walk=new Uint8Array(5).fill(1);n.block=new Int32Array(5);n.dirs=new Float32Array(15);n.dist=new Float32Array(5);n.next=new Int32Array(5);
 n.adjOff=new Int32Array([0,1,3,5,7,8]);n.adj=new Int32Array([1,0,2,1,3,2,4,3]);
 n.cost=new Float32Array([1,1,2,2,Infinity,Infinity,3,3]);n.nearestWalkableNode=d=>d.x;n._routeHeuristicScale=0;
 return n;
}
const dir=i=>({x:i});
test('sparse point search retains directed routes and rejects finite-edge disconnected terrain',()=>{
 const n=graph();assert.deepEqual([...n.findPath(dir(0),dir(2))],[0,1,2]);assert.equal(n.findPath(dir(0),dir(2)).cost,3);
 let searches=0;const original=n._dijkstra;n._dijkstra=function(...args){searches++;return original.apply(this,args);};
 assert.deepEqual(n.findPath(dir(0),dir(4)),[]);assert.equal(searches,0,'finite-edge regions reject a whole-planet failed search');
 // A one-way crossing may be used in only its legal direction. Weak region
 // rejection must not turn a valid one-way route into a false negative.
 n.cost[5]=4;n.revision++;
 assert.deepEqual([...n.findPath(dir(0),dir(4))],[0,1,2,3,4]);assert.deepEqual(n.findPath(dir(4),dir(0)),[]);
 n.cost[4]=4;n.revision++;assert.deepEqual([...n.findPath(dir(4),dir(0))],[4,3,2,1,0]);
});
test('route copies, tower changes and generation wrap cannot leak stale paths',()=>{
 const n=graph(),p=n.findPath(dir(0),dir(2));p.pop();assert.equal(n.findPath(dir(0),dir(2)).length,3);
 n.block[1]=42;n.revision++;assert.deepEqual(n.findPath(dir(0),dir(2)),[]);
 n.block[1]=0;n.revision++;n._route.generation=0xffffffff;
 assert.equal(n.findPath(dir(0),dir(2)).cost,3);assert.equal(n._route.generation,1);
 const saved=n.dist.slice();n.findPath(dir(1),dir(0));assert.deepEqual(n.dist,saved,'point routes do not mutate the heart flow');
});
test('terrain sectors preserve all triangle indices and shared visual attributes',()=>{
 const geometry=new T.IcosahedronGeometry(100,3),mesh=new T.Mesh(geometry,new T.MeshBasicMaterial());mesh.receiveShadow=true;
 const chunks=new TerrainChunks(mesh,100),indices=chunks.chunks.flatMap(c=>Array.from(c.geometry.index.array)).sort((a,b)=>a-b);
 assert.equal(indices.length,geometry.attributes.position.count);indices.forEach((v,i)=>assert.equal(v,i));
 for(const c of chunks.chunks){assert.equal(c.geometry.attributes.position,geometry.attributes.position);assert.equal(c.geometry.attributes.normal,geometry.attributes.normal);assert.equal(c.material,mesh.material);assert.ok(c.receiveShadow);}
 chunks.update(new T.Vector3(0,0,120));assert.equal(geometry.drawRange.count,0);assert.ok(chunks.chunks.every(c=>c.visible));
 const before=chunks.chunks[0].geometry.boundingSphere.radius;chunks.expandBounds(14);assert.equal(chunks.chunks[0].geometry.boundingSphere.radius,before+14);
 chunks.update(new T.Vector3(0,0,240));assert.equal(geometry.drawRange.count,geometry.attributes.position.count);assert.ok(chunks.chunks.every(c=>!c.visible));
});
test('active feature culling bounds contain every animated particle phase',()=>{
 const matrix=new T.Matrix4(),sphere=new T.Sphere();
 for(const key of Object.keys(ACTIVE_FEATURES)){
  const root=buildActiveFeature(key),particles=root.children.find(c=>c.isInstancedMesh);particles.geometry.computeBoundingSphere();
  for(let t=0;t<30;t+=.37){root.userData.update(t);if(!particles.visible)continue;for(let i=0;i<particles.count;i++){particles.getMatrixAt(i,matrix);sphere.copy(particles.geometry.boundingSphere).applyMatrix4(matrix);assert.ok(sphere.center.distanceTo(particles.boundingSphere.center)+sphere.radius<=particles.boundingSphere.radius,key);}}
 }
});
test('decor sectors retain ids, colour, sway depth material and same-frame crushing',()=>{
 const source=new T.InstancedMesh(new T.BoxGeometry(1,2,1),new T.MeshStandardMaterial(),3),matrix=new T.Matrix4(),read=new T.Matrix4(),color=new T.Color();
 source.customDepthMaterial=new T.MeshDepthMaterial();source.castShadow=source.receiveShadow=true;
 for(let i=0;i<3;i++){source.setMatrixAt(i,matrix.makeTranslation(i*100,100,0));source.setColorAt(i,color.setRGB(i*.2,.3,.4));}source.instanceMatrix.needsUpdate=source.instanceColor.needsUpdate=true;
 const sectors=new DecorChunks(source,100);sectors.update(new T.Vector3(0,0,120));assert.equal(source.count,3);assert.equal(source.visible,false);
 assert.equal(sectors.compact.customDepthMaterial,source.customDepthMaterial);
 sectors.selectedIds.forEach((id,j)=>{source.getMatrixAt(id,matrix);sectors.compact.getMatrixAt(j,read);assert.deepEqual(read.elements,matrix.elements);const a=new T.Color(),b=new T.Color();source.getColorAt(id,a);sectors.compact.getColorAt(j,b);assert.deepEqual(a,b);});
 source.setMatrixAt(1,matrix.makeScale(.0001,.0001,.0001));source.instanceMatrix.needsUpdate=true;sectors.sync();
 sectors.compact.getMatrixAt(sectors.selectedIds.indexOf(1),read);assert.ok(read.determinant()<1e-10);
 sectors.update(new T.Vector3(0,0,240));assert.equal(source.visible,true);assert.equal(sectors.group.visible,false);
});
