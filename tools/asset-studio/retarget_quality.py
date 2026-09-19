"""Measure the saved target clip, including travel-compensated stance motion."""
import argparse
import hashlib
import json
from pathlib import Path
import bpy
import numpy as np


def inspect(source,destination):
    source=Path(source);receipt=json.loads(source.with_suffix('.json').read_text('utf-8'))
    bpy.ops.wm.open_mainfile(filepath=str(source.resolve()));scene=bpy.context.scene
    rig=next(o for o in scene.objects if o.type=='ARMATURE');meshes=[o for o in scene.objects if o.type=='MESH']
    for t in rig.animation_data.nla_tracks:t.mute=True
    action=bpy.data.actions[receipt['name']];rig.animation_data.action=action
    mapping={v:k for k,v in receipt['mappedBones'].items()};fps=receipt['outputFps'];lo,hi=map(int,action.frame_range)
    indices={}
    for obj in meshes:
        groups={g.index:g.name for g in obj.vertex_groups}
        indices[obj.name]={s:[v.index for v in obj.data.vertices if sum(g.weight for g in v.groups if groups[g.group] in [mapping[s+'Foot'],mapping[s+'ToeBase']])>.8]for s in ['Left','Right']}
    floor=[];samples=[];feet={s:[]for s in ['Left','Right']};toes={s:[]for s in feet}
    for frame in range(lo,hi+1):
        scene.frame_set(frame);all_vertices=[];sole={s:float('inf') for s in feet}
        for obj in meshes:
            ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();v=np.array([obj.matrix_world@p.co for p in m.vertices]);ev.to_mesh_clear();all_vertices.append(v)
            for s in feet:
                if indices[obj.name][s]:sole[s]=min(sole[s],float(v[indices[obj.name][s],2].min()))
        v=np.concatenate(all_vertices);floor.append(float(v[:,2].min()))
        if frame in [lo,lo+1,hi-1,hi]:samples.append(v)
        for s in feet:
            feet[s].append(sole[s]);toes[s].append(list(rig.matrix_world@rig.pose.bones[mapping[s+'ToeBase']].head))
    checks=[]
    def check(name,ok,detail):checks.append({'name':name,'status':'pass'if ok else'fail','detail':detail})
    seam=float(np.linalg.norm(samples[-1]-samples[0],axis=1).max())
    velocity_seam=float(np.quantile(np.linalg.norm(((samples[1]-samples[0])-(samples[3]-samples[2]))*fps,axis=1),.95))
    check('Surface above floor',min(floor)>=-.005,f'Minimum {min(floor):.5f} m')
    check('Loop surface position',seam<.025,f'Maximum seam {seam:.6f} m')
    check('Loop surface velocity',velocity_seam<1.,f'95th percentile change {velocity_seam:.3f} m/s')
    details={};contact=receipt.get('contactRefinement') or {}
    travel=np.asarray(receipt.get('travelVector',[0,-receipt['provisionalTravelSpeed']*receipt['duration'],0]))/receipt['duration']
    for s in feet:
        heights=np.asarray(feet[s]);mask=np.asarray(contact.get('sourceContactFrames',{}).get(s,[]),dtype=bool)
        check(s+' foot makes contact',bool((heights<.018).any()),f'Minimum sole {heights.min():.5f} m')
        if len(mask)!=len(heights):
            check(s+' captured stance evidence',False,'Missing source contact mask');continue
        interior=mask & np.roll(mask,1)&np.roll(mask,-1)
        velocity=np.gradient(np.asarray(toes[s]),1/fps,axis=0)+travel
        skate=np.linalg.norm(velocity[:,:2],axis=1)[interior]
        p95=float(np.quantile(skate,.95)) if len(skate) else float('inf')
        check(s+' stance travel',p95<.8,f'Interior stance: 95th percentile ground-relative toe speed {p95:.3f} m/s')
        details[s]={'contactFraction':float((heights<.018).mean()),'stanceSpeedP95':p95,'minimumSole':float(heights.min())}
    report={'schema':1,'sha256':hashlib.sha256(source.with_suffix('.glb').read_bytes()).hexdigest(),'clip':action.name,
        'checks':checks,'passed':all(c['status']=='pass' for c in checks),'feet':details,'loopSurfaceMaxMetres':seam,
        'loopVelocityP95':velocity_seam,'stanceMetric':'Source contact windows minus their immediate transition neighbors; full cycle retained for floor and loop checks',
        'visualReviewStillRequired':True,'ownerApproved':False}
    Path(destination).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
    if not report['passed']:raise ValueError('Motion checks failed; retain the candidate for correction.')
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('input');parser.add_argument('output');args=parser.parse_args();inspect(args.input,args.output)
