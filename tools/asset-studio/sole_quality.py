"""Measure actual deformed boot surfaces. Joint probes cannot establish sole quality."""
import argparse,hashlib,json,re
from pathlib import Path
import bpy,numpy as np

def main():
    ap=argparse.ArgumentParser();ap.add_argument('input');ap.add_argument('--profile',required=True);ap.add_argument('--output',required=True);a=ap.parse_args()
    profile=json.loads(Path(a.profile).read_text('utf-8'))['sole']
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(Path(a.input).resolve()))
    scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE');obj=next(o for o in scene.objects if o.type=='MESH')
    v=np.array([tuple(obj.matrix_world@x.co) for x in obj.data.vertices]);pairs=[]
    for sign in [-1,1]:
        ids=np.where((v[:,2]<profile['restMaxZ'])&(v[:,0]*sign>0))[0][::5]
        pairs.append((ids[:-1],ids[1:]))
    aidx=np.concatenate([x[0] for x in pairs]);bidx=np.concatenate([x[1] for x in pairs]);rest=np.linalg.norm(v[aidx]-v[bidx],axis=1);usable=rest>.005
    aidx=aidx[usable];bidx=bidx[usable];rest=rest[usable]
    if not len(rest):raise ValueError('No usable sole pairs; fit the surface contract')
    for t in rig.animation_data.nla_tracks:t.mute=True
    report={'version':'sole-surface-1.0','sha256':hashlib.sha256(Path(a.input).read_bytes()).hexdigest(),'checks':[],'visualAcceptance':'pending'}
    for action in bpy.data.actions:
        if not any(s in action.name for s in ['Walk','Run','Idle']):continue
        rig.animation_data.action=action
        if hasattr(action,'slots') and action.slots:rig.animation_data.action_slot=action.slots[0]
        floor=[];distort=[];footframes=[]
        for f in np.linspace(*action.frame_range,121):
            scene.frame_set(int(f),subframe=float(f%1));ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh();p=np.array([tuple(obj.matrix_world@x.co) for x in mesh.vertices]);ev.to_mesh_clear()
            floor.append(float(p[:,2].min()));distort.extend((abs(np.linalg.norm(p[aidx]-p[bidx],axis=1)-rest)/rest).tolist());footframes.append(p[aidx])
        p95=float(np.percentile(distort,95));checks=report['checks']
        checks.append({'name':action.name+':sole shape','status':'pass' if p95<=profile['pairDistortionP95Max'] else 'fail','metrics':{'pairDistortionP95':p95,'maximum':profile['pairDistortionP95Max'],'sampledFrames':121}})
        ok=min(floor)>=profile['groundMinimum'] and ('Walk' not in action.name or max(floor)<=profile['walkGroundMaximum'])
        checks.append({'name':action.name+':ground clearance','status':'pass' if ok else 'fail','metrics':{'minSoleMeters':min(floor),'maxSoleMeters':max(floor),'floorSamples':floor}})
        gap=float(np.linalg.norm(footframes[-1]-footframes[0],axis=1).max())
        checks.append({'name':action.name+':sole loop','status':'pass' if gap<.012 else 'fail','metrics':{'seamMeters':gap}})
    report['status']='fail' if not report['checks'] or any(c['status']=='fail' for c in report['checks']) else 'review_required'
    Path(a.output).write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps({'status':report['status'],'checks':[{**c,'metrics':{k:v for k,v in c['metrics'].items() if k!='floorSamples'}} for c in report['checks']]}));raise SystemExit(1 if report['status']=='fail' else 0)
if __name__=='__main__':main()
