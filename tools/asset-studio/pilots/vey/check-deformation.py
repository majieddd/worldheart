"""Inspect exported rig source for long triangles caused by cross-limb weights."""
import bpy, json, sys
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[4];OUT=ROOT/'lib/99-art/vey-pilot-v1'
path=Path(sys.argv[-1]) if len(sys.argv)>1 and sys.argv[-1].endswith(('.blend','.blend1')) else OUT/'vey-motion.blend'
bpy.ops.wm.open_mainfile(filepath=str(path));s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE');obj=next(o for o in s.objects if o.type=='MESH')
base=np.array([tuple(v.co) for v in obj.data.vertices]);edges=np.array([tuple(e.vertices) for e in obj.data.edges]);before=np.linalg.norm(base[edges[:,0]]-base[edges[:,1]],axis=1);checks=[]
for action in [a for a in bpy.data.actions if a.name.startswith(('Walk','Run'))]:
 rig.animation_data.action=action;worst=0;count=0;example=None
 for f in np.linspace(*action.frame_range,16):
  s.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update();evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh();v=np.array([tuple(p.co) for p in mesh.vertices]);after=np.linalg.norm(v[edges[:,0]]-v[edges[:,1]],axis=1);bad=(before<.06)&(after>.25);count+=int(bad.sum());worst=max(worst,float(after[before<.06].max()));evaluated.to_mesh_clear()
  if bad.any():
   e=edges[np.argmax(np.where(before<.06,after,0))]
   example=[{'rest':base[i].round(3).tolist(),'posed':v[i].round(3).tolist(),'weights':{obj.vertex_groups[g.group].name:round(g.weight,3) for g in obj.data.vertices[i].groups}} for i in e]
 checks.append({'clip':action.name,'longCrossLimbEdges':count,'worstShortEdgeAfterMeters':worst,'example':example,'status':'pass' if count==0 else 'fail'})
report={'file':path.name,'checks':checks,'status':'pass' if all(c['status']=='pass' for c in checks) else 'fail'}
dest=ROOT/'artifacts/vey-pilot'/('deformation-broken.json' if str(path).endswith('.blend1') else 'deformation.json');dest.write_text(json.dumps(report,indent=2));print(json.dumps(report));sys.exit(0 if report['status']=='pass' else 1)
