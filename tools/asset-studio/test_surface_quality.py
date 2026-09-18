import unittest
import numpy as np
from surface_quality import region_checks

class SurfaceTests(unittest.TestCase):
    def setUp(self):
        self.points=np.zeros((100,3));self.region=[{'name':'hand','min':[-1,-1,-1],'max':[1,1,1],'darkBelow':.22,'maxDarkRatio':.04}]
    def test_black_contamination_fails_where_clean_skin_passes(self):
        colors=np.full((100,3),175,dtype=np.uint8)
        self.assertEqual(region_checks(self.points,colors,self.region)[0]['status'],'pass')
        colors[:17]=0
        result=region_checks(self.points,colors,self.region)[0]
        self.assertEqual(result['status'],'fail');self.assertEqual(result['metrics']['darkContaminationRatio'],.17)
    def test_unseen_region_cannot_pass_with_empty_samples(self):
        result=region_checks(self.points+10,np.full((100,3),175),self.region)[0]
        self.assertEqual(result['status'],'fail')

if __name__=='__main__':unittest.main()
