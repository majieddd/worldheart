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
PIANO = [(12, 45, '16be23a8378185f1b392600d3fa800a206945543866548640f7573534f76faf2'),
         (16, 53, 'f1a3a542cf70a13aa865ce130d50d72cd735449e605d1c5a45dc06b5a60b27fd'),
         (20, 61, '08242e8d1c865c8cdc794cc7921d3d9663bedb5a12bfefe0de13aaa86fd23133'),
         (24, 69, '916c3ec2d61fb421e74fb4866ef75d3ef17e9d88e9dc858da24159846489d33f'),
         (28, 77, 'a9fbd1af0703b294d3267f8f88fca4b4366e3b772f7d780acf2de1cbf2056355')]
REV = '440300901dfe9275fd84e0b7763af1f8443ae62e'
BASE = f'https://raw.githubusercontent.com/sgossner/VSCO-2-CE/{REV}/'
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
(OUT / 'VSCO-LICENSE.txt').write_bytes(fetch(CACHE.parent / 'vsco-LICENSE', BASE + 'LICENSE'))
provenance = []
for index, midi, digest in PIANO:
    name = f'Player_dyn1_rr1_{index:03}.wav'
    url = BASE + 'Keys/Upright%20Piano/' + name
    fetch(CACHE / name, url, digest)
    provenance.append(dict(file=name, midi=midi, sha256=digest, url=url))

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

def note(midi, duration=2.2):
    index, root, _ = min(PIANO, key=lambda p: abs(p[1] - midi))
    a = sample(f'Player_dyn1_rr1_{index:03}.wav', 2 ** ((midi-root)/12))
    a = finish(a, .34, duration)
    tail = min(int(.5 * SR), len(a))
    a[-tail:] *= np.linspace(1, 0, tail)
    return a

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
    arrays = [mix([(delay, sample(f'{family}_{take:03}.ogg', rate), gain)
                   for family, rate, gain, delay in recipe]) for take in range(3)]
    add(name, arrays, LEVELS.get(name, .42))
for name, pitches, peak in [('coin', [64, 71], .25), ('upgrade', [55, 62, 67, 71], .33),
                           ('victory', [48, 55, 64, 67, 74], .43)]:
    add(name, [mix([(i*.09, note(midi), .85**i) for i, midi in enumerate(pitches)])], peak)

def wav(path, a):
    assert np.isfinite(a).all() and np.max(np.abs(a)) < 1
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(np.round(a * 32767).astype('<i2').tobytes())

wav(OUT / 'impacts.wav', np.concatenate(chunks))
# Original 48-second sketch, short phrases and literal digital silence.
# Only the five documented upright piano recordings enter the score.
score = np.zeros(SR * 48)
events = [(0, 40, .55), (.35, 59, .52), (1.4, 66, .38), (3.0, 64, .44),
          (8, 43, .55), (8.7, 62, .52), (10, 69, .4), (11.6, 67, .42),
          (17, 36, .52), (17.8, 55, .45), (19.4, 64, .42), (21, 62, .36),
          (27, 38, .52), (27.65, 57, .46), (29.3, 64, .4), (30.6, 66, .36),
          (36, 40, .55), (36.8, 55, .45), (38.2, 59, .42), (40, 64, .33)]
for t, midi, gain in events:
    a = note(midi, 2.6) * gain
    i = int(t * SR); score[i:i+len(a)] += a
wav(OUT / 'piano-sketch.wav', score)
manifest = dict(version=1, source='CC0 material samples and upright piano; no vocal model',
    bank='impacts.wav', score='piano-sketch.wav', cues=cues, voiceLimit=12,
    pianoSources=provenance, pianoEvents=events, measurements=measurements)
manifest['files'] = {p.name: dict(bytes=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest())
                     for p in OUT.glob('*.wav')}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
print(json.dumps(dict(cues=len(cues), variants=len(measurements), files=manifest['files']), indent=2))
