import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planetEnvironment,PLANET_THEMES,stellarFlux} from '../../js/run/planet-environments.js';
import {planetDefinition} from '../../js/run/planets.js';
import {createEcology} from '../../js/terrain/ecology.js';
import {createFormationField} from '../../js/terrain/formations.js';
import {LANDFORM_RECIPES} from '../../js/terrain/recipes.js';
import {riftSample} from '../../js/terrain/rifts.js';
import {worldgenUrl,rememberWorld} from '../../js/worldgen.js';
import {createCoastClearance} from '../../js/terrain/coast-clearance.js';

test('orbital flux, themes and campaign environments are deterministic and used',()=>{
  assert.equal(stellarFlux(1,2),.25);assert.equal(stellarFlux(4,2),1);
  const themes=new Set(),stars=new Set();
  for(let i=1;i<=99;i++){
    const p=planetDefinition(i,4206018157),e=planetEnvironment(p.seed);
    assert.deepEqual(e,p.environment);themes.add(e.theme);stars.add(e.star.type);
    assert.ok(Math.abs(e.flux*e.orbitAU**2-e.star.luminosity)<1e-10);
  }
  assert.ok(themes.size>=15,'a campaign exposes a broad selection of themes');assert.equal(stars.size,4);
  for(let seed=1;seed<=2000;seed++)themes.add(planetEnvironment(seed).theme);
  assert.equal(themes.size,Object.keys(PLANET_THEMES).length-1,'every theme is reachable by procedural selection');
  assert.ok(planetEnvironment(771,'arid').warmth>planetEnvironment(771,'frozen').warmth);
  assert.notDeepEqual(planetEnvironment(771,'volcanic').weights,planetEnvironment(771,'frozen').weights);
  assert.ok(planetEnvironment(771,'arid').oceanShift<planetEnvironment(771,'temperate').oceanShift);
  assert.ok(planetEnvironment(771,'monsoon').oceanShift>planetEnvironment(771,'temperate').oceanShift);
});

test('Planet Mix bands dominate longitude noise on garden and extreme worlds',()=>{
  for(const seed of [771,12345,92741,4206018157])for(const key of ['temperate','arid','frozen']){
    const eco=createEcology(seed,'auto',planetEnvironment(seed,key)),averages=[];
    for(const lat of [0,29,53,80]){
      const r=Math.cos(lat*Math.PI/180),y=Math.sin(lat*Math.PI/180),values=[];
      for(let k=0;k<32;k++){const a=k*Math.PI/16;values.push({t:eco.temperature(r*Math.cos(a),y,r*Math.sin(a)),m:eco.moisture(r*Math.cos(a),y,r*Math.sin(a))});}
      averages.push({t:values.reduce((s,v)=>s+v.t,0)/32,m:values.reduce((s,v)=>s+v.m,0)/32});
    }
    assert.ok(averages[0].t-averages[3].t>.9);
    assert.ok(averages[0].m-averages[1].m>.5);
    assert.ok(averages[2].m-averages[1].m>.35);
  }
});

test('environment descriptors cannot mutate later planets through shared recipe data',()=>{
 const first=planetEnvironment(771,'skyarchipelago'),original=planetEnvironment(771,'skyarchipelago');first.biomes.push('fake');first.weights.sky=0;assert.deepEqual(planetEnvironment(771,'skyarchipelago'),original);
});

test('rift spatial shortlist matches exhaustive sampling across cube edges and poles',()=>{
  const field=createFormationField(4206018157,240,{range:90,canyon:38},'varied',{weights:{grand:8,labyrinth:8,chaos:6}});
  const points=[[0,1,0],[0,-1,0],[1,0,0],[-1,0,0]];
  for(let k=0;k<4000;k++){const y=1-2*(k+.5)/4000,a=k*2.399963229728653,r=Math.sqrt(1-y*y);points.push([r*Math.cos(a),y,r*Math.sin(a)]);}
  for(let x=-1;x<=1.0001;x+=.1)for(let y=-1;y<=1.0001;y+=.1){const z=1-x*x-y*y;if(z>=0)points.push([x,y,Math.sqrt(z)],[x,y,-Math.sqrt(z)]);}
  for(const p of points){const a=field.inspect(...p),b=field.inspect(...p,true);assert.equal(a.relief,b.relief);assert.equal(a.id,b.id);assert.equal(a.lava,b.lava);}
});

