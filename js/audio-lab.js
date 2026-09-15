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
  ['meleeHit', 'Melee impact', 'Blade contact changes with weapon and target'], ['creatureHit', 'Creature reaction', 'Changes with creature type'],
  ['blocked', 'Blocked strike', 'Lower plate resonance'], ['rifle', 'Rifle', 'Blast body with a short mechanical tail'],
  ['shot', 'Tower shot', 'Restored previous tower shot'], ['mortar', 'Mortar', 'Slower heavy launch'],
  ['lob', 'Lobber', 'Restored previous lobber'], ['explosion', 'Explosion', 'Previous explosion with a deeper body'],
  ['step', 'Grass step', 'Three material variations'], ['stepHard', 'Hard step', 'Three wood variations'],
  ['land', 'Landing', 'Low landing weight, leather and gear settle'], ['coin', 'Pickup', 'Short two-note mallet pickup'],
  ['upgrade', 'Upgrade', 'Playful ascending reward'], ['victory', 'Victory', 'Short celebratory fanfare'],
];
const status = document.querySelector('#status');
let serial = 0, timer, active = null;
const volume = () => +document.querySelector('#volume').value / 100;
function silence() {
  serial++; clearTimeout(timer); draft.stopVoices();
  for (const media of document.querySelectorAll("audio")) media.pause();
  for (const gain of referenceEnvelopes) gain.disconnect();
  referenceEnvelopes.clear();
  for (const engine of [previous, draft]) {
    if (engine.master) engine.master.gain.setTargetAtTime(0, engine.ctx.currentTime, .01);
  }
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
  engine.play(engine === previous && id === 'creatureHit' ? 'enemyHit' : id, context()); status.textContent = `${engine === draft ? 'Draft' : 'Previous'}: ${title}`;
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
    engine.play(engine === previous && id === 'creatureHit' ? 'enemyHit' : id, context()); status.textContent = `${engine === draft ? 'Draft' : 'Previous'}: ${title}`;
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
function context() {
  return Object.fromEntries(['family','material','target','creature'].map(key=>[key,document.querySelector('#'+key).value]));
}
const musicManifest = await fetch(new URL('audio/soundtrack/manifest.json', document.baseURI)).then(r=>r.json()).catch(()=>null);
if (musicManifest) for (const track of Object.values(musicManifest.tracks)) {
  const row=document.createElement('div'); row.className='track';
  const label=document.createElement('p');label.textContent=track.title;
  const media=document.createElement('audio');media.controls=true;media.preload='none';
  media.src=new URL('audio/soundtrack/'+track.file,document.baseURI).href;
  media.setAttribute('aria-label',track.title);
  media.onplay=()=>{for(const other of document.querySelectorAll('audio'))if(other!==media)other.pause();};
  row.append(label,media);document.querySelector('#tracks').append(row);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) silence(); });
window.addEventListener('pagehide', () => { silence(); draft.dispose(); previous.ctx?.close(); });
window.audioLab = { previous, draft }; // Explicit QA surface; no automatic playback.
