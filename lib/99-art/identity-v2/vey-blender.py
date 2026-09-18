import bpy, math
from mathutils import Vector
import numpy as np

# A deliberately editable comparison mesh. All paint is an embedded UV image.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=640
scene.render.resolution_y=800
scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Neutral studio')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.19,.22,.27,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
size=1024
y,x=np.mgrid[0:size,0:size]/size
paint=(.89+.035*np.sin(x*173+y*29)+.045*np.sin(x*43-y*97)+.025*np.cos(x*239+y*251))
pixels=np.ones((size,size,4),dtype=np.float32)
pixels[:,:,:3]=paint[:,:,None]
img=bpy.data.images.new('Painted brush variation 1024',width=size,height=size)
img.pixels.foreach_set(pixels.ravel())
img.pack()
def mat(name,c,rough=.85):
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
    nt=m.node_tree;bs=nt.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=rough
    tex=nt.nodes.new('ShaderNodeTexImage');tex.image=img
    mix=nt.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*c,1)
    nt.links.new(tex.outputs['Color'],mix.inputs[1]);nt.links.new(mix.outputs[0],bs.inputs['Base Color'])
    return m
skin=mat('Gray skin',(.56,.59,.63));suit=mat('Aubergine fabric',(.18,.085,.20));mantle=mat('Slate mantle',(.19,.28,.30));ivory=mat('Ivory ceramic',(.8,.76,.64));ink=mat('Obsidian eyes and ink',(.008,.011,.019),.28);mint=mat('Mint instrument',(.23,.86,.59));violet=mat('Violet lens',(.30,.07,.55),.26);boots=mat('Dark boots',(.06,.045,.08))
parts=[]
def ell(name,p,s,m,seg=32,rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p)
    o=bpy.context.object;o.name=name;o.scale=s;o.data.materials.append(m)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for poly in o.data.polygons:poly.use_smooth=True
    parts.append(o);return o
def link(name,a,b,r1,r2,m):
    a,b=Vector(a),Vector(b);d=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=r1,radius2=r2,depth=d.length,location=(a+b)/2)
    o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
    mod=o.modifiers.new('Soft tailored edge','BEVEL');mod.width=.025;mod.segments=3
    for poly in o.data.polygons:poly.use_smooth=True
    parts.append(o);return o
def line(name,pts,r=.008,m=ink):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2
    s=c.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
    for bp,p in zip(s.bezier_points,pts):bp.co=p;bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);c.materials.append(m);parts.append(o);return o

ell('Tailored torso',(0,0,1.12),(.255,.155,.37),suit)
ell('Hips',(0,0,.88),(.23,.145,.16),suit)
link('Neck',(0,0,1.39),(0,0,1.64),.082,.075,skin)
link('Ivory standing collar',(0,0,1.41),(0,0,1.53),.135,.125,ivory)
head=ell('Pear shaped Gray head',(0,0,1.84),(.285,.23,.35),skin,48,32)
for v in head.data.vertices:
    if v.co.z<0:v.co.x*=1+.48*v.co.z/.35
for sign in [-1,1]:
    eye=ell(('Left' if sign<0 else 'Right')+' almond eye',(sign*.128,-.194,1.85),(.112,.042,.075),ink)
    eye.rotation_euler.y=sign*-.32
    ell('Eye highlight '+str(sign),(sign*.132-.021,-.231,1.875),(.016,.006,.01),ivory,16,8)
    ell('Nostril '+str(sign),(sign*.021,-.201,1.733),(.009,.006,.012),ink,12,8)
