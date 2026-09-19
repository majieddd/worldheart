import * as THREE from 'three';
import {CONFIG} from './config.js';
import {surfacePoint,terrainHeight,orientOnSurface} from './world.js';
import {makeRng} from './run/rng.js';
import {STRUCTURES,structureReward} from './run/structures.js';
import {generateWeapon} from './run/weapons.js';
import {buildStructure} from './structure-models.js';

export class StructureField {
  constructor({game,ui,nav,rig,commander,inventory,loot,crystals,caches,saved,home}){
    Object.assign(this,{game,ui,nav,rig,commander,inventory,loot,crystals,caches,home});this.items=[];this.claimed=new Set(saved?.claimed||[]);this.elapsed=0;this.revision=nav.terrainRevision;
    const rng=makeRng(CONFIG.seed^0x53545255),keys=Object.keys(STRUCTURES),heart=game.world.heart.group.position.clone().normalize(),R=CONFIG.planetRadius;
    const wanted=Math.max(8,Math.min(24,Math.round(R/22))),dir=new THREE.Vector3(),axis=new THREE.Vector3();
    for(let attempt=0;attempt<1600&&this.items.length<wanted;attempt++){
      if(this.items.length<2){axis.set(rng()-.5,rng()-.5,rng()-.5).cross(heart).normalize();dir.copy(heart).applyAxisAngle(axis,(30+rng()*35)/R);}
      else dir.set(rng()-.5,rng()-.5,rng()-.5).normalize();
      const node=nav.nearestWalkableNode(dir);if(node<0||!Number.isFinite(nav.dist[node])||!nav.floorWalk?.[node]||nav.layer?.[node])continue;
      nav.nodeDir(node,dir);const pos=surfacePoint(dir,new THREE.Vector3());
      if(pos.distanceTo(game.world.heart.group.position)<22||this.items.some(s=>s.root.position.distanceTo(pos)<25)||game.world.portals.some(p=>p.group.position.distanceTo(pos)<10))continue;
      const tangent=new THREE.Vector3(0,1,0).cross(dir);if(tangent.lengthSq()<.01)tangent.set(1,0,0).cross(dir);tangent.normalize();
      const cross=dir.clone().cross(tangent),h=terrainHeight(dir.x,dir.y,dir.z);let stable=h>.12;
      for(const v of [tangent,cross])for(const sign of [-1,1]){const d=dir.clone().addScaledVector(v,sign*4/R).normalize();if(Math.abs(terrainHeight(d.x,d.y,d.z)-h)>1.15)stable=false;}
      if(!stable)continue;
      const index=this.items.length,kind=keys[index%keys.length],art=buildStructure(kind),angle=rng()*Math.PI*2;orientOnSurface(art.root,pos);art.root.rotateY(angle);
      const id=`site-${CONFIG.seed}-${index}`,item={...art,id,index,kind,angle,dir:dir.clone(),node};if(this.claimed.has(id))item.lid.rotation.x=-1.45;
      game.scene.add(art.root);game.world.crushDecorNear(pos,4.5);this.items.push(item);
    }
    const button=document.createElement('button');button.className='btn structure-open';button.hidden=true;ui.root.append(button);this.button=button;button.onclick=()=>this.open(this.nearest);
    addEventListener('keydown',e=>{if(e.code==='KeyE'&&!e.repeat&&this.nearest&&!e.target?.matches?.('input,textarea,select,button')&&!document.querySelector('dialog[open]')){e.preventDefault();this.open(this.nearest);}});
  }
  snapshot(){return {claimed:[...this.claimed]};}
  open(site){
    const c=this.commander();if(!site||!this.items.includes(site)||this.claimed.has(site.id)||!c?.active||c.dead||this.game.state!=='playing'||this.game.paused)return false;
    const chest=site.chest.getWorldPosition(new THREE.Vector3()),p=c.dir.clone().multiplyScalar(CONFIG.planetRadius+c.height);
    if(p.distanceTo(chest)>4.5)return false;
    const reward=structureReward(CONFIG.seed,site.index,site.kind);
    this.claimed.add(site.id);site.lid.rotation.x=-1.45;
    if(reward.scraps)this.inventory.awardScrap(reward.scraps);
    if(reward.weapon){const item=generateWeapon({id:site.id+'-weapon',seed:reward.weaponSeed,tier:CONFIG.planetIndex||1,rng:makeRng(reward.weaponSeed),maxRarity:this.home()?'rare':'relic'});if(this.inventory.register(item))this.loot.add(item,site.dir,site.root.position.length()-CONFIG.planetRadius);}
    if(reward.crystals){const id=site.id+'-crystal';this.crystals.register(id);if(!this.crystals.pickup(id)){this.caches.caches.push({id,node:site.node,dir:site.dir.clone(),taken:false,gold:0});this.caches._render();}}
    this.game._hud();
    this.ui.toast(`Supply chest: ${[reward.scraps?reward.scraps+' scraps':'',reward.weapon?'weapon':'',reward.crystals?'crystal':''].filter(Boolean).join(' + ')}`,'info');this.game.audio?.play('pickup');this.button.hidden=true;return true;
  }
  update(dt){
    this.elapsed+=dt;if(this.elapsed<.15)return;this.elapsed=0;this.nearest=null;
    if(this.revision!==this.nav.terrainRevision){for(const site of this.items){orientOnSurface(site.root,surfacePoint(site.dir,new THREE.Vector3()));site.root.rotateY(site.angle);}this.revision=this.nav.terrainRevision;}
    const c=this.commander(),p=c?.dir.clone().multiplyScalar(CONFIG.planetRadius+(c.height||0));
    let nearest=4.5;
    for(const site of this.items){
      site.root.visible=site.root.position.distanceTo(this.rig.camera.position)<Math.max(145,this.rig.camera.position.length()-CONFIG.planetRadius+70);
      if(!c?.active||c.dead||this.claimed.has(site.id))continue;
      const distance=p.distanceTo(site.chest.getWorldPosition(new THREE.Vector3()));if(distance<nearest){this.nearest=site;nearest=distance;}
    }
    this.button.hidden=!this.nearest||this.game.state!=='playing'||this.game.paused||!!document.querySelector('dialog[open]');
    if(this.nearest)this.button.textContent=`E · Open ${STRUCTURES[this.nearest.kind].name} chest`;
  }
}
