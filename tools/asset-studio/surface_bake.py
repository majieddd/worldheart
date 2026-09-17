"""Bake mesh-attached paint fields to existing UVs; no screen-space projection."""
import numpy as np
from scipy.ndimage import distance_transform_edt,map_coordinates

def surface_samples(vertices, faces, uvs, size):
    positions=np.zeros((size,size,3),np.float32)
    normals=np.zeros_like(positions)
    coverage=np.zeros((size,size),bool)
    uv=uvs*np.array([size,-size])+[0,size]
    for face in faces:
        tri=uv[face];lo=np.maximum(np.floor(tri.min(0)).astype(int),0)
        hi=np.minimum(np.ceil(tri.max(0)).astype(int),size-1)
        if (hi<lo).any():continue
        yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
        e,f=tri[1]-tri[0],tri[2]-tri[0];den=e[0]*f[1]-f[0]*e[1]
        if abs(den)<1e-8:continue
        dx,dy=xx+.5-tri[0,0],yy+.5-tri[0,1]
        b=(dx*f[1]-f[0]*dy)/den;c=(e[0]*dy-dx*e[1])/den;a=1-b-c
        inside=(a>=0)&(b>=0)&(c>=0);iy,ix=yy[inside],xx[inside]
        positions[iy,ix]=np.stack([a[inside],b[inside],c[inside]],-1)@vertices[face]
        n=np.cross(vertices[face[1]]-vertices[face[0]],vertices[face[2]]-vertices[face[0]])
        normals[iy,ix]=n/max(np.linalg.norm(n),1e-10)
        coverage[iy,ix]=True
    return positions,normals,coverage

def dilate_gutters(image,coverage):
    """Only extend colors beyond islands; never call padding surface coverage."""
    _,nearest=distance_transform_edt(~coverage,return_indices=True)
    result=image.copy();result[~coverage]=image[nearest[0][~coverage],nearest[1][~coverage]]
    return result

def painted_variation(points):
    """Bounded coherent pigment variation in rest space, continuous across UV seams."""
    rng=np.random.default_rng(99131)
    field=rng.uniform(-1,1,(64,64,64)).astype(np.float32)
    broad=map_coordinates(field,(points*np.array([38,32,41])+27).T,order=1,mode='wrap')
    brush=map_coordinates(field,(points*np.array([180,87,163])+13).T,order=1,mode='wrap')
    grain=map_coordinates(field,(points*821+31).T,order=1,mode='wrap')
    return .11*broad+.048*brush+.016*grain
