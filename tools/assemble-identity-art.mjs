import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.WH_NODE_MODULES,'package.json')),sharp=require('sharp');
const dir='lib/99-art/identity-v2',hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const entries=[['anomalous-roster-v2','Anomalous / recognizable patient roster','Factions','Six patient appearances anchored to the supplied screenshot. Top: Three Eyes, X-rayed Face, Crooked Face. Bottom: Creepy Smile, Long-neck Patient, Sharp-teeth Patient. Commander roles are proposals.'],['brainshot-roster-v2','Brainshot / identity correction','Factions','Top: Tralalero Tralala, Ballerina Cappuccina, Tung Tung Tung Sahur. Bottom: Cappuccino Assassino, Bombardino Crocodilo, Chimpanzini Bananini. Familiar bodies and props with a painted rendering treatment.'],['gray-commander','Vey / Gray commander concept','Commander production','Original Gray commander proposal. Shared identity brief for the method comparison. Built-in generation; backing model is not exposed.'],['xeno-reptilian','Sarrak / Reptilian commander concept','Factions','Original Reptilian breach commander proposal. Race, element and role remain separate.'],['turret-placement','Third-person turret placement / clean painting','UI','Concept background with a mint turret ghost, footprint, range ring and an open path. Use the interactive Arcade B view for the composed HUD.'],['gray-higgsfield','Vey / Higgsfield concept','Commander production','Same written commander brief. Higgsfield reports gpt_image_2_5. This is a 2D poster; the separate Meshy conversion is pending.'],['vey-blender','Vey / editable Blender comparison','Commander production','A separate hand-authored, unrigged Blender mesh. Concept fidelity remains for owner review.']];
if(existsSync(dir+'/turret-placement-hud.png'))entries.push(['turret-placement-hud','Turret placement / Arcade B with F and G','UI','Third-person concept painting composed with the working HTML HUD. Concept visualization, not a capture of upgraded production game graphics.']);
const plates=[];
for(const [id,title,group,caption] of entries){
 const path=dir+'/'+id+'.png';if(!existsSync(path))continue;
 await sharp(path).webp({quality:93}).toFile(dir+'/'+id+'.webp');const m=await sharp(path).metadata();
 const row={id,title,group,caption,file:id+'.png',preview:id+'.webp',width:m.width,height:m.height,sha256:hash(path),previewSha256:hash(dir+'/'+id+'.webp'),hasAlpha:!!m.hasAlpha};
 if(existsSync(dir+'/'+id+'.json')){const receipt=JSON.parse(readFileSync(dir+'/'+id+'.json','utf8'));row.prompt=receipt.prompt;row.model=receipt.model;row.promptSha256=createHash('sha256').update(receipt.prompt).digest('hex');}
 plates.push(row);
}
writeFileSync(dir+'/catalogue.json',JSON.stringify({version:'2.0.0',style:'Painted-Anime-Inkline',plates},null,2)+'\n');
const workflow=JSON.parse(readFileSync(dir+'/krea2-official-style-reference.json','utf8'));
workflow.nodes.find(n=>n.id===30).widgets_values[0]=JSON.parse(readFileSync(dir+'/gray-commander.json','utf8')).prompt;
workflow.nodes.find(n=>n.id===30).widgets_values[1]=false;
workflow.nodes.find(n=>n.id===30).widgets_values[6]=99131;
workflow.nodes.find(n=>n.id===69).widgets_values[0]='paintline_clash.webp';
// Keep the official ResolutionSelector enum and square framing for this prepared pilot.
workflow.nodes.find(n=>n.id===29).widgets_values[0]='99-planets/vey-krea2-pilot';
writeFileSync(dir+'/krea2-vey-workflow.json',JSON.stringify(workflow,null,2)+'\n');
console.log(plates.length+' versioned identity images assembled. Krea workflow prepared, not executed.');
