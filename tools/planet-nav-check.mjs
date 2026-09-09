// Headless real-worldgen and real-enemy traversal. Rendering/combat are omitted;
// successful arrivals are route evidence, not natural campaign completion.
import {registerHooks} from 'node:module';import {execFile} from 'node:child_process';
import {promisify} from 'node:util';import {mkdirSync,writeFileSync,readFileSync,existsSync,copyFileSync} from 'node:fs';import {resolve} from 'node:path';
import {campaignRoute,planetDefinition} from '../js/run/planets.js';
const index=Number(process.argv.find(x=>x.startsWith('--planet='))?.split('=')[1]);
const seed=Number(process.argv.find(x=>x.startsWith('--seed='))?.split('=')[1])||12345;
const seconds=Number(process.argv.find(x=>x.startsWith('--seconds='))?.split('=')[1])||500;
if(index){
 const started=performance.now(),definition=planetDefinition(index,seed);
 globalThis.location={search:`?map=ninetynine&terrain=${definition.terrain}&seed=${definition.seed}`};globalThis.matchMedia=()=>({matches:false});
 registerHooks({resolve(spec,context,next){if(spec==='three')return{url:new URL('../lib/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(spec,context);}});
 const THREE=await import('../lib/three.module.min.js'),{CONFIG}=await import('../js/config.js'),world=await import('../js/world.js'),{NavGraph}=await import('../js/nav.js'),{EnemyManager}=await import('../js/enemies.js');
 world.initTerrainField(CONFIG.seed);const nav=new NavGraph();nav.build();
 const manager=new EnemyManager(new THREE.Scene(),nav);manager._render=()=>{};manager.onLeak=()=>{};
 manager.setHeart(world.surfacePoint(nav.nodeDir(nav.heartNode,new THREE.Vector3()),new THREE.Vector3()));
 for(const node of nav.portalNodes)for(const type of ['husk','mite','wisp'])manager.spawn(type,node,1);
 const spawned=manager.active.length,traces=new Map();let steps=0,ceilingViolation=false,floorViolation=false;
 for(;steps<seconds*30&&manager.active.length;steps++){
   const floors=new Map(manager.active.filter(e=>!e.type.flying&&nav.march?.floorReach[e.node]).map(e=>[e,true]));
   manager.update(1/30);
   for(const e of manager.active)if(floors.has(e)&&!nav.march.floorReach[nav.descendNode(e.node,e.dir)])floorViolation=true;
   for(const e of manager.active)if(e.type.flying&&world.terrainHeight(e.dir.x,e.dir.y,e.dir.z,false)+e.alt>world.FLIGHT_CEILING+.01)ceilingViolation=true;
   if(process.argv.includes('--trace')&&steps%1800===0)for(const e of manager.active){if(!traces.has(e))traces.set(e,[]);traces.get(e).push({time:steps/30,node:e.node,progress:e.progress,dir:e.dir.toArray()});}
 }
 const stranded=manager.active.map(e=>({type:e.typeKey,node:e.node,next:e.type.flying?nav.airNext[e.node]:(nav.march?.next||nav.next)[e.node],progress:e.progress,speed:e.moveV,floor:nav.floorWalk?.[e.node],floorReach:nav.march?.floorReach[e.node],routeCenter:e.routeCenter,routeExit:e.routeExit,dir:e.dir.toArray(),height:e.height,trace:traces.get(e)}));
 const result={index,name:definition.name,terrain:definition.terrain,requestedSeed:definition.seed,effectiveSeed:CONFIG.seed,attempts:nav.attempts,nodes:nav.n,spawned,arrived:spawned-stranded.length,seconds:steps/30,limitSeconds:seconds,ceilingViolation,floorViolation,stranded,elapsedMs:performance.now()-started,pass:spawned===15&&!stranded.length&&!ceilingViolation&&!floorViolation};
 console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;
}else{
 const out=resolve(process.argv[2]||'artifacts/planet-nav');mkdirSync(out,{recursive:true});
 const run=promisify(execFile),queue=[],results=[],resume=process.argv.includes('--resume');
 if(resume&&existsSync(resolve(out,'results.json')))copyFileSync(resolve(out,'results.json'),resolve(out,`results-before-retry-${Date.now()}.json`));
 for(const p of campaignRoute(seed)){
   const file=resolve(out,`planet-${String(p.index).padStart(2,'0')}.json`);let previous;
   if(resume&&existsSync(file)){try{previous=JSON.parse(readFileSync(file,'utf8'));}catch{}}
   if(previous?.pass&&previous.requestedSeed===p.seed&&previous.terrain===p.terrain)results.push(previous);else queue.push(p.index);
 }
 async function worker(){while(queue.length){const i=queue.shift();let result;try{const r=await run(process.execPath,[resolve('tools/planet-nav-check.mjs'),`--planet=${i}`,`--seed=${seed}`,`--seconds=${seconds}`],{timeout:240000,windowsHide:true,maxBuffer:4*1024*1024});result=JSON.parse(r.stdout.trim().split(/\r?\n/).at(-1));}catch(error){try{result=JSON.parse(error.stdout.trim().split(/\r?\n/).at(-1));}catch{result={index:i,pass:false,error:String(error),stderr:error.stderr};}}results.push(result);writeFileSync(resolve(out,`planet-${String(i).padStart(2,'0')}.json`),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({index:i,pass:result.pass,arrived:result.arrived,elapsedMs:result.elapsedMs}));}}
 await Promise.all([worker(),worker()]);results.sort((a,b)=>a.index-b.index);
 const report={scope:'Headless real worldgen and isolated enemy traversal; not a 99-planet playthrough',seed,results,pass:results.length===99&&results.every(x=>x.pass)};
 writeFileSync(resolve(out,'results.json'),JSON.stringify(report,null,2)+'\n');if(!report.pass)process.exitCode=1;
}
