import { AudioEngine } from './audio.js';
import { MaterialAudio } from './audio-material.js';

const previous = new AudioEngine();
previous._ambient = () => {}; // Isolate cue comparison only; normal game unchanged.
const referenceEnvelopes = new Set();
const originalEnvelope = previous._env;
previous._env = function (...args) {
  const gain = originalEnvelope.apply(this, args);
  referenceEnvelopes.add(gain);
  setTimeout(() => { referenceEnvelopes.delete(gain); gain.disconnect(); }, (args[0] + 1) * 1000);
  return gain;
};
const draft = new MaterialAudio();
const cues = [
  ['click', 'Menu click', 'Small wooden contact'], ['build', 'Build tower', 'Wood body and muted metal latch'],
  ['meleeHit', 'Melee impact', 'Weight in the middle of the impact'], ['enemyHit', 'Creature hit', 'Soft body contact'],
  ['blocked', 'Blocked strike', 'Lower plate resonance'], ['rifle', 'Rifle', 'Compact impact with a mechanical tail'],
  ['shot', 'Tower shot', 'Wood and punch body'], ['mortar', 'Mortar', 'Slower heavy launch'],
  ['lob', 'Lobber', 'Rounded mechanical launch'], ['explosion', 'Explosion', 'Staggered material impacts'],
  ['step', 'Grass step', 'Three material variations'], ['stepHard', 'Hard step', 'Three wood variations'],
  ['land', 'Landing', 'Concrete step and body weight'], ['coin', 'Pickup', 'Two soft piano notes'],
  ['upgrade', 'Upgrade', 'Rising piano voicing'], ['victory', 'Victory', 'Open piano chord'],
];
const status = document.querySelector('#status');
let serial = 0, timer, active = null;
const volume = () => +document.querySelector('#volume').value / 100;
function silence() {
  serial++; clearTimeout(timer); draft.stopVoices(); draft.setScore(false);
  for (const gain of referenceEnvelopes) gain.disconnect();
  referenceEnvelopes.clear();
  for (const engine of [previous, draft]) {
    if (engine.master) engine.master.gain.setTargetAtTime(0, engine.ctx.currentTime, .01);
  }
  document.querySelector('#piano').setAttribute('aria-pressed', 'false');
  document.querySelector('#piano').textContent = 'Play piano sketch';
  active = null;
}
async function select(engine) {
  silence(); const token = serial;
  engine.start(); active = engine;
  engine.master?.gain.setTargetAtTime(volume(), engine.ctx.currentTime, .01);
  if (engine === draft) {
    status.textContent = 'Loading draft effects...';
    if (!await draft.prepare()) { status.textContent = 'Draft could not load. Previous sounds remain available. Try again.'; return false; }
  }
  return token === serial;
}
async function play(engine, id, title) {
  if (!await select(engine)) return;
  engine.play(id); status.textContent = `${engine === draft ? 'Draft' : 'Previous'}: ${title}`;
}
for (const [id, title, detail] of cues) {
  const row = document.createElement('div'); row.className = 'cue';
  const label = document.createElement('div'); label.textContent = title;
  const small = document.createElement('small'); small.textContent = detail; label.append(small); row.append(label);
  for (const [engine, text] of [[previous, 'Previous'], [draft, 'Draft']]) {
    const button = document.createElement('button'); button.textContent = text;
    button.dataset.cue = id; button.dataset.engine = text.toLowerCase();
    button.setAttribute('aria-label', `${text}: ${title}`);
    button.onclick = () => play(engine, id, title); row.append(button);
  }
  document.querySelector('#cues').append(row);
}
async function sequence(engine) {
  if (!await select(engine)) return;
  const token = serial; let index = 0;
  const next = () => {
    if (token !== serial) return;
    if (index === cues.length) { status.textContent = 'Sequence complete.'; return; }
    const [id, title] = cues[index++];
    engine.play(id); status.textContent = `${engine === draft ? 'Draft' : 'Previous'}: ${title}`;
    timer = setTimeout(next, id === 'victory' || id === 'upgrade' ? 2800 : 1700);
  };
  next();
}
document.querySelector('#sequence-old').onclick = () => sequence(previous);
document.querySelector('#sequence-new').onclick = () => sequence(draft);
document.querySelector('#stop').onclick = () => { silence(); status.textContent = 'Stopped.'; };
document.querySelector('#volume').oninput = () => {
  document.querySelector('#level').value = `${Math.round(volume()*100)}%`;
  active?.master?.gain.setTargetAtTime(volume(), active.ctx.currentTime, .01);
};
document.querySelector('#piano').onclick = async () => {
  if (draft.scoreEnabled) { silence(); status.textContent = 'Piano stopped.'; return; }
  if (!await select(draft)) return;
  const token = serial; status.textContent = 'Loading piano sketch...';
  await draft.setScore(true);
  if (token !== serial) return;
  const ok = !!draft.scoreNode;
  document.querySelector('#piano').setAttribute('aria-pressed', String(ok));
  document.querySelector('#piano').textContent = ok ? 'Stop piano sketch' : 'Play piano sketch';
  status.textContent = ok ? 'Piano sketch playing. Instrument samples only.' : 'Piano could not load. Try again.';
};
document.addEventListener('visibilitychange', () => { if (document.hidden) silence(); });
window.addEventListener('pagehide', () => { silence(); draft.dispose(); previous.ctx?.close(); });
window.audioLab = { previous, draft }; // Explicit QA surface; no automatic playback.
