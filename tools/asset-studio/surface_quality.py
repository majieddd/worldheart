"""Inspect rendered material inputs in declared surface regions, including unseen sides."""
import argparse,json,hashlib
from pathlib import Path
import numpy as np,trimesh

def region_checks(points,rgb,regions):
    checks=[];rgb=np.asarray(rgb)/255
    for region in regions:
        low=np.array(region['min']);high=np.array(region['max'])
        selected=((points>=low)&(points<=high)).all(axis=1);colors=rgb[selected]
        if len(colors)<20:
            checks.append({'name':region['name'],'status':'fail','metrics':{'reason':'Region lacks sufficient surface samples','samples':len(colors)}});continue
        lum=colors@np.array([.2126,.7152,.0722]);ratio=float((lum<region['darkBelow']).mean())
        checks.append({'name':region['name'],'status':'pass' if ratio<=region['maxDarkRatio'] else 'fail',
                       'metrics':{'samples':len(colors),'darkContaminationRatio':ratio,'maximum':region['maxDarkRatio'],'medianRGB':np.median(colors*255,axis=0).round(1).tolist()}})
    return checks

def inspect(path,profile):
    mesh=trimesh.load(path,force='mesh');rng=np.random.default_rng(73091)
    ids=rng.choice(len(mesh.faces),80000,p=mesh.area_faces/mesh.area_faces.sum())
    bary=rng.dirichlet([1,1,1],len(ids));faces=mesh.faces[ids]
    points=(mesh.vertices[faces]*bary[:,:,None]).sum(axis=1)
    uv=(mesh.visual.uv[faces]*bary[:,:,None]).sum(axis=1)
    image=np.asarray(mesh.visual.material.baseColorTexture.convert('RGB'));h,w=image.shape[:2]
    ix=np.clip((uv[:,0]*w).astype(int),0,w-1);iy=np.clip(((1-uv[:,1])*h).astype(int),0,h-1)
    checks=region_checks(points,image[iy,ix],profile['surfaceRegions'])
    if profile.get('topology',{}).get('closedOrientedSurface'):
        welded=mesh.copy();welded.merge_vertices(merge_tex=True,merge_norm=True)
        checks.extend([{'name':'Consistent surface winding','status':'pass' if welded.is_winding_consistent else 'fail','metrics':{}},
                       {'name':'Closed reconstructed surface','status':'pass' if welded.is_watertight else 'fail','metrics':{}}])
    return {'version':'surface-regions-1.0','sha256':hashlib.sha256(Path(path).read_bytes()).hexdigest(),'profileSha256':hashlib.sha256(json.dumps(profile,sort_keys=True).encode()).hexdigest(),'checks':checks,'status':'fail' if any(c['status']=='fail' for c in checks) else 'review_required','visualAcceptance':'pending','scope':'Declared material contamination checks, not automatic likeness or style approval'}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('input');p.add_argument('--profile',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    report=inspect(a.input,json.loads(Path(a.profile).read_text('utf-8')))
    Path(a.output).write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report));raise SystemExit(1 if report['status']=='fail' else 0)
