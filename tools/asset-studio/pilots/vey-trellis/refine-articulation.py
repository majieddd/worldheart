"""Vey articulation pass on the retained clean surface; no regeneration or repaint."""
import bpy,argparse,json,time,hashlib,math
from pathlib import Path
import numpy as np
from scipy.sparse import coo_matrix
from mathutils import Vector,Matrix,Quaternion

def smooth(x):
    x=np.clip(x,0,1);return x*x*(3-2*x)

def roll(phase,stance):
    # Measured forward/back ankle extrema anchor the phases. Authored boot roll
    # gives a distinct heel contact, flat support and toe departure.
    if phase<stance:
        t=phase/stance
        if t<.18:return 15*(1-smooth(t/.18))
        if t<.68:return 0.
        return -38*smooth((t-.68)/.32)
    t=(phase-stance)/(1-stance)
    if t<.50:return -38+45*smooth(t/.50)
    return 7+8*smooth((t-.50)/.50)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--input',required=True);ap.add_argument('--output-dir',required=True);a=ap.parse_args();start=time.perf_counter()
    out=Path(a.output_dir);out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(Path(a.input).resolve()));sc=bpy.context.scene
    rig=next(o for o in sc.objects if o.type=='ARMATURE');obj=next(o for o in sc.objects if o.type=='MESH')
    for tr in rig.animation_data.nla_tracks:tr.mute=True
    rig.animation_data.action=None
    for b in rig.pose.bones:b.matrix_basis.identity()
    sc.frame_set(1)
    original=np.array([tuple(v.co)for v in obj.data.vertices]);adjusted=0
    # Open the lower cuff/wrist radially about the fitted forearm axis. No hard
    # scale seam, no world-X stretch of the entire hand, and UVs stay attached.
    for side,sgn in [('L',1),('R',-1)]:
        bone=rig.data.bones['forearm.'+side];center=np.array(bone.tail_local);axis=np.array((bone.tail_local-bone.head_local).normalized())
        for v in obj.data.vertices:
            p=original[v.index]
            if p[0]*sgn<.31 or not .79<p[2]<1.02:continue
            d=p-center;axial=d@axis;radial=d-axis*axial
            amount=.18*math.exp(-(axial/.070)**2)
            v.co=Vector(p+radial*amount);adjusted+=1
    # Each palm and digit moves with its hand. Blend only through the wrist,
    # leaving the cuff on the forearm rather than dragging fingers with it.
    for v in obj.data.vertices:
        x,y,z=original[v.index]
        if abs(x)<.32 or z>.891 or z<.60:continue
        side='L' if x>0 else 'R';t=float(smooth((z-.825)/.060))
        for g in list(v.groups):obj.vertex_groups[g.group].remove([v.index])
        obj.vertex_groups['hand.'+side].add([v.index],1-t,'REPLACE')
        if t:obj.vertex_groups['forearm.'+side].add([v.index],t,'REPLACE')
    # Individually fitted digit pivots. A relaxed locomotion grip should bend
    # at knuckles, not stretch transferred forearm weights through the fingers.
    digits={};bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    left=[((.426,.051,.775),(.385,.054,.697)),((.468,.039,.779),(.426,.045,.648)),((.478,-.010,.780),(.454,-.008,.648)),((.473,-.066,.784),(.449,-.069,.669)),((.409,-.054,.819),(.378,-.061,.753))]
    right=[((.428,.047,.783),(.390,.047,.711)),((.468,.025,.779),(.425,.026,.658)),((.478,-.025,.780),(.440,-.026,.646)),((.474,-.089,.794),(.450,-.089,.682)),((.406,-.069,.824),(.378,-.078,.770))]
    for side,sgn,fit in [('L',1,left),('R',-1,right)]:
        for i,(h,t)in enumerate(fit):
            name=f'digit{i+1}.{side}';head=Vector((h[0]*sgn,h[1],h[2]));tail=Vector((t[0]*sgn,t[1],t[2]));b=rig.data.edit_bones.new(name);b.head=head;b.tail=tail;b.parent=rig.data.edit_bones['hand.'+side];digits[name]=(np.array(head),np.array(tail),i,sgn)
    bpy.ops.object.mode_set(mode='OBJECT')
    for name in digits:obj.vertex_groups.new(name=name);rig.pose.bones[name].rotation_mode='QUATERNION'
    for v in obj.data.vertices:
        p=original[v.index]
        if abs(p[0])<.32 or not .60<p[2]<.83:continue
        side='L' if p[0]>0 else 'R';fits={n:data for n,data in digits.items()if n.endswith(side)}
        def distance(item):
            h,t,_,_=item[1];axis=t-h;u=np.clip((p-h)@axis/(axis@axis),0,1);return np.linalg.norm(p-h-axis*u)
        name,(h,t,index,sgn)=min(fits.items(),key=distance)
        weight=float(smooth((h[2]+.016-p[2])/.043))
        for g in list(v.groups):obj.vertex_groups[g.group].remove([v.index])
        obj.vertex_groups['hand.'+side].add([v.index],1-weight,'REPLACE')
        if weight:obj.vertex_groups[name].add([v.index],weight,'REPLACE')
    # Smooth the fitted knuckle transitions across actual surface neighbors.
    # Hard nearest-digit assignment tore a few webbing edges on the left hand.
    names=list(digits)+['hand.L','hand.R'];weights=np.zeros((len(original),len(names)))
    lookup={obj.vertex_groups[n].index:j for j,n in enumerate(names)}
    for v in obj.data.vertices:
        for g in v.groups:
            if g.group in lookup:weights[v.index,lookup[g.group]]=g.weight
    edges=np.array([tuple(e.vertices)for e in obj.data.edges]);row=np.r_[edges[:,0],edges[:,1]];col=np.r_[edges[:,1],edges[:,0]]
    adjacency=coo_matrix((np.ones(len(row)),(row,col)),shape=(len(original),len(original))).tocsr();degree=np.asarray(adjacency.sum(axis=1)).ravel()
    selected=(abs(original[:,0])>.32)&(original[:,2]>.60)&(original[:,2]<.821)
    for _ in range(5):
        averaged=(adjacency@weights)/np.maximum(degree[:,None],1);weights[selected]=weights[selected]*.35+averaged[selected]*.65
    weights[selected]/=np.maximum(weights[selected].sum(axis=1)[:,None],1e-8)
    for i in np.where(selected)[0]:
        for g in list(obj.data.vertices[i].groups):obj.vertex_groups[g.group].remove([int(i)])
        for j in np.where(weights[i]>.00001)[0]:obj.vertex_groups[names[j]].add([int(i)],float(weights[i,j]),'REPLACE')
    report={'method':'Measured ankle-phase boot roll, cuff opening fit and isolated palm/digit weights','sourceSha256':hashlib.sha256(Path(a.input).read_bytes()).hexdigest(),'wristRadialGain':.18,'adjustedVertices':adjusted,'clips':{},'ownerApproved':False}
    for action in list(bpy.data.actions):
        if not any(n in action.name for n in ['Walk','Run','Idle']):continue
        rig.animation_data.action=action
        frames=np.arange(round(action.frame_range[0]),round(action.frame_range[1])+1);count=len(frames)-1
        for i,f in enumerate(frames):
            sc.frame_set(int(f))
            for name,(h,t,index,sgn)in digits.items():
                base=7 if 'Idle' in action.name else 22 if 'Run' in action.name else 12
                angle=(base+index*1.4+1.3*math.sin(math.tau*i/count+(0 if sgn>0 else math.pi))) * (.55 if index==4 else 1)
                axis=rig.data.bones[name].matrix_local.to_3x3().inverted()@Vector((0,sgn,0));b=rig.pose.bones[name];b.rotation_quaternion=Quaternion(axis,math.radians(angle));b.keyframe_insert('rotation_quaternion',frame=int(f))
        if 'Walk' in action.name:
            cached={side:[]for side in ['L','R']}
            for f in frames:
                sc.frame_set(int(f))
                for side in cached:cached[side].append(rig.pose.bones['foot.'+side].matrix.copy())
            phases={}
            sole_frames={}
            for side,mats in cached.items():
                pos=np.array([m.translation.y for m in mats[:-1]]);contact=int(np.argmin(pos));departure=int(np.argmax(pos));stance=((departure-contact)%count)/count
                if not .45<stance<.78:raise ValueError('Walk has no plausible full stance interval')
                phases[side]={'contactFrame':contact,'departureFrame':departure,'stanceFraction':stance}
                sgn=1 if side=='L' else -1;sole=(original[:,0]*sgn>0)&(original[:,2]<.025)
                direction=Vector(original[sole&(original[:,1]<-.14)].mean(axis=0)-original[sole&(original[:,1]>.025)].mean(axis=0));direction.z=0;direction.normalize();up=Vector((0,0,1));sole_frames[side]=(direction,Matrix((direction.cross(up),direction,up)).transposed())
            for i,f in enumerate(frames):
                sc.frame_set(int(f))
                for side in cached:
                    foot=rig.pose.bones['foot.'+side];rest=foot.bone.matrix_local
                    mat=cached[side][i].copy();delta=mat@rest.inverted();rest_forward,source_frame=sole_frames[side];direction=delta.to_3x3()@rest_forward;direction.z=0;direction.normalize()
                    phase=((i-phases[side]['contactFrame'])%count)/count
                    target=math.radians(float(roll(phase,phases[side]['stanceFraction'])))
                    # Fit the actual sole frame, including lateral bank. Pitch
                    # alone left the right boot resting on its outside edge.
                    up=Vector((0,0,1));forward=direction*math.cos(target)+up*math.sin(target);normal=up*math.cos(target)-direction*math.sin(target)
                    target_frame=Matrix((direction.cross(up),forward,normal)).transposed()
                    rot=(target_frame@source_frame.inverted()).to_4x4()@rest;rot.translation=mat.translation
                    foot.matrix=rot;bpy.context.view_layer.update()
                    for prop in ['location','rotation_quaternion','scale']:foot.keyframe_insert(prop,frame=int(f))
                    toe=rig.pose.bones['toe.'+side];toe.matrix=rot@rest.inverted()@toe.bone.matrix_local
                    bpy.context.view_layer.update()
                    for prop in ['location','rotation_quaternion','scale']:toe.keyframe_insert(prop,frame=int(f))
            report['clips'][action.name]={'phases':phases,'heelContactDegrees':15,'toeDepartureDegrees':-38}
        # Refit support height after changing the orientation, preserving run flight.
        curve=next(c for c in action.fcurves if c.data_path=='pose.bones["hips"].location' and c.array_index==1)
        floor=[]
        for k in curve.keyframe_points:
            sc.frame_set(round(k.co.x));ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();floor.append(min(v.co.z for v in me.vertices));ev.to_mesh_clear()
        correction=.002-np.array(floor) if 'Run' not in action.name else np.full(len(floor),.002-min(floor))
        for k,d in zip(curve.keyframe_points,correction):k.co.y+=float(d);k.handle_left.y+=float(d);k.handle_right.y+=float(d)
        for fc in action.fcurves:
            if 'foot.' in fc.data_path or 'toe.' in fc.data_path:
                for k in fc.keyframe_points:k.interpolation='LINEAR'
    rig.animation_data.action=None
    for b in rig.pose.bones:b.matrix_basis.identity()
    sc.frame_set(1)
    bpy.ops.export_scene.gltf(filepath=str((out/'paint-articulated.glb').resolve()),export_format='GLB',export_animations=False,export_skins=False,export_yup=True)
    bpy.ops.wm.save_as_mainfile(filepath=str((out/'vey-motion.blend').resolve()))
    bpy.ops.export_scene.gltf(filepath=str((out/'vey-motion.glb').resolve()),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_yup=True)
    report.update(seconds=time.perf_counter()-start,outputSha256=hashlib.sha256((out/'vey-motion.glb').read_bytes()).hexdigest())
    (out/'articulation.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
if __name__=='__main__':main()
