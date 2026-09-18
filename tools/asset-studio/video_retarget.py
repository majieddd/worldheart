"""Retarget measured video landmarks to a fitted rig; preserve meshes, UVs and prior clips."""
import json,sys,time,hashlib
from pathlib import Path
import bpy
import numpy as np
from mathutils import Matrix,Vector
from mixamo_retarget import MAPPING

def unit(v):return v/max(np.linalg.norm(v),1e-8)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def retarget(task):
    started=time.perf_counter();source=Path(task['input']);dest=Path(task['output']);data=dict(np.load(task['poses'],allow_pickle=False));loop_fit=None
    if task.get('loop'):
        from video_loops import fit_range
        first,last,loop_fit=fit_range(data['world'],float(data['fps']),task.get('clip','walk'),int(task.get('loopRank',0)))
        for k in ['world','raw','screen','visibility']:data[k]=data[k][first:last+1]
    if dest.exists():raise ValueError('Preserve earlier candidates; choose a new output.')
    bpy.ops.wm.open_mainfile(filepath=str(source.resolve()));scene=bpy.context.scene
    rigs=[o for o in scene.objects if o.type=='ARMATURE']
    if len(rigs)!=1:raise ValueError('Expected one fitted rig.')
    rig=rigs[0];rig.animation_data_create()
    for track in rig.animation_data.nla_tracks:track.mute=True
    rig.animation_data.action=None
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update()
    canonical={v:k for k,v in MAPPING.items() if k in rig.data.bones}
    canonical.update({b.name.rsplit(':',1)[-1]:b.name for b in rig.data.bones if b.name.rsplit(':',1)[-1] in MAPPING.values()})
    required=['Hips','Spine','Spine2','Head']+[s+t for s in ['Left','Right'] for t in ['Arm','ForeArm','Hand','UpLeg','Leg','Foot','ToeBase']]
    if any(n not in canonical for n in required):raise ValueError('Rig lacks required body bones: '+', '.join(n for n in required if n not in canonical))
    rest={n:b.matrix_local.copy() for n,b in rig.data.bones.items()};xyz=data['world'].copy();fps=float(data['fps']);screen=data['screen'];count=len(xyz)
    # MP camera coordinates -> right-handed Z-up; align initial pelvis side axis to rig.
    xyz=xyz[:,:,[0,2,1]];xyz[:,:,2]*=-1
    side=unit(np.median(xyz[:min(24,count),23]-xyz[:min(24,count),24],axis=0));side[2]=0;side=unit(side)
    up=np.array([0.,0.,1.]);forward=np.cross(up,side);basis=np.stack([side,forward,up],axis=1);xyz=xyz@basis
    hip=(xyz[:,23]+xyz[:,24])/2;shoulder=(xyz[:,11]+xyz[:,12])/2
    xyz-=hip[:,None,:];shoulder-=hip;hip*=0
    hips=canonical['Hips'];target_height=rest[hips].translation.z-min(b.head_local.z for b in rig.data.bones)
    source_height=float(np.median(-np.minimum(xyz[:,29,2],xyz[:,30,2])));scale=target_height/max(source_height,.1)
    body_screen=(screen[:,11,1]+screen[:,12,1]+screen[:,23,1]+screen[:,24,1])/4
    screen_height=np.median(np.maximum(screen[:,29,1],screen[:,30,1])-screen[:,0,1]);bob=-(body_screen-np.median(body_screen))*target_height*2/max(screen_height,.2)
    action=bpy.data.actions.new(task.get('name','Video motion'));action.use_fake_user=True;rig.animation_data.action=action
    scene.render.fps=round(fps);scene.frame_start=0;scene.frame_end=count-1;parents=sorted(rig.pose.bones,key=lambda b:len(b.parent_recursive))
    pairs={}
    for side,a in [('Left',0),('Right',1)]:
        pairs.update({side+'Arm':(11+a,13+a),side+'ForeArm':(13+a,15+a),side+'Hand':(15+a,19+a),side+'UpLeg':(23+a,25+a),side+'Leg':(25+a,27+a)})
    floor_min=[];floor_max=[];all_q=[];foot_traces={s:[] for s in ['Left','Right']}
    meshes=[o for o in scene.objects if o.type=='MESH'];image_hashes={im.name:hashlib.sha256(bytes(im.packed_file.data)).hexdigest() for im in bpy.data.images if im.packed_file}
    for f in range(count):
        scene.frame_set(f);directions={}
        for name,(a,b) in pairs.items():directions[canonical[name]]=Vector(unit(xyz[f,b]-xyz[f,a]))
        torso=Vector(unit(shoulder[f]));directions.update({canonical[n]:torso for n in ['Hips','Spine','Spine2']})
        # Foot delta retains the authored ankle/sole rest relationship.
        foot_rot={}
        for side,a in [('Left',0),('Right',1)]:
            initial=Vector(unit(np.median(xyz[:min(12,count),31+a]-xyz[:min(12,count),29+a],axis=0)))
            now=Vector(unit(xyz[f,31+a]-xyz[f,29+a]));foot_rot[canonical[side+'Foot']]=initial.rotation_difference(now)
        frameq=[]
        for b in parents:
            rm=rest[b.name];q=None
            if b.name in directions:
                axis=(rig.data.bones[b.name].tail_local-rig.data.bones[b.name].head_local).normalized();q=axis.rotation_difference(directions[b.name])@rm.to_quaternion()
            elif b.name in foot_rot:q=foot_rot[b.name]@rm.to_quaternion()
            if b.name==hips:
                matrix=(q or rm.to_quaternion()).to_matrix().to_4x4();matrix.translation=rm.translation+Vector((0,0,float(bob[f])));b.matrix=matrix
            elif q is not None:
                # The parent fixes the joint location; only orientation comes from video.
                bpy.context.view_layer.update();matrix=q.to_matrix().to_4x4();matrix.translation=b.head;b.matrix=matrix
            else:b.matrix_basis=Matrix.Identity(4)
            b.rotation_mode='QUATERNION';b.keyframe_insert('rotation_quaternion',frame=f,group=b.name)
            if b.name==hips:b.keyframe_insert('location',frame=f,group=b.name)
            frameq.append(list(b.rotation_quaternion))
        bpy.context.view_layer.update();all_q.append(frameq)
        for side in foot_traces:foot_traces[side].append(list(rig.pose.bones[canonical[side+'ToeBase']].head))
        # Measure the actual deformed surface, never claim a joint check proves the sole.
        if f%2==0 or f==count-1:
            low=float('inf')
            for obj in meshes:
                ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();low=min(low,min((obj.matrix_world@v.co).z for v in m.vertices));ev.to_mesh_clear()
            floor_min.append(low);floor_max.append(low)
    contact=None
    if task.get('contactRefinement',True):
        from mixamo_contact import refine
        from motion_contact import in_place_travel,in_place_stance
        names=['Hips','LeftToeBase','RightToeBase'];source_rest=np.repeat(np.eye(4)[None],3,axis=0);samples=np.repeat(source_rest[None],count,axis=0)
        for j,n in enumerate(names):source_rest[j,:3,3]=np.array(rest[canonical[n]].translation)/scale
        samples[:,:,:3,3]=source_rest[None,:,:3,3]
        samples[:,0,2,3]+=bob/scale
        for j,a in [(1,0),(2,1)]:
            point=xyz[:,31+a].copy();point[:,2]+=bob/scale
            # Align only the neutral anchor; the video supplies all excursion and timing.
            point-=np.median(point[:min(12,count)],axis=0);samples[:,j,:3,3]+=point
            # Retarget excursion through the target's measured limb lengths. Monocular
            # landmark scale is not a valid horizontal reach constraint for this mesh.
            side='Left' if j==1 else 'Right'
            samples[:,j,:2,3]=np.asarray(foot_traces[side])[:,:2]/scale
        travel=in_place_travel([samples[:,j,:3,3] for j in [1,2]],fps)*(count-1)/fps if task.get('clip') in ['walk','run'] else np.zeros(3)
        overrides={s:in_place_stance(samples[:,j,:3,3],fps,cyclic=bool(loop_fit)) for s,j in [('Left',1),('Right',2)]} if task.get('clip') in ['walk','run'] else None
        samples[:,:,:3,3]+=np.linspace(0,1,count)[:,None,None]*travel
        if overrides:
            for side,j in [('Left',1),('Right',2)]:
                mask=overrides[side][0];starts=np.flatnonzero(mask & ~np.r_[False,mask[:-1]])
                for begin in starts:
                    end=begin
                    while end+1<count and mask[end+1]:end+=1
                    samples[begin:end+1,j,:2,3]=np.median(samples[begin:end+1,j,:2,3],axis=0)
        contact=refine(rig,meshes,action,{'names':names,'rest':source_rest,'fps':fps},samples,{v:k for k,v in canonical.items()},scale,travel,count-1,reach_margin=.99,cyclic=False,stable_knee_pole=True,contact_overrides=overrides)
        contact['inferredTravelVector']=travel.tolist()
        floor_min=[];floor_max=[];all_q=[]
        for f in range(count):
            scene.frame_set(f);all_q.append([list(b.rotation_quaternion) for b in parents])
            if f%2==0 or f==count-1:
                low=float('inf')
                for obj in meshes:
                    ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();low=min(low,min((obj.matrix_world@v.co).z for v in m.vertices));ev.to_mesh_clear()
                floor_min.append(low);floor_max.append(low)
    # Small temporal quaternion filter removes noisy IK roll without changing lengths.
    from scipy.ndimage import gaussian_filter1d
    raw_q=np.asarray(all_q)
    for f in range(1,count):
        flip=(raw_q[f-1]*raw_q[f]).sum(axis=1)<0;raw_q[f,flip]*=-1
    filtered=gaussian_filter1d(raw_q,.8,axis=0,mode='nearest');filtered/=np.linalg.norm(filtered,axis=2,keepdims=True)
    locations=[]
    for f in range(count):scene.frame_set(f);locations.append([list(b.location) for b in parents])
    locations=np.asarray(locations)
    if loop_fit and loop_fit['sourceSeamSuitable']:
        from mathutils import Quaternion
        blend=min(5,count//6)
        for i in range(len(parents)):
            qa=Quaternion(filtered[0,i]);qb=Quaternion(filtered[-1,i]);middle=qa.slerp(qb,.5)
            middle_location=(locations[0,i]+locations[-1,i])*.5
            for end,q in [(0,qa),(-1,qb)]:
                correction=middle@q.inverted();delta=middle_location-locations[end,i]
                for k in range(blend):
                    index=k if end==0 else count-1-k;weight=(1-k/blend)**2
                    filtered[index,i]=list(Quaternion().slerp(correction,weight)@Quaternion(filtered[index,i]));locations[index,i]+=delta*weight
    for f in range(count):
        scene.frame_set(f)
        for i,b in enumerate(parents):
            b.rotation_quaternion=filtered[f,i];b.location=locations[f,i];b.keyframe_insert('rotation_quaternion',frame=f,group=b.name);b.keyframe_insert('location',frame=f,group=b.name)
    for curve in action.fcurves:
        keys=curve.keyframe_points
        if loop_fit and len(keys)==count and abs(keys[0].co.y-keys[-1].co.y)<1e-4:
            centre=(keys[0].co.y+keys[-1].co.y)*.5;tangent=(keys[1].co.y-keys[-2].co.y)*.5
            keys[1].co.y=centre+tangent;keys[-2].co.y=centre-tangent
        for key in curve.keyframe_points:key.interpolation='LINEAR'
    if contact:
        # Filtering/loop closure changes the feet too: enforce contact AFTER those
        # edits rather than certifying the pre-filter contact solve.
        if loop_fit and loop_fit['sourceSeamSuitable']:
            local=samples[:,:,:3,3]-np.linspace(0,1,count)[:,None,None]*travel
            centre=(local[0]+local[-1])*.5;da=centre-local[0];db=centre-local[-1]
            for k in range(min(5,count//6)):
                weight=(1-k/min(5,count//6))**2;local[k]+=da*weight;local[-1-k]+=db*weight
            samples[:,:,:3,3]=local+np.linspace(0,1,count)[:,None,None]*travel
        contact=refine(rig,meshes,action,{'names':names,'rest':source_rest,'fps':fps},samples,{v:k for k,v in canonical.items()},scale,travel,count-1,reach_margin=.99,cyclic=bool(loop_fit),stable_knee_pole=True,contact_overrides=overrides)
        contact['inferredTravelVector']=travel.tolist()
    floor_min=[];floor_max=[];all_q=[];boundary_surfaces={};final_toes={s:[] for s in ['Left','Right']}
    for f in range(count):
        scene.frame_set(f);all_q.append([list(b.rotation_quaternion) for b in parents])
        for side in final_toes:final_toes[side].append(list(rig.matrix_world@rig.pose.bones[canonical[side+'ToeBase']].head))
        if f%2==0 or f in [1,count-2,count-1]:
            low=float('inf');vertices=[]
            for obj in meshes:
                ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();v=np.asarray([obj.matrix_world@v.co for v in m.vertices]);low=min(low,float(v[:,2].min()));vertices.append(v);ev.to_mesh_clear()
            floor_min.append(low);floor_max.append(low)
            if f in [0,1,count-2,count-1]:boundary_surfaces[f]=np.concatenate(vertices)
    qs=np.asarray(all_q);dots=np.abs((qs[1:]*qs[:-1]).sum(axis=2)).clip(0,1);jumps=np.degrees(2*np.arccos(dots))
    offset=max(0.,.003-min(floor_min)) if min(floor_min)>-.025 else 0.
    if offset:
        root=next(b for b in parents if b.parent is None);shift=rig.matrix_world.inverted().to_3x3()@Vector((0,0,offset))
        for f in range(count):
            scene.frame_set(f);m=root.matrix.copy();m.translation+=shift;root.matrix=m;root.keyframe_insert('location',frame=f,group=root.name)
        floor_min=[v+offset for v in floor_min];floor_max=[v+offset for v in floor_max]
    checks=[{'name':'Finite bone transforms','pass':bool(np.isfinite(qs).all())},
      {'name':'Joint continuity','pass':float(jumps.max())<45,'value':float(jumps.max()),'unit':'degrees per frame'},
      {'name':'Ground penetration','pass':min(floor_min)>=-.025,'value':min(floor_min),'unit':'metres'},
      {'name':'Paint bytes retained','pass':all(hashlib.sha256(bytes(bpy.data.images[n].packed_file.data)).hexdigest()==h for n,h in image_hashes.items())}]
    if loop_fit:
        seam=float(np.degrees(2*np.arccos(np.abs((qs[0]*qs[-1]).sum(axis=1)).clip(0,1))).max())
        checks.append({'name':'Measured loop closure','pass':loop_fit['sourceSeamSuitable'] and seam<2,'value':seam,'unit':'degrees'})
        surface_seam=float(np.linalg.norm(boundary_surfaces[0]-boundary_surfaces[count-1],axis=1).max())
        velocity_seam=float(np.quantile(np.linalg.norm(((boundary_surfaces[1]-boundary_surfaces[0])-(boundary_surfaces[count-1]-boundary_surfaces[count-2]))*fps,axis=1),.95))
        checks.extend([{'name':'Loop surface position','pass':surface_seam<.025,'value':surface_seam},{'name':'Loop surface velocity','pass':velocity_seam<1.,'value':velocity_seam}])
    if contact and task.get('clip') in ['walk','run']:
        travel_velocity=np.asarray(contact['inferredTravelVector'])*scale/((count-1)/fps)
        for side in final_toes:
            mask=np.asarray(contact['sourceContactFrames'][side],dtype=bool);interior=mask & np.r_[False,mask[:-1]] & np.r_[mask[1:],False]
            velocity=np.gradient(np.asarray(final_toes[side]),1/fps,axis=0)+travel_velocity
            skate=np.linalg.norm(velocity[:,:2],axis=1)[interior];p95=float(np.quantile(skate,.95)) if len(skate) else 999.
            checks.append({'name':side+' stance travel','pass':p95<.35,'value':p95,'unit':'metres per second'})
    report={'method':'video-landmarks','qualityContract':2,'workerSha256':sha(__file__),'sourceRigSha256':sha(source),'poseSha256':sha(task['poses']),'sourceVideoSha256':str(data['sourceSha256']),
      'name':action.name,'fps':fps,'frames':count,'duration':(count-1)/fps,'loopFit':loop_fit,'constantFloorOffset':offset,'scale':scale,'minimumSurfaceHeight':min(floor_min),'maximumLowestSurfaceHeight':max(floor_max),'contactRefinement':contact,'checks':checks,'passed':all(c['pass'] for c in checks),'seconds':round(time.perf_counter()-started,3),'ownerApproved':False,
      'limitations':['Body pose only; no recovered finger animation.','Monocular axial twist and hidden limbs remain uncertain.','Foot contact and loop timing require candidate review; no canned capture is substituted.']}
    track=rig.animation_data.nla_tracks.new();track.name=action.name;track.strips.new(action.name,0,action);track.mute=True;rig.animation_data.action=None
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    scene.frame_set(0);dest.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(dest.with_suffix('.blend').resolve()))
    bpy.ops.export_scene.gltf(filepath=str(dest.resolve()),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_force_sampling=True,export_frame_range=False)
    report['outputSha256']=sha(dest);dest.with_suffix('.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in report.items() if k not in ['contactRefinement']}))
if __name__=='__main__':retarget(json.loads(Path(sys.argv[1]).read_text('utf-8-sig')))
