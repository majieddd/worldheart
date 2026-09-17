"""Approval and local-boundary checks; no model inference or approval of real assets."""
import io,json,os,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
_tmp=tempfile.TemporaryDirectory();os.environ['WH_STUDIO_RUNTIME']=_tmp.name
import server
from fastapi.testclient import TestClient

class StudioTests(unittest.TestCase):
    def setUp(self):
        self.client=TestClient(server.app);self.p=self.client.post('/api/projects',json={'name':'Test fixture'}).json();self.base='/api/projects/'+self.p['id']
    def image(self):
        b=io.BytesIO();Image.new('RGB',(8,8),'green').save(b,format='PNG');return b.getvalue()
    def concept(self):
        self.client.put(self.base,json={'description':'A gray alien commander'})
        self.client.post(self.base+'/upload',files={'file':('reference.png',self.image(),'image/png')})
        return self.client.post(self.base+'/use-reference/0').json()
    def test_reconstruction_requires_current_owner_approval(self):
        self.concept();self.assertEqual(self.client.post(self.base+'/run/mesh').status_code,409)
        self.assertEqual(self.client.post(self.base+'/approve/art').status_code,200)
        with patch.object(server.POOL,'submit') as submit:
            self.assertEqual(self.client.post(self.base+'/run/mesh').status_code,200);self.assertTrue(submit.called)
        p=server.project(self.p['id']);p['status']='review';server.save(p)
        self.client.put(self.base,json={'description':'Different anatomy, an antlered gray alien'})
        self.assertEqual(self.client.post(self.base+'/approve/art').status_code,409)
        self.assertEqual(self.client.post(self.base+'/run/mesh').status_code,409)
    def test_changed_file_cannot_reuse_approval(self):
        p=self.concept();self.client.post(self.base+'/approve/art');server.output(p,p['art']).write_bytes(self.image()+b'changed')
        self.assertEqual(self.client.post(self.base+'/run/mesh').status_code,409)
    def test_added_reference_invalidates_approval(self):
        self.concept();self.client.post(self.base+'/approve/art')
        self.client.post(self.base+'/upload',files={'file':('second.png',self.image(),'image/png')})
        self.assertEqual(self.client.post(self.base+'/approve/art').status_code,409)
    def test_animation_requires_review_and_same_model(self):
        p=server.project(self.p['id']);server.output(p,'mesh.glb').write_bytes(b'fixture');server.output(p,'motion.glb').write_bytes(b'motion');p.update(mesh='mesh.glb',animation='motion.glb',motionInput=server.digest(server.output(p,'mesh.glb')));server.save(p)
        self.assertEqual(self.client.post(self.base+'/run/polish').status_code,409)
        self.assertEqual(self.client.post(self.base+'/approve/animation').status_code,200)
        with patch.object(server.POOL,'submit'):self.assertEqual(self.client.post(self.base+'/run/polish').status_code,200)
        p=server.project(self.p['id']);p['status']='review';server.save(p);server.output(p,'mesh.glb').write_bytes(b'newshape')
        self.assertEqual(self.client.post(self.base+'/approve/animation').status_code,409)
    def test_no_production_export_before_approval(self):
        self.assertEqual(self.client.get(self.base+'/export').status_code,409)
    def test_local_origin_and_path_boundaries(self):
        self.assertEqual(self.client.post('/api/projects',json={},headers={'Origin':'https://example.com'}).status_code,403)
        self.assertEqual(self.client.get('/api/config',headers={'Host':'attacker.example'}).status_code,403)
        self.assertEqual(self.client.get('/files/%2e%2e%2fsettings.json').status_code,404)
    def test_reference_validation(self):
        self.assertEqual(self.client.post(self.base+'/upload',files={'file':('bad.png',b'bad','image/png')}).status_code,400)
        for i in range(3):self.assertEqual(self.client.post(self.base+'/upload',files={'file':('r.png',self.image(),'image/png')}).status_code,200)
        self.assertEqual(self.client.post(self.base+'/upload',files={'file':('r.png',self.image(),'image/png')}).status_code,400)
    def test_settings_reject_noninstalled_model(self):
        self.assertEqual(self.client.put('/api/config',json={'model':'../../elsewhere.safetensors','family':'krea'}).status_code,400)
    def tearDown(self):
        p=server.project(self.p['id']);p['status']='review';server.save(p)

if __name__=='__main__':unittest.main()
