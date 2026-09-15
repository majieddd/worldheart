import * as THREE from 'three';
import { CONFIG } from './config.js';
import { DECORATIONS, HOME_VERSION, canClaimHome } from './run/homeworld.js';
import { homeStore } from './modes/home-store.js';
import { orientOnSurface, surfaceElevation, supportHeight } from './world.js';

function decorationModel(kind) {
  const group=new THREE.Group(),def=DECORATIONS[kind];
  const stone=new THREE.MeshStandardMaterial({color:def.color,roughness:.85,flatShading:true});
  const wood=new THREE.MeshStandardMaterial({color:0x695744,roughness:1,flatShading:true});
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;group.add(m);return m;};
  if(kind==='lantern'){
    add(new THREE.CylinderGeometry(.22,.36,.25,6),stone,0,.12,0);
    add(new THREE.CylinderGeometry(.075,.1,1.5,6),wood,0,.8,0);
    const glow=new THREE.MeshStandardMaterial({color:def.color,emissive:def.color,emissiveIntensity:.7,roughness:.35,flatShading:true});
    add(new THREE.OctahedronGeometry(.35),glow,0,1.65,0);
  }else if(kind==='garden'){
    add(new THREE.CylinderGeometry(1.2,1.35,.2,9),wood,0,.08,0);
    for(let i=0;i<7;i++){const a=i*2.399,r=.28+Math.sqrt(i/7)*.65;
      add(new THREE.CylinderGeometry(.035,.055,.45+i%3*.12,5),wood,Math.sin(a)*r,.3,Math.cos(a)*r);
      add(new THREE.IcosahedronGeometry(.22,0),i%2?stone:new THREE.MeshStandardMaterial({color:0xe8adbd,flatShading:true}),Math.sin(a)*r,.62+i%3*.12,Math.cos(a)*r);}
  }else if(kind==='banner'){
    add(new THREE.CylinderGeometry(.06,.1,2.8,6),wood,0,1.4,0);
    add(new THREE.BoxGeometry(1.05,.85,.06),stone,.53,2.1,0);
    add(new THREE.OctahedronGeometry(.14),stone,0,2.9,0);
  }else if(kind==='bench'){
    add(new THREE.BoxGeometry(2,.18,.65),wood,0,.68,0);
    add(new THREE.BoxGeometry(2,.55,.12),wood,0,1.04,.3);
    for(const x of [-.7,.7])add(new THREE.BoxGeometry(.18,.65,.5),stone,x,.32,0);
  }else if(kind==='arch'){
    for(const x of [-1.1,1.1])add(new THREE.CylinderGeometry(.18,.3,2,6),stone,x,1,0);
    const arch=add(new THREE.TorusGeometry(1.1,.21,5,10,Math.PI),stone,0,2,0);arch.rotation.z=0;
  }else{
    add(new THREE.CylinderGeometry(.65,.9,.5,8),wood,0,.25,0);
    const gem=add(new THREE.OctahedronGeometry(.72),stone,0,1.15,0);gem.scale.y=1.3;
  }
  return group;
}

