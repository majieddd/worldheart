import hashlib
import tempfile
import unittest
from pathlib import Path
from shape_inputs import conditioning, ROLES

class ShapeInputTests(unittest.TestCase):
    def test_multiview_uses_directional_files_not_hero_and_detects_mutation(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);outputs={}
            for role in (*ROLES,'hero'):
                data=role.encode();(root/(role+'.png')).write_bytes(data)
                outputs[role]={'file':role+'.png','sha256':hashlib.sha256(data).hexdigest()}
            p={'art':'hero.png','referencePack':{'complete':True,'outputs':outputs}}
            receipt=conditioning(p,root,'hunyuan-mv')
            self.assertEqual(set(receipt['views']),set(ROLES))
            self.assertNotIn('hero',receipt['views'])
            (root/'back.png').write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError,'changed'):conditioning(p,root,'hunyuan-mv')
    def test_model_renders_cannot_be_reconstruction_evidence(self):
        with self.assertRaisesRegex(ValueError,'independent'):
            conditioning({'referencePack':{'complete':True,'sourceModel':'generated.glb'}},'.','hunyuan-mv')
    def test_path_cannot_escape_project(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):conditioning({'art':'../secret.png'},folder,'hunyuan')
