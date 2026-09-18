"""Supervised Vey material-region paint. Fixed identity/profile, never a generic default."""
import argparse,hashlib,json,sys,time
from pathlib import Path
import numpy as np,trimesh
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from surface_bake import surface_samples,dilate_gutters,painted_variation
from vey_regions import regions

PALETTE=np.array([[78,47,69],[175,171,168],[79,98,108],[215,203,176],[56,44,51],[60,48,46],[29,27,39]],np.float32)
LABELS=['plum cloth','gray skin','slate mantle','ivory guards','boot leather','belt leather','ink']

def paint(points):
    x,y,z=points.T;ax=abs(x);ids,parts=regions(points)
    mantle_edge=parts['mantle_edge'];collar=parts['collar'];cuffs=parts['cuffs'];cuff_height=parts['cuff_height'];bootguard=parts['bootguard'];belt=parts['belt']
    rgb=PALETTE[ids]*(1+painted_variation(points))[:,None]
    # Broad authored material facets, kept restrained so lighting remains live.
    cloth=ids==0
    cloth_panel=cloth&(ax>.057+.07*np.clip(1-y,0,.5))&(ax<.15+.05*np.clip(1-y,0,.5))
    rgb[cloth_panel]*=1.10
    # Ink seams are narrow, deliberate lines, not the generator's black islands.
    def ink(mask):rgb[mask]=PALETTE[6]
    mantle_line=(ids==2)&(abs(y-mantle_edge)<.007)
    ink(mantle_line)
    mantle_panel=(ids==2)&(abs(ax-(.096+.24*(1.49-y)))<.0025)
    ink(mantle_panel)
    rgb[(ids==2)&(abs(ax-(.102+.24*(1.49-y)))<.002)]=[127,141,145]
    ink((ids==0)&(abs(ax-(.061+.08*np.clip(1.2-y,0,.6)))<.0025))
    ink((ids==3)&(((cuffs)&((cuff_height<.875)|(cuff_height>1.065)))|((bootguard)&((y<.294)|(y>.391)))|((collar)&((y<1.494)|(y>1.546)))))
    # The mantle clasp belongs to the costume and is restricted to its front.
    clasp_u=(x+.092)*.91+(y-1.442)*.41;clasp_v=-(x+.092)*.41+(y-1.442)*.91
    clasp=(abs(clasp_u)<.024)&(abs(clasp_v)<.047)&(z>.065)&(ids==2)
    ink(clasp);rgb[clasp&(abs(clasp_u)<.020)&(abs(clasp_v)<.041)]=[221,210,184]
    # Ankle leather, toe-cap seam and sole are wrapped around the actual surface.
    ink((ids==4)&(y<.026))
    ink((ids==4)&(abs(z-(.10+.13*y))<.003)&(y<.145))
    rgb[(ids==4)&(y>.026)&(y<.032)]=[135,118,114]
    # Belt piping and an intentionally authored circular buckle.
    ink(belt&((y<1.042)|(y>1.112)))
    buckle=((x/.047)**2+((y-1.076)/.047)**2)
    front=z>.078
    rgb[belt&front&(buckle<1)]=[203,182,137]
    rgb[belt&front&(buckle<.68)]=[47,29,65]
    rgb[belt&front&(buckle<.49)]=[105,70,142]
    rgb[belt&front&(((x+.012)/.010)**2+((y-1.091)/.010)**2<1)]=[216,188,233]
    # Clean almond eyes follow the face surface. Positions are an explicit Vey fit.
    u=ax-.088;v=y-1.775-.53*u
    eye=(u/.058)**2+(v/.033)**2
    face=(ids==1)&(y>1.65)&(z>.117)
    rgb[face&(eye<1.25)]=[94,91,103]
    rgb[face&(eye<1)]=[24,22,33]
    rgb[face&(eye<.65)&(v<-.005)]=[43,36,54]
    highlight=face&(eye<.7)&(((u+.014)/.008)**2+((v-.009)/.006)**2<1)
    rgb[highlight]=[241,233,216]
    nostrils=face&(abs(ax-.012)<.004)&(abs(y-1.700)<.006)
    ink(nostrils)
    mouth=face&(ax<.022)&(abs(y-(1.666+.15*ax))<.002);ink(mouth)
    # Mint insignia, with an ink rim. Front only, never paint through the back.
    h=(1.341-y)/.053;tri=(h>=0)&(h<=1)&(abs(x+.088)<.029*(1-h))&(z>.05)
    ink(tri)
    rgb[tri&(h>.09)&(h<.83)&(abs(x+.088)<.022*(1-h))]=[159,218,186]
    return np.clip(rgb,0,255).astype(np.uint8),ids

def main():
    p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);p.add_argument('--size',type=int,default=4096);a=p.parse_args()
    start=time.perf_counter();src=Path(a.input);out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True)
    mesh=trimesh.load(src,force='mesh');height=np.ptp(mesh.vertices[:,1])
    if not 1.98<height<2.02:raise ValueError('Vey profile requires the calibrated two-metre Y-up rest mesh')
    pos,normals,valid=surface_samples(mesh.vertices,mesh.faces,mesh.visual.uv,a.size)
    points=pos[valid];colors,labels=paint(points);atlas=np.zeros((a.size,a.size,3),np.uint8);atlas[valid]=colors
    atlas=dilate_gutters(atlas,valid)
    mesh.visual.material=trimesh.visual.material.PBRMaterial(baseColorFactor=[255,255,255,255],baseColorTexture=Image.fromarray(atlas),roughnessFactor=.86,metallicFactor=0)
    mesh.visual.material.metallicRoughnessTexture=None;mesh.visual.material.metallicFactor=0;mesh.visual.material.roughnessFactor=.86
    mesh.export(out,include_normals=True)
    Image.fromarray(atlas).save(out.with_suffix('.png'))
    coverage=np.zeros_like(atlas);coverage[valid]=PALETTE[labels].astype(np.uint8);Image.fromarray(coverage).save(out.with_name('material-regions.png'))
    receipt={'version':'vey-surface-3.0','method':'Authored Vey material regions, bounded rest-space pigment and narrow ink seams baked to UV; generated black-island texture replaced. No screen overlay.','sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'textureSize':a.size,'surfaceTexels':int(valid.sum()),'regions':{n:int((labels==i).sum()) for i,n in enumerate(LABELS)},'seconds':time.perf_counter()-start,'ownerApproved':False,'reviewRequired':['front','left','right','back','top','bottom','face','hands','boots']}
    out.with_suffix('.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps(receipt))
if __name__=='__main__':main()
