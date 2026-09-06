// DOM-only campaign receipt and recovery controls. The mode supplies all
// transactions; this view never changes inventory or campaign state directly.
export class CampaignPanel {
  constructor({store,api,ui,game}) {
    Object.assign(this,{store,api,ui,game});
    this.badge=document.createElement('button');this.badge.className='campaign-badge';this.badge.id='campaign-status';ui.root.append(this.badge);
    this.badge.onclick=()=>api.showReceipt();
    this.receipt=document.createElement('section');this.receipt.className='campaign-receipt';this.receipt.id='campaign-receipt';
    ui.el['end-card'].insertBefore(this.receipt,ui.el['end-card'].querySelector('.o-actions'));
    this.arsenal=document.createElement('details');this.arsenal.className='campaign-arsenal';this.receipt.after(this.arsenal);
    this.extract=document.createElement('button');this.extract.id='btn-extract';this.extract.className='btn primary';
    ui.el['end-card'].querySelector('.o-actions').prepend(this.extract);this.extract.onclick=()=>{api.extract();this.update();};
    this.save=document.createElement('section');this.save.className='campaign-save';this.save.id='campaign-save';this.save.setAttribute('aria-label','Save status');ui.root.append(this.save);
    this.save.innerHTML='<p role="status"></p><div class="weapon-actions"><button data-save="retry">Retry save</button><button data-save="export">Export checkpoint</button><button data-save="import">Import checkpoint</button><input type="file" accept="application/json,.json" hidden></div>';
    this.save.querySelector('[data-save="import"]').onclick=()=>this.save.querySelector('input').click();
    this.save.querySelector('[data-save="retry"]').onclick=()=>{store.retry(['corrupt','legacy-corrupt'].includes(store.status().error));this.update();};
    this.save.querySelector('[data-save="export"]').onclick=()=>{
      const url=URL.createObjectURL(new Blob([store.export()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='99-planets-checkpoint.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    this.save.querySelector('input').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(store.import(await file.text()))api.reload();else{ui.toast('Checkpoint was invalid or could not be saved. Current progress is still available for export.','warn');this.update();}};
    for(const button of this.save.querySelectorAll('button'))button.className='btn';
    const title=ui.el['title-overlay'];
    title.classList.add('campaign-title');title.querySelector('.o-mark').textContent='99 PLANETS';
    title.querySelector('.o-sub').textContent='To Defend · Saved campaign';
    document.title='99 Planets To Defend · Campaign preview';
    title.querySelector('.o-body').textContent='Defend the heart and extract your weapons across 99 planets. Purchased base upgrades expand your territory; crystals brought home help pay for them.';
    const alternatives=document.createElement('details');alternatives.className='campaign-worlds';alternatives.innerHTML='<summary>Other modes and sandboxes</summary>';
    const maps=title.querySelector('#map-row');maps.before(alternatives);alternatives.append(maps);
    title.querySelector('.terrain-choice').remove();
    this.intro=document.createElement('p');this.intro.className='campaign-intro';ui.el['title-overlay'].querySelector('.o-actions').before(this.intro);
    this.briefing=document.createElement('details');this.briefing.className='campaign-worlds';this.briefing.innerHTML='<summary>Threat briefing and expedition rules</summary><p class="campaign-intro"></p>';this.intro.after(this.briefing);
    this.reset=document.createElement('dialog');this.reset.className='campaign-reset';document.body.append(this.reset);
    this.reset.innerHTML='<h2>Start a new expedition?</h2><p>Keep account coins and talents. Replace this completed route and its weapon arsenal with a fresh commander loadout. Export the completed checkpoint first if you want to revisit it.</p><div class="weapon-actions"><button class="btn" data-reset="cancel">Keep this expedition</button><button class="btn primary" data-reset="start">Start anew</button></div>';
    ui.onCampaignNew=()=>{ui.rig.keys.clear();ui.rig.cancelFlight();this.reset.showModal();};this.reset.querySelector('[data-reset="cancel"]').onclick=()=>this.reset.close();
    this.reset.querySelector('[data-reset="start"]').onclick=()=>{if(api.restart()){this.reset.close();this.update();}};
    this.update();
  }
  update() {
    const e=this.api.state(),status=this.store.status();if(!e)return;
    const won=e.status==='victory',complete=e.status==='complete',departing=e.status==='ready'&&this.game.state==='playing';
    const current=this.api.destination(e.planet),next=this.api.destination(e.planet+1);
    const terrain={varied:'Highlands',canyon:'Deep canyons',alpine:'Giant peaks',ocean:'Ocean shores'};
    this.badge.textContent=departing?'Checkpoint prepared · Departure pending':`Planet ${e.planet} / ${e.limit} · ${this.api.name}${won?' · Extract':complete?' · Complete':''}`;
    this.badge.hidden=this.game.state==='title';this.badge.disabled=!won&&!complete;
    this.intro.textContent=`Planet ${e.planet} of ${e.limit}: ${current.name}. ${current.region} · ${terrain[current.terrain]} · ${current.era} weapons.`;
    this.briefing.querySelector('p').textContent=`${current.brief} ${current.boss?`Final guardian: ${current.boss.name}. ${bossBrief(current.boss.style)} `:''}Previously extracted weapons are safe. Current assault loot is lost on defeat or refresh; cleared-planet salvage is saved. Reloading an assault starts wave 1 with no duplicate wave coins.`;
    this.ui.el['btn-begin'].textContent=won?'Return to cleared planet':complete?'View expedition receipt':`Defend ${this.api.name}`;
    this.extract.hidden=!won&&!departing;
    this.extract.textContent=departing?'Continue to saved planet':e.planet===e.limit?'Bank weapons and finish':'Bank weapons and travel';
    this.receipt.textContent=won
      ? `${e.assault.victory.inventory.items.length} carried weapons ready to bank. ${e.assault.victory.drops.length} drops remain on this planet. ${e.assault.coins} wave coins already banked. ${e.planet===e.limit?'The expedition ends after extraction.':`Next: ${next.name}, planet ${e.planet+1}. ${terrain[next.terrain]}. ${next.brief}`} Uncollected drops are left behind.`
      : departing ? `The checkpoint is ready for planet ${e.planet}. Continue once it has saved.`
      : complete ? `${e.completed} planets defended. ${e.banked?.items.length||0} weapons banked. Expedition complete.`
      : 'Current assault loot was lost. Previously extracted weapons and earned talent coins remain available for your retry.';
    this.save.classList.toggle('save-failed',!status.saved);
    const messages={unavailable:'Save failed. Keep this page open; export your checkpoint or retry before traveling.',conflict:'Another tab changed the checkpoint. Export this pending progress, then reload the newer save. Travel is paused.',corrupt:'The stored checkpoint is unreadable. Export preserves its original text. Recover saves this new session in its place.', 'legacy-corrupt':'The old profile is unreadable. Export preserves its original text. Recover saves this new session in its place.'};
    this.save.querySelector('p').textContent=status.saved?'Checkpoint saved':messages[status.error]||'Progress is waiting to be saved.';
    const retry=this.save.querySelector('[data-save="retry"]');retry.hidden=status.saved;retry.textContent=['corrupt','legacy-corrupt'].includes(status.error)?'Recover with this session':'Retry save';
    this.extract.disabled=!status.saved;
    this.arsenal.hidden=!complete;
    if(complete){const items=this.api.arsenal();this.arsenal.innerHTML=`<summary>Banked weapons (${items.length})</summary><ul>${items.map(item=>`<li>${item.name} · tier ${item.tier} · ${item.rarity} · ${item.core}</li>`).join('')}</ul>`;}
    uiEnd(this.ui,e);
  }
}
function bossBrief(style){return {sweep:'A wide sweep leaves time to retreat beyond its red arc.',lance:'A narrow, faster strike hits hard; move out to the side.',bastion:'An armored guardian with more health commits to a slow strike.'}[style];}
function uiEnd(ui,e) {
  const departing=e.status==='ready'&&ui.game.state==='playing';
  ui.el['btn-retry'].hidden=e.status==='victory'||e.status==='complete'||departing;
  if(departing)ui.el['btn-continue'].style.display='none';
  ui.el['btn-new'].hidden=e.status!=='complete';ui.el['btn-new'].textContent='New expedition';
  if(e.status==='complete'){
    ui.el['end-mark'].textContent='EXPEDITION COMPLETE';ui.el['btn-continue'].style.display='none';
    ui.el['end-waves'].textContent=String(e.completed*15);
    ui.el['end-kills'].textContent=String(e.receipts.reduce((sum,r)=>sum+r.kills,0));
    ui.el['end-score'].textContent=String(e.receipts.reduce((sum,r)=>sum+r.score,0));
    ui.el['end-body'].textContent='Your defended planets and extracted arsenal are recorded in this checkpoint.';
  }
}
