"""Deterministic cutouts and conservative multi-figure detection, not semantic vision."""
from PIL import Image
def prepare(path,runtime):
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

def figures(image):
    import cv2,numpy as np
    mask=(np.asarray(image.convert('RGBA'))[:,:,3]>127).astype('uint8')
    _,_,stats,_=cv2.connectedComponentsWithStats(mask)
    h,w=mask.shape
    return sorted([{'x':int(x),'y':int(y),'width':int(bw),'height':int(bh)} for x,y,bw,bh,area in stats[1:] if bh>.55*h and area>.015*h*w],key=lambda r:r['x'])

def single_figure(image,role):
    found=figures(image)
    if len(found)>1:raise ValueError(f'{role} contains {len(found)} separate full-height figures. In Concept, select this view and use Isolate one figure before shaping.')
    return image

def crop_figure(image,index):
    found=figures(image)
    if not isinstance(index,int) or isinstance(index,bool) or not 0<=index<len(found):raise ValueError('Choose a detected figure')
    r=found[index];box=[r['x'],r['y'],r['x']+r['width'],r['y']+r['height']]
    cropped=image.crop(box);pad=max(12,round(cropped.height*.025));result=Image.new('RGBA',(cropped.width+2*pad,cropped.height+2*pad));result.paste(cropped,(pad,pad));return result,box
