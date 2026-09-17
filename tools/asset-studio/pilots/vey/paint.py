"""Manually supervised Vey paint experiment. Not the studio's default worker."""
import bpy, json, time
import numpy as np
from pathlib import Path
from PIL import Image
from scipy.ndimage import distance_transform_edt, gaussian_filter1d

ROOT=Path(__file__).resolve().parents[4]; OUT=ROOT/'lib/99-art/vey-pilot-v1'; start=time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'lib/99-art/identity-v2/vey-hunyuan-painted.glb'))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();obj=bpy.context.object
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
verts=np.array([tuple(v.co) for v in obj.data.vertices]);low=verts.min(0);high=verts.max(0)
scale=2/(high[2]-low[2]);obj.scale=(scale,)*3;obj.location=(-.5*(low[0]+high[0])*scale,-.5*(low[1]+high[1])*scale,-low[2]*scale)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.00003);bpy.ops.mesh.delete_loose();bpy.ops.object.mode_set(mode='OBJECT')
mod=obj.modifiers.new('Review topology reduction','DECIMATE');mod.ratio=.24;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.delete_loose();bpy.ops.uv.smart_project(angle_limit=1.4,island_margin=.003,area_weight=1.0);bpy.ops.object.mode_set(mode='OBJECT')
for p in obj.data.polygons:p.use_smooth=True
obj.data.calc_loop_triangles()
verts=np.array([tuple(v.co) for v in obj.data.vertices]);normals=np.array([tuple(v.normal) for v in obj.data.vertices]);faces=np.array([list(t.vertices) for t in obj.data.loop_triangles])
uvs=np.array([tuple(d.uv) for d in obj.data.uv_layers.active.data]);loops=np.array([list(t.loops) for t in obj.data.loop_triangles])
S=2048;D=512

def raster(tri,limit):
    lo=np.maximum(np.floor(tri.min(0)).astype(int),0);hi=np.minimum(np.ceil(tri.max(0)).astype(int),limit-1)
    if (hi<lo).any():return None
    yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];v0,v1=tri[1]-tri[0],tri[2]-tri[0];den=v0[0]*v1[1]-v1[0]*v0[1]
    if abs(den)<1e-8:return None
    dx,dy=xx-tri[0,0],yy-tri[0,1];b=(dx*v1[1]-v1[0]*dy)/den;c=(v0[0]*dy-dx*v0[1])/den;a=1-b-c;inside=(a>=0)&(b>=0)&(c>=0)
    return yy[inside],xx[inside],np.stack([a[inside],b[inside],c[inside]],-1)

# Populate surface samples in the retained UV layout, independent of cameras.
pos=np.zeros((S,S,3),np.float32);nor=np.zeros_like(pos);valid=np.zeros((S,S),bool)
for face,loop in zip(faces,loops):
    tri=uvs[loop]*[S-1,-(S-1)]+[0,S-1];r=raster(tri,S)
    if r is None:continue
    yy,xx,bary=r;pos[yy,xx]=bary@verts[face];nor[yy,xx]=bary@normals[face];valid[yy,xx]=True
