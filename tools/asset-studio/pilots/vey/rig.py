"""Vey-specific hand-placed rig and CMU retarget; a review recipe, not auto-rigging."""
import bpy, json, math, time
from pathlib import Path
import numpy as np
from mathutils import Vector, Matrix
from scipy.ndimage import gaussian_filter1d

ROOT=Path(__file__).resolve().parents[4];OUT=ROOT/'lib/99-art/vey-pilot-v1';SRC=ROOT/'artifacts/vey-pilot/mocap';start=time.time()
bpy.ops.wm.open_mainfile(filepath=str(OUT/'paint-review.blend'));scene=bpy.context.scene;obj=next(o for o in scene.objects if o.type=='MESH')
defs=[('root',(0,0,0),(0,0,.2),None),('hips',(0,0,1.03),(0,0,1.14),'root'),('spine',(0,0,1.14),(0,0,1.31),'hips'),('chest',(0,0,1.31),(0,0,1.46),'spine'),('neck',(0,0,1.46),(0,0,1.63),'chest'),('head',(0,0,1.63),(.015,0,1.96),'neck')]
for side,s in [('L',1),('R',-1)]:
    defs.extend([(f'clavicle.{side}',(0,0,1.43),(s*.205,0,1.43),'chest'),(f'upper_arm.{side}',(s*.205,0,1.43),(s*.335,-.008,1.16),f'clavicle.{side}'),(f'forearm.{side}',(s*.335,-.008,1.16),(s*.437,-.02,.875),f'upper_arm.{side}'),(f'hand.{side}',(s*.437,-.02,.875),(s*.48,-.015,.715),f'forearm.{side}'),(f'thigh.{side}',(s*.12,0,1.03),(s*.158,-.015,.60),'hips'),(f'shin.{side}',(s*.158,-.015,.60),(s*.18,0,.205),f'thigh.{side}'),(f'foot.{side}',(s*.18,0,.205),(s*.18,-.145,.075),f'shin.{side}'),(f'toe.{side}',(s*.18,-.145,.075),(s*.18,-.23,.07),f'foot.{side}')])
arm=bpy.data.armatures.new('Vey anatomical rig');rig=bpy.data.objects.new('Vey_Rig',arm);scene.collection.objects.link(rig);bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for n,h,t,parent in defs:
    b=arm.edit_bones.new(n);b.head=h;b.tail=t
    if parent:b.parent=arm.edit_bones[parent]
    b.use_deform=n!='root'
bpy.ops.object.mode_set(mode='OBJECT')
# Hand-placed anatomical bones, then a topology-aware heat solve. The rejected
# region-box binding and its measured cross-limb failures are retained in artifacts.
rig.animation_data_create();scene.render.fps=60
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
bpy.context.view_layer.objects.active=obj;bpy.ops.object.vertex_group_normalize_all(lock_active=False)
unweighted=[v.index for v in obj.data.vertices if sum(g.weight for g in v.groups)<.001]
if unweighted:raise RuntimeError('Heat skinning left '+str(len(unweighted))+' unweighted vertices; do not export this rig.')
rest={n:arm.bones[n].matrix_local.copy() for n,_,_,_ in defs};lengths={n:(Vector(t)-Vector(h)).length for n,h,t,p in defs};parents={n:p for n,h,t,p in defs};resthead={n:Vector(h) for n,h,t,p in defs}
mapping={'spine':('lowerback','upperback'),'chest':('upperback','thorax'),'neck':('thorax','upperneck'),'head':('upperneck','head')}
for side,prefix in [('L','l'),('R','r')]:
    mapping.update({f'clavicle.{side}':('thorax',prefix+'clavicle'),f'upper_arm.{side}':(prefix+'clavicle',prefix+'humerus'),f'forearm.{side}':(prefix+'humerus',prefix+'radius'),f'hand.{side}':(prefix+'radius',prefix+'hand'),f'thigh.{side}':(prefix+'hipjoint',prefix+'femur'),f'shin.{side}':(prefix+'femur',prefix+'tibia'),f'foot.{side}':(prefix+'tibia',prefix+'foot'),f'toe.{side}':(prefix+'foot',prefix+'toes')})
reports={};charts={}
(OUT/'rig-contract.json').write_text(json.dumps({'coordinateSystem':'Blender Z up, face -Y, anatomical left +X','heightMeters':2,'joints':[{'name':n,'head':h,'tail':t,'parent':p} for n,h,t,p in defs],'method':'Manually positioned for this Vey mesh; not a universal auto-rig template.'},indent=2))
def pose_matrix(name,head,direction):
    original=(arm.bones[name].tail_local-arm.bones[name].head_local).normalized();d=Vector(direction).normalized();q=original.rotation_difference(d)
    m=q.to_matrix().to_4x4()@rest[name];m.translation=Vector(head);rig.pose.bones[name].matrix=m
    bpy.context.view_layer.update()
def key(frame):
    for b in rig.pose.bones:
        b.rotation_mode='QUATERNION';b.keyframe_insert('location',frame=frame,group=b.name);b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name);b.keyframe_insert('scale',frame=frame,group=b.name)
