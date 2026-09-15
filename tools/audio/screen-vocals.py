"""Conservative event-classifier screen. This is not a human listening proof."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path
import numpy as np
import torch
from transformers import AutoFeatureExtractor, AutoModelForAudioClassification

parser = argparse.ArgumentParser()
parser.add_argument('files', nargs='+')
parser.add_argument('--out', default='artifacts/audio-revamp/vocal-screen.json')
args = parser.parse_args()
identity = 'MIT/ast-finetuned-audioset-10-10-0.4593'
revision = 'f826b80d28226b62986cc218e5cec390b1096902'
torch.set_num_threads(4)
extractor = AutoFeatureExtractor.from_pretrained(identity, revision=revision, trust_remote_code=False)
model = AutoModelForAudioClassification.from_pretrained(identity, revision=revision, use_safetensors=True, trust_remote_code=False).eval()
labels = model.config.id2label
pattern = re.compile(r'speech|singing|vocal music|choir|chant|humming|rapping|yodel|whisper|narrat|conversation|mantra', re.I)
vocal_ids = [int(i) for i, label in labels.items() if pattern.search(label) and 'bowl' not in label.lower()]
report = {'model': identity, 'revision': revision, 'scope': 'Automated vocal-risk screen, not a guarantee of no voice and not subjective listening acceptance.', 'threshold': .12, 'vocalLabels': [labels[i] for i in vocal_ids], 'files': []}
for filename in args.files:
    path = Path(filename)
    pcm = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'])
    data = np.frombuffer(pcm, dtype='<f4').copy()
    windows = []
    for start in range(0, len(data), 5*16000):
        segment = data[start:start+10*16000]
        if len(segment) < 16000:
            continue
        inputs = extractor(segment, sampling_rate=16000, return_tensors='pt')
        with torch.no_grad():
            scores = model(**inputs).logits.sigmoid()[0]
        rank = scores.argsort(descending=True)[:6].tolist()
        vocal = max(vocal_ids, key=lambda i: scores[i])
        windows.append({'start': start/16000, 'vocalLabel': labels[vocal], 'vocalScore': float(scores[vocal]), 'top': [{'label': labels[i], 'score': float(scores[i])} for i in rank]})
    record = {'file': path.as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'seconds': len(data)/16000, 'windows': windows, 'flagged': any(w['vocalScore'] >= .12 for w in windows)}
    report['files'].append(record)
    print(path.name, 'FLAGGED' if record['flagged'] else 'below threshold', max(w['vocalScore'] for w in windows), flush=True)
Path(args.out).parent.mkdir(parents=True, exist_ok=True)
Path(args.out).write_text(json.dumps(report, indent=2)+'\n', encoding='utf8')
