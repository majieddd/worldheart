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
    def test_reference_isolation_preserves_source_and_invalidates_review(self):
        from PIL import ImageDraw
        p=self.concept();folder=server.output(p,'refs');folder.mkdir()
        im=Image.new('RGBA',(300,400));d=ImageDraw.Draw(im)
        d.rectangle((20,10,90,380),fill='red');d.rectangle((180,10,260,380),fill='blue');im.save(folder/'front.png')
        original=(folder/'front.png').read_bytes();sha=server.digest(folder/'front.png')
        p['referencePack']={'folder':'refs','outputs':{'front':{'file':'refs/front.png','sha256':sha}},'complete':False}
        p['approvals']={'art':'old','referencePack':'old'};server.save(p)
        route=self.base+'/reference-figures/front';self.assertEqual(len(self.client.get(route).json()['figures']),2)
        self.assertEqual(self.client.post(route,json={'index':1,'sourceSha256':'stale'}).status_code,409)
        r=self.client.post(route,json={'index':1,'sourceSha256':sha});self.assertEqual(r.status_code,200)
        self.assertEqual(r.json()['approvals'],{});self.assertEqual((folder/'front.png').read_bytes(),original)
        self.assertEqual(r.json()['referencePack']['outputs']['front']['crop']['figureIndex'],1)

    def test_fresh_mia_request_bypasses_compatible_cache(self):
        p=self.concept();server.output(p,'model.glb').write_bytes(fixture(motion=False));p.update(mesh='model.glb',status='review')
        interpreter=server.RUNTIME/'mia-env/Scripts/python.exe';interpreter.parent.mkdir(parents=True,exist_ok=True);interpreter.touch()
        server.write(server.DATA/'research-runtime.json',{'mia':{'runtimeVerified':True}})
        folder=server.output(p,'prior');folder.mkdir();(folder/'prediction.npz').write_bytes(b'saved')
        server.write(folder/'prediction.json',{'passed':True,'sourceSha256':server.digest(server.output(p,'model.glb')),'canonicalizationFitSha256':None})
        p['researchCandidates']=[{'method':'mia','folder':'prior'}];server.save(p)
        with patch.object(server.POOL,'submit') as submit:
            r=self.client.post(self.base+'/research',json={'method':'mia','freshInference':True});self.assertEqual(r.status_code,200)
            self.assertNotIn('reusePrediction',submit.call_args.args[-1])

    def test_fork_inputs_does_not_replace_original_or_inherit_acceptance(self):
        p=self.concept();self.client.post(self.base+'/approve/art')
        r=self.client.post(self.base+'/fork-inputs',json={'name':'Independent trial'})
        self.assertEqual(r.status_code,200);clone=r.json()
        self.assertNotEqual(clone['id'],p['id']);self.assertEqual(clone['approvals'],{})
        self.assertEqual(server.output(clone,clone['art']).read_bytes(),server.output(p,p['art']).read_bytes())
        server.output(clone,clone['art']).write_bytes(b'changed')
        self.assertNotEqual(server.output(clone,clone['art']).read_bytes(),server.output(p,p['art']).read_bytes())
    def test_dataset_import_refuses_unindexed_paths(self):
        r=self.client.post(self.base+'/dataset-motions/import',json={'id':'../../private.fbx'})
        self.assertEqual(r.status_code,400)
    def test_failed_research_preserves_asset_and_summarizes_saved_diagnostics(self):
        p=self.concept();server.output(p,'model.glb').write_bytes(fixture(motion=False))
        p.update(mesh='model.glb',animation='retained.glb',status='review');server.save(p)
        interpreter=server.RUNTIME/'mia-env/Scripts/python.exe';interpreter.parent.mkdir(parents=True,exist_ok=True);interpreter.touch()
        server.write(server.DATA/'research-runtime.json',{'mia':{'runtimeVerified':True}})
        with patch.object(server.POOL,'submit') as submit:
            response=self.client.post(self.base+'/research',json={'method':'mia'})
            self.assertEqual(response.status_code,200)
        execute,key,item,task=submit.call_args.args
        def fail(project,args):
            server.write(server.output(project,item['folder']+'/prediction.json'),{'checks':[{'name':'Head above pelvis','status':'fail','detail':'Invalid anatomy'}]})
            raise RuntimeError('Raw worker trace\nValueError: wrong anatomy')
        with patch.object(server,'run_process',side_effect=fail):execute(key,item,task)
        saved=server.project(key);candidate=saved['researchCandidates'][-1]
        self.assertEqual(saved['animation'],'retained.glb');self.assertFalse(candidate['passed'])
        self.assertIn('Head above pelvis',candidate['message']);self.assertNotIn('Raw worker trace',saved['message'])
        self.assertIn('Raw worker trace',server.output(saved,candidate['diagnostic']).read_text())
        self.assertEqual(saved['timings'][-1]['status'],'failed')
        self.assertEqual(self.client.post(self.base+'/research/'+item['id']+'/use',json={'visualReviewConfirmed':True}).status_code,409)
    def test_research_rejects_invalid_import_and_unknown_method(self):
        self.assertEqual(self.client.post(self.base+'/research',json={'method':'shell'}).status_code,400)
        self.assertEqual(self.client.post(self.base+'/motion-library',files={'file':('bad.fbx',b'not fbx','application/octet-stream')}).status_code,400)
        self.assertEqual(self.client.get(self.base+'/research').status_code,200)
    def test_research_selection_preserves_stages_and_requires_current_bytes(self):
        p=self.concept();server.output(p,'paint.glb').write_bytes(fixture(motion=False));server.output(p,'candidate.glb').write_bytes(fixture())
        p.update(mesh='paint.glb',paint='paint.glb',animation='previous.glb',status='review')
        item={'id':'example','method':'mixamo','file':'candidate.glb','report':'checks.json','passed':False,'sha256':server.digest(server.output(p,'candidate.glb')),'sourceSha256':server.digest(server.output(p,'paint.glb'))}
        p['researchCandidates']=[item];server.save(p);route=self.base+'/research/example/use'
        self.assertEqual(self.client.post(route,json={'visualReviewConfirmed':True}).status_code,409)
        item['passed']=True;server.save(p)
        self.assertEqual(self.client.post(route,json={}).status_code,409)
        server.output(p,'candidate.glb').write_bytes(b'changed')
        self.assertEqual(self.client.post(route,json={'visualReviewConfirmed':True}).status_code,409)
        server.output(p,'candidate.glb').write_bytes(fixture())
        r=self.client.post(route,json={'visualReviewConfirmed':True});self.assertEqual(r.status_code,200)
        self.assertEqual(r.json()['animation'],'candidate.glb');self.assertNotIn('animation',r.json()['approvals'])
        self.assertEqual(r.json()['refinementHistory'][-1]['animation'],'previous.glb')
    def test_recipe_rejects_changed_identity(self):
        p=self.concept();server.output(p,'mesh.glb').write_bytes(fixture(motion=False));server.output(p,'paint.glb').write_bytes(fixture(motion=False))
        sha=server.digest(server.output(p,'paint.glb'));server.write(server.output(p,'rig-profile.json'),{'name':'fixture fit','sourceSha256':sha});server.write(server.output(p,'paint-profile.json'),{'sourceSha256':sha,'palette':[[128,128,128]]*5})
        p.update(mesh='mesh.glb',paint='paint.glb',rigProfile={'file':'rig-profile.json'},paintProfile={'file':'paint-profile.json'});server.save(p)
        r=self.client.post(self.base+'/recipe');self.assertEqual(r.status_code,200)
        self.assertFalse(server.require_recipe(server.project(p['id']))['ownerApproved'])
        server.output(p,p['art']).write_bytes(self.image()+b'changed')
        self.assertEqual(self.client.post(self.base+'/run/replay-fitted').status_code,409)
    def test_paint_profile_is_bound_to_current_model(self):
        p=server.project(self.p['id']);server.output(p,'paint.glb').write_bytes(fixture(motion=False));p['paint']='paint.glb';server.save(p)
        profile={'sourceSha256':'wrong','palette':[[128,128,128]]*5}
        self.assertEqual(self.client.post(self.base+'/paint-profile',json=profile).status_code,409)
        profile['sourceSha256']=server.digest(server.output(p,'paint.glb'))
        self.assertEqual(self.client.post(self.base+'/paint-profile',json=profile).status_code,200)
        profile['palette'][0]=[300,0,0]
        self.assertEqual(self.client.post(self.base+'/paint-profile',json=profile).status_code,400)
    def test_exact_view_route_requires_model_packet_before_motion_approval(self):
        p=self.concept();p['referenceMode']='model';p.pop('referencePack',None)
        server.output(p,'mesh.glb').write_bytes(fixture(motion=False));server.output(p,'motion.glb').write_bytes(fixture())
        p.update(mesh='mesh.glb',animation='motion.glb',motionInput=server.digest(server.output(p,'mesh.glb')));server.save(p)
        r=self.client.post(self.base+'/approve/animation')
        self.assertEqual(r.status_code,409);self.assertIn('exact model references',r.json()['detail'])
    def test_incomplete_pack_blocks_approval_and_resume_reuses_finished_views(self):
        self.concept();p=server.project(self.p['id']);calls=[]
        def generate(p,s,prompt,refs,name):
            calls.append(name)
            if name.endswith('/left.png'):raise RuntimeError('Fixture interruption')
            server.output(p,name).write_bytes(self.image());return {'sha256':server.digest(server.output(p,name))}
        with patch.object(server,'generate_image',side_effect=generate):
            with self.assertRaises(RuntimeError):server.make_reference_pack(p,server.DEFAULT)
        p['status']='review';server.save(p)
        self.assertEqual(self.client.post(self.base+'/approve/art').status_code,409)
        calls.clear()
        def finish(p,s,prompt,refs,name):
            calls.append(name);server.output(p,name).write_bytes(self.image());return {'sha256':server.digest(server.output(p,name))}
        with patch.object(server,'generate_image',side_effect=finish):server.make_reference_pack(p,server.DEFAULT)
        self.assertEqual(len(calls),6);self.assertFalse(any(n.endswith('/front.png')for n in calls))
        self.assertEqual(self.client.post(self.base+'/approve/art').status_code,200)
        p=server.project(self.p['id']);server.output(p,p['referencePack']['outputs']['back']['file']).write_bytes(b'changed')
        with self.assertRaises(server.HTTPException):server.assert_approved(p,'art','art')
    def test_complete_replay_stays_busy_until_articulation_finishes(self):
        p=self.concept()
        sources={'art':p['art'],'paint':'fixture-paint.glb','animation':'fixture-motion.glb'}
        with patch.object(server,'require_refinement_source',return_value=sources),patch.object(server,'run_process'),patch.object(server,'require_valid_output'),patch.object(server,'digest',return_value='fixture-hash'):
            server.refine_vey(p,server.DEFAULT,continuing=True)
        saved=server.project(p['id'])
        self.assertEqual(saved['status'],'running');self.assertEqual(saved['stage'],'refined-production')
        self.assertEqual(self.client.post(self.base+'/run/model-references').status_code,409)
        saved['status']='review';server.save(saved)
    def test_hero_checkpoint_does_not_spend_on_views_or_allow_incomplete_approval(self):
        p=self.concept();calls=[]
        def generate(p,s,prompt,refs,name):
            calls.append(name);server.output(p,name).write_bytes(self.image());return {'sha256':server.digest(server.output(p,name))}
        with patch.object(server,'generate_image',side_effect=generate):server.make_art(p,{**server.DEFAULT,'family':'krea'},with_pack=False)
        self.assertEqual(len(calls),1);self.assertIsNone(p.get('referencePack'));self.assertEqual(p['status'],'review')
        self.assertEqual(self.client.post(self.base+'/approve/art').status_code,409)
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
    def test_one_angle_retry_preserves_prior_file_and_needs_complete_review(self):
        p=self.concept()
        def generated(p,s,prompt,refs,name):
            server.output(p,name).write_bytes(self.image());return {'sha256':server.digest(server.output(p,name))}
        with patch.object(server,'generate_image',side_effect=generated):
            server.make_reference_pack(p,server.DEFAULT,['front'])
            first=p['referencePack']['outputs']['front']['file']
            self.assertFalse(p['referencePack']['complete'])
            self.assertEqual(self.client.post(self.base+'/approve/art').status_code,409)
            server.make_reference_pack(p,server.DEFAULT,['front'])
            self.assertNotEqual(first,p['referencePack']['outputs']['front']['file'])
            self.assertTrue(server.output(p,first).exists())
            self.assertEqual(p['referencePack']['attemptHistory'][0]['file'],first)
    def test_current_concept_can_become_identity_reference(self):
        p=self.concept();self.client.post(self.base+'/approve/art')
        r=self.client.post(self.base+'/use-concept-reference');self.assertEqual(r.status_code,200)
        self.assertEqual(r.json()['references'][0],p['art']);self.assertFalse(r.json()['approvals'])
    def test_rig_fit_requires_exact_model_and_valid_joint_tree(self):
        p=self.concept();server.output(p,'mesh.glb').write_bytes(fixture(motion=False));p['mesh']='mesh.glb';server.save(p)
        self.assertEqual(self.client.post(self.base+'/rig-profile',json={'sourceSha256':'wrong'}).status_code,409)
        profile={'sourceSha256':server.digest(server.output(p,'mesh.glb')),'joints':[{'name':'same','head':[0,0,0],'tail':[0,0,1]}]*15}
        self.assertEqual(self.client.post(self.base+'/rig-profile',json=profile).status_code,400)
    def test_agent_review_does_not_claim_owner_acceptance(self):
        self.concept()
        self.assertEqual(self.client.post(self.base+'/approve/art',json={'reviewer':'agent'}).status_code,400)
        r=self.client.post(self.base+'/approve/art',json={'reviewer':'agent','notes':'Inspected face, silhouette, skin colors and full framing.'})
        self.assertEqual(r.status_code,200)
        p=r.json();self.assertFalse(p['reviews']['art']['ownerApproved'])
        self.assertIn('owner acceptance is pending',p['message'])
        self.assertNotIn('approved by user',p['events'][-1]['text'])
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
