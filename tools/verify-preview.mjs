// Verify the deployed manifest against both exact git revisions, not just HTTP
// success. Keep this parameterized so each release need not copy an old script.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
const [revision,out='artifacts/public-identity.json',base='https://majieddd.github.io/worldheart/']=process.argv.slice(2);
if(!revision)throw Error('Usage: node tools/verify-preview.mjs PREVIEW_SHA [OUTPUT_JSON] [BASE_URL]');
const git=(...args)=>execFileSync('git',args,{maxBuffer:100*1024*1024});
const expected=git('rev-parse',revision).toString().trim(),production=git('rev-parse','origin/main').toString().trim();
const request=async path=>{const r=await fetch(new URL(path,base),{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`${r.status}: ${path}`);return Buffer.from(await r.arrayBuffer());};
const build=JSON.parse(await request('v2/build.json'));
if(build.previewSha!==expected||build.productionSha!==production)throw Error(`Build identity mismatch: ${JSON.stringify(build).slice(0,280)}`);
const jobs=[...Object.entries(build.previewHashes).map(([path,hash])=>({path,url:'v2/'+path,hash,revision:expected})),...Object.entries(build.productionHashes).map(([path,hash])=>({path,url:path,hash,revision:production}))];
const digest=b=>createHash('sha256').update(b).digest('hex');let cursor=0;const checks=[];
await Promise.all(Array.from({length:8},async()=>{while(cursor<jobs.length){const job=jobs[cursor++];try{const actual=digest(await request(job.url)),source=digest(git('show',job.revision+':'+job.path));checks.push({path:job.url,ok:actual===job.hash&&actual===source,sha256:actual});}catch(e){checks.push({path:job.url,ok:false,error:String(e)});}}}));
checks.sort((a,b)=>a.path.localeCompare(b.path));const pass=checks.every(c=>c.ok);
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify({previewSha:expected,productionSha:production,pass,checks},null,2)+'\n');
console.log(`${checks.filter(c=>c.ok).length}/${checks.length} live/source identity checks pass`);if(!pass)process.exitCode=1;
