from pathlib import Path
import json,time,hashlib
import trimesh,pymeshlab,numpy as np
start=time.perf_counter();src=Path('artifacts/vey-quality-research/trellis-shape.glb');out=Path('lib/99-art/vey-benchmark-v1/shape.glb')
m=trimesh.load(src,force='mesh');original={'vertices':len(m.vertices),'triangles':len(m.faces),'bounds':m.bounds.tolist()};ms=pymeshlab.MeshSet();ms.add_mesh(pymeshlab.Mesh(vertex_matrix=m.vertices,face_matrix=m.faces.astype(np.int32)))
ms.meshing_remove_duplicate_vertices();ms.meshing_remove_duplicate_faces();ms.meshing_remove_null_faces()
ms.meshing_decimation_quadric_edge_collapse(targetfacenum=40000,preservetopology=True,preservenormal=True,preserveboundary=True,optimalplacement=True,planarquadric=True)
x=ms.current_mesh();m=trimesh.Trimesh(x.vertex_matrix(),x.face_matrix(),process=False);bounds=m.bounds.copy();m.vertices-=np.array([(bounds[0,0]+bounds[1,0])/2,bounds[0,1],(bounds[0,2]+bounds[1,2])/2]);m.vertices*=2/(bounds[1,1]-bounds[0,1]);m.export(out)
report={'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'original':original,'vertices':len(m.vertices),'triangles':len(m.faces),'seconds':time.perf_counter()-start,'method':'MeshLab quadric simplification, boundaries/normals/topology protected; normalized to 2m height','ownerApproved':False}
out.with_suffix('.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
