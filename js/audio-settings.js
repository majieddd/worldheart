import {AUDIO_CUES} from './audio-catalogue.js';
import {MUSIC_TRACKS} from './audio-music.js';

export function audioSettings(audio,parent,{audition=false}={}){
  const details=document.createElement('details');details.className='audio-settings';
  const summary=document.createElement('summary');summary.textContent=audition?'Sound studio':'Sound mix';details.append(summary);
  const body=document.createElement('div');body.className='audio-settings-body';details.append(body);
  for(const [bus,label]of [['master','Master'],['music','Music'],['effects','Effects'],['ambience','Ambience'],['ui','Interface']]){
    const row=document.createElement('label'),text=document.createElement('span'),input=document.createElement('input'),value=document.createElement('output');
    row.className='audio-slider';text.textContent=label;input.type='range';input.min='0';input.max='100';input.step='1';input.value=Math.round(audio.settings[bus]*100);input.dataset.audioBus=bus;input.setAttribute('aria-label',label+' volume');value.textContent=input.value+'%';
    input.oninput=()=>{audio.setVolume(bus,Number(input.value)/100);value.textContent=input.value+'%';};
    input.onchange=()=>{audio.start();audio.play('click');};row.append(text,input,value);body.append(row);
  }
  const mute=document.createElement('button');mute.type='button';mute.className='btn';
  const reflect=()=>{mute.textContent=audio.muted?'Unmute audio':'Mute audio';mute.setAttribute('aria-pressed',String(audio.muted));};reflect();
  mute.onclick=()=>{audio.toggleMute();reflect();};details.addEventListener('toggle',reflect);body.append(mute);
  if(audition){
    const label=document.createElement('label');label.textContent='Sound cue';const select=document.createElement('select');select.id='audio-cue';
    const groups=new Map();for(const cue of Object.values(AUDIO_CUES)){
      if(!groups.has(cue.family)){const group=document.createElement('optgroup');group.label=cue.family;groups.set(cue.family,group);select.append(group);}
      groups.get(cue.family).append(new Option(cue.label,cue.key));
    }
    label.append(select);body.append(label);
    let voice=null;const play=document.createElement('button');play.className='btn';play.textContent='Play cue';play.id='audio-play';
    play.onclick=async()=>{audio.start();await audio.ctx?.resume();if(voice)audio._stop(voice);voice=audio.play(select.value,{audition:true});};
    const stop=document.createElement('button');stop.className='btn';stop.id='audio-stop';stop.textContent='Stop audition';stop.onclick=()=>{audio._stopVoices();audio.setScene({state:'none'});tracks.value='';};body.append(play,stop);
    const musicLabel=document.createElement('label');musicLabel.textContent='Instrumental score';const tracks=document.createElement('select');tracks.id='audio-track';
    tracks.append(new Option('Choose a track',''));for(const [key,track]of Object.entries(MUSIC_TRACKS))tracks.append(new Option(track.title,key));
    tracks.onchange=()=>{if(!tracks.value)return;audio.start();audio.setScene({state:tracks.value});};musicLabel.append(tracks);body.append(musicLabel);
    const note=document.createElement('p');note.className='audio-note';note.textContent='Instrumental score: YuE2. Effects: original nonvocal sound design. Music model is licensed for noncommercial use.';body.append(note);
    const status=document.createElement('p');status.className='audio-note';status.id='audio-status';status.setAttribute('role','status');body.append(status);
    const refresh=()=>{if(details.open){const s=audio.snapshot();status.textContent=`Effects ${s.bank}. Music ${s.music}. ${s.voices} / 24 voices.`;}};
    details.addEventListener('toggle',refresh);play.addEventListener('click',()=>setTimeout(refresh,300));tracks.addEventListener('change',()=>setTimeout(refresh,1000));
  }
  parent.append(details);return details;
}
