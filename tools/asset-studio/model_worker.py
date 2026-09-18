"""Local mesh finishing. Animation requires an existing rig or an explicit anatomical fit."""
import bpy,json,math,sys,time,shutil,hashlib
from pathlib import Path
from mathutils import Vector
import numpy as np
from PIL import Image
task=json.loads(Path(sys.argv[-1]).read_text('utf-8'));start=time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
blend_source=Path(task['input']).with_suffix('.blend')
if task['stage']=='polish' and blend_source.is_file():bpy.ops.wm.open_mainfile(filepath=str(blend_source))
else:bpy.ops.import_scene.gltf(filepath=task['input'])
scene=bpy.context.scene;meshes=[o for o in scene.objects if o.type=='MESH'];rigs=[o for o in scene.objects if o.type=='ARMATURE']
report={'stage':task['stage'],'method':'local Blender finishing of supplied or image-generated geometry','input':Path(task['input']).name,'rigPreserved':bool(rigs),'ownerApproval':False}

def painted_materials():
    size=task['textureSize'];rng=np.random.default_rng(task['seed']);y,x=np.mgrid[0:size,0:size]/size
    broad=np.zeros((size,size));fine=np.zeros((size,size))
    for i in range(22):
        angle=rng.uniform(0,6.283);f=rng.uniform(12,75);phase=rng.uniform(0,6.283)
        broad+=np.sin((x*np.cos(angle)+y*np.sin(angle))*f+phase)/22
    for i in range(8):fine+=np.sin(x*rng.uniform(200,650)+y*rng.uniform(40,180)+rng.uniform(0,6.28))/8
    pigment=np.clip(.96+broad*.22+fine*.025,.79,1.09)
    for m in bpy.data.materials:
        m.use_nodes=True;nt=m.node_tree;bs=next((n for n in nt.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if not bs:continue
        # Existing image maps are retained at source resolution.
        if any(n.type=='TEX_IMAGE' and n.image for n in nt.nodes):continue
        base=np.array(bs.inputs['Base Color'].default_value[:3])
        if 'eye' in m.name.lower() or 'obsidian' in m.name.lower() or base.max()<.005:continue
        base=np.where(base<=.0031308,base*12.92,1.055*np.power(base,1/2.4)-.055)
        pix=np.ones((size,size,4),dtype=np.float32);pix[:,:,:3]=np.clip(pigment[:,:,None]*base[None,None,:],0,1)
        image=bpy.data.images.new(m.name+' painted surface',width=size,height=size);image.pixels.foreach_set(pix.ravel());image.pack()
        tex=nt.nodes.new('ShaderNodeTexImage');tex.image=image;nt.links.new(tex.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Roughness'].default_value=.88
    for obj in meshes:
        if not obj.data.uv_layers:
            bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')
    report['paintMethod']='UV-attached, baked brush variation preserves original material palette. Existing image maps remain untouched.'

def project_reference():
    # A portable UV texture made from the approved front reference. Back uses the
    # source palette instead of mirroring eyes onto unseen surfaces.
    source=Image.open(task['reference']).convert('RGBA');arr=np.asarray(source);mask=arr[:,:,3]>128
    if arr[:,:,3].min()==255:
        corners=np.median(np.concatenate([arr[:10,:10,:3].reshape(-1,3),arr[-10:,-10:,:3].reshape(-1,3)]),axis=0)
        mask=np.linalg.norm(arr[:,:,:3].astype(float)-corners,axis=2)>35
    ys,xs=np.nonzero(mask)
    if len(xs):source=source.crop((max(0,xs.min()-8),max(0,ys.min()-8),min(source.width,xs.max()+9),min(source.height,ys.max()+9)))
    atlas_path=Path(task['output']).with_suffix('.reference.png');source.save(atlas_path)
    image=bpy.data.images.load(str(atlas_path));image.pack()
    palette=np.asarray(source)[:,:,:3].reshape(-1,3).mean(axis=0)/255
    points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices];mn=Vector(tuple(min(v[i] for v in points) for i in range(3)));mx=Vector(tuple(max(v[i] for v in points) for i in range(3)))
    size=task['textureSize'];count=0
    for obj in meshes:
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
        if not obj.data.uv_layers:
            bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
        # Assign each UV triangle from the reference projection. UV texture is
        # rasterized from actual per-loop world positions, so it follows the mesh.
        uv=obj.data.uv_layers.active.data;tex=np.zeros((size,size,4),dtype=np.uint8);tex[:,:,:3]=(palette*255).astype(np.uint8);tex[:,:,3]=255
        src=np.asarray(source);obj.data.calc_loop_triangles()
        for tri in obj.data.loop_triangles:
            ids=list(tri.loops);pts=np.array([(uv[k].uv.x*(size-1),(1-uv[k].uv.y)*(size-1)) for k in ids]);world=np.array([tuple(obj.matrix_world@obj.data.vertices[obj.data.loops[k].vertex_index].co) for k in ids])
            lo=np.maximum(np.floor(pts.min(axis=0)).astype(int),0);hi=np.minimum(np.ceil(pts.max(axis=0)).astype(int),size-1)
            if (hi<lo).any():continue
            yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];v0,v1=pts[1]-pts[0],pts[2]-pts[0];den=v0[0]*v1[1]-v1[0]*v0[1]
            if abs(den)<1e-8:continue
            dx,dy=xx-pts[0,0],yy-pts[0,1];b=(dx*v1[1]-v1[0]*dy)/den;c=(v0[0]*dy-dx*v0[1])/den;a=1-b-c;inside=(a>=-.01)&(b>=-.01)&(c>=-.01)
            xyz=a[:,:,None]*world[0]+b[:,:,None]*world[1]+c[:,:,None]*world[2]
            u=np.clip((xyz[:,:,0]-mn.x)/max(.001,mx.x-mn.x),0,1);v=np.clip(1-(xyz[:,:,2]-mn.z)/max(.001,mx.z-mn.z),0,1)
            samples=src[(v*(src.shape[0]-1)).astype(int),(u*(src.shape[1]-1)).astype(int),:3]
            normal=(obj.matrix_world.to_3x3()@tri.normal).normalized();front=max(0,min(1,(-normal.y+.1)/.7));color=(samples*front+palette*255*(1-front)).astype(np.uint8)
            patch=tex[lo[1]:hi[1]+1,lo[0]:hi[0]+1,:3];patch[inside]=color[inside]
        path=Path(task['output']).with_name('paint-'+str(count)+'.png');Image.fromarray(tex).save(path);count+=1
        im=bpy.data.images.load(str(path));im.pack();mat=bpy.data.materials.new(obj.name+' reference paint');mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');t=mat.node_tree.nodes.new('ShaderNodeTexImage');t.image=im;mat.node_tree.links.new(t.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Roughness'].default_value=.9;obj.data.materials.clear();obj.data.materials.append(mat)
    report['paintMethod']='Approved front-image projection baked into UV textures; unseen back uses palette fill. Inspect seams and rear detail before accepting. Not a generative multiview repaint.'

