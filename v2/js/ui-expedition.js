import { COMMANDERS, commanderStats, MOUNTS } from './run/expedition.js';

export function expeditionControls({ui,game,api,lockedCommander}){
  const title=ui.el['title-overlay'],choice=document.createElement('label');choice.className='terrain-choice';
  const key=api.commander().typeKey;
  choice.innerHTML=`Commander <select id="starting-commander">${Object.entries(COMMANDERS).map(([k,c])=>`<option value="${k}" ${k===key?'selected':''}>${c.name} · ${c.role}</option>`).join('')}</select><span id="commander-stats"></span>`;
  const stats=commanderStats(key);choice.querySelector('span').textContent=`${stats.health} health · ${stats.power.toFixed(2)}x power · ${stats.speed.toFixed(2)}x speed${lockedCommander?' · Current expedition commander':''}`;
  const select=choice.querySelector('select');select.disabled=!!lockedCommander;
  select.onchange=()=>{const url=new URL(location.href);url.searchParams.set('commander',select.value);location.href=url.href;};
  title.querySelector('.o-actions').before(choice);
  const lobby=document.createElement('a');lobby.className='btn';lobby.textContent='Preparation lobby';lobby.href=location.protocol==='file:'||location.pathname.includes('/dist/')?'https://majieddd.github.io/worldheart/v2/lobby.html':'lobby.html';title.querySelector('.o-actions').append(lobby);
  const endLobby=lobby.cloneNode(true);ui.el['end-card'].querySelector('.o-actions').append(endLobby);
  const endless=document.createElement('button');endless.id='btn-endless';endless.className='btn primary';endless.textContent='Continue in Endless';endless.hidden=true;
  ui.el['end-card'].querySelector('.o-actions').prepend(endless);endless.onclick=()=>api.startEndless();
  const dock=document.createElement('details');dock.className='expedition-tools panel';dock.id='expedition-tools';
  dock.innerHTML='<summary>Expedition kit <span id="kit-summary"></span></summary><p id="expedition-life" role="status"></p><p id="expedition-weather" role="status"></p><button class="btn" id="mount-toggle">M · Mount</button><p id="mount-info"></p><button class="btn" id="craft-tower">T · Forge tower (3 scraps)</button><p>Salvage unwanted weapons in your inventory (I) for scraps. Forge costs rise by 2 each time. Forge within 6m of the heart; the next matching tower is free.</p><p>First person: hold right mouse to aim. Z uses your commander ability; V uses your weapon ability.</p><button class="btn" id="endless-extract" hidden>End Endless and collect loot</button>';
  ui.root.querySelector('.hud-top-left').append(dock);const el=id=>dock.querySelector('#'+id);
  el('mount-toggle').onclick=()=>api.mounts.toggle();el('craft-tower').onclick=()=>api.craft();el('endless-extract').onclick=()=>api.finishEndless();
  const frame=document.createElement('div');frame.id='commander-frame';frame.className='commander-frame panel';
  frame.innerHTML='<button class="commander-focus" id="focus-commander" title="Focus and control your commander"><strong></strong><span></span><meter min="0" max="1" value="1" aria-label="Commander health"></meter></button><div class="ability-actions"><button id="commander-ability" class="btn"></button><button id="weapon-ability" class="btn"></button></div>';
  ui.root.querySelector('.hud-top-left').prepend(frame);
  frame.querySelector('#focus-commander').onclick=()=>api.focusCommander();
  for(const which of ['commander','weapon'])frame.querySelector('#'+which+'-ability').onclick=()=>api.abilities.activate(which);
  addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||game.state!=='playing'||game.paused||e.target?.matches?.('input,textarea,select,button')||document.querySelector('dialog[open]'))return;
    if(e.code==='KeyM'){e.preventDefault();api.mounts.toggle();}if(e.code==='KeyT'){e.preventDefault();api.craft();}
    if(e.code==='KeyZ'||e.code==='KeyV'){e.preventDefault();api.abilities.activate(e.code==='KeyZ'?'commander':'weapon');}});
  let last='';
  return {update(){
    dock.hidden=frame.hidden=game.state==='title';const a=api.commander(),m=MOUNTS[a.mountKey||'none'],remaining=api.respawn.remaining,weather=api.weather?.label||'Weather calm';
    const skills=['commander','weapon'].map(which=>api.abilities.describe(which)),touch=!!game.mobile?.enabled;
    const state=[touch,api.forge.balance,api.forge.cost,Math.ceil(a.hp),a.hpMax,a.typeKey,...skills.flatMap(s=>[s.key,Math.ceil(s.remaining)]),Math.ceil(remaining),a.active,m?.name,Math.ceil(api.mounts.energy),api.run.isEndless(),api.run.getPhase(),weather].join('|');
    endless.hidden=api.run.getPhase()!=='victory'||api.run.isEndless();
    if(state===last)return;last=state;
    frame.querySelector('strong').textContent=COMMANDERS[a.typeKey].name;
    frame.querySelector('.commander-focus span').textContent=remaining>0?`Returns in ${Math.ceil(remaining)}s`:`${Math.ceil(Math.max(0,a.hp))} / ${a.hpMax} HP · Focus`;
    frame.querySelector('meter').value=Math.max(0,a.hp/a.hpMax);
    skills.forEach((s,i)=>{const b=frame.querySelector(i?'#weapon-ability':'#commander-ability');b.textContent=`${i?'V':'Z'} · ${s.name}${s.remaining>0?' · '+Math.ceil(s.remaining)+'s':''}`;b.title=s.description;b.disabled=s.remaining>0||!a.active||a.dead;});
    el('kit-summary').textContent=` · ${api.forge.balance} scraps${remaining>0?' · '+Math.ceil(remaining)+'s respawn':''}`;
    el('expedition-life').textContent=remaining>0?`Commander returns in ${Math.ceil(remaining)}s. Defend the heart while they recover.`:'Death inside the base: 30s recovery. Death outside: defeat.';
    el('expedition-weather').textContent=weather;
    el('mount-toggle').textContent=(touch?'':'M · ')+(a.mountKey&&a.mountKey!=='none'?'Dismount':`Ride ${MOUNTS[api.mounts.choice].name}`);
    el('mount-toggle').disabled=!a.active||a.dead;
    el('mount-info').textContent=a.mountKey==='skyray'?`${Math.ceil(api.mounts.energy)} / 12s flight. Hold ${touch?'Rise':'Space'} to rise; release to land.`:m.description;
    el('craft-tower').textContent=`${touch?'':'T · '}Forge tower (${api.forge.cost} scraps)`;
    const notes=dock.querySelectorAll('p:not([id])');notes[0].textContent=`Salvage unwanted weapons in ${touch?'Menu > Weapons':'your inventory (I)'} for scraps. Forge costs rise by 2 each time. Forge within 6m of the heart; the next matching tower is free.`;
    notes[1].textContent=touch?'First person: tap Aim to zoom in. Skill uses your commander ability; Power uses your weapon ability.':'First person: hold right mouse to aim. Z uses your commander ability; V uses your weapon ability.';
    el('craft-tower').disabled=api.forge.balance<api.forge.cost;
    el('endless-extract').hidden=!api.run.isEndless()||api.run.getPhase()!=='building';
  }};
}
