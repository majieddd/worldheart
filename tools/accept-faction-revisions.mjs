import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='lib/99-art/factions',cat=JSON.parse(readFileSync(root+'/catalogue.json','utf8')),requests=JSON.parse(readFileSync(root+'/revision-requests.json','utf8')),revisions=JSON.parse(readFileSync(root+'/revision-jobs.json','utf8')),jobs=JSON.parse(readFileSync(root+'/jobs.json','utf8'));
mkdirSync(root+'/archive',{recursive:true});
for(const rev of revisions){const req=requests.find(r=>r.index===rev.index),plate=cat.plates.find(p=>p.id===req.id);if(plate.jobId===rev.job_id)continue;
 copyFileSync(root+'/'+plate.file,root+'/archive/'+plate.id+'-first.png');
 writeFileSync(root+'/archive/'+plate.id+'-first.json',JSON.stringify(plate,null,2)+'\n');
 const response=await fetch(rev.result_url);if(!response.ok)throw Error('Revision download '+response.status);writeFileSync(root+'/'+plate.file,Buffer.from(await response.arrayBuffer()));
 plate.sourcePromptSha256=plate.promptSha256;plate.prompt=req.prompt;plate.promptSha256=createHash('sha256').update(req.prompt).digest('hex');plate.revisionReason='Exact six-figure roster and consistent row mapping; replaces duplicate/spanning figures.';
 const i=jobs.findIndex(j=>j.index===plate.index);jobs[i]={...rev,index:plate.index};
}
writeFileSync(root+'/catalogue.json',JSON.stringify(cat,null,2)+'\n');writeFileSync(root+'/jobs.json',JSON.stringify(jobs,null,2)+'\n');
