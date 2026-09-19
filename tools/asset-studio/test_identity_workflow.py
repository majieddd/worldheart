import unittest
from workflows import krea_graph

class IdentityWorkflowTests(unittest.TestCase):
    def test_identity_uses_both_trained_paths_and_preencodes_before_sampling(self):
        g=krea_graph('Rotate the whole figure',{'identityEdit':True,'model':'local.safetensors',
            'width':768,'height':1024,'seed':1,'referenceFidelity':2,'loras':[{'name':'krea2_style_reference.safetensors','strength':.8}]},['hero.png'],'test')
        patch=next(n['inputs'] for n in g.values() if n['class_type']=='Krea2EditModelPatch')
        sampler=next(n['inputs'] for n in g.values() if n['class_type']=='KSampler')
        self.assertEqual(patch['target_latent'],sampler['latent_image'])
        self.assertEqual(patch['ref_boost'],2)
        for role in ['positive','negative']:
            encoded=g[sampler[role][0]]
            self.assertEqual(encoded['class_type'],'Krea2EditGroundedEncode')
            self.assertEqual(encoded['inputs']['image'],patch['source_image'])
        loras=[n['inputs']['lora_name'] for n in g.values() if n['class_type']=='LoraLoaderModelOnly']
        self.assertEqual(loras,['krea2_identity_edit_v1_2.safetensors'])
        self.assertNotIn('FluxKontextMultiReferenceLatentMethod',[n['class_type']for n in g.values()])
