"""Bounded offline recipe-selection experiment. Never called by game startup."""
import json,sys,time,statistics,subprocess
from pathlib import Path

PACKS={'alpine':'Towering mountains and ridges with passes through them','canyon':'Deep winding trenches and branching ravines below the surface','ocean':'An ocean with separated islands and coastal archipelagos','varied':'Mixed gentle hills, forests, valleys and several landforms'}
WEAPONS={'sword':'Close combat with broad sideways slashes through several enemies','spear':'Long straight thrusts for melee reach along a narrow line','carbine':'Fast ranged direct shots aimed at a distant single target','lobber':'Slow arcing explosive shells hitting groups behind obstacles'}
CASES=[
 ('terrain','A wall of enormous peaks dominates the skyline. Travel winds through snowy mountain passes.','alpine'),
 ('terrain','The routes cut down into the crust, far below the original plain. Narrow branching trenches connect them.','canyon'),
 ('terrain','Most of the surface is sea. Small islands each have a different silhouette.','ocean'),
 ('terrain','Wooded low hills, open fields and occasional rocks with varied scenery.','varied'),
 ('terrain','I want the Grand Canyon: a very deep incision in the ground, not two high mountains.','canyon'),
 ('terrain','Everest scale, sharp high peaks, ridgelines and a few traversable saddles.','alpine'),
 ('terrain','Explore a chain of islands surrounded by water, with occasional connected peninsulas.','ocean'),
 ('terrain','No one landform should dominate this garden. A little of everything.','varied'),
 ('terrain','Almost all dry ground, deep eroded slots and connected ravines, no island chain.','canyon'),
 ('terrain','There is one deep trench but it is mostly a vast ocean dotted with tiny atolls.','ocean'),
 ('terrain','A green plain below a single mountain. The rest should be gentle and diverse.','varied'),
 ('terrain','Few beaches and no great trenches: almost continuous alpine chains at immense height.','alpine'),
 ('weapon','Give me a blade that slashes several close enemies in a broad arc.','sword'),
 ('weapon','Keep enemies at the end of a long point and thrust straight ahead.','spear'),
 ('weapon','A rifle firing precise fast direct shots across the battlefield.','carbine'),
 ('weapon','Throw explosive shells in an arc over the wall at a clustered horde.','lobber'),
 ('weapon','I want the melee reach of a polearm, sacrificing sideways coverage.','spear'),
 ('weapon','Sweep a sharp edge from left to right, cleaving the nearby pack.','sword'),
 ('weapon','I need rapid precise projectiles against one distant target, without a blast.','carbine'),
 ('weapon','Slow high arcing shots that explode over an area, even behind cover.','lobber'),
 ]
WORDS={'terrain':{'alpine':['mountain','peak','alpine','everest'],'canyon':['trench','ravine','canyon','incision'],'ocean':['ocean','island','sea','atoll'],'varied':['gentle','mixed','everything','diverse']},'weapon':{'sword':['slash','sweep','cleav'],'spear':['thrust','polearm','long point'],'carbine':['rifle','precise','rapid'],'lobber':['explos','arc over','explode']}}
def baseline(kind,text):
    counts={key:sum(text.lower().count(word) for word in words) for key,words in WORDS[kind].items()}
    return max(counts,key=counts.get)
def run(runtime,out):
    sys.path.insert(0,str(Path(runtime)/'laya'));import laya,torch
    from huggingface_hub import snapshot_download
    torch.set_num_threads(4);start=time.perf_counter()
    cached=snapshot_download('convaiinnovations/laya',local_files_only=True)
    agent=laya.load(cached,device='cpu');load=time.perf_counter()-start;rows=[]
    for kind,state,expected in CASES:
        criteria=PACKS if kind=='terrain' else WEAPONS
        question={'recipe':{'type':'choice','instructions':'Choose the dominant requested recipe from this catalogue. A minor feature does not determine the whole recipe.','criteria':criteria}}
        start=time.perf_counter();direct=baseline(kind,state);base_ms=(time.perf_counter()-start)*1000
        start=time.perf_counter();answer=agent.predict(state,question)['answers']['recipe'];ms=(time.perf_counter()-start)*1000
        rows.append({'kind':kind,'request':state,'expected':expected,'baseline':direct,'baselineMs':base_ms,'choice':answer['choice'],'probabilities':answer['probabilities'],'confidence':answer['confidence'],'milliseconds':ms})
    report={'model':'convaiinnovations/laya','snapshot':Path(cached).name,'sourceCommit':subprocess.check_output(['git','-C',str(Path(runtime)/'laya'),'rev-parse','HEAD'],text=True).strip(),'device':'CPU / 4 threads','coldLoadSeconds':load,'count':len(rows),'correct':sum(r['choice']==r['expected'] for r in rows),'baselineCorrect':sum(r['baseline']==r['expected'] for r in rows),'medianMs':statistics.median(r['milliseconds'] for r in rows),'baselineMedianMs':statistics.median(r['baselineMs'] for r in rows),'rows':rows,'boundary':'Small hand-authored English intent-selection diagnostic. Not a quality metric, terrain generation benchmark, mobile inference test or equivalence claim with Jev. Numeric constraints and seed replay remain deterministic.'}
    Path(out).parent.mkdir(parents=True,exist_ok=True);Path(out).write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in report.items() if k!='rows'}))
if __name__=='__main__':run(sys.argv[1],sys.argv[2])