def draft_rig():
    pts=[o.matrix_world@v.co for o in meshes for v in o.data.vertices];mn=Vector(tuple(min(v[i] for v in pts) for i in range(3)));mx=Vector(tuple(max(v[i] for v in pts) for i in range(3)));h=mx.z-mn.z;cx=(mx.x+mn.x)/2;cy=(mx.y+mn.y)/2;w=(mx.x-mn.x)/2
    def point(x,z):return (cx+x*w,cy,mn.z+z*h)
    defs=[('root',point(0,.04),point(0,.44),None),('hips',point(0,.44),point(0,.53),'root'),('spine',point(0,.53),point(0,.72),'hips'),('neck',point(0,.72),point(0,.8),'spine'),('head',point(0,.8),point(0,.98),'neck')]
    for side,sign in [('L',1),('R',-1)]:
        defs.extend([(f'upper_arm.{side}',point(sign*.3,.7),point(sign*.64,.56),'spine'),(f'forearm.{side}',point(sign*.64,.56),point(sign*.85,.43),f'upper_arm.{side}'),(f'hand.{side}',point(sign*.85,.43),point(sign,.38),f'forearm.{side}'),(f'thigh.{side}',point(sign*.2,.46),point(sign*.22,.25),'hips'),(f'shin.{side}',point(sign*.22,.25),point(sign*.24,.06),f'thigh.{side}'),(f'foot.{side}',point(sign*.24,.06),(cx+sign*.24*w,cy-h*.08,mn.z+.03*h),f'shin.{side}')])
    arm=bpy.data.armatures.new('Review biped');rig=bpy.data.objects.new('Review biped',arm);scene.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    for name,head,tail,parent in defs:
        b=arm.edit_bones.new(name);b.head=head;b.tail=tail
        if parent:b.parent=arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    deform=defs[1:];heads=np.array([x[1] for x in deform]);tails=np.array([x[2] for x in deform]);vec=tails-heads;length=(vec*vec).sum(axis=1)
    for obj in meshes:
        obj.vertex_groups.clear();groups=[obj.vertex_groups.new(name=d[0]) for d in deform]
        verts=np.array([tuple(obj.matrix_world@v.co) for v in obj.data.vertices]);delta=verts[:,None,:]-heads;param=np.clip((delta*vec).sum(axis=2)/length,0,1);dist=np.linalg.norm(delta-param[:,:,None]*vec,axis=2);near=np.argsort(dist,axis=1)[:,:4];weights=np.exp(-np.take_along_axis(dist,near,axis=1)/max(h*.035,.001));weights/=weights.sum(axis=1,keepdims=True)
        for i in range(len(verts)):
            for bone,weight in zip(near[i],weights[i]):groups[int(bone)].add([i],float(weight),'REPLACE')
        mod=obj.modifiers.new('Review skin','ARMATURE');mod.object=rig;obj.parent=rig
    rig.animation_data_create();scene.render.fps=30
    for title,duration in [('Idle',2.4),('Walk',1.2),('Run',.8),('Attack',1.1)]:
        action=bpy.data.actions.new(title);rig.animation_data.action=action;frames=round(duration*30)
        for frame in range(frames+1):
            phase=frame/frames;angle=math.sin(phase*math.tau)
            for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0)
            rig.pose.bones['spine'].rotation_euler.x=.025*angle
            if title in ['Walk','Run']:
                amp=.37 if title=='Walk' else .6
                for side,sign in [('L',1),('R',-1)]:
                    rig.pose.bones['thigh.'+side].rotation_euler.x=amp*angle*sign;rig.pose.bones['shin.'+side].rotation_euler.x=max(0,-angle*sign)*amp*.85;rig.pose.bones['upper_arm.'+side].rotation_euler.x=-amp*angle*sign*.65
            if title=='Attack':
                strike=math.sin(math.pi*phase)**2;rig.pose.bones['upper_arm.R'].rotation_euler.x=-1.25*strike;rig.pose.bones['forearm.R'].rotation_euler.x=-.55*strike;rig.pose.bones['spine'].rotation_euler.z=.2*math.sin(math.tau*phase)
            for b in rig.pose.bones:b.keyframe_insert('rotation_euler',frame=frame+1,group=b.name)
        track=rig.animation_data.nla_tracks.new();track.name=title;track.strips.new(title,1,action);track.mute=True
    rig.animation_data.action=None;rigs.append(rig);report['rigMethod']='17-bone geometry-proportioned biped with proximity skin weights. Draft only; unusual anatomy and feet require review.'

