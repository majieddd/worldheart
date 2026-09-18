"""Pure stance diagnostics shared by sampling and regression fixtures."""
import numpy as np

def stance_metrics(velocities, height=2.0, ground_speed=None):
    v=np.asarray(velocities,float)
    positive=v[v>.01*height];negative=v[v<-.01*height]
    if not len(positive) or not len(negative):return None
    # Both feet travel backwards relative to the same body. Never infer opposite
    # stance signs for left/right and average them into a near-zero ground speed.
    direction=1 if np.median(abs(positive))<=np.median(abs(negative)) else -1
    selected=positive if direction==1 else negative
    measured=float(np.median(abs(selected)));target=measured if ground_speed is None else float(ground_speed)
    residual=float(np.median(abs(selected-direction*target))/max(measured,1e-6))
    return {'measuredGroundSpeed':measured,'testedGroundSpeed':target,'medianResidualRatio':residual,
            'stanceDirection':direction,'samples':len(selected)}
