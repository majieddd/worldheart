"""Repeatable numeric audio review. These measurements do not certify listening."""
from pathlib import Path
import hashlib
import json
import subprocess
import wave
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/homeworld/audio'
OUT.mkdir(parents=True,exist_ok=True)
manifest=json.loads((ROOT/'audio/combat-drafts/manifest.json').read_text(encoding='utf-8'))
checks=[]
for track in manifest['tracks']:
    path=ROOT/'audio/combat-drafts'/track['file']
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-acodec','pcm_f32le','-ar','24000','-ac','1','-'])
    data=np.frombuffer(raw,dtype='<f4');peak=float(np.max(np.abs(data)))
    windows=[float(np.sqrt(np.mean(a*a))) for a in np.array_split(data,max(1,len(data)//24000))]
    checks.append(dict(name=track['id']+' decoded duration, finite PCM, headroom and sustained content',
        status='pass' if np.isfinite(data).all() and 90<=len(data)/24000<=96.2 and .01<peak<.8 and sum(v<.001 for v in windows)<8 else 'fail',
        sha256=hashlib.sha256(path.read_bytes()).hexdigest(),seconds=len(data)/24000,peak=peak,
        quietOneSecondWindows=sum(v<.001 for v in windows),measuredLUFS=track['measuredLUFS'],truePeakDBTP=track['truePeakDBTP']))
m=json.loads((ROOT/'audio/material/manifest.json').read_text(encoding='utf-8'))
with wave.open(str(ROOT/'audio/material/impacts.wav'),'rb') as w:
    pcm=w.readframes(w.getnframes());sr=w.getframerate()
locks=json.loads((ROOT/'tools/approved-audio-locks.json').read_text(encoding='utf-8'))
for cue,expected in locks.items():
    actual=[hashlib.sha256(pcm[round(c['offset']*sr)*2:round((c['offset']+c['duration'])*sr)*2]).hexdigest() for c in m['cues'][cue]]
    checks.append(dict(name=cue+' owner-approved PCM unchanged',status='pass' if actual==expected else 'fail'))
for cue in ['rifle','swordFlesh','swordArmor','swordWood','spearFlesh','twinFlesh']:
    records=[x for x in m['measurements'] if x['cue']==cue]
    checks.append(dict(name=cue+' bounded peak and treble energy',status='pass' if all(x['peak']<.65 and x['highEnergyFraction']<.08 for x in records) else 'fail',variants=records))
report=dict(status='pass' if all(c['status']=='pass' for c in checks)else 'fail',
    scope='Technical measurements only. No listening, voice-absence, genre or perceived-quality certification.',checks=checks)
(OUT/'measurements.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(status=report['status'],checks=len(checks),failed=[c['name']for c in checks if c['status']!='pass'])))
raise SystemExit(0 if report['status']=='pass' else 1)