// One controller owns claim, peaceful edits and the next incursion boundary.
// Decoration never occupies navigation cells or changes defensive statistics.
export class HomePlanet {
  constructor({game,ui,world,nav,rig,possession,run,weather,snapshot}) {
    Object.assign(this,{game,ui,world,nav,rig,possession,run,weather,snapshot});
    this.record=CONFIG.homeSnapshot?structuredClone(CONFIG.homeSnapshot):null;
    this.running=false;this.stopRequested=false;this.due=false;this.lastSave='';this.dirty=false;this.saveClock=0;
    this.models=[];this.tool=null;this.rotation=0;
    this.group=new THREE.Group();game.scene.add(this.group);
    if(this.record)this.rebuild();
    this.button=document.createElement('button');this.button.id='home-planet-open';this.button.className='btn';
    this.button.textContent=this.record?'Home planet':'Claim a home planet';this.button.onclick=()=>this.open();
    this.endButton=this.button.cloneNode(true);this.endButton.id='home-planet-end';this.endButton.onclick=()=>this.open();
    ui.el['end-card'].querySelector('.o-actions').append(this.endButton);
    const dialog=document.createElement('dialog');dialog.id='home-planet-dialog';dialog.className='home-planet-dialog';
    dialog.innerHTML='<form method="dialog"><button class="btn home-close" aria-label="Close home controls">Close</button></form><h2>Home planet</h2><p id="home-status" role="status"></p><label>Planet name <input id="home-name" maxlength="60" autocomplete="off"></label><div class="home-actions"><button class="btn" id="home-claim">Claim this planet</button><button class="btn" id="home-save">Save home</button><button class="btn" id="home-incursion">Start incursions</button><a class="btn" href="lobby.html">Preparation lobby</a></div><fieldset id="home-decor"><legend>Decorate your planet</legend><p>Free decorations do not block paths or change combat. Choose a piece, then tap the ground in orbit view. On foot, use Place here. Tap an existing decoration to remove it.</p><div class="home-palette"></div><label>Facing <select id="home-rotation"><option value="0">North</option><option value="1.5707963267948966">East</option><option value="3.141592653589793">South</option><option value="4.71238898038469">West</option></select></label><button class="btn" id="home-remove">Remove decoration</button></fieldset><details><summary>Home backup</summary><p>Saved in this browser. Export to keep a separate copy. Multiplayer visits are not available yet.</p><button class="btn" id="home-export">Export homes</button><label>Import home backup <input id="home-import" type="file" accept="application/json,.json"></label></details>';
    document.body.append(dialog);this.dialog=dialog;
    const el=id=>dialog.querySelector('#'+id);this.el=el;
    for(const [key,d]of Object.entries(DECORATIONS)){const b=document.createElement('button');b.className='btn';b.textContent=d.name;b.onclick=()=>this.choose(key);dialog.querySelector('.home-palette').append(b);}
    el('home-claim').onclick=()=>this.claim();
    el('home-save').onclick=()=>{this.rename();this.save();this.refresh();};
    el('home-incursion').onclick=()=>{this.running?this.requestStop():this.start();this.refresh();};
    el('home-rotation').onchange=e=>{this.rotation=Number(e.target.value);};
    el('home-remove').onclick=()=>this.choose('remove');
    el('home-export').onclick=()=>{const blob=new Blob([homeStore.export()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='worldheart-homes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    el('home-import').onchange=async e=>{
      const file=e.target.files[0];if(!file)return;
      const result=file.size>4000000?{ok:false,error:'Home backup exceeds 4 MB.'}:homeStore.import(await file.text());
      if(result.ok&&this.active){
        // Reload an imported active home before autosave can write the old
        // in-memory checkpoint over the backup the player just restored.
        this.dirty=false;this.visit(this.record.id);return;
      }
      this.lastSave=result.ok?'Home backup imported. Revisit from the lobby.':result.error;this.refresh();
    };
    dialog.addEventListener('close',()=>{if(this.suspended){game.paused=this.wasPaused;possession.suspend(false);this.suspended=false;}});
    const tray=document.createElement('div');tray.id='home-placement';tray.className='panel';tray.hidden=true;
    tray.innerHTML='<span></span><button class="btn" id="home-place-here">Place here</button><button class="btn" id="home-cancel-place">Done</button>';ui.root.append(tray);this.tray=tray;
    tray.querySelector('#home-cancel-place').onclick=()=>this.cancelTool();
    tray.querySelector('#home-place-here').onclick=()=>{
      const a=game.mode99?.commander;if(!a)return;
      const d=a.dir.clone().addScaledVector(a.fwd,2.5/CONFIG.planetRadius).normalize();this.place(d,a.height);
    };
    const tap=rig.onTap;rig.onTap=(x,y,button)=>{
      if(!this.tool||!this.record||this.running){tap?.(x,y,button);return;}
      if(button===2){this.cancelTool();return;}
      if(button!==0||possession.active)return;
      // Pick through the same terrain ray used for construction, including sky tops.
      game._hover(x,y);if(game.cursorValid)this.place(game.cursorDir.clone(),game.cursorPos.length()-CONFIG.planetRadius);
    };
    const hud=game._hud.bind(game);game._hud=()=>{hud();if(this.record&&!this.running)this.dirty=true;};
    addEventListener('pagehide',()=>{if(this.record&&!this.running&&this.dirty)this.save();});
  }
  get active(){return !!this.record;}
  get quiet(){return this.active&&!this.running;}
  mountControls(){document.querySelector('#expedition-tools')?.append(this.button);}
  open(){
    if(this.dialog.open)return;this.game.mobile?.closeMenu();this.wasPaused=this.game.paused;this.game.paused=true;this.possession.suspend(true);this.suspended=true;
    this.el('home-name').value=this.record?.name||CONFIG.campaign?.name||`${CONFIG.environment?.name||'My'} home`;
    this.refresh();this.dialog.showModal();
  }
  refresh(){
    const eligible=canClaimHome(this.run.getHeartLevel(),this.run.getPhase(),this.game.terrainBusy);
    this.el('home-status').textContent=this.lastSave||(this.active?`${this.record.name} · Checkpoint: wave ${this.record.checkpoint.run.wavesCleared} cleared. ${this.running?(this.stopRequested?'Returning to peace after this wave.':'Incursions active. Defeat restores the checkpoint.'):'Peaceful. Explore and decorate, or start incursions when ready.'} Home waves earn local gold, cards and weapon drops. Account coins come from expeditions.`:'Fully upgrade the Worldheart to cover the entire planet, then claim it. Claiming disperses the swarm and preserves this world.');
    this.el('home-claim').hidden=this.active;this.el('home-claim').disabled=!eligible;
    this.el('home-save').hidden=this.el('home-incursion').hidden=this.el('home-decor').hidden=!this.active;
    this.el('home-save').disabled=this.running||this.game.terrainBusy;
    this.el('home-decor').disabled=this.running;
    this.el('home-incursion').textContent=this.running?(this.stopRequested?'Stopping after this wave':'Stop after this wave'):'Start incursions';
    this.el('home-incursion').disabled=this.stopRequested||this.game.terrainBusy;
  }
  rename(){const name=this.el('home-name').value.trim();if(this.record&&name){this.record.name=name;this.dirty=true;}}
  async claim(){
    if(this.active||!canClaimHome(this.run.getHeartLevel(),this.run.getPhase(),this.game.terrainBusy))return false;
    const id=await this.capture(this.el('home-name').value.trim());if(!id)return false;
    const chosen=homeStore.choose(id);if(!chosen.ok){this.lastSave=chosen.error;this.refresh();return false;}
    this.visit(id);return true;
  }
  async capture(name=''){
    if(this.capturePending)return this.capturePending;
    this.capturePending=this._capture(name);
    try{return await this.capturePending;}finally{this.capturePending=null;}
  }
  async _capture(name){
    if(this.active||!canClaimHome(this.run.getHeartLevel(),this.run.getPhase(),this.game.terrainBusy)||this.game.state!=='playing'&&this.game.state!=='victory')return null;
    const snap=this.snapshot();if(!snap)return false;
    snap.checkpoint.run.phase='building';snap.checkpoint.run.endless=true;
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(snap.world)));
    const id='home-'+Array.from(new Uint8Array(digest)).slice(0,12).map(n=>n.toString(16).padStart(2,'0')).join('');
    const existing=homeStore.get(id);
    if(existing){
      if(name&&this.createdCapture===id){const saved=homeStore.save({...existing,name,checkpoint:snap.checkpoint});if(!saved.ok){this.lastSave=saved.error;return null;}}
      this.capturedId=id;return id;
    }
    const record={version:HOME_VERSION,id,name:name||`${CONFIG.environment?.name||'Captured planet'} #${CONFIG.seed}`,world:snap.world,checkpoint:snap.checkpoint,decorations:[]};
    record.checkpoint.run.phase='building';record.checkpoint.run.endless=true;
    const saved=homeStore.save(record);if(!saved.ok){this.lastSave=saved.error;this.refresh();return false;}
    this.createdCapture=id;this.capturedId=id;this.ui.toast('Planet captured. Choose it in the lobby Homeworld station.','info');return id;
  }
  visit(id){const url=new URL('./',location.href);url.searchParams.set('map','ninetynine');url.searchParams.set('campaign','0');url.searchParams.set('home',id);location.href=url.href;}
  save(){
    if(!this.active||this.running||this.game.terrainBusy)return false;
    const snapshot=this.snapshot();if(!snapshot){this.lastSave='Finish the attack and let the commander recover before saving.';return false;}
    const candidate={...this.record,checkpoint:snapshot.checkpoint};const saved=homeStore.save(candidate);
    this.lastSave=saved.ok?'Home saved in this browser.':`Save failed: ${saved.error}`;
    if(saved.ok){this.record=candidate;this.dirty=false;}else this.ui.toast(this.lastSave,'warn');return saved.ok;
  }
  start(){
    if(!this.active||this.running||this.game.state!=='playing'||this.game.terrainBusy)return false;
    this.rename();if(!this.save()){this.refresh();return false;}
    this.running=true;this.lastSave='';this.stopRequested=false;this.cancelTool();this.armNext();return true;
  }
  armNext(){
    const waves=this.game.waves;waves.homeWaveLimit=this.run.getWave();waves.endless=true;
    waves.wave=waves.clearedWaves=this.run.getWave()-1;waves.victoryFired=false;
    waves.countdown=10;waves.state='countdown';this.weather.nextEvent=this.weather.clock+this.weather.hostility.interval;
  }
  requestStop(){if(!this.running)return false;this.stopRequested=true;this.lastSave='Finish this wave to save your next peaceful checkpoint.';return true;}
  waveCleared(){if(this.running)this.due=true;}
  update(dt){
    this.button.hidden=this.game.state==='title';
    this.endButton.hidden=!canClaimHome(this.run.getHeartLevel(),this.run.getPhase(),this.game.terrainBusy);
    if(!this.active){
      this.captureClock=(this.captureClock||0)+dt;
      if(!this.capturedId&&this.captureClock>=2){this.captureClock=0;this.capture().catch(error=>{this.lastSave=String(error.message||error);});}
      return;
    }
    if(this.due&&this.run.getPhase()==='building'&&!this.game.terrainBusy){
      this.due=false;this.running=false;this.setPeace();this.dirty=true;
      const restart=!this.stopRequested;if(this.save()&&restart){this.running=true;this.armNext();}
      this.stopRequested=false;this.lastSave='';this.refresh();
    }
    if(this.quiet){this.saveClock+=dt;if(this.saveClock>=5&&this.dirty){this.saveClock=0;this.save();}}
  }
  setPeace(){
    const waves=this.game.waves;waves.state='idle';waves.queues=[];waves.raidQueue=[];waves.pendingSpawns=0;waves.assaultIds.clear();waves.nestSources=[];
    this.game.enemies.clearAll();
    for(const p of this.world.portals){p.active=false;p.group.visible=false;p.established=false;p.destroyed=false;p.guardianPending=false;}
    waves.destroyedNodes?.clear();waves.raiderIds.clear();waves.nestClocks?.clear();
    this.weather.stop();
  }
  defeat(){
    if(!this.active)return false;
    this.running=false;this.game.state='defeat';this.game.paused=true;this.dirty=false;this.possession.exit(true);
    this.ui.toast('Home defended to its checkpoint. Restoring your saved planet...', 'info');
    setTimeout(()=>this.visit(this.record.id),900);return true;
  }
  choose(kind){
    if(!this.quiet)return;this.rename();this.tool=kind;this.game.cancelBuild();this.game.mode99?.orders.clear();
    this.dialog.close();this.tray.hidden=false;this.tray.querySelector('span').textContent=kind==='remove'?'Tap a decoration to remove it.':`Place ${DECORATIONS[kind].name.toLowerCase()}`;
    this.tray.querySelector('#home-place-here').textContent=kind==='remove'?'Remove nearby':'Place here';
  }
  cancelTool(){this.tool=null;this.tray.hidden=true;}
  place(dir,nearHeight=0){
    if(!this.quiet||!this.tool||this.game.paused||this.game.terrainBusy)return false;
    if(this.tool==='remove'){
      let best=-1,distance=3.5;
      this.record.decorations.forEach((d,i)=>{const arc=Math.acos(Math.min(1,new THREE.Vector3(...d.dir).dot(dir)))*CONFIG.planetRadius;if(arc<distance){distance=arc;best=i;}});
      if(best<0)return false;this.record.decorations.splice(best,1);
    }else{
      if(this.record.decorations.length>=500){this.ui.toast('This home holds up to 500 decorations. Remove a piece to place another.','info');return false;}
      const h=supportHeight(dir,nearHeight+.6),height=surfaceElevation(dir,h);
      const p=dir.clone().multiplyScalar(CONFIG.planetRadius+height);
      if(!Number.isFinite(height)||this.world.heart.group.position.distanceTo(p)<2.5||this.game.towerMgr.towers.some(t=>t.pos.distanceTo(p)<2)){
        this.ui.toast('Leave space around the heart and towers.','info');return false;
      }
      this.record.decorations.push({kind:this.tool,dir:dir.toArray(),height,rotation:this.rotation});
    }
    this.dirty=true;this.rebuild();this.save();this.ui.audio?.play('build');return true;
  }
  rebuild(){
    this.group.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});this.group.clear();
    for(const d of this.record.decorations){const root=new THREE.Group(),model=decorationModel(d.kind);model.rotation.y=d.rotation;root.add(model);orientOnSurface(root,new THREE.Vector3(...d.dir).multiplyScalar(CONFIG.planetRadius+d.height));this.group.add(root);}
  }
  reseat(fault){
    if(!this.active)return;
    for(let i=0;i<this.record.decorations.length;i++){
      const item=this.record.decorations[i],dir=new THREE.Vector3(...item.dir);
      if(dir.dot(fault.dir)<fault.limit)continue;
      item.height=surfaceElevation(dir,supportHeight(dir,item.height+.6));
      orientOnSurface(this.group.children[i],dir.multiplyScalar(CONFIG.planetRadius+item.height));
    }
    this.dirty=true;
  }
}
