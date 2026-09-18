"""Resumable acquisition of the authorized complete research motion library.

Run with Studio Python. Uses local HF login; never accepts a token argument.
Downloads original FBX captures, not retargeted output or trained model weights.
"""
import argparse
import hashlib
import json
import shutil
import time
from pathlib import Path
from huggingface_hub import HfApi, hf_hub_download, get_token

REPO='jasongzy/Mixamo'
REVISION='b1c7f4975ea3261d3d0aa2379f6e24754ccde9d8'

def sync(root, metadata_only=False):
    root=Path(root).resolve();root.mkdir(parents=True,exist_ok=True)
    started=time.perf_counter();token=get_token();api=HfApi(token=token)
    info=api.dataset_info(REPO,revision=REVISION,files_metadata=True)
    files=[f for f in info.siblings if f.rfilename.lower().endswith('.fbx')]
    manifest={'repo':REPO,'revision':REVISION,'kind':'original reference captures; not learned animation weights',
              'files':[{'path':f.rfilename,'bytes':f.size,'sha256':f.lfs.sha256 if f.lfs else None}for f in files],
              'status':'indexed','downloaded':0}
    target=root/'manifest.json'
    target.write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    if metadata_only:return manifest
    if not token:
        raise RuntimeError('Dataset inventory saved. Sign in locally with hf auth login using the account with approved dataset access. No token is printed or stored by this tool.')
    remaining=sum(f.size or 0 for f in files if not (root/f.rfilename).exists())
    if shutil.disk_usage(root).free < remaining+5*1024**3:
        raise RuntimeError('Insufficient disk space for the library plus 5 GB working reserve.')
    try:
        for f in files:
            path=Path(hf_hub_download(REPO,f.rfilename,repo_type='dataset',revision=REVISION,local_dir=root,token=token))
            if f.size and path.stat().st_size!=f.size:raise RuntimeError('Wrong byte count: '+f.rfilename)
            if f.lfs:
                h=hashlib.sha256()
                with path.open('rb')as stream:
                    for chunk in iter(lambda:stream.read(8*1024*1024),b''):h.update(chunk)
                if h.hexdigest()!=f.lfs.sha256:raise RuntimeError('Hash mismatch: '+f.rfilename)
            manifest['downloaded']+=1
            manifest['seconds']=round(time.perf_counter()-started,3)
            target.write_text(json.dumps(manifest,indent=2),encoding='utf-8')
            if manifest['downloaded']%50==0:print(json.dumps({'downloaded':manifest['downloaded'],'total':len(files)}),flush=True)
        manifest['status']='downloaded'
    except Exception:
        manifest['status']='interrupted';raise
    finally:
        manifest['seconds']=round(time.perf_counter()-started,3)
        target.write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--directory',required=True);p.add_argument('--metadata-only',action='store_true');a=p.parse_args()
    result=sync(a.directory,a.metadata_only)
    print(json.dumps({k:result[k] for k in ['status','downloaded','revision']}|{'total':len(result['files'])}))
