import * as THREE from 'three';
import { R, terrainHeight, slopeAt, surfacePoint, waterDepthAt } from './world.js';
import { nestSite, availableNestSites } from './nest-sites.js';
import { createTerrainAtlas } from './terrain/atlas.js';
import { dottedPathMaterial, advanceDots } from './dotted-path.js';

const yieldTask=()=>new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=()=>{c.port1.close();c.port2.close();resolve();};c.port2.postMessage(0);});
const geometry=(points,distances)=>{
  const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  if(distances)g.setAttribute('routeDistance',new THREE.Float32BufferAttribute(distances,1));return g;
};

export class NestAtlasView {
  constructor(scene,nav,{renderer=null,camera=null}={}){
    this.group=new THREE.Group();this.group.name='Nest habitat atlas';scene.add(this.group);
    this.material=dottedPathMaterial();this.globalMaterial=dottedPathMaterial(0xb6c8da,4);
    this.routeCount=0;this.nav=nav;
    this.renderer=renderer;this.camera=camera;this.scene=scene;
    this.routesReady=this.buildApproaches();
  }
  async buildApproaches(){
    const nav=this.nav;
    const used=new Set(),points=[],distances=[],p=new THREE.Vector3(),q=new THREE.Vector3();
    let yielded=performance.now();
    for(let k=0;k<17;k++){
      let node=nestSite(nav,nav.portalNodes[k%nav.portalNodes.length],nav.fieldCenter,.5,used,p);
      if(node<0)continue;used.add(node);let count=0;
      while(node!==nav.heartNode&&count++<nav.n){
        const next=nav.march.next[node];if(next<0||next===node)break;
        for(const i of [node,next]){nav.nodeDir(i,p);surfacePoint(p,q).addScaledVector(p,.35);points.push(q.x,q.y,q.z);distances.push(nav.march.dist[i]);}
        node=next;
        if(count%32===0&&performance.now()-yielded>=5){await yieldTask();yielded=performance.now();}
      }
      if(node===nav.heartNode)this.routeCount++;
      await yieldTask();yielded=performance.now();
    }
    await this.reveal(new THREE.LineSegments(geometry(points,distances),this.material));
  }
  async reveal(lines){
    if(this.renderer&&this.camera){
      // First use of the dotted shader can stall for a full second. Compile
      // outside the visible scene and wait for the driver's parallel job.
      // The game's HDR pass uses linear output; restore renderer state before
      // awaiting so ordinary frames can continue during compilation.
      const stage=new THREE.Scene();stage.add(lines);
      const prior=this.renderer.outputColorSpace;let ready;
      try{this.renderer.outputColorSpace=THREE.LinearSRGBColorSpace;ready=this.renderer.compileAsync(stage,this.camera,this.scene);}
      finally{this.renderer.outputColorSpace=prior;}
      await ready;
    }
    this.group.add(lines);
  }
  update(dt){if(this.group.visible){advanceDots(this.material,dt);advanceDots(this.globalMaterial,dt);}}
  async build(){
    await this.routesReady;
    const nav=this.nav,p=new THREE.Vector3(),q=new THREE.Vector3(),exact=[],exactDistances=[];
    let yielded=performance.now();
    const cooperate=async()=>{if(performance.now()-yielded>=5){await yieldTask();yielded=performance.now();}};
    this.exactNodes=[];
    for(const i of availableNestSites(nav,nav.fieldCenter,p)){
      this.exactNodes.push(i);
      if(this.exactNodes.length%32===0)await cooperate();
    }
    const legal=new Uint8Array(nav.n),border=new Uint8Array(nav.n);
    for(const i of this.exactNodes)legal[i]=1;
    for(const i of this.exactNodes){for(let e=nav.adjOff[i];e<nav.adjOff[i+1];e++)if(!legal[nav.adj[e]]){border[i]=1;break;}if(i%32===0)await cooperate();}
    for(const i of this.exactNodes){if(border[i])for(let e=nav.adjOff[i];e<nav.adjOff[i+1];e++){
      const j=nav.adj[e];if(!border[j]||j<=i)continue;
      for(const k of [i,j]){nav.nodeDir(k,p);surfacePoint(p,q).addScaledVector(p,.4);exact.push(q.x,q.y,q.z);exactDistances.push(nav.march.dist[k]);}
    }if(i%32===0)await cooperate();}
    await this.reveal(new THREE.LineSegments(geometry(exact,exactDistances),this.material));await yieldTask();
    const started=performance.now();
    this.atlas=await createTerrainAtlas({radius:R,heart:nav.nodeDir(nav.heartNode,p).toArray(),
      waterAt:(x,y,z,h)=>waterDepthAt(p.set(x,y,z),h),heightAt:(x,y,z)=>terrainHeight(x,y,z,false),slopeAt:(x,y,z)=>slopeAt(p.set(x,y,z)),pause:yieldTask});
    const {atlas}=this,points=[],distances=[];
    const sample=(dir,d)=>{p.set(...dir);surfacePoint(p,q).addScaledVector(p,.45);points.push(q.x,q.y,q.z);distances.push(d);};
    for(let i=0;i<atlas.verts.length;i++){
      if(atlas.routes[i]){
        const j=atlas.next[i],a=atlas.verts[i],b=atlas.verts[j],length=atlas.distance[i]-atlas.distance[j];
        const steps=Math.max(1,Math.ceil(length/1.2));
        for(let k=0;k<steps;k++)for(const t of [k/steps,(k+1)/steps]){
          const dir=a.map((v,axis)=>v+(b[axis]-v)*t),l=Math.hypot(...dir);sample(dir.map(v=>v/l),atlas.distance[i]-length*t);
        }
      }
      if(i%32===31)await cooperate();
    }
    let contours=0;
    for(const pair of atlas.contours){
      for(const [a,b] of pair){
        const dir=atlas.verts[a].map((v,k)=>v+atlas.verts[b][k]),l=Math.hypot(...dir);
        const d=Number.isFinite(atlas.distance[a])?atlas.distance[a]:Number.isFinite(atlas.distance[b])?atlas.distance[b]:a*.4;
        sample(dir.map(v=>v/l),d);
      }
      // Coast-rich planets can have thousands of contour segments. They
      // need the same cooperative budget as the preceding route samples.
      if(++contours%16===0)await cooperate();
    }
    if(atlas.root>=0){sample(atlas.verts[atlas.root],atlas.distance[atlas.root]);sample(nav.nodeDir(nav.heartNode,p).toArray(),0);}
    await this.reveal(new THREE.LineSegments(geometry(points,distances),this.globalMaterial));
    this.stats={...atlas.stats,exact:this.exactNodes.length,buildMs:performance.now()-started,vertices:points.length/3};
    return this.stats;
  }
}
