"""Local MIA v2 inference; retain predictions separately from binding/motion.

The upstream model supplies 52 humanoid bones. Extra appendages and mismatched
digit anatomy require an explicit fit; a successful inference is not approval.
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path


def run(task):
    began = time.perf_counter()
    runtime = Path(task['runtime']).resolve()
    repo = runtime / 'make-it-animatable-v2'
    source, destination = Path(task['input']).resolve(), Path(task['output']).resolve()
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    if destination.exists():
        raise ValueError('Keep the previous prediction and choose a new output name.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(runtime/'pytorch3d-transforms'))
    sys.path.insert(0, str(repo))
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
    os.chdir(repo)
    # On Windows Blender and PyTorch load overlapping DLL dependencies. Loading
    # Blender first avoids an observed bpy DLL entry-point failure.
    import bpy
    import numpy as np
    import torch
    import trimesh
    from util.Hunyuan3D_21.hy3dshape.hy3dshape.models.autoencoders import ShapeVAE
    pretrained = ShapeVAE.from_pretrained
    # Route the unchanged upstream architecture to already verified local files.
    def local_vae(path, **kwargs):
        if path == 'tencent/Hunyuan3D-2.1':
            path = str(runtime/'models/Hunyuan3D-2.1')
        return pretrained(path, **kwargs)
    ShapeVAE.from_pretrained = local_vae
    import app_v2 as mia
    # The inference functions return UI updates. Stable keys let the same actual
    # functions run without constructing Gradio or starting a web server.
    for name in ['state','output_joints_coarse','output_normed_input','output_sample',
                 'output_joints','output_bw','output_rest_lbs']:
        setattr(mia, name, name)
    stages = []
    def step(name, fn):
        start = time.perf_counter()
        value = fn()
        stages.append({'stage': name, 'seconds': time.perf_counter()-start})
        print(json.dumps(stages[-1]), flush=True)
        return value
    step('load models', mia.init_models)
    copied = destination.parent / ('source-'+source_hash[:12]+'.glb')
    if not copied.exists():
        shutil.copy2(source, copied)
    elif hashlib.sha256(copied.read_bytes()).hexdigest() != source_hash:
        raise ValueError('Retained input copy differs from this source.')
    db = mia.DB()
    step('surface sampling', lambda: mia.prepare_input(str(copied), db=db))
    fit_hash = None
    if task.get('rigProfile'):
        fit_path = Path(task['rigProfile']).resolve()
        fit = json.loads(fit_path.read_text('utf-8'))
        if fit['sourceSha256'] != source_hash:
            raise ValueError('Canonicalization fit belongs to another mesh.')
        fit_hash = hashlib.sha256(fit_path.read_bytes()).hexdigest()
        import math
        angle = math.radians(-fit.get('sourceYawDegrees',0))
        rotation = np.array([[math.cos(angle),-math.sin(angle),0],[math.sin(angle),math.cos(angle),0],[0,0,1]])
        yup = np.array([[1,0,0],[0,0,1],[0,-1,0]])
        joints = {j['name']:j for j in fit['joints']}
        norm = mia.get_normalize_transform(db.pts,keep_ratio=True,recenter=True)
        def fitted_point(name,field):
            point = yup @ rotation @ (np.array(joints[name][field])-np.array(fit.get('sourceOffset',[0,0,0])))
            return norm.transform_points(torch.tensor(point,dtype=torch.float32).reshape(1,1,3))[0,0]
        original_coarse = mia.model_forward_coarse
        def guided_coarse(pts,normals):
            predicted = original_coarse(pts,normals)
            for name,canonical in [('hips','Hips'),('thigh.L','LeftUpLeg'),('thigh.R','RightUpLeg'),('hand.L','LeftHand'),('hand.R','RightHand')]:
                if name in joints:
                    i=mia.BONES_IDX_DICT['mixamorig:'+canonical]
                    predicted[0,i,:3]=fitted_point(name,'head');predicted[0,i,3:]=fitted_point(name,'tail')
            return predicted
        mia.model_forward_coarse = guided_coarse
    step('coarse joints and hand sampling', lambda: mia.preprocess(db))
    step('weights joints and pose inference', lambda: mia.infer(True, db))
    step('weight conflict correction', lambda: mia.vis(True, 'LeftForeArm', False, True, db))
    weights = np.maximum(np.asarray(db.bw, dtype=np.float32), 0)
    sums = weights.sum(axis=1, keepdims=True)
    if not np.isfinite(weights).all() or (sums <= 1e-8).any():
        raise ValueError('Predicted skin weights contain unbound or non-finite vertices.')
    # Upstream sparsification can reduce each sum below one. Normalize after
    # sparsifying, before deformation, so the rest conversion cannot shrink it.
    from motion_contact import normalized_influences
    weights = normalized_influences(weights, 4)
    names = list(mia.BONES_IDX_DICT)
    np.savez_compressed(destination, vertices=np.asarray(db.verts), faces=db.faces,
                        weights=weights, heads=db.joints, tails=db.joints_tail,
                        to_rest=db.pose, names=names,
                        parents=np.asarray(mia.KINEMATIC_TREE.parent_indices))
    from rig_contract import inspect_prediction
    extra_appendages = bool(fit_hash and any(j['name'].startswith('tail') for j in fit['joints']))
    checks = inspect_prediction(np.asarray(db.verts),db.faces,db.joints,weights,db.pose,names,extra_appendages)
    report = {'schema': 1, 'engine': 'Make-It-Animatable v2', **checks,
        'sourceSha256': source_hash, 'predictionSha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
        'upstreamCommit': subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),
        'torch': torch.__version__, 'device': str(mia.device), 'samplePoints': mia.N,
        'handSamplingFraction': mia.hands_resample_ratio, 'bones': len(names),
        'vertices': len(weights), 'maxInfluences': int((weights>0).sum(axis=1).max()),
        'maxWeightSumError': float(np.abs(weights.sum(axis=1)-1).max()),
        'minimumSumBeforeFinalNormalization': float(sums.min()),
        'canonicalizationFitSha256': fit_hash,
        'stages': stages, 'seconds': time.perf_counter()-began,
        'review': 'Prediction candidate. Requires target binding, multi-angle deformation and motion review.',
        'limitations': ['52-bone humanoid topology; tails and other extra appendages need a fitted extension',
                        'Does not reconstruct missing geometry or repaint textures']}
    destination.with_suffix('.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report), flush=True)
    if not checks['passed']:
        raise ValueError('Learned rig failed anatomy/deformation checks. Retained prediction; keep the fitted rig or correct the input anatomy.')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('task')
    args = parser.parse_args()
    run(json.loads(Path(args.task).read_text('utf-8')))
