"""Approval and local-boundary checks; no model inference or approval of real assets."""
import io,json,os,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from test_asset_quality import fixture
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
        p=server.project(self.p['id']);server.output(p,'mesh.glb').write_bytes(fixture(motion=False));server.output(p,'motion.glb').write_bytes(fixture());p.update(mesh='mesh.glb',animation='motion.glb',motionInput=server.digest(server.output(p,'mesh.glb')));server.save(p)
        self.assertEqual(self.client.post(self.base+'/run/polish').status_code,409)
        self.assertEqual(self.client.post(self.base+'/approve/animation').status_code,200)
        with patch.object(server.POOL,'submit'):self.assertEqual(self.client.post(self.base+'/run/polish').status_code,200)
        p=server.project(self.p['id']);p['status']='review';server.save(p);server.output(p,'mesh.glb').write_bytes(b'newshape')
        self.assertEqual(self.client.post(self.base+'/approve/animation').status_code,409)
    def test_quality_blocks_bad_motion_and_rechecks_changed_bytes(self):
        p=server.project(self.p['id']);server.output(p,'mesh.glb').write_bytes(fixture(motion=False));server.output(p,'motion.glb').write_bytes(fixture(moving=False));p.update(mesh='mesh.glb',animation='motion.glb',motionInput=server.digest(server.output(p,'mesh.glb')));server.save(p)
        self.assertEqual(self.client.post(self.base+'/approve/animation').status_code,409)
        bad=self.client.post(self.base+'/validate/animation').json()['quality']['animation'];self.assertEqual(bad['status'],'fail')
        server.output(p,'motion.glb').write_bytes(fixture(moving=True))
        self.assertEqual(self.client.post(self.base+'/approve/animation').status_code,200)
        fresh=server.project(p['id'])['quality']['animation'];self.assertNotEqual(bad['sha256'],fresh['sha256']);self.assertEqual(fresh['status'],'review_required')
    def test_quality_receipt_invalidates_when_reference_changes(self):
        p=self.concept();server.output(p,'mesh.glb').write_bytes(fixture(motion=False));p.update(mesh='mesh.glb');server.save(p)
        before=self.client.post(self.base+'/validate/mesh').json()['quality']['mesh']
        server.output(p,p['art']).write_bytes(self.image()+b'changed')
        after=self.client.post(self.base+'/validate/mesh').json()['quality']['mesh']
        self.assertNotEqual(before['referenceSha256'],after['referenceSha256'])
    def test_failed_stage_keeps_timing_receipt(self):
        p=server.project(self.p['id'])
        with self.assertRaisesRegex(RuntimeError,'deliberate failure'):
            with server.timed_stage(p,'mesh'):
                raise RuntimeError('deliberate failure')
        entry=server.project(p['id'])['timings'][0]
        self.assertEqual(entry['status'],'failed');self.assertGreaterEqual(entry['seconds'],0)
        self.assertIn('endedAt',entry);self.assertTrue(server.output(p,'timings.json').exists())
    def test_no_production_export_before_approval(self):
        self.assertEqual(self.client.get(self.base+'/export').status_code,409)
    def test_refinement_cannot_run_on_unrelated_asset(self):
        self.assertEqual(self.client.post(self.base+'/run/articulate').status_code,409)
        self.assertEqual(self.client.post(self.base+'/run/refine').status_code,409)
        p=server.project(self.p['id']);p['refinementProfile']='vey-trellis-refinement-1';server.save(p)
        self.assertEqual(self.client.post(self.base+'/run/refine').status_code,409)
    def test_stale_extra_evidence_blocks_approval(self):
        p=self.concept();server.output(p,'motion.glb').write_bytes(fixture(moving=True))
        p.update(animation='motion.glb',reviewReports={'animation':['sole.json']})
        server.write(server.output(p,'sole.json'),{'sha256':'stale','checks':[]});server.save(p)
        report=self.client.post(self.base+'/validate/animation').json()['quality']['animation']
        self.assertEqual(report['status'],'fail')
        server.write(server.output(p,'sole.json'),{'sha256':server.digest(server.output(p,'motion.glb')),'checks':[{'name':'sole shape','status':'fail','metrics':{'distortion':.12}}]})
        report=self.client.post(self.base+'/validate/animation').json()['quality']['animation']
        self.assertEqual(report['status'],'fail');self.assertTrue(any(c['name']=='sole shape' for c in report['checks']))
    def test_local_origin_and_path_boundaries(self):
        self.assertEqual(self.client.post('/api/projects',json={},headers={'Origin':'https://example.com'}).status_code,403)
        self.assertEqual(self.client.get('/api/config',headers={'Host':'attacker.example'}).status_code,403)
        self.assertEqual(self.client.get('/files/%2e%2e%2fsettings.json').status_code,404)
    def test_reference_validation(self):
        self.assertEqual(self.client.post(self.base+'/upload',files={'file':('bad.png',b'bad','image/png')}).status_code,400)
        for i in range(7):self.assertEqual(self.client.post(self.base+'/upload',files={'file':('r.png',self.image(),'image/png')}).status_code,200)
        self.assertEqual(self.client.post(self.base+'/upload',files={'file':('r.png',self.image(),'image/png')}).status_code,400)
    def test_settings_reject_noninstalled_model(self):
        self.assertEqual(self.client.put('/api/config',json={'model':'../../elsewhere.safetensors','family':'krea'}).status_code,400)
    def tearDown(self):
        p=server.project(self.p['id']);p['status']='review';server.save(p)

if __name__=='__main__':unittest.main()
