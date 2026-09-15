// Explicit listening trial only. The default AudioEngine stays unchanged.
import { AudioEngine } from './audio.js';
import { impactCue, creatureCue } from './audio-context.js';

const ROOT = new URL('audio/material/', document.baseURI);
const LIMIT = 12;
const INTERVAL = { step: 170, stepHard: 170, rifle: 70, shot: 60, enemyHit: 75, explosion: 110 };

export class MaterialAudio extends AudioEngine {
  constructor() { super(); this._initMaterial(); }

  _initMaterial() {
    this.materialTrial = true;
    this.voices = new Set();
    this.envelopes = new Set();
    this.variants = new Map();
    this.bank = null;
    this.loadError = '';
    this.disposed = false;
    this._visibility = () => {
      if (!this.ctx || !this.started) return;
      if (document.hidden) { this.stopVoices(); this.ctx.suspend().catch(() => {}); }
      else this.ctx.resume().catch(() => {});
    };
    document.addEventListener('visibilitychange', this._visibility);
  }

  _ensure() {
    if (this.disposed || !super._ensure()) return false;
    if (!this.materialFilter) {
      // This gentler bus also softens retained procedural fallback cues.
      this.comp.disconnect();
      this.materialFilter = this.ctx.createBiquadFilter();
      this.materialFilter.type = 'highshelf';
      this.materialFilter.frequency.value = 2800;
      this.materialFilter.gain.value = -4;
      this.comp.threshold.value = -10;
      this.comp.ratio.value = 3;
      this.comp.connect(this.materialFilter);
      // A soft safety ceiling affects only rare overlapping peaks, keeping
      // normal impacts linear without driving the main compressor harder.
      this.output = this.ctx.createWaveShaper();
      const curve = new Float32Array(16385);
      for (let i = 0; i < curve.length; i++) {
        const x = i * 2 / (curve.length - 1) - 1, level = Math.abs(x);
        curve[i] = level <= .72 ? x : Math.sign(x) * (.72 + .25 * Math.tanh((level - .72) / .25));
      }
      this.output.curve = curve; this.output.oversample = '2x';
      this.materialFilter.connect(this.output);
      this.output.connect(this.ctx.destination);
    }
    return true;
  }

  // Intentional silence between actions. Never start the old noise/pad bed.
  _ambient() {}

  async prepare() {
    if (!this._ensure()) return false;
    if (this.bank) return true;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const res = await fetch(new URL('manifest.json', ROOT));
        if (!res.ok) throw new Error(`Sound manifest: ${res.status}`);
        const manifest = await res.json();
        const data = await fetch(new URL(manifest.bank, ROOT));
        if (!data.ok) throw new Error(`Sound bank: ${data.status}`);
        const bank = await this.ctx.decodeAudioData(await data.arrayBuffer());
        if (this.disposed) return false;
        this.manifest = manifest; this.bank = bank; this.loadError = '';
        return true;
      } catch (e) {
        this.loadError = String(e);
        return false;
      } finally { this.loading = null; }
    })();
    return this.loading;
  }

  start() {
    if (!this._ensure()) return;
    super.start();
    this.ctx.resume().catch(() => {});
    this.prepare();
  }

  play(name, context = {}) {
    if(name==='swing'){super.play(name,context);return;}
    if (this.disposed || !this.started || this.muted || document.hidden || this.ctx?.state !== 'running') return;
    const fallbackName = name;
    if (name === 'meleeHit') name = impactCue(context);
    if (name === 'creatureHit') name = creatureCue(context.creature);
    if (name === 'enemyHit') name = 'enemyAttack';
    if (name === 'explosion') {
      if (this._limited(name, 90)) return;
      this._noise(.42, this._env(.42, .32), 650, 85, .6);
      this._osc('sine', 72, 26, .46, this._env(.46, .34));
      return;
    }
    if (name.startsWith('creature') && this._limited('creatureReaction', 320)) return;
    const list = this.manifest?.cues[name];
    // Loading/network errors preserve audible original feedback. No queued burst.
    if (!this.bank || !list) { super.play(fallbackName); return; }
    if (this._limited(name, INTERVAL[name] || 70)) return;
    if (this.voices.size >= LIMIT) {
      // Footsteps never steal a combat voice; other cues replace the oldest.
      if (name === 'step' || name === 'stepHard') return;
      this.voices.values().next().value.stop();
    }
    const index = this.variants.get(name) || 0;
    this.variants.set(name, index + 1);
    const clip = list[index % list.length];
    const node = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    node.buffer = this.bank;
    node.connect(gain); gain.connect(this.master);
    const voice = { stop: () => {
      if (!this.voices.delete(voice)) return;
      gain.gain.cancelScheduledValues(this.ctx.currentTime);
      gain.gain.setTargetAtTime(0, this.ctx.currentTime, .004);
      node.stop(this.ctx.currentTime + .025);
    } };
    node.onended = () => { this.voices.delete(voice); node.disconnect(); gain.disconnect(); };
    this.voices.add(voice);
    node.start(now, clip.offset, clip.duration);
  }

  _env(...args) {
    const gain=super._env(...args); this.envelopes.add(gain);
    setTimeout(()=>{this.envelopes.delete(gain);gain.disconnect();},(args[0]+.2)*1000);
    return gain;
  }

  stopVoices() {
    this.stopSwingVoices();
    for (const voice of [...this.voices]) voice.stop();
    for (const gain of this.envelopes) gain.disconnect();
    this.envelopes.clear();
  }

  dispose() {
    this.disposed = true; this.stopVoices();
    document.removeEventListener('visibilitychange', this._visibility);
    this.ctx?.close().catch(() => {});
  }
}

export function adoptMaterialAudio(audio) {
  // boot() awaits this before sharing the engine with input/combat/UI callbacks.
  if (audio.started || audio.ctx) throw new Error('Install the sound trial before audio starts');
  Object.setPrototypeOf(audio, MaterialAudio.prototype);
  audio._initMaterial();
  return audio;
}
