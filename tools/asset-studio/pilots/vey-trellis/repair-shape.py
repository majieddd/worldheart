"""Repair the reconstructed surface, preserving its measured silhouette at millimetre scale."""
import bpy,json,argparse,time,hashlib
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ap=argparse.ArgumentParser();ap.add_argument('--input',required=True);ap.add_argument('--reference',required=True);ap.add_argument('--output',required=True);a=ap.parse_args();start=time.perf_counter()
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(Path(a.input).resolve()))
obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');bpy.context.view_layer.objects.active=obj;obj.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.import_scene.gltf(filepath=str(Path(a.reference).resolve()))
ref=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o!=obj)
before=np.array([tuple(ref.matrix_world@v.co) for v in ref.data.vertices]);source_tree=BVHTree.FromPolygons([Vector(p) for p in before],[tuple(p.vertices) for p in ref.data.polygons])
bpy.data.objects.remove(ref,do_unlink=True)
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
if obj.data.has_custom_normals:bpy.ops.mesh.customdata_custom_splitnormals_clear()
for p in obj.data.polygons:p.use_smooth=True
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.0,island_margin=.008,area_weight=1.0);bpy.ops.object.mode_set(mode='OBJECT')
after=np.array([tuple(v.co) for v in obj.data.vertices]);target_tree=BVHTree.FromPolygons([Vector(p) for p in after],[tuple(p.vertices) for p in obj.data.polygons])
# Distance to vertices exaggerates error on large triangles. Test the actual
# triangle surfaces in both directions, retaining the earlier failed diagnostic.
forward=np.array([source_tree.find_nearest(Vector(p))[3] for p in after]);backward=np.array([target_tree.find_nearest(Vector(p))[3] for p in before])
report={'method':'Unsigned surface occupancy repair, bounded simplification and new UVs; no new neural generation','voxelMeters':.003,'sourceSha256':hashlib.sha256(Path(a.reference).read_bytes()).hexdigest(),'surfaceDistanceP95Meters':float(np.percentile(np.r_[forward,backward],95)),'surfaceDistanceMaxMeters':float(max(forward.max(),backward.max())),'vertices':len(after),'faces':len(obj.data.polygons),'ownerApproved':False}
report['worstNewPoint']=after[np.argmax(forward)].tolist();report['worstOldPoint']=before[np.argmax(backward)].tolist()
report['worstOldNearestPoint']=list(target_tree.find_nearest(Vector(before[np.argmax(backward)]))[0])
report['directionalQuantiles']={'newToOld':np.percentile(forward,[50,95,99,100]).tolist(),'oldToNew':np.percentile(backward,[50,95,99,100]).tolist()}
report['capException']='New sole cap within the bottom 12mm is intentional added surface; its full distance remains reported. Inspect the underside separately.'
report['retainedSurfaceMaxMeters']=float(max(forward[after[:,2]>.012].max(),backward.max()))
obj.data.materials.clear();mat=bpy.data.materials.new('Vey paint canvas');mat.use_nodes=True;mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(1,1,1,1);obj.data.materials.append(mat)
for layer in list(obj.data.color_attributes):obj.data.color_attributes.remove(layer)
out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True);bpy.ops.export_scene.gltf(filepath=str(out.resolve()),export_format='GLB',export_animations=False)
report['seconds']=time.perf_counter()-start;report['outputSha256']=hashlib.sha256(out.read_bytes()).hexdigest();out.with_suffix('.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
if report['surfaceDistanceP95Meters']>.018 or report['retainedSurfaceMaxMeters']>.03:raise RuntimeError('Surface repair changed the retained source too much; preserve rejected output for inspection')
