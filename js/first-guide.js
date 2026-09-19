import {browserStorage} from './storage.js';
import {freshOpening,readOpening,saveOpening,nextLesson,completeLesson,holdsFirstWave} from './run/first-expedition.js';

const lessons={
  select:['Welcome to 99 Planets To Defend','Build Your First Defense','This is a fast-paced Planetary Tower Defense with Survival and Adventure. Select the highlighted tower in your hotbar to build your first defense.'],
  tower:['Build Your First Defense','Place your tower','Place your tower close enough to your base to defend it. Aim at a green footprint, then click or tap Place. WASD moves; the left touch stick moves on mobile.'],
  towerUpgrade:['Build Your First Defense','Upgrade your tower','Great! Look at your tower, press F to interact, then click Upgrade. On touch, tap Interact. A stronger tower will help hold the first wave.'],
  crystal:['Explore Earth','Find a crystal','Now look around the area for blue crystals to help upgrade your base. Walk close to collect one. Use WASD and Space to move and jump, or the touch stick and Jump.'],
  deposit:['Bring it home','Return to your base','Okay, now return to the Worldheart to deposit your crystal. Look at the base and interact, or press C nearby to deposit.'],
  upgrade:['Strengthen the Worldheart','Upgrade your base','Great job! Look at the base and click Upgrade. Upgrades can also use gold, but that leaves less to spend on towers, so choose wisely.'],
};
export function firstGuide({game,ui,waves,mode,possession,allies,nav,config},presentation){
  if(!mode||config.worldgen||config.homeSnapshot||config.homeMissing)return null;
  const forced=new URLSearchParams(location.search).get('onboarding')==='1';
  const saved=readOpening(browserStorage),expedition=mode.campaign?.state?.();
  const state=forced?freshOpening():saved;
  const eligible=forced||state.story||((config.campaign?.index||1)===1&&!expedition?.assault);
  // Returning assaults keep their progress and never acquire a new wave gate.
  if(!eligible)state.skipped=true;
  const guide=document.createElement('aside');guide.className='first-guide';guide.hidden=true;guide.setAttribute('aria-label','Expedition guide');document.body.append(guide);
  const spotlight=document.createElement('div');spotlight.className='first-spotlight';spotlight.hidden=true;spotlight.innerHTML='<i></i><i></i><i></i><i></i><b></b>';document.body.append(spotlight);
  let started=false,card='',context=null,collapsed=false,lastScan=0,dangerUntil=0,wasOutside=false,borrowed=false,lastLandscape=false;
  const release=()=>{if(borrowed){borrowed=false;possession.suspend(false);}document.activeElement?.blur();};
  addEventListener('keydown',e=>{
    if(e.code!=='KeyT'||e.repeat||guide.hidden||!possession.active||document.querySelector('dialog[open]')||e.target?.matches?.('input,textarea,select'))return;
    if(possession.suspended&&!borrowed)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(borrowed)release();else{borrowed=true;possession.suspend(true);guide.querySelector('button')?.focus();}
  },true);
  const save=()=>saveOpening(browserStorage,state);
  const complete=id=>{if(!state.done.includes(id)){completeLesson(state,id);save();}};
  const priority={growth:0,combat:10,skills:12,strategy:18,power:20,weapon:25,boss:30,claim:40};
  const show=(id,title,text)=>{
    if(state.skipped||state.seen.includes(id)||context?.id===id)return;
    if(context&&(priority[context.id]||0)>=(priority[id]||0))return;
    // An unattended tip must never conceal a new wave, reward or boss warning.
    if(context){state.seen.push(context.id);save();}
    context={id,title,text};
  };
  function focus(selector,blur=false){
    const target=selector&&document.querySelector(selector),r=target?.getBoundingClientRect();
    spotlight.hidden=guide.hidden||!r||r.width===0||r.height===0;
    if(spotlight.hidden)return;
    const pad=7,x=Math.max(0,r.x-pad),y=Math.max(0,r.y-pad),w=Math.min(innerWidth-x,r.width+pad*2),h=Math.min(innerHeight-y,r.height+pad*2);
    const rects=[[0,0,innerWidth,y],[0,y,x,h],[x+w,y,innerWidth-x-w,h],[0,y+h,innerWidth,innerHeight-y-h],[x,y,w,h]];
    [...spotlight.children].forEach((el,i)=>{const a=rects[i];el.style.cssText=`left:${a[0]}px;top:${a[1]}px;width:${a[2]}px;height:${a[3]}px`;});
    spotlight.classList.toggle('blur',blur);
  }
  function render(){
    const landscape=game.mobile?.enabled&&innerWidth>innerHeight&&innerHeight<600;
    if(landscape!==lastLandscape){collapsed=landscape;lastLandscape=landscape;card='';}
    const lesson=nextLesson(state),danger=performance.now()<dangerUntil;
    const buildCard=document.querySelector('.build-card:not(.locked):not(.disabled)');
    document.querySelectorAll('.first-tutorial-target').forEach(el=>el.classList.remove('first-tutorial-target'));
    if(lesson==='select'&&!state.skipped)buildCard?.classList.add('first-tutorial-target');
    const key=danger?'outside':context?.id||lesson||'';
    guide.hidden=!key||state.skipped||!['playing','victory'].includes(game.state)||game.paused;
    if(guide.hidden){spotlight.hidden=true;return;}
    if(key!==card){
      card=key;const info=danger?['Field warning','Be careful outside your base','Dying outside the base makes it crumble and ends the attempt. Dying within its range respawns your commander after 30 seconds.']:context?['Field briefing',context.title,context.text]:lessons[lesson];
      guide.innerHTML='<div class="first-progress"></div><h2 role="status" aria-live="polite"></h2><p></p><footer><small class="guide-cursor">T: guide cursor</small><button data-minimize>Minimize</button><button data-skip>Skip guide</button></footer>';
      guide.querySelector('.first-progress').textContent=info[0];guide.querySelector('h2').textContent=info[1];guide.querySelector('p').textContent=info[2];guide.querySelector('p').hidden=collapsed;
      if(lesson==='select'&&!context&&!danger&&game.mobile?.enabled)guide.querySelector('p').textContent='This is a fast-paced Planetary Tower Defense with Survival and Adventure. Tap the highlighted tower card in your action bar.';
      if(lesson==='tower'&&!context&&!danger&&game.mobile?.enabled)guide.querySelector('p').textContent='Place near your base to defend it. Aim at a green footprint, then tap Place. The left stick moves.';
      guide.querySelector('[data-minimize]').textContent=collapsed?'Show details':'Minimize';
      guide.querySelector('[data-skip]').onclick=()=>{state.skipped=true;save();context=null;game.onboardingHold=false;release();render();};
      guide.querySelector('[data-minimize]').onclick=()=>{collapsed=!collapsed;guide.querySelector('p').hidden=collapsed;guide.querySelector('[data-minimize]').textContent=collapsed?'Show details':'Minimize';release();};
      if(context&&!danger){const b=document.createElement('button');b.textContent='Got it';b.onclick=()=>{state.seen.push(context.id);context=null;card='';save();release();render();};guide.querySelector('footer').prepend(b);}
    }
    const target=danger||context?null:lesson==='select'?'.build-card:not(.locked):not(.disabled)':lesson==='towerUpgrade'?'#tp-upgrade':lesson==='upgrade'?'#base-upgrade':lesson==='deposit'?'#base-deposit':null;
    focus(target,lesson==='select'&&!context&&!danger);
  }
  function update(){
    if(!started)return;
    const now=performance.now();if(now-lastScan<100)return;lastScan=now;
    const c=mode.commander,level=mode.run.getHeartLevel(),ledger=mode.crystals.snapshot();
    if(game.buildType||game.towerMgr.towers.length)complete('select');
    if(game.towerMgr.towers.length)complete('tower');
    if(game.towerMgr.towers.some(t=>t.tier>0))complete('towerUpgrade');
    if(ledger.claimed.length)complete('crystal');if(ledger.deposited.length)complete('deposit');
    if(level>0)complete('upgrade');
    game.onboardingHold=eligible&&holdsFirstWave(state)&&waves.wave===0&&level===0;
    const outside=c?.active&&!c.dead&&c.dir.dot(game.frontier.centre)<Math.cos(game.frontier.theta);
    if(outside&&!wasOutside){dangerUntil=now+8000;}else if(!outside)dangerUntil=0;wasOutside=outside;
    const boss=allies.enemies?.active?.some(e=>e.active&&!e.dead&&e.type.boss)||game.enemies.active.some(e=>e.active&&!e.dead&&e.type.boss);
    if(!game.onboardingHold){
      if(level>0)show('growth','Your base grows with you','Awesome! Each base level increases base HP, unlocks further tower upgrades, and raises your commander damage. Your first wave countdown is now running.');
      if(boss)show('boss','A boss approaches','Bosses resist crowd control. A boss reaching your base removes 50% of its maximum HP. Keep it outside, combine tower fire, and use your commander skill (Z) and weapon power (V).');
      if(game.firstBossDefeated)show('claim','Amazing! Claim this planet','Upgrade the base to its maximum to face the planet guardian and claim this world. Once claimed, waves stop. Restart Endless whenever you choose, with checkpoints every 10 waves.');
      if(level>=3)show('strategy','Your base is getting big!','Press Tab to switch between strategy and commander views while inside your base. From above you can select troops, issue orders, and manage towers. On touch use the camera control.');
      if(waves.wave>=2)show('skills','Your commander has two powers','Use Z for your commander skill and V for your weapon power. On touch, tap Skill and Power. Each has a cooldown. Aim or swing with the main attack control.');
      if(mode.run.getPhase()==='drafting')show('power','Choose a powerup','Every other wave, starting with the first, you unlock beneficial rogue-like powerups. Your opponents also evolve as the waves progress.');
      if(game.tutorialWeaponDropped)show('weapon','Your opponent dropped a weapon!','Weapons can be powerful, or salvaged for scraps. Open Weapons (I), salvage unwanted gear, then return to base and open its crafting controls to see the next tower cost.');
      if(waves.wave>=1)show('combat','Destroy the nests','Waves now spawn from nests. Fight alongside your towers and destroy those nests before their creatures overrun your defenses. Click to swing or shoot; hold right mouse to aim.');
    }
    render();
  }
  const originalBegin=ui.beginGame.bind(ui);
  ui.beginGame=()=>{originalBegin();if(game.state!=='playing'||started)return;started=true;
    const c=mode.commander,arrival=game.frontier.centre.clone().addScaledVector(c.fwd,8/config.planetRadius).normalize(),node=nav.nearestWalkableNode(arrival);
    if(node>=0&&Number.isFinite(nav.dist[node])){nav.nodeDir(node,c.dir);c.height=nav.height[node];c.moveNode=node;c._renderDir.copy(c.dir);c.fwd.addScaledVector(c.dir,-c.fwd.dot(c.dir)).normalize();}
    possession.enter(c,{lock:false});possession.boom=possession.boomWant=0;lastScan=-Infinity;update();
  };
  async function arrive(){
    ui.el['title-overlay'].classList.remove('show');
    if(eligible&&!state.story){await presentation.playOpening();await presentation.showStory();state.intro=true;state.story=true;save();}
    ui.beginGame();
  }
  return {state,update,arrive,get holding(){return !!game.onboardingHold;},get lesson(){return nextLesson(state);}};
}
