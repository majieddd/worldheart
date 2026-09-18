"""Fit Vey boot weights and calibrate floor against the deformed sole, not a joint."""
import argparse,json,time,hashlib
from pathlib import Path
import bpy,numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.spatial import cKDTree
from vey_regions import regions

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--input',required=True);ap.add_argument('--atlas',required=True);ap.add_argument('--surface',required=True);ap.add_argument('--output-dir',required=True);a=ap.parse_args()
    start=time.perf_counter();out=Path(a.output_dir);out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(Path(a.input).resolve()));scene=bpy.context.scene
    rig=next(o for o in scene.objects if o.type=='ARMATURE');obj=next(o for o in scene.objects if o.type=='MESH')
    # Transfer the captured rig onto the cleaned rest surface. Keep the old rig
    # and action data; the original asset remains a separate comparison.
    old=obj
    oldverts=np.array([tuple(old.matrix_world@v.co) for v in old.data.vertices])
    names=[g.name for g in old.vertex_groups]
    weights=np.zeros((len(oldverts),len(names)))
    for v in old.data.vertices:
        for g in v.groups:weights[v.index,g.group]=g.weight
    bpy.ops.import_scene.gltf(filepath=str(Path(a.surface).resolve()))
    obj=next(o for o in scene.objects if o.type=='MESH' and o!=old)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    dist,near=cKDTree(oldverts).query(np.array([tuple(v.co) for v in obj.data.vertices]),k=4)
    influence=1/np.maximum(dist,.0001)**2;influence/=influence.sum(axis=1)[:,None]
    transferred=(weights[near]*influence[:,:,None]).sum(axis=1)
    for j,name in enumerate(names):
        group=obj.vertex_groups.new(name=name)
        for i in np.where(transferred[:,j]>.0001)[0]:group.add([int(i)],float(transferred[i,j]),'REPLACE')
    obj.parent=rig;modifier=obj.modifiers.new('Vey captured rig','ARMATURE');modifier.object=rig
    bpy.data.objects.remove(old,do_unlink=True)
    # Imported custom split normals survive use_smooth=True. Clear them rather
    # than painting over triangular lighting artifacts on the cuffs and mantle.
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    had_custom_normals=obj.data.has_custom_normals
    if had_custom_normals:bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for face in obj.data.polygons:face.use_smooth=True
    atlas=bpy.data.images.load(str(Path(a.atlas).resolve()),check_existing=False);atlas.pack()
    for mat in obj.data.materials:
        for node in mat.node_tree.nodes:
            if node.type=='TEX_IMAGE':node.image=atlas
    verts=np.array([tuple(v.co) for v in obj.data.vertices]);report={'method':'Vey profile: rigid boot sole, ankle transition, ground fit from evaluated sole vertices','sourceSha256':hashlib.sha256(Path(a.input).read_bytes()).hexdigest(),'atlasSha256':hashlib.sha256(Path(a.atlas).read_bytes()).hexdigest(),'clips':{},'ownerApproved':False}
    # A leather boot can bend at the ankle; its sole must not follow shin/toe
    # weights transferred from a differently shaped reconstruction.
    changed=0
    material_ids,parts=regions(verts[:,[0,2,1]]*np.array([1,1,-1]))
    for vertex in obj.data.vertices:
        x,y,z=vertex.co
        side='L' if x>0 else 'R';index=vertex.index
        bone='chest' if material_ids[index]==2 or parts['collar'][index] else 'forearm.'+side if parts['cuffs'][index] else 'shin.'+side if parts['bootguard'][index] else None
        if bone:
            for g in list(vertex.groups):obj.vertex_groups[g.group].remove([index])
            obj.vertex_groups[bone].add([index],1,'REPLACE');changed+=1
        if z>=.285:continue
        for g in list(vertex.groups):obj.vertex_groups[g.group].remove([vertex.index])
        t=np.clip((z-.145)/.14,0,1);t=t*t*(3-2*t)
        obj.vertex_groups['foot.'+side].add([vertex.index],1-float(t),'REPLACE')
        if t>0:obj.vertex_groups['shin.'+side].add([vertex.index],float(t),'REPLACE')
        changed+=1
    report['reweightedVertices']=changed
    for track in rig.animation_data.nla_tracks:track.mute=True
    def sole():
        ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh()
        values=np.array([v.co.z for v in m.vertices]);ev.to_mesh_clear();return float(values.min())
    for action in bpy.data.actions:
        if not any(s in action.name for s in ['Walk','Run','Idle']):continue
        rig.animation_data.action=action
        curves=[f for f in action.fcurves if f.data_path=='pose.bones["hips"].location' and f.array_index==1]
        if len(curves)!=1:raise ValueError('Expected one vertical hips curve')
        curve=curves[0];keys=list(curve.keyframe_points);floor=[]
        for k in keys:scene.frame_set(round(k.co.x));floor.append(sole())
        floor=np.array(floor)
        if 'Walk' in action.name:
            # Walking has support throughout the cycle. Only vertical root
            # clearance changes; fore-aft captured motion stays untouched.
            correction=.002-floor
        elif 'Idle' in action.name:
            # Preserve planted feet while breathing by moving the upper body.
            correction=.002-floor
        else:
            # Preserve the run's captured flight phase. No per-frame foot glue.
            correction=np.full(len(floor),.002-floor.min())
        for k,delta in zip(keys,correction):
            k.co.y+=float(delta);k.handle_left.y+=float(delta);k.handle_right.y+=float(delta)
        measured=[]
        for frame in np.linspace(*action.frame_range,121):
            scene.frame_set(int(frame),subframe=float(frame%1));measured.append(sole())
        report['clips'][action.name]={'beforeMinSole':float(floor.min()),'beforeMaxSole':float(floor.max()),'afterMinSole':min(measured),'afterMaxSole':max(measured),'maximumRootCorrection':float(max(abs(correction)))}
    rig.animation_data.action=None
    for b in rig.pose.bones:b.matrix_basis.identity()
    scene.frame_set(1)
    bpy.ops.export_scene.gltf(filepath=str((out/'paint-refined.glb').resolve()),export_format='GLB',export_animations=False,export_skins=False,export_yup=True)
    paint_receipt=json.loads((out/'paint-refined.json').read_text('utf-8'))
    paint_receipt.update(outputSha256=hashlib.sha256((out/'paint-refined.glb').read_bytes()).hexdigest(),normalRepair='Cleaned surface with coherent orientation, new UVs and smooth normals; original retained separately')
    (out/'paint-refined.json').write_text(json.dumps(paint_receipt,indent=2),encoding='utf-8')
    bpy.ops.wm.save_as_mainfile(filepath=str((out/'vey-motion.blend').resolve()))
    bpy.ops.export_scene.gltf(filepath=str((out/'vey-motion.glb').resolve()),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_yup=True)
    report['clearedImportedCustomNormals']=had_custom_normals
    report['seconds']=time.perf_counter()-start;report['outputSha256']=hashlib.sha256((out/'vey-motion.glb').read_bytes()).hexdigest()
    (out/'motion-refinement.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
if __name__=='__main__':main()
