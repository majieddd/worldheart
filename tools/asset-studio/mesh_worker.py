"""Image-conditioned local Hunyuan3D reconstruction, never primitive modeling."""
import argparse,json,os,sys,time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--runtime',required=True);p.add_argument('--image',required=True);p.add_argument('--output',required=True);p.add_argument('--steps',type=int,default=30);p.add_argument('--resolution',type=int,default=256);p.add_argument('--seed',type=int,default=99131);p.add_argument('--conditioning');a=p.parse_args()
runtime=Path(a.runtime);sys.path.insert(0,str(runtime/'Hunyuan3D-2'))
os.environ['HF_HOME']=str(runtime/'hf-cache');os.environ['U2NET_HOME']=str(runtime/'models/rembg');os.environ['HF_HUB_OFFLINE']='1'
import torch
from PIL import Image
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
def prepare(path):
    image=Image.open(path).convert('RGBA')
    if image.getextrema()[3][0]==255:
        if (runtime/'models/rembg/u2net.onnx').exists():
            from rembg import remove,new_session
            image=remove(image,session=new_session('u2net'))
        else:
            # Studio concepts use a plain neutral backdrop. Edge-connected color
            # removal avoids a hidden model download and preserves enclosed highlights.
            import cv2,numpy as np
            rgb=np.asarray(image)[:,:,:3].copy();border=np.concatenate([rgb[0],rgb[-1],rgb[:,0],rgb[:,-1]])
            bg=np.median(border,axis=0)
            if np.median(np.linalg.norm(border.astype(float)-bg,axis=1))>20:raise RuntimeError('This image needs a clean cutout. Use a transparent reference or install local U2Net background-removal weights before reconstructing scenery-backed art.')
            allowed=(np.linalg.norm(rgb.astype(float)-bg,axis=2)<42).astype('uint8')
            count,labels=cv2.connectedComponents(allowed);edge_labels=np.unique(np.concatenate([labels[0],labels[-1],labels[:,0],labels[:,-1]]));edge_labels=edge_labels[edge_labels!=0]
            alpha=np.where(np.isin(labels,edge_labels),0,255).astype('uint8');image.putalpha(Image.fromarray(alpha))
    return image
contract=json.loads(Path(a.conditioning).read_text('utf-8')) if a.conditioning else {'engine':'hunyuan','views':{'hero':{'file':a.image}}}
import hashlib
for item in contract['views'].values():
    if item.get('sha256') and hashlib.sha256(Path(item['file']).read_bytes()).hexdigest()!=item['sha256']:raise RuntimeError('Conditioning input changed')
multi=contract['engine']=='hunyuan-mv'
images={role:prepare(item['file']) for role,item in contract['views'].items()}
for role,im in images.items():im.save(str(Path(a.output).with_suffix('.input-'+role+'.png')))
image=images if multi else images['hero']
start=time.time();print('Loading local Hunyuan multiview' if multi else 'Loading local Hunyuan mini',flush=True)
pipeline=Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(str(runtime/('models/Hunyuan3D-2mv' if multi else 'models/Hunyuan3D-2mini')),subfolder='hunyuan3d-dit-v2-mv' if multi else 'hunyuan3d-dit-v2-mini',variant='fp16',device='cpu')
# This pinned upstream pipeline is not a DiffusionPipeline subclass, although
# its offload helper expects the components mapping from that interface.
pipeline.components={name:getattr(pipeline,name) for name in ['conditioner','model','vae']}
pipeline.enable_model_cpu_offload()
pipeline.device=torch.device('cuda:0')
mesh=pipeline(image=image,num_inference_steps=a.steps,octree_resolution=a.resolution,num_chunks=8000,generator=torch.Generator(device='cuda').manual_seed(a.seed),output_type='trimesh',mc_algo='mc')[0]
if mesh is None or not len(mesh.faces):raise RuntimeError('The model produced no surface')
mesh.remove_unreferenced_vertices();mesh.export(a.output)
Path(a.output).with_suffix('.json').write_text(json.dumps({'method':'local Hunyuan3D-2mv' if multi else 'local Hunyuan3D-2mini','conditioning':contract,'input':a.image,'seed':a.seed,'steps':a.steps,'resolution':a.resolution,'vertices':len(mesh.vertices),'faces':len(mesh.faces),'seconds':time.time()-start,'textUse':'The approved image resolves the written brief; geometry is image-conditioned.','acceptance':'Unreviewed reconstruction; inspect anatomy and rear surfaces.'},indent=2),encoding='utf-8')
print('Saved '+a.output,flush=True)
