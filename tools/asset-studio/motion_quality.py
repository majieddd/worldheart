"""Sample real GLB deformation and stance travel. Run with the Blender Python runtime."""
import argparse, hashlib, json, re
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
from motion_metrics import stance_metrics

def main():
    parser=argparse.ArgumentParser();parser.add_argument('input');parser.add_argument('--output',required=True);parser.add_argument('--rig-contract');args=parser.parse_args()
    path=Path(args.input);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
    scene=bpy.context.scene;meshes=[o for o in scene.objects if o.type=='MESH'];rigs=[o for o in scene.objects if o.type=='ARMATURE']
    report={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'checks':[],'visualAcceptance':'pending','probeVersion':'1.1.0'}
    contract=json.loads(Path(args.rig_contract).read_text('utf-8')) if args.rig_contract else None
    if contract:report['rigContractSha256']=hashlib.sha256(Path(args.rig_contract).read_bytes()).hexdigest()
    def check(name,status,metrics):report['checks'].append({'name':name,'status':status,'metrics':metrics})
    if not rigs:check('biped_motion','fail',{'reason':'No armature'})
    else:
        rig=rigs[0];rig.animation_data_create()
        for track in rig.animation_data.nla_tracks:track.mute=True
        normalize=lambda s:re.sub('[^a-z0-9]','',s.lower())
        def bone(names):return next((b for b in rig.pose.bones if normalize(b.name) in names),None)
        left=bone(['toel','lefttoe','lefttoebase','footl','leftfoot']);right=bone(['toer','righttoe','righttoebase','footr','rightfoot']);hips=bone(['hips','pelvis','hip'])
        if not all([left,right,hips]):check('biped_mapping','unavailable',{'reason':'Explicit hip/left/right foot mapping is needed; do not invent a pass'})
        else:
            endpoints={j['name']:Vector(j['tail']) for j in contract['joints']} if contract else {}
            contact_known=all(b.name in endpoints for b in (left,right))
            # GLB preserves joint origins, not Blender bone tail lengths. An
            # explicit rest-space toe tip avoids measuring an arbitrary tail or
            # mistaking toe-joint rotation for ground contact.
            def contact(b):
                point=endpoints[b.name] if contact_known else b.bone.head_local
                return rig.matrix_world @ b.matrix @ b.bone.matrix_local.inverted() @ point
            report['contactSampling']='contract toe tips' if contact_known else 'joint origins; diagnostic only'
            points=np.array([tuple(o.matrix_world@v.co) for o in meshes for v in o.data.vertices]);height=max(np.ptp(points[:,2]),1e-6)
            geometry=[]
            for obj in meshes:
                edges=np.array([tuple(e.vertices) for e in obj.data.edges]);rest=np.array([tuple(obj.matrix_world@v.co) for v in obj.data.vertices])
                before=np.linalg.norm(rest[edges[:,0]]-rest[edges[:,1]],axis=1);geometry.append((obj,edges,before))
            actions=[a for a in bpy.data.actions if any(s in a.name.lower() for s in ('walk','run'))]
            if not actions:check('locomotion_clips','fail',{'reason':'No walk/run action'})
            for action in actions:
                rig.animation_data.action=action
                if hasattr(action,'slots') and action.slots:rig.animation_data.action_slot=action.slots[0]
                start,end=action.frame_range;duration=(end-start)/(scene.render.fps/scene.render.fps_base)
                frames=np.linspace(start,end,121);feet=[];pelvis=[];bad=0
                for i,frame in enumerate(frames):
                    scene.frame_set(int(frame),subframe=float(frame%1));bpy.context.view_layer.update()
                    feet.append([tuple(contact(b)) for b in (left,right)]);pelvis.append(tuple(rig.matrix_world@hips.head))
                    if i%8==0:
                        for obj,edges,before in geometry:
                            evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
                            posed=np.array([tuple(obj.matrix_world@v.co) for v in mesh.vertices]);after=np.linalg.norm(posed[edges[:,0]]-posed[edges[:,1]],axis=1)
                            bad+=int(((before<height*.03)&(after>height*.125)).sum());evaluated.to_mesh_clear()
                feet=np.array(feet);pelvis=np.array(pelvis);seam=float(np.linalg.norm(feet[-1]-feet[0],axis=1).max()/height)
                check(action.name+':deformation','pass' if bad==0 else 'fail',{'crossLimbEdges':bad})
                check(action.name+':loop','pass' if seam<.006 else 'fail',{'footEndpointGapRelativeToHeight':seam,'seconds':duration})
                bob=float(np.ptp(pelvis[:,2])/height);check(action.name+':pelvis','pass' if bob>.012 else 'fail',{'verticalRangeRelativeToHeight':bob})
                # Foot height alone misclassifies swing as stance. Split fore-aft
                # velocity by sign and use the slower direction's actual travel.
                axis=int(np.argmax(np.ptp(feet[:,:,:2],axis=0).sum(axis=0)));v=np.diff(feet[:,:,axis],axis=0)/(duration/120)
                result=stance_metrics(v,height)
                if result is None:check(action.name+':stance','unavailable',{'reason':'No clear bidirectional foot travel'})
                else:
                    # This is a measured diagnostic, not a claim of perfect contact.
                    check(action.name+':stance',('pass' if result['medianResidualRatio']<.25 else 'fail') if contact_known else 'unavailable',{**result,'maximum':.25,'axis':axis,'contactKnown':contact_known})
    report['status']='fail' if any(c['status']=='fail' for c in report['checks']) else 'unavailable' if any(c['status']=='unavailable' for c in report['checks']) else 'review_required'
    Path(args.output).write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps({'status':report['status'],'checks':len(report['checks']),'failed':[c['name'] for c in report['checks'] if c['status']=='fail']}))
    raise SystemExit(1 if report['status']=='fail' else 0)

if __name__=='__main__':main()
