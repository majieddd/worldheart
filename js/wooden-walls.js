import * as THREE from 'three';
import {CONFIG} from './config.js';
import {surfacePoint,terrainFootprint,orientOnSurface,raycastTerrain} from './world.js';
import {buildWall} from './structure-models.js';
import {wallIntersects} from './run/structures.js';

export class WoodenWalls {
  constructor({game,ui,nav,rig,possession,inventory,nearBase,saved}){
    Object.assign(this,{game,ui,nav,rig,possession,inventory,nearBase});this.items=[];this.stock=saved?.stock||0;this.sequence=saved?.sequence||0;this.placing=false;
    this.pointer=new THREE.Vector2();this.ray=new THREE.Raycaster();this.point=new THREE.Vector3();this.dir=new THREE.Vector3();
    this.ghost=buildWall();this.ghost.traverse(m=>{if(m.isMesh){m.material=new THREE.MeshBasicMaterial({color:0x8bdfae,transparent:true,opacity:.4,depthWrite:false});}});this.ghost.visible=false;game.scene.add(this.ghost);
    const control=document.createElement('div');control.id='wall-tools';control.innerHTML='<button class="btn" data-wall-buy>5 walls / 1 scrap</button><button class="btn" data-wall-build>Place wall</button><button class="btn" data-wall-turn hidden>Rotate</button><button class="btn" data-wall-confirm hidden>Place here</button><button class="btn" data-wall-cancel hidden>Cancel</button>';ui.root.append(control);this.control=control;
    control.querySelector('[data-wall-buy]').onclick=()=>this.buy();control.querySelector('[data-wall-build]').onclick=()=>this.start();control.querySelector('[data-wall-turn]').onclick=()=>{this.turn=(this.turn||0)+Math.PI/4;};control.querySelector('[data-wall-cancel]').onclick=()=>this.cancel();control.querySelector('[data-wall-confirm]').onclick=()=>this.ghost.visible&&this.place(this.dir,this.angle);
    rig.canvas.addEventListener('pointermove',e=>this.pointer.set(e.clientX,e.clientY));
    rig.canvas.addEventListener('pointerdown',e=>{if(!this.placing)return;e.preventDefault();e.stopImmediatePropagation();if(e.button===2)this.cancel();else if(e.button===0&&this.ghost.visible)this.place(this.dir,this.angle);},true);
    addEventListener('keydown',e=>{if(!this.placing||e.repeat)return;if(e.code==='KeyR'){e.preventDefault();this.turn=(this.turn||0)+Math.PI/4;}if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.cancel();}},true);
    for(const data of saved?.items||[])this.add(new THREE.Vector3(...data.dir),data.angle,data.hp,data.id);
    if(this.items.length)this.rebuild();else this.revision=nav.terrainRevision;
    game.enemies.wallStep=(e,next,dt)=>this.stopEnemy(e,next,dt);
  }
  snapshot(){return {stock:this.stock,sequence:this.sequence,items:this.items.map(w=>({id:w.id,dir:w.dir.toArray(),angle:w.angle,hp:w.hp}))};}
  buy(){if(this.game.state!=='playing'||this.game.paused||this.nearBase()>6||this.stock>4995)return false;const ok=this.inventory.spendScrap(1,()=>{this.stock+=5;return true;});if(ok)this.game._hud();this.ui.toast(ok?'Five wooden walls ready. Use Place wall.':'Salvage a weapon for one scrap, then return to base.',ok?'info':'warn');return !!ok;}
  start(){if(!this.stock||this.game.state!=='playing'||this.game.paused)return false;this.game.cancelBuild();this.possession.firing=false;this.placing=true;this.turn=0;document.activeElement?.blur();return true;}
  cancel(){this.placing=false;this.ghost.visible=false;}
  valid(dir){
    if(!dir?.lengthSq()||this.items.length>=1000||this.game.terrainBusy||!this.stock||this.game.state!=='playing'||this.game.paused)return false;
    const {game}=this,p=surfacePoint(dir,new THREE.Vector3());
    if(!terrainFootprint(dir,.6,'bolt').ok||dir.dot(game.frontier.centre)<Math.cos(game.frontier.theta)||p.distanceTo(game.world.heart.group.position)<4)return false;
    if(this.possession.active&&this.possession.allies.worldPos(this.possession.unit,new THREE.Vector3()).distanceTo(p)>14)return false;
    if(game.towerMgr.towers.some(t=>t.pos.distanceTo(p)<2.5)||this.items.some(w=>w.root.position.distanceTo(p)<2.7))return false;
    if(game.world.portals.some(n=>n.established&&!n.destroyed&&n.group.position.distanceTo(p)<4))return false;
    return true;
  }
  add(dir,angle=0,hp=180,id=null){const root=buildWall();orientOnSurface(root,surfacePoint(dir,new THREE.Vector3()));root.rotateY(angle);this.game.scene.add(root);root.updateMatrixWorld(true);const w={id:id||++this.sequence,dir:dir.clone(),angle,hp,root,inverse:root.matrixWorld.clone().invert()};this.items.push(w);return w;}
  place(dir,angle=0){if(!this.valid(dir)){this.ui.toast('Walls need clear ground inside the base, away from towers and nests.','warn');return false;}this.add(dir,angle);this.stock--;this.rebuild();this.game._hud();this.game.audio?.play('build');if(!this.stock)this.cancel();return true;}
  rebuild(){
    const nav=this.nav;nav.wallPenalty=new Float32Array(nav.n);
    for(const wall of this.items){const ids=nav.towerNodes(wall.root.position,2.2);for(const n of ids)nav.wallPenalty[n]=Math.max(nav.wallPenalty[n],90);}
    // Finite cost means a sealed route still leads to a breakable wall; nests
    // never fail the permanent-path test merely because of wooden defenses.
    nav.march=null;nav.recomputeFlow();nav.revision++;this.revision=nav.terrainRevision;
  }
  stopEnemy(e,next,dt){
    if(!this.items.length||e.type.flying||e.dead)return false;
    const start=e.dir.clone().multiplyScalar(CONFIG.planetRadius+e.height),end=next.clone().multiplyScalar(CONFIG.planetRadius+e.height);
    for(const wall of this.items){
      if(start.distanceToSquared(wall.root.position)>25)continue;
      const a=start.clone().applyMatrix4(wall.inverse),b=end.clone().applyMatrix4(wall.inverse);
      if(a.y>2.4||a.y<-.7||!wallIntersects([a.x,a.z],[b.x,b.z],e.type.radius*.7))continue;
      e.wallAttack=(e.wallAttack||0)-dt;
      if(e.wallAttack<=0){e.wallAttack=.85;wall.hp-=Math.max(10,e.type.atk||18)*(this.game.enemies.atkScale||1)*(e.type.boss?2:1);this.game.fx?.buildPuff(wall.root.position);if(wall.hp<=0){this.game.scene.remove(wall.root);wall.root.traverse(m=>{if(m.isMesh)m.geometry.dispose();});this.items.splice(this.items.indexOf(wall),1);this.rebuild();this.game.audio?.play('impact');}}
      return true;
    }
    return false;
  }
  update(){
    this.control.hidden=(!this.stock&&!this.placing)||this.game.state!=='playing'||this.game.paused||!!document.querySelector('dialog[open]');
    this.control.querySelector('[data-wall-build]').textContent=`Place wall (${this.stock})`;
    this.control.querySelector('[data-wall-build]').disabled=!this.stock;
    this.control.querySelector('[data-wall-buy]').hidden=this.nearBase()>6;
    for(const id of ['turn','confirm','cancel'])this.control.querySelector(`[data-wall-${id}]`).hidden=!this.placing;
    if(this.revision!==this.nav.terrainRevision&&this.items.length){for(const w of this.items){orientOnSurface(w.root,surfacePoint(w.dir,new THREE.Vector3()));w.root.rotateY(w.angle);w.root.updateMatrixWorld(true);w.inverse.copy(w.root.matrixWorld).invert();}this.rebuild();}
    if(!this.placing)return;const r=this.rig.canvas.getBoundingClientRect();
    this.rig.raycaster(this.possession.active?r.left+r.width/2:this.pointer.x,this.possession.active?r.top+r.height/2:this.pointer.y,this.ray);
    const hit=raycastTerrain(this.ray.ray.origin,this.ray.ray.direction,this.point);this.ghost.visible=!!hit;
    if(hit){this.dir.copy(this.point).normalize();this.angle=this.turn||0;orientOnSurface(this.ghost,this.point);this.ghost.rotateY(this.angle);const color=this.valid(this.dir)?0x8bdfae:0xff6655;this.ghost.traverse(m=>{if(m.isMesh)m.material.color.setHex(color);});}
  }
}
