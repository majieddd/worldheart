// Compare optimized placement/preview behavior with the preceding full graph
// sweeps. These are directed terrain graph fixtures, not campaign play.
import{registerHooks}from'node:module';import{execFileSync}from'node:child_process';import{mkdirSync,writeFileSync}from'node:fs';import{resolve}from'node:path';
const profile=process.argv.find(x=>x.startsWith('--profile='))?.split('=')[1];
if(!profile){
 const out=resolve(process.argv[2]||'artifacts/placement-preview');mkdirSync(out,{recursive:true});const results=[];
 for(const key of ['varied','alpine','canyon','ocean']){const r=JSON.parse(execFileSync(process.execPath,[resolve('tools/placement-preview-check.mjs'),`--profile=${key}`],{encoding:'utf8',windowsHide:true}));results.push(r);console.log(JSON.stringify({profile:key,pass:r.pass,cases:r.cases.length,failures:r.cases.filter(c=>!c.pass)}));}
 writeFileSync(resolve(out,'results.json'),JSON.stringify({scope:'Placement legality compared with d79f1d6; march previews compared with independent full floor reachability and constrained weighted Dijkstra. Real directed costs and unchanged authoritative fields.',results,pass:results.every(r=>r.pass)},null,2)+'\n');if(results.some(r=>!r.pass))process.exitCode=1;
}else{
 globalThis.location={search:`?map=ninetynine&campaign=0&terrain=${profile}&seed=12345`};globalThis.matchMedia=()=>({matches:false});registerHooks({resolve(spec,context,next){if(spec==='three')return{url:new URL('../lib/three.module.min.js',import.meta.url).href,shortCircuit:true};return next(spec,context);}});
 const T=await import('../lib/three.module.min.js'),W=await import('../js/world.js'),{CONFIG}=await import('../js/config.js'),{NavGraph}=await import('../js/nav.js');W.initTerrainField(CONFIG.seed);const n=new NavGraph();n.build();
 const previous=execFileSync('git',['show','d79f1d6:js/nav.js'],{encoding:'utf8'});
 const method=(name,end)=>Function(`return ({${previous.slice(previous.indexOf('  '+name+'('),previous.indexOf('\n  '+end+'('))}}).${name}`)();
 const oldValidate=method('validatePlacement','blockNodes'),oldPreview=method('previewPaths','nodePos'),cases=[],dir=new T.Vector3(),pos=new T.Vector3();
 const same=(a,b)=>a.every((x,i)=>x===b[i]);
 const routeCost=path=>{let total=0,prior=-1,safe=true;for(let i=0;i<path.length;i+=3){dir.set(path[i],path[i+1],path[i+2]).normalize();const node=n.nearestNode(dir);if(prior>=0){let cost=Infinity;for(let e=n.adjOff[node];e<n.adjOff[node+1];e++)if(n.adj[e]===prior)cost=(n.march?.cost||n.cost)[e];total+=cost;}safe&&=n.walk[node]&&!n.block[node];prior=node;}return {total,safe,arrived:prior===n.heartNode};};
 function marchOracle(temp){
  const floor={dist:new Float64Array(n.n),next:new Int32Array(n.n),walk:n.floorWalk,cost:n.cost,block:n.block};
  n._dijkstra(n.heartNode,temp,floor);const costs=n.march.cost.slice();
  // Incoming rows: a certified floor source cannot exit to a mountain node.
  for(let a=0;a<n.n;a++)for(let e=n.adjOff[a];e<n.adjOff[a+1];e++)if(Number.isFinite(floor.dist[n.adj[e]])&&!Number.isFinite(floor.dist[a]))costs[e]=Infinity;
  const oracle={dist:new Float64Array(n.n),next:new Int32Array(n.n),walk:n.walk,cost:costs,block:n.block};n._dijkstra(n.heartNode,temp,oracle);
  return n.portalNodes.map(p=>{const path=[];if(temp.has(p)||temp.has(n.heartNode)||!Number.isFinite(oracle.dist[p]))return path;let guard=0;for(let i=p;i>=0&&guard++<n.n;i=oracle.next[i]){path.push(n.pos[i*3],n.pos[i*3+1],n.pos[i*3+2]);if(i===n.heartNode)break;}return path;});
 }
 const candidates=[];for(let i=0;i<n.n;i+=59)if(n.walk[i]&&Number.isFinite(n.dist[i])&&n.dist[i]>3&&n.dist[i]<75)candidates.push(i);
 function probe(node,radius,label){
  n.nodePos(node,pos);const required=[...n.portalNodes,candidates.at(-1)],expected=oldValidate.call(n,pos,radius,required),actual=n.validatePlacement(pos,radius,required);
  const oracle=n.march?marchOracle(new Set(n.nodesInRadius(pos,radius))):oldPreview.call(n,pos,radius),before={next:n.next.slice(),dist:n.dist.slice(),march:n.march?.next.slice(),marchDist:n.march?.dist.slice(),air:n.airNext?.slice(),block:n.block.slice(),revision:n.revision};
  const paths=n.previewPaths(pos,radius),cached=n.previewPaths(pos,radius),temp=new Set(n.nodesInRadius(pos,radius));
  let equalCost=true,safe=true;
  for(let i=0;i<paths.length;i++){
   const a=routeCost(paths[i]),b=routeCost(oracle[i]);equalCost&&=a.arrived===b.arrived&&(!b.arrived||Math.abs(a.total-b.total)<Math.max(.005,b.total*.00002));safe&&=!a.arrived||a.safe;
   for(let j=0;j<paths[i].length;j+=3){dir.set(paths[i][j],paths[i][j+1],paths[i][j+2]).normalize();safe&&=!temp.has(n.nearestNode(dir));}
  }
  const unchanged=same(before.next,n.next)&&same(before.dist,n.dist)&&same(before.block,n.block)&&(!before.air||same(before.air,n.airNext))&&(!before.march||(same(before.march,n.march.next)&&same(before.marchDist,n.march.dist)))&&before.revision===n.revision;
  const pass=JSON.stringify(expected)===JSON.stringify(actual)&&equalCost&&safe&&unchanged&&cached===paths;
  cases.push({label,node,radius,expected,actual,equalCost,safe,unchanged,cached:cached===paths,pass});
 }
 for(let i=0;i<18;i++)probe(candidates[(i*17)%candidates.length],i%3===0?2.1:.8,'candidate footprint');
 probe(n.heartNode,1.3,'heart rejected');probe(n.portalNodes[0],1.3,'portal rejected');
 const blocked=candidates[Math.floor(candidates.length/2)];n.nodePos(blocked,pos);n.blockNodes(pos,1.5,900001);probe(candidates[4],1.2,'new tower invalidates preview cache');n.unblockNodes(900001);probe(candidates[4],1.2,'sold tower restores routes');
 // Force a narrow required exit so last-route rejection cannot be vacuous.
 const target=candidates.at(-1),saved=[];for(let e=n.adjOff[target];e<n.adjOff[target+1];e++){const j=n.adj[e];saved.push([j,n.block[j]]);n.block[j]=900002;}n.revision++;n.recomputeFlow();probe(candidates[2],1.2,'isolated living enemy rejects unrelated build');for(const[j,b]of saved)n.block[j]=b;n.revision++;n.recomputeFlow();probe(candidates[2],1.2,'living enemy exit restored');
 console.log(JSON.stringify({profile,seed:CONFIG.seed,nodes:n.n,cases,pass:cases.every(c=>c.pass)}));
}
