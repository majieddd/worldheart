"""Extract a local FBX reference without distributing its source character.

Run with the Studio Blender Python. Captured frames, sample rate, bind frames,
root displacement and finger rotations remain intact. Loop trimming is a later,
explicit step; importing does not guess a cycle or replace the current model.
"""
import argparse
import hashlib
import json
import time
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix


def extract(source, destination, label=None, template=None):
    started = time.perf_counter()
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if source.suffix.lower() != '.fbx' or not source.is_file():
        raise ValueError('Choose an existing FBX character or animation.')
    if destination.exists():
        raise ValueError('Reference destination already exists; retain it and choose a new name.')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(source), automatic_bone_orientation=False)
    rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    if len(rigs) != 1:
        raise ValueError('Expected one humanoid armature in the FBX.')
    rig = rigs[0]
    bones = list(rig.data.bones)
    names = [b.name for b in bones]
    canonical = [n.rsplit(':', 1)[-1] for n in names]
    required = {'Hips', 'LeftUpLeg', 'RightUpLeg', 'LeftFoot', 'RightFoot', 'LeftArm', 'RightArm'}
    if len(set(canonical)) != len(canonical) or not required.issubset(canonical):
        raise ValueError('The FBX does not have a unique standard Mixamo humanoid skeleton.')
    actions = list(bpy.data.actions)
    if not actions:
        raise ValueError('The FBX has no animation to import.')
    # A normal Mixamo download contains one action. Ambiguous files require an
    # explicit export per clip rather than silently picking the first action.
    if len(actions) != 1:
        raise ValueError('Export one animation per FBX before importing it.')
    action = actions[0]
    rig.animation_data_create()
    rig.animation_data.action = action
    scene = bpy.context.scene
    fps = scene.render.fps / scene.render.fps_base
    start, end = map(float, action.frame_range)
    frames = np.arange(start, end + .0001, 1.)
    rest = np.array([rig.matrix_world @ b.matrix_local for b in bones], dtype=np.float64)
    parents = np.array([names.index(b.parent.name) if b.parent else -1 for b in bones])
    poses = []
    for frame in frames:
        scene.frame_set(int(frame), subframe=frame % 1)
        poses.append([rig.matrix_world @ rig.pose.bones[n].matrix for n in names])
    poses = np.array(poses, dtype=np.float64)
    if not np.isfinite(poses).all() or fps <= 0 or len(frames) < 2:
        raise ValueError('Invalid motion samples or frame rate.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(destination, names=canonical, original_names=names,
                        parents=parents, rest=rest, poses=poses, frames=frames, fps=fps)
    receipt = {'schema': 1, 'name': label or source.stem, 'sourceFile': source.name,
               'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
               'sourceUrl': 'https://www.mixamo.com/', 'provenance': 'local FBX import; exact download route not inferred',
               'fps': fps, 'frames': len(frames), 'sourceFrameRange': [start, end],
               'duration': float((end-start)/fps), 'bones': len(bones),
               'hasFingerBones': any('Index1' in n for n in names),
               'characterMeshes': [{'name': o.name, 'vertices': len(o.data.vertices),
                  'materials': len(o.data.materials)} for o in scene.objects if o.type == 'MESH'],
               'seconds': time.perf_counter()-started,
               'motionSha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
               'review': 'Imported; cycle, contact and target deformation require review.'}
    if template:
        template = Path(template).resolve()
        if template.exists():
            raise ValueError('Refusing to replace an existing skeleton template.')
        rig.animation_data_clear()
        for b in rig.pose.bones:
            b.matrix_basis = Matrix.Identity(4)
        bpy.ops.object.select_all(action='DESELECT')
        rig.select_set(True)
        bpy.context.view_layer.objects.active = rig
        template.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.export_scene.fbx(filepath=str(template), use_selection=True,
             object_types={'ARMATURE'}, bake_anim=False, add_leaf_bones=False)
        receipt['template'] = {'file': template.name, 'sha256': hashlib.sha256(template.read_bytes()).hexdigest(),
                               'origin': 'Rest skeleton from this local Mixamo FBX; not the HF dataset bones file.'}
    destination.with_suffix('.json').write_text(json.dumps(receipt, indent=2)+'\n', encoding='utf-8')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--name')
    parser.add_argument('--template')
    args = parser.parse_args()
    print(json.dumps(extract(args.input, args.output, args.name, args.template)))
