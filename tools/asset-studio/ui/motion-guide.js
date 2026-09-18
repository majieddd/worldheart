const clips={combined:'Walk + Strike (earlier guide)',idle:'Idle',walk:'Walk',run:'Run',strike:'Punch',jump:'Jump',wave:'Wave',death:'Defeat',sword:'Sword strike',rifle:'Rifle fire'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class MotionGuide {
  constructor(parent,{api,safe,refresh,preview}) {
    Object.assign(this,{api,safe,refresh,preview});this.selected='combined';
    this.panel=document.createElement('details');this.panel.className='notes';this.panel.id='motion-video-guide';
    this.panel.innerHTML=`<summary>Animation videos &amp; local conversion</summary>
      <p>One video per animation. Use the same approved character for every clip. MiniMax generation uses your cloud account; tracking, rigging and retargeting run locally.</p>
      <label>Animation <select data-clip>${Object.entries(clips).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
      <p data-coverage class="hint"></p><a data-brief download>Download this animation brief</a>
      <label>Video model <select data-model><option>MiniMax-H3</option><option>MiniMax-H3-Max</option><option>Other / imported</option></select></label>
      <label class="upload-button">Import this animation (MP4)<input data-import type="file" accept="video/mp4"></label>
      <p data-status role="status"></p><video controls playsinline preload="metadata" style="width:100%;max-height:480px" hidden></video>
      <label>Playback <select data-speed><option value="1">Normal speed</option><option value="0.5">Half speed</option><option value="0.25">Quarter speed</option></select></label>
      <a data-sheet target="_blank" rel="noopener">Open timestamped frame sheet</a>
      <fieldset data-review><legend>Watch the complete clip before accepting</legend>
      <label><input type="checkbox" data-check="identity"> Same character, costume and anatomy throughout</label>
      <label><input type="checkbox" data-check="camera"> Fixed camera, complete body and feet visible</label>
      <label><input type="checkbox" data-check="feet"> Believable contact and weight transfer</label>
      <label><input type="checkbox" data-check="timing"> Selected action, timing and recovery read clearly</label>
      <label>Motion notes<textarea data-notes rows="2"></textarea></label>
      <button data-decision="accept">Accept as reference</button> <button data-decision="reject">Needs revision</button></fieldset>
      <fieldset data-convert><legend>Convert this video locally</legend>
      <label>Start (seconds) <input data-start type="number" min="0" step="0.05" value="0"></label>
      <label>End (seconds) <input data-end type="number" min="1" step="0.05"></label>
      <button data-run>Track, rig &amp; create animation</button>
      <p class="hint">Creates a separate candidate. Reuses the current fitted rig or fits one with MIA. Body tracking cannot reliably recover hidden limbs or finger grips. Failed checks block applying a candidate; existing animation stays saved.</p></fieldset>
      <div data-candidates></div><button data-return>Return to current model</button><button data-diagnose>Explain the current issue locally</button><p data-advice class="hint" role="status">Experimental Laya advice; it cannot approve quality or change the model.</p>`;
    parent.querySelector('.review').after(this.panel);this.q=s=>this.panel.querySelector(s);
    this.q('[data-clip]').onchange=e=>{this.selected=e.target.value;this.update(this.project,this.view);};
    this.q('[data-return]').onclick=()=>refresh(this.project);
    this.q('[data-diagnose]').onclick=()=>safe(async()=>{this.q('[data-diagnose]').disabled=true;this.q('[data-advice]').textContent='Loading the local advisor. The first request can take about a minute.';try{const r=await api(`projects/${this.project.id}/diagnostic-advice`,'POST',{});this.q('[data-advice]').textContent=`${r.engine}: ${r.explanation}. ${r.seconds.toFixed(2)} s. Advice only; no repair or approval was applied.`;}finally{this.q('[data-diagnose]').disabled=false;}});
    this.q('[data-import]').onchange=e=>safe(async()=>{const file=e.target.files[0];if(!file)return;const form=new FormData();form.append('file',file);refresh(await api(`projects/${this.project.id}/motion-guide?clip=${this.selected}&model=${encodeURIComponent(this.q('[data-model]').value)}`,'POST',form));e.target.value='';});
    this.q('[data-speed]').onchange=e=>{this.q('video').playbackRate=+e.target.value;};
    this.panel.querySelectorAll('[data-decision]').forEach(b=>b.onclick=()=>safe(async()=>{const checks=Object.fromEntries([...this.panel.querySelectorAll('[data-check]')].map(c=>[c.dataset.check,c.checked]));refresh(await api(`projects/${this.project.id}/motion-guide/review?clip=${this.selected}`,'POST',{decision:b.dataset.decision,checks,notes:this.q('[data-notes]').value}));}));
    this.q('[data-run]').onclick=()=>safe(async()=>refresh(await api(`projects/${this.project.id}/video-motion`,'POST',{clip:this.selected,start:+this.q('[data-start]').value,end:+this.q('[data-end]').value})));
    this.q('[data-candidates]').onclick=e=>safe(async()=>{const b=e.target.closest('button');if(!b)return;const c=this.project.videoConversions.find(c=>c.id===b.dataset.id);if(b.dataset.action==='preview')await preview(c.file,c.label+' / video');else {if(!this.q(`[data-confirm="${c.id}"]`).checked)throw Error('Confirm full animation review first.');refresh(await api(`projects/${this.project.id}/video-motion/${c.id}/use`,'POST',{visualReviewConfirmed:true}));}});
  }
  update(project,view) {
    this.project=project;this.view=view;const guide=project.motionGuides?.[this.selected]||(this.selected===(project.motionGuide?.clip||'combined')?project.motionGuide:null),visible=!!project.art&&['art','animation'].includes(view),busy=['running','queued'].includes(project.status);
    this.panel.hidden=!visible;if(!visible)this.q('video').pause();
    this.q('[data-brief]').href=`/api/projects/${project.id}/motion-guide/brief?clip=${this.selected}`;this.q('[data-import]').disabled=busy;
    const url=name=>`/files/projects/${project.id}/${name.split('/').map(encodeURIComponent).join('/')}`;
    this.q('[data-coverage]').textContent=Object.keys(clips).filter(k=>k!=='combined').map(k=>`${clips[k]}: ${project.motionGuides?.[k]?'video saved':'awaiting video'}`).join(' · ');
    this.q('[data-status]').textContent=guide?`${guide.model} / ${guide.metadata.duration.toFixed(2)} s / ${guide.status}`:'No video for this animation yet.';
    for(const selector of ['video','[data-review]','[data-sheet]','[data-speed]','[data-convert]'])this.q(selector).hidden=!guide;
    this.q('[data-review]').disabled=busy;this.q('[data-convert]').disabled=busy;
    this.q('[data-diagnose]').hidden=project.status!=='error';this.q('[data-diagnose]').disabled=busy;
    if(guide){const src=url(guide.file);if(this.q('video').getAttribute('src')!==src){this.q('video').src=src;this.q('[data-end]').value=guide.metadata.duration.toFixed(3);this.q('[data-start]').value=0;this.q('[data-notes]').value=guide.review?.notes||'';this.panel.querySelectorAll('[data-check]').forEach(c=>{c.checked=guide.review?.checks?.[c.dataset.check]===true;});}this.q('[data-sheet]').href=url(guide.sheet);}
    else {this.q('video').pause();this.q('video').removeAttribute('src');}
    const html=(project.videoConversions||[]).filter(c=>c.clip===this.selected).slice().reverse().map(c=>`<article><h3>${esc(c.label)} / ${esc(c.status)}</h3><p>${esc(c.message||'Waiting for conversion')}${c.seconds?` (${c.seconds.toFixed(1)} s)`:''}</p>
      ${c.overlay?`<a target="_blank" rel="noopener" href="${url(c.overlay)}">Watch tracking overlay</a> `:''}${c.report?`<a target="_blank" href="${url(c.report)}">Quality report</a>`:''}${c.trackingReport?` <a target="_blank" href="${url(c.trackingReport)}">Tracking report</a>`:''}
      ${c.file?`<p><button data-action="preview" data-id="${c.id}">Preview this candidate</button> <a href="${url(c.file)}" download>Download candidate GLB</a></p>`:''}
      ${c.passed&&c.qualityContract===2?`<label><input type="checkbox" data-confirm="${c.id}"> I reviewed the complete motion, feet, hands and deformation</label><button data-action="use" data-id="${c.id}" ${busy?'disabled':''}>Apply to model</button>`:c.passed?'<p>Earlier check version. Convert again to run current contact and loop checks.</p>':''}</article>`).join('');
    if(this.q('[data-candidates]').dataset.signature!==html){this.q('[data-candidates]').innerHTML=html;this.q('[data-candidates]').dataset.signature=html;}
  }
}
