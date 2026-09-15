import { generateWeapon, weaponStats, weaponName, PARTS, validPart, WEAPON_MATERIALS, RARITIES } from './run/weapons.js';
import { MANUFACTURERS, MODIFIERS, MAKER_SKILLS } from './run/manufacturers.js';
import { makeRng } from './run/rng.js';
import { weaponCard } from './weapon-card.js';
import { weaponDisplay, disposeWeaponDisplay, weaponThumbnail } from './weapon-display.js';

export function weaponWorkbench(replace){
  const root=document.createElement('section');root.id='weapon-workbench';root.hidden=true;
  document.querySelector('#metrics').after(root);
  root.innerHTML='<h3>Weapon foundry</h3><p class="help">Inspect production models and rolls. Changes here never touch your saved equipment.</p><label>Manufacturer<select id="debug-maker"></select></label><div id="debug-weapon-card"></div><details><summary>Roll and skill options</summary><label>Modifier<select id="debug-modifier"></select></label><label>Roll seed<input id="debug-weapon-seed" type="number" min="0" max="4294967295" step="1" value="12345"></label><button id="debug-weapon-roll">Roll another weapon</button><label>Weapon skill<select id="debug-weapon-skill"></select></label></details><details><summary>Fit parts</summary><label>Head / barrel<select id="debug-weapon-head"></select></label><label>Grip / stock<select id="debug-weapon-grip"></select></label></details>';
  const el=id=>root.querySelector('#'+id),option=(name,value)=>new Option(name,value);
  el('debug-maker').append(...Object.entries(MANUFACTURERS).map(([k,m])=>option(m.name,k)),option('Worldheart original','legacy'));
  el('debug-modifier').append(option('Procedural roll','auto'),...Object.entries(MODIFIERS).map(([k,m])=>option(m.name,k)));
  let selected=null,current=null;
  function rebuild(reset=false){
    if(!selected)return;
    const seed=Number(el('debug-weapon-seed').value);if(!Number.isInteger(seed)||seed<0||seed>0xffffffff){el('debug-weapon-seed').setCustomValidity('Use a whole seed from 0 to 4294967295.');el('debug-weapon-seed').reportValidity();return;}
    el('debug-weapon-seed').setCustomValidity('');
    const maker=el('debug-maker').value,w=selected.weapon;
    for(const part of ['head','grip']){
      const input=el('debug-weapon-'+part),before=input.value;
      input.replaceChildren(...Object.entries(PARTS[part]).filter(([key])=>validPart(w.family,part,key)).map(([key,p])=>option(p.name,key)));
      input.value=reset?'balanced':before||'balanced';if(!input.value)input.value='balanced';
    }
    const skillInput=el('debug-weapon-skill'),skill=skillInput.value;
    skillInput.replaceChildren(option('Procedural skill','auto'),...(MANUFACTURERS[maker]?.skills||[]).map(k=>option(MAKER_SKILLS[k].name,k)));
    skillInput.value=MANUFACTURERS[maker]?.skills.includes(skill)?skill:'auto';skillInput.disabled=maker==='legacy';el('debug-modifier').disabled=maker==='legacy';
    current=generateWeapon({id:`debug-${seed}`,seed,rng:makeRng(seed),family:w.family,manufacturer:maker==='legacy'?null:maker,legacy:maker==='legacy',modifier:el('debug-modifier').value==='auto'?null:el('debug-modifier').value});
    current.era=w.era;current.rarity=RARITIES[WEAPON_MATERIALS.indexOf(w.material)];current.parts={head:el('debug-weapon-head').value,grip:el('debug-weapon-grip').value,core:w.core};
    if(current.make&&skillInput.value!=='auto')current.make.skill=skillInput.value;
    if(selected.customWeapon)disposeWeaponDisplay(selected.customWeapon);
    const owned=weaponDisplay(current);selected.customWeapon=owned;replace(selected,owned);selected.previewItem=current;
    el('debug-weapon-card').innerHTML=weaponCard(current,{stats:weaponStats(current,'commander',true),image:weaponThumbnail(current)});
    document.getElementById('description').textContent=weaponName(current)+'. Manufacturer, fitted parts and skill use the same model and rules as live drops.';
  }
  root.addEventListener('change',()=>rebuild());
  el('debug-weapon-roll').onclick=()=>{el('debug-weapon-seed').value=crypto.getRandomValues(new Uint32Array(1))[0];el('debug-weapon-skill').value='auto';rebuild();};
  return {
    select(item){root.hidden=!item.weapon;document.body.classList.toggle('weapon-inspection',!!item.weapon);selected=item.weapon?item:null;if(selected)rebuild(true);},
    refresh:()=>rebuild(),get item(){return current;},
  };
}
