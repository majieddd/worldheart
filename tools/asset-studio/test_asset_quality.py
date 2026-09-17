"""Known bad artifacts must be rejected; a valid artifact still needs visual review."""
import io, json, struct, tempfile, unittest
from pathlib import Path
import numpy as np
from PIL import Image
from asset_quality import inspect_asset
from motion_metrics import stance_metrics

def fixture(size=1024, binding=True, motion=True, moving=True, weights=1.0):
    binary=bytearray();views=[];accessors=[]
    def add(data):
        start=len(binary);binary.extend(data);length=len(data)
        binary.extend(b'\0'*((-len(binary))%4));views.append({'buffer':0,'byteOffset':start,'byteLength':length});return len(views)-1
    def array(values,kind):
        a=np.asarray(values,dtype='<f4');v=add(a.tobytes());accessors.append({'bufferView':v,'componentType':5126,'count':len(a),'type':kind});return len(accessors)-1
    pos=array([[0,0,0],[1,0,0],[0,1,0]],'VEC3');uv=array([[0,0],[1,0],[0,1]],'VEC2')
    attrs={'POSITION':pos,'TEXCOORD_0':uv}
    image=io.BytesIO();Image.new('RGB',(size,size),'purple').save(image,format='PNG');im=add(image.getvalue())
    mat={'pbrMetallicRoughness':{'baseColorTexture':{'index':0 if binding else 99}}}
    doc={'asset':{'version':'2.0'},'bufferViews':views,'accessors':accessors,'meshes':[{'primitives':[{'attributes':attrs,'material':0}]}],
         'nodes':[{'name':'hips','mesh':0}],'scenes':[{'nodes':[0]}],'scene':0,'materials':[mat],'images':[{'bufferView':im,'mimeType':'image/png'}],'textures':[{'source':0}]}
    if motion:
        attrs['WEIGHTS_0']=array([[weights,0,0,0]]*3,'VEC4');doc['skins']=[{'joints':[0]}]
        times=array([[0],[1]],'SCALAR');values=array([[0,0,0],[0,.04 if moving else 0,0]],'VEC3')
        doc['animations']=[{'name':'Walk','samplers':[{'input':times,'output':values}],'channels':[{'sampler':0,'target':{'node':0,'path':'translation'}}]}]
    doc['buffers']=[{'byteLength':len(binary)}];text=json.dumps(doc).encode();text+=b' '*((-len(text))%4)
    return struct.pack('<4sII',b'glTF',2,28+len(text)+len(binary))+struct.pack('<I4s',len(text),b'JSON')+text+struct.pack('<I4s',len(binary),b'BIN\0')+binary

class QualityTests(unittest.TestCase):
    def report(self,data,stage='animation'):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'asset.glb';p.write_bytes(data);return inspect_asset(p,stage)
    def test_good_is_review_required_never_approved(self):
        r=self.report(fixture());self.assertEqual(r['status'],'review_required');self.assertFalse(r['promotionAllowed'])
    def test_actual_bytes_bind_the_receipt(self):
        self.assertNotEqual(self.report(fixture())['sha256'],self.report(fixture(size=2048))['sha256'])
    def test_truncated_container(self):self.assertEqual(self.report(fixture()[:-20])['status'],'fail')
    def test_unbound_texture(self):self.assertEqual(self.report(fixture(binding=False))['status'],'fail')
    def test_small_texture(self):self.assertEqual(self.report(fixture(size=64))['status'],'fail')
    def test_frozen_pelvis(self):self.assertEqual(self.report(fixture(moving=False))['status'],'fail')
    def test_bad_skin_weights(self):self.assertEqual(self.report(fixture(weights=.2))['status'],'fail')
    def test_missing_motion(self):self.assertEqual(self.report(fixture(motion=False))['status'],'fail')
    def test_static_is_allowed_only_before_motion_stage(self):self.assertEqual(self.report(fixture(motion=False),'paint')['status'],'review_required')
    def test_stance_residual_minimizes_at_correct_speed(self):
        v=np.array([[1.2,-3.6]]*60+[[-3.6,1.2]]*60)
        correct=stance_metrics(v,ground_speed=1.2)['medianResidualRatio']
        self.assertLess(correct,.01)
        self.assertGreater(stance_metrics(v,ground_speed=.6)['medianResidualRatio'],correct)
        self.assertGreater(stance_metrics(v,ground_speed=2.4)['medianResidualRatio'],correct)
    def test_still_motion_cannot_pass_stance(self):self.assertIsNone(stance_metrics(np.zeros((120,2))))
    def test_both_feet_share_one_stance_direction(self):
        v=np.array([[1.,-1.3],[1.,2.],[1.,2.],[-3.,2.]])
        r=stance_metrics(v);self.assertGreater(r['measuredGroundSpeed'],.9)

if __name__=='__main__':unittest.main()
