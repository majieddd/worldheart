"""Resume large model downloads in bounded ranges and verify published SHA-256.

Some connections terminate long responses after tens of MB. Range parts remain
on disk after failure; completed files are accepted only by the upstream hash.
This does not supply credentials or bypass gated model/dataset access.
"""
import argparse
import concurrent.futures
import hashlib
import json
import time
from pathlib import Path

import requests


def sha256(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(8*1024*1024), b''):
            value.update(chunk)
    return value.hexdigest()


def download(url, path, size, expected, workers=4, part_size=8*1024*1024):
    path = Path(path).resolve()
    if not url.startswith('https://') or len(expected) != 64 or size <= 0:
        raise ValueError('HTTPS source, expected byte count and upstream SHA-256 are required.')
    if path.exists():
        if path.stat().st_size == size and sha256(path) == expected:
            return {'status': 'cached', 'file': str(path), 'sha256': expected, 'seconds': 0}
        raise ValueError(f'Existing file differs from upstream identity: {path.name}')
    started = time.perf_counter()
    path.parent.mkdir(parents=True, exist_ok=True)
    parts = path.parent / ('.'+path.name+'.parts')
    parts.mkdir(exist_ok=True)
    contract = {'url': url, 'size': size, 'sha256': expected, 'partSize': part_size}
    manifest = parts / 'source.json'
    if manifest.exists() and json.loads(manifest.read_text('utf-8')) != contract:
        raise ValueError('Partial download belongs to a different source.')
    manifest.write_text(json.dumps(contract), encoding='utf-8')

    def fetch(start):
        end = min(size-1, start+part_size-1)
        part = parts / f'{start:012}.part'
        if part.exists() and part.stat().st_size == end-start+1:
            return part
        for attempt in range(3):
            try:
                with requests.get(url, headers={'Range': f'bytes={start}-{end}',
                        'Accept-Encoding': 'identity'}, stream=True, timeout=(15, 30)) as response:
                    response.raise_for_status()
                    if response.status_code != 206 or response.headers.get('Content-Range') != f'bytes {start}-{end}/{size}':
                        raise ValueError('Server did not honor the exact byte range; file rejected.')
                    with part.open('wb') as out:
                        for block in response.iter_content(256*1024):
                            out.write(block)
                    if part.stat().st_size != end-start+1:
                        raise ValueError('Incomplete range response')
                return part
            except (requests.RequestException, ValueError):
                if attempt == 2:
                    raise
        raise RuntimeError('Unreachable download state')

    starts = list(range(0, size, part_size))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        for count, _ in enumerate(pool.map(fetch, starts), 1):
            if count == 1 or count % 16 == 0 or count == len(starts):
                print(f'{path.name}: {count}/{len(starts)} verified-length parts', flush=True)
    assembled = parts / 'assembled'
    with assembled.open('wb') as out:
        for start in starts:
            with (parts/f'{start:012}.part').open('rb') as src:
                for block in iter(lambda: src.read(1024*1024), b''):
                    out.write(block)
    actual = sha256(assembled)
    if actual != expected:
        raise ValueError(f'Upstream SHA-256 mismatch; retained parts and did not install {path.name}')
    assembled.replace(path)
    # Only verified individual parts from this exact download are disposable.
    for start in starts:
        (parts/f'{start:012}.part').unlink()
    report = {**contract, 'status': 'downloaded', 'file': str(path), 'seconds': time.perf_counter()-started}
    path.with_suffix(path.suffix+'.receipt.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--size', type=int, required=True)
    parser.add_argument('--sha256', required=True)
    args = parser.parse_args()
    print(json.dumps(download(args.url, args.output, args.size, args.sha256)))
