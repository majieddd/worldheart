import unittest
import numpy as np
from rig_bridges import bridge_faces


class BridgeTests(unittest.TestCase):
    def fixture(self):
        # Separated, ordinary triangles on the torso; none occupy the boot gap.
        v=np.array([[.2,0,1],[.22,0,1],[.2,.02,1],[.2,0,2],[.2,0,0]])
        return v,np.tile([0,1,2],(200,1)),np.array([[-.12,0,.12],[.12,0,.12]])

    def test_ordinary_surface_survives(self):
        v,f,a=self.fixture();removed,report=bridge_faces(v,v.copy(),f,a)
        self.assertEqual(removed.tolist(),[])

    def test_isolated_rest_bridge_is_recorded_but_extensive_damage_rejected(self):
        v,f,a=self.fixture();v=np.vstack([v,[.2,0,1.2],[.21,0,1.2],[.2,.01,1.2]])
        posed=v.copy();posed[6,0]+=.5;f[0]=[5,6,7]
        removed,report=bridge_faces(v,posed,f,a);self.assertEqual(removed.tolist(),[0])
        self.assertEqual(report['stretchedBridgeFaces'],1)
        f[:10]=[5,6,7]
        with self.assertRaises(ValueError):bridge_faces(v,posed,f,a)

    def test_foot_gap_does_not_cut_upper_legs(self):
        v,f,a=self.fixture();v=np.vstack([v,[-.02,0,.03],[.02,0,.03],[0,.01,.03]])
        f[0]=[5,6,7];removed,_=bridge_faces(v,v.copy(),f,a);self.assertEqual(removed.tolist(),[0])
        v[5:,2]=.4;removed,_=bridge_faces(v,v.copy(),f,a);self.assertEqual(removed.tolist(),[])
