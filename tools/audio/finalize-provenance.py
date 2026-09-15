"""Freeze exact screened delivery hashes and copy receipts into reviewable docs."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('screens', nargs='+')
args = p.parse_args()
out = Path('docs/qa/implementation/AUDIO-REVAMP')
records = json.loads(Path('audio/music-provenance.json').read_text(encoding='utf8'))
screens = [json.loads(Path(f).read_text(encoding='utf8')) for f in args.screens]
accepted = {'scope': screens[0]['scope'], 'model': screens[0]['model'], 'revision': screens[0]['revision'], 'threshold': .12, 'files': []}
assert set(records) == {'lobby', 'explore', 'battle', 'danger', 'victory', 'defeat'}
for key, record in records.items():
    delivered = Path('audio')/record['file']
    assert hashlib.sha256(delivered.read_bytes()).hexdigest() == record['sha256']
    matches = [(s, f) for s in screens for f in s['files'] if f['sha256'] == record['sha256']]
    assert matches, f'Missing final-file vocal screen for {key}'
    screen, match = matches[-1]
    assert screen['threshold'] == .12 and not match['flagged'], f'Rejected vocal screen for {key}'
    accepted['files'].append(match)
    receipt = Path(record['generationReceipt'])
    dest = out/'generation'/receipt.name
    dest.mkdir(parents=True, exist_ok=True)
    if receipt.resolve() != dest.resolve():
        for file in ['request.json', 'submitted.json', 'history.json']:
            shutil.copyfile(receipt/file, dest/file)
    record['generationReceipt'] = dest.as_posix()
    record['vocalScreening'] = {'status': 'below automated rejection threshold; human listening still pending', 'model': screen['model'], 'revision': screen['revision'], 'threshold': .12, 'maximumVocalScore': max(w['vocalScore'] for w in match['windows']), 'report': (out/'accepted-vocal-screen.json').as_posix()}
Path('audio/music-provenance.json').write_text(json.dumps(records, indent=2)+'\n', encoding='utf8')
(out/'accepted-vocal-screen.json').write_text(json.dumps(accepted, indent=2)+'\n', encoding='utf8')
print('Final delivery hashes, six vocal screens and six generation receipts verified')
