"""Repair the dense reconstruction before reduction; retain source and method evidence."""
import numpy as np
import trimesh
from scipy import ndimage
from skimage.measure import marching_cubes
import pymeshlab

def reduce_shape(mesh,budget):
    before={'vertices':len(mesh.vertices),'triangles':len(mesh.faces)}
    pitch=float(np.ptp(mesh.vertices[:,1]))/500
    # The native reconstruction is already much denser than this grid. Sampling
    # vertices plus triangle centres ignores inconsistent face winding without
    # the millions of temporary triangles produced by subdivision voxelization.
    origin=mesh.bounds[0]-pitch*5;shape=np.ceil((mesh.bounds[1]-origin)/pitch).astype(int)+6
    occ=np.zeros(shape,dtype=bool)
    for points in [mesh.vertices,mesh.triangles_center]:
        ids=np.rint((points-origin)/pitch).astype(np.int32);occ[tuple(ids.T)]=True
    # Close open ground-facing soles only inside their observed footprint.
    bottom=int(np.rint((mesh.bounds[0,1]-origin[1])/pitch))
    footprint=ndimage.binary_fill_holes(occ[:,bottom:bottom+8,:].any(axis=1))
    occ[:,bottom:bottom+2,:]|=footprint[:,None,:]
    solid=ndimage.binary_dilation(occ,iterations=2);solid=ndimage.binary_fill_holes(solid);solid=ndimage.binary_erosion(solid,iterations=2)
    vertices,faces,_,_=marching_cubes(solid.astype(np.float32),.5);vertices=vertices*pitch+origin
    ms=pymeshlab.MeshSet();ms.add_mesh(pymeshlab.Mesh(vertices,faces))
    ms.apply_filter('meshing_decimation_quadric_edge_collapse',targetfacenum=budget,preservenormal=True,preservetopology=True,optimalplacement=False)
    reduced=ms.current_mesh();result=trimesh.Trimesh(reduced.vertex_matrix(),reduced.face_matrix(),process=True)
    trimesh.repair.fix_normals(result,multibody=True)
    components=result.split();result=max(components,key=lambda c:c.area)
    trimesh.smoothing.filter_taubin(result,lamb=.5,nu=.53,iterations=3)
    report={'method':'Unsigned dense-surface occupancy, local sole closure, bounded reduction','voxelHeightDivisor':500,'requestedTriangles':budget,'componentsBeforeCleanup':len(components),'watertight':bool(result.is_watertight),'windingConsistent':bool(result.is_winding_consistent)}
    report.update(before=before,after={'vertices':len(result.vertices),'triangles':len(result.faces)},requiresVisualReview=True)
    if not np.isfinite(result.vertices).all() or not len(result.faces):raise ValueError('Reduction produced invalid geometry')
    result.visual=trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(baseColorFactor=[205,205,197,255],metallicFactor=0,roughnessFactor=.9,doubleSided=True))
    return result,report
