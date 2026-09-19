"""Run Modly's open-source Trellis.2 extension locally, with resumable artifacts."""
import argparse, hashlib, importlib.util, io, json, os, shutil, subprocess, sys, time
from pathlib import Path

def main():
    p=argparse.ArgumentParser();p.add_argument('--runtime',required=True);p.add_argument('--image',required=True)
    p.add_argument('--output',required=True);p.add_argument('--stage',choices=['shape','paint'],default='shape')
    p.add_argument('--mesh');p.add_argument('--seed',type=int,default=99131);p.add_argument('--steps',type=int,default=25)
    p.add_argument('--resolution',default='1024_cascade');p.add_argument('--texture-size',type=int,default=2048)
    p.add_argument('--texture-steps',type=int,default=12);p.add_argument('--texture-guidance',type=float,default=1.0)
    p.add_argument('--face-budget',type=int,default=40000)
    a=p.parse_args();runtime=Path(a.runtime).resolve();dest=Path(a.output).resolve();dest.parent.mkdir(parents=True,exist_ok=True)
    ext=runtime/'modly-trellis2';host=runtime/'modly';weights=runtime/'models/trellis2'
    sha=lambda path:hashlib.sha256(Path(path).read_bytes()).hexdigest()
    commit=lambda path:subprocess.check_output(['git','-C',str(path),'rev-parse','HEAD'],text=True).strip()
    provenance={'engine':'Modly Trellis.2 GGUF','extensionCommit':commit(ext),'hostCommit':commit(host),
        'referenceSha256':sha(a.image),'meshSha256':sha(a.mesh) if a.mesh else None,
        'stage':a.stage,'seed':a.seed,'steps':a.steps,'resolution':a.resolution,'textureSize':a.texture_size,'textureSteps':a.texture_steps,'textureGuidance':a.texture_guidance,'quantization':'Q5_K_M',
        'weightsRepository':'Aero-Ex/Trellis2-GGUF','weightsRevision':(weights/'.cache/huggingface/download/pipeline.json.metadata').read_text('utf-8').splitlines()[0],
        'adapterVersion':'2.3.1','reductionCodeSha256':sha(Path(__file__).with_name('mesh_reduction.py')),'faceBudget':a.face_budget,'frontAxis':'+Z',
        'inputPreparation':'preserve supplied alpha; center at 85 percent of a square canvas v1'}
    key=hashlib.sha256(json.dumps(provenance,sort_keys=True).encode()).hexdigest()
    cache=runtime/'studio-data/engine-cache'/key;cache.mkdir(parents=True,exist_ok=True)
    final=cache/'asset.glb';receipt=cache/'receipt.json'
    if receipt.exists() and final.exists():
        prior=json.loads(receipt.read_text('utf-8'))
        if prior.get('outputSha256')==sha(final):
            shutil.copy2(final,dest);shutil.copy2(receipt,dest.with_suffix('.json'));print(json.dumps({'cached':True,'output':str(dest)}));return
    # Reconstruction and topology finishing are separate caches. A reduction
    # correction must not spend another full image-to-3D inference.
    raw_reuse=None;raw_cache=None
    if a.stage=='shape':
        keys=['referenceSha256','stage','seed','steps','resolution','quantization','weightsRevision','inputPreparation','extensionCommit','hostCommit']
        for folder in (runtime/'studio-data/engine-cache').iterdir():
            meta=folder/'running.json'
            if not meta.exists():continue
            prior=json.loads(meta.read_text('utf-8'))
            if all(prior.get(k)==provenance.get(k) for k in keys):
                candidates=[f for f in folder.glob('*.glb') if f.name!='asset.glb']
                if candidates:raw_reuse=max(candidates,key=lambda f:f.stat().st_size);raw_cache=folder;break
    os.environ.setdefault('HF_HUB_OFFLINE','1');os.environ.setdefault('HF_HOME',str(runtime/'hf-cache'))
    os.environ.setdefault('U2NET_HOME',str(runtime/'models/rembg'));os.environ.setdefault('ATTN_BACKEND','sdpa')
    sys.path.insert(0,str(host/'api'))
    spec=importlib.util.spec_from_file_location('modly_trellis_adapter',ext/'generator.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    gen=module.Trellis2GGUFGenerator(weights/('refine' if a.stage=='paint' else 'generate'),cache)
    original_prepare=gen._preprocess
    prepared_memory={}
    # Shape and paint use the same foreground. Reuse its exact conditioning
    # image across stages rather than rerunning the CPU segmentation model.
    prepared_disk=None
    for folder in (runtime/'studio-data/engine-cache').iterdir():
        meta=folder/'running.json';condition=folder/'condition.png'
        if not meta.exists() or not condition.exists():continue
        prior=json.loads(meta.read_text('utf-8'))
        if prior.get('referenceSha256')==provenance['referenceSha256'] and prior.get('inputPreparation')==provenance['inputPreparation']:
            prepared_disk=condition;break
    def prepare(image_bytes,fg_ratio,force_cpu=True):
        from PIL import Image
        prep_key=hashlib.sha256(image_bytes+str(fg_ratio).encode()).hexdigest()
        if prep_key in prepared_memory:return prepared_memory[prep_key].copy()
        if prepared_disk and fg_ratio==.85:
            prepared_memory[prep_key]=Image.open(prepared_disk).convert('RGB');return prepared_memory[prep_key].copy()
        image=Image.open(io.BytesIO(image_bytes)).convert('RGBA')
        if image.getextrema()[3][0] < 250:
            # A known cutout must not be segmented again: tiny fingers and the
            # contour can disappear. Foreground ratio uses the final square size.
            bounds=image.getchannel('A').point(lambda a:255 if a>16 else 0).getbbox()
            if not bounds:raise ValueError('Reference has no visible foreground')
            foreground=image.crop(bounds);size=max(image.size);scale=fg_ratio*size/max(foreground.size)
            foreground=foreground.resize(tuple(max(1,round(v*scale)) for v in foreground.size),Image.Resampling.LANCZOS)
            canvas=Image.new('RGB',(size,size),'white');canvas.paste(foreground,((size-foreground.width)//2,(size-foreground.height)//2),foreground.getchannel('A'))
            prepared_memory[prep_key]=canvas;return canvas.copy()
        prepared=original_prepare(image_bytes,fg_ratio,force_cpu=True)
        prepared_memory[prep_key]=prepared;return prepared.copy()
    gen._preprocess=prepare
    stamp=time.time();(cache/'running.json').write_text(json.dumps(provenance,indent=2),encoding='utf-8')
    params={'seed':a.seed,'gguf_quant':'Q5_K_M','pipeline_type':a.resolution,'ss_steps':a.steps,'slat_steps':a.steps,
        'foreground_ratio':.85,'remesh_resolution':768,'texture_resolution':1024,'texture_size':a.texture_size,'texture_steps':a.texture_steps,'texture_guidance':a.texture_guidance}
    if a.stage=='paint':
        if not a.mesh:raise ValueError('Paint requires a source mesh')
        # Modly exports the generated face toward -Z. The studio contract is +Z.
        # Return approved geometry to the engine convention for texturing.
        import trimesh,numpy as np
        mesh=trimesh.load(a.mesh,force='mesh');mesh.apply_transform(np.diag([-1,1,-1,1]))
        native=cache/'native-input.glb';mesh.export(native);params['mesh_path']=str(native)
    # Save the exact conditioning image for inspection, including mask/framing.
    print(json.dumps({'percent':2,'message':'Preparing the reference mask and framing'}),flush=True)
    if raw_reuse:shutil.copy2(raw_cache/'condition.png',cache/'condition.png')
    else:prepared=gen._preprocess(Path(a.image).read_bytes(),.85,force_cpu=True);prepared.save(cache/'condition.png')
    last=[None]
    def progress(percent,message):
        if message!=last[0]:print(json.dumps({'percent':round(percent*.85),'message':message}),flush=True);last[0]=message
    try:
        if raw_reuse:result=raw_reuse;print(json.dumps({'percent':85,'message':'Reusing saved raw reconstruction; correcting mesh reduction'}),flush=True)
        else:gen.load();result=gen.generate(Path(a.image).read_bytes(),params,progress_cb=progress)
        import trimesh,numpy as np
        mesh=trimesh.load(result,force='mesh')
        if a.stage=='shape':
            print(json.dumps({'percent':90,'message':'Reducing topology to the browser mesh budget; preserving silhouette'}),flush=True)
            from mesh_reduction import reduce_shape
            mesh,reduction=reduce_shape(mesh,a.face_budget)
            provenance['reduction']=reduction;provenance['rawSourceSha256']=sha(result);provenance['rawSourceFile']=str(result);provenance['rawInferenceReused']=bool(raw_reuse)
        mesh.apply_transform(np.diag([-1,1,-1,1]));bounds=mesh.bounds.copy();mesh.vertices-=np.array([(bounds[0,0]+bounds[1,0])/2,bounds[0,1],(bounds[0,2]+bounds[1,2])/2]);mesh.vertices*=2/(bounds[1,1]-bounds[0,1])
        print(json.dumps({'percent':97,'message':'Packing the portable mesh and recording provenance'}),flush=True)
        mesh.export(final,include_normals=True)
        info={**provenance,'seconds':time.time()-stamp,'outputSha256':sha(final),'ownerApproved':False,'visualAcceptance':'pending'}
        receipt.write_text(json.dumps(info,indent=2),encoding='utf-8');shutil.copy2(final,dest);shutil.copy2(receipt,dest.with_suffix('.json'))
        print(json.dumps({'output':str(dest),'seconds':info['seconds'],'cached':False}),flush=True)
        print(json.dumps({'percent':100,'message':'Portable asset saved'}),flush=True)
    finally:gen.unload()

if __name__=='__main__':main()
