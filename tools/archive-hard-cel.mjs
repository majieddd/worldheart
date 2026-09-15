// One-time preservation of the exact runtime the owner selected. Refuse overwrite.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const revision='4fcee910ca6fb71771fa8b8ba54d9a5172281a58';
const target=resolve('art-candidates/hard-cel-v1');
if(existsSync(target))throw Error('Candidate already exists. Verify it; never overwrite an approved snapshot.');
const paths=['painted-lab.html','css/painted-lab.css','js/painted-lab.js','js/painted-materials.js','js/painted-environment.js','lib/three.module.min.js','lib/three.core.min.js','lib/THREE-LICENSE.txt','lib/addons/loaders/GLTFLoader.js','lib/addons/utils/BufferGeometryUtils.js','lib/painted/commander.gltf','lib/painted/enemy.gltf','lib/painted/tower.gltf','lib/painted/gouache.png','lib/painted/provenance.json','lib/painted/README.md'];
const files=paths.map(path=>{const data=execFileSync('git',['show',revision+':'+path],{maxBuffer:16*1024*1024});const dest=resolve(target,path);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,data);return {path,sha256:createHash('sha256').update(data).digest('hex'),bytes:data.length};});
const candidate={schemaVersion:1,id:'worldheart-hard-cel-v1',version:'1.0.0',status:'owner-approved-candidate',approvedOn:'2026-09-15',approval:'Owner selected the Hard Cel pane with the detailed assets as a candidate for eventual Worldheart adoption. This is art-direction approval, not a production migration.',sourceRevision:revision,entry:'painted-lab.html?view=commander&compare=1',approvedPane:'right / Hard Cel',recipe:{gradientBands:[.32,.62,.96],gradientThresholds:[92,165],gradientSamples:256,gradientFilter:'linear',contourCssPixels:1.45,contourColor:'#292332',paintAmount:1,modelEmissiveIntensity:.06,shadowType:'VSMShadowMap',shadowRadius:1,shadowMapSize:2048,shadowBlurSamples:8,toneMapping:'ACESFilmic',exposure:1,fogDensity:.009,sceneSeed:80291},files};
writeFileSync(resolve(target,'candidate.json'),JSON.stringify(candidate,null,2)+'\n');
writeFileSync(resolve(target,'README.md'),'# Hard Cel v1.0.0\n\nOwner-approved art-direction candidate, preserved from '+revision+'.\nOpen '+candidate.entry+' and inspect the right Hard Cel pane.\nThe original runtime and all dependencies are exact git bytes, without edits.\nThe new comparison page uses this geometry and checks its baseline render against this snapshot.\nNever edit this directory to improve a style; create a new version beside it.\nProduction rigs, combat adoption and device qualification remain separate.\n');
console.log('Preserved '+files.length+' exact runtime dependencies in '+target);
