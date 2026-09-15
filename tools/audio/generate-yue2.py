"""Submit the reviewed video workflow to a separately installed local ComfyUI.

Weights never enter the game repository. Only stock upstream YuE2/audio nodes
are used. Each request/history is preserved; this is not a listening approval.
"""
import argparse
import json
import time
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8188')
parser.add_argument('--track', default='lobby')
parser.add_argument('--seconds', type=float)
parser.add_argument('--seed', type=int)
parser.add_argument('--out', default='artifacts/audio-revamp/generation')
args = parser.parse_args()
brief = json.loads(Path('tools/audio/music-briefs.json').read_text(encoding='utf8'))
track = next(t for t in brief['tracks'] if t['key'] == args.track)
seconds = args.seconds or track['seconds']
seed = args.seed if args.seed is not None else track['seed']
style = track['style'] + ' ' + brief['styleSuffix']
lyrics = track['arrangement']
node = lambda kind, **inputs: {'class_type': kind, 'inputs': inputs}
prompt = {
    '1': node('CheckpointLoaderSimple', ckpt_name=brief['checkpoint']),
    '2': node('YuE2GenerateABC', clip=['1', 1], style=style, lyrics=lyrics,
              seed=seed, mode='full', max_abc_tokens=2048, temperature=.7,
              top_p=.9, top_k=30, repetition_penalty=1.005, penalty_window=100),
    '3': node('YuE2GenerateMusic', clip=['1', 1], style=style, lyrics=lyrics,
              abc=['2', 0], seed=seed+1, mode='full', max_duration=seconds,
              temperature=1., top_p=.95, top_k=100, repetition_penalty=1.2),
    '4': node('EmptyYuE2LatentAudio', seconds=['3', 1], batch_size=1),
    '5': node('KSampler', model=['1', 0], positive=['3', 0], negative=['3', 0],
              latent_image=['4', 0], seed=seed+2, steps=32, cfg=1.,
              sampler_name='dpm_2', scheduler='sgm_uniform', denoise=1.),
    '6': node('VAEDecodeAudioTiled', samples=['5', 0], vae=['1', 2],
              tile_size=512, overlap=64),
    '7': node('SaveAudio', audio=['6', 0], filename_prefix=f'worldheart/{track["key"]}-{seed}'),
}
out = Path(args.out) / f'{track["key"]}-{seed}-{seconds:g}s'
out.mkdir(parents=True, exist_ok=True)
receipt = {'brief': brief, 'track': track, 'seconds': seconds, 'seed': seed,
           'prompt': prompt, 'listeningAcceptance': 'pending', 'vocalAcceptance': 'pending'}
(out/'request.json').write_text(json.dumps(receipt, indent=2), encoding='utf8')
request = urllib.request.Request(args.url+'/prompt', data=json.dumps({'prompt': prompt}).encode(), headers={'Content-Type': 'application/json'})
try:
    response = json.load(urllib.request.urlopen(request, timeout=30))
except urllib.error.HTTPError as error:
    print(error.read().decode(), flush=True)
    raise
(out/'submitted.json').write_text(json.dumps(response, indent=2), encoding='utf8')
identity = response['prompt_id']
print('SUBMITTED', identity, str(out), flush=True)
start = time.monotonic()
while True:
    history = json.load(urllib.request.urlopen(args.url+'/history/'+identity, timeout=30))
    if identity in history:
        (out/'history.json').write_text(json.dumps(history[identity], indent=2), encoding='utf8')
        print('FINISHED', round(time.monotonic()-start), 'seconds', str(out), flush=True)
        if history[identity].get('status', {}).get('status_str') != 'success':
            raise RuntimeError('Generation failed; inspect retained history')
        break
    time.sleep(5)