yy,xx=np.nonzero(valid);points=pos[yy,xx];ns=nor[yy,xx];ns/=np.maximum(np.linalg.norm(ns,axis=1,keepdims=True),1e-8)
colors=np.zeros((len(points),3),np.float32);weight=np.zeros(len(points),np.float32)
view_report={}
for name,axis,sign,direction in [('front',0,1,[0,-1,0]),('back',0,-1,[0,1,0]),('left',1,1,[1,0,0]),('right',1,-1,[-1,0,0])]:
    direction=np.array(direction);depth=verts@direction;u=verts[:,axis]*sign
    umin,umax=u.min(),u.max();vmin,vmax=verts[:,2].min(),verts[:,2].max()
    screen=np.stack([(u-umin)/(umax-umin)*(D-1),(1-(verts[:,2]-vmin)/(vmax-vmin))*(D-1)],-1)
    zbuffer=np.full((D,D),-1e4,np.float32)
    for f in faces:
        r=raster(screen[f],D)
        if r is None:continue
        ry,rx,bary=r;zbuffer[ry,rx]=np.maximum(zbuffer[ry,rx],bary@depth[f])
    src=np.asarray(Image.open(OUT/(name+'.png')).convert('RGB'))
    bg=np.median(np.concatenate([src[0],src[-1],src[:,0],src[:,-1]]),axis=0)
    mask=np.linalg.norm(src.astype(float)-bg,axis=2)>48
    sy,sx=np.nonzero(mask);top,bottom=sy.min(),sy.max()
    # Register vertical silhouette spans to the reconstructed pose before sampling.
    source_lo=np.zeros(D);source_hi=np.zeros(D);model_lo=np.zeros(D);model_hi=np.zeros(D)
    for row in range(D):
        sr=round(top+row/(D-1)*(bottom-top));indices=np.flatnonzero(mask[max(0,sr-1):min(len(mask),sr+2)].any(0));mi=np.flatnonzero(zbuffer[max(0,row-1):min(D,row+2)].max(0)>-999)
        source_lo[row],source_hi[row]=(indices.min(),indices.max()) if len(indices) else (src.shape[1]/2-1,src.shape[1]/2+1)
        model_lo[row],model_hi[row]=(mi.min(),mi.max()) if len(mi) else (D/2-1,D/2+1)
    # Only small smoothing: do not erase hand/torso gaps or material transitions.
    for a in [source_lo,source_hi,model_lo,model_hi]:a[:]=gaussian_filter1d(a,1)
    pu=(points[:,axis]*sign-umin)/(umax-umin)*(D-1);pv=(1-(points[:,2]-vmin)/(vmax-vmin))*(D-1)
    ri=np.clip(pv.round().astype(int),0,D-1);ci=np.clip(pu.round().astype(int),0,D-1)
    within=(points@direction)>=zbuffer[ri,ci]-.018
    frac=np.clip((pu-model_lo[ri])/np.maximum(model_hi[ri]-model_lo[ri],1),0,1)
    ix=np.clip((source_lo[ri]+frac*(source_hi[ri]-source_lo[ri])).round().astype(int),0,src.shape[1]-1);iy=np.clip((top+pv/(D-1)*(bottom-top)).round().astype(int),0,src.shape[0]-1)
    facing=np.maximum(ns@direction,0);score=facing**8*within*mask[iy,ix]
    colors+=src[iy,ix]*score[:,None];weight+=score
    view_report[name]={'visibleTexels':int((score>.005).sum()),'depthTest':True,'sourceCrop':[int(top),int(bottom)]}
covered=weight>.005
colors[covered]/=weight[covered,None]
# Unseen horizontal faces use a documented material-region fill, never a second face.
z=points[:,2];x=np.abs(points[:,0]);fallback=np.tile([75,52,69],(len(points),1))
fallback[z>1.56]=[177,174,169];fallback[(z>1.30)&(z<1.54)]=[97,117,120]
fallback[z<.32]=[49,42,49];fallback[(z>.29)&(z<.40)]=[207,193,165]
fallback[(x>.34)&(z>.76)&(z<1.04)]=[207,193,165];fallback[(x>.43)&(z<.80)]=[164,163,159]
colors[~covered]=fallback[~covered]
# Manually verified hard material boundaries. Reference poses differ slightly;
# blending them must not cut plum holes through solid ceramic forearm guards.
brush=1+.045*np.sin(points[:,0]*97+points[:,2]*47)*np.sin(points[:,1]*91-points[:,2]*111)+.025*np.sin(points[:,0]*351+points[:,2]*273)
ceramic=((x>.325)&(z>.86)&(z<1.075))|((z>.30)&(z<.385))|((z>1.493)&(z<1.555)&(x<.125))
colors[ceramic]=np.array([205,193,168])*brush[ceramic,None]
# Authored color variation on occluded material surfaces replaces a flat fill;
# its coverage remains separately reported instead of claiming camera evidence.
colors[~covered]*=brush[~covered,None]
atlas=np.zeros((S,S,3),np.uint8);atlas[yy,xx]=np.clip(colors,0,255).astype(np.uint8)
# Extend island colors into padding. Empty texels must not produce dark mip seams.
nearest=distance_transform_edt(~valid,return_distances=False,return_indices=True);atlas[~valid]=atlas[nearest[0][~valid],nearest[1][~valid]]
Image.fromarray(atlas).save(OUT/'paint-atlas.png')
coverage=np.full((S,S,3),255,np.uint8);coverage[yy,xx]=np.where(covered[:,None],[95,169,124],[230,123,72]);Image.fromarray(coverage).save(OUT/'paint-coverage.png')
mat=bpy.data.materials.new('Vey / four-view painted surface');mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(OUT/'paint-atlas.png'));tex.image.pack();mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Roughness'].default_value=.82;obj.data.materials.clear();obj.data.materials.append(mat)
obj.name='Vey_Painted';bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'paint-review.blend'));bpy.ops.export_scene.gltf(filepath=str(OUT/'paint-review.glb'),export_format='GLB',export_yup=True)
report={'method':'Four-view depth-tested UV painting with registered silhouette spans','vertices':len(verts),'triangles':len(faces),'textureSize':S,'referenceCoverage':round(float(covered.mean()),4),'unseenFill':'Explicit semantic palette fill on uncovered surfaces; orange in coverage map','views':view_report,'seconds':round(time.time()-start,2),'ownerApproval':False}
(OUT/'paint-receipt.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
