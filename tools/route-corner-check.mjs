// Reproduce the actual planet-95 route stall found by the 99-world sweep.
import{registerHooks}from'node:module';import{mkdirSync,writeFileSync}from'node:fs';import{resolve}from'node:path';
globalThis.location={search:'?map=ninetynine&campaign=0&terrain=varied&seed=9856871'};globalThis.matchMedia=()=>({matches:false});
registerHooks({resolve(spec,context,next){if(spec==='three')return{url:new URL('../lib/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(spec,context);}});
const T=await import('../lib/three.module.min.js'),W=await import('../js/world.js'),{CONFIG}=await import('../js/config.js'),{NavGraph}=await import('../js/nav.js'),{EnemyManager}=await import('../js/enemies.js');
const hz=Number(process.argv.find(x=>x.startsWith('--hz='))?.split('=')[1]||30);
if(![30,60,120].includes(hz))throw Error('Use --hz=30, 60 or 120');
W.initTerrainField(CONFIG.seed);const nav=new NavGraph();nav.build();const m=new EnemyManager(new T.Scene(),nav);m._render=()=>{};m.onLeak=()=>{};m.setHeart(W.surfacePoint(nav.nodeDir(nav.heartNode,new T.Vector3()),new T.Vector3()));
for(const node of nav.portalNodes)for(const type of ['husk','mite','wisp'])m.spawn(type,node,1);
for(let i=0;i<500*hz&&m.active.length;i++)m.update(1/hz);
const tail=[];
for(let i=0;i<120&&m.active.length;i++){
 const e=m.active[0],next=nav.next[e.node],center=nav.nodeDir(e.node,new T.Vector3()),to=nav.nodeDir(next,new T.Vector3()),want=to.clone().addScaledVector(e.dir,-to.dot(e.dir)).normalize(),probe=e.dir.clone().addScaledVector(want,.05/W.R).normalize();
 tail.push({time:m.time,node:e.node,next,dir:e.dir.toArray(),fwd:e.fwd.toArray(),speed:e.moveV,progress:e.progress,toCenter:e.dir.angleTo(center)*W.R,toNext:e.dir.angleTo(to)*W.R,centerToNext:center.angleTo(to)*W.R,walk:nav.walk[e.node],block:nav.block[e.node],probe:nav.nearestNode(probe),canStep:nav.canStep(e.dir,probe,false,e.node),factor:W.surfaceTravel(e,want,.05)});m.update(1/hz);
}
const remaining=m.active.length;
// A reused body must not inherit another spawn's corner, and a newly blocked
// recovery destination must cancel without walking into the tower footprint.
const e=m.spawn('husk',nav.portalNodes[0]);e.routeCenter=nav.heartNode;e.routeExit=nav.next[e.node];m._release(e);const reused=m.spawn('husk',nav.portalNodes[1]);
const poolReset=reused===e&&reused.routeCenter===-1&&reused.routeExit===-1;
const target=nav.heartNode,oldBlock=nav.block[target];nav.block[target]=99999;reused.routeCenter=target;reused.routeExit=target;m.update(1/hz);nav.block[target]=oldBlock;
const cancelled=reused.routeCenter!==target&&reused.routeExit!==target;
const out=resolve(process.argv[2]||'artifacts/route-corner');mkdirSync(out,{recursive:true});const report={scope:'Actual planet-95 route regression and isolated pooled/blocked-destination lifecycle checks',seed:CONFIG.seed,hz,heart:nav.heartNode,remaining,tail,poolReset,cancelled,pass:remaining===0&&poolReset&&cancelled};writeFileSync(resolve(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,tail:tail.slice(0,8)}));if(!report.pass)process.exitCode=1;
