import time,json,hashlib
from pathlib import Path
import trimesh,numpy as np
from PIL import Image
start=time.perf_counter();src=Path('lib/99-art/vey-benchmark-v1/paint-finished.glb');out=Path('lib/99-art/vey-benchmark-v1/paint-detail.glb');m=trimesh.load(src,force='mesh');mat=m.visual.material;rgb=np.array(mat.baseColorTexture.convert('RGB'));S=rgb.shape[0]
pos=np.zeros((S,S,3),np.float32);valid=np.zeros((S,S),bool);uv=m.visual.uv*np.array([S,-S])+[0,S]
for face in m.faces:
 tri=uv[face];lo=np.maximum(np.floor(tri.min(0)).astype(int),0);hi=np.minimum(np.ceil(tri.max(0)).astype(int),S-1)
 if (hi<lo).any():continue
 yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];v0,v1=tri[1]-tri[0],tri[2]-tri[0];den=v0[0]*v1[1]-v1[0]*v0[1]
 if abs(den)<1e-8:continue
 dx,dy=xx+.5-tri[0,0],yy+.5-tri[0,1];b=(dx*v1[1]-v1[0]*dy)/den;c=(v0[0]*dy-dx*v0[1])/den;a=1-b-c;inside=(a>=0)&(b>=0)&(c>=0)
 y,x=yy[inside],xx[inside];pos[y,x]=np.stack([a[inside],b[inside],c[inside]],-1)@m.vertices[face];valid[y,x]=True
x,y,z=np.moveaxis(pos,-1,0);lum=rgb@np.array([.2126,.7152,.0722])/255
head=valid&(y>1.62)&(z>.015);eyes=head&(lum<.20)&(abs(x)>.035)&(y>1.72)&(y<1.88)
centers=[]
for side in [-1,1]:
 mask=eyes&(x*side>0)
 if mask.sum()<10:raise RuntimeError('Cannot locate the expected eye; stop detail pass')
 center=np.median(pos[mask],axis=0);centers.append(center.tolist());rgb[mask]=[23,21,29]
 # A small upper catchlight is an authored Vey detail, not a texture overlay.
 glint=mask&(((x-(center[0]-.012))/.011)**2+((y-(center[1]+.020))/.016)**2<1)
 rgb[glint]=[237,229,213]
# Locate the generated mint badge, then replace its blurry silhouette in UV space.
badge=valid&(y>1.22)&(y<1.48)&(z>.015)&(rgb[:,:,1]>rgb[:,:,0]*1.25)&(rgb[:,:,1]>70)&(rgb[:,:,2]>rgb[:,:,0]*1.10)
if badge.sum()<10:raise RuntimeError('Cannot locate badge; stop detail pass')
bcenter=np.median(pos[badge],axis=0);cx,cy,cz=bcenter;region=valid&(abs(x-cx)<.05)&(abs(y-cy)<.052)&(z>cz-.025)
rgb[region]=[73,46,64]
v=(cy+.030-y)/.06;inside=region&(v>=0)&(v<=1)&(abs(x-cx)<.029*(1-v));rgb[inside]=[31,40,43]
inner=region&(v>.07)&(v<.85)&(abs(x-cx)<.022*(1-v));rgb[inner]=[163,218,193]
# Extend color into the original UV island padding so mipmaps do not undo the edits.
from scipy.ndimage import distance_transform_edt
_,nearest=distance_transform_edt(~valid,return_indices=True);rgb[~valid]=rgb[nearest[0][~valid],nearest[1][~valid]]
mat.baseColorTexture=Image.fromarray(rgb);m.export(out,include_normals=True)
r={'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'seconds':time.perf_counter()-start,'method':'Vey-specific UV-space eye clarity, two small catchlights, crisp mint triangle badge, and UV padding','eyeCenters':centers,'badgeCenter':bcenter.tolist(),'ownerApproved':False};out.with_suffix('.json').write_text(json.dumps(r,indent=2),encoding='utf-8');print(json.dumps(r))
