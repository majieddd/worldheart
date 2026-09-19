"""Pinned, local InstantMesh experiment with separately retained six-view input."""
import argparse
import gc
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path


def pack_mesh(obj, dest):
    import numpy as np
    import trimesh
    mesh=trimesh.load(obj,force='mesh',process=False)
    if mesh.visual.kind!='texture' or mesh.visual.uv is None:raise ValueError('Texture-map export did not survive OBJ packaging.')
    # InstantMesh camera/geometry space is Z-up; glTF and Studio are Y-up.
    mesh.apply_transform(np.array([[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]],dtype=float))
    bounds=mesh.bounds.copy();mesh.vertices-=np.array([(bounds[0,0]+bounds[1,0])/2,bounds[0,1],(bounds[0,2]+bounds[1,2])/2]);mesh.vertices*=2/(bounds[1,1]-bounds[0,1])
    mesh.export(dest,include_normals=True)
    return mesh


def run(task):
    started=time.perf_counter();runtime=Path(task['runtime']).resolve();repo=runtime/'InstantMesh'
    image=Path(task['image']).resolve();dest=Path(task['output']).resolve()
    if dest.exists():raise ValueError('Keep the previous candidate; choose another output name.')
    dest.parent.mkdir(parents=True,exist_ok=True)
    condition=Path(task['condition']).resolve() if task.get('condition') else None
    if condition is None:
        reference_hash=hashlib.sha256(image.read_bytes()).hexdigest()
        for folder in (runtime/'studio-data/engine-cache').glob('*'):
            metadata=folder/'running.json';prepared=folder/'condition.png'
            if metadata.exists() and prepared.exists() and json.loads(metadata.read_text('utf-8')).get('referenceSha256')==reference_hash:
                condition=prepared;break
        if condition is None:
            from PIL import Image
            supplied=Image.open(image).convert('RGBA');alpha=supplied.getchannel('A')
            if alpha.getextrema()[0]>=250:
                raise ValueError('Prepare the primary Modly shape first to save its foreground mask, or supply a transparent concept. An opaque background is not silently passed into reconstruction.')
            bounds=alpha.point(lambda a:255 if a>16 else 0).getbbox()
            if not bounds:raise ValueError('Concept has no visible foreground.')
            foreground=supplied.crop(bounds);size=max(supplied.size);scale=.85*size/max(foreground.size)
            foreground=foreground.resize(tuple(max(1,round(v*scale)) for v in foreground.size),Image.Resampling.LANCZOS)
            canvas=Image.new('RGB',(size,size),'white');canvas.paste(foreground,((size-foreground.width)//2,(size-foreground.height)//2),foreground.getchannel('A'))
            condition=dest.with_suffix('.condition.png');canvas.save(condition)
    sys.path.insert(0,str(repo));os.environ['HF_HUB_OFFLINE']='1'
    import numpy as np
    import torch
    from PIL import Image
    from diffusers import UNet2DConditionModel,EulerAncestralDiscreteScheduler
    from zero123plus.pipeline import Zero123PlusPipeline
    from omegaconf import OmegaConf
    from src.utils.train_util import instantiate_from_config
    from src.utils.camera_util import get_zero123plus_input_cameras
    from src.utils.mesh_util import save_obj_with_mtl
    from src.models.encoder.dino_wrapper import DinoWrapper,ViTModel,ViTImageProcessor
    sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
    commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
    seed=int(task.get('seed',132917));steps=int(task.get('steps',75));texture_size=int(task.get('textureSize',1024))
    torch.manual_seed(seed);np.random.seed(seed)
    provenance={'engine':'InstantMesh large','commit':commit,'referenceSha256':sha(image),'conditionSha256':sha(condition),
        'seed':seed,'steps':steps,'textureResolution':texture_size,'gridResolution':128,'generatedViewCount':6,
        'checkpointSha256':sha(runtime/'models/InstantMesh/instant_mesh_large.ckpt'),
        'whiteUnetSha256':sha(runtime/'models/InstantMesh/diffusion_pytorch_model.bin')}
    cache=runtime/'studio-data/instantmesh-cache'/hashlib.sha256(json.dumps(provenance,sort_keys=True).encode()).hexdigest()
    cache.mkdir(parents=True,exist_ok=True);views=cache/'six-views.png';meta=cache/'views.json';stages=[]
    def measure(label,fn):
        start=time.perf_counter();result=fn();stages.append({'stage':label,'seconds':time.perf_counter()-start})
        print(json.dumps(stages[-1]),flush=True);return result
    if views.exists() and meta.exists() and json.loads(meta.read_text())['sha256']==sha(views):
        print('Reusing verified generated views',flush=True)
    else:
        def generate():
            modelroot=runtime/'models/zero123plus-v1.2'
            unet=UNet2DConditionModel.from_config(UNet2DConditionModel.load_config(str(modelroot/'unet')))
            unet.load_state_dict(torch.load(runtime/'models/InstantMesh/diffusion_pytorch_model.bin',map_location='cpu',weights_only=True),strict=True)
            unet=unet.to(dtype=torch.float16)
            pipe=Zero123PlusPipeline.from_pretrained(str(modelroot),unet=unet,torch_dtype=torch.float16,local_files_only=True)
            pipe.scheduler=EulerAncestralDiscreteScheduler.from_config(pipe.scheduler.config,timestep_spacing='trailing')
            pipe.to('cuda')
            result=pipe(Image.open(condition).convert('RGB'),num_inference_steps=steps).images[0]
            result.save(views);meta.write_text(json.dumps({'sha256':sha(views),'provenance':provenance}))
            del pipe,unet;gc.collect();torch.cuda.empty_cache()
        measure('six-view diffusion',generate)
    shutil.copy2(views,dest.with_suffix('.views.png'))
    bundle=cache/'mesh';bundle_meta=bundle/'hashes.json'
    def finish(mesh,cached):
        report={**provenance,'outputSha256':sha(dest),'viewsSha256':sha(views),'vertices':len(mesh.vertices),'triangles':len(mesh.faces),
            'stages':stages,'seconds':time.perf_counter()-started,'peakCudaAllocatedGiB':torch.cuda.max_memory_allocated()/2**30,
            'rawGeometryCacheUsed':cached,'rawGeometry':str(bundle),'ownerApproved':False,
            'review':'Experimental candidate. Review six-view identity, clay silhouette, UV paint and fine anatomy before rigging.'}
        dest.with_suffix('.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
    if bundle_meta.exists():
        hashes=json.loads(bundle_meta.read_text())
        if hashes and all((bundle/name).is_file() and sha(bundle/name)==digest for name,digest in hashes.items()):
            mesh=measure('repack verified mesh and paint',lambda:pack_mesh(bundle/'mesh.obj',dest))
            finish(mesh,True);return
    # The complete reconstruction checkpoint already contains DINO. Instantiate
    # its exact config, then strict-load all weights once; no redundant download.
    def local_dino(model_name,*args,**kwargs):
        if model_name!='facebook/dino-vitb16':raise ValueError('Unexpected DINO architecture')
        from transformers import ViTConfig
        model=ViTModel(ViTConfig.from_pretrained(str(runtime/'models/dino-vitb16'),local_files_only=True),add_pooling_layer=False)
        processor=ViTImageProcessor.from_pretrained(str(runtime/'models/dino-vitb16'),local_files_only=True)
        return model,processor
    DinoWrapper._build_dino=staticmethod(local_dino)
    cfg=OmegaConf.load(repo/'configs/instant-mesh-large.yaml')
    def load_model():
        model=instantiate_from_config(cfg.model_config)
        state=torch.load(runtime/'models/InstantMesh/instant_mesh_large.ckpt',map_location='cpu',weights_only=True)['state_dict']
        model.load_state_dict({k[14:]:v for k,v in state.items() if k.startswith('lrm_generator.')},strict=True)
        model=model.eval().to('cuda');model.init_flexicubes_geometry('cuda',fovy=30.)
        return model
    model=measure('load reconstruction',load_model)
    pixels=np.asarray(Image.open(views),dtype=np.float32)/255
    if pixels.shape!=(960,640,3):raise ValueError('Generated views do not match the six-view camera layout.')
    images=torch.from_numpy(pixels).reshape(3,320,2,320,3).permute(0,2,4,1,3).reshape(1,6,3,320,320).contiguous().to('cuda')
    cameras=get_zero123plus_input_cameras(batch_size=1,radius=4.).to('cuda')
    with torch.inference_mode():
        planes=measure('reconstruct triplanes',lambda:model.forward_planes(images,cameras))
        vertices,faces,uv,uv_faces,texture=measure('extract mesh and UV paint',lambda:model.extract_mesh(planes,use_texture_map=True,texture_resolution=texture_size,render_resolution=512))
    bundle.mkdir(exist_ok=True);obj=bundle/'mesh.obj'
    save_obj_with_mtl(vertices.cpu().numpy(),uv.cpu().numpy(),faces.cpu().numpy(),uv_faces.cpu().numpy(),texture.permute(1,2,0).cpu().numpy(),str(obj))
    bundle_meta.write_text(json.dumps({p.name:sha(p) for p in bundle.iterdir() if p.name!='hashes.json'},indent=2))
    mesh=measure('package glTF',lambda:pack_mesh(obj,dest));finish(mesh,False)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('task');args=parser.parse_args();run(json.loads(Path(args.task).read_text('utf-8')))
