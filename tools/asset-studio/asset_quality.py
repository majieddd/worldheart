"""Artifact-bound checks. Technical validity never grants visual acceptance."""
import argparse, hashlib, io, json, struct
from pathlib import Path
import numpy as np
from PIL import Image

VERSION = '1.0.0'
COMPONENTS = {5120: 'i1', 5121: 'u1', 5122: '<i2', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
WIDTHS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def inspect_asset(path, stage='paint'):
    path = Path(path)
    data = path.read_bytes()
    report = {'version': VERSION, 'file': path.name,
              'sha256': hashlib.sha256(data).hexdigest(), 'stage': stage,
              'checks': [], 'metrics': {}, 'visualAcceptance': 'pending',
              'promotionAllowed': False}
    def check(name, ok, detail):
        report['checks'].append({'name': name, 'status': 'pass' if ok else 'fail', 'detail': detail})
    try:
        magic, version, length = struct.unpack_from('<4sII', data)
        if (magic, version, length) != (b'glTF', 2, len(data)):
            raise ValueError('Invalid GLB header or declared byte length')
        chunks = {}; offset = 12
        while offset < len(data):
            size, kind = struct.unpack_from('<I4s', data, offset); offset += 8
            if size % 4 or offset + size > len(data): raise ValueError('Invalid chunk bounds')
            chunks[kind] = data[offset:offset+size]; offset += size
        doc = json.loads(chunks[b'JSON']); binary = chunks.get(b'BIN\0', b'')
        if doc.get('buffers', [{}])[0].get('byteLength', 0) > len(binary):
            raise ValueError('Missing embedded buffer bytes')
        def view(index):
            v = doc['bufferViews'][index]; start = v.get('byteOffset', 0); end = start+v['byteLength']
            if v.get('buffer', 0) != 0 or start < 0 or end > len(binary): raise ValueError('Buffer view outside embedded data')
            return v, binary[start:end]
        def accessor(index):
            a = doc['accessors'][index]
            if 'sparse' in a: raise ValueError('Sparse accessors require a separate decoder; check unavailable')
            v, raw = view(a['bufferView']); dtype = np.dtype(COMPONENTS[a['componentType']]); width = WIDTHS[a['type']]
            stride = v.get('byteStride', dtype.itemsize*width); start = a.get('byteOffset', 0)
            end = start+(a['count']-1)*stride+dtype.itemsize*width if a['count'] else start
            if start < 0 or end > len(raw): raise ValueError('Accessor outside its buffer view')
            arr = np.ndarray((a['count'], width), dtype=dtype, buffer=raw, offset=start, strides=(stride,dtype.itemsize)).copy()
            if a.get('normalized') and a['componentType'] in (5121,5123): arr = arr.astype(float)/np.iinfo(dtype).max
            return arr
        for i in range(len(doc.get('bufferViews', []))): view(i)
        check('container', True, 'Embedded buffers and chunk bounds are valid')
        triangles = vertices = degenerates = 0; uv_ok = mapped = finite = weights_ok = True
        for mesh in doc.get('meshes', []):
            for primitive in mesh['primitives']:
                if primitive.get('mode', 4) != 4: raise ValueError('Non-triangle primitive requires its own quality profile')
                a = primitive['attributes']; pos = accessor(a['POSITION']); vertices += len(pos)
                finite &= bool(np.isfinite(pos).all())
                indices = accessor(primitive['indices']).reshape(-1) if 'indices' in primitive else np.arange(len(pos))
                if len(indices)%3 or not len(indices) or indices.max() >= len(pos): raise ValueError('Invalid triangle indices')
                tris = pos[indices.reshape(-1,3)]; triangles += len(tris)
                area = np.linalg.norm(np.cross(tris[:,1]-tris[:,0], tris[:,2]-tris[:,0]),axis=1)
                scale = max(float(np.ptp(pos,axis=0).max()),1e-9)
                degenerates += int((area < scale*scale*1e-12).sum())
                uv_ok &= 'TEXCOORD_0' in a and bool(np.isfinite(accessor(a['TEXCOORD_0'])).all())
                material = doc.get('materials', [])[primitive['material']] if 'material' in primitive else {}
                binding = material.get('pbrMetallicRoughness', {}).get('baseColorTexture', {})
                texture_index = binding.get('index', -1)
                textures = doc.get('textures', [])
                mapped &= 0 <= texture_index < len(textures)
                if 0 <= texture_index < len(textures):
                    mapped &= 0 <= textures[texture_index].get('source', -1) < len(doc.get('images', []))
                if 'WEIGHTS_0' in a:
                    weights = accessor(a['WEIGHTS_0']).astype(float)
                    sums = weights.sum(axis=1)
                    if 'WEIGHTS_1' in a: sums += accessor(a['WEIGHTS_1']).sum(axis=1)
                    weights_ok &= bool(np.isfinite(weights).all() and (weights>=0).all() and np.max(abs(sums-1)) < .03)
        report['metrics'].update(vertices=vertices, triangles=triangles, degenerateTriangles=degenerates)
        check('finite_geometry', finite and triangles>0, {'vertices':vertices, 'triangles':triangles})
        check('degenerate_faces', degenerates/max(triangles,1)<.001, {'count':degenerates,'maximumRatio':.001})
        if stage != 'mesh':
            check('uv_coordinates', uv_ok, 'Every mesh primitive needs finite UV coordinates')
            check('bound_color_textures', mapped, 'Every mesh primitive must bind its painted base-color texture')
            texture_sizes=[]
            for image in doc.get('images', []):
                if 'bufferView' not in image: raise ValueError('External texture is not portable; embed it before review')
                _, raw = view(image['bufferView']); im = Image.open(io.BytesIO(raw)); im.load(); texture_sizes.append(list(im.size))
            report['metrics']['textureSizes']=texture_sizes
            check('embedded_texture_resolution', bool(texture_sizes) and all(min(s)>=1024 for s in texture_sizes), {'sizes':texture_sizes,'minimum':1024,'note':'Resolution alone does not prove crisp reference detail'})
        clips=doc.get('animations', []); report['metrics']['clips']=[c.get('name','unnamed') for c in clips]
        if stage in ('animation','polish'):
            check('animation_present', bool(clips) and bool(doc.get('skins')), 'Skinned animated output is required')
            check('normalized_skin_weights', weights_ok, 'Finite nonnegative weights must sum to one')
            for clip in clips:
                if any(word in clip.get('name','').lower() for word in ('walk','run')):
                    translations=[]
                    for channel in clip.get('channels', []):
                        target=channel['target']; node=doc['nodes'][target['node']]
                        if target['path']=='translation' and any(word in node.get('name','').lower() for word in ('hip','pelvis')):
                            values=accessor(clip['samplers'][channel['sampler']]['output'])
                            translations.append(float(np.ptp(values,axis=0).max()))
                    check('pelvis_translation:'+clip.get('name','clip'), bool(translations) and max(translations)>.005, {'translationRange':translations,'note':'Biped profile; foot contact and seam need sampled motion review'})
        report['reviewRequired']=['Compare silhouette, face and material boundaries against the approved reference',
            'Inspect six rendered views, rear details, seams and hands',
            'Watch full walk/run cycles and transitions; measure planted-foot drift against the intended ground speed',
            'Confirm target platform triangle/texture budget and import']
    except Exception as exc:
        check('readable_asset', False, str(exc))
    report['status'] = 'fail' if any(c['status']=='fail' for c in report['checks']) else 'review_required'
    return report

if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('input');p.add_argument('--stage',default='paint',choices=['mesh','paint','animation','polish']);p.add_argument('--output',required=True);a=p.parse_args()
    result=inspect_asset(a.input,a.stage);Path(a.output).write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({'status':result['status'],'checks':len(result['checks']),'failed':[c['name'] for c in result['checks'] if c['status']=='fail'],'report':a.output}))
    raise SystemExit(1 if result['status']=='fail' else 0)
