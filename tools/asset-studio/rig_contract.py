"""Reject obvious learned-anatomy and rest-deformation failures before binding."""
import numpy as np


def inspect_prediction(vertices, faces, heads, weights, pose, names, extra_appendages=False):
    v=np.asarray(vertices); h=np.asarray(heads); index={n.rsplit(':',1)[-1]:i for i,n in enumerate(names)}
    bottom=v[:,1].min();height=np.ptp(v[:,1]);checks=[]
    def check(name,ok,detail):checks.append({'name':name,'status':'pass' if ok else 'fail','detail':detail})
    if height<=1e-6:raise ValueError('Prediction has no vertical extent.')
    hip=h[index['Hips'],1];head=h[index['Head'],1]
    check('Upright biped anatomy',head>hip+.1*height and .25*height<hip-bottom<.75*height,
          f'Head Y {head:.3f}, pelvis Y {hip:.3f}; neutral upright input required')
    feet=[float(h[index[s+'Foot'],1]-bottom) for s in ['Left','Right']]
    check('Ankles near the lower body',all(-.03*height<f<.22*height for f in feet),f'Ankle heights {feet}; model height {height:.3f}')
    check('All vertices have normalized skin weights',np.isfinite(weights).all() and np.max(abs(weights.sum(1)-1))<1e-5,'Normalize after limiting influences')
    check('At most four skin influences',int((weights>0).sum(1).max())<=4,'Exact top-k, including tied values')
    transformed=np.einsum('nk,kij,nj->ni',weights,pose,np.column_stack([v,np.ones(len(v))]))[:,:3]
    edges=np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]]);a=np.linalg.norm(v[edges[:,0]]-v[edges[:,1]],axis=1)
    b=np.linalg.norm(transformed[edges[:,0]]-transformed[edges[:,1]],axis=1);valid=a>.001*height
    ratio=b[valid]/a[valid];stretch=float(np.quantile(ratio,.99))
    check('Rest conversion retains local surface scale',np.isfinite(transformed).all() and stretch<3,
          f'99th percentile edge stretch {stretch:.3f}; check still requires rendered inspection')
    check('Appendage coverage declared',not extra_appendages,'Standard MIA predicts 52 humanoid bones; a fitted tail/ear extension is required for extra anatomy')
    return {'checks':checks,'passed':all(c['status']=='pass' for c in checks),'edgeStretchP99':stretch,'visualReviewStillRequired':True}
