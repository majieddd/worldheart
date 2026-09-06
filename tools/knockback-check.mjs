// Exact ocean terrain from the retained natural wave-9 stall. Controlled
// strikes isolate navigation causality; this is not a campaign playthrough.
import {registerHooks} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
globalThis.location={search:'?map=ninetynine&campaign=0&terrain=ocean&seed=326532'};
globalThis.matchMedia=()=>({matches:false});
registerHooks({resolve(spec,context,next){if(spec==='three')return{url:new URL('../lib/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(spec,context);}});
const THREE=await import('../lib/three.module.min.js');
const {CONFIG}=await import('../js/config.js'),world=await import('../js/world.js');
const {NavGraph}=await import('../js/nav.js'),{EnemyManager}=await import('../js/enemies.js');
const {AllyManager}=await import('../js/allies.js'),{TOWER_TYPES}=await import('../js/towers.js');
world.initTerrainField(CONFIG.seed);const nav=new NavGraph();nav.build();
const reported=[97274,97287,97295,97266,6129,97285,49752,157860];
const sample=()=>reported.map(node=>({node,walk:nav.walk[node],blocked:nav.block[node],next:nav.next[node],distance:nav.dist[node]}));
const empty=sample();
const towers=[['bolt',[83.45918784791729,197.27175146701512,110.37066221513923]],['tesla',[81.35924183118208,198.79242754424683,109.27235212299524]],['cryo',[79.63414670992736,198.04495086740698,111.92748609404629]],['tesla',[76.991591763308,197.572857817771,114.63241345519117]]];
for(let i=0;i<towers.length;i++)nav.blockNodes(new THREE.Vector3().fromArray(towers[i][1]),TOWER_TYPES[towers[i][0]].footprint*nav.footprintScale,i+1);
const placed=sample();
const scene=new THREE.Scene(),enemies=new EnemyManager(scene,nav),allies=new AllyManager(scene,enemies);
enemies._render=()=>{};enemies.setHeart(world.surfacePoint(nav.nodeDir(nav.heartNode,new THREE.Vector3()),new THREE.Vector3()));
const targets=reported.slice(0,-1).map(node=>nav.nodeDir(node,new THREE.Vector3()).normalize());
const candidates=[];
for(let node=0;node<nav.n;node++){
 if(!nav.walk[node]||nav.block[node]||!Number.isFinite(nav.dist[node]))continue;
 const origin=nav.nodeDir(node,new THREE.Vector3()).normalize();
 if(!targets.some(dir=>dir.angleTo(origin)*world.R<4))continue;
 for(let edge=nav.adjOff[node];edge<nav.adjOff[node+1];edge++){
  const dest=nav.adj[edge];if(Number.isFinite(nav.dist[dest])||nav.block[dest])continue;
  const end=nav.nodeDir(dest,new THREE.Vector3()).normalize(),axis=new THREE.Vector3().crossVectors(origin,end).normalize();
  for(const fraction of [.15,.25,.35,.45]){
   const from=origin.clone().applyAxisAngle(axis,origin.angleTo(end)*fraction).normalize();
   const fromNode=nav.nearestNode(from);if(!Number.isFinite(nav.dist[fromNode]))continue;
   const expected=from.clone().applyAxisAngle(axis,.6/world.R).normalize(),to=nav.nearestNode(expected);
   if(nav.block[to]||Number.isFinite(nav.dist[to]))continue;
   const attacker=from.clone().applyAxisAngle(axis,-1.5/world.R).normalize();
   if(!Number.isFinite(nav.dist[nav.nearestNode(attacker)]))continue;
   candidates.push({node:fromNode,to,from,axis});break;
  }
 }
}
const results=[];
for(const c of candidates)for(const type of ['husk','aegis']){
 const attackerDir=c.from.clone().applyAxisAngle(c.axis,-1.5/world.R).normalize();
 const a=allies.spawn('commander',attackerDir);if(!a)throw Error('commander spawn failed');
 a.fwd.crossVectors(c.axis,a.dir).normalize();
 const e=enemies.spawn(type,c.node,10);e.dir.copy(c.from);e.node=c.node;e.height=world.terrainHeight(e.dir.x,e.dir.y,e.dir.z);
 e.fwd.crossVectors(c.axis,e.dir).normalize();const before=e.dir.clone(),beforeHp=e.hp;
 const hits=allies._meleeSweep(a,{dmg:1,radius:4,arcDeg:160,cleave:.5,knockback:.6});
 const afterNode=nav.nearestNode(e.dir),distance=before.angleTo(e.dir)*world.R;
 const after={node:afterNode,next:nav.next[afterNode],blocked:nav.block[afterNode],walk:nav.walk[afterNode]};
 for(let i=0;i<1800&&e.active;i++)enemies.update(1/30);
 results.push({type,from:c.node,illegalDestination:c.to,hits,damage:beforeHp-e.hp,displacement:distance,after,after60Seconds:{active:e.active,reached:e.reached,node:e.node,next:nav.next[e.node]}});
 if(e.active)enemies._release(e);allies._release(a);
}
const pass=CONFIG.seed===389884&&nav.heartNode===121313&&results.length===210&&results.every(r=>r.hits===1&&r.damage>0&&r.displacement>0&&r.displacement<.6&&r.after.walk===1&&r.after.next>=0&&r.after60Seconds.reached);
const report={scope:'Exact ocean terrain and reported towers; controlled real melee strikes and enemy updates',seed:CONFIG.seed,heart:nav.heartNode,expectedHeart:121313,empty,placed,candidates:candidates.length,results,pass};
const out=resolve(process.argv[2]||'artifacts/knockback');mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({seed:report.seed,heart:report.heart,candidates:report.candidates,strikes:results.length,arrivals:results.filter(r=>r.after60Seconds.reached).length,pass}));
if(!pass)process.exitCode=1;
