"""Artifact-bound material cleanup, baked into existing UVs with a reviewed palette."""
import argparse,hashlib,json,time
from pathlib import Path
import numpy as np,trimesh
from scipy import ndimage
from PIL import Image
from surface_bake import surface_samples,dilate_gutters,painted_variation
p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);p.add_argument('--profile',required=True);a=p.parse_args();start=time.perf_counter()
src=Path(a.input);profile=json.loads(Path(a.profile).read_text('utf-8'));sha=lambda path:hashlib.sha256(Path(path).read_bytes()).hexdigest()
if profile['sourceSha256']!=sha(src):raise ValueError('Paint profile belongs to a different source model')
m=trimesh.load(src,force='mesh');image=m.visual.material.baseColorTexture.convert('RGB');size=image.width
if image.height!=size:raise ValueError('Expected square UV atlas')
pos,normals,valid=surface_samples(m.vertices,m.faces,m.visual.uv,size);raw=np.asarray(image,dtype=np.float32)/255
r,g,b=raw[:,:,0],raw[:,:,1],raw[:,:,2];lum=raw.mean(axis=2);chroma=raw.max(axis=2)-raw.min(axis=2)
labels=np.full(valid.shape,-1,np.int16)
labels[valid&(chroma<.13)&(lum>.38)]=0
labels[valid&(r>g*1.10)&(b>g*1.07)&(lum>.12)]=1
labels[valid&(r>b*1.12)&(g>b*1.03)&(lum>.15)]=2
labels[valid&(g>r*1.2)&(b>r*1.1)&(lum>.2)]=3
labels[valid&(r>g*1.8)&(r>b*1.5)&(r>.3)]=4
known=labels>=0
if not known.any():raise ValueError('No confident material colours in the source')
# Fill low-confidence baked shadows from nearby material colours in UV space.
nearest=ndimage.distance_transform_edt(~known,return_distances=False,return_indices=True)
labels[~known]=labels[tuple(nearest[:,~known])];del nearest
points=pos[valid];q=points.copy();angle=np.deg2rad(profile.get('sourceYawDegrees',0));q[:,[0,2]]=q[:,[0,2]]@np.array([[np.cos(angle),-np.sin(angle)],[np.sin(angle),np.cos(angle)]]);q+=np.array(profile.get('sourceOffsetYUp',[0,0,0]));original_ids=labels[valid];ids=original_ids.copy()
if 'baseMaterial' in profile:ids[:]=profile['baseMaterial']
for region in profile.get('regions',[]):
    mask=np.all(q>=region['min'],axis=1)&np.all(q<=region['max'],axis=1)
    if 'center' in region:mask&=np.sum(((q-region['center'])/region['radius'])**2,axis=1)<=1
    if 'plane' in region:mask&=np.abs(q@np.array(region['plane'][:3])+region['plane'][3])<region.get('width',.004)
    if 'path' in region:
        inside=np.zeros(len(q),bool)
        for left,right in zip(region['path'][:-1],region['path'][1:]):
            origin=np.array(left[:3]);end=np.array(right[:3]);edge=end-origin;t=np.clip((q-origin)@edge/max(edge@edge,1e-10),0,1);radius=left[3]+t*(right[3]-left[3]);inside|=np.sum((q-origin-t[:,None]*edge)**2,axis=1)<=radius**2
        mask&=inside
    ids[mask]=region['material']
    if region.get('preserveEye'):ids[mask&(original_ids==4)]=4
palette=np.asarray(profile['palette']+[[36,28,42]],np.float32)
variation=painted_variation(points)*profile.get('pigment',.8)
# Keep a small amount of local brush structure; remove black lighting islands.
detail=lum[valid]-ndimage.gaussian_filter(lum,2)[valid];factor=1+variation+np.clip(detail,-.1,.1)*.22
rgb=palette[ids]*factor[:,None];atlas=np.zeros((size,size,3),np.uint8);atlas[valid]=np.clip(rgb,0,255).astype(np.uint8);atlas=dilate_gutters(atlas,valid)
m.visual.material=trimesh.visual.material.PBRMaterial(baseColorFactor=[255]*4,baseColorTexture=Image.fromarray(atlas),metallicFactor=0,roughnessFactor=.86,doubleSided=True)
# UV seams may duplicate positions. Share their geometric normals without
# merging their UV coordinates or retaining the generator's split normals.
_,inverse=np.unique(np.round(m.vertices,6),axis=0,return_inverse=True);shared=np.zeros((inverse.max()+1,3));face_normals=np.cross(m.triangles[:,1]-m.triangles[:,0],m.triangles[:,2]-m.triangles[:,0])
for k in range(3):np.add.at(shared,inverse[m.faces[:,k]],face_normals)
shared/=np.maximum(np.linalg.norm(shared,axis=1)[:,None],1e-10);m.vertex_normals=shared[inverse]
out=Path(a.output);m.export(out,include_normals=True);Image.fromarray(atlas).save(out.with_suffix('.png'))
report={'method':'Reviewed material palette, source-colour classification and fitted region corrections; bounded rest-space pigment baked into original UVs','sourceSha256':sha(src),'profileSha256':sha(a.profile),'outputSha256':sha(out),'textureSize':size,'seconds':time.perf_counter()-start,'ownerApproved':False,'visualAcceptance':'pending'}
out.with_suffix('.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
