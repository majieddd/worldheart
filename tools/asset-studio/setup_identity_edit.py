"""Pinned local identity-edit nodes and weights; restart ComfyUI when idle."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from huggingface_hub import hf_hub_download

COMMIT='86f886dac23013d88996e3a2e99093ba44d322fb'
REVISION='89e9e7a09ee2e5c9331e952063d79b1b8a703280'
SHA='6adf9a69cc9502d286db7b69964d37da7e9cfe4b05b4d004bc275f087d3fd3cf'
def install(runtime):
    root=Path(runtime).resolve();nodes=root/'ComfyUI/custom_nodes/comfyui-krea2edit'
    if not nodes.exists():subprocess.run(['git','clone','https://github.com/lbouaraba/comfyui-krea2edit',str(nodes)],check=True)
    if subprocess.check_output(['git','-C',str(nodes),'status','--porcelain'],text=True).strip():raise RuntimeError('Preserve local node edits before updating the pinned source')
    subprocess.run(['git','-C',str(nodes),'fetch','origin',COMMIT],check=True)
    subprocess.run(['git','-C',str(nodes),'checkout','--detach',COMMIT],check=True)
    file=Path(hf_hub_download('conradlocke/krea2-identity-edit','krea2_identity_edit_v1_2.safetensors',revision=REVISION,local_dir=root/'ComfyUI/models/loras'))
    h=hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda:stream.read(8*1024*1024),b''):h.update(chunk)
    if h.hexdigest()!=SHA:raise RuntimeError('Identity weights failed integrity check')
    report={'revision':REVISION,'nodeCommit':COMMIT,'sha256':SHA,'runtimeVerified':False,'note':'Restart idle ComfyUI, then run a reference-angle trial through Studio. Installation is not visual acceptance.'}
    (root/'studio-data/krea-identity-install.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--runtime',required=True);a=p.parse_args();install(a.runtime)
