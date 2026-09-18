"""Solve target leg contact from captured motion, preserving limb lengths.

The solver does not invent a gait. The original capture supplies stance, foot
travel, flight and orientation. Surface measurements fit those goals to boots.
"""
import math
import bpy
import numpy as np
from mathutils import Matrix, Vector
from scipy.ndimage import gaussian_filter1d
from motion_contact import source_contacts


def refine(rig, meshes, action, data, samples, mapping, scale, travel, count, reach_margin=.998, cyclic=True, stable_knee_pole=False, contact_overrides=None):
    scene = bpy.context.scene
    inverse = {v:k for k,v in mapping.items()}
    names = list(data['names']); lookup = {n:i for i,n in enumerate(names)}
    chains = {s:[inverse.get(s+n) for n in ['UpLeg','Leg','Foot','ToeBase']] for s in ['Left','Right']}
    if any(None in c for c in chains.values()):
        raise ValueError('Contact refinement requires two complete hip/knee/ankle/toe chains.')
    hip = rig.pose.bones[inverse['Hips']]
    ids = {}
    for obj in meshes:
        group = {g.index:g.name for g in obj.vertex_groups}
        ids[obj.name] = {s:[v.index for v in obj.data.vertices if sum(g.weight for g in v.groups if group[g.group] in c[2:])>.8] for s,c in chains.items()}
    if any(sum(len(ids[o.name][s]) for o in meshes)<10 for s in chains):
        raise ValueError('Insufficient boot surface weights for contact fitting.')
    def floor(side=None, tail=False):
        value = float('inf')
        for obj in meshes:
            ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get()); mesh = ev.to_mesh()
            if tail:
                groups = {g.index:g.name for g in obj.vertex_groups}
                selected = [v.index for v in obj.data.vertices if sum(g.weight for g in v.groups if groups[g.group].startswith('tail'))>.8]
            else:selected = ids[obj.name][side]
            if selected:value = min(value,min((obj.matrix_world@mesh.vertices[i].co).z for i in selected))
            ev.to_mesh_clear()
        return value
    root0 = samples[0,lookup['Hips'],:3,3]-data['rest'][lookup['Hips'],:3,3]
    root0[2] = 0
    source = {}
    for side in chains:
        points = samples[:,lookup[side+'ToeBase'],:3,3]
        contact, minimum, speed = source_contacts(points,float(data['fps']))
        if contact_overrides and side in contact_overrides:contact,minimum=contact_overrides[side]
        if not contact.any():raise ValueError(side+' has no measured source stance; trim or choose another capture.')
        source[side] = {'points':points,'contact':contact,'floor':minimum,'speed':speed}
    cached = []; drops = []
    for frame in range(count+1):
        scene.frame_set(frame); t=frame/count*(len(samples)-1); lo=int(t); hi=min(lo+1,len(samples)-1); a=t-lo
        record={'matrices':{b.name:b.matrix.copy() for b in rig.pose.bones},'goals':{},'contact':{}}
        drop=0.
        for side,chain in chains.items():
            thigh,shin,foot,toe=[rig.pose.bones[n] for n in chain]
            points=source[side]['points']; point=points[lo]*(1-a)+points[hi]*a
            delta=point-data['rest'][lookup[side+'ToeBase'],:3,3]-root0-travel*(frame/count)
            toe_goal=rig.data.bones[chain[3]].head_local+Vector(delta*scale)
            target=foot.head.copy()
            target.x+=toe_goal.x-toe.head.x; target.y+=toe_goal.y-toe.head.y
            desired_floor=.003+max(0,point[2]-source[side]['floor'])*scale
            if contact_overrides and source[side]['contact'][round(t)]:desired_floor=.003
            target.z+=desired_floor-floor(side)
            length=(shin.head-thigh.head).length+(foot.head-shin.head).length
            d=thigh.head-target; horizontal=d.x*d.x+d.y*d.y
            if horizontal>=(length*reach_margin)**2:raise ValueError('Captured stride exceeds this target leg reach; fit stride scale.')
            drop=max(drop,d.z-math.sqrt((length*reach_margin)**2-horizontal))
            record['goals'][side]=target
            record['contact'][side]=bool(source[side]['contact'][round(t)])
        cached.append(record);drops.append(max(0,drop))
    # A smooth pelvis adjustment keeps the captured goals reachable without leg
    # stretching. Preserve captured bob and flight; reject excessive corrections.
    drops=np.maximum(drops,gaussian_filter1d(drops,1.5,mode='wrap' if cyclic else 'nearest'))
    if max(drops)>.15*scale:raise ValueError('Contact needs excessive pelvis correction; review anatomical mapping.')
    tail=rig.pose.bones.get('tail1'); max_tail_angle=0.; max_reach_error=0.
    def aim_with_pole(bone,head,end,lateral):
        def frame(direction,side_axis):
            y=direction.normalized();x=(side_axis-y*side_axis.dot(y)).normalized();z=x.cross(y).normalized()
            return Matrix((x,y,z)).transposed().to_4x4()
        rest=rig.data.bones[bone.name]
        matrix=frame(end-head,lateral)@frame(rest.tail_local-rest.head_local,Vector((-1,0,0))).inverted()@rest.matrix_local
        matrix.translation=head;bone.matrix=matrix;bpy.context.view_layer.update()
    contact_records={s:[] for s in chains}; soles={s:[] for s in chains}
    for frame,record in enumerate(cached):
        scene.frame_set(frame)
        m=hip.matrix.copy();m.translation.z-=float(drops[frame]);hip.matrix=m;bpy.context.view_layer.update()
        for side,chain in chains.items():
            thigh,shin,foot,toe=[rig.pose.bones[n] for n in chain]
            h=thigh.head.copy();k=shin.head.copy();ankle=foot.head.copy();target=record['goals'][side]
            l1=(k-h).length;l2=(ankle-k).length;delta=target-h;distance=delta.length;axis=delta.normalized()
            if distance>l1+l2+1e-4:raise ValueError(f'Unreachable {side} foot goal at frame {frame}: distance {distance:.6f}, leg length {l1+l2:.6f}, pelvis drop {drops[frame]:.6f}.')
            along=(l1*l1-l2*l2+distance*distance)/(2*distance)
            pole=k-h-axis*(k-h).dot(axis)
            if stable_knee_pole:
                facing=hip.matrix.to_quaternion()@rig.data.bones[hip.name].matrix_local.to_quaternion().inverted()@Vector((0,-1,0))
                pole=facing-axis*facing.dot(axis)
            if pole.length<.0001:pole=Vector((0,-1,0))-axis*Vector((0,-1,0)).dot(axis)
            knee=h+axis*along+pole.normalized()*math.sqrt(max(0,l1*l1-along*along))
            fm=record['matrices'][foot.name].copy();tm=record['matrices'][toe.name].copy()
            m=thigh.matrix.copy();rot=(k-h).rotation_difference(knee-h);m=rot.to_matrix().to_4x4()@m;m.translation=h;thigh.matrix=m;bpy.context.view_layer.update()
            m=shin.matrix.copy();rot=(foot.head-shin.head).rotation_difference(target-knee);m=rot.to_matrix().to_4x4()@m;m.translation=knee;shin.matrix=m;bpy.context.view_layer.update()
            if stable_knee_pole:
                # Both segments share the knee plane. Crossing a horizontal shin
                # must not reverse roll as direction.cross(facing) would do.
                lateral=axis.cross(pole).normalized()
                aim_with_pole(thigh,h,knee,lateral);aim_with_pole(shin,knee,target,lateral)
            fm.translation=target;foot.matrix=fm;bpy.context.view_layer.update()
            toe.matrix=fm@record['matrices'][foot.name].inverted()@tm;bpy.context.view_layer.update()
            max_reach_error=max(max_reach_error,abs((shin.head-thigh.head).length-l1),abs((foot.head-shin.head).length-l2))
            contact_records[side].append(record['contact'][side]);soles[side].append(floor(side))
        # Unmapped tails keep their authored cycle; add only the clearance needed
        # under the newly captured pelvis orientation, within a bounded fit.
        if tail:
            original=tail.matrix.copy();angle=0.
            while floor(tail=True)<.008 and angle<30:
                angle+=1
                direction=original.to_3x3().col[1];axis=direction.cross(Vector((0,0,1)))
                if axis.length<1e-5:raise ValueError('Cannot infer tail clearance axis from vertical tail.')
                m=Matrix.Rotation(math.radians(angle),4,axis.normalized())@original;m.translation=original.translation;tail.matrix=m;bpy.context.view_layer.update()
            if floor(tail=True)<.003:raise ValueError('Tail clearance exceeds the fitted adjustment range.')
            max_tail_angle=max(max_tail_angle,angle)
        for bone in rig.pose.bones:
            for prop in ['location','rotation_quaternion','scale']:bone.keyframe_insert(prop,frame=frame,group=bone.name)
    return {'method':'Captured toe height and velocity, boot-surface goals, two-bone IK',
        'maxPelvisDrop':float(max(drops)),'maxLegLengthError':max_reach_error,
        'maxTailClearanceDegrees':max_tail_angle,'sourceContactFrames':contact_records,
        'soleHeights':soles,'contactThresholds':{'heightMetres':.025,'speedMetresPerSecond':.5}}
