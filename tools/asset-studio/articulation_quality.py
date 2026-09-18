"""Exported boot-roll and digit-deformation checks; visual acceptance remains separate."""
import argparse,json,hashlib
from pathlib import Path
import numpy as np

def roll_metrics(angles):
    a=np.asarray(angles);flat=float(np.mean(abs(a)<6))
    return {'flatFraction':flat,'minimumPitch':float(a.min()),'maximumPitch':float(a.max()),'pass':flat>=.25 and a.min()<-20 and a.max()<25}

def main():
    import bpy
    ap=argparse.ArgumentParser();ap.add_argument('input');ap.add_argument('--output',required=True);a=ap.parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(Path(a.input).resolve()))
    sc=bpy.context.scene;rig=next(o for o in sc.objects if o.type=='ARMATURE');obj=next(o for o in sc.objects if o.type=='MESH')
    v=np.array([tuple(obj.matrix_world@x.co)for x in obj.data.vertices]);edges=np.array([tuple(e.vertices)for e in obj.data.edges]);checks=[];clips={}
    def check(name,ok,metrics):checks.append({'name':name,'status':'pass' if ok else 'fail','metrics':metrics})
    count=sum(b.name.startswith('digit')for b in rig.data.bones);check('Fitted digit articulation',count==10,{'digitBones':count,'expected':10})
    for tr in rig.animation_data.nla_tracks:tr.mute=True
    for action in bpy.data.actions:
        if not any(n in action.name for n in ['Walk','Run','Idle']):continue
        rig.animation_data.action=action
        if action.slots:rig.animation_data.action_slot=action.slots[0]
        pitches={s:[]for s in ['L','R']};distortion={s:[]for s in ['L','R']};contact={s:[]for s in ['L','R']};positions={s:[]for s in ['L','R']}
        selected={}
        for side,sgn in [('L',1),('R',-1)]:
            mask=(v[:,0]*sgn>.32)&(v[:,2]>.60)&(v[:,2]<.755);e=edges[mask[edges].all(axis=1)];length=np.linalg.norm(v[e[:,0]]-v[e[:,1]],axis=1);good=length>.002;selected[side]=(e[good],length[good])
        for f in np.linspace(*action.frame_range,121):
            sc.frame_set(int(f),subframe=float(f%1));ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();p=np.array([tuple(obj.matrix_world@x.co)for x in me.vertices]);ev.to_mesh_clear()
            for side,sgn in [('L',1),('R',-1)]:
                sole=(v[:,0]*sgn>0)&(v[:,2]<.025);toe=p[sole&(v[:,1]<-.14)].mean(axis=0);heel=p[sole&(v[:,1]>.025)].mean(axis=0);d=toe-heel
                pitches[side].append(float(np.degrees(np.arctan2(d[2],np.linalg.norm(d[:2])))))
                contact[side].append(bool(abs(pitches[side][-1])<6 and max(toe[2],heel[2])<.025));positions[side].append(((toe+heel)/2).tolist())
                e,length=selected[side];distortion[side].extend((abs(np.linalg.norm(p[e[:,0]]-p[e[:,1]],axis=1)-length)/length).tolist())
        for side in pitches:
            if 'Walk' in action.name:
                metrics=roll_metrics(pitches[side]);check(action.name+': '+side+' heel-flat-toe roll',metrics.pop('pass'),metrics)
                fraction=float(np.mean(contact[side]));check(action.name+': '+side+' grounded flat support',fraction>=.20,{'cycleFraction':fraction,'maximumHeelToeHeightMeters':.025})
            data=distortion[side];p95=float(np.percentile(data,95));maximum=float(max(data));check(action.name+': '+side+' digit surface strain',p95<.03 and maximum<.18,{'edgeStrainP95':p95,'edgeStrainMax':maximum})
        clips[action.name]={'solePitchDegrees':pitches,'groundedFlatSupport':contact,'soleCenters':positions,'durationSeconds':float(action.frame_range[1]-action.frame_range[0])/sc.render.fps,'frames':121}
    report={'sha256':hashlib.sha256(Path(a.input).read_bytes()).hexdigest(),'checks':checks,'clips':clips,'status':'fail' if any(c['status']=='fail' for c in checks)else'review_required','visualAcceptance':'pending','scope':'Vey boot roll and fitted digit surfaces; does not approve naturalness or likeness'}
    Path(a.output).write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps({'status':report['status'],'checks':checks}));raise SystemExit(report['status']=='fail')
if __name__=='__main__':main()
