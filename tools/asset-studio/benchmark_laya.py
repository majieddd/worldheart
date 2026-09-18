"""Measured local routing trial, with deterministic baseline and retained wrong answers."""
import json,sys,time,statistics
from pathlib import Path
import decision_advisor as d

CASES=[('CUDA out of memory during paint','memory'),('Modulenotfounderror: cv2','runtime'),('SHA256 mismatch on approved concept','input'),('Pose coverage 0.3, ankles missing in most frames','tracking'),('Unmapped bone LeftUpLeg','rig'),('Missing texture in exported GLB','paint'),
 ('The GPU allocation was exhausted while decoding a very large mesh.','memory'),('The orange shoulder color is smeared onto the skin and the UV islands bleed.','paint'),('The feet are outside the frame, so the detector loses both ankles.','tracking'),('The cuff collapses when the wrist rotates; nearby vertices follow the wrong joint.','rig'),('The worker cannot import a required Python library after setup.','runtime'),('The concept has been replaced since the views were made; hashes no longer agree.','input'),
 ('Everything is technically valid but this face does not feel like the accepted character.','review'),('The generated image is boring.','review'),('The socket connection was refused by the local ComfyUI service.','runtime'),('The limbs disappear behind the cape in the video.','tracking'),('All fingers pull together when one hand joint turns.','rig'),('The green chest symbol is painted on the back.','paint'),('Not enough device memory for another tensor.','memory'),('The approved source file no longer exists on disk.','input'),('A model is valid but no one has reviewed whether it looks right.','review')]

def run(runtime,out):
    sys.path.insert(0,str(Path(runtime)/'laya'));import laya,torch
    torch.set_num_threads(4);started=time.perf_counter();agent=laya.load('convaiinnovations/laya',device='cpu');load=time.perf_counter()-started
    rows=[]
    for state,expected in CASES:
        t=time.perf_counter();base=d.rules(state);base_ms=(time.perf_counter()-t)*1000
        t=time.perf_counter();answer=agent.predict(state,d.QUESTIONS)['answers']['route'];ms=(time.perf_counter()-t)*1000
        rows.append({'state':state,'expected':expected,'baseline':base,'baselineMs':base_ms,'predicted':answer['choice'],'probability':answer['probabilities'][answer['choice']],'confidence':answer['confidence'],'ms':ms})
    report={'model':'convaiinnovations/laya','device':'cpu','loadSeconds':load,'count':len(rows),'correct':sum(r['predicted']==r['expected'] for r in rows),'baselineCorrect':sum(r['baseline']==r['expected'] for r in rows),'medianMs':statistics.median(r['ms'] for r in rows),'rows':rows,'scope':'Hand-authored held-out diagnostic paraphrases, not visual quality or a generative-LLM cost comparison.'}
    Path(out).write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in report.items() if k!='rows'}))
if __name__=='__main__':run(sys.argv[1],sys.argv[2])
