"""Install pinned multiview weights without changing the single-image model."""
import argparse
import hashlib
import json
from pathlib import Path
import requests
from download_verified import download

REVISION='3a761b539b29fe4ff64714813aa9560fd66f5de0'
SHA='d36f5881bcdc56726b73e517cd444c13c60732431622da7268145355c8d38e9c'
def install(runtime):
    root=Path(runtime)/'models/Hunyuan3D-2mv/hunyuan3d-dit-v2-mv';root.mkdir(parents=True,exist_ok=True)
    base='https://huggingface.co/tencent/Hunyuan3D-2mv/resolve/'+REVISION+'/hunyuan3d-dit-v2-mv/'
    r=requests.get(base+'config.yaml',timeout=30);r.raise_for_status()
    blob=hashlib.sha1(b'blob '+str(len(r.content)).encode()+b'\0'+r.content).hexdigest()
    if blob!='7a9b1f3b1ca62e16a24257b8e8328573d299c5e4':raise RuntimeError('Config identity mismatch')
    (root/'config.yaml').write_bytes(r.content)
    receipt=download(base+'model.fp16.safetensors',root/'model.fp16.safetensors',4928151562,SHA,workers=2)
    receipt.update(revision=REVISION,model='tencent/Hunyuan3D-2mv',installed=True,runtimeVerified=False)
    (root.parent/'installation.json').write_text(json.dumps(receipt,indent=2))
    print(json.dumps(receipt))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--runtime',required=True);a=p.parse_args();install(a.runtime)
