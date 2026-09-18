// A reviewed video reference remains separate from captured skeletal animation.
export class MotionGuide {
  constructor(parent,{api,safe,refresh}) {
    this.api=api;this.safe=safe;this.refresh=refresh;
    this.panel=document.createElement('details');this.panel.className='notes';this.panel.id='motion-video-guide';
    this.panel.innerHTML=`<summary>Walk + Strike / video reference</summary>
      <p>MiniMax H3 can show weight, timing and transitions using your approved character. Generate externally with the brief below, then import the MP4. Cloud generation is optional; the local pipeline remains available.</p>
      <a data-brief download>Download MiniMax H3 brief</a>
      <label>Video model <select data-model><option>MiniMax-H3</option><option>MiniMax-H3-Max</option><option>Other / imported</option></select></label>
      <label class="upload-button">Import video guide (MP4)<input data-import type="file" accept="video/mp4,.mp4"></label>
      <p data-status class="hint"></p>
      <video data-video controls playsinline preload="metadata" style="width:100%;max-height:520px;background:#d9ded8" hidden></video>
      <label>Playback speed <select data-speed><option value="1">Normal</option><option value="0.5">Half speed</option><option value="0.25">Quarter speed</option></select></label>
      <a data-sheet target="_blank" rel="noopener">Open timestamped frame sheet</a>
      <fieldset data-review><legend>Watch the entire clip before accepting</legend>
      <label><input type="checkbox" data-check="identity"> Same character, costume and anatomy throughout</label>
      <label><input type="checkbox" data-check="camera"> Fixed camera, complete body and feet visible</label>
      <label><input type="checkbox" data-check="feet"> Believable contact, foot roll and weight transfer</label>
      <label><input type="checkbox" data-check="timing"> Walk, preparation, strike and recovery read clearly</label>
      <label>Motion notes<textarea data-notes rows="2" placeholder="Record observed timing and anything to correct."></textarea></label>
      <button data-decision="accept">Accept as reference</button> <button data-decision="reject">Needs revision</button></fieldset>
      <p class="hint">This video is not a rig or animation clip. The current rig worker uses captured skeletal motion. Video pose extraction and retargeting have not been implemented. Accepting this guide does not approve the model animation.</p>`;
    parent.querySelector('.review').after(this.panel);this.q=s=>this.panel.querySelector(s);
    this.q('[data-import]').onchange=e=>safe(async()=>{const file=e.target.files[0];if(!file)return;const form=new FormData();form.append('file',file);refresh(await api(`projects/${this.project.id}/motion-guide?model=${encodeURIComponent(this.q('[data-model]').value)}`,'POST',form));e.target.value='';});
    this.q('[data-speed]').onchange=e=>{this.q('video').playbackRate=+e.target.value;};
    this.panel.querySelectorAll('[data-decision]').forEach(b=>b.onclick=()=>safe(async()=>{const checks=Object.fromEntries([...this.panel.querySelectorAll('[data-check]')].map(c=>[c.dataset.check,c.checked]));refresh(await api(`projects/${this.project.id}/motion-guide/review`,'POST',{decision:b.dataset.decision,checks,notes:this.q('[data-notes]').value}));}));
  }
  update(project,view) {
    this.project=project;const guide=project.motionGuide,visible=!!project.art&&['art','animation'].includes(view),busy=['running','queued'].includes(project.status);
    this.panel.hidden=!visible;if(!visible)this.q('video').pause();
    this.q('[data-brief]').href=`/api/projects/${project.id}/motion-guide/brief`;this.q('[data-import]').disabled=busy;
    const referenceUrl=name=>`/files/projects/${project.id}/${encodeURIComponent(name)}`;
    this.q('[data-status]').textContent=guide?`${guide.model} / ${guide.metadata.duration.toFixed(2)} s / ${guide.status} / visual reference only`:'No video imported. The existing pose sheet is retained.';
    for(const selector of ['video','[data-review]','[data-sheet]','[data-speed]'])this.q(selector).hidden=!guide;
    this.q('[data-review]').disabled=busy;
    if(guide){const src=referenceUrl(guide.file);if(this.q('video').getAttribute('src')!==src){this.q('video').src=src;this.q('[data-notes]').value=guide.review?.notes||'';this.panel.querySelectorAll('[data-check]').forEach(c=>{c.checked=guide.review?.checks?.[c.dataset.check]===true;});}this.q('[data-sheet]').href=referenceUrl(guide.sheet);}
    else {this.q('video').pause();this.q('video').removeAttribute('src');}
  }
}