line('Small closed mouth',[(-.04,-.197,1.688),(0,-.205,1.683),(.04,-.197,1.688)],.004)
for sign in [-1,1]:
    shoulder=(sign*.225,0,1.35);elbow=(sign*.34,-.005,1.13);wrist=(sign*.435,-.018,.91)
    ell('Shoulder joint '+str(sign),shoulder,(.092,.105,.13),suit)
    link('Upper sleeve '+str(sign),elbow,shoulder,.073,.10,suit)
    link('Lower sleeve '+str(sign),wrist,elbow,.052,.075,suit)
    link('Ceramic cuff '+str(sign),(sign*.40,-.012,1.0),(sign*.46,-.02,.875),.074,.069,ivory)
    ell('Palm '+str(sign),(sign*.475,-.025,.825),(.055,.032,.073),skin)
    for i in range(3):
        xx=sign*(.445+i*.029)
        line('Long finger '+str(sign)+' '+str(i),[(xx,-.022,.806),(xx+sign*.012,-.032,.744),(xx+sign*.005,-.055,.71+(i%2)*.009)],.013,skin)
    line('Thumb '+str(sign),[(sign*.437,-.018,.842),(sign*.408,-.05,.80),(sign*.415,-.062,.772)],.015,skin)
    hip=(sign*.12,0,.91);knee=(sign*.135,-.007,.55);ankle=(sign*.15,0,.19)
    link('Thigh '+str(sign),knee,hip,.09,.11,suit)
    ell('Knee '+str(sign),knee,(.09,.085,.11),suit)
    link('Shin '+str(sign),ankle,knee,.071,.09,suit)
    link('Ankle cuff '+str(sign),(sign*.15,0,.22),(sign*.15,0,.30),.084,.09,ivory)
    ell('Boot '+str(sign),(sign*.15,-.065,.105),(.108,.185,.105),boots)
    line('Boot welt '+str(sign),[(sign*.15-.09,-.07,.04),(sign*.15-.06,-.21,.045),(sign*.15+.06,-.21,.045),(sign*.15+.09,-.07,.04)],.008)
    line('Trouser seam '+str(sign),[(sign*.16,-.132,.88),(sign*.17,-.09,.59),(sign*.18,-.08,.32)],.006)
    # Mantle panels are broad cut cloth shapes rather than armored spikes.
    verts=[(sign*.07,-.135,1.49),(sign*.24,-.145,1.43),(sign*.34,-.095,1.31),(sign*.09,-.175,1.35),(sign*.08,.14,1.48),(sign*.26,.14,1.42),(sign*.34,.10,1.31),(sign*.09,.17,1.34)]
    mesh=bpy.data.meshes.new('Mantle panel');mesh.from_pydata(verts,[],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(1,5,6,2),(0,3,7,4)]);mesh.update()
    o=bpy.data.objects.new('Slate mantle '+str(sign),mesh);scene.collection.objects.link(o);mesh.materials.append(mantle);parts.append(o)
    bevel=o.modifiers.new('Hem softness','BEVEL');bevel.width=.008;bevel.segments=2
    line('Mantle ink hem '+str(sign),[verts[0],verts[3],verts[2],verts[1]],.008)
link('Belt',(0,0,.98),(0,0,1.035),.242,.242,boots).scale.y=.69
ell('Belt bezel',(0,-.173,1.007),(.070,.025,.070),ivory)
ell('Violet belt lens',(0,-.196,1.007),(.048,.018,.049),violet)
ell('Mantle clasp',(.085,-.155,1.46),(.026,.014,.031),ivory,16,12)
mesh=bpy.data.meshes.new('Instrument triangle');mesh.from_pydata([(.12,-.163,1.29),(.19,-.163,1.29),(.155,-.171,1.235)],[],[(0,2,1)]);mesh.update();o=bpy.data.objects.new('Mint chest instrument',mesh);scene.collection.objects.link(o);mesh.materials.append(mint);parts.append(o)
line('Suit front seam',[(-.055,-.15,1.36),(-.04,-.16,1.17),(-.02,-.153,1.055)],.006)

for o in list(parts):
    if o.type=='MESH' and not o.data.uv_layers:
        bpy.context.view_layer.objects.active=o;o.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project();bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
root=bpy.data.objects.new('VEY editable character',None);scene.collection.objects.link(root)
for o in parts:o.parent=root
root['design']='Vey / Gray commander / hand-authored Blender comparison'
root['limitations']='Editable mesh, unrigged; paint is procedural UV variation rather than generated concept fidelity.'
def point(name,pos,power,color):
    d=bpy.data.lights.new(name,'POINT');d.energy=power;d.color=color;d.shadow_soft_size=2
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=pos
point('Warm key',(-3,-4,5),750,(1,.87,.72));point('Cool fill',(3,-2,3),400,(.64,.77,1));point('Soft rim',(0,3,4),800,(.8,.85,1))
cam=bpy.data.cameras.new('Delivery camera');o=bpy.data.objects.new('Delivery camera',cam);scene.collection.objects.link(o);o.location=(3,-6,2.8);o.rotation_euler=(Vector((0,0,1.1))-o.location).to_track_quat('-Z','Y').to_euler();cam.type='ORTHO';cam.ortho_scale=2.65;scene.camera=o
scene.render.film_transparent=True
target=artifacts.file(name='vey-blender-front.png',media_type='image/png')
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(target.path)
bpy.ops.render.render(write_still=True);target.publish()
result={'parts':len(parts),'heightMeters':2.19,'texture':1024,'rigged':False,'camera':o.name}
