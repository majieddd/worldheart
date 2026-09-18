"""Vey-only unsigned surface reconstruction, including explicitly closed boot soles."""
import trimesh,numpy as np,time,json,argparse,hashlib
from scipy import ndimage
from pathlib import Path
from skimage.measure import marching_cubes
import pymeshlab
start=time.perf_counter()
ap=argparse.ArgumentParser();ap.add_argument('--input',required=True);ap.add_argument('--output',required=True);a=ap.parse_args()
src=trimesh.load(a.input,force='mesh',process=False)
if not 1.98<np.ptp(src.vertices[:,1])<2.02:raise ValueError('Expected calibrated two-metre Vey mesh')
vox=src.voxelized(.003,method='subdivide')
print('voxels',vox.shape,flush=True)
occ=np.pad(vox.matrix,4)
# Close tiny cracks in the sampled surface, fill the exterior shell, then
# remove the temporary dilation. Surface occupancy ignores bad face winding.
# The source boot undersides are open. Fit their planar cap from the first
# 12 cm of each boot, not a generic bounding box that joins the feet together.
footprint=ndimage.binary_fill_holes(occ[:,4:44,:].any(axis=1))
occ[:,4:7,:] |= footprint[:,None,:]
solid=ndimage.binary_dilation(occ,iterations=2)
solid=ndimage.binary_fill_holes(solid)
solid=ndimage.binary_erosion(solid,iterations=2)
verts,faces,_,_=marching_cubes(solid.astype(np.float32),.5)
verts=trimesh.transform_points(verts-4,vox.transform)
ms=pymeshlab.MeshSet();ms.add_mesh(pymeshlab.Mesh(verts,faces))
ms.apply_filter('meshing_decimation_quadric_edge_collapse',targetfacenum=65000,preservenormal=True,preservetopology=True,optimalplacement=False)
m=ms.current_mesh();out=trimesh.Trimesh(m.vertex_matrix(),m.face_matrix(),process=True)
trimesh.repair.fix_normals(out,multibody=True)
out=max(out.split(),key=lambda c:c.area)
trimesh.smoothing.filter_taubin(out,lamb=.5,nu=.53,iterations=5)
path=Path(a.output);path.parent.mkdir(parents=True,exist_ok=True);out.export(path)
report={'seconds':time.perf_counter()-start,'verts':len(out.vertices),'faces':len(out.faces),'winding':bool(out.is_winding_consistent),'watertight':bool(out.is_watertight),'volume':out.volume,'sourceSha256':hashlib.sha256(Path(a.input).read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'method':'3mm unsigned occupancy, fitted boot caps, bounded edge collapse, five Taubin smoothing iterations','ownerApproved':False}
path.with_suffix('.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report),flush=True)
if not report['winding'] or not report['watertight']:raise RuntimeError('Cleaned Vey surface failed topology checks')


