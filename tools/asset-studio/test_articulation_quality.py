import unittest
from articulation_quality import roll_metrics
class RollChecks(unittest.TestCase):
    def test_permanently_upturned_boot_fails(self):self.assertFalse(roll_metrics([25,26,24,25,26,24])['pass'])
    def test_frozen_flat_boot_also_fails(self):self.assertFalse(roll_metrics([0]*100)['pass'])
    def test_rock_and_support(self):self.assertTrue(roll_metrics([15,8]+[0]*10+[-10,-25,-35,-10,8,15])['pass'])
