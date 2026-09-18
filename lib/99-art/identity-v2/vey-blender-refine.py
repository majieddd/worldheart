import bpy, numpy as np, math
# Replace periodic checks with low-contrast irregular paint and direct portable image nodes.
size=1024
y,x=np.mgrid[0:size,0:size]/size
rng=np.random.default_rng(99131)
noise=np.zeros((size,size))
for i in range(24):
    angle=float(rng.uniform(0,6.28));freq=float(rng.uniform(5,160));phase=float(rng.uniform(0,6.28))
    noise+=np.sin((x*np.cos(angle)+y*np.sin(angle))*freq+phase)/(24+i)
paint=np.clip(.92+noise*.11,.78,1.04)
for m in bpy.data.materials:
    if not m.use_nodes:continue
    color=tuple(m.diffuse_color)
    data=np.ones((size,size,4),dtype=np.float32)
    data[:,:,:3]=np.clip(paint[:,:,None]*np.array(color[:3])[None,None,:],0,1)
    img=bpy.data.images.new(m.name+' baked paint',width=size,height=size);img.pixels.foreach_set(data.ravel());img.pack()
    nt=m.node_tree;bs=nt.nodes.get('Principled BSDF')
    for link in list(nt.links):
        if link.to_node==bs and link.to_socket==bs.inputs['Base Color']:nt.links.remove(link)
    tex=nt.nodes.new('ShaderNodeTexImage');tex.image=img
    nt.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
# Flatten eyes against the face, stretch them into their almond direction.
for name in ['Left almond eye','Right almond eye']:
    o=bpy.data.objects[name];o.scale=(1.05,.45,.85)
# Contour hulls remain separate editable meshes.
ink=bpy.data.materials.new('Contour black');ink.diffuse_color=(.007,.009,.014,1);ink.use_nodes=True;ink.use_backface_culling=True
bs=ink.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.007,.009,.014,1);bs.inputs['Roughness'].default_value=1
import bmesh
for o in list(bpy.data.objects):
    if o.type!='MESH' or any(t in o.name for t in ['highlight','Nostril','Instrument','lens','bezel']):continue
    hull=o.copy();hull.data=o.data.copy();hull.name=o.name+' contour';bpy.context.scene.collection.objects.link(hull);hull.scale=tuple(v*1.018 for v in o.scale)
    hull.data.materials.clear();hull.data.materials.append(ink)
    bm=bmesh.new();bm.from_mesh(hull.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(hull.data);bm.free()
scene=bpy.context.scene
scene.render.image_settings.file_format='PNG'
target=artifacts.file(name='vey-blender-refined.png',media_type='image/png');scene.render.filepath=str(target.path)
bpy.ops.render.render(write_still=True);target.publish()
result={'paint':'eight packed 1024 maps, direct Base Color links','contours':'editable backface hulls','rigged':False}

