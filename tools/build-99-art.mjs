// Preserve originals and derive browser copies from the saved concept catalogue.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json'));
const sharp=require('sharp'),root='lib/99-art/',file=root+'catalogue.json';
const catalogue=JSON.parse(readFileSync(file,'utf8'));
const hash=data=>createHash('sha256').update(data).digest('hex');
for(const plate of catalogue.plates){
  const data=readFileSync(root+plate.file),meta=await sharp(data).metadata();
  await sharp(data).webp({quality:91,effort:6}).toFile(root+plate.preview);
  Object.assign(plate,{width:meta.width,height:meta.height,sha256:hash(data),previewSha256:hash(readFileSync(root+plate.preview)),promptSha256:hash(plate.prompt+'\n\n'+catalogue.sharedPrompt+(plate.editPrompt||'')),review:'Visually inspected proposal; owner acceptance pending'});
}
for(const ref of catalogue.references)ref.sha256=hash(readFileSync(root+ref.path));
writeFileSync(file,JSON.stringify(catalogue,null,2)+'\n');
console.log(`Saved ${catalogue.plates.length} original identities and WebP previews`);
