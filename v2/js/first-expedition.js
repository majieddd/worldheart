import {browserStorage} from './storage.js';
import {freshOpening,readOpening,saveOpening,nextLesson,completeLesson,holdsFirstWave} from './run/first-expedition.js';

const forced=new URLSearchParams(location.search).get('onboarding')==='1';
const copy=[
  ['01 / The arrival',"Friday April 13, 2029, The Meteor known as Apophis Enters Earth's Geocentric Orbit 10 Times closer than the moon."],
  ['02 / The hidden defense','Since 1959, the worlds strongest militaries built an invisible arsenal for "Planetary Defense" measures in Antarctica.'],
  ['03 / Beyond Earth','And on that very fateful day of arrival, Humanity realized the only way to survive was to grow beyond Earth'],
  ['04 / Your expedition',"You have 99 planets to defend while you discover the secrets of the galaxy and humanity's purpose"],
];
function dialog(cls,label){
  const el=document.createElement('dialog');el.className='first-dialog '+cls;el.setAttribute('aria-label',label);document.body.append(el);
  // Global game/lobby shortcuts must not receive typing, Space or Escape.
  const capture=e=>{if(el.open){e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();el.querySelector('[data-close]')?.click();}}};
  window.addEventListener('keydown',capture,true);window.addEventListener('keyup',capture,true);
  const oldFocus=document.activeElement;
  el.addEventListener('close',()=>{window.removeEventListener('keydown',capture,true);window.removeEventListener('keyup',capture,true);el.remove();oldFocus?.focus?.();},{once:true});
  return el;
}
export async function playOpening({replay=false}={}){
  const state=readOpening(browserStorage);if(state.intro&&!replay&&!forced)return;
  const el=dialog('first-intro','Opening prologue');
  el.innerHTML='<div class="first-type" aria-label="BASED ON A TRUE STORY AND REAL EVENTS."><span aria-hidden="true"></span></div><button class="first-skip" data-close>Skip opening</button>';
  const text='BASED ON A TRUE STORY AND REAL EVENTS.',span=el.querySelector('span');
  let raf=0,start=performance.now(),cinema=false,sceneView=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finish=()=>{cancelAnimationFrame(raf);sceneView?.dispose();state.intro=true;saveOpening(browserStorage,state);el.close();};
  el.querySelector('button').onclick=finish;el.showModal();
  const done=new Promise(resolve=>el.addEventListener('close',resolve,{once:true}));
  const tick=now=>{
    const elapsed=now-start;
    if(!cinema){span.textContent=reduced?text:text.slice(0,Math.floor(elapsed/58));
      if(elapsed>text.length*58+1100){cinema=true;start=now;el.querySelector('.first-type').remove();const scene=document.createElement('div');scene.className='first-cinema';scene.innerHTML='<h1><small>Earth / The arrival</small>Friday the 13th of April 2029</h1>';el.prepend(scene);
        import('./opening-cinema.js').then(({openingCinema})=>{if(el.open){sceneView=openingCinema(scene);sceneView.draw(0);}}).catch(()=>{scene.style.backgroundImage="url('lib/first-expedition/prologue.webp')";scene.style.backgroundSize='cover';});}}
    else if(elapsed>6000){finish();return;}
    if(sceneView&&!reduced)sceneView.draw((now-start)/1000);
    raf=requestAnimationFrame(tick);
  };raf=requestAnimationFrame(tick);await done;
}
export function showStory(){
  const el=dialog('first-story','The story of 99 Planets To Defend');
  el.innerHTML='<div class="first-kicker">99 Planets To Defend / Prologue</div><h1>BASED ON TRUE EVENTS - SOME DETAILS HYPERBOLIZED</h1><div class="first-panels"></div><div class="first-actions"><button class="first-primary" data-close>Begin first defense</button></div><p class="first-note">A fictional adventure inspired by the real Apophis flyby. The hidden arsenal and humanity’s departure belong to our story.</p>';
  for(const [i,[title,text]] of copy.entries()){
    const figure=document.createElement('figure'),art=document.createElement('div'),caption=document.createElement('figcaption'),b=document.createElement('b');
    art.className='first-art';art.style.backgroundPosition=`${i*100/3}% center`;art.setAttribute('role','img');art.setAttribute('aria-label',['Apophis approaching Earth','A concealed Antarctic defense installation','Humanity preparing to leave Earth','A commander defending a Worldheart among distant planets'][i]);
    b.textContent=title;caption.append(b,document.createTextNode(text));figure.append(art,caption);el.querySelector('.first-panels').append(figure);
  }
  const done=new Promise(resolve=>el.addEventListener('close',resolve,{once:true}));
  el.querySelector('button').onclick=()=>el.close();el.showModal();return done;
}

