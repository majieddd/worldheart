import time,json,hashlib
from pathlib import Path
import trimesh,numpy as np,cv2
from PIL import Image
start=time.perf_counter();src=Path('artifacts/vey-quality-research/paint-guidance.glb');out=Path('lib/99-art/vey-benchmark-v1/paint-finished.glb');m=trimesh.load(src,force='mesh');mat=m.visual.material
im=np.array(mat.baseColorTexture.convert('RGB'));rgb=im.astype(np.float32)/255;hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV);h,s,v=np.moveaxis(hsv,-1,0)
# Vey's named palette is a character profile, not a generic material rule.
# Preserve the generated UV layout and its painted marks; correct large hue/value drift.
soft=cv2.bilateralFilter(im,7,24,5).astype(np.float32)/255
lum=soft@np.array([.2126,.7152,.0722]);raw=rgb@np.array([.2126,.7152,.0722]);result=soft.copy()
def grade(mask,color,center,contrast=.5):
 target=np.array(color)/255;variation=np.clip(1+(lum-center)*contrast,.76,1.15)
 # Keep a small amount of source brush detail, without amplifying diffusion noise.
 for c in range(3):result[:,:,c]=np.where(mask,np.clip(target[c]*variation+(raw-lum)*.2,0,1),result[:,:,c])
skin=(s<.29)&(v>.12)&(h<80)
ivory=(h>17)&(h<58)&(s>=.29)&(v>.22)
cloth=((h>268)|(h<5))&(s>.20)&(v>.055)
slate=(h>90)&(h<230)&(v>.06)&(v<.52)
grade(skin,[181,176,170],.29,.7);grade(ivory,[212,198,172],.52,.6);grade(cloth,[73,46,64],.11,1.0);grade(slate,[84,100,104],.18,.7)
mat.baseColorTexture=Image.fromarray(np.uint8(np.clip(result*255,0,255)));mat.metallicRoughnessTexture=None;mat.metallicFactor=0;mat.roughnessFactor=.9
m.apply_transform(np.diag([-1,1,-1,1]));bounds=m.bounds.copy();m.vertices-=np.array([0,bounds[0,1],0]);m.vertices*=2/(bounds[1,1]-bounds[0,1]);m.export(out)
receipt={'method':'Vey-specific palette normalization with edge-preserving texture denoise; no projected overlay; engine atlas retained','sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'seconds':time.perf_counter()-start,'ownerApproved':False,'paletteMasks':{k:int(mask.sum()) for k,mask in [('skin',skin),('ivory',ivory),('cloth',cloth),('slate',slate)]}}
out.with_suffix('.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps(receipt))
p=out.parent/'manifest.json';d=json.loads(p.read_text());d['models']['paint']['file']=out.name;p.write_text(json.dumps(d,indent=2),encoding='utf-8')
