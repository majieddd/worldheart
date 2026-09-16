// Refresh proposed recipe metadata, never the immutable candidate directory.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {VERSIONS} from '../js/hard-cel-versions.js';
const manifest='art-candidates/hard-cel-v1/candidate.json',bytes=readFileSync(manifest),baseline=JSON.parse(bytes);
const recipe=v=>Object.fromEntries(Object.entries(v).filter(([k])=>!['version','name','status','description'].includes(k)));
const study={schemaVersion:1,id:'worldheart-hard-cel-study',baselineManifest:manifest,baselineManifestSha256:createHash('sha256').update(bytes).digest('hex'),baselineEntry:'hard-cel-lab.html?version=v1&layout=single',variantCount:Object.keys(VERSIONS).length-1,controls:['geometry','assets','camera','light','animation'],variants:Object.entries(VERSIONS).filter(([id])=>id!=='v1').map(([id,v])=>({id,version:v.version,parent:baseline.id,status:'unreviewed',hypothesis:v.description,entry:'hard-cel-lab.html?version='+id+'&layout=pair',recipe:recipe(v)}))};
writeFileSync('art-candidates/hard-cel-study.json',JSON.stringify(study,null,2)+'\n');
console.log('Updated proposed versions; preserved baseline '+study.baselineManifestSha256);
