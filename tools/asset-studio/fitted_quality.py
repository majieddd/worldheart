"""Measure the actual fitted surface through complete saved motion cycles."""
import bpy,json,sys,time,hashlib
from pathlib import Path
import numpy as np
source,dest=sys.argv[-2:];start=time.perf_counter();bpy.ops.wm.open_mainfile(filepath=source)
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');scene=bpy.context.scene
for track in rig.animation_data.nla_tracks:track.mute=True
groups={g.index:g.name for g in obj.vertex_groups};feet={s:np.array([v.index for v in obj.data.vertices if sum(g.weight for g in v.groups if groups[g.group] in ['foot.'+s,'toe.'+s])>.9]) for s in ['L','R']}
if any(len(ids)<20 for ids in feet.values()):raise ValueError('Too few fitted sole vertices')
def vertices():
 ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();a=np.empty(len(m.vertices)*3);m.vertices.foreach_get('co',a);ev.to_mesh_clear();a=a.reshape(-1,3);mat=np.array(obj.matrix_world);return a@mat[:3,:3].T+mat[:3,3]
report={'source':Path(source).name,'clips':{},'ownerApproved':False,'visualReviewStillRequired':True}
for action in bpy.data.actions:
 rig.animation_data.action=action;lo,hi=map(int,action.frame_range);samples=[];minima=[];centres={s:[]for s in feet};footmin={s:[]for s in feet}
 for f in range(lo,hi+1):
  scene.frame_set(f);v=vertices();minima.append(float(v[:,2].min()))
  if f in [lo,hi]:samples.append(v)
  for s,ids in feet.items():footmin[s].append(float(v[ids,2].min()));centres[s].append(v[ids].mean(axis=0))
 seconds=(hi-lo)/scene.render.fps;feet_report={};speeds=[]
 for s in feet:
  c=np.array(centres[s]);velocity=np.gradient(c[:,1],1/scene.render.fps);heights=np.array(footmin[s]);contact=heights<.018
  stance=velocity[contact&(velocity>0)]
  if len(stance):speeds.extend(stance.tolist())
  feet_report[s]={'floorMin':float(heights.min()),'liftMax':float(heights.max()),'contactFraction':float(contact.mean()),'stanceSpeedMedian':float(np.median(stance)) if len(stance)else None}
 name=action.name.split(' / ')[0];report['clips'][name]={'seconds':seconds,'frames':hi-lo+1,'floorMinimum':min(minima),'floorMaximum':max(minima),'loopSurfaceMaxMetres':float(np.linalg.norm(samples[-1]-samples[0],axis=1).max()),'feet':feet_report,'contactSpeedMedian':float(np.median(speeds))if speeds else 0}
report['seconds']=time.perf_counter()-start
report['passed']=all(c['floorMinimum']>=-.005 and c['loopSurfaceMaxMetres']<.025 for c in report['clips'].values())
report['passed']&=all(all(f['contactFraction']>0 for f in c['feet'].values())for name,c in report['clips'].items() if any(role in name.lower() for role in ['walk','run']))
report['sha256']=hashlib.sha256(Path(source).with_suffix('.glb').read_bytes()).hexdigest()
report['checks']=[]
for name,c in report['clips'].items():
 for label,ok,detail in [('Surface above floor',c['floorMinimum']>=-.005,str(c['floorMinimum'])+' m'),('Loop surface seam',c['loopSurfaceMaxMetres']<.025,str(c['loopSurfaceMaxMetres'])+' m'),('Both feet make contact',all(f['contactFraction']>0 for f in c['feet'].values()),'Measured deformed sole vertices')]:
  report['checks'].append({'name':name+' / '+label,'status':'pass'if ok else'fail','detail':detail})
Path(dest).write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report));
if not report['passed']:raise RuntimeError('Surface floor or loop seam needs refinement; retained report identifies the failure')