test('continental rifts have a long deep floor and graded longitudinal entrances',()=>{
  const m={type:'grand',dir:[0,1,0],axis:[1,0,0],side:[0,0,1],extent:45,height:40,phase:0};
  const samples=[];
  const length=45*4.3;
  for(let u=-length;u<=length+.01;u+=1){
    const x=u/240,z=-Math.sin(u/length*4)*45*.3/240,y=Math.sqrt(1-x*x-z*z),s={};
    const cut=riftSample(m,x,y,z,240,s);samples.push(cut?-s.depth*s.cut:0);
  }
  assert.ok(Math.min(...samples)<-27);assert.ok(samples.filter(h=>h<-10).length>140);
  assert.ok(Math.abs(samples[0])<.001&&Math.abs(samples.at(-1))<.001);
  assert.ok(Math.max(...samples.slice(1).map((h,i)=>Math.abs(h-samples[i])))<.5,'entrances stay within floor grade');
});

test('new silhouettes differ in matched authored fields and lava belongs to its cone',()=>{
  const types=['grand','labyrinth','chaos','spine','volcano','forest'];
  const prints=[];
  for(const type of types){
    const weights=Object.fromEntries(Object.keys(LANDFORM_RECIPES).map(k=>[k,k===type?1:0]));
    const f=createFormationField(771,240,{range:90,canyon:32},'varied',{weights}),m=f.modules[0];
    const samples=[];let hot=0;
    for(let a=-16;a<=16;a++)for(let b=-16;b<=16;b++){
      const p=m.dir.map((n,k)=>n+(m.axis[k]*a+m.side[k]*b)/240),l=Math.hypot(...p),s=f.inspect(...p.map(n=>n/l));
      samples.push(s.relief.toFixed(2));if(s.lava>.2)hot++;
    }
    prints.push(samples.join(','));if(type==='volcano')assert.ok(hot>20);else assert.equal(hot,0);
  }
  assert.equal(new Set(prints).size,types.length);
});

test('theme survives links and history with backward-compatible defaults',()=>{
  let history=[];
  for(const planet of Object.keys(PLANET_THEMES)){
    const url=new URL(worldgenUrl('https://example.com/v2/',771,'varied',false,'auto',planet));
    assert.equal(url.searchParams.get('planet')||'auto',planet);
    history=rememberWorld(history,{seed:771,terrain:'varied',planet});
  }
  assert.equal(history.length,12,'recent worlds stay bounded as the catalogue grows');
  assert.equal(rememberWorld([{seed:771,terrain:'varied'}],{seed:771,terrain:'varied',planet:'auto'}).length,1);
  assert.throws(()=>worldgenUrl('https://example.com/',771,'varied',true,'auto','fake'));
});

test('coast ramps are continuous across longitude seams and cannot turn depth noise into a dam',()=>{
  const coast=createCoastClearance(240,(x,y,z)=>y<0,96,48);
  let prev=0;
  for(let i=0;i<=80;i++){
    const lat=i*Math.PI/180,p=[Math.cos(lat),Math.sin(lat),0],d=coast.sample(...p);
    assert.ok(d>=prev-.001);assert.ok((d-prev)*.4/(240*Math.PI/180)<.6);
    const a=coast.sample(p[0],p[1],1e-8),b=coast.sample(p[0],p[1],-1e-8);assert.ok(Math.abs(a-b)<.001);
    prev=d;
  }
  assert.equal(coast.sample(1,0,0),0);assert.ok(coast.sample(0,1,0)>200);
});
