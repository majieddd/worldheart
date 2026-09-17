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
        'adapterVersion':'2.0.0','faceBudget':a.face_budget,'frontAxis':'+Z',
        'inputPreparation':'preserve supplied alpha; center at 85 percent of a square canvas v1'}
    key=hashlib.sha256(json.dumps(provenance,sort_keys=True).encode()).hexdigest()
    cache=runtime/'studio-data/engine-cache'/key;cache.mkdir(parents=True,exist_ok=True)
    final=cache/'asset.glb';receipt=cache/'receipt.json'
    if receipt.exists() and final.exists():
        prior=json.loads(receipt.read_text('utf-8'))
        if prior.get('outputSha256')==sha(final):
            shutil.copy2(final,dest);shutil.copy2(receipt,dest.with_suffix('.json'));print(json.dumps({'cached':True,'output':str(dest)}));return
    os.environ.setdefault('HF_HUB_OFFLINE','1');os.environ.setdefault('HF_HOME',str(runtime/'hf-cache'))
    os.environ.setdefault('U2NET_HOME',str(runtime/'models/rembg'));os.environ.setdefault('ATTN_BACKEND','sdpa')
    sys.path.insert(0,str(host/'api'))
    spec=importlib.util.spec_from_file_location('modly_trellis_adapter',ext/'generator.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    gen=module.Trellis2GGUFGenerator(weights/('refine' if a.stage=='paint' else 'generate'),cache)
    original_prepare=gen._preprocess
    def prepare(image_bytes,fg_ratio,force_cpu=True):
        from PIL import Image
        image=Image.open(io.BytesIO(image_bytes)).convert('RGBA')
        if image.getextrema()[3][0] < 250:
            # A known cutout must not be segmented again: tiny fingers and the
            # contour can disappear. Foreground ratio uses the final square size.
            bounds=image.getchannel('A').point(lambda a:255 if a>16 else 0).getbbox()
            if not bounds:raise ValueError('Reference has no visible foreground')
            foreground=image.crop(bounds);size=max(image.size);scale=fg_ratio*size/max(foreground.size)
            foreground=foreground.resize(tuple(max(1,round(v*scale)) for v in foreground.size),Image.Resampling.LANCZOS)
            canvas=Image.new('RGB',(size,size),'white');canvas.paste(foreground,((size-foreground.width)//2,(size-foreground.height)//2),foreground.getchannel('A'))
            return canvas
        return original_prepare(image_bytes,fg_ratio,force_cpu=True)
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
    prepared=gen._preprocess(Path(a.image).read_bytes(),.85,force_cpu=True);prepared.save(cache/'condition.png')
    last=[None]
    def progress(percent,message):
        if message!=last[0]:print(json.dumps({'percent':percent,'message':message}),flush=True);last[0]=message
    try:
        gen.load()
        result=gen.generate(Path(a.image).read_bytes(),params,progress_cb=progress)
        import trimesh,numpy as np
        mesh=trimesh.load(result,force='mesh')
        if a.stage=='shape':
            import pymeshlab
            ms=pymeshlab.MeshSet();ms.add_mesh(pymeshlab.Mesh(vertex_matrix=mesh.vertices,face_matrix=mesh.faces.astype(np.int32)))
            ms.meshing_remove_duplicate_vertices();ms.meshing_remove_duplicate_faces();ms.meshing_remove_null_faces()
            if len(mesh.faces)>a.face_budget:ms.meshing_decimation_quadric_edge_collapse(targetfacenum=a.face_budget,preservetopology=True,preservenormal=True,preserveboundary=True,optimalplacement=True,planarquadric=True)
            cleaned=ms.current_mesh();mesh=trimesh.Trimesh(cleaned.vertex_matrix(),cleaned.face_matrix(),process=False)
            mesh.visual=trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(baseColorFactor=[205,205,197,255],metallicFactor=0,roughnessFactor=.9))
        mesh.apply_transform(np.diag([-1,1,-1,1]));bounds=mesh.bounds.copy();mesh.vertices-=np.array([(bounds[0,0]+bounds[1,0])/2,bounds[0,1],(bounds[0,2]+bounds[1,2])/2]);mesh.vertices*=2/(bounds[1,1]-bounds[0,1])
        mesh.export(final,include_normals=True)
        info={**provenance,'seconds':time.time()-stamp,'outputSha256':sha(final),'ownerApproved':False,'visualAcceptance':'pending'}
        receipt.write_text(json.dumps(info,indent=2),encoding='utf-8');shutil.copy2(final,dest);shutil.copy2(receipt,dest.with_suffix('.json'))
        print(json.dumps({'output':str(dest),'seconds':info['seconds'],'cached':False}),flush=True)
    finally:gen.unload()

if __name__=='__main__':main()
