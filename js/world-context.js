import * as THREE from 'three';
import {PALETTE} from './config.js';
import {raycastTerrain} from './world.js';

// One owner for world inspection. Merely looking never changes the loadout
// or steals the mouse; F lends the pointer to the visible contextual panel.
export class WorldContext {
  constructor({game,ui,rig,possession,mode}) {
    Object.assign(this,{game,ui,rig,possession,mode});game.context=this;
    this.ray=new THREE.Raycaster();this.pointer={x:-1000,y:-1000};
    this.towerPanel=ui.el['tower-panel'];this.towerPanel.classList.add('world-context');
    this.hint=document.createElement('div');this.hint.className='context-hint';this.towerPanel.append(this.hint);
    this.lootPanel=document.createElement('div');this.lootPanel.id='loot-inspect';this.lootPanel.className='panel raised world-context';
    this.lootPanel.hidden=true;ui.root.append(this.lootPanel);
    this.lootPanel.innerHTML='<div class="t-name" id="loot-name"></div><div id="loot-preview"></div><div id="loot-stats"></div><p id="loot-compatibility"></p><div class="t-actions"><button class="btn primary" id="loot-pickup">Pick up</button><button class="btn" id="loot-equip">Pick up + equip</button><button class="btn ghost" id="loot-close">Close</button></div><div class="context-hint" id="loot-hint"></div>';
    this.markers=new Map();
    rig.canvas.addEventListener('pointermove',e=>{this.pointer.x=e.clientX;this.pointer.y=e.clientY;});
    this.lootPanel.querySelector('#loot-pickup').onclick=()=>this.pickup(false);
    this.lootPanel.querySelector('#loot-equip').onclick=()=>this.pickup(true);
    this.lootPanel.querySelector('#loot-close').onclick=()=>this.close();
    ui.el['tp-close'].onclick=()=>this.close();
    addEventListener('keydown',e=>{
      if(e.repeat||e.target?.matches?.('input,textarea,select,[contenteditable="true"]'))return;
      if(e.code==='Escape'&&this.editing){e.preventDefault();e.stopImmediatePropagation();this.close();return;}
      if(e.code==='KeyF'&&possession.active&&this.target&&!document.querySelector('dialog[open],#end-overlay.show')) {
        e.preventDefault();e.stopImmediatePropagation();this.editing?this.close():this.open();
      }
    },true);
  }
  validTower(t) {
    if(!t||!this.game.towerMgr.towers.includes(t)||this.game.state!=='playing'||document.querySelector('dialog[open],#end-overlay.show'))return false;
    const p=this.possession;
    return !p.active||(p.unit?.active&&!p.unit.dead&&p.allies.worldPos(p.unit,_pos).distanceTo(t.pos)<=14);
  }
  open() {
    if(!this.target)return;
    this.editing=true;this.wasSuspended=this.possession.suspended;
    this.possession.suspend(true);
    this.update();
    this.panel().querySelector('button:not([disabled])')?.focus();
  }
  close() {
    const wasEditing=this.editing;this.editing=false;
    this.dismissed=this.target?.object;this.target=null;this.game.contextTower=null;
    this.game.select(null);this.lootPanel.hidden=true;
    if(wasEditing&&!this.wasSuspended&&!document.querySelector('dialog[open]'))this.possession.suspend(false);
  }
  panel(){return this.target?.kind==='loot'?this.lootPanel:this.towerPanel;}
  pickup(equip) {
    const t=this.target,api=this.mode?.weapons;
    if(t?.kind!=='loot'||!api?.nearby().some(x=>x.id===t.object.item.id))return;
    const item=t.object.item;
    if(equip&&!this.mode.weaponPanel.rules.compatible(item.family))return;
    if(!api.pickup(item.id)){this.mode.weaponPanel.open();this.close();return;}
    if(equip)api.request({kind:'equip',id:item.id,slot:typeof api.inventory.active==='number'?api.inventory.active:0});
    this.close();
  }
  _pick(ray) {
    let best=null,distance=Infinity;
    const groundHit=raycastTerrain(ray.origin,ray.direction,_hit);
    const groundDistance=groundHit?ray.origin.distanceTo(_hit):Infinity;
    const consider=(kind,object,position,radius)=>{
      const along=_delta.copy(position).sub(ray.origin).dot(ray.direction);
      if(along<=0||along>groundDistance+radius||along>=distance||ray.distanceSqToPoint(position)>radius*radius)return;
      best={kind,object};distance=along;
    };
    for(const t of this.game.towerMgr.towers) {
      _pos.copy(t.pos).addScaledVector(_up.copy(t.pos).normalize(),1.1);consider('tower',t,_pos,1.35);
    }
    if(this.mode)for(const e of this.mode.loot.entries.values()) {
      _pos.copy(e.position).addScaledVector(_up.copy(e.position).normalize(),.8);consider('loot',e,_pos,.9);
    }
    return best;
  }
  update() {
    const {game,possession:p,ui}=this;
    const blocked=game.state!=='playing'||game.buildType||document.querySelector('dialog[open],#end-overlay.show');
    if(blocked){if(this.editing)this.close();this.target=null;}
    else if(!this.editing&&(!this.target||p.active||!this.panel().matches(':hover'))) {
      const r=this.rig.canvas.getBoundingClientRect();
      this.rig.raycaster(p.active?r.left+r.width/2:this.pointer.x,p.active?r.top+r.height/2:this.pointer.y,this.ray);
      let next=this._pick(this.ray.ray);
      if(!next&&!p.active&&game.selectedTower)next={kind:'tower',object:game.selectedTower};
      if(next?.object!==this.dismissed)this.dismissed=null;
      this.target=next?.object===this.dismissed?null:next;
    }
    if(this.target?.kind==='tower'&&!game.towerMgr.towers.includes(this.target.object))this.close();
    if(this.target?.kind==='loot'&&!this.mode.loot.entries.has(this.target.object.item.id))this.close();
    const tower=this.target?.kind==='tower'?this.target.object:null;
    const stamp=tower?`${tower.id}:${tower.tier}:${game.gold}:${this.validTower(tower)}`:'';
    if(game.contextTower!==tower||this.towerStamp!==stamp){game.contextTower=tower;this.towerStamp=stamp;ui.refresh();}
    this.towerPanel.classList.remove('board-off');
    this.towerPanel.classList.toggle('show',!!tower);
    this.lootPanel.hidden=this.target?.kind!=='loot';
    if(this.target){
      if(tower){
        const valid=this.validTower(tower);
        ui.el['tp-sell'].disabled=!valid;
        if(!valid)ui.el['tp-upgrade'].disabled=true;
        this.hint.textContent=p.active?(!valid?'Move within 14m to manage':this.editing?'Click Upgrade or Sell. F / Escape resumes.':'F: manage tower'):'Click Upgrade or Sell';
      }else this.renderLoot();
      this.place(this.panel(),tower?tower.pos:this.target.object.position);
    }
    this.updateMarkers();
  }
  place(panel,position) {
    _screen.copy(position).addScaledVector(_up.copy(position).normalize(),2.2).project(this.rig.camera);
    const r=this.rig.canvas.getBoundingClientRect(),w=panel.offsetWidth,h=panel.offsetHeight;
    const sx=r.left+(_screen.x+1)*r.width/2,sy=r.top+(1-_screen.y)*r.height/2;
    const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
    const top=140,bottom=innerHeight-92;
    const candidates=[[sx-w/2,sy-h-16],[sx+24,sy-h/2],[sx-w-24,sy-h/2],[sx-w/2,sy+20]];
    const obstacles=[...document.querySelectorAll('.campaign-save,.campaign-badge')].filter(el=>!el.hidden).map(el=>el.getBoundingClientRect());
    let chosen=null,score=Infinity;
    for(const pair of candidates){
      const x=clamp(pair[0],8,innerWidth-w-8),y=clamp(pair[1],top,Math.max(top,bottom-h));
      let overlap=0;for(const o of obstacles)overlap+=Math.max(0,Math.min(x+w,o.right)-Math.max(x,o.left))*Math.max(0,Math.min(y+h,o.bottom)-Math.max(y,o.top));
      const cost=overlap*1000+Math.abs(x-pair[0])+Math.abs(y-pair[1]);if(cost<score){score=cost;chosen=[x,y];}
    }
    panel.style.transform=`translate(${Math.round(chosen[0])}px,${Math.round(chosen[1])}px)`;
    panel.style.visibility=_screen.z>1||_screen.z< -1?'hidden':'';
    panel.classList.toggle('context-editing',!!this.editing);
  }
  renderLoot() {
    const {item}=this.target.object,{rules}=this.mode.weaponPanel,api=this.mode.weapons;
    const stats=rules.inspectStats(item),current=api.inventory.current,baseline=current?rules.stats(current):this.possession.allies.active.find(a=>a.type.commander)?.type.strike;
    const put=(id,value)=>this.lootPanel.querySelector(id).textContent=value;
    put('#loot-name',`${rules.name(item)} · ${item.rarity} · tier ${item.tier}`);
    const diff=(key)=>{const n=(stats[key]||0)-(baseline?.[key]||0);return `${n>=0?'+':''}${Math.round(n*10)/10}`;};
    const rangeKey=stats.radius?'radius':'range',sameReach=stats.kind===baseline?.kind&&baseline?.[rangeKey]>0;
    const reachCompare=sameReach?` (${diff(rangeKey)}m)`:baseline?.radius||baseline?.range?` · Current ${baseline.kind} reach ${(baseline.radius||baseline.range).toFixed(1)}m`:'';
    const distance=stats.kind==='lob'?`Blast ${stats.aoe.toFixed(1)}m · Fuse ${stats.fuse}s · Speed ${stats.speed}m/s`:`Reach ${(stats.radius||stats.range).toFixed(1)}m${reachCompare}`;
    put('#loot-stats',`Damage ${Math.round(stats.dmg||stats.dps||0)} (${diff(stats.dmg?'dmg':'dps')}) · ${stats.cd.toFixed(2)}s cadence (${diff('cd')}s) · ${distance}`);
    const usable=rules.compatible(item.family),near=api.nearby().some(x=>x.id===item.id);
    put('#loot-compatibility',`${usable?'Compatible':'Incompatible: item stats without commander bonuses'} · ${item.parts.head} / ${item.parts.grip} / ${item.parts.core}. Compared with ${current?rules.name(current):'current commander attack'}.`);
    const full=api.inventory.items.length-api.inventory.slots.filter(Boolean).length>=12;
    this.lootPanel.querySelector('#loot-pickup').disabled=!near||!api.canInteract();
    this.lootPanel.querySelector('#loot-equip').disabled=!near||!usable||!api.canInteract()||full;
    put('#loot-hint',!near?'Move within 2.8m to pick up':full?'Backpack full. Pick up opens replacement choices.':this.possession.active&&!this.editing?'F: inspect / release pointer':'Choose pickup or equip. Escape resumes.');
    if(this.previewId!==item.id){this.previewId=item.id;this.preview(item);}
  }
  preview(item) {
    if(!this.previewRenderer){
      this.previewRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true});this.previewRenderer.setSize(260,100);
      this.lootPanel.querySelector('#loot-preview').append(this.previewRenderer.domElement);
      this.previewScene=new THREE.Scene();this.previewScene.add(new THREE.HemisphereLight(PALETTE.sunlight,PALETTE.techBody,3));
      this.previewCamera=new THREE.OrthographicCamera(-2,2,1,-1,.01,20);this.previewCamera.position.set(0,0,5);this.previewCamera.lookAt(0,0,0);
    }
    if(this.previewObject)this.previewScene.remove(this.previewObject);
    this.previewObject=this.mode.weapons.previewModel(item);this.previewScene.add(this.previewObject);
    this.previewObject.rotation.set(0,-Math.PI/2,-.25);
    const box=new THREE.Box3().setFromObject(this.previewObject),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
    this.previewObject.position.sub(centre);
    const half=Math.max(size.y,size.x/2.6)*.65;
    this.previewCamera.left=-half*2.6;this.previewCamera.right=half*2.6;this.previewCamera.top=half;this.previewCamera.bottom=-half;this.previewCamera.updateProjectionMatrix();
    this.previewRenderer.render(this.previewScene,this.previewCamera);
  }
  updateMarkers() {
    if(!this.mode)return;
    const placed=[];
    for(const p of this.game.world.portals){
      if(!this.markers.has(p)){const el=document.createElement('div');el.className='nest-marker';this.ui.root.append(el);this.markers.set(p,el);}
      const el=this.markers.get(p);el.hidden=!p.established||p.destroyed||this.game.state!=='playing';if(el.hidden)continue;
      _screen.copy(p.group.position).addScaledVector(_up.copy(p.group.position).normalize(),3.4).project(this.rig.camera);
      el.hidden=_screen.z>1||_screen.z< -1;if(el.hidden)continue;
      el.textContent=p.guardianPending?'Guardian emerging':`Nest · ${Math.ceil(p.hp)} HP`;
      const x=Math.round(Math.max(8,Math.min(innerWidth-150,(_screen.x+1)*innerWidth/2)));
      let y=Math.round(Math.max(132,Math.min(innerHeight-235,(1-_screen.y)*innerHeight/2)));
      for(const other of placed)if(Math.abs(x-other.x)<150&&Math.abs(y-other.y)<24)y=other.y+24;
      placed.push({x,y});el.style.transform=`translate(${x}px,${y}px)`;
    }
  }
}
const _pos=new THREE.Vector3(),_up=new THREE.Vector3(),_hit=new THREE.Vector3(),_delta=new THREE.Vector3(),_screen=new THREE.Vector3();
