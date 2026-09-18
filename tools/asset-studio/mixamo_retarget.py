"""Retarget a captured Mixamo clip onto an existing, fitted commander rig.

Keeps mesh topology, UVs, materials and weights. Uses world orientation with a
rest-pose correction for A-pose arms; foot deltas retain the authored flat sole.
Source FPS, trim and duration are explicit. New animation stays a review asset.
"""
import argparse
import hashlib
import json
import math
import time
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

MAPPING = {'hips':'Hips','spine':'Spine','chest':'Spine2','neck':'Neck','head':'Head'}
for side, word in [('L','Left'),('R','Right')]:
    MAPPING.update({f'{a}.{side}':word+b for a,b in [('clavicle','Shoulder'),
       ('upper_arm','Arm'),('forearm','ForeArm'),('hand','Hand'),('thigh','UpLeg'),
       ('shin','Leg'),('foot','Foot'),('toe','ToeBase')]})
    for index, digit in enumerate(['Thumb','Index','Middle','Ring','Pinky'],1):
        MAPPING[f'digit{index}.{side}'] = word+'Hand'+digit+'1'


def retarget(task):
    started = time.perf_counter()
    source, motion, dest = map(Path, [task['input'],task['motion'],task['output']])
    if dest.exists():
        raise ValueError('Retarget output already exists; preserve the earlier candidate.')
    bpy.ops.wm.open_mainfile(filepath=str(source.resolve()))
    scene = bpy.context.scene
    rigs = [o for o in scene.objects if o.type == 'ARMATURE']
    if len(rigs) != 1:
        raise ValueError('Expected one fitted character rig.')
    rig = rigs[0]
    meshes = [o for o in scene.objects if o.type=='MESH']
    if not rig.animation_data:
        rig.animation_data_create()
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    rig.animation_data.action = None
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    data = np.load(motion, allow_pickle=False)
    names = list(data['names']); lookup = {n:i for i,n in enumerate(names)}
    first = int(task.get('startFrame',0)); last = int(task.get('endFrame',len(data['poses'])-1))
    if not 0 <= first < last < len(data['poses']):
        raise ValueError('Invalid source frame trim.')
    samples = data['poses'][first:last+1]
    filter_sigma = float(task.get('cyclicFilterSigma', .65))
    if filter_sigma:
        from scipy.ndimage import gaussian_filter1d
        samples = samples.copy()
        drift = samples[-1,:,:3,3]-samples[0,:,:3,3]
        linear = np.linspace(0,1,len(samples))[:,None,None]*drift[None,:,:]
        residual_points = samples[:,:,:3,3]-linear
        filtered = gaussian_filter1d(residual_points[:-1],filter_sigma,axis=0,mode='wrap')
        samples[:,:,:3,3]=np.concatenate([filtered,filtered[:1]],axis=0)+linear
        for j in range(samples.shape[1]):
            quats=np.array([list(Matrix(m.tolist()).to_quaternion()) for m in samples[:,j]])
            for i in range(1,len(quats)):
                if np.dot(quats[i-1],quats[i])<0:quats[i]*=-1
            if np.dot(quats[0],quats[-1])<0:raise ValueError('Full-turn capture needs a rotation-aware loop fit.')
            filtered=gaussian_filter1d(quats[:-1],filter_sigma,axis=0,mode='wrap')
            filtered/=np.linalg.norm(filtered,axis=1,keepdims=True)
            for i,q in enumerate(np.concatenate([filtered,filtered[:1]],axis=0)):
                samples[i,j,:3,:3]=np.array(Quaternion(q).to_matrix())
    fps = float(data['fps']); duration = (last-first)/fps
    output_fps = int(task.get('fps',60)); scene.render.fps = output_fps
    count = round(duration*output_fps)
    if count < 2:
        raise ValueError('Clip is too short to retarget.')
    rest = {b.name:b.matrix_local.copy() for b in rig.data.bones}
    target_names = set(rest)
    mapping = {n:n.rsplit(':',1)[-1] for n in target_names if n.rsplit(':',1)[-1] in lookup}
    mapping.update({k:v for k,v in MAPPING.items() if k in target_names and v in lookup})
    mapping.update(task.get('boneMap',{}))
    hips = next((n for n,v in mapping.items() if v=='Hips'),None)
    if not hips:
        raise ValueError('The target requires a mapped pelvis bone.')
    source_rest = {n:Matrix(data['rest'][lookup[n]].tolist()) for n in lookup}
    sr = {n:m.to_quaternion() for n,m in source_rest.items()}
    root = samples[:,lookup['Hips'],:3,3]
    source_height = source_rest['Hips'].translation.z
    scale = rest[hips].translation.z / source_height
    travel = (root[-1]-root[0]).copy(); travel[2] = 0
    residual = root-np.linspace(root[0],root[-1],len(root))
    # Preserve the captured crouch relative to bind pose, as well as the bob.
    # Subtracting the mean incorrectly straightens the support leg and floats it.
    residual[:,2] = root[:,2]-source_rest['Hips'].translation.z
    # A-pose targets need their arm frame aligned once. The captured pose then
    # supplies full bend and twist; it is not flattened to a 2D swing direction.
    corrections = {}
    for name, canonical in mapping.items():
        target_rotation = rest[name].to_quaternion()
        if canonical in ['LeftArm','RightArm','LeftForeArm','RightForeArm','LeftHand','RightHand']:
            direction = (rig.data.bones[name].tail_local-rig.data.bones[name].head_local).normalized()
            desired = source_rest[canonical].to_3x3().col[1].normalized()
            target_rotation = direction.rotation_difference(desired) @ target_rotation
        corrections[name] = target_rotation
    parents_first = sorted(rig.pose.bones,key=lambda b:len(b.parent_recursive))
    carry_name=task.get('carryAction',task.get('name','Mixamo Walk').replace('Mixamo ',''))
    carry=next((a for a in bpy.data.actions if a.name.split(' / ')[0]==carry_name),None)
    appendage_poses={b.name:[] for b in parents_first if b.name.startswith('tail') and b.name not in mapping}
    if appendage_poses and not carry:
        raise ValueError('Choose an existing fitted walk/run cycle to retain the unmapped tail motion.')
    if carry and appendage_poses:
        rig.animation_data.action=carry
        lo,hi=carry.frame_range
        for frame in range(count+1):
            value=lo+(hi-lo)*frame/count;scene.frame_set(int(value),subframe=value%1)
            for name in appendage_poses:appendage_poses[name].append(rig.pose.bones[name].matrix_basis.copy())
        rig.animation_data.action=None
    action = bpy.data.actions.new(task.get('name','Mixamo Walk'))
    rig.animation_data.action = action
    poses = {n:[Matrix(x[lookup[n]].tolist()).to_quaternion() for x in samples] for n in set(mapping.values())}
    for frame in range(count+1):
        t = frame/count*(len(samples)-1); lo = int(t); hi = min(lo+1,len(samples)-1); blend = t-lo
        shift = Vector(((1-blend)*residual[lo]+blend*residual[hi])*scale)
        for bone in parents_first:
            name = bone.name
            if bone.parent:
                matrix = bone.parent.matrix @ rest[bone.parent.name].inverted() @ rest[name]
            else:
                matrix = rest[name].copy()
            if name in appendage_poses and appendage_poses[name]:
                matrix @= appendage_poses[name][frame]
            if name == hips:
                matrix.translation = rest[name].translation+shift
            if name in mapping:
                canonical = mapping[name]
                source_q = poses[canonical][lo].slerp(poses[canonical][hi],blend)
                rotation = source_q @ sr[canonical].inverted() @ corrections[name]
                location = matrix.translation.copy()
                matrix = rotation.to_matrix().to_4x4()
                matrix.translation = location
            bone.matrix = matrix
            bone.rotation_mode = 'QUATERNION'
            bpy.context.view_layer.update()
            for prop in ['location','rotation_quaternion','scale']:
                bone.keyframe_insert(prop,frame=frame,group=name)
    contact_report = None
    if task.get('contactRefinement', True):
        from mixamo_contact import refine
        contact_report = refine(rig, meshes, action, data, samples, mapping, scale, travel, count)
    # Matching endpoint poses alone does not match endpoint velocity. Fit the
    # two immediate neighbours to one shared tangent, then validate the actual
    # deformed surface and sole contact after this small closure correction.
    tangent_correction = 0.
    for curve in action.fcurves:
        keys = curve.keyframe_points
        if len(keys)==count+1 and abs(keys[0].co.y-keys[-1].co.y)<1e-4:
            centre=(keys[0].co.y+keys[-1].co.y)/2
            tangent=(keys[1].co.y-keys[-2].co.y)/2
            for index,value in [(1,centre+tangent),(-2,centre-tangent)]:
                tangent_correction=max(tangent_correction,abs(keys[index].co.y-value))
                keys[index].co.y=value
    for curve in action.fcurves:
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'
    # Keep a constant floor offset, so inspection still exposes sliding, floating
    # or incorrect stance. Do not hide defects with per-frame model bouncing.
    floor = float('inf')
    for frame in range(count+1):
        scene.frame_set(frame)
        for obj in meshes:
            evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
            mesh = evaluated.to_mesh()
            floor = min(floor,min((obj.matrix_world@v.co).z for v in mesh.vertices))
            evaluated.to_mesh_clear()
    root_bone = next(b for b in parents_first if b.parent is None)
    # A non-deforming root can carry the common offset without changing pelvis bob.
    contact_failure=None
    if contact_report:
        if floor < -.005:
            contact_failure=f'Contact fit leaves a body surface {floor:.5f} m below the floor; inspect the retained candidate.'
    elif root_bone.name != hips:
        for frame in range(count+1):
            scene.frame_set(frame)
            matrix=root_bone.matrix.copy();matrix.translation.z += .003-floor;root_bone.matrix=matrix
            root_bone.keyframe_insert('location',frame=frame,group=root_bone.name)
    else:
        rig.location.z += .003-floor
    track = rig.animation_data.nla_tracks.new(); track.name = action.name
    track.strips.new(action.name,0,action); track.mute = True
    rig.animation_data.action = None
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    scene.frame_set(0)
    dest.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(dest.with_suffix('.blend').resolve()))
    bpy.ops.export_scene.gltf(filepath=str(dest.resolve()),export_format='GLB',
        export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,
        export_force_sampling=True,export_frame_range=False)
    report = {'schema':1,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'motionSha256':hashlib.sha256(motion.read_bytes()).hexdigest(),
        'outputSha256':hashlib.sha256(dest.read_bytes()).hexdigest(),
        'name':action.name,'sourceFps':fps,'outputFps':output_fps,'sourceFrames':[first,last],
        'cyclicFilterSigmaSourceFrames':filter_sigma,
        'endpointTangentMaxComponentCorrection':tangent_correction,
        'duration':duration,'bodyScale':scale,'capturedTravelMetres':float(np.linalg.norm(travel)),
        'travelVector':(travel*scale).tolist(),
        'provisionalTravelSpeed':float(np.linalg.norm(travel)*scale/duration),
        'mappedBones':mapping,'unmappedBones':sorted(target_names-set(mapping)),
        'constantFloorOffset':0 if contact_report else .003-floor,'contactRefinement':contact_report,'minimumSurfaceHeight':floor,'seconds':time.perf_counter()-started,
        'review':'Motion candidate. Foot contact, seams and target deformation have not been accepted.'}
    dest.with_suffix('.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report),flush=True)
    if contact_failure:raise ValueError(contact_failure)
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('task');args=parser.parse_args()
    retarget(json.loads(Path(args.task).read_text('utf-8')))
