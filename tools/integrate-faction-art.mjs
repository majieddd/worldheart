import {readFileSync,writeFileSync,copyFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const root='lib/99-art/factions',cat=JSON.parse(readFileSync(root+'/catalogue.json','utf8'));
const icons={};
for(const name of new Set(cat.factions.flatMap(f=>[...f.commanders,...f.weapons].map(a=>a.active.icon)).concat(['swords','hammer','backpack','shield','sword','heart','gem']))){
  const source=`artifacts/factions/vendor/package/icons/${name}.svg`;
  if(!existsSync(source))throw Error('Missing Lucide icon '+name);
  const svg=readFileSync(source,'utf8');icons[name]=svg.slice(svg.indexOf('>',svg.indexOf('<svg'))+1,svg.lastIndexOf('</svg>')).trim();
}
writeFileSync(root+'/icons.json',JSON.stringify(icons,null,2)+'\n');
copyFileSync('artifacts/factions/vendor/package/LICENSE',root+'/LUCIDE-LICENSE');
writeFileSync(root+'/icon-provenance.md','# Active-power icons\n\nLucide Static 1.46.0, ISC license and retained Lucide/Feather license notices in LUCIDE-LICENSE. Canonical paths are retained without hand-drawn replacements. Icons share a 24-unit grid, two-unit stroke, rounded joins and a faction-colored outlined badge in the interface. Source: https://www.npmjs.com/package/lucide-static\n');
if(process.argv.includes('--icons-only'))process.exit(0);
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),sharp=require('sharp');
const jobs=JSON.parse(readFileSync(root+'/jobs.json','utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const pilot=JSON.parse(readFileSync(root+'/pilot-receipt.json','utf8'));
for(const p of cat.plates){const job=jobs.find(j=>j.index===p.index);if(!job||job.status!=='completed')throw Error('Incomplete plate '+p.id);
 const file=root+'/'+p.id+'.png';if(!existsSync(file)){const r=await fetch(job.result_url);if(!r.ok)throw Error('Download failed '+p.id+' '+r.status);writeFileSync(file,Buffer.from(await r.arrayBuffer()));}
 const png=readFileSync(file),meta=await sharp(png).metadata();await sharp(png).webp({quality:91}).toFile(root+'/'+p.id+'.webp');
 if(p.index===0){p.prompt=pilot.prompt;p.promptSha256=hash(p.prompt);}
 Object.assign(p,{status:'completed',jobId:job.job_id,modelReported:job.model,sourceUrl:job.result_url,file:p.id+'.png',preview:p.id+'.webp',width:meta.width,height:meta.height,sha256:hash(png),webpSha256:hash(readFileSync(root+'/'+p.id+'.webp'))});
 console.log('Saved '+p.id+' '+meta.width+'x'+meta.height);
}
writeFileSync(root+'/catalogue.json',JSON.stringify(cat,null,2)+'\n');
// Contact sheets are review artifacts only; original paintings stay intact.
mkdirSync('artifacts/factions/review',{recursive:true});
for(const type of ['roster','arsenal','towers','world']){const plates=cat.plates.filter(p=>p.type===type),tiles=[];for(let i=0;i<plates.length;i++){const b=await sharp(root+'/'+plates[i].file).resize(600,400,{fit:'contain',background:'#202629'}).png().toBuffer();tiles.push({input:b,left:(i%2)*600,top:Math.floor(i/2)*400});}await sharp({create:{width:1200,height:1200,channels:3,background:'#202629'}}).composite(tiles).png().toFile('artifacts/factions/review/'+type+'.png');}
