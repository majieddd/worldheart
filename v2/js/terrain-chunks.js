import * as THREE from '../lib/three.module.min.js';

// Reuse every authored vertex, normal, colour and lava attribute. Only the
// triangle submission is partitioned: a close camera should not send the
// entire back hemisphere through the vertex shader. At planetary overview
// distance the original single draw remains cheaper than many small draws.
export class TerrainChunks {
  constructor(mesh,radius) {
    this.mesh=mesh;this.radius=radius;this.chunks=[];this.full=true;
    const source=mesh.geometry,p=source.attributes.position,index=source.index;
    this.count=index?index.count:p.count;
    const buckets=new Map(),grid=4,point=new THREE.Vector3(),cell=v=>Math.max(0,Math.min(grid-1,Math.floor((v+1)*grid/2)));
    for(let face=0;face<this.count;face+=3){
      const a=index?index.getX(face):face,b=index?index.getX(face+1):face+1,c=index?index.getX(face+2):face+2;
      const x=p.getX(a)+p.getX(b)+p.getX(c),y=p.getY(a)+p.getY(b)+p.getY(c),z=p.getZ(a)+p.getZ(b)+p.getZ(c);
      const ax=Math.abs(x),ay=Math.abs(y),az=Math.abs(z),axis=ax>=ay&&ax>=az?0:ay>=az?1:2,max=Math.max(ax,ay,az)||1;
      const dominant=axis===0?x:axis===1?y:z,u=axis===0?y:axis===1?z:x,v=axis===0?z:axis===1?x:y;
      const key=(axis*2+(dominant<0?1:0))*grid*grid+cell(u/max)*grid+cell(v/max);
      let list=buckets.get(key);if(!list){list=[];buckets.set(key,list);}list.push(a,b,c);
    }
    for(const ids of buckets.values()){
      const geometry=new THREE.BufferGeometry();
      for(const [key,attribute]of Object.entries(source.attributes))geometry.setAttribute(key,attribute);
      geometry.setIndex(ids);
      const box=new THREE.Box3();for(const i of ids)box.expandByPoint(point.fromBufferAttribute(p,i));
      geometry.boundingBox=box;geometry.boundingSphere=box.getBoundingSphere(new THREE.Sphere());
      const chunk=new THREE.Mesh(geometry,mesh.material);chunk.name='terrain-sector';chunk.receiveShadow=mesh.receiveShadow;chunk.castShadow=mesh.castShadow;chunk.visible=false;
      chunk.matrixAutoUpdate=false;chunk.updateMatrix();mesh.add(chunk);this.chunks.push(chunk);
    }
  }
  update(cameraPosition) {
    const full=!!this.forceFull||cameraPosition.length()>this.radius*1.9;
    if(full===this.full)return;this.full=full;
    this.mesh.geometry.setDrawRange(0,full?this.count:0);
    for(const chunk of this.chunks)chunk.visible=!full;
  }
  expandBounds(amount) {
    // Fault deformation changes the shared positions in bounded batches.
    // Expand before the first batch so partially changed slopes never vanish.
    for(const chunk of this.chunks)chunk.geometry.boundingSphere.radius+=Math.abs(amount);
  }
}

// Decor retains its original instance ids and matrices for crushing and
// collision queries. Sector copies submit the same models, colours and sway
// materials only where the camera or shadow frustum can see them.
export class DecorChunks {
  constructor(mesh,radius) {
    this.mesh=mesh;this.radius=radius;this.group=new THREE.Group();this.chunks=[];this.full=true;
    this.compact=new THREE.InstancedMesh(mesh.geometry,mesh.material,Math.max(1,mesh.count));
    this.compact.castShadow=mesh.castShadow;this.compact.receiveShadow=mesh.receiveShadow;this.compact.customDepthMaterial=mesh.customDepthMaterial;
    this.compact.frustumCulled=false;this.compact.name='visible-decor';this.compact.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.group.add(this.compact);
    if(mesh.instanceColor)this.compact.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(mesh.count*3),3).setUsage(THREE.DynamicDrawUsage);
    const buckets=new Map(),matrix=new THREE.Matrix4(),position=new THREE.Vector3();
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix).normalize();
      const cell=v=>Math.max(0,Math.min(15,Math.floor((v+1)*8))),key=cell(position.x)*256+cell(position.y)*16+cell(position.z);
      let ids=buckets.get(key);if(!ids){ids=[];buckets.set(key,ids);}ids.push(i);
    }
    for(const ids of buckets.values())this.chunks.push({ids,bounds:new THREE.Sphere(),visible:false});
    this.group.visible=false;this.selectedIds=[];this.sync();
  }
  update(cameraPosition,frustum=this.frustum,shadow=this.shadow) {
    this.frustum=frustum;this.shadow=shadow;
    const full=!!this.forceFull||cameraPosition.length()>this.radius*1.9;
    if(full!==this.full){this.full=full;this.mesh.visible=full;this.group.visible=!full;this.dirty=true;}
    this.sync();
  }
  sync() {
    const source=this.mesh,dirty=this.matrixVersion!==source.instanceMatrix.version||this.colorVersion!==source.instanceColor?.version;
    if(dirty){
      const matrix=new THREE.Matrix4(),sphere=new THREE.Sphere();if(!source.geometry.boundingSphere)source.geometry.computeBoundingSphere();
      for(const chunk of this.chunks){chunk.bounds.makeEmpty();for(const id of chunk.ids){source.getMatrixAt(id,matrix);sphere.copy(source.geometry.boundingSphere).applyMatrix4(matrix);sphere.radius+=matrix.getMaxScaleOnAxis()*2;chunk.bounds.union(sphere);}}
      this.matrixVersion=source.instanceMatrix.version;this.colorVersion=source.instanceColor?.version;
    }
    if(this.full)return;
    let changed=dirty||this.dirty;this.dirty=false;
    for(const chunk of this.chunks){const visible=!this.frustum||this.frustum.intersectsSphere(chunk.bounds)||!!this.shadow?.intersectsSphere(chunk.bounds);if(visible!==chunk.visible){chunk.visible=visible;changed=true;}}
    if(!changed)return;
    const target=this.compact;let count=0;this.selectedIds.length=0;
    for(const chunk of this.chunks)if(chunk.visible)for(const id of chunk.ids){
      target.instanceMatrix.array.set(source.instanceMatrix.array.subarray(id*16,id*16+16),count*16);
      if(source.instanceColor)target.instanceColor.array.set(source.instanceColor.array.subarray(id*3,id*3+3),count*3);
      this.selectedIds.push(id);count++;
    }
    target.count=count;
    if(count){target.instanceMatrix.clearUpdateRanges();target.instanceMatrix.addUpdateRange(0,count*16);target.instanceMatrix.needsUpdate=true;
      if(target.instanceColor){target.instanceColor.clearUpdateRanges();target.instanceColor.addUpdateRange(0,count*3);target.instanceColor.needsUpdate=true;}}
  }
}
