import tempfile,unittest,json
from pathlib import Path
from PIL import Image
import reference_pack as packs

class ReferencePackTests(unittest.TestCase):
 def test_six_views_and_motion_preserve_identity_contract(self):
  p=packs.prompts('Small alien with ivory cuffs','painted-anime-inkline')
  self.assertEqual(set(p),{*packs.VIEWS,'motion'});self.assertIn('NO face visible',p['back']);self.assertIn('anatomical LEFT',p['left']);self.assertIn('toe-off',p['motion'])
 def test_alpha_does_not_become_black_palette(self):
  with tempfile.TemporaryDirectory()as folder:
   root=Path(folder);(root/'pack').mkdir();im=Image.new('RGBA',(32,32),(0,0,0,0))
   for x in range(8,24):
    for y in range(8,24):im.putpixel((x,y),(120,60,140,255))
   im.save(root/'hero.png');p={'folder':'pack','hero':'hero.png','heroSha256':packs.sha(root/'hero.png'),'style':'painted-anime-inkline','outputs':{}}
   for name in [*packs.VIEWS,'motion']:
    im.save(root/'pack'/(name+'.png'));p['outputs'][name]={'file':'pack/'+name+'.png','sha256':packs.sha(root/'pack'/(name+'.png'))}
   colors=packs.assemble(root,p,'test');self.assertNotIn('#000000',colors);p['complete']=True;self.assertTrue(packs.current(p,root,root/'hero.png'))
   (root/'pack/front.png').write_bytes(b'changed');self.assertFalse(packs.current(p,root,root/'hero.png'))
 def test_changed_recipe_invalidates_cache(self):
  with tempfile.TemporaryDirectory()as folder:
   p=Path(folder)/'hero';p.write_bytes(b'hero');a=packs.identity(p,'alien','hard-cel',{'seed':1});self.assertNotEqual(a,packs.identity(p,'alien','hard-cel',{'seed':2}));p.write_bytes(b'other');self.assertNotEqual(a,packs.identity(p,'alien','hard-cel',{'seed':1}))
