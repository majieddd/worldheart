"""Bind retained GLB surfaces to a separately saved MIA prediction in Blender."""
import argparse
import hashlib
import json
import time
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector
from scipy.spatial import cKDTree


def bind(task):
    start = time.perf_counter()
    source, prediction, output = map(Path,[task['input'],task['prediction'],task['output']])
    if output.exists():
        raise ValueError('Output already exists; keep the preceding candidate.')
    receipt = json.loads(prediction.with_suffix('.json').read_text('utf-8'))
    if not receipt.get('passed'):
        raise ValueError('Prediction has not passed the current anatomy and deformation contract.')
    if hashlib.sha256(source.read_bytes()).hexdigest() != receipt['sourceSha256']:
        raise ValueError('Prediction belongs to a different input model.')
    if hashlib.sha256(prediction.read_bytes()).hexdigest() != receipt['predictionSha256']:
        raise ValueError('Prediction bytes changed after inference.')
    pred = np.load(prediction,allow_pickle=False)
    # glTF/Trimesh Y-up -> Blender Z-up. No inferred camera rotation.
    c = np.array([[1,0,0,0],[0,0,-1,0],[0,1,0,0],[0,0,0,1]],dtype=float)
    vertices = pred['vertices']@c[:3,:3].T
    heads = pred['heads']@c[:3,:3].T
    tails = pred['tails']@c[:3,:3].T
    to_rest = c@pred['to_rest']@c.T
    weights = pred['weights'].astype(float)
    if not np.isfinite(weights).all() or np.max(abs(weights.sum(axis=1)-1))>.0001:
        raise ValueError('Invalid normalized prediction weights.')
    names = list(pred['names']); parents = pred['parents']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
    scene = bpy.context.scene
    meshes = [o for o in scene.objects if o.type=='MESH']
    uv_before = {}; texture_before = {}
    for image in bpy.data.images:
        pixels = np.empty(len(image.pixels),dtype=np.float32); image.pixels.foreach_get(pixels)
        texture_before[image.name] = hashlib.sha256(pixels.tobytes()).hexdigest()
    for obj in meshes:
        world = obj.matrix_world.copy();obj.parent = None;obj.matrix_world = world
        for modifier in list(obj.modifiers):
            if modifier.type=='ARMATURE':obj.modifiers.remove(modifier)
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        uv_before[obj.name] = [np.array([p.uv[:] for p in layer.data]) for layer in obj.data.uv_layers]
    for obj in list(scene.objects):
        if obj not in meshes:bpy.data.objects.remove(obj,do_unlink=True)
    arm = bpy.data.armatures.new('MIA v2 humanoid')
    rig = bpy.data.objects.new('Commander_MIA_Rig',arm);scene.collection.objects.link(rig)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT')
    for i,name in enumerate(names):
        if np.linalg.norm(tails[i]-heads[i])<1e-6:raise ValueError('Predicted zero-length bone')
        bone = arm.edit_bones.new(name);bone.head=heads[i];bone.tail=tails[i]
    for i,name in enumerate(names):
        if parents[i]>=0:arm.edit_bones[name].parent=arm.edit_bones[names[int(parents[i])]]
    bpy.ops.object.mode_set(mode='OBJECT')
    tree = cKDTree(vertices); maximum = 0
    for obj in meshes:
        positions = np.array([v.co[:] for v in obj.data.vertices]);distance,indices = tree.query(positions)
        maximum = max(maximum,float(distance.max()))
        if distance.max()>max(np.ptp(vertices,axis=0).max()*1e-5,1e-6):
            raise ValueError('Source-to-prediction vertex mapping is not exact enough to retain this surface.')
        obj.vertex_groups.clear();groups=[obj.vertex_groups.new(name=n)for n in names]
        for i,row in enumerate(weights[indices]):
            for j in np.flatnonzero(row):groups[j].add([i],float(row[j]),'REPLACE')
        obj.parent=rig;modifier=obj.modifiers.new('MIA skin','ARMATURE');modifier.object=rig
    rest={b.name:b.matrix_local.copy()for b in arm.bones}
    for i,name in enumerate(names):
        bone=rig.pose.bones[name];bone.matrix=Matrix(to_rest[i].tolist())@rest[name]
        # Preserve anatomical connectivity as in upstream's pose-to-rest export.
        bone.location=(0,0,0);bpy.context.view_layer.update()
    # Bake the learned input-pose -> rest-pose conversion once. UVs, images and
    # topology stay attached to the original surface through this deformation.
    for obj in meshes:
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
        modifier=next(m for m in obj.modifiers if m.type=='ARMATURE')
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='POSE');bpy.ops.pose.armature_apply(selected=False);bpy.ops.object.mode_set(mode='OBJECT')
    for obj in meshes:
        modifier=obj.modifiers.new('MIA skin','ARMATURE');modifier.object=rig
        if len(uv_before[obj.name])!=len(obj.data.uv_layers):raise ValueError('UV layer count changed')
        for before,layer in zip(uv_before[obj.name],obj.data.uv_layers):
            if not np.array_equal(before,np.array([p.uv[:]for p in layer.data])):raise ValueError('UV coordinates changed during binding')
    for image in bpy.data.images:
        pixels=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(pixels)
        if texture_before.get(image.name)!=hashlib.sha256(pixels.tobytes()).hexdigest():raise ValueError('Paint changed during binding')
    floor=min((obj.matrix_world@v.co).z for obj in meshes for v in obj.data.vertices)
    rig.location.z=.003-floor
    output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output.with_suffix('.blend').resolve()))
    bpy.ops.export_scene.gltf(filepath=str(output.resolve()),export_format='GLB',export_animations=False)
    report={'schema':1,'engine':'MIA v2 binding','bones':len(names),
        'sourceSha256':receipt['sourceSha256'],'predictionSha256':receipt['predictionSha256'],
        'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
        'maxVertexMappingError':maximum,'uvUnchanged':True,'paintPixelsUnchanged':True,
        'seconds':time.perf_counter()-start,'review':'Rest-pose candidate. Motion and visual acceptance pending.'}
    output.with_suffix('.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('task');args=parser.parse_args()
    bind(json.loads(Path(args.task).read_text('utf-8')))
