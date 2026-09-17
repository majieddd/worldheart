"""Replay an explicit, mesh-bound anatomical fit with the retained CMU capture.

New anatomy must receive a reviewed profile. This does not guess landmarks from
a concept sheet and cannot silently apply a Vey fit to a different creature.
"""
import hashlib,json,math
from pathlib import Path
import bpy,bmesh,numpy as np
from mathutils import Vector,Matrix,Quaternion
from scipy.ndimage import gaussian_filter1d

def smooth(x):
    x=max(0.,min(1.,x));return x*x*(3-2*x)

def foot_roll(phase,stance):
    if phase<stance:
        t=phase/stance
        if t<.18:return 12*(1-smooth(t/.18))
        if t<.68:return 0.
        return -30*smooth((t-.68)/.32)
    t=(phase-stance)/(1-stance)
    return -30+36*smooth(t/.5) if t<.5 else 6+6*smooth((t-.5)/.5)

def build(task,meshes,scene,report,profile_path):
    profile=json.loads(Path(profile_path).read_text(encoding='utf-8'))
    sha=hashlib.sha256(Path(task['input']).read_bytes()).hexdigest()
    if profile['sourceSha256']!=sha:raise ValueError('The anatomical fit belongs to a different mesh. Fit and review this model first.')
    defs=[(j['name'],j['head'],j['tail'],j.get('parent')) for j in profile['joints']]
    names={n for n,_,_,_ in defs}
    if not {'root','hips','spine','chest','head','foot.L','foot.R'}.issubset(names):raise ValueError('Incomplete biped fit')
    for obj in meshes:
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        orientation=Matrix.Rotation(math.radians(profile.get('sourceYawDegrees',0)),4,'Z');offset=Vector(profile.get('sourceOffset',[0,0,0]))
        for vertex in obj.data.vertices:vertex.co=orientation@vertex.co+offset
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
        if obj.data.has_custom_normals:bpy.ops.mesh.customdata_custom_splitnormals_clear()
        for face in obj.data.polygons:face.use_smooth=True
    arm=bpy.data.armatures.new('Fitted anatomy');rig=bpy.data.objects.new('Commander_Rig',arm);scene.collection.objects.link(rig)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    for name,head,tail,parent in defs:
        bone=arm.edit_bones.new(name);bone.head=head;bone.tail=tail;bone.use_deform=name!='root'
        if parent:bone.parent=arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for obj in meshes:
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
        obj.vertex_groups.clear();bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        unbound=[v.index for v in obj.data.vertices if sum(g.weight for g in v.groups)<.001]
        if unbound:raise ValueError(f'Heat binding left {len(unbound)} vertices unbound. Correct the fit or topology; no proximity fallback was applied.')
        # Explicit surface regions keep soles and armored plates rigid. Each
        # region is fitted to this source geometry, never inferred from color.
        for region in profile.get('rigidRegions',[]):
            group=obj.vertex_groups.get(region['bone'])
            if not group:raise ValueError('Unknown rigid-region bone')
            low=np.array(region['min']);high=np.array(region['max'])
            for v in obj.data.vertices:
                if np.all(np.array(v.co)>=low) and np.all(np.array(v.co)<=high):
                    for old in list(v.groups):obj.vertex_groups[old.group].remove([v.index])
                    group.add([v.index],1,'REPLACE')
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.vertex_group_limit_total(limit=4);bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    rig.animation_data_create();scene.render.fps=60
    rest={n:arm.bones[n].matrix_local.copy() for n,_,_,_ in defs};heads={n:Vector(h) for n,h,_,_ in defs}
    mapping={'spine':('lowerback','upperback'),'chest':('upperback','thorax'),'neck':('thorax','upperneck'),'head':('upperneck','head')}
    for side,prefix in [('L','l'),('R','r')]:
        mapping.update({f'clavicle.{side}':('thorax',prefix+'clavicle'),f'upper_arm.{side}':(prefix+'clavicle',prefix+'humerus'),f'forearm.{side}':(prefix+'humerus',prefix+'radius'),f'hand.{side}':(prefix+'radius',prefix+'hand'),f'thigh.{side}':(prefix+'hipjoint',prefix+'femur'),f'shin.{side}':(prefix+'femur',prefix+'tibia'),f'foot.{side}':(prefix+'tibia',prefix+'foot'),f'toe.{side}':(prefix+'foot',prefix+'toes')})
    def pose(name,head,direction):
        original=(arm.bones[name].tail_local-arm.bones[name].head_local).normalized();q=original.rotation_difference(Vector(direction).normalized())
        m=q.to_matrix().to_4x4()@rest[name];m.translation=head;rig.pose.bones[name].matrix=m;bpy.context.view_layer.update()
    def key(frame):
        for b in rig.pose.bones:
            b.rotation_mode='QUATERNION'
            for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(prop,frame=frame,group=b.name)
    def finish(name,action):
        for curve in action.fcurves:
            for k in curve.keyframe_points:k.interpolation='LINEAR'
        track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True;rig.animation_data.action=None
    src=Path(__file__).resolve().parents[2]/'artifacts/vey-pilot/mocap';charts={};receipts={}
    if not all((src/(sub+'-processed.npz')).exists() for sub in ('07','09')):
        raise ValueError('Motion sources are missing. Run tools/asset-studio/prepare_motion.py once with the Studio Python, then retry. Setup prepares these pinned sources automatically.')
    hip_height=heads['hips'].z
    for title,sub in [('Walk','07'),('Run','09')]:
        data=np.load(src/(sub+'-processed.npz'));points=data['points'].copy();root=data['root'].copy();idx={n:i for i,n in enumerate(data['names'])};seconds=float(data['seconds']);count=round(seconds*60)
        if np.mean(points[:,idx['ltoes'],1]-points[:,idx['ltibia'],1])>0:points[:,:,1]*=-1;root[:,1]*=-1
        scale=(hip_height-.05)/-np.median(np.minimum(points[:,idx['lfoot'],2],points[:,idx['rfoot'],2]));root=gaussian_filter1d(root,.75,axis=0,mode='wrap')*scale
        action=bpy.data.actions.new(title+' / fitted CMU');rig.animation_data.action=action;positions=[]
        for f in range(count+1):
            t=f/count*(len(points)-1);lo=int(t);hi=min(lo+1,len(points)-1);a=t-lo;p=points[lo]*(1-a)+points[hi]*a;shift=root[lo]*(1-a)+root[hi]*a
            for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
            hips=heads['hips']+Vector(shift);pose('hips',hips,(0,0,1))
            for n,_,_,parent in defs[2:]:
                pb=rig.pose.bones[parent]
                if n.startswith('thigh'):head=hips+(heads[n]-heads['hips'])
                else:head=pb.tail+(pb.matrix.to_3x3()@rest[parent].to_3x3().inverted()@(heads[n]-arm.bones[parent].tail_local))
                if n in mapping:
                    pair=mapping[n];direction=p[idx[pair[1]]]-p[idx[pair[0]]]
                    if n.startswith('upper_arm') and profile.get('armClearance'):
                        direction=Vector(direction).normalized();sign=1 if n.endswith('L') else -1;direction.x=sign*max(sign*direction.x,profile['armClearance'])
                    # A broad reptile head keeps its authored forward orientation;
                    # captured neck motion still carries it through the body.
                    if n in profile.get('preserveRestDirection',[]):direction=pb.matrix.to_3x3()@rest[parent].to_3x3().inverted()@(arm.bones[n].tail_local-heads[n])
                    pose(n,head,direction)
                else:
                    # Tail and digit bones follow their anatomical parent with a
                    # restrained trailing swing. No unrelated human bone mapping.
                    direction=pb.matrix.to_3x3()@rest[parent].to_3x3().inverted()@(arm.bones[n].tail_local-heads[n])
                    if n=='tail1':direction=Matrix.Rotation(math.radians(profile.get('tailLiftDegrees',0)),3,'X')@direction
                    pose(n,head,direction)
                    if n.startswith('tail'):
                        b=rig.pose.bones[n];b.rotation_quaternion @= Quaternion(Vector((0,0,1)),math.sin(math.tau*f/count-int(n[-1])*.5)*(.035 if title=='Walk' else .055))
                        bpy.context.view_layer.update()
            positions.append([list(rig.pose.bones['toe.'+s].tail)for s in ['L','R']]);key(f)
        if title=='Walk' and profile.get('footRoll',True):
            # Reuse the demonstrated heel-flat-toe law, fitted to this anatomy's
            # rest sole direction. Both pitch and lateral bank are controlled.
            cached={s:[]for s in ['L','R']}
            for f in range(count+1):
                scene.frame_set(f)
                for side in cached:cached[side].append(rig.pose.bones['foot.'+side].matrix.copy())
            phases={}
            for side,mats in cached.items():
                travel=np.array([m.translation.y for m in mats[:-1]]);contact=int(travel.argmin());departure=int(travel.argmax());stance=((departure-contact)%count)/count
                if not .4<stance<.8:raise ValueError('No plausible stance interval; review the fitted leg mapping')
                phases[side]=(contact,stance)
            for f in range(count+1):
                scene.frame_set(f)
                for side,mats in cached.items():
                    foot=rig.pose.bones['foot.'+side];original=rest['foot.'+side]
                    source_forward=Vector(profile.get('soleForward',{}).get(side,[0,-1,0]));source_forward.z=0;source_forward.normalize();up=Vector((0,0,1))
                    source_frame=Matrix((source_forward.cross(up),source_forward,up)).transposed()
                    direction=(mats[f]@original.inverted()).to_3x3()@source_forward;direction.z=0;direction.normalize()
                    contact,stance=phases[side];angle=math.radians(foot_roll(((f-contact)%count)/count,stance))
                    forward=direction*math.cos(angle)+up*math.sin(angle);normal=up*math.cos(angle)-direction*math.sin(angle)
                    target_frame=Matrix((direction.cross(up),forward,normal)).transposed();matrix=(target_frame@source_frame.inverted()).to_4x4()@original;matrix.translation=mats[f].translation
                    foot.matrix=matrix;bpy.context.view_layer.update()
                    toe=rig.pose.bones['toe.'+side];toe.matrix=matrix@original.inverted()@rest[toe.name];bpy.context.view_layer.update()
                    for b in [foot,toe]:
                        for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(prop,frame=f)
        # Calibrate against the actual deformed surface, never guessed bone tails.
        floor=[];sole_floor={s:[]for s in ['L','R']};sole_ids={}
        for obj in meshes:
            groups={g.index:g.name for g in obj.vertex_groups}
            sole_ids[obj.name]={s:[v.index for v in obj.data.vertices if sum(g.weight for g in v.groups if groups[g.group] in ['foot.'+s,'toe.'+s])>.9]for s in ['L','R']}
        for f in range(count+1):
            scene.frame_set(f);minimum=1e9;foot_min={s:1e9 for s in ['L','R']}
            for obj in meshes:
                ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh();minimum=min(minimum,min((obj.matrix_world@v.co).z for v in mesh.vertices))
                for side in foot_min:
                    ids=sole_ids[obj.name][side]
                    if ids:foot_min[side]=min(foot_min[side],min((obj.matrix_world@mesh.vertices[i].co).z for i in ids))
                ev.to_mesh_clear()
            floor.append(minimum)
            for side in sole_floor:sole_floor[side].append(foot_min[side])
        shift=.003-min(floor)
        run_correction=None
        if title=='Run':
            # Both feet need their own contact, while the flight arc must remain.
            left=int(np.argmin(sole_floor['L'][:-1]));right=int(np.argmin(sole_floor['R'][:-1]));span=(right-left)%count
            if not span:raise ValueError('Run contacts coincide; review the leg fit')
            offsets=[.003-min(sole_floor[s]) for s in ['L','R']];run_correction=[]
            for f in range(count+1):
                phase=(f-left)%count
                if phase<=span:t=phase/span;value=offsets[0]+(offsets[1]-offsets[0])*smooth(t)
                else:t=(phase-span)/(count-span);value=offsets[1]+(offsets[0]-offsets[1])*smooth(t)
                run_correction.append(max(value,.003-floor[f]))
        curve=next(c for c in action.fcurves if c.data_path=='pose.bones["hips"].location' and c.array_index==1)
        for i,k in enumerate(curve.keyframe_points):
            correction=.003-floor[i] if title=='Walk' else run_correction[i]
            k.co.y+=correction;k.handle_left.y+=correction;k.handle_right.y+=correction
        positions=[]
        for f in range(count+1):
            scene.frame_set(f);positions.append([list(rig.pose.bones['toe.'+s].tail)for s in ['L','R']])
        pos=np.array(positions);vel=np.gradient(pos[:,:,1],seconds/count,axis=0);positive=vel[vel>.04];negative=-vel[vel<-.04];speed=float(min(np.median(positive),np.median(negative)))
        charts[title]={'seconds':seconds,'speed':speed,'feet':positions};receipts[title]={'source':sub+'_01','seconds':seconds,'frames':count+1,'floorShift':shift,'sourceSpeed':float(data['speed'])*scale}
        finish(title,action)
    action=bpy.data.actions.new('Idle / quiet breath');rig.animation_data.action=action
    for f in range(145):
        for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
        phase=f/144*math.tau;rig.pose.bones['hips'].location.y=.003+.002*math.sin(phase);rig.pose.bones['chest'].rotation_quaternion=Quaternion(Vector((1,0,0)),.01*math.sin(phase))
        bpy.context.view_layer.update()
        if 'tail1' in names:
            b=rig.pose.bones['tail1'];matrix=b.matrix.copy();position=matrix.translation.copy();matrix=Matrix.Rotation(math.radians(profile.get('tailLiftDegrees',0)),4,'X')@matrix;matrix.translation=position;b.matrix=matrix;bpy.context.view_layer.update()
        key(f)
    finish('Idle',action)
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    Path(task['output']).with_suffix('.rig.json').write_text(json.dumps({'profile':profile,'clips':receipts,'chart':charts,'ownerApproved':False},indent=2),encoding='utf-8')
    report.update(rigMethod='Explicit anatomy fit, normalized heat skinning and CMU captured locomotion; mesh-bound profile',rigProfileSha256=hashlib.sha256(Path(profile_path).read_bytes()).hexdigest(),motionSpeeds={k:v['speed']for k,v in charts.items()},visualAcceptance='pending')
    return rig
