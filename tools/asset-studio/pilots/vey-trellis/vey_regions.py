"""One explicit material fit shared by Vey's paint and rigid costume weights."""
import numpy as np

def regions(points):
    x,y,z=points.T;ax=abs(x);ids=np.zeros(len(points),np.uint8)
    ids[(y>1.535)|((y<.885)&(ax>.32))]=1
    front=np.clip((z+.04)/.10,0,1);front=front**2*(3-2*front)
    edge=(1.335+.15*x-.40*np.maximum(ax-.13,0))*front+(1.295-.015*ax)*(1-front)
    mantle=(y>edge)&(y<1.527);ids[mantle]=2
    collar=(y>1.487)&(y<1.553)&(ax<.086);ids[collar]=3
    cuff_height=y-.38*(ax-.39)
    cuffs=(ax>.29)&(cuff_height>.868)&(cuff_height<1.072);ids[cuffs]=3
    ids[y<.287]=4
    bootguard=(y>=.287)&(y<.398)&(ax<.30);ids[bootguard]=3
    belt=(y>1.035)&(y<1.119)&(ax<.224);ids[belt]=5
    return ids,dict(mantle=mantle,mantle_edge=edge,collar=collar,cuffs=cuffs,cuff_height=cuff_height,bootguard=bootguard,belt=belt)
