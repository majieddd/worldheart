import { musicContext } from './audio-context.js';

const ROOT = new URL('audio/soundtrack/', document.baseURI);
export class Soundtrack {
  constructor(engine, read = () => ({})) {
    this.engine = engine; this.read = read; this.enabled = true; this.volume = .35;
    this.decks = []; this.key = ''; this.serial = 0; this.started = false;
    this.error = ''; this.disposed = false;
    // Owner music replaces the old synthesized wind/pad, never layers over it.
    engine._ambient = () => {};
    const toggle = engine.toggleMute.bind(engine);
    engine.toggleMute = () => { const muted=toggle(); this.update(); return muted; };
    this.gesture = () => this.start();
    this.hidden = () => {
      for (const deck of this.decks) {
        if (document.hidden) deck.media.pause();
        else if (this.enabled && !engine.muted) deck.media.play().catch(() => {});
      }
    };
    document.addEventListener('pointerdown', this.gesture, { capture: true });
    document.addEventListener('keydown', this.gesture, { capture: true });
    document.addEventListener('visibilitychange', this.hidden);
    this.exit = () => this.dispose(); window.addEventListener('pagehide', this.exit);
  }

  async start() {
    if (this.disposed || !this.enabled || !this.engine._ensure()) return;
    this.engine.ctx.resume().catch(() => {});
    if (this.started) { this.update(); return; }
    this.started = true;
    document.removeEventListener('pointerdown', this.gesture, true);
    document.removeEventListener('keydown', this.gesture, true);
    const ctx = this.engine.ctx;
    this.bus = ctx.createGain(); this.bus.gain.value = this.volume;
    // Shared final headroom protects a loud impact over a music transient.
    this.output = ctx.createWaveShaper();
    const curve = new Float32Array(16385);
    for (let i=0; i<curve.length; i++) {
      const x=i*2/(curve.length-1)-1, a=Math.abs(x);
      curve[i]=a<.82?x:Math.sign(x)*(.82+.15*Math.tanh((a-.82)/.15));
    }
    this.output.curve=curve; this.output.oversample='2x';
    const fx = this.engine.output || this.engine.comp;
    fx.disconnect(); fx.connect(this.output); this.bus.connect(this.output); this.output.connect(ctx.destination);
    try {
      const response = await fetch(new URL('manifest.json', ROOT));
      if (!response.ok) throw Error(`Music manifest: ${response.status}`);
      this.manifest = await response.json();
      if (this.disposed) return;
      this.timer = setInterval(() => this.update(), 500); this.update();
    } catch (error) { this.error = String(error); }
  }

  update() {
    if (!this.manifest || this.disposed) return;
    this.bus.gain.setTargetAtTime(this.enabled && !this.engine.muted ? this.volume : 0, this.engine.ctx.currentTime, .08);
    if (!this.enabled) { this.stop(); return; }
    if (document.hidden) return;
    const key = musicContext(this.read());
    if (key !== this.key) { this.key = key; this.playIndex(0); }
    if (this.label) this.label.textContent = this.error ? 'Music unavailable' : `Music: ${this.enabled ? 'On' : 'Off'}`;
  }

  stop() {
    this.serial++;
    for (const deck of this.decks) this.release(deck);
    this.decks = []; this.key = '';
  }

  release(deck) {
    clearTimeout(deck.expiry); deck.media.onended = null; deck.media.pause();
    deck.media.removeAttribute('src'); deck.media.load(); deck.source.disconnect(); deck.gain.disconnect();
  }

  async playIndex(index) {
    const token = ++this.serial, playlist = this.manifest.playlists[this.key];
    // A fast third transition releases the oldest fade immediately.
    while (this.decks.length > 1) this.release(this.decks.shift());
    if (!playlist?.length) { this.stop(); this.key = 'silent'; return; }
    const id = playlist[index % playlist.length], track = this.manifest.tracks[id];
    const ctx = this.engine.ctx, media = new Audio(); media.preload = 'none';
    media.src = new URL(track.file, ROOT).href;
    const source = ctx.createMediaElementSource(media), gain = ctx.createGain();
    gain.gain.value = 0; source.connect(gain); gain.connect(this.bus);
    const deck = { id, media, source, gain }; this.decks.push(deck);
    media.onended = () => { if (token === this.serial && this.enabled) this.playIndex(index + 1); };
    try {
      if (document.hidden) return;
      await media.play();
      if (token !== this.serial || this.disposed || !this.enabled) return;
      this.error = '';
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(track.gain, now + .8);
      for (const old of this.decks.filter(d => d !== deck)) {
        old.media.onended = null;
        old.gain.gain.cancelScheduledValues(now); old.gain.gain.setTargetAtTime(0, now, .16);
        old.expiry = setTimeout(() => { const i=this.decks.indexOf(old); if(i>=0){this.decks.splice(i,1);this.release(old);} }, 950);
      }
    } catch (error) {
      if (token !== this.serial || this.disposed) return;
      this.error = String(error);
      const i=this.decks.indexOf(deck); if(i>=0) this.decks.splice(i,1); this.release(deck);
    }
  }

  setEnabled(value) {
    this.enabled = !!value;
    if (this.label) this.label.textContent = `Music: ${value ? 'On' : 'Off'}`;
    if (!value) this.stop(); else this.start();
    this.update();
  }

  controls(parent) {
    if (!parent) return;
    const floating=parent.matches('header .account');
    const group=document.createElement(floating?'details':'div'); group.className='soundtrack-controls';
    const content=document.createElement('div'); content.className='soundtrack-options';
    if(floating){const summary=document.createElement('summary');summary.textContent='Music';group.append(summary);}
    const button=document.createElement('button'); button.className='btn'; button.type='button';
    button.textContent='Music: On'; button.setAttribute('aria-pressed','true');
    button.onclick=()=>{this.setEnabled(!this.enabled);button.setAttribute('aria-pressed',String(this.enabled));};
    this.label=button;
    const label=document.createElement('label'); label.textContent='Music volume';
    const slider=document.createElement('input'); slider.type='range'; slider.min='0';slider.max='100';slider.value='35';
    slider.setAttribute('aria-label','Music volume'); slider.oninput=()=>{this.volume=+slider.value/100;this.update();};
    label.append(slider);content.append(button,label);group.append(content);parent.append(group);
  }

  dispose() {
    this.disposed=true; this.stop(); clearInterval(this.timer);
    document.removeEventListener('pointerdown',this.gesture,true);document.removeEventListener('keydown',this.gesture,true);
    document.removeEventListener('visibilitychange',this.hidden);window.removeEventListener('pagehide',this.exit);
    this.bus?.disconnect();
  }
}
