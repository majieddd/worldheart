"""Contact measurements shared by retargeting and its independent checks."""
import numpy as np


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
