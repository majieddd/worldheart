import {AUDIO_CUES,AUDIO_DEFAULTS,AUDIO_LIMITS,cleanAudioSettings} from './audio-catalogue.js';
import {AUDIO_BANK} from './audio-bank.js';
import {MUSIC_TRACKS} from './audio-music.js';
import {browserStorage} from './storage.js';

const SILENT_UNLOCK='data:audio/wav;base64,UklGRmQBAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
export const audioAsset=file=>globalThis.WH_AUDIO_ASSETS?.[file]||new URL('audio/'+file,document.baseURI).href;
// One decoded mono effects bank, bounded sample voices and two streamed music
// decks. No per-shot oscillators, filters, convolution or audio fetches.
export class AudioEngine {
  constructor({contextFactory}={}) {
    this.contextFactory=contextFactory;this.ctx=null;this.started=false;this.disposed=false;
    let saved;try{saved=JSON.parse(browserStorage.getItem('whAudio')||'{}');}catch{}
    this.settings=cleanAudioSettings(saved);this.muted=this.settings.muted;
    this.voices=new Set();this.last=new Map();this.variants=new Map();this.decks=[];this.state='lobby';this.ambience='forest';this.paused=false;
    this.cueCounts={};this.unknownCues={};
    this.stats={played:0,dropped:0,stolen:0,peakVoices:0,bank:'loading',music:'locked',errors:[]};
    this.camera=null;this.observer=null;this._duckUntil=0;this._ambientVoice=null;
    this._gesture=()=>{this.start();};
    document.addEventListener('pointerdown',this._gesture,{passive:true});
    document.addEventListener('keydown',this._gesture);
    this._visibility=()=>{if(document.hidden){this._stopVoices();this.decks.forEach(d=>d.element.pause());this.ctx?.suspend().then(()=>{if(!document.hidden&&!this.muted&&!this.disposed)this.start();}).catch(()=>{});}else if(this.started&&!this.muted)this.start();};
    document.addEventListener('visibilitychange',this._visibility);
    this._pagehide=e=>{if(!e.persisted)this.dispose();};addEventListener('pagehide',this._pagehide);
    this._fetchBank();
  }
  _error(where,error){this.stats.errors.push(where+': '+String(error?.message||error));if(this.stats.errors.length>8)this.stats.errors.shift();}
  _fetchBank(){
    if(this._bankRequest||this.disposed)return;
    this._abort=new AbortController();this.stats.bank='loading';
    this._bankRequest=fetch(audioAsset(AUDIO_BANK.file),{signal:this._abort.signal}).then(r=>{
      if(!r.ok)throw new Error('HTTP '+r.status);const n=Number(r.headers.get('content-length'));if(n>AUDIO_LIMITS.bankBytes)throw new Error('Bank exceeds transfer budget');return r.arrayBuffer();
    }).then(bytes=>{if(bytes.byteLength>AUDIO_LIMITS.bankBytes)throw new Error('Bank exceeds transfer budget');this._compressed=bytes;if(this.ctx)return this._decodeBank();}).catch(e=>{if(!this.disposed){this.stats.bank='unavailable';this._error('effects',e);}});
  }
  async _decodeBank(){
    if(!this._compressed||this._decoding||this.buffer||this.disposed)return;
    this._decoding=true;
    try{
      const buffer=await this.ctx.decodeAudioData(this._compressed.slice(0));
      if(buffer.length*buffer.numberOfChannels*4>AUDIO_LIMITS.decodedBytes)throw new Error('Bank exceeds decoded memory budget');
      if(buffer.duration<AUDIO_BANK.duration-.1)throw new Error('Truncated sound bank');
      if(this.disposed)return;
      this.buffer=buffer;this._compressed=null;this.stats.bank='ready';this.stats.decodedBytes=buffer.length*buffer.numberOfChannels*4;this._syncAmbience();
    }catch(e){this.stats.bank='unavailable';this._error('decode',e);}finally{this._decoding=false;}
  }
  _ensure(){
    if(this.disposed)return false;if(this.ctx)return true;
    try{
      this.ctx=this.contextFactory?this.contextFactory():new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});
      const ctx=this.ctx;this.master=ctx.createGain();this.master.gain.value=this.muted?0:this.settings.master;
      this.comp=ctx.createDynamicsCompressor();this.comp.threshold.value=-8;this.comp.knee.value=8;this.comp.ratio.value=6;this.comp.attack.value=.003;this.comp.release.value=.18;
      this.master.connect(this.comp);this.comp.connect(ctx.destination);this.buses={};
      for(const bus of ['music','effects','ambience','ui']){const g=ctx.createGain();g.gain.value=this.settings[bus];g.connect(this.master);this.buses[bus]=g;}
      // A tiny cached mechanical tick remains responsive while the bank loads.
      this.fallback=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.045),ctx.sampleRate);const data=this.fallback.getChannelData(0);
      for(let i=0;i<data.length;i++){const t=i/ctx.sampleRate;data[i]=Math.sin(t*6283)*Math.exp(-t*130)*Math.min(1,t/.002)*.13;}
      this.ctx.onstatechange=()=>{if(this.ctx?.state==='running'&&this.started&&!document.hidden){this._resumeMusic();this._syncAmbience();}};
      for(let i=0;i<2;i++){
        const element=new Audio();element.preload='none';element.loop=true;element.setAttribute('playsinline','');
        const source=ctx.createMediaElementSource(element),gain=ctx.createGain();gain.gain.value=0;source.connect(gain);gain.connect(this.buses.music);
        element.addEventListener('error',()=>{if(element.currentSrc){this.stats.music='unavailable';this._error('music',new Error(element.error?.message||'Media error'));}});
        this.decks.push({element,source,gain,key:null,target:0});
      }
      this._decodeBank();return true;
    }catch(e){this._error('context',e);return false;}
  }
  start(){
    if(this.disposed)return false;
    if(this.stats.bank==='unavailable'&&!this._retried){this._retried=true;this._bankRequest=null;this._fetchBank();}
    if(document.hidden||!this._ensure())return false;this.started=true;
    this.ctx.resume().then(()=>{if(!this.disposed&&!this.muted){this._syncMusic();this._syncAmbience();}}).catch(e=>this._error('unlock',e));
    if(!this.muted){
      // Unlock both streamed decks inside the same gesture for mobile Safari.
      for(const d of this.decks)if(!d.key&&!d.unlocked){d.element.src=SILENT_UNLOCK;d.element.play().then(()=>{d.unlocked=true;if(!d.key)d.element.pause();}).catch(()=>{});}
      this._syncMusic();
    }return true;
  }
  setVolume(bus,value){
    if(!Object.hasOwn(AUDIO_DEFAULTS,bus)||bus==='muted')return false;
    this.settings[bus]=Math.max(0,Math.min(1,Number(value)||0));this._applyMix();this._save();return true;
  }
  _save(){try{browserStorage.setItem('whAudio',JSON.stringify(this.settings));}catch{}this.onSettings?.();}
  _applyMix(){
    if(!this.ctx)return;const t=this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted?0:this.settings.master,t,.025);
    for(const [key,bus]of Object.entries(this.buses))bus.gain.setTargetAtTime(this.settings[key]*(key==='music'&&(this.paused||t<this._duckUntil)?.48:1),t,.08);
  }
  toggleMute(){
    this.muted=!this.muted;this.settings.muted=this.muted;this._save();this._applyMix();
    if(this.muted){this._stopVoices();this.decks.forEach(d=>d.element.pause());}else this.start();
    return this.muted;
  }
  setScene({state=this.state,ambience=this.ambience,paused=this.paused,camera=this.camera,observer=this.observer}={}){
    const changed=state!==this.state,changedAmbient=ambience!==this.ambience;
    this.state=state;this.ambience=ambience;this.paused=paused;this.camera=camera;this.observer=observer;
    if(changed)this._syncMusic();if(changedAmbient)this._syncAmbience();
  }
  update(dt){
    if(!this.ctx||!this.started||this.disposed||document.hidden)return;
    this._mixT=(this._mixT||0)+dt;if(this._mixT<.1)return;this._mixT=0;this._applyMix();
    for(const d of this.decks)if(!d.target&&d.gain.gain.value<.001&&!d.element.paused)d.element.pause();
  }
  _syncMusic(){
    if(this.disposed||!this.started||!this.ctx||this.muted||document.hidden)return;
    const track=MUSIC_TRACKS[this.state];if(!track)return;
    if(this.decks.some(d=>d.key===this.state&&d.target===1)){this._resumeMusic();return;}
    let chosen=this.decks.find(d=>d.key===this.state);
    if(!chosen){chosen=this.decks.find(d=>!d.target)||this.decks[0];chosen.element.pause();chosen.key=this.state;chosen.element.src=audioAsset(track.file);chosen.element.loop=true;}
    for(const d of this.decks){d.target=d===chosen?1:0;d.gain.gain.cancelScheduledValues(this.ctx.currentTime);d.gain.gain.setTargetAtTime(d.target,this.ctx.currentTime,.6);}
    this._resumeMusic();
  }
  _resumeMusic(){
    if(this.muted||document.hidden||this.disposed)return;
    for(const d of this.decks)if(d.target&&d.element.paused)d.element.play().then(()=>{this.stats.music='playing';}).catch(e=>{this.stats.music='gesture-needed';if(e.name!=='NotAllowedError')this._error('playback',e);});
  }
  _syncAmbience(){
    if(this.disposed)return;
    if(this._ambientVoice?.name===this.ambience&&this.voices.has(this._ambientVoice))return;
    if(this._ambientVoice)this._stop(this._ambientVoice,.25);
    this._ambientVoice=null;
    if(this.started&&this.buffer&&!this.muted&&!document.hidden)this._ambientVoice=this.play(this.ambience,{loop:true});
  }
  _stop(voice,fade=.012){
    if(!voice||voice.stopping)return;voice.stopping=true;
    const t=this.ctx.currentTime;voice.gain.gain.cancelScheduledValues(t);voice.gain.gain.setTargetAtTime(0,t,Math.max(.001,fade/3));
    try{voice.source.stop(t+fade);}catch{}this.voices.delete(voice);
  }
  _stopVoices(){for(const voice of this.voices)this._stop(voice);this._ambientVoice=null;}
  play(name,options={}){
    if(!Object.hasOwn(AUDIO_CUES,name)){this.unknownCues[String(name)]=(this.unknownCues[String(name)]||0)+1;return null;}
    const cue=AUDIO_CUES[name];if(!this.started||this.muted||this.disposed||document.hidden||this.ctx?.state!=='running')return null;
    const ctx=this.ctx,t=ctx.currentTime,loop=options.loop===true;
    if(t-(this.last.get(name)??-Infinity)<cue.interval/1000&&!options.audition){this.stats.dropped++;return null;}
    const group=[...this.voices].filter(v=>v.name===name);
    if(group.length>=AUDIO_LIMITS.perCue)this._stop(group[0]);
    if(this.voices.size>=AUDIO_LIMITS.voices){
      let lowest=null;for(const v of this.voices)if(!v.loop&&(!lowest||v.priority<lowest.priority))lowest=v;
      if(!lowest||lowest.priority>cue.priority){this.stats.dropped++;return null;}this._stop(lowest);this.stats.stolen++;
    }
    let gain=cue.gain*(options.gain??1),pan=0;
    if(options.position&&this.observer){
      const p=options.position,o=this.observer,dx=p.x-o.x,dy=p.y-o.y,dz=p.z-o.z,dist=Math.hypot(dx,dy,dz);
      gain*=1/(1+(Math.max(0,dist-8)/35)**2);
      if(this.camera?.matrixWorld){const m=this.camera.matrixWorld.elements;pan=Math.max(-.85,Math.min(.85,(dx*m[0]+dy*m[1]+dz*m[2])/Math.max(8,dist)));}
      if(gain<.014){this.stats.dropped++;return null;}
    }
    const index=this.variants.get(name)||0,variants=AUDIO_BANK.cues[name],clip=variants[index%variants.length];this.variants.set(name,index+1);this.last.set(name,t);
    const source=ctx.createBufferSource(),volume=ctx.createGain(),panner=ctx.createStereoPanner();source.buffer=this.buffer||this.fallback;volume.gain.value=gain;panner.pan.value=pan;source.connect(volume);volume.connect(panner);panner.connect(this.buses[cue.bus]);
    const voice={source,gain:volume,panner,name,priority:cue.priority,loop};this.voices.add(voice);
    source.onended=()=>{this.voices.delete(voice);source.disconnect();volume.disconnect();panner.disconnect();};
    if(loop&&this.buffer){source.loop=true;source.loopStart=clip.start;source.loopEnd=clip.start+clip.duration;source.start(t,clip.start);}
    else source.start(t,this.buffer?clip.start:0,this.buffer?clip.duration:this.fallback.duration);
    if(cue.priority>=4||name==='warning'){this._duckUntil=t+.75;this._applyMix();}
    this.cueCounts[name]=(this.cueCounts[name]||0)+1;this.stats.played++;this.stats.peakVoices=Math.max(this.stats.peakVoices,this.voices.size);return voice;
  }
  snapshot(){return {...this.stats,cueCounts:{...this.cueCounts},unknownCues:{...this.unknownCues},voices:this.voices.size,state:this.state,muted:this.muted,context:this.ctx?.state||'locked',settings:{...this.settings},decks:this.decks.map(d=>({key:d.key,target:d.target,paused:d.element.paused,time:d.element.currentTime}))};}
  dispose(){
    if(this.disposed)return;this.disposed=true;this._abort?.abort();this._stopVoices();
    document.removeEventListener('pointerdown',this._gesture);document.removeEventListener('keydown',this._gesture);document.removeEventListener('visibilitychange',this._visibility);removeEventListener('pagehide',this._pagehide);
    for(const d of this.decks){d.element.pause();d.element.removeAttribute('src');d.element.load();d.source.disconnect();d.gain.disconnect();}
    this.buffer=null;this._compressed=null;this.ctx?.close().catch(()=>{});
  }
}