if task['stage']=='paint':
    if task.get('reference') and not task.get('preserveRig'):project_reference()
    else:painted_materials()
elif task['stage']=='animation':
    profile=Path(task['input']).parent/'rig-profile.json'
    if not rigs and profile.exists():
        from fitted_motion import build
        rigs.append(build(task,meshes,scene,report,profile))
    elif not rigs:
        raise ValueError('Rigging is required before animation. Use Fit joints visually and save this model\'s anatomical profile, or prepare a MIA rig in Motion library. The generic proximity rig and sine-wave clips are no longer generated as production motion.')
    else:report['rigMethod']='Existing skeleton, skin weights and authored clips preserved. No replacement motion generated.'
elif task['stage']=='polish':
    # Keep silhouette, topology and approved motion intact. Polish validates and
    # packages rather than quietly decimating or changing an approved animation.
    for mesh in meshes:
        if any(not math.isfinite(c) for v in mesh.data.vertices for c in v.co):raise ValueError('Non-finite mesh vertex')
    for image in bpy.data.images:
        if image.type=='IMAGE':
            if min(image.size)<1:raise ValueError('Source image has no decoded pixels. Export the retained Blender source instead of a broken GLB round-trip.')
            folder=Path(task['output']).with_suffix('');folder.mkdir(exist_ok=True)
            image.filepath_raw=str(folder/(image.name.replace('/','_')+'.png'));image.file_format='PNG';image.save();image.pack()
    report['polishMethod']='Finite-geometry check, packed texture delivery, retained topology and approved animation. No destructive decimation.'
for rig in rigs:
    if rig.animation_data:
        rig.animation_data.action=None
        for track in rig.animation_data.nla_tracks:track.mute=True
report.update(meshes=len(meshes),bones=sum(len(o.data.bones) for o in rigs),animations=[a.name for a in bpy.data.actions],images=[{'name':i.name,'width':i.size[0],'height':i.size[1]} for i in bpy.data.images if i.type=='IMAGE'],seconds=time.time()-start)
scene.frame_set(1);dest=Path(task['output']);bpy.ops.wm.save_as_mainfile(filepath=str(dest.with_suffix('.blend')))
if task['stage']=='polish':
    shutil.copy2(task['input'],dest);report['portableGLB']='Approved source retained byte-for-byte';report['sourceSha256']=hashlib.sha256(Path(task['input']).read_bytes()).hexdigest()
else:bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_yup=True,export_apply=False)
if task['stage']=='polish':
    bpy.ops.export_scene.fbx(filepath=str(dest.with_suffix('.fbx')),use_selection=False,object_types={'ARMATURE','MESH'},add_leaf_bones=False,bake_anim=True,bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,path_mode='COPY',embed_textures=True)
    report['exports']=['glb','blend','fbx']
dest.with_suffix('.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report),flush=True)
