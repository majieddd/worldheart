import{execFileSync}from'node:child_process';
import{mkdirSync,writeFileSync}from'node:fs';
import{resolve,dirname}from'node:path';
import{pathToFileURL}from'node:url';
import{registerHooks}from'node:module';
const worker=process.argv[2]==='worker';
if(worker){
 const root=resolve(process.argv[3]),map=process.argv[4],seed=Number(process.argv[5]);
 globalThis.location={search:`?map=${map}&seed=${seed}`};globalThis.matchMedia=()=>({matches:false});
 const url=p=>pathToFileURL(resolve(root,p)).href;
 registerHooks({resolve(s,c,next){return s==='three'?{url:url('lib/three.module.min.js'),shortCircuit:true}:next(s,c);}});
 const W=await import(url('js/world.js'));W.initTerrainField(seed);const samples=[];
 for(let i=0;i<2000;i++){
  const y=1-2*(i+.5)/2000,r=Math.sqrt(1-y*y),a=i*2.39996323,x=r*Math.cos(a),z=r*Math.sin(a);
  samples.push([W.terrainHeight(x,y,z,false),W.terrainHeight(x,y,z,true),W.forestAt(x,y,z),W.moistureAt(x,y,z)]);
 }
 console.log(JSON.stringify(samples));
}else{
 const commit='3a60ac1db63a8530807034816ec83f33a06aa257',before=resolve('artifacts/landscapes/before-source');
 const files=execFileSync('git',['ls-tree','-r','--name-only',commit,'js','lib'],{encoding:'utf8'}).trim().split(/\r?\n/);
 for(const path of files){const target=resolve(before,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,execFileSync('git',['show',`${commit}:${path}`]));}
 const checks=[];
 for(const map of ['pocket','giant','titan','reach'])for(const seed of [12345,771,2387895531]){
  const run=root=>execFileSync(process.execPath,[process.argv[1],'worker',root,map,String(seed)],{encoding:'utf8',maxBuffer:8*1024*1024});
  checks.push({map,seed,samples:2000,values:8000,ok:run(before)===run(resolve('.'))});
 }
 const result={scope:'Exact terrain/fine-height/forest/moisture samples versus previous V2 for classic and space maps, not a visual or all-seed claim',before:commit,checks,pass:checks.every(c=>c.ok)};
 writeFileSync('artifacts/landscapes/classic-equivalence.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;
}
