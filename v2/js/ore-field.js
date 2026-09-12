import * as THREE from 'three';
import { R, surfaceElevation } from './world.js';
export class OreField {
  constructor({scene,nav,centre,ledger,commander,allies,ui,rng}){
    Object.assign(this,{nav,centre,ledger,commander,allies,ui});this.entries=[];this.sequence=0;this.time=0;
    this.tmp=new THREE.Vector3();this.transform=new THREE.Object3D();
    this.mesh=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.55),new THREE.MeshStandardMaterial({color:0xffcc66,emissive:0xa46a20,emissiveIntensity:.7,roughness:.4,flatShading:true}),128);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;scene.add(this.mesh);
    const candidates=[];
    for(let i=0;i<nav.n;i+=5){if(!nav.floorWalk[i]||nav.waterDepth[i]>0||nav.block[i]||!Number.isFinite(nav.dist[i]))continue;
      nav.nodeDir(i,this.tmp);const arc=Math.acos(Math.max(-1,Math.min(1,this.tmp.dot(centre))))*R;if(arc>=14&&arc<=75)candidates.push(i);}
    for(let k=0;k<24&&candidates.length;k++){const node=candidates[Math.floor(rng()*candidates.length)];nav.nodeDir(node,this.tmp);
      if(this.entries.some(e=>e.dir.distanceToSquared(this.tmp)<(5/R)**2))continue;this.add(this.tmp,1);}
    this.render();
  }
  add(dir,amount=1){const free=this.entries.findIndex(e=>e.taken);if(free<0&&this.entries.length>=128)return false;const entry={id:`relic-${++this.sequence}`,dir:dir.clone().normalize(),amount,taken:false};if(free>=0)this.entries[free]=entry;else this.entries.push(entry);return true;}
  update(dt){
    this.time+=dt;const a=this.commander();
    if(dt>0&&a?.active&&!a.dead){const pos=this.allies.worldPos(a,this.tmp);
      for(const entry of this.entries)if(!entry.taken){this.transform.position.copy(entry.dir).multiplyScalar(R+surfaceElevation(entry.dir)+.8);
        if(pos.distanceTo(this.transform.position)>2.8)continue;
        if(this.ledger.collect(entry.id,entry.amount)){entry.taken=true;this.ui.audio?.play('coin');this.ui.toast(`Relic ore +${entry.amount}. ${this.ledger.ore} carried. Forge towers at the heart.`, 'info');}}}
    this.render();
  }
  render(){let count=0;for(const entry of this.entries)if(!entry.taken){this.transform.position.copy(entry.dir).multiplyScalar(R+surfaceElevation(entry.dir)+.85+Math.sin(this.time*2+count)*.12);this.transform.rotation.set(this.time*.4,count,0);this.transform.scale.setScalar(entry.amount>1?1.3:1);this.transform.updateMatrix();this.mesh.setMatrixAt(count++,this.transform.matrix);}this.mesh.count=count;this.mesh.instanceMatrix.needsUpdate=true;}
}
