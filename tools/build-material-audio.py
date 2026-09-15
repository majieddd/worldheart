"""Build the opt-in listening draft. Python + numpy + FFmpeg, no voice model.

Source cache is outside publication. Immutable source hashes are checked before
rendering; the small lossless bank and provenance are the shipped artifacts.
"""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import urllib.request
import wave
import zipfile
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'artifacts/audio-restoration/sources'
OUT = ROOT / 'audio/material'
SR = 48000
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

def fetch(path, url, digest=None):
    if not path.exists():
        path.write_bytes(urllib.request.urlopen(url).read())
    data = path.read_bytes()
    if digest and hashlib.sha256(data).hexdigest() != digest:
        raise ValueError(f'Source hash mismatch: {path}')
    return data

archive = fetch(CACHE.parent / 'kenney_impact-sounds.zip',
    'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip',
    '029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8')
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    for name in z.namelist():
        if name.endswith('.ogg') or name.endswith('License.txt'):
            (CACHE / Path(name).name).write_bytes(z.read(name))
(OUT / 'KENNEY-LICENSE.txt').write_text('\n'.join(line.rstrip() for line in
    (CACHE / 'License.txt').read_text(encoding='utf-8').splitlines()) + '\n', encoding='utf-8', newline='\n')
decoded = {}
def sample(name, rate=1):
    if name not in decoded:
        raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(CACHE / name),
            '-af', 'highpass=f=35,lowpass=f=5200', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'])
        decoded[name] = np.frombuffer(raw, '<f4').astype(np.float64)
    a = decoded[name]
    return np.interp(np.arange(0, len(a), rate), np.arange(len(a)), a)