const lessons={
  move:['Meet your commander','Move a few steps. Your commander explores, fights and carries crystals back to the Worldheart.','W A S D to move. Hold right mouse to look. On touch, use the left stick and drag the view. Nests wait while you learn movement, attacking and building.'],
  attack:['Try your weapon','Swing or fire once. Each weapon has its own rhythm and reach.','Click the game view to attack. On touch, use the large attack button.'],
  tower:['Build your first defense','Choose an available tower from the build bar. Place it on a valid green footprint near your Worldheart.','Press Esc to release your commander for a wider building view, or use the touch camera control. Towers need a clear route for enemies and enough gold.'],
  crystal:['Venture, then return','Find a blue crystal and walk close to collect it. Your commander carries up to three.','Waves now approach from nests. Destroy nests to reduce enemy buildup. Falling outside your base ends the attempt; inside, you return after 30 seconds.'],
  deposit:['Bring it home','Return to the glowing Worldheart. Press C or tap Deposit to bank your crystals.','Crystals become base-upgrade credit. Equipment is collected nearby and goes into your inventory.'],
  upgrade:['Strengthen the Worldheart','Press B or use the base upgrade control to raise its level. Crystals pay first; gold covers the rest.','Base levels expand your safe area, improve your commander and weapons, and unlock stronger tower upgrades.'],
};
export function installFirstExpedition({game,ui,waves,mode,possession,allies,nav,config}){
  if(!mode||config.worldgen||config.homeSnapshot||config.homeMissing)return null;
  const expedition=mode.campaign?.state?.();
  const state=forced?freshOpening():readOpening(browserStorage);
  // Existing expeditions beyond the opening never acquire a beginner wave gate.
  const eligible=forced||state.story||((config.campaign?.index||1)===1&&!expedition?.assault);
  if(!eligible)return null;
  const guide=document.createElement('aside');guide.className='first-guide';guide.hidden=true;guide.setAttribute('aria-label','Expedition guide');document.body.append(guide);
  let started=false,lastDir=null,distance=0,card='',context=null,collapsed=false;
  const save=()=>saveOpening(browserStorage,state);
  const complete=id=>{if(state.done.includes(id))return;completeLesson(state,id);save();};
  const originalSwing=possession.swingStarted;
  possession.swingStarted=function(unit){originalSwing.call(this,unit);if(started&&unit===mode.commander)complete('attack');};
  const showContext=(id,title,text)=>{if(state.skipped||state.seen.includes(id)||context)return;context={id,title,text};};
  const render=()=>{
    const lesson=nextLesson(state),key=context?.id||lesson||'';
    if(!key){guide.hidden=true;game.onboardingHold=false;return;}
    guide.hidden=!['playing','victory'].includes(game.state)||(game.paused&&mode.run.getPhase()!=='victory');if(key===card)return;card=key;
    const info=context?[context.title,context.text,'']:lessons[lesson];
    guide.innerHTML='<div class="first-progress"></div><h2 role="status" aria-live="polite"></h2><p></p><details><summary>Controls & tips</summary><p></p></details><footer><button data-minimize>Minimize</button><button data-skip>Skip guide</button></footer>';
    guide.querySelector('.first-progress').textContent=context?'Field briefing':`First defense / ${state.done.length} of 6 learned`;
    guide.querySelector('h2').textContent=info[0];guide.querySelector('p').textContent=info[1];guide.querySelector('details p').textContent=info[2];guide.querySelector('details').hidden=!info[2];
    guide.querySelector('[data-skip]').onclick=()=>{state.skipped=true;save();context=null;card='';game.onboardingHold=false;render();};
    guide.querySelector('[data-minimize]').onclick=()=>{collapsed=!collapsed;guide.querySelector('p').hidden=collapsed;guide.querySelector('details').hidden=collapsed||!info[2];guide.querySelector('[data-minimize]').textContent=collapsed?'Expand':'Minimize';};
    if(context){const b=document.createElement('button');b.textContent='Got it';b.onclick=()=>{state.seen.push(context.id);context=null;card='';save();render();};guide.querySelector('footer').prepend(b);}
  };
  const update=()=>{
    if(!started||!['playing','victory'].includes(game.state))return;
    const c=mode.commander;
    if(c?.active&&!c.dead){if(lastDir&&possession.unit===c)distance+=Math.acos(Math.max(-1,Math.min(1,c.dir.dot(lastDir))))*config.planetRadius;lastDir=c.dir.clone();if(distance>2.5)complete('move');}
    if(game.towerMgr.towers.length)complete('tower');
    const ledger=mode.crystals.snapshot();if(ledger.claimed.length)complete('crystal');if(ledger.deposited.length)complete('deposit');if(mode.run.getHeartLevel()>0)complete('upgrade');
    game.onboardingHold=holdsFirstWave(state)&&waves.wave===0;
    if(!game.onboardingHold){
      if(mode.run.hasConquered())showContext('home','A world of your own','This planet is yours. Waves stop; return through Homeworld in the lobby. Restart endless whenever you want, with checkpoints every 10 waves and no gear loss at home. Home loot is capped at rare.');
      else if(mode.run.getConquestWave())showContext('conquest','The planet fights back','Your base spans the planet. The next wave is its strongest boss, with summoned minions. Defeat it to claim this world and stop the incursions.');
      else if(mode.run.getPhase()==='victory')showContext('endless','Your first defense is complete','Extract with your rewards, or choose Endless on the results screen. Keep expanding the Worldheart to trigger the planet boss and claim this place as a homeworld.');
      else if(waves.wave>0&&waves.wave%10===0)showContext('boss','A boss approaches','The tenth wave brings a heavily armored boss and escorts. Watch its strike warnings, keep moving and combine your tower coverage with commander abilities.');
      else if(allies.active.some(a=>a!==c&&a.active&&!a.dead))showContext('troops','You have reinforcements','Switch to the building view, select a friendly troop, then issue a move or patrol order. Its dotted route shows where it will go. Barracks supply troops.');
      else if(waves.wave>=1)showContext('skills','Two powers, one defender','Your commander and weapon each have a special ability. Use Z for commander skill and V for weapon power, or tap Skill and Power on touch. Each has a cooldown.');
    }
    render();
  };
  const originalBegin=ui.beginGame.bind(ui);
  ui.beginGame=()=>{originalBegin();if(game.state==='playing'&&!started){
    started=true;
    // Keep the first third-person camera out of the crystal's opaque core.
    const c=mode.commander;
    if(!state.done.includes('move')){
      const arrival=game.frontier.centre.clone().addScaledVector(c.fwd,8/config.planetRadius).normalize(),node=nav.nearestWalkableNode(arrival);
      if(node>=0&&Number.isFinite(nav.dist[node])){const safe=nav.nodeDir(node,c.dir.clone());if(safe.dot(game.frontier.centre)>=Math.cos(game.frontier.theta*.9)){c.dir.copy(safe);c.height=nav.height[node];c.moveNode=node;c.renderDir?.copy(c.dir);c.fwd.addScaledVector(c.dir,-c.fwd.dot(c.dir)).normalize();}}
    }
    possession.enter(c,{lock:false});possession.boom=possession.boomWant=4;update();
  }};
  async function arrive(){
    if(!state.story){ui.el['title-overlay'].classList.remove('show');await playOpening();await showStory();state.intro=true;state.story=true;save();ui.beginGame();}
  }
  return {state,update,arrive,get holding(){return !!game.onboardingHold;},get lesson(){return nextLesson(state);}};
}
