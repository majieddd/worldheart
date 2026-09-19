import {browserStorage} from './storage.js';
import {readOpening,saveOpening} from './run/first-expedition.js';
import {firstGuide} from './first-guide.js';

const forced=new URLSearchParams(location.search).get('onboarding')==='1';
const copy=[
  ['01 / The arrival',"It was Friday April 13, 2029... The Meteor named after a god of death entered Earth's orbit 10 times closer than the moon..."],
  ['02 / The revelation','And on that very fateful morning, a scheduled fly by turned into an Alien drive by as the meteor changed course straight for earth and revealed the true nature of the meteor.'],
  ['03 / Planetary defense','Luckily, since 1959, Nations of the world have been prepared "Planetary Defense" measures deep in Antarctica for emergencies like this...'],
  ['04 / Answer the call',"Answer the call to defend Civilization, Investigate the mysterious Xeno origins, and discover humanity's true purpose in the galaxy"],
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
    art.className='first-art';art.style.backgroundImage=`url('lib/first-expedition/panel-${i+1}-v3.webp')`;art.setAttribute('role','img');art.setAttribute('aria-label',['Earth and the approaching meteor','A town square looks up at Xeno revealed inside a fractured meteor','International defenders mobilize in Antarctica','A commander, crystal base and bolt tower defending a beautiful Earth horizon'][i]);
    b.textContent=title;caption.append(b,document.createTextNode(text));figure.append(art,caption);el.querySelector('.first-panels').append(figure);
  }
  const done=new Promise(resolve=>el.addEventListener('close',resolve,{once:true}));
  el.querySelector('button').onclick=()=>el.close();el.showModal();return done;
}


export function installFirstExpedition(dependencies){return firstGuide(dependencies,{playOpening,showStory});}
