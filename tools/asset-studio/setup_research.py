"""Verify pinned local research dependencies and resume their model downloads."""
import argparse
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path
import requests
from download_verified import download,sha256


def setup(runtime,verify_only=False):
    runtime=Path(runtime).resolve();lock=json.loads(Path(__file__).with_name('research-lock.json').read_text())
    began=time.perf_counter();steps=[]
    for item in lock['repos']:
        path=runtime/item['path']
        if not path.exists() and not verify_only:
            subprocess.run(['git','clone','--no-checkout',item['url'],str(path)],check=True)
            subprocess.run(['git','-C',str(path),'checkout',item['commit']],check=True)
        actual=subprocess.check_output(['git','-C',str(path),'rev-parse','HEAD'],text=True).strip()
        if actual!=item['commit']:raise ValueError(f'{path.name} differs from the pinned revision; preserve it and use a separate runtime.')
        if item.get('submodules') and not verify_only:subprocess.run(['git','-c','core.longpaths=true','-C',str(path),'submodule','update','--init','--recursive'],check=True)
    for item in lock['files']:
        path=runtime/item['path'];start=time.perf_counter()
        if item.get('sha256'):
            if verify_only:
                if path.stat().st_size!=item['size'] or sha256(path)!=item['sha256']:raise ValueError('Model identity mismatch: '+item['path'])
            else:download(item['url'],path,item['size'],item['sha256'],workers=6)
        else:
            data=path.read_bytes() if path.exists() else None
            if data is None and not verify_only:
                response=requests.get(item['url'],timeout=40);response.raise_for_status();data=response.content
            if data is None or len(data)!=item['size'] or hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()!=item['gitBlob']:
                raise ValueError('Small-file identity mismatch: '+item['path'])
            if not path.exists():path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
        steps.append({'file':item['path'],'seconds':time.perf_counter()-start})
    probes={
        'mia':('mia-env',"import bpy; import torch, torch_cluster; print(bpy.app.version_string,torch.__version__,torch.cuda.is_available())"),
        'instantmesh':('instantmesh-env',"import torch,diffusers,transformers,nvdiffrast.torch,xatlas,omegaconf; print(torch.__version__,diffusers.__version__,transformers.__version__,torch.cuda.is_available())")}
    results={}
    for name,(env,code) in probes.items():
        result=subprocess.run([str(runtime/env/'Scripts/python.exe'),'-c',code],capture_output=True,text=True)
        if result.returncode:raise RuntimeError(name+' environment probe failed: '+result.stderr[-1800:])
        results[name]={'runtimeVerified':True,'probe':result.stdout.strip(),'visualAcceptance':'per-asset review required'}
    template=runtime/'make-it-animatable-v2/data/Mixamo/bones.fbx'
    if not template.exists():
        if verify_only:raise ValueError('Missing Mixamo rest skeleton. Run setup once to derive it from the pinned public run reference.')
        motion=runtime/'studio-data/motion-library/standard-run.npz';motion.parent.mkdir(parents=True,exist_ok=True)
        subprocess.run([str(runtime/'blender-py311/Scripts/python.exe'),str(Path(__file__).with_name('mixamo_extract.py')),
            '--input',str(runtime/'make-it-animatable-v2/data/Standard Run.fbx'),'--output',str(motion),'--template',str(template),'--name','Mixamo Standard Run'],check=True)
    report={**results,'seconds':time.perf_counter()-began,'files':steps,'lockSha256':sha256(Path(__file__).with_name('research-lock.json'))}
    target=runtime/'studio-data/research-runtime.json';target.parent.mkdir(exist_ok=True)
    if target.exists():
        previous=json.loads(target.read_text())
        for name in probes:report[name]={**previous.get(name,{}),**report[name]}
    target.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'status':'verified','files':len(steps),'seconds':report['seconds']}))


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('runtime');p.add_argument('--verify-only',action='store_true');a=p.parse_args();setup(a.runtime,a.verify_only)
