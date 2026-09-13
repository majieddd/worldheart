import {test} from 'node:test';import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){return s==='three'?{url:new URL('../../lib/three.module.min.js',import.meta.url).href,shortCircuit:true}:n(s,c)}});
globalThis.location={search:'?map=ninetynine&campaign=0&planet=temperate',pathname:'/'};globalThis.matchMedia=()=>({matches:false});
const T=await import('../../lib/three.module.min.js'),w=await import('../../js/world.js'),{CONFIG}=await import('../../js/config.js'),{NavGraph}=await import('../../js/nav.js'),{formationSample}=await import('../../js/terrain/samples.js'),{LANDFORM_RECIPES}=await import('../../js/terrain/recipes.js'),{TERRAIN_PACKS}=await import('../../js/run/world-catalogue.js'),{AllyManager}=await import('../../js/allies.js');
function fixture(type){const sample=formationSample(type);CONFIG.terrain={...TERRAIN_PACKS.varied,range:90,canyon:38,ocean:-1,formations:{weights:Object.fromEntries(Object.keys(LANDFORM_RECIPES).map(k=>[k,k===type?1:0])),groups:sample.field.modules.map(m=>({id:m.id,disabled:m.id!==0}))}};CONFIG.terrainKey='varied';w.initTerrainField(771);const f=w.FEATURES,s=f.surfaces[0],nav=new NavGraph();nav._buildGraph(new T.Vector3(...s.dir),.42,false,8);return {f,s,nav};}
function walk(nav,from,to,height=null){
 const manager=Object.assign(Object.create(AllyManager.prototype),{enemies:{nav},time:0}),dir=nav.nodeDir(from,new T.Vector3()).normalize(),goal=nav.nodeDir(to,new T.Vector3()).normalize();
 const a={dir,fwd:new T.Vector3(1,0,0).addScaledVector(dir,-dir.x).normalize(),height:nav.height[from],moveNode:from,carryMul:1,hop:0,mountFlight:0,orderHeight:height,airT:0};let peak=0,under=0,frames=0,jump=0,previous=a.height;
 for(;frames<9000&&a.dir.angleTo(goal)*w.R>.15;frames++){manager.time+=1/60;manager._moveToward(a,goal,4/60);manager._ground(a);peak=Math.max(peak,a.height-w.terrainHeight(...a.dir.toArray()));if(Number.isFinite(w.overheadHeight(a.dir,a.height+1.7)))under++;jump=Math.max(jump,Math.abs(a.height-previous));previous=a.height;}
 return {distance:a.dir.angleTo(goal)*w.R,frames,peak,under,jump,height:a.height,goal:nav.height[to],route:a.route?.length,node:a.moveNode};
}
for(const type of ['valley','grotto','caverns','arcade'])test(type+': autonomous units traverse both the continuous roof and its open underpass',()=>{
 const {f,s,nav}=fixture(type),banks=[];for(let i=nav.baseCount;i<nav.n;i++)for(let e=nav.adjOff[i];e<nav.adjOff[i+1];e++){const b=nav.adj[e];if(b<nav.baseCount&&Number.isFinite(nav.cost[e]))banks.push({i,b,p:f.field.coordinates(s.m,nav.nodeDir(b,new T.Vector3()).toArray())});}
 const centre=new T.Vector3(...s.dir),top=nav.nearestNode(centre,s.top(0,0)),floor=nav.nearestNode(centre,w.terrainHeight(...s.dir)),footprint=nav.towerNodes(centre.clone().multiplyScalar(w.R+nav.height[top]),2);
 assert.ok(footprint.includes(top)&&!footprint.includes(floor),'a tower footprint occupies only its physical level');
 const a=banks.find(x=>x.p.v<0),b=banks.find(x=>x.p.v>0);assert.ok(a&&b,'both natural banks have traversable connections');
 const upper=walk(nav,a.b,b.b);assert.ok(upper.distance<.16&&upper.peak>2&&upper.jump<1,type+' top '+JSON.stringify(upper));
 const d=x=>new T.Vector3(...f.field.project(s.m,x,0)),left=nav.nearestWalkableNode(d(s.u-s.halfU*1.5)),right=nav.nearestWalkableNode(d(s.u+s.halfU*1.5));
 const bottom=walk(nav,left,right);assert.ok(bottom.distance<.16&&bottom.under>5&&bottom.peak<.3,type+' under '+JSON.stringify(bottom));
});
test('autonomous sky-island movement retains the floating graph surface',()=>{
 CONFIG.terrain={...TERRAIN_PACKS.sky,range:90,canyon:38,ocean:-1};CONFIG.terrainKey='sky';w.initTerrainField(771);
 const s=w.FEATURES.surfaces.find(s=>s.key==='floating-slab'),nav=new NavGraph();nav._buildGraph(new T.Vector3(...s.dir),.18,false,7);
 const from=nav.nearestWalkableNode(new T.Vector3(...s.dir)),dir=nav.nodeDir(from,new T.Vector3()),manager=Object.assign(Object.create(AllyManager.prototype),{enemies:{nav},time:0});
 const a={dir,fwd:new T.Vector3(1,0,0).addScaledVector(dir,-dir.x).normalize(),height:w.navigationHeight(...dir.toArray()),moveNode:from,carryMul:1,hop:0,mountFlight:0,airT:0};
 const to=Array.from(nav.adj.slice(nav.adjOff[from],nav.adjOff[from+1])).find(i=>nav.walk[i]),goal=nav.nodeDir(to,new T.Vector3());
 for(let k=0;k<90;k++){manager.time+=1/60;manager._moveToward(a,goal,4/60);manager._ground(a);assert.ok(a.height>26,'roaming cannot reset the island height to its ocean floor');}
});
