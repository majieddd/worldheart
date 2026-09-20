"""Prepare the two pinned CMU takes used by fitted production; reuse local bytes."""
import hashlib, json, runpy, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
    '07.asf': 'c29414591d76a34885bff0b04a2666bf9659f869751a2549591c55277cf95b04',
    '09.asf': 'be10dbce393fd60a2d322410032d618757afcc5bb2f7a508d887c5b0213f1897',
    '07_01.amc': '3ca8e8b834481c97c32e9dd555f8c9023e33b6c52d93c9d556c83570204bf3f2',
    '09_01.amc': '02c94e8c2d4d2ff05f9a784f06403700c2c9d7caedd9bd92b50284d1a05f2bee',
}

def prepare():
    folder = ROOT / 'artifacts/vey-pilot/mocap'
    folder.mkdir(parents=True, exist_ok=True)
    for name, expected in SOURCES.items():
        path = folder / name
        data = path.read_bytes() if path.exists() else urllib.request.urlopen(
            f'http://mocap.cs.cmu.edu/subjects/{name[:2]}/{name}', timeout=60).read()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError(f'{name}: motion source identity mismatch; existing data was preserved.')
        if not path.exists():
            path.write_bytes(data)
    runpy.run_path(str(Path(__file__).parent / 'pilots/vey/mocap.py'), init_globals={'MOTION_REPORT_DIR': str(folder)})
    receipt = {'sources': SOURCES, 'credit': 'The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.', 'scope': 'Two selected takes for derived character motion. Do not resell raw motion data standalone.'}
    (folder / 'source-receipt.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')

if __name__ == '__main__':
    prepare()
