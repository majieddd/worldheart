import { CONFIG } from './config.js';
import { browserStorage } from './storage.js';
import { TouchGesture, TouchStick, bindTouchActivation, hasTouch, clamp } from './touch-input.js';

const button=(id,text,extra='')=>`<button type="button" class="btn" id="touch-${id}" ${extra}>${text}</button>`;
const text=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
const abilityButton=(id,label)=>button(id,`<small>${label}</small><strong></strong><span class="touch-cooldown">Ready</span>`,'data-touch-ability');
const reasons={terrain:'Choose solid ground',water:'Needs dry ground',unstable:'Too steep',hot:'Mortars only on hot stone',cold:'Cryo only on ice',mixed:'Move off the biome boundary',heart:'Too close to the heart',portal:'Too close to a nest',overlap:'Overlaps a tower',enemies:'Enemy in footprint',allies:'Friendly in footprint',path:'Keep a route to the heart',landmark:'Landmark in footprint',gold:'Not enough gold',frontier:'Outside base range',reach:'Walk closer',shifting:'Wait for the tremor'};

export class MobileControls {
  constructor({game,ui,rig,possession,mode}) {
    Object.assign(this,{game,ui,rig,possession,mode});game.mobile=this;
    this.preference='auto';this.sensitivity=1.4;this.leftHanded=false;this.moves=[];this.holds=new Map();this.orderMode=null;
    try{const saved=JSON.parse(browserStorage.getItem('touchControls')||'{}');if(['auto','on','off'].includes(saved.mode))this.preference=saved.mode;this.sensitivity=clamp(Number(saved.sensitivity)||1.4,.5,3);this.leftHanded=!!saved.leftHanded;}catch{/* Private storage keeps usable defaults. */}
    this.root=document.createElement('section');this.root.id='touch-hud';this.root.setAttribute('aria-label','Touch controls');
    this.root.innerHTML=`<div class="touch-top">
      ${button('status','Heart','aria-label="Base status and expedition tools"')}
      <div class="touch-wave"><strong></strong><span></span><small></small></div>
      ${button('menu-open','Menu','aria-haspopup="dialog" aria-controls="touch-menu"')}
    </div><div class="touch-boss" hidden><span></span><meter min="0" max="1" value="1" aria-label="Guardian health"></meter></div><div class="touch-toasts"></div>
    <div class="touch-quick">${button('commander','Commander')}${button('camera','1st person','hidden')}${button('build','Build')}${button('resume','Resume','hidden')}</div>
    <div class="touch-context">${button('interact','Interact','hidden')}${button('deposit','Deposit crystals','hidden')}</div>
    <div class="touch-left"><div class="touch-stick" id="touch-stick" role="group" aria-label="Movement joystick. Drag in the direction you want to move."><span class="touch-stick-thumb"></span><small>Move</small></div>${button('sprint','Run','aria-pressed="false"')}</div>
    <div class="touch-right">${button('fire','Attack','aria-label="Hold to attack. Drag this button to aim while attacking."')}${button('jump','Jump','aria-label="Jump. Hold to rise on a flying mount."')}${button('aim','Aim','aria-pressed="false"')}${abilityButton('special','Skill')}${abilityButton('power','Power')}${button('switch','Swap','aria-label="Switch weapon"')}</div>
    <div class="touch-vitals"><strong></strong><span></span></div>
    <div class="touch-placement" hidden><span role="status"></span>${button('confirm','Place')}${button('cancel','Cancel')}</div>
    <div class="touch-orders" hidden><span role="status"></span>${button('order-move','Move here')}${button('order-done','Done')}</div>`;
    ui.root.append(this.root);
    const elements=new Map([...this.root.querySelectorAll('[id]')].map(e=>[e.id.slice(6),e]));this.el=id=>elements.get(id);
    this.menu=document.createElement('dialog');this.menu.id='touch-menu';this.menu.setAttribute('aria-labelledby','touch-menu-title');
    this.menu.innerHTML=`<header><h2 id="touch-menu-title">Field menu</h2>${button('close','Resume')}</header>
      <nav aria-label="Field tools">${['build','base','squad','options'].map(k=>button('tab-'+k,k[0].toUpperCase()+k.slice(1),`data-page="${k}" aria-pressed="false"`)).join('')}${button('weapons','Weapons')}</nav>
      <section data-section="build"><h3>Tower cards</h3><p>Choose a card, tap a location to preview, then Place. In commander view, aim at the ground. Cancel returns the card.</p></section>
      <section data-section="base" hidden><h3>Base and expedition</h3><p id="touch-expedition-name"></p>${button('receipt','Planet results and extraction','hidden')}</section>
      <section data-section="squad" hidden><h3>Commander and squad</h3><div class="touch-menu-actions">${button('view','Third / first person')}${button('release','Return to strategy')}${button('rally','Rally nearby units')}${button('dismiss','Dismiss followers')}${button('select','Select on map')}${button('visible','Select visible units')}${button('patrol','Post barracks patrol')}</div><div id="touch-roster"></div></section>
      <section data-section="options" hidden><h3>Controls and settings</h3><label class="touch-pause-choice"><input id="touch-keep-paused" type="checkbox"> Keep battle paused after closing</label><div class="touch-menu-actions" id="touch-options-actions"></div></section>
      <details class="touch-help"><summary>How to play by touch</summary><p>Strategy: drag with one finger to move around the planet. Pinch to zoom; drag with two fingers to turn and tilt. Tap a tower to manage it or a unit to control it.</p><p>Commander: left thumb moves; drag the scene or Attack to look. Hold Attack to fight. Aim and Run toggle. Jump hops, or hold it to rise on a flying mount. Skill uses the commander ability; Power uses the weapon ability. Swap cycles equipped weapons and native attacks.</p><p>Use Base for upgrades, deposits, mounts and scrap forging. Use Weapons for equipment, parts, infusion, salvaging and full-backpack replacement. Squad gives selection, move orders and patrols. Going outside base range still severs the strategy link.</p><p>Menus pause this solo battle. Nearby weapons enter your bag automatically and are never auto-equipped. Crystal cargo stays with your commander until deposited.</p></details>`;
    ui.root.append(this.menu);this.page=k=>this.menu.querySelector(`[data-section="${k}"]`);
    this.menu.addEventListener('cancel',e=>{e.preventDefault();this.closeMenu();});
    this.menu.querySelector('#touch-close').onclick=()=>this.closeMenu();
    this.menu.querySelector('#touch-keep-paused').onchange=e=>{this.keepPaused=e.target.checked;};
    this.menu.querySelector('#touch-weapons').onclick=()=>{this.closeMenu();mode?.weaponPanel.open();};
    this.menu.querySelector('#touch-receipt').onclick=()=>{this.closeMenu();if(mode?.campaign)mode.campaign.showReceipt();else{ui._ended=false;ui.showEnd(true);}};
    for(const b of this.menu.querySelectorAll('[data-page]'))b.onclick=()=>this.showPage(b.dataset.page);
    // Reuse the real transaction controls. Release our pause before the same
    // click reaches their handlers; presentation settings keep the menu open.
    this.menu.addEventListener('click',e=>{
      if(e.target.closest('.build-card:not(:disabled),#btn-call:not(:disabled),#heart-panel:not(:disabled),#btn-deposit:not(:disabled),#craft-tower:not(:disabled),#mount-toggle:not(:disabled),#endless-extract:not(:disabled),.worldgen-launch'))this.closeMenu();
    },true);
    this.el('menu-open').onclick=()=>this.openMenu();this.el('status').onclick=()=>this.openMenu('base');this.el('build').onclick=()=>this.openMenu('build');
    this.el('commander').onclick=()=>possession.active?this.release():mode?.focusCommander();this.el('resume').onclick=()=>{game.paused=false;ui.reflectPause();};
    this.el('camera').onclick=()=>{this.reset();possession.boomWant=possession.boomWant>.35?0:4;};
    this.el('interact').onclick=()=>{this.reset();game.context.open();};
    this.el('deposit').onclick=()=>mode?.depositCrystals();
    this.el('sprint').onclick=()=>{possession.touchInput.sprint=!possession.touchInput.sprint;};
    this.el('aim').onclick=()=>{if(this.canDrive()&&possession.boomWant<.35&&!game.buildType)possession.aiming=!possession.aiming;};
    this.el('special').onclick=()=>this.activateAbility('commander');
    this.el('power').onclick=()=>this.activateAbility('weapon');
    this.el('switch').onclick=()=>{
      if(!this.canDrive()||!mode||possession.unit!==mode.commander)return;
      const inv=mode.inventory,slots=['native','basic',...inv.slots.flatMap((id,i)=>id?[i]:[])];
      if(mode.weapons.request({kind:'select',slot:slots[(slots.indexOf(inv.active)+1)%slots.length]}))ui.toast(inv.pending?'Weapon change queued until this attack finishes.':inv.current?mode.weaponPanel.rules.name(inv.current):inv.active==='basic'?'Basic sword':'Commander technique','info');
    };
    this.hold(this.el('fire'),held=>{possession.firing=held&&!this.pendingPower;if(possession.firing)possession.attack(0);},true);
    this.hold(this.el('jump'),held=>possession.touchJump(held));
    this.stick=new TouchStick(this.el('stick'),(x,y)=>{possession.touchInput.forward=y;possession.touchInput.strafe=x;},()=>this.canDrive(),{floating:true});
    this.el('confirm').onclick=()=>{if(this.canAct()&&game.buildType){if(possession.active)game.hoverCenter();game._tryPlace();}};
    this.el('cancel').onclick=()=>{game.cancelBuild();this.preview=false;};
    this.el('order-move').onclick=()=>{this.orderMode='move';};
    this.el('order-done').onclick=()=>{this.orderMode=null;mode?.orders.clear();};
    const action=(id,fn)=>this.menu.querySelector('#touch-'+id).onclick=()=>{this.closeMenu();fn();};
    action('view',()=>{if(possession.active){possession.boomWant=possession.boomWant>.35?0:4;possession.aiming=false;}else mode?.focusCommander();});
    action('release',()=>this.release());action('rally',()=>possession.rally());action('dismiss',()=>possession.dismiss());
    action('select',()=>{if(this.release()){game.context.close();game.cancelBuild();this.orderMode='select';}});
    action('visible',()=>{if(this.release()){game.context.close();game.cancelBuild();mode?.orders.selectIn(0,0,innerWidth,innerHeight);this.orderMode='move';}});
    action('patrol',()=>{const tower=this.menuTower||game.selectedTower;if(tower?.typeKey==='warden'&&game.towerMgr.towers.includes(tower)&&this.release()){this.patrolTower=tower;game.context.close();this.orderMode='patrol';}else ui.toast('Select a Warden Barracks first.','info');});
    this.createSettings();
    const intro=document.createElement('p');intro.className='touch-only touch-intro';intro.textContent='Drag to move around the planet; pinch to zoom. Tap a tower to manage it or Commander to explore. During possession, use the movement stick and drag the scene to look. Hold Attack, or drag Attack to aim while firing. Menu opens building, weapons, base tools and squad orders.';ui.el['title-overlay'].querySelector('.o-controls').append(intro);
    this.gesture=new TouchGesture(rig.canvas,{
      accept:()=>this.enabled&&this.canScene(),start:p=>this.panStart(p),drag:(dx,dy,p)=>this.drag(dx,dy,p),
      multiStart:()=>{this.box=null;this.showBox();},
      pinch:(zoom,dx,dy)=>{if(!possession.active){rig.zoomBy(zoom);rig.viewYaw-=dx*.006;rig.tiltOffset=clamp(rig.tiltOffset+dy*.004,-.55,.75);}else this.look(dx,dy);},
      tap:(x,y)=>this.tap(x,y),end:(used,cancelled)=>{if(this.box&&used&&!cancelled)mode?.orders.selectIn(this.box.x,this.box.y,this.box.x1,this.box.y1);this.box=null;this.showBox();rig.dragging=false;rig.dragFocusRadius=null;},
      cancel:()=>{this.box=null;this.showBox();rig.dragging=false;rig.dragFocusRadius=null;}
    });
    for(const name of ['blur','pagehide','resize'])addEventListener(name,()=>this.reset());
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.reset();if(this.enabled&&game.state==='playing'){game.paused=true;ui.reflectPause();}}});
    rig.canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&this.preference==='auto'&&!this.enabled)this.setEnabled(true);},true);
    const oldBlock=rig.inputBlocked;rig.inputBlocked=()=>oldBlock?.()||this.enabled&&(this.menu.open||game.context.editing);
    this.setEnabled(this.preference==='on'||this.preference==='auto'&&hasTouch());
    bindTouchActivation(document,()=>this.enabled);
    this.receiptWeapons=document.createElement('button');this.receiptWeapons.className='btn touch-only';this.receiptWeapons.id='touch-receipt-weapons';this.receiptWeapons.textContent='Review weapons';this.receiptWeapons.onclick=()=>mode?.weaponPanel.open();
    this.receiptSaves=document.createElement('button');this.receiptSaves.className='btn touch-only';this.receiptSaves.id='touch-receipt-saves';this.receiptSaves.textContent='Checkpoint and saves';this.receiptSaves.onclick=()=>this.openMenu('base',true);
    this.titleSaves=this.receiptSaves.cloneNode(true);this.titleSaves.id='touch-title-saves';this.titleSaves.hidden=!mode?.campaign;this.titleSaves.onclick=()=>this.openMenu('base',true);
    if(mode?.campaign)ui.el['title-overlay'].querySelector('.o-actions').append(this.titleSaves);
    if(mode)ui.el['end-card'].querySelector('.o-actions').append(this.receiptWeapons,this.receiptSaves);
    this.update(1);
  }
  createSettings() {
    const settings=document.createElement('div');settings.className='touch-settings';
    settings.innerHTML='<label>Touch controls<select id="touch-preference"><option value="auto">Automatic</option><option value="on">Always show</option><option value="off">Mouse and keyboard</option></select></label><label>Touch look sensitivity<input id="touch-sensitivity" type="range" min="0.5" max="3" step="0.1"></label><label><input id="touch-handed" type="checkbox"> Left-handed controls</label>';
    this.ui.el['settings-pop'].prepend(settings);
    const pref=settings.querySelector('select'),sens=settings.querySelector('input[type="range"]'),hand=settings.querySelector('input[type="checkbox"]');pref.value=this.preference;sens.value=this.sensitivity;hand.checked=this.leftHanded;
    pref.onchange=()=>{this.preference=pref.value;this.save();this.setEnabled(this.preference==='on'||this.preference==='auto'&&hasTouch());};
    sens.oninput=()=>{this.sensitivity=Number(sens.value);this.save();};hand.onchange=()=>{this.leftHanded=hand.checked;document.body.classList.toggle('touch-left-handed',this.leftHanded);this.save();};
  }
  save(){try{browserStorage.setItem('touchControls',JSON.stringify({mode:this.preference,sensitivity:this.sensitivity,leftHanded:this.leftHanded}));}catch{/* Settings remain usable without storage. */}}
  move(id,host) {
    const node=document.getElementById(id);if(!node)return;
    const placeholder=document.createComment('desktop '+id);node.before(placeholder);this.moves.push({node,placeholder});host.append(node);
  }
  setEnabled(on) {
    if(this.enabled===on)return;this.closeMenu();this.reset();this.enabled=on;
    document.body.classList.toggle('touch-mode',on);document.body.classList.toggle('touch-left-handed',this.leftHanded);this.possession.touchEnabled=on;
    if(on){
      if(document.pointerLockElement)document.exitPointerLock?.();
      this.move('build-bar',this.page('build'));
      for(const id of ['heart-panel','crystal-panel','expedition-tools','campaign-save'])this.move(id,this.page('base'));
      this.move('settings-pop',this.page('options'));
      for(const id of ['btn-speed','btn-home','btn-sound']){this.move(id,this.menu.querySelector('#touch-options-actions'));const b=document.getElementById(id);b.setAttribute('aria-label',b.title);}
      this.move('toast-anchor',this.root.querySelector('.touch-toasts'));
      this.worldOptions=document.createElement('details');this.worldOptions.className='touch-world-options';this.worldOptions.innerHTML='<summary>World and game mode</summary>';
      this.ui.el['title-overlay'].querySelector('.o-actions').after(this.worldOptions);
      this.move('map-row',this.worldOptions);
      const terrain=document.getElementById('terrain-profile');if(terrain){terrain.parentElement.id='touch-terrain-choice';this.move('touch-terrain-choice',this.worldOptions);}
      this.menu.querySelector('#touch-weapons').hidden=!this.mode;
      this.menu.querySelector('[data-page="squad"]').hidden=!this.mode;
    }else {for(const {node,placeholder}of this.moves)placeholder.replaceWith(node);this.moves.length=0;this.worldOptions?.remove();this.possession._lock();}
  }
  blockedOverlay(){return !!document.querySelector('#title-overlay.show,#talent-overlay.show,#end-overlay.show,#draft-overlay.show,dialog[open]');}
  canAct(){return this.enabled&&this.game.state==='playing'&&!this.game.paused&&!this.game.terrainBusy&&!this.blockedOverlay();}
  canDrive(){return this.canAct()&&this.possession.active&&!this.possession.suspended&&!this.game.context.editing;}
  canScene(){return CONFIG.worldgen||this.canAct()&&!this.game.context.editing;}
  hold(element,change,look=false) {
    element.dataset.touchHold='true';
    element.addEventListener('pointerdown',e=>{
      if(!this.canDrive()||this.game.buildType&&look||this.holds.has(element))return;
      e.preventDefault();e.stopPropagation();element.setPointerCapture(e.pointerId);
      this.holds.set(element,{id:e.pointerId,x:e.clientX,y:e.clientY,change});element.classList.add('touch-held');change(true);
    });
    element.addEventListener('pointermove',e=>{const p=this.holds.get(element);if(p?.id!==e.pointerId)return;if(look)this.look(e.clientX-p.x,e.clientY-p.y);p.x=e.clientX;p.y=e.clientY;});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(name,e=>{const p=this.holds.get(element);if(p?.id===e.pointerId){this.holds.delete(element);element.classList.remove('touch-held');change(false);}});
    element.addEventListener('keydown',e=>{if((e.code==='Space'||e.code==='Enter')&&!e.repeat&&this.canDrive()){e.preventDefault();change(true);}});
    element.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();change(false);}});
  }
  reset() {
    this.pendingPower=null;
    this.stick?.reset();this.gesture?.cancel();
    for(const [element,p]of this.holds){p.change(false);this.holds.delete(element);element.classList.remove('touch-held');if(element.hasPointerCapture(p.id))element.releasePointerCapture(p.id);}
    this.possession.clearTouch();this.possession.firing=false;this.possession.aiming=false;
    this.possession.yawQueue=0;this.possession.pitchQueue=0;this.possession.jumpBuffer=0;
  }
  release(){if(this.possession.active&&!this.possession.linked){this.ui.toast('Outside base range. Walk home to reconnect.','warn');return false;}this.reset();if(this.possession.active)this.possession.exit();return true;}
  look(dx,dy){this.possession.touchLook(dx,dy,this.sensitivity);}
  panStart(p) {
    if(this.possession.active)return;
    if(this.orderMode==='select'){this.box={x:p.x,y:p.y,x1:p.x,y1:p.y};return;}
    const r=this.rig;r.cancelFlight();r.keys.clear();r.velLon=r.velLat=0;r.dragFocusRadius=r.focusRadius;r.dragging=true;r.terrainSettle=null;
    r.grabR=r._pickGrabRadius(p.x,p.y);r.grabValid=r._screenToSphere(p.x,p.y,r.grabDir);r._grabOff=r.grabValid&&!r.rayHit;
  }
  drag(dx,dy,p) {
    if(this.possession.active){this.look(dx,dy);return;}
    if(this.box){this.box.x1=p.x;this.box.y1=p.y;this.showBox();return;}
    if(this.rig.grabValid)this.rig.panGrab(p.x,p.y,Math.hypot(dx,dy));else this.rig.panPixels(dx,dy,true);
  }
  showBox(){const el=document.getElementById('sel-box');if(!el)return;el.style.display=this.box?'block':'none';if(this.box){const b=this.box;Object.assign(el.style,{left:Math.min(b.x,b.x1)+'px',top:Math.min(b.y,b.y1)+'px',width:Math.abs(b.x-b.x1)+'px',height:Math.abs(b.y-b.y1)+'px'});}}
  tap(x,y) {
    if(CONFIG.worldgen||this.possession.active)return;
    const g=this.game;g._hover(x,y);
    if(g.buildType){this.preview=g.cursorValid;return;}
    if(this.orderMode&&g.cursorValid){
      if(this.orderMode==='select'){const a=this.possession.allies.nearestTo(g.cursorPos,3.2);if(a)this.mode.orders.selectUnit(a,true);}
      else if(this.orderMode==='patrol'){if(this.mode.orders.patrol(this.patrolTower,g.cursorDir))this.orderMode=null;}
      else this.mode.orders.move(g.cursorDir,g.cursorPos.length()-CONFIG.planetRadius);
      return;
    }
    g.context.pointer.x=x;g.context.pointer.y=y;g.context.rig.raycaster(x,y,g.context.ray);
    g.context.target=g.context._pick(g.context.ray.ray);
    if(g.context.target){g.context.open();return;}
    this.rig.onTap?.(x,y,0);
  }
  openMenu(page='build',receipt=false) {
    if(!this.enabled||this.menu.open)return;
    const title=this.ui.el['title-overlay'].classList.contains('show');
    if(receipt){if(!this.mode?.campaign||!title&&!this.ui.el['end-overlay'].classList.contains('show')||document.querySelector('dialog[open]'))return;}
    else if(this.blockedOverlay()||this.game.state!=='playing')return;
    this.receiptMenu=receipt;this.menu.classList.toggle('touch-receipt-menu',receipt);this.menu.querySelector('nav').hidden=receipt;this.menu.querySelector('.touch-help').hidden=receipt;
    this.recoveryTrigger=title?this.titleSaves:this.receiptSaves;
    this.menu.querySelector('#touch-close').textContent=receipt?(title?'Back to start':'Back to results'):'Resume';
    this.menu.querySelector('#touch-menu-title').textContent=receipt?'Checkpoint and saves':'Field menu';
    this.reset();this.menuTower=this.game.context.target?.kind==='tower'?this.game.context.target.object:this.game.selectedTower;this.game.context.close();this.keepPaused=this.game.paused;this.wasSuspended=this.possession.suspended;
    this.game.paused=true;this.possession.suspend(true);this.rig.keys.clear();this.rig.cancelFlight();this.rig.velLon=this.rig.velLat=0;
    this.showPage(page);this.menu.querySelector('#touch-keep-paused').checked=this.keepPaused;
    this.menu.showModal();document.body.classList.add('touch-menu-open');this.menu.querySelector('#touch-close').focus();
  }
  closeMenu() {
    if(!this.menu?.open)return;this.menu.close();document.body.classList.remove('touch-menu-open');
    this.game.paused=!!this.keepPaused;this.possession.suspend(!!this.wasSuspended);this.ui.reflectPause();(this.receiptMenu?this.recoveryTrigger:this.el('menu-open')).focus({preventScroll:true});
  }
  showPage(page) {
    for(const section of this.menu.querySelectorAll('[data-section]'))section.hidden=section.dataset.section!==page;
    for(const b of this.menu.querySelectorAll('[data-page]'))b.setAttribute('aria-pressed',String(b.dataset.page===page));
    this.menu.querySelector('#touch-expedition-name').textContent=document.getElementById('campaign-status')?.textContent||'Single-planet defense';
    if(page==='squad'&&this.mode){let info=this.menu.querySelector('#touch-ability-info');if(!info){info=document.createElement('p');info.id='touch-ability-info';this.page('squad').querySelector('h3').after(info);}info.textContent=['commander','weapon'].map(which=>{const s=this.mode.abilities.describe(which);return `${which==='commander'?'Skill':'Power'}: ${s.name}. ${s.description}`;}).join(' ');}
    if(page==='squad')this.renderRoster();
  }
  renderRoster() {
    const root=this.menu.querySelector('#touch-roster');root.replaceChildren();
    for(const a of this.possession.allies.active){
      if(!a.active||a.dead)continue;
      const row=document.createElement('div');row.className='touch-unit';
      const name=document.createElement('span');name.textContent=`${a.type.name} · ${Math.ceil(a.hp)} HP`;
      const select=document.createElement('button');select.className='btn';select.textContent='Select';select.onclick=()=>{this.closeMenu();if(this.release()){this.mode.orders.selectUnit(a);this.orderMode='move';}};
      const control=document.createElement('button');control.className='btn';control.textContent='Control';control.onclick=()=>{this.closeMenu();if(this.release())this.possession.enter(a);};row.append(name,select,control);root.append(row);
    }
  }
  activateAbility(which) {
    if(!this.canDrive()||!this.mode||this.possession.unit!==this.mode.commander||this.game.buildType)return;
    const abilities=this.mode.abilities,s=abilities.describe(which);
    if(s.remaining>0)return;
    if(abilities.activate(which)){if(which==='weapon')this.pendingPower=null;this.timer=1;return;}
    // A held attack previously swallowed a Power tap during recovery. Queue
    // exactly one request, stop repeating the basic attack, and execute at the
    // first legal recovery point. This never cancels a strike or its cooldown.
    if(which==='weapon'){
      this.pendingPower={unit:this.possession.unit,key:s.key,left:Math.max(.4,this.possession.unit.swingT+.25)};
      this.possession.firing=false;this.timer=1;
    }
  }
  beforeFrame(dt=1/60) {
    if(!this.enabled)return;
    const drive=this.canDrive();
    if(!drive&&(this.wasDriving||this.holds.size||this.stick.pointer!==null))this.reset();
    this.wasDriving=drive;
    if(this.lastUnit!==this.possession.unit){this.reset();this.lastUnit=this.possession.unit;}
    if(this.pendingPower){
      const pending=this.pendingPower,p=this.possession,a=pending.unit;pending.left-=dt;
      p.firing=false;
      if(pending.left<=0||!drive||a!==p.unit||this.mode.abilities.describe('weapon').key!==pending.key||this.game.buildType)this.pendingPower=null;
      else if(a.swingT<=0&&!a.strikePending&&this.mode.abilities.activate('weapon'))this.pendingPower=null;
      if(!this.pendingPower){p.firing=drive&&this.holds.has(this.el('fire'));this.timer=1;}
    }
  }
  update(dt=0) {
    if(!this.enabled){this.root.hidden=true;return;}
    this.timer=(this.timer||0)+dt;if(this.timer<.1)return;this.timer=0;
    const g=this.game,p=this.possession,m=this.mode,a=p.active?p.unit:m?.commander;
    const hidden=g.state!=='playing'||this.blockedOverlay()||CONFIG.worldgen;this.root.hidden=hidden;
    this.receiptWeapons.hidden=!m?.weapons.canInteract();this.receiptSaves.hidden=!m?.campaign;
    this.menu.querySelector('#touch-receipt').hidden=!m||!['victory','complete'].includes(m.campaign?.state()?.status||m.run.getPhase());
    const drive=p.active&&!p.suspended&&!g.paused&&!g.context.editing;
    this.root.classList.toggle('touch-possessed',drive);this.root.classList.toggle('touch-building',!!g.buildType);
    text(this.el('status'),`Heart ${g.lives}\n${Math.floor(g.gold)} gold`);
    const wave=this.root.querySelector('.touch-wave'),expedition=m?.campaign?.state();text(wave.querySelector('strong'),(expedition?`P${expedition.planet}/${expedition.limit} · `:'')+this.ui.el['wave-label'].textContent);text(wave.querySelector('span'),this.ui.el['wave-sub'].textContent);text(wave.querySelector('small'),this.ui.el['nest-count'].textContent);
    const boss=g.enemies.active.find(e=>e.type.boss&&!e.dead),bossBar=this.root.querySelector('.touch-boss');bossBar.hidden=!boss;if(boss){bossBar.querySelector('span').textContent=boss.type.name;bossBar.querySelector('meter').value=Math.max(0,boss.hp/boss.hpMax);}
    this.root.classList.toggle('touch-has-boss',!!boss);
    const save=document.querySelector('.campaign-save');this.el('status').classList.toggle('touch-save-failed',!!save?.classList.contains('save-failed'));
    this.el('commander').hidden=!m;this.el('commander').disabled=!p.active&&(!m?.commander.active||m?.commander.dead);text(this.el('commander'),p.active?'Strategy':'Commander');
    this.el('camera').hidden=!drive;text(this.el('camera'),p.boomWant>.35?'1st person':'3rd person');
    this.el('build').hidden=!!g.buildType||g.context.editing;this.el('resume').hidden=!g.paused;
    this.el('interact').hidden=!drive||!!g.buildType||!g.context.target;
    this.el('interact').textContent=g.context.target?.kind==='loot'?'Inspect loot':g.context.target?.kind==='base'?'Manage base':'Manage tower';
    this.el('deposit').hidden=!drive||!m?.crystals.carried.length||this.ui.el['btn-deposit'].disabled;
    this.el('sprint').setAttribute('aria-pressed',String(p.touchInput.sprint));this.el('aim').setAttribute('aria-pressed',String(p.aiming));this.el('aim').hidden=p.boomWant>.35;
    text(this.el('jump'),a?.mountKey==='skyray'?'Rise':'Jump');
    for(const [id,which]of [['special','commander'],['power','weapon']]){
      const b=this.el(id),s=m?.abilities.describe(which);b.hidden=!s||p.unit!==m.commander;
      if(s){
        const label=which==='commander'?{commander:'Ward',duelist:'Dash',marksman:'Deadeye',bombardier:'Seismic',oracle:'Renewal'}[s.key]:{sword:'Cyclone',spear:'Lunge',twinblade:'Dance',carbine:'Railshot',lobber:'Siege',scepter:'Phoenix'}[s.key];
        text(b.querySelector('strong'),label||s.name);
        text(b.querySelector('.touch-cooldown'),s.remaining>0?Math.ceil(s.remaining)+'s':which==='weapon'&&this.pendingPower?'Queued':'Ready');
        const hint=`${s.name}. ${s.description}${s.remaining>0?' Ready in '+Math.ceil(s.remaining)+' seconds.':''}`;
        if(b.getAttribute('aria-label')!==hint)b.setAttribute('aria-label',hint);
        b.title=s.name;b.disabled=s.remaining>0;b.classList.toggle('touch-queued',which==='weapon'&&!!this.pendingPower);
      }
    }
    this.el('switch').hidden=!m||p.unit!==m.commander;
    const vitals=this.root.querySelector('.touch-vitals');vitals.hidden=!a;
    if(a){vitals.querySelector('strong').textContent=a.dead?`Respawn ${Math.ceil(m?.respawn.remaining||0)}s`:`${Math.ceil(a.hp)} / ${a.hpMax} HP`;vitals.querySelector('span').textContent=p.active?(p.linked?'Base linked':'Outside base range'):'Commander';if(a.mountKey==='skyray')vitals.querySelector('span').textContent+=` · Flight ${Math.ceil(m.mounts.energy)}s`;}
    const placement=this.root.querySelector('.touch-placement');placement.hidden=!g.buildType;
    if(g.buildType){const valid=g.cursorValid&&(p.active||this.preview)&&g.validity.ok;placement.querySelector('span').textContent=!(p.active||this.preview)?'Tap ground to preview':valid?'Ready to place':reasons[g.validity.reason]||'Choose a location';this.el('confirm').disabled=!valid||g.paused;}else this.preview=false;
    const orders=this.root.querySelector('.touch-orders');orders.hidden=!this.orderMode;
    if(this.orderMode){orders.querySelector('span').textContent=this.orderMode==='select'?`Tap units or box-select · ${m.orders.selection.length} selected`:this.orderMode==='patrol'?'Tap a patrol destination':`Tap destination · ${m.orders.selection.length} selected`;this.el('order-move').hidden=this.orderMode!=='select';this.el('order-move').disabled=!m.orders.selection.length;}
    // Wave calling belongs in the build drawer, leaving the skyline clear.
    const call=this.ui.el['btn-call'];if(call.parentNode!==this.page('build')){this.move('btn-call',this.page('build'));}
  }
}
