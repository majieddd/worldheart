"""Package the reviewed references and motion guidance; never infer owner approval."""
from pathlib import Path
import json
import zipfile

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / 'lib/99-art/vey-pilot-v1'
names = ['turnaround.png', 'front.png', 'left.png', 'right.png', 'back.png',
         'top.png', 'bottom.png', 'palette.svg', 'manifest.json',
         'portable-prompt.txt', 'rig-contract.json', 'motion-chart.json',
         'motion-source.json']
assert json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))['ownerApproved'] is False
with zipfile.ZipFile(OUT / 'reference-pack.zip', 'w', zipfile.ZIP_DEFLATED) as pack:
    for name in names:
        pack.write(OUT / name, name)
    pack.write(OUT.parent / 'identity-v2/gray-commander.png', 'hero.png')
with zipfile.ZipFile(OUT / 'reference-pack.zip') as pack:
    assert pack.testzip() is None
    for name in names:
        assert pack.read(name) == (OUT / name).read_bytes(), name
print(json.dumps({'entries': len(names) + 1, 'status': 'verified', 'ownerApproved': False}))
