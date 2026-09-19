import unittest
import numpy as np
from motion_contact import source_contacts,normalized_influences
from rig_contract import inspect_prediction


class MotionContractTests(unittest.TestCase):
    def test_low_sliding_foot_is_not_stance(self):
        points=np.zeros((20,3));points[:,0]=np.arange(20)/30
        contact,_,_=source_contacts(points,30)
        self.assertFalse(contact.any())
        points[:,0]=.1;contact,_,_=source_contacts(points,30)
        self.assertTrue(contact.all())

    def test_tied_weights_remain_four_and_normalized(self):
        w=normalized_influences(np.ones((7,52)))
        self.assertEqual(int((w>0).sum(1).max()),4)
        np.testing.assert_allclose(w.sum(1),1)
        with self.assertRaises(ValueError):normalized_influences(np.zeros((2,52)))

    def test_anatomy_gate_rejects_upside_down_and_missing_appendages(self):
        vertices=np.array([[-.4,0,0],[.4,0,0],[.4,2,0],[-.4,2,0]],dtype=float)
        faces=np.array([[0,1,2],[0,2,3]]);names=['Hips','Head','LeftFoot','RightFoot']
        heads=np.array([[0,1,0],[0,1.7,0],[.1,.1,0],[-.1,.1,0]])
        weights=np.full((4,4),.25);pose=np.tile(np.eye(4),(4,1,1))
        good=inspect_prediction(vertices,faces,heads,weights,pose,names)
        self.assertTrue(good['passed'])
        heads[1,1]=.3
        self.assertFalse(inspect_prediction(vertices,faces,heads,weights,pose,names)['passed'])
        heads[1,1]=1.7
        self.assertFalse(inspect_prediction(vertices,faces,heads,weights,pose,names,True)['passed'])

    def test_finite_normalized_weights_do_not_certify_deformation(self):
        v=np.array([[-.4,0,0],[.4,0,0],[.4,2,0],[-.4,2,0]])
        f=np.array([[0,1,2],[0,2,3]]);h=np.array([[0,1,0],[0,1.7,0],[.1,.1,0],[-.1,.1,0]])
        pose=np.tile(np.eye(4),(4,1,1));pose[0,0,3]=20
        r=inspect_prediction(v,f,h,np.eye(4),pose,['Hips','Head','LeftFoot','RightFoot'])
        self.assertFalse(r['passed']);self.assertGreater(r['edgeStretchP99'],3)


if __name__=='__main__':unittest.main()
