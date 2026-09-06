// DOM only. The mode injects item rules and commits each transaction.
export class WeaponPanel {
  constructor({ game, possession, ui, api, rules }) {
    Object.assign(this, { game, possession, ui, api, rules });
    this.button = document.createElement('button'); this.button.id = 'btn-inventory';
    this.button.className = 'weapon-open'; this.button.textContent = 'I  Weapons';
    ui.root.append(this.button);
    this.cue = document.createElement('div'); this.cue.className = 'weapon-cue'; ui.root.append(this.cue);
    this.dialog = document.createElement('dialog'); this.dialog.id = 'weapon-dialog';
    this.dialog.setAttribute('aria-label', 'Commander weapons'); document.body.append(this.dialog);
    this.button.onclick = () => this.open();
    this.dialog.addEventListener('cancel', e => { e.preventDefault(); this.close(); });
    this.dialog.addEventListener('click', e => {
      const b = e.target.closest('button[data-action]'); if (!b) return;
      const id = b.dataset.id, action = b.dataset.action;
      if (action === 'close') { this.close(); return; }
      let ok = false;
      if (action === 'select') ok = api.request({kind:'select',slot: ['native','basic'].includes(b.dataset.slot) ? b.dataset.slot : +b.dataset.slot});
      if (action === 'equip') ok = api.request({kind:'equip',id,slot:+b.dataset.slot});
      if (action === 'unequip') ok = api.request({kind:'unequip',slot:+b.dataset.slot});
      if (action === 'infuse') ok = api.infuse(id);
      if (action === 'pickup') ok = api.pickup(id);
      if (action === 'salvage') ok = api.salvage(id);
      if (action === 'replace') ok = api.pickup(id, this.dialog.querySelector(`[data-replace="${id}"]`)?.value);
      this.notice = ok ? (api.inventory.pending ? 'Queued. Resume to finish this attack and apply the change.' : 'Loadout updated.') : 'That change is unavailable. Check capacity, compatibility or the active attack.';
      this.render();
    });
    this.dialog.addEventListener('change', e => {
      if (!e.target.matches('select[data-part]')) return;
      const ok = api.request({kind:'part',id:e.target.dataset.id,slot:e.target.dataset.part,part:e.target.value});
      this.notice = ok ? (api.inventory.pending ? 'Part change queued until this attack finishes.' : 'Part fitted.') : 'Part cannot be fitted.'; this.render();
    });
    addEventListener('keydown', e => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
      if (e.code === 'KeyI') { e.preventDefault(); if (this.dialog.open) this.close(); else this.open(); }
      if (e.code === 'KeyX' && possession.active && !this.dialog.open && api.canInteract()) {
        e.preventDefault(); const slot = api.inventory.active === 0 ? 1 : 0;
        api.request({kind:'select',slot:api.inventory.slots[slot] ? slot : 'native'});
      }
      if (e.code === 'KeyR' && possession.active && !this.dialog.open && api.canInteract()) { e.preventDefault(); const first = api.nearby()[0]; if (first && !api.pickup(first.id)) this.open(); }
    });
  }
  open() {
    if (!this.api.canInteract() || this.dialog.open) return;
    this.wasPaused = this.game.paused; this.game.paused = true; this.possession.suspend(true);
    this.game.cancelBuild(); this.ui.reflectPause?.(); this.notice = '';
    this.render(); this.dialog.showModal(); this.dialog.querySelector('button').focus();
  }
  close() {
    if (!this.dialog.open) return;
    this.dialog.close(); this.game.paused = this.wasPaused; this.possession.suspend(false); this.ui.reflectPause?.();
  }
  render() {
    const expanded = new Set([...this.dialog.querySelectorAll('details[open]')].map(d=>d.dataset.item));
    const inv = this.api.inventory, { name, stats, parts, compatible, trait } = this.rules;
    const equipped = new Set(inv.slots.filter(Boolean)),banked=new Set(this.api.bankedIds?.()||[]);
    const bag = inv.items.filter(x => !equipped.has(x.id));
    const card = (item, ground = false) => {
      const s = stats(item), usable = compatible(item.family);
      const metrics = s ? `${s.dmg.toFixed(0)} impact · ${s.cd.toFixed(2)}s cadence · ${s.radius ? `${s.radius.toFixed(1)} reach / ${s.arcDeg.toFixed(0)}° arc` : s.range ? `${s.range.toFixed(1)} range / ${s.speed.toFixed(0)} speed` : `${s.aoe.toFixed(1)} blast / ${s.speed.toFixed(0)} speed`}` : 'Incompatible with this commander';
      const button = (action, label, extra = '') => `<button data-action="${action}" data-id="${item.id}" ${extra}>${label}</button>`;
      return `<article class="weapon-item rarity-${item.rarity}"><div class="weapon-item-heading"><strong>${name(item)}</strong><span>${item.rarity} · tier ${item.tier}</span></div><p>${metrics}</p><p>${this.api.campaign?(banked.has(item.id)?'Extracted previously; saved version survives defeat.':'Unbanked; extract after victory to keep it.'):''}</p>${!ground&&this.api.campaign?button('infuse',`Infuse to tier ${this.api.planet} (${item.infusions}/3 used)`,item.tier>=this.api.planet||item.infusions>=3?'disabled':''):''}<p class="weapon-parts">${Object.keys(parts).map(k=>parts[k][item.parts[k]].name).join(' / ')}${item.affixes.length ? ' · '+item.affixes.join(', ') : ''}</p>
        ${ground ? `<div class="weapon-actions">${button('pickup','Pick up')}${button('salvage','Salvage drop')}</div>${bag.length >= 12 ? `<label>Replace and salvage a carried item<select data-replace="${item.id}">${bag.map(x=>`<option value="${x.id}">${name(x)} · tier ${x.tier}</option>`).join('')}</select></label>${button('replace','Replace selected')}` : ''}` : `<div class="weapon-actions">${button('equip','Equip 1',`data-slot="0" ${usable?'':'disabled'}`)}${button('equip','Equip 2',`data-slot="1" ${usable?'':'disabled'}`)}${button('salvage','Salvage',equipped.has(item.id)?'disabled':'')}</div><details><summary>Customize parts</summary>${Object.keys(parts).map(slot=>`<label>${slot === 'head' ? 'Head / barrel' : slot === 'grip' ? 'Grip / stock' : 'Power core'}<select data-id="${item.id}" data-part="${slot}">${Object.entries(parts[slot]).filter(([id])=>this.rules.validPart(item.family,slot,id)).map(([id,p])=>`<option value="${id}" ${item.parts[slot]===id?'selected':''}>${p.name}: ${p.note}</option>`).join('')}</select></label>`).join('')}</details>`}</article>`;
    };
    this.dialog.innerHTML = `<header><div><small>COMMANDER LOADOUT</small><h2>Weapons</h2><p>${trait}</p></div><button data-action="close">Resume</button></header>
      <p class="weapon-notice" role="status">${this.notice || 'Solo battle pauses here. Changes during a swing wait until it finishes.'}</p>
      <div class="weapon-actions"><button data-action="select" data-slot="native">Commander technique${inv.active==='native'?' · active':''}</button><button data-action="select" data-slot="basic">Basic sword${inv.active==='basic'?' · active':''}</button></div>
      <h3>Equipment <small>X to switch</small></h3><div class="weapon-equipment">${inv.slots.map((id,i)=>`<section><h4>Slot ${i+1}${inv.active===i?' · active':''}</h4>${id ? `<div class="weapon-actions"><button data-action="select" data-slot="${i}">Use slot ${i+1}</button><button data-action="unequip" data-slot="${i}" ${bag.length>=12?'disabled title="Make space in the backpack first"':''}>Unequip</button></div>${card(inv.items.find(x=>x.id===id))}` : '<p>Empty. Equip a carried weapon below.</p>'}</section>`).join('')}</div>
      <h3>Backpack ${bag.length} / 12 <small>${inv.scrap} salvaged</small></h3>${bag.length ? bag.map(x=>card(x)).join('') : '<p>No carried weapons. Enemy drops have a beam matching their rarity.</p>'}
      <h3>Nearby drops <small>R to pick up</small></h3>${this.api.nearby().map(x=>card(x,true)).join('') || '<p>Move within 2.8 units of a drop to pick it up.</p>'}
      <p class="weapon-footnote">Compatible parts are free to swap in this prototype. ${this.api.campaign?'Three infusions let a favorite weapon catch up to your current planet tier. Extract after victory to bank items and changes; defeat or a mid-assault reload restores the previous checkpoint.':'This single-planet sandbox does not retain weapon loot between runs.'} R pickup and X switch apply while possessing a commander.</p>`;
    for (const d of this.dialog.querySelectorAll('details')) {
      d.dataset.item = d.querySelector('select').dataset.id;
      if (expanded.has(d.dataset.item)) d.open = true;
    }
  }
  update() {
    const near = this.api.nearby(), active = this.api.inventory.current;
    this.button.hidden = !this.api.canInteract();
    this.cue.textContent = near.length ? `${this.possession.active?'R':'I'} · ${this.rules.name(near[0])} · ${near[0].rarity}${this.api.inventory.items.length - this.api.inventory.slots.filter(Boolean).length >= 12 ? ' · Backpack full: I to replace' : ''}` : active ? `${this.rules.name(active)} · ${this.possession.active?'X switch · ':''}I parts` : '';
    this.cue.hidden = !this.api.canInteract() || this.dialog.open || !this.cue.textContent;
  }
}
