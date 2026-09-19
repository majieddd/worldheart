import unittest
from shape_budget import plan
class ShapeBudgetTests(unittest.TestCase):
    def test_multiview_does_not_reuse_mini_budget(self):
        b=plan({'meshEngine':'hunyuan-mv','meshSteps':60,'meshResolution':512})
        self.assertEqual(b['effective'],{'steps':30,'resolution':384})
        self.assertEqual(b['requested'],{'steps':60,'resolution':512})
        self.assertTrue(b['limited'])
    def test_lower_values_and_mini_are_preserved(self):
        for engine,steps,grid in [('hunyuan',60,512),('hunyuan-mv',20,256)]:
            b=plan({'meshEngine':engine,'meshSteps':steps,'meshResolution':grid})
            self.assertEqual(b['effective'],b['requested'])
            self.assertFalse(b['limited'])
