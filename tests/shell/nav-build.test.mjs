import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OrderedEdgeSet,ExactPointIndex} from '../../js/nav-build.js';
import {buildIcosphere} from '../../js/geodesic.js';
import {createSolarSampler,solarGeography,SOLAR_THEMES} from '../../js/run/solar-worlds.js';

test('packed edge set preserves native order through collisions, duplicates and growth',()=>{
 const expected=new Set(),actual=new OrderedEdgeSet(1);
 for(let i=0;i<40000;i++){const a=i%1024,b=(i*7919)%65536,key=Math.min(a,b)*1048576+Math.max(a,b);const fresh=!expected.has(key);expected.add(key);assert.equal(actual.add(key),fresh);assert.equal(actual.add(key),false);}
 assert.equal(actual.size,expected.size);assert.deepEqual([...actual],[...expected]);
});
test('packed edges preserve real sphere triangle adjacency order',()=>{
 const {faces}=buildIcosphere(4),a=new Set(),b=new OrderedEdgeSet(faces.length*1.5);
 for(const [x,y,z]of faces)for(const [p,q]of [[x,y],[y,z],[z,x]]){const key=Math.min(p,q)*1048576+Math.max(p,q);a.add(key);b.add(key);}
 assert.deepEqual([...b],[...a]);
});
test('point index distinguishes colliding nearby doubles and matches reused globe vertices',()=>{
 const {verts}=buildIcosphere(5),index=new ExactPointIndex(verts.length+4);
 verts.forEach((v,i)=>index.set(...v,i));verts.forEach((v,i)=>assert.equal(index.get(...v),i));
 index.set(.1,.2,.3,77);index.set(.1+Number.EPSILON,.2,.3,78);
 assert.equal(index.get(.1,.2,.3),77);assert.equal(index.get(.1+Number.EPSILON,.2,.3),78);assert.equal(index.get(.1-Number.EPSILON,.2,.3),undefined);
 index.set(0,1,0,90);assert.equal(index.get(-0,1,-0),90);
});
test('bounded solar cache preserves the existing quantization for every Solar theme and evictions',()=>{
 for(const theme of Object.keys(SOLAR_THEMES)){
  const sample=createSolarSampler(theme),points=[];
  for(let i=0;i<18000;i++){const y=1-2*(i+.5)/18000,a=i*2.399963229728653,r=Math.sqrt(1-y*y),d=[Math.cos(a)*r,y,Math.sin(a)*r];
   const q=d.map(v=>Math.round((v+1)*65535)/65535-1),length=Math.hypot(...q)||1;
   assert.deepEqual(sample(...d),solarGeography(theme,...q.map(v=>v/length)));if(i%503===0)points.push(d);
  }
  for(const d of points){const q=d.map(v=>Math.round((v+1)*65535)/65535-1),length=Math.hypot(...q)||1;assert.deepEqual(sample(...d),solarGeography(theme,...q.map(v=>v/length)));}
 }
});
