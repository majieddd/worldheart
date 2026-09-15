"""Derive a level-matched, wrapped loop from an actual local YuE2 FLAC.
Never overwrites the generation. Requires a successful retained Comfy history.
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path
import numpy as np

p = argparse.ArgumentParser()
p.add_argument('key')
p.add_argument('source')
p.add_argument('receipt', help='Directory containing request.json and history.json')
args = p.parse_args()
source = Path(args.source)
receipt = Path(args.receipt)
request = json.loads((receipt/'request.json').read_text(encoding='utf8'))
history = json.loads((receipt/'history.json').read_text(encoding='utf8'))
assert history['status']['status_str'] == 'success'
assert source.name == history['outputs']['7']['audio'][0]['filename'], 'Source must be the retained generation output'
assert request['track']['key'] == args.key
assert request['brief']['checkpointSha256'] == '33765adbf9813c9a50318218760b2fd819a319862460a04884607581961c6fee'
meta = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(source)]))['streams'][0]
assert meta['sample_rate'] == '48000' and meta['channels'] == 2, meta
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
originals = Path('artifacts/audio-revamp/originals')
originals.mkdir(parents=True, exist_ok=True)
shutil.copyfile(source, originals/(args.key+'-'+source_hash[:12]+'.flac'))
pcm = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(source), '-f', 'f32le', '-ac', '2', '-ar', '48000', '-'])
data = np.frombuffer(pcm, dtype='<f4').reshape(-1, 2)
assert np.isfinite(data).all() and len(data) > 48000*18
duration = len(data)/48000
# Gentle offline phrase leveling keeps the generated long crescendo from hiding
# early exploration phrases. An eight-second envelope preserves note attacks;
# gain is bounded to six dB and never follows individual beats.
centers = np.arange(0, len(data)+48000, 48000)
power = np.mean(data.astype(np.float64)**2, axis=1)
integral = np.concatenate([[0], np.cumsum(power)])
lo = np.maximum(0, centers-4*48000)
hi = np.minimum(len(data), centers+4*48000)
levels = 10*np.log10(np.maximum(1e-10, (integral[hi]-integral[lo])/np.maximum(1, hi-lo)))
gain_db = np.clip(np.median(levels)-levels, -6, 6)
envelope = 10**(np.interp(np.arange(len(data)), centers, gain_db)/20)
data = (data*envelope[:, None]).astype('<f4')
fade = int(min(1.6, duration/8)*48000)
phase = np.linspace(0, np.pi/2, fade, dtype=np.float32)[:, None]
seam = data[-fade:]*np.cos(phase) + data[:fade]*np.sin(phase)
loop = np.concatenate([data[fade:-fade], seam]).astype('<f4')
raw = originals/(args.key+'-loop.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', '-', '-c:a', 'pcm_f32le', str(raw)], input=loop.tobytes(), check=True)
analysis = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(raw), '-af', 'loudnorm=I=-20:TP=-2:LRA=50:print_format=json', '-f', 'null', '-'], capture_output=True, text=True, check=True)
stats = json.loads(re.findall(r'\{\s*"input_i"[\s\S]*?\}', analysis.stderr)[-1])
assert float(stats['input_i']) > -60, stats
filter_text = 'loudnorm=I=-20:TP=-2:LRA=50:linear=true:print_format=json:' + ':'.join([
    'measured_I='+stats['input_i'], 'measured_TP='+stats['input_tp'],
    'measured_LRA='+stats['input_lra'], 'measured_thresh='+stats['input_thresh'],
    'offset='+stats['target_offset'],
])
target = Path('audio')/(args.key+'.mp3')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(raw), '-af', filter_text,
                '-ar', '48000', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '192k',
                '-write_xing', '1', str(target)], check=True)
after = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(target), '-af', 'loudnorm=I=-20:TP=-2:LRA=8:print_format=json', '-f', 'null', '-'], capture_output=True, text=True, check=True)
measured = json.loads(re.findall(r'\{\s*"input_i"[\s\S]*?\}', after.stderr)[-1])
assert float(measured['input_tp']) < -.8 and abs(float(measured['input_i'])+20) < 1.5, measured
record = {
    'key': args.key, 'title': request['track']['title'], 'file': target.name,
    'model': request['brief']['model'], 'modelRevision': request['brief']['modelRevision'],
    'checkpointSha256': request['brief']['checkpointSha256'],
    'runtime': request['brief']['runtime'], 'runtimeRevision': request['brief']['runtimeRevision'],
    'license': request['brief']['license'], 'seed': request['seed'],
    'sourceSha256': source_hash, 'sourceSeconds': duration, 'seconds': len(loop)/48000,
    'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'bytes': target.stat().st_size,
    'processing': '8s phrase leveling bounded to +/-6dB; 1.6s equal-power wrap; two-pass -20 LUFS / -2 dBTP target with remaining dynamics preserved; 48kHz stereo 192k MP3',
    'measured': measured, 'generationReceipt': receipt.as_posix(),
    'vocalScreening': 'pending', 'humanListening': 'pending; agent audio input unavailable',
}
manifest = Path('audio/music-provenance.json')
records = json.loads(manifest.read_text(encoding='utf8')) if manifest.exists() else {}
records[args.key] = record
manifest.write_text(json.dumps(records, indent=2)+'\n', encoding='utf8')
tracks = {key: {k: r[k] for k in ['title', 'file', 'seconds', 'sha256', 'bytes']} for key, r in records.items()}
Path('js/audio-music.js').write_text('// Actual local YuE2 generations. See audio/music-provenance.json.\nexport const MUSIC_TRACKS='+json.dumps(tracks, separators=(',', ':'))+';\n', encoding='utf8')
print(json.dumps(record, indent=2))