def save_action(name,action):
    for f in action.fcurves:
        for k in f.keyframe_points:k.interpolation='LINEAR'
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True;rig.animation_data.action=None

for title,sub in [('Walk','07'),('Run','09')]:
    data=np.load(SRC/(sub+'-processed.npz'));points=data['points'].copy();root=data['root'].copy();source_names=list(data['names']);idx={n:i for i,n in enumerate(source_names)};seconds=float(data['seconds']);count=round(seconds*60)
    # Match forward from the measured toe direction; names alone do not define axes.
    if np.mean(points[:,idx['ltoes'],1]-points[:,idx['ltibia'],1])>0:points[:,:,1]*=-1;root[:,1]*=-1
    hip_height=-np.median(np.minimum(points[:,idx['lfoot'],2],points[:,idx['rfoot'],2]));scale=1.0/hip_height
    root=gaussian_filter1d(root,.75,axis=0,mode='wrap')*scale
    action=bpy.data.actions.new(title+' / CMU retarget');rig.animation_data.action=action
    positions=[];floor_offsets=[]
    for f in range(count+1):
        t=f/count*(len(points)-1);lo=int(t);hi=min(lo+1,len(points)-1);a=t-lo;p=points[lo]*(1-a)+points[hi]*a;shift=root[lo]*(1-a)+root[hi]*a
        for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
        hips=Vector((shift[0],shift[1],1.03+shift[2]));pose_matrix('hips',hips,(0,0,1))
        for n,_,_,parent in defs[2:]:
            pair=mapping[n];direction=p[idx[pair[1]]]-p[idx[pair[0]]]
            if n.startswith('thigh'):
                s=1 if n.endswith('L') else -1;head=hips+Vector((s*.12,0,0))
            else:
                pb=rig.pose.bones[parent];offset=resthead[n]-arm.bones[parent].tail_local
                head=pb.tail+(pb.matrix.to_3x3()@rest[parent].to_3x3().inverted()@offset)
            pose_matrix(n,head,direction)
        # Preserve captured flight. Calibrate floor by a clip-wide constant later.
        footpoints=[rig.pose.bones['toe.'+s].tail.copy() for s in ['L','R']];positions.append([list(x) for x in footpoints]);floor_offsets.append(min(x.z for x in footpoints))
        key(f)
    # Set minimum toe height to actual boot sole offset, with no per-frame foot glue.
    floor_shift=.06-min(floor_offsets)
    curves=[f for f in action.fcurves if f.data_path=='pose.bones["hips"].location' and f.array_index==1]
    # Bone local Y is vertical for this deliberately vertical hips bone.
    for fc in curves:
        for k in fc.keyframe_points:k.co.y+=floor_shift;k.handle_left.y+=floor_shift;k.handle_right.y+=floor_shift
    source_speed=float(data['speed'])*scale
    pos=np.array(positions);pos[:,:,2]+=floor_shift
    # A planted foot travels backward in the body frame. Measure this after
    # retargeting, rather than assuming source speed survives changed leg lengths.
    vel=np.gradient(pos[:,:,1],seconds/count,axis=0);positive=vel[vel>.04];negative=-vel[vel<-.04]
    stance_speed=float(min(np.median(positive),np.median(negative)))
    # Frame samples and real limb endpoints are kept for independent runtime review.
    charts[title]={'seconds':seconds,'sourceFps':120,'playbackFps':60,'speed':stance_speed,'nominalSourceSpeed':source_speed,'feet':pos.tolist()}
    reports[title]={'source':sub+'_01','seconds':seconds,'frames':count+1,'pelvisVerticalMeters':float(np.ptp(root[:,2])),'pelvisLateralMeters':float(np.ptp(root[:,0])),'nominalSourceSpeed':source_speed,'toeFloor':float(pos[:,:,2].min()),'poseSeamMeters':float(np.max(np.linalg.norm(pos[-1]-pos[0],axis=1))),'source':'CMU optical motion capture; direction retarget with target limb lengths','note':'Foot calibration and deformation require rendered review; no IK foot lock disguises retarget errors.'}
    save_action(title,action)

action=bpy.data.actions.new('Idle / quiet breath');rig.animation_data.action=action
for f in range(145):
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    phase=f/144*math.tau;rig.pose.bones['hips'].location.y=.004*math.sin(phase);rig.pose.bones['chest'].rotation_quaternion=Vector((1,0,0)).rotation_difference(Vector((1,0,.012*math.sin(phase))))
    key(f)
save_action('Idle',action)
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
scene.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'vey-motion.blend'));bpy.ops.export_scene.gltf(filepath=str(OUT/'vey-motion.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_yup=True)
(OUT/'motion-chart.json').write_text(json.dumps(charts));(OUT/'rig-receipt.json').write_text(json.dumps({'bones':len(defs),'clips':reports,'method':'Hand-placed Vey skeleton, normalized heat skinning and captured whole-body retarget','seconds':time.time()-start,'ownerApproval':False},indent=2));print(json.dumps(reports))
