"""Conservative removal of reconstruction bridges in a separate humanoid rig.

Preserves the painted source; removed face indices are recorded for review.
This is not remeshing or a replacement for an open-limb reconstruction.
"""
import numpy as np


def bridge_faces(before, after, faces, ankles):
    before=np.asarray(before);after=np.asarray(after);faces=np.asarray(faces)
    height=float(np.ptp(before[:,2]));edges=np.stack([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]],axis=1)
    original=np.linalg.norm(before[edges[:,:,0]]-before[edges[:,:,1]],axis=2)
    posed=np.linalg.norm(after[edges[:,:,0]]-after[edges[:,:,1]],axis=2)
    stretched=((posed/np.maximum(original,1e-9)>3)&(posed>.02*height)).any(axis=1)
    # A low strip across the empty anatomical gap cannot belong to either boot.
    # Bound the cut strictly to that gap and below the ankle; never cut a leg.
    ankles=np.asarray(ankles);middle=float(ankles[:,0].mean());width=float(np.ptp(ankles[:,0]))*.18
    points=before[faces]
    gap=(np.abs(points[:,:,0]-middle)<width)&(points[:,:,2]<ankles[:,2].min()-.005*height)
    between_feet=gap.any(axis=1)&(points[:,:,2].max(axis=1)<ankles[:,2].min())
    # A shallow connected base below both boots is a reconstructed display plinth,
    # not part of the character. Its cut height is measured from the actual gap.
    center=before[(np.abs(before[:,0]-middle)<width)&(before[:,2]<ankles[:,2].min()-.005*height)]
    base=before[:,2].min();cut_height=None;plinth=np.zeros(len(faces),dtype=bool)
    if len(center) and center[:,2].max()-base<.03*height:
        cut_height=float(center[:,2].max()+.001*height)
        plinth=(points[:,:,2]<cut_height).any(axis=1)
    remove=stretched|between_feet|plinth
    if stretched.mean()>.02 or remove.mean()>.12:raise ValueError(f'Extensive fused geometry ({int(remove.sum())}/{len(faces)} faces). Reconstruct with separated limbs before rigging; source retained.')
    return np.flatnonzero(remove),{'stretchedBridgeFaces':int(stretched.sum()),'betweenBootFaces':int(between_feet.sum()),
        'removedFaces':int(remove.sum()),'sourceFaces':len(faces),'plinthCutHeight':cut_height,
        'method':'Rest-stretched faces and measured shallow inter-boot plinth; original painted source retained'}
