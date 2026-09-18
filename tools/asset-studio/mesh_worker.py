"""Image-conditioned local Hunyuan3D reconstruction, never primitive modeling."""
import argparse,json,os,sys,time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--runtime',required=True);p.add_argument('--image',required=True);p.add_argument('--output',required=True);p.add_argument('--steps',type=int,default=30);p.add_argument('--resolution',type=int,default=256);p.add_argument('--seed',type=int,default=99131);p.add_argument('--conditioning');a=p.parse_args()
runtime=Path(a.runtime);sys.path.insert(0,str(runtime/'Hunyuan3D-2'))
os.environ['HF_HOME']=str(runtime/'hf-cache');os.environ['U2NET_HOME']=str(runtime/'models/rembg');os.environ['HF_HUB_OFFLINE']='1'
import torch
from PIL import Image
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
from shape_images import prepare,single_figure
def progress(percent,message):print(json.dumps({'percent':percent,'message':message}),flush=True)
progress(3,'Preparing approved reference cutouts')
contract=json.loads(Path(a.conditioning).read_text('utf-8')) if a.conditioning else {'engine':'hunyuan','views':{'hero':{'file':a.image}}}
import hashlib
for item in contract['views'].values():
    if item.get('sha256') and hashlib.sha256(Path(item['file']).read_bytes()).hexdigest()!=item['sha256']:raise RuntimeError('Conditioning input changed')
multi=contract['engine']=='hunyuan-mv'
images={role:single_figure(prepare(item['file'],runtime),role) for role,item in contract['views'].items()}
for role,im in images.items():im.save(str(Path(a.output).with_suffix('.input-'+role+'.png')))
image=images if multi else images['hero']
progress(12,'Loading local shape model')
start=time.time();print('Loading local Hunyuan multiview' if multi else 'Loading local Hunyuan mini',flush=True)
pipeline=Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(str(runtime/('models/Hunyuan3D-2mv' if multi else 'models/Hunyuan3D-2mini')),subfolder='hunyuan3d-dit-v2-mv' if multi else 'hunyuan3d-dit-v2-mini',variant='fp16',device='cpu')
# This pinned upstream pipeline is not a DiffusionPipeline subclass, although
# its offload helper expects the components mapping from that interface.
pipeline.components={name:getattr(pipeline,name) for name in ['conditioner','model','vae']}
pipeline.enable_model_cpu_offload()
pipeline.device=torch.device('cuda:0')
def sampling(step,t,outputs):
    progress(round(20+55*(step+1)/a.steps),'Extracting the 3D surface' if step+1>=a.steps else 'Reconstructing shape from reference images')
mesh=pipeline(image=image,callback=sampling,callback_steps=1,num_inference_steps=a.steps,octree_resolution=a.resolution,num_chunks=8000,generator=torch.Generator(device='cuda').manual_seed(a.seed),output_type='trimesh',mc_algo='mc')[0]
if mesh is None or not len(mesh.faces):raise RuntimeError('The model produced no surface')
progress(96,'Exporting and checking the reconstructed mesh')
mesh.remove_unreferenced_vertices();mesh.export(a.output)
Path(a.output).with_suffix('.json').write_text(json.dumps({'method':'local Hunyuan3D-2mv' if multi else 'local Hunyuan3D-2mini','conditioning':contract,'input':a.image,'seed':a.seed,'steps':a.steps,'resolution':a.resolution,'vertices':len(mesh.vertices),'faces':len(mesh.faces),'seconds':time.time()-start,'textUse':'The approved image resolves the written brief; geometry is image-conditioned.','acceptance':'Unreviewed reconstruction; inspect anatomy and rear surfaces.'},indent=2),encoding='utf-8')
print('Saved '+a.output,flush=True)
