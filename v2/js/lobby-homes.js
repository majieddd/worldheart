import { homeStore } from './modes/home-store.js';
import { PLANET_THEMES } from './run/planet-environments.js';
import { TERRAIN_PACKS } from './run/world-catalogue.js';

// Separate from the expedition launch form. Selecting a home never resets a
// campaign or erases the previously selected world's checkpoint/decorations.
export function homeworldStation(content,message,refresh){
  const catalogue=homeStore.list();content.replaceChildren();
  const add=(tag,text,parent=content)=>{const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;};
  const section=add('section','');section.className='home-lobby';
  add('p','Your own corner of the galaxy. Visit a captured planet to build, decorate or start an incursion.',section);
  if(!catalogue.ok)add('p',catalogue.error,section);
  const selected=catalogue.homes.find(h=>h.id===catalogue.selected);
  if(selected){
    const featured=add('div','',section);featured.className='home-featured';
    add('small','CURRENT HOMEWORLD',featured);add('h3',selected.name,featured);
    const a=add('a','Go to Homeworld',featured);a.className='primary home-visit';a.href=`./?map=ninetynine&campaign=0&home=${encodeURIComponent(selected.id)}`;
  }else{
    const empty=add('div','',section);empty.className='home-featured';
    add('h3','A planet to call home',empty);
    add('p','Expand your Worldheart until its base covers a whole planet. It will appear here automatically, even if you continue the expedition.',empty);
  }
  add('h3',`Captured planets · ${catalogue.homes.length} / 99`,section);
  for(const home of catalogue.homes){
    const card=add('article','',section);card.className='home-choice';card.dataset.home=home.id;
    add('strong',home.name,card);
    add('p',`${PLANET_THEMES[home.world.environment.theme]?.name||home.world.environment.theme} · ${TERRAIN_PACKS[home.world.terrain]?.name||home.world.terrain}`,card);
    add('p',`Wave ${home.checkpoint.run.wavesCleared} checkpoint · ${home.decorations.length} decorations · ${home.checkpoint.towers.length} towers`,card);
    const b=add('button',home.id===catalogue.selected?'Current Homeworld':'Make Homeworld',card);b.type='button';b.dataset.chooseHome=home.id;b.setAttribute('aria-pressed',String(home.id===catalogue.selected));
    b.onclick=()=>{const result=homeStore.choose(home.id);if(result.ok){refresh();message.textContent=`${home.name} is your Homeworld. Your other planets are preserved.`;content.querySelector(`[data-choose-home="${home.id}"]`)?.focus();}else message.textContent=result.error;};
  }
  const details=add('details','',section);add('summary','Saves and backups',details);
  add('p','Homes are saved in this browser. Import a backup from another device to use it here.',details);
  const exportButton=add('button','Export home planets',details);exportButton.disabled=!catalogue.homes.length;
  exportButton.onclick=()=>{const url=URL.createObjectURL(new Blob([homeStore.export()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='worldheart-homes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const label=add('label','Import home backup ',details),input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.id='lobby-home-import';label.append(input);
  input.onchange=async()=>{const file=input.files[0];if(!file)return;const result=file.size>4000000?{ok:false,error:'Home backup exceeds 4 MB.'}:homeStore.import(await file.text());if(result.ok){refresh();message.textContent='Home planets imported.';}else message.textContent=result.error;};
}
