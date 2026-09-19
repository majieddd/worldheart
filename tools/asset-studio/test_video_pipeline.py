import unittest,math
from pathlib import Path
from unittest.mock import patch
import numpy as np
from motion_catalogue import CLIPS,clip_brief
from motion_contact import in_place_travel,in_place_stance
from decision_advisor import rules

class MotionContracts(unittest.TestCase):
    def test_every_current_and_requested_clip_has_distinct_brief(self):
        base={'prompt':'Preserve identity. Fixed three-quarter side camera. 12 seconds, real-time: old combined motion.','reference':{'sha256':'identity'},'heroSha256':'hero'}
        prompts=[]
        for name in CLIPS:
            b=clip_brief(base,name);self.assertEqual(b['reference'],base['reference']);self.assertEqual(b['duration'],8);self.assertNotIn('old combined',b['prompt']);self.assertNotIn('three-quarter side',b['prompt']);prompts.append(b['prompt'])
        self.assertEqual(len(set(prompts)),9)

    def test_in_place_stance_uses_travel_not_low_foot(self):
        fps=30;t=np.arange(90)/fps;y=np.where(t<2,-.3*t,-.6+.6*(t-2));z=np.where(t<2,.1,.02)
        p=np.c_[t*0,y,z];mask,floor=in_place_stance(p,fps);self.assertGreater(mask[:55].mean(),.8);self.assertLess(mask[65:].mean(),.15);self.assertAlmostEqual(floor,.1);self.assertAlmostEqual(in_place_travel([p,p],fps)[1],.3,places=2)

    def test_no_motion_is_not_a_gait(self):
        with self.assertRaises(ValueError):in_place_stance(np.zeros((90,3)),30)

    def test_static_video_is_not_a_valid_walk_loop(self):
        from video_loops import fit_range
        with self.assertRaises(ValueError):fit_range(np.zeros((120,33,3)),30,'walk')

    def test_deterministic_diagnosis_keeps_known_errors_off_model(self):
        self.assertEqual(rules('CUDA out of memory'),'memory');self.assertEqual(rules('unmapped bone'),'rig');self.assertEqual(rules('the design feels wrong'),'review')

if __name__=='__main__':unittest.main()
