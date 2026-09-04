// Fully synthesized WebAudio: no samples, no assets. A master bus with a
// compressor, an ambient bed (pad + wind), and short procedural SFX recipes.
// Frequent events are rate-limited so massed combat stays musical.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.started = false;
    this._last = new Map();
  }

  _ensure() {
    if (this.ctx) return true;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -18;
      this.comp.knee.value = 22;
      this.comp.ratio.value = 8;
      this.master.connect(this.comp);
      this.comp.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  start() {
    if (!this._ensure() || this.started) return;
    this.started = true;
    this.ctx.resume();
    this._ambient();
  }

  toggleMute() {
    if (!this._ensure()) return true;
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  _limited(name, ms) {
    const now = performance.now();
    const last = this._last.get(name) || 0;
    if (now - last < ms) return true;
    this._last.set(name, now);
    return false;
  }

  // -- primitives -----------------------------------------------------------

  _env(dur, peak = 1, attack = 0.008, curve = 3) {
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t + attack);
    g.gain.setTargetAtTime(0.0001, t + attack, dur / curve);
    g.connect(this.master);
    return g;
  }

  _osc(type, f0, f1, dur, out) {
    const o = this.ctx.createOscillator();
    o.type = type;
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    o.connect(out);
    o.start(t);
    o.stop(t + dur + 0.35);
    return o;
  }

  // One shared 2s noise buffer, sliced at random offsets. Allocating a fresh
  // AudioBuffer per shot caused measurable GC pressure in massed combat.
  _noiseBuffer() {
    if (this._nbuf) return this._nbuf;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._nbuf = buf;
    return buf;
  }

  _noise(dur, out, f0 = 1200, f1 = 300, q = 0.8) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = 2;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = q;
    const t = this.ctx.currentTime;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    src.connect(f);
    f.connect(out);
    src.start(t, Math.random() * 1.2);
    src.stop(t + dur + 0.05);
  }

  _tone(freq, dur, delay, peak = 0.1, type = 'sine') {
    const t = this.ctx.currentTime + delay;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    g.gain.setTargetAtTime(0.0001, t + 0.02, dur / 3);
    g.connect(this.master);
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.3);
  }

  // -- recipes --------------------------------------------------------------

  play(name) {
    if (!this.started || this.muted || !this.ctx) return;
    switch (name) {
      case 'click':
        this._osc('square', 900, 700, 0.035, this._env(0.035, 0.05));
        break;
      case 'deny':
        this._osc('square', 170, 150, 0.14, this._env(0.14, 0.08));
        this._osc('square', 128, 110, 0.14, this._env(0.14, 0.06));
        break;
      case 'build':
        this._osc('sine', 190, 58, 0.2, this._env(0.2, 0.3));
        this._noise(0.12, this._env(0.12, 0.12), 900, 250);
        break;
      case 'upgrade':
        this._tone(330, 0.1, 0, 0.09);
        this._tone(440, 0.1, 0.07, 0.09);
        this._tone(586, 0.2, 0.14, 0.1);
        break;
      case 'sell':
        this._tone(700, 0.06, 0, 0.07, 'square');
        this._tone(940, 0.1, 0.05, 0.07, 'square');
        break;
      case 'shot':
        if (this._limited('shot', 40)) return;
        this._osc('sawtooth', 1500, 320, 0.08, this._env(0.08, 0.045));
        break;
      case 'mortar':
        this._osc('sine', 130, 46, 0.26, this._env(0.26, 0.32));
        this._noise(0.14, this._env(0.14, 0.1), 500, 160);
        break;
      case 'explosion':
        if (this._limited('explosion', 70)) return;
        this._noise(0.5, this._env(0.5, 0.4), 1000, 140, 0.6);
        this._osc('sine', 95, 32, 0.4, this._env(0.4, 0.3));
        break;
      case 'zap': {
        if (this._limited('zap', 60)) return;
        for (let i = 0; i < 4; i++) {
          this._tone(800 + Math.random() * 900, 0.03, i * 0.024, 0.05, 'sawtooth');
        }
        this._noise(0.13, this._env(0.13, 0.09), 4200, 1600, 1.4);
        break;
      }
      case 'beam':
        this._osc('sawtooth', 180, 760, 0.2, this._env(0.2, 0.06));
        break;
      case 'kill':
        if (this._limited('kill', 50)) return;
        this._osc('sine', 320, 70, 0.12, this._env(0.12, 0.09));
        break;
      case 'leak':
        this._osc('sine', 210, 105, 0.4, this._env(0.4, 0.28));
        this._osc('sine', 105, 70, 0.6, this._env(0.6, 0.2));
        this._noise(0.3, this._env(0.3, 0.08), 500, 120);
        break;
      case 'waveStart': {
        const g = this._env(0.9, 0.16, 0.3, 2);
        this._osc('sawtooth', 220, 220, 0.9, g);
        this._osc('sawtooth', 332, 329, 0.9, g);
        break;
      }
      case 'waveClear':
        this._tone(523, 0.12, 0, 0.09);
        this._tone(659, 0.12, 0.09, 0.09);
        this._tone(784, 0.26, 0.18, 0.1);
        break;
      case 'portal':
        this._osc('sawtooth', 70, 250, 1.1, this._env(1.1, 0.12, 0.5, 2));
        this._noise(1.0, this._env(1.0, 0.1, 0.4, 2), 300, 1400, 0.7);
        break;
      case 'spawn':
        if (this._limited('spawn', 90)) return;
        this._osc('sine', 500, 160, 0.09, this._env(0.09, 0.04));
        break;
      case 'shed':
        this._noise(0.25, this._env(0.25, 0.2), 1800, 300);
        this._osc('square', 210, 90, 0.2, this._env(0.2, 0.08));
        break;
      // ---- 99 Planets ----------------------------------------------------
      // The whole mode layer was silent: possession, every archetype's weapon,
      // jumping, orders and losing base control made no sound at all, which is
      // why first person read as weightless however good it looked.
      case 'possess':
        this._tone(240, 0.16, 0, 0.09);
        this._tone(360, 0.22, 0.08, 0.08);
        this._noise(0.2, this._env(0.2, 0.16), 1400, 300);
        break;
      case 'release':
        this._tone(360, 0.14, 0, 0.07);
        this._tone(230, 0.2, 0.07, 0.07);
        break;
      case 'swing':
        // A short airy whoosh: the arc, not the impact.
        if (this._limited('swing', 60)) return;
        this._noise(0.16, this._env(0.16, 0.08), 2600, 420);
        break;
      case 'meleeHit':
        if (this._limited('meleeHit', 45)) return;
        this._osc('square', 220, 90, 0.09, this._env(0.09, 0.05));
        this._noise(0.07, this._env(0.07, 0.05), 1800, 500);
        break;
      // An enemy's blow landing on a friendly body. Lower and duller than the
      // player's own meleeHit so the two are told apart by ear in a melee: the
      // bright one is yours connecting, the thud is something connecting with
      // you.
      case 'enemyHit':
        if (this._limited('enemyHit', 60)) return;
        this._osc('square', 150, 62, 0.11, this._env(0.11, 0.07));
        this._osc('sawtooth', 96, 58, 0.14, this._env(0.14, 0.05));
        this._noise(0.09, this._env(0.09, 0.06), 1200, 260);
        break;
      // A breach coming down is a run-changing event and the mode's second
      // fanfare: a hard two-tone strike, then a long rumble as it collapses.
      case 'breach':
        this._tone(196, 0.5, 0, 0.12, 'square');
        this._tone(262, 0.6, 0.12, 0.12, 'square');
        this._tone(392, 0.9, 0.24, 0.10);
        this._osc('sawtooth', 70, 30, 1.6, this._env(1.6, 0.16, 0.4, 2));
        this._noise(1.2, this._env(1.2, 0.2, 0.05, 2), 700, 80);
        break;
      case 'rifle':
        if (this._limited('rifle', 60)) return;
        this._osc('sawtooth', 2200, 260, 0.1, this._env(0.1, 0.05));
        this._noise(0.14, this._env(0.14, 0.07), 3200, 400);
        break;
      case 'lob':
        this._osc('sine', 420, 130, 0.16, this._env(0.16, 0.1));
        this._noise(0.1, this._env(0.1, 0.06), 900, 260);
        break;
      case 'blocked':
        if (this._limited('blocked', 90)) return;
        this._osc('square', 640, 600, 0.07, this._env(0.07, 0.03));
        break;
      case 'jump':
        this._osc('sine', 300, 520, 0.12, this._env(0.12, 0.06));
        break;
      case 'land':
        this._osc('sine', 150, 62, 0.13, this._env(0.13, 0.09));
        this._noise(0.09, this._env(0.09, 0.06), 700, 200);
        break;
      // Footsteps for the possessed body, one per half stride. Movement with
      // no sound underneath it reads as gliding however good the bob is, so
      // these fire from the stride phase in js/possess.js. Pitch and cutoff
      // vary per step so a run does not read as a metronome; a sprint step
      // is heavier and duller.
      case 'step':
        if (this._limited('step', 90)) return;
        this._noise(0.07, this._env(0.07, 0.045), 900 + Math.random() * 300, 180);
        this._osc('sine', 120 + Math.random() * 30, 70, 0.06, this._env(0.06, 0.035));
        break;
      case 'stepHard':
        if (this._limited('stepHard', 90)) return;
        this._noise(0.09, this._env(0.09, 0.06), 700 + Math.random() * 200, 140);
        this._osc('sine', 105 + Math.random() * 25, 55, 0.08, this._env(0.08, 0.05));
        break;
      case 'order':
        this._tone(520, 0.07, 0, 0.06, 'triangle');
        this._tone(700, 0.11, 0.05, 0.06, 'triangle');
        break;
      case 'rally':
        this._tone(300, 0.12, 0, 0.08);
        this._tone(400, 0.12, 0.08, 0.08);
        this._tone(500, 0.18, 0.16, 0.09);
        break;
      // Losing the link to the base is the mode's one real alarm, so it is the one
      // cue allowed to be ugly: a detuned pair that beats against itself.
      case 'disconnect':
        this._osc('sawtooth', 240, 90, 0.55, this._env(0.55, 0.5));
        this._osc('sawtooth', 232, 87, 0.55, this._env(0.55, 0.5));
        this._noise(0.4, this._env(0.4, 0.4), 600, 120);
        break;
      case 'reconnect':
        this._tone(300, 0.12, 0, 0.07);
        this._tone(450, 0.18, 0.09, 0.08);
        break;
      case 'coin':
        if (this._limited('coin', 120)) return;
        this._tone(1050, 0.07, 0, 0.05, 'triangle');
        this._tone(1400, 0.1, 0.05, 0.05, 'triangle');
        break;
      case 'talent':
        this._tone(392, 0.12, 0, 0.09);
        this._tone(523, 0.12, 0.09, 0.09);
        this._tone(784, 0.28, 0.18, 0.1);
        break;
      case 'begin':
        this._tone(262, 0.5, 0, 0.08);
        this._tone(392, 0.5, 0.12, 0.08);
        this._tone(523, 0.8, 0.24, 0.1);
        break;
      case 'victory':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this._tone(f, 0.35, i * 0.13, 0.1));
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) => this._tone(f, 0.6, i * 0.3, 0.09));
        break;
      case 'boss':
        this._osc('sawtooth', 55, 110, 1.4, this._env(1.4, 0.18, 0.6, 2));
        this._osc('sawtooth', 82, 165, 1.4, this._env(1.4, 0.12, 0.6, 2));
        break;
    }
  }

  _ambient() {
    const ctx = this.ctx;
    // Slow evolving pad
    const padGain = ctx.createGain();
    padGain.gain.value = 0.05;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 420;
    padFilter.connect(padGain);
    padGain.connect(this.master);
    for (const [f, detune] of [[110, 0], [164.8, 4], [220, -6]]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(padFilter);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 190;
    lfo.connect(lfoGain);
    lfoGain.connect(padFilter.frequency);
    lfo.start();

    // Wind bed
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) {
      v = v * 0.98 + (Math.random() * 2 - 1) * 0.02;
      d[i] = v * 4;
    }
    const wind = ctx.createBufferSource();
    wind.buffer = buf;
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 320;
    wf.Q.value = 0.5;
    const wg = ctx.createGain();
    wg.gain.value = 0.05;
    wind.connect(wf);
    wf.connect(wg);
    wg.connect(this.master);
    wind.start();
    const wlfo = ctx.createOscillator();
    wlfo.frequency.value = 0.08;
    const wlg = ctx.createGain();
    wlg.gain.value = 0.025;
    wlfo.connect(wlg);
    wlg.connect(wg.gain);
    wlfo.start();
  }
}
