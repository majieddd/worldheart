import {homeStore} from './modes/home-store.js';
import {campaignStore} from './modes/campaign-store.js';
import {forgeWeapon,WEAPON_ROLL_COST} from './run/weapon-forge.js';
import {weaponName,weaponStats,FAMILIES} from './run/weapons.js';
import {weaponCard} from './weapon-card.js';
import {weaponThumbnail} from './weapon-display.js';

export function weaponStation(content,message,{sourceKey=null,result=null}={}){
 const homes=homeStore.list(),expedition=campaignStore.snapshot().expedition,sources=homes.homes.map(h=>({key:h.id,name:h.name+' home pack',commander:h.checkpoint.commander,inventory:h.checkpoint.inventory,cap:'rare',home:h}));
 if(expedition?.banked&&['ready','defeat','complete'].includes(expedition.status))sources.push({key:'expedition',name:'Expedition pack',commander:expedition.commander,inventory:expedition.banked,cap:'relic',expedition});
 const source=sources.find(s=>s.key===sourceKey)||sources.find(s=>s.key===homes.selected)||sources[0];
 content.replaceChildren();
 const add=(tag,text,parent=content)=>{const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;};
 add('p','Roll with scrap, or merge three weapons of the same family. Your result goes directly into the selected saved pack.');
 if(!source){add('p','No saved inventory is available. Return from a planet to bank your weapons.');return;}
 const label=add('label','Saved pack '),select=add('select','',label);select.id='roller-pack';
 for(const s of sources){const option=add('option',s.name,select);option.value=s.key;option.selected=s.key===source.key;}
 select.onchange=()=>weaponStation(content,message,{sourceKey:select.value});
 add('p',`${source.inventory.scrap} scrap · Rarity limit: ${source.cap} · Equipped weapons are protected.`).className='roller-balance';
 if(expedition?.status==='assault'||expedition?.status==='victory')add('small','Finish and extract the expedition before editing its pack here. Home packs remain available.');
 const signature=JSON.stringify(source.inventory);
 function action(operation){
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];let state=seed;const rng=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const forged=forgeWeapon(source.commander,source.inventory,operation,{id:'forge-'+crypto.randomUUID(),seed,rng,maxRarity:source.cap,tier:source.expedition?.planet||source.home?.world.planetIndex||1});
  if(!forged.ok){message.textContent=forged.reason;return;}
  let saved;
  if(source.home){
   const fresh=homeStore.get(source.key);
   if(!fresh||JSON.stringify(fresh.checkpoint.inventory)!==signature){message.textContent='This pack changed in another tab. Reopen the roller to refresh it.';return;}
   fresh.checkpoint.inventory=forged.inventory;
   if(fresh.defenseCheckpoint)fresh.defenseCheckpoint.inventory=JSON.parse(JSON.stringify(forged.inventory));
   saved=homeStore.save(fresh);
  }else{
   saved=campaignStore.commit(s=>{const e=s.expedition;if(e?.id!==source.expedition.id||!['ready','defeat','complete'].includes(e.status)||JSON.stringify(e.banked)!==signature)return false;e.banked=forged.inventory;return true;});
   if(saved.saved===false)saved={ok:false,error:'The pack could not be saved. Keep this tab open and retry saving before leaving.'};
  }
  if(!saved.ok){message.textContent=saved.error||'The pack changed. Reopen the roller before trying again.';return;}
  weaponStation(content,message,{sourceKey:source.key,result:forged.item});message.textContent=forged.message;
 }
 const roll=add('button',`🎲 Roll weapon · ${WEAPON_ROLL_COST} scrap`);roll.className='primary';roll.id='roll-weapon';roll.disabled=source.inventory.scrap<WEAPON_ROLL_COST;roll.onclick=()=>action({kind:'roll'});
 if(result){const show=add('div','');show.id='roller-result';show.innerHTML=weaponCard(result,{stats:weaponStats(result,source.commander,true),image:weaponThumbnail(result)});}
 add('h3','Merge three → one stronger weapon');add('p','Choose three of one family. The strongest weapon keeps its parts and gains one rarity.');
 const chosen=new Set(),merge=add('button','Merge selected · 0 / 3');merge.id='merge-weapons';merge.disabled=true;
 const list=add('div','');list.className='roller-items';
 for(const item of source.inventory.items){
  const row=add('div','',list);row.className='roller-item';
  const pick=add('label','',row),check=add('input','',pick);check.type='checkbox';check.value=item.id;check.disabled=source.inventory.slots.includes(item.id);
  add('span',`${weaponName(item)}${check.disabled?' · equipped':''}`,pick);
  const detail=add('small',`${FAMILIES[item.family].name} · ${item.rarity}`,row);detail.className='roller-kind';
  check.onchange=()=>{if(check.checked)chosen.add(item.id);else chosen.delete(item.id);merge.textContent=`Merge selected · ${chosen.size} / 3`;merge.disabled=chosen.size!==3;};
  const salvage=add('button','Salvage · +1 scrap',row);salvage.disabled=check.disabled;salvage.onclick=()=>action({kind:'salvage',id:item.id});
 }
 merge.onclick=()=>action({kind:'merge',ids:[...chosen]});
 if(!source.inventory.items.length)add('p','No weapons in this pack yet. Explore a homeworld, open chests, or defeat enemies to collect them.',list);
}
