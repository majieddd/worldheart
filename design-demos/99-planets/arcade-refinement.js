// The existing UI state machine owns all interactions; this adds semantic icons.
try{const response=await fetch('../../lib/99-art/factions/icons.json');if(!response.ok)throw Error('Icon load failed');const icons=await response.json();
 const svg=id=>`<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${icons[id]}</svg>`;
 document.querySelectorAll('.mode-nav button').forEach(b=>b.insertAdjacentHTML('afterbegin',svg({combat:'swords',build:'hammer',loadout:'backpack'}[b.dataset.mode])));
 document.querySelectorAll('.ability').forEach((b,i)=>{const key=b.querySelector('.key'),label=b.textContent.replace(key.textContent,'').trim();b.innerHTML=key.outerHTML+svg(i?'sword':'shield')+`<span class="ability-label">${label}</span>`;});
}catch(e){console.warn('Optional interface icons unavailable:',e.message);}
