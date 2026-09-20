import { weaponCard } from './weapon-card.js';
import { weaponThumbnail } from './weapon-display.js';
import * as THREE from 'three';
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
    this.basePanel=document.createElement('section');this.basePanel.className='panel raised world-context';this.basePanel.id='base-context';this.basePanel.hidden=true;ui.root.append(this.basePanel);
    this.basePanel.innerHTML='<h2>Worldheart</h2><p id="base-info"></p><div class="t-actions"><button class="btn primary" id="base-upgrade">Upgrade base</button><button class="btn" id="base-deposit">Deposit crystals</button><button class="btn" id="base-forge">Forge tower</button><button class="btn" id="base-walls">Buy 5 walls / 1 scrap</button><button class="btn ghost" id="base-close">Close</button></div><div class="context-hint">F to interact. Purchases return camera control.</div>';
    for(const [id,action]of [['base-upgrade',()=>mode?.upgradeHeart()],['base-deposit',()=>mode?.depositCrystals()],['base-forge',()=>mode?.craft()],['base-walls',()=>mode?.walls?.buy()]])this.basePanel.querySelector('#'+id).onclick=()=>{if(action())this.close();};
    this.basePanel.querySelector('#base-close').onclick=()=>this.close();
    this.lootPanel.innerHTML='<div id="loot-card"></div><div class="t-name" id="loot-name"></div><div id="loot-preview"></div><div id="loot-stats"></div><p id="loot-compatibility"></p><div class="t-actions"><button class="btn primary" id="loot-pickup">Pick up</button><button class="btn" id="loot-equip">Pick up + equip</button><button class="btn ghost" id="loot-close">Close</button></div><div class="context-hint" id="loot-hint"></div>';
    this.markers=new Map();
    rig.canvas.addEventListener('pointermove',e=>{this.pointer.x=e.clientX;this.pointer.y=e.clientY;});
    this.lootPanel.querySelector('#loot-pickup').onclick=()=>this.pickup(false);
    this.lootPanel.querySelector('#loot-equip').onclick=()=>this.pickup(true);
    this.lootPanel.querySelector('#loot-close').onclick=()=>this.close();
    ui.el['tp-close'].onclick=()=>this.close();
    addEventListener('pointerdown',e=>{if(e.button!==0||document.pointerLockElement!==rig.canvas||!this.gazeButton)return;e.preventDefault();e.stopImmediatePropagation();possession.firing=false;this.gazeButton.click();},true);
    addEventListener('mousedown',e=>{if(e.button===0&&document.pointerLockElement===rig.canvas&&this.gazeButton){e.preventDefault();e.stopImmediatePropagation();}},true);
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
    if(!this.target||this.editing)return;
    this.editing=true;this.wasSuspended=this.possession.suspended;
    this.possession.suspend(true);
    this.update();
    this.panel().querySelector('button:not([disabled])')?.focus();
  }
  close() {
    const wasEditing=this.editing;this.editing=false;
    if(this.panel()?.contains(document.activeElement))document.activeElement.blur();
    this.dismissed=this.target?.object;this.target=null;this.game.contextTower=null;
    this.game.select(null);this.lootPanel.hidden=true;this.basePanel.hidden=true;
    if(wasEditing&&!this.wasSuspended&&this.game.state==='playing'&&!document.querySelector('dialog[open],#end-overlay.show'))this.possession.suspend(false);
  }
  completeTowerAction() {
    // Keep the real tower selected for consecutive upgrades. Closing or selling
    // explicitly returns the FPS cursor; a price change must not dismiss it.
    if(this.target?.kind==='tower'&&this.game.towerMgr.towers.includes(this.target.object)){this.towerStamp='';this.update();return;}
    if(this.editing)this.close();
  }
  panel(){return this.target?.kind==='base'?this.basePanel:this.target?.kind==='loot'?this.lootPanel:this.towerPanel;}
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
    if(!this.mode&&!this.game.towerMgr.towers.length)return null;
    let best=null,distance=Infinity;
    let groundDistance;
    const consider=(kind,object,position,radius)=>{
      const along=_delta.copy(position).sub(ray.origin).dot(ray.direction);
      if(along<=0||along>=distance||ray.distanceSqToPoint(position)>radius*radius)return;
      // Most view rays point at empty ground. Solve terrain occlusion only
      // after a tower or item actually overlaps the ray, with the same exact
      // occlusion predicate used for a visible candidate.
      if(groundDistance===undefined)groundDistance=raycastTerrain(ray.origin,ray.direction,_hit)?ray.origin.distanceTo(_hit):Infinity;
      if(along>groundDistance+radius)return;
      best={kind,object};distance=along;
    };
    for(const t of this.game.towerMgr.towers) {
      _pos.copy(t.pos).addScaledVector(_up.copy(t.pos).normalize(),1.1);consider('tower',t,_pos,1.35);
    }
    if(this.mode){_pos.copy(this.game.world.heart.group.position);_pos.addScaledVector(_up.copy(_pos).normalize(),2);if(ray.origin.distanceTo(_pos)<18)consider('base',this.game.world.heart,_pos,3.2);}
    if(this.mode)for(const e of this.mode.loot.entries.values()) {
      _pos.copy(e.position).addScaledVector(_up.copy(e.position).normalize(),.8);consider('loot',e,_pos,.9);
    }
    return best;
  }
  update() {
    const {game,possession:p,ui}=this;
    const blocked=game.state!=='playing'||game.buildType||game.walls?.placing||document.querySelector('dialog[open],#end-overlay.show');
    if(blocked){if(this.editing)this.close();this.target=null;}
    else if(!this.editing&&(!this.target||p.active||!this.panel().matches(':hover'))) {
      const r=this.rig.canvas.getBoundingClientRect();
      this.rig.raycaster(p.active?r.left+r.width/2:this.pointer.x,p.active?r.top+r.height/2:this.pointer.y,this.ray);
      let next=game.mobile?.enabled&&!p.active?null:this._pick(this.ray.ray);
      if(next)this.lastLook=performance.now();
      if(!next&&p.active&&this.target&&!blocked){
        const box=this.panel().getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
        if(performance.now()-(this.lastLook||0)<800||(x>box.left-40&&x<box.right+40&&y>box.top-40&&y<box.bottom+40))next=this.target;
      }
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
    const display=!game.mobile?.enabled||this.editing;
    this.towerPanel.classList.toggle('show',!!tower&&display);
    this.lootPanel.hidden=this.target?.kind!=='loot'||!display;
    this.basePanel.hidden=this.target?.kind!=='base'||!display;
    if(this.target){
      if(tower){
        const valid=this.validTower(tower);
        ui.el['tp-sell'].disabled=!valid;
        if(!valid)ui.el['tp-upgrade'].disabled=true;
        this.hint.textContent=p.active?(!valid?'Move within 14m to manage':this.editing?'Keep upgrading. F / Escape or Close resumes control.':'F: manage tower'):'Click Upgrade or Sell';
      }else if(this.target.kind==='base'){
        const level=this.mode.run.getHeartLevel();
        this.basePanel.querySelector('#base-info').textContent=`Base level ${level} · ${this.mode.crystals.carried.length} carried crystals · ${this.mode.forge.balance} scraps`;
        this.basePanel.querySelector('#base-upgrade').textContent=`Upgrade base / ${this.mode.run.getHeartCost()??'MAX'} credit or gold`;
        this.basePanel.querySelector('#base-forge').textContent=`Forge tower / ${this.mode.forge.cost} scraps`;
      }else this.renderLoot();
      this.place(this.panel(),tower?tower.pos:this.target.kind==='base'?this.game.world.heart.group.position:this.target.object.position);
    }
    this.gazeButton?.classList.remove('gaze-hover');this.gazeButton=null;
    if(this.target&&!blocked&&p.active&&!p.suspended&&document.pointerLockElement===this.rig.canvas){
      const r=this.rig.canvas.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
      for(const button of this.panel().querySelectorAll('button:not(:disabled)')){const b=button.getBoundingClientRect();if(b.width&&b.height&&x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom){this.gazeButton=button;button.classList.add('gaze-hover');break;}}
    }
    this.updateMarkers();
  }
  place(panel,position) {
    if(this.game.mobile?.enabled){panel.style.transform='';panel.style.visibility='';panel.classList.toggle('context-editing',!!this.editing);return;}
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
    const stamp=JSON.stringify([item,stats,current?.id,baseline]);
    if(this.lootStamp!==stamp){this.lootStamp=stamp;this.lootPanel.querySelector('#loot-card').innerHTML=weaponCard(item,{stats,baseline,comparison:current?rules.name(current):'commander attack',image:weaponThumbnail(item),compact:true});}
    const usable=rules.compatible(item.family),near=api.nearby().some(x=>x.id===item.id);
    put('#loot-compatibility',`${usable?'Compatible':'Incompatible: item stats without commander bonuses'} · ${item.parts.head} / ${item.parts.grip} / ${item.parts.core}. Compared with ${current?rules.name(current):'current commander attack'}.`);
    const full=api.inventory.items.length-api.inventory.slots.filter(Boolean).length>=12;
    this.lootPanel.querySelector('#loot-pickup').disabled=!near||!api.canInteract();
    this.lootPanel.querySelector('#loot-equip').disabled=!near||!usable||!api.canInteract()||full;
    put('#loot-hint',!near?'Move within 2.8m to pick up':full?'Backpack full. Pick up opens replacement choices.':this.possession.active&&!this.editing?'F: inspect / release pointer':'Choose pickup or equip. Escape resumes.');
  }
  updateMarkers() {
    if(!this.mode)return;
    // Mobile presents nest information in its compact HUD. Do not project
    // and rewrite an entire invisible desktop marker layer on every frame.
    if(this.game.mobile?.enabled)return;
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
