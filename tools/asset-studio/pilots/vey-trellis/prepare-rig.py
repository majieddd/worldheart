import bpy,bmesh
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path('lib/99-art/vey-benchmark-v1/paint-detail.glb').resolve()))
obj=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# Imported UV seams are duplicated vertices. Weld geometrically while preserving
# per-loop UVs, so the heat solver has a connected surface.
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.00001);bpy.ops.object.mode_set(mode='OBJECT')
bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
for face in obj.data.polygons:face.use_smooth=True
bpy.ops.export_scene.gltf(filepath=str(Path('lib/99-art/vey-benchmark-v1/paint-corrected.glb').resolve()),export_format='GLB',export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(Path('lib/99-art/vey-benchmark-v1/paint-review.blend').resolve()))
