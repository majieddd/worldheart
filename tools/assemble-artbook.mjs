// Integrate approved source files without rewriting historical prompts or image identities.
import {readFileSync,writeFileSync,copyFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve,basename} from 'node:path';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),sharp=require('sharp');
const root='lib/99-art',dir=root+'/painted-anime-inkline';
const read=p=>JSON.parse(readFileSync(p,'utf8')),hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const fresh=read(dir+'/catalogue.json');
const sourcePath=process.argv[2];
if(sourcePath){
 for(const source of read(sourcePath)){
  const row=fresh.plates.find(p=>p.id===source.id),file=row.id+'.png',preview=row.id+'.webp';
  copyFileSync(source.path,dir+'/'+file);
  await sharp(dir+'/'+file).webp({quality:92}).toFile(dir+'/'+preview);
  const meta=await sharp(dir+'/'+file).metadata();
  Object.assign(row,{file,preview,width:meta.width,height:meta.height,sourceImage:basename(source.path),sha256:hash(dir+'/'+file),previewSha256:hash(dir+'/'+preview),promptSha256:createHash('sha256').update(row.prompt).digest('hex'),review:'Visually inspected concept; owner acceptance pending'});
  row.references=row.referencePaths.map(p=>({path:'lib/99-art/'+p.split('/lib/99-art/')[1],sha256:hash(p)}));
  delete row.referencePaths;
 }
 writeFileSync(dir+'/catalogue.json',JSON.stringify(fresh,null,2)+'\n');
}
const old=read(root+'/catalogue.json'),factions=read(root+'/factions/catalogue.json'),archive=read('lib/artboard/catalogue.json'),media=[];
function add(row,prefix,group,title,caption,status){
 media.push({id:row.id,title:title||row.title||row.id,caption:caption||row.caption||'',group,status,src:prefix+'/'+(row.preview||row.file),original:prefix+'/'+row.file,width:row.width,height:row.height,sha256:row.sha256});
}
if(existsSync(root+'/mascot-v1/catalogue.json'))for(const p of read(root+'/mascot-v1/catalogue.json').plates)add(p,root+'/mascot-v1',p.group,p.title,p.caption,'Mascot candidate');
if(existsSync(root+'/identity-v2/catalogue.json'))for(const p of read(root+'/identity-v2/catalogue.json').plates)add(p,root+'/identity-v2',p.group,p.title,p.caption,'Identity revision');
for(const p of fresh.plates)add(p,dir,p.group,p.title,p.caption,'New reference');
for(const p of factions.plates){const f=factions.factions.find(f=>f.id===p.faction);add(p,root+'/factions','Factions',f.name+' / '+p.type,p.faction==='alien'?'Earlier Physical-material study; current elemental canon is in the Xeno codex.':['anomalous','brainshot'].includes(p.faction)&&p.type==='roster'?'Superseded identity study. Use the corrected roster in Factions; original preserved for history.':'Commanders, equipment and homeworld proposals.','Catalogue study');}
for(const p of old.plates)add(p,root,'Earlier studies',p.id==='alien'?'Xeno / Original Physical study':p.id[0].toUpperCase()+p.id.slice(1),['earth','story'].includes(p.id)?'Earlier story study. The current opening uses purple Void scouts arriving first.':'Earlier built-in image generation study, preserved for comparison.','Earlier study');
for(const id of ['field','arcade','signal']){const file=root+'/ui-'+id+'.webp',m=await sharp(file).metadata();media.push({id:'ui-'+id,title:({field:'A / Field',arcade:'B / Arcade · Selected',signal:'C / Signal'})[id],group:'UI',status:id==='arcade'?'Selected layout':'Alternative layout',src:file,original:file,width:m.width,height:m.height,caption:'Interactive UI concept with staged game values.',interactive:'design-demos/99-planets/'+id+'.html'});}
for(const file of readdirSync(root+'/references').filter(x=>/\.(webp|png)$/.test(x))){const path=root+'/references/'+file,m=await sharp(path).metadata();media.push({id:'reference-'+file.replace(/\..+/,''),title:file.replace(/\.(webp|png)$/,'').replaceAll('_',' ').replaceAll('-',' '),group:'References & 3D',status:file.startsWith('current')||file.startsWith('axiom-runtime')?'Runtime capture':'Binding source reference',src:path,original:path,width:m.width,height:m.height,caption:'Saved reference image. Runtime captures and illustrations are labeled separately.'});}
for(const p of archive.plates){const row={...p,id:'medieval-'+p.id,preview:p.preview||p.file.replace('.png','.webp')};add(row,'lib/artboard','Medieval archive',p.title||p.id,'Preserved for a future medieval planet.','Archived direction');}
if(new Set(media.map(p=>p.id)).size!==media.length)throw Error('Duplicate media IDs');
if(media.some(p=>!existsSync(p.src)||!existsSync(p.original)))throw Error('Missing media file');
for(const p of media){const m=await sharp(p.src).metadata();p.width=m.width;p.height=m.height;}
writeFileSync(root+'/media.json',JSON.stringify({version:'1.0.0',style:fresh.style,plates:media},null,2)+'\n');
console.log('Saved '+fresh.plates.length+' new paintings and '+media.length+' gallery entries.');
