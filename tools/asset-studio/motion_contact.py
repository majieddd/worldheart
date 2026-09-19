"""Contact measurements shared by retargeting and its independent checks."""
import numpy as np

def in_place_travel(feet,fps):
    """Infer treadmill travel from the slower signed fore-aft phase, not foot height."""
    estimates=[]
    for points in feet:
        velocity=np.gradient(np.asarray(points)[:,1],1/fps)
        positive=velocity[velocity>.05];negative=velocity[velocity<-.05]
        if len(positive)<4 or len(negative)<4:continue
        slow=positive if np.median(abs(positive))<=np.median(abs(negative)) else negative
        estimates.append(-float(np.median(slow)))
    if not estimates:return np.zeros(3)
    return np.array([0.,float(np.median(estimates)),0.])

def in_place_stance(points,fps,cyclic=False):
    p=np.asarray(points);v=np.gradient(p[:,1],1/fps);positive=v>.05;negative=v<-.05
    if positive.sum()<4 or negative.sum()<4:raise ValueError('Not enough alternating travel to measure a gait.')
    stance=positive if np.median(abs(v[positive]))<=np.median(abs(v[negative])) else negative
    # Remove isolated detections and bridge one-frame holes, bounded to video cadence.
    from scipy.ndimage import binary_closing,binary_opening
    if cyclic:stance=np.pad(stance,3,mode='wrap')
    stance=binary_opening(binary_closing(stance,iterations=1),iterations=1)
    if cyclic:stance=stance[3:-3]
    if stance.sum()<4:raise ValueError('No sustained measured stance phase.')
    return stance,float(np.median(p[stance,2]))


def source_contacts(positions, fps, height_band=.025, speed_limit=.5):
    p = np.asarray(positions, dtype=float)
    if p.ndim != 2 or p.shape[1] != 3 or len(p) < 3 or fps <= 0 or not np.isfinite(p).all():
        raise ValueError('Contact detection requires finite XYZ samples and positive FPS.')
    speed = np.linalg.norm(np.gradient(p, 1 / fps, axis=0), axis=1)
    floor = float(p[:, 2].min())
    # Low height alone also identifies a foot sliding rapidly over the ground.
    contact = (p[:, 2] < floor + height_band) & (speed < speed_limit)
    return contact, floor, speed


def normalized_influences(weights, limit=4):
    w = np.maximum(np.asarray(weights, dtype=np.float32), 0).copy()
    if w.ndim != 2 or not np.isfinite(w).all() or limit < 1:
        raise ValueError('Invalid skin weights or influence limit.')
    if w.shape[1] > limit:
        # Threshold pruning preserves ties and can accidentally keep 5+ bones.
        indices = np.argpartition(w, -limit, axis=1)[:, -limit:]
        keep = np.zeros(w.shape, dtype=bool)
        np.put_along_axis(keep, indices, True, axis=1)
        w[~keep] = 0
    sums = w.sum(axis=1, keepdims=True)
    if (sums <= 1e-8).any():
        raise ValueError('Predicted skin contains unbound vertices.')
    return w / sums