def finish(a, peak, limit=3):
    a = np.array(a[:int(SR * limit)], copy=True)
    a -= np.mean(a)
    a *= peak / max(np.max(np.abs(a)), 1e-9)
    edge = min(int(.006 * SR), len(a) // 2)
    tail = min(int(.09 * SR), len(a) // 3)
    a[:edge] *= np.linspace(0, 1, edge)
    a[-tail:] *= np.linspace(1, 0, tail)
    a[0] = a[-1] = 0
    return a

def mix(layers):
    out = np.zeros(max(int(t * SR) + len(a) for t, a, gain in layers))
    for t, a, gain in layers:
        i = int(t * SR)
        out[i:i+len(a)] += a * gain
    return out

# Low/mid material bodies with soft attacks. Variants change actual source take.
# No noise oscillator, synthesized pitched transient or artificial ambient bed.
RECIPES = {
    'click': [('impactWood_light', .95, 1, 0)],
    'build': [('impactWood_heavy', .86, 1, 0), ('impactMetal_light', .7, .16, .07)],
    'meleeHit': [('impactPunch_heavy', .92, 1, 0), ('impactWood_medium', .9, .3, .012)],
    'enemyHit': [('impactPunch_medium', .85, 1, 0)],
    'blocked': [('impactPlate_medium', .67, .45, 0), ('impactWood_heavy', .85, .65, 0)],
    'rifle': [('impactPunch_heavy', 1.08, 1, 0), ('impactMetal_light', .72, .12, .025)],
    'shot': [('impactWood_heavy', 1, .75, 0), ('impactPunch_medium', .9, 1, .004)],
    'mortar': [('impactPunch_heavy', .52, 1, 0), ('impactPlank_medium', .65, .45, .04)],
    'lob': [('impactPunch_medium', .62, 1, 0), ('impactWood_light', .78, .3, .05)],
    'explosion': [('impactPunch_heavy', .48, 1, 0), ('impactWood_heavy', .62, .65, .065), ('impactPlank_medium', .68, .4, .12)],
    'step': [('footstep_grass', .88, 1, 0)],
    'stepHard': [('footstep_wood', .92, 1, 0)],
    'land': [('impactPunch_medium', .65, .55, 0), ('footstep_concrete', .8, 1, .025)],
}
LEVELS = {'click': .18, 'step': .16, 'stepHard': .17, 'land': .36,
          'explosion': .66, 'mortar': .62, 'rifle': .48, 'shot': .44}
chunks, cues, cursor, measurements = [], {}, 0, []
def add(name, arrays, level):
    global cursor
    entries = []
    for a in arrays:
        a = finish(a, level)
        power = np.abs(np.fft.rfft(a)) ** 2
        high = np.fft.rfftfreq(len(a), 1/SR) >= 4000
        entries.append(dict(offset=cursor/SR, duration=len(a)/SR))
        measurements.append(dict(cue=name, peak=float(np.max(np.abs(a))),
            rms=float(np.sqrt(np.mean(a*a))), highEnergyFraction=float(power[high].sum()/power.sum())))
        gap = np.zeros(int(.06 * SR))
        chunks.extend([a, gap]); cursor += len(a) + len(gap)
    cues[name] = entries

for name, recipe in RECIPES.items():
    if name not in ['click', 'build', 'blocked', 'mortar', 'step', 'stepHard']: continue
    arrays = [mix([(delay, sample(f'{family}_{take:03}.ogg', rate), gain)
                   for family, rate, gain, delay in recipe]) for take in range(3)]
    add(name, arrays, LEVELS.get(name, .42))
# New combat/reward cues are authored separately; accepted PCM stays identical.
rpg = fetch(CACHE.parent / 'rpg.zip',
    'https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip',
    '6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b')
with zipfile.ZipFile(io.BytesIO(rpg)) as z:
    for name in z.namelist():
        if name.startswith('Audio/') and name.endswith('.ogg'):
            (CACHE / Path(name).name).write_bytes(z.read(name))

def clean(a, duration=.5):
    a = np.array(a[:int(duration*SR)], copy=True)
    # Remove quiet recording tail instead of normalizing room sound upward.
    block = 240
    gate=np.ones(len(a))
    for i in range(0, len(a), block):
        rms = np.sqrt(np.mean(a[i:i+block]**2))
        gate[i:i+block] = min(1, (rms / .018)**2)
    a *= np.convolve(np.pad(gate,(120,120),mode="edge"),np.ones(241)/241,mode="valid")
    # Smooth gate edges and leave true silence after the one-shot.
    return finish(a, .5, duration)

def tone(freq, duration, end=None, harmonics=(1,.2,.08)):
    t=np.arange(int(duration*SR))/SR
    phase=2*np.pi*(freq*t + ((end or freq)-freq)*t*t/(2*duration))
    a=sum(h*np.sin((i+1)*phase) for i,h in enumerate(harmonics))
    return a*np.exp(-t/(duration/4)) * np.minimum(1,t/.006)

def burst(duration, cutoff, seed):
    rng=np.random.default_rng(seed); a=rng.normal(0,1,int(duration*SR))
    f=np.fft.rfftfreq(len(a),1/SR)
    a=np.fft.irfft(np.fft.rfft(a)/(1+(f/cutoff)**6),n=len(a))
    return a*np.exp(-np.arange(len(a))/(SR*duration/5))

for kind in ['swordFlesh','swordArmor','swordWood','spearFlesh','twinFlesh','woodFlesh']:
    clips=[]
    for take in range(3):
        blade=clean(sample('knifeSlice2.ogg' if take%2 else 'knifeSlice.ogg',1+take*.025),.23)
        flesh=clean(sample('chop.ogg',.82+take*.035),.23)
        contact=clean(sample('impactPlate_medium_%03d.ogg'%take,.76),.3) if kind=='swordArmor' else flesh
        if kind in ['swordWood','woodFlesh']: contact=clean(sample('impactWood_medium_%03d.ogg'%take,.8),.27)
        layers=[(0,blade,.34 if kind=='woodFlesh' else .7),(.018,contact,.85)]
        if kind=='spearFlesh': layers=[(0,blade[:int(.09*SR)],.55),(.014,contact,.9)]
        if kind=='twinFlesh': layers.append((.08,blade,.38))
        clips.append(mix(layers))
    add(kind,clips,.43)
add('swing',[clean(sample('knifeSlice.ogg',1.1),.2),clean(sample('knifeSlice2.ogg',1.05),.2)],.16)
for name,freq,dur in [('creatureMite',330,.18),('creatureHusk',140,.27),('creatureAegis',85,.3),('creatureWisp',470,.25),('creatureColossus',62,.43)]:
    clips=[]
    for i in range(3):
        t=np.arange(int(dur*SR))/SR
        cry=tone(freq*(1+i*.025),dur,freq*.62,(1,.35,.12))*(.8+.2*np.sin(2*np.pi*37*t))
        clips.append(mix([(0,cry,.65),(.008,clean(sample('cloth%d.ogg'%(i+1),.8),dur),.15)]))
    add(name,clips,.24)
add('enemyAttack',[clean(sample('chop.ogg',.7+i*.04),.25) for i in range(3)],.32)
add('rifle',[mix([(0,burst(.15,2300,80+i),1.6),(0,tone(145,.19,54),.65),(.035,clean(sample('metalClick.ogg',.8),.09),.15)]) for i in range(3)],.54)
add('land',[mix([(0,tone(82,.27,37),.85),(.022,clean(sample('dropLeather.ogg',.83+i*.02),.27),.5),(.085,clean(sample('clothBelt.ogg',.9),.15),.15)]) for i in range(3)],.43)
# Original short, rounded mallet/brass-like reward motifs; no piano/choir/sample hiss.
for name,notes,spacing,duration,level in [('coin',[76,83],.07,.13,.26),('upgrade',[60,67,72,76],.09,.24,.34),('victory',[60,64,67,74,72],.15,.48,.43)]:
    add(name,[mix([(i*spacing,tone(440*2**((m-69)/12),duration,harmonics=(1,.16,.04)),.8**(i*.25)) for i,m in enumerate(notes)])],level)

def wav(path, a):
    assert np.isfinite(a).all() and np.max(np.abs(a)) < 1
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(np.round(a * 32767).astype('<i2').tobytes())

wav(OUT / 'impacts.wav', np.concatenate(chunks))
manifest = dict(version=2, source='CC0 material/RPG samples and original procedural one-shots; no vocal model',
    bank='impacts.wav', cues=cues, voiceLimit=12, measurements=measurements,
    approved=list('click build blocked mortar step stepHard'.split()),
    legacy=['shot','lob'], procedural=['explosion'])
manifest['files'] = {p.name: dict(bytes=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest())
                     for p in OUT.glob('*.wav')}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
print(json.dumps(dict(cues=len(cues), variants=len(measurements), files=manifest['files']), indent=2))
