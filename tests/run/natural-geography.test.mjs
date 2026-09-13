import {test} from 'node:test';import assert from 'node:assert/strict';
import {earthCoastDistance} from '../../js/run/earth-coast.js';
import {solarGeography} from '../../js/run/solar-worlds.js';
import {FAULT_BRANCHES,faultProfile,DISASTERS,disasterExposure,disasterTargets} from '../../js/run/environment-catalogue.js';
import {ecologyScatter,patchScatter} from '../../js/terrain/scatter.js';
const at=(lon,lat)=>solarGeography('earth',Math.cos(lat*Math.PI/180)*Math.cos(lon*Math.PI/180),Math.sin(lat*Math.PI/180),-Math.cos(lat*Math.PI/180)*Math.sin(lon*Math.PI/180));
test('Earth coast preserves continental landmarks, major islands, seas and dateline continuity',()=>{
 for(const [name,lon,lat]of [['North America',-105,40],['South America',-60,-10],['Africa',20,0],['Europe',10,50],['Asia',100,50],['Australia',135,-25],['Antarctica',20,-80],['Greenland',-42,72],['Madagascar',47,-20],['Japan',139,36],['Britain',-2,54],['New Zealand',172,-43]])assert.ok(earthCoastDistance(lon,lat)>0,name);
 for(const [name,lon,lat]of [['Pacific',-140,0],['Atlantic',-30,0],['Indian Ocean',80,-20],['Mediterranean',15,35],['Red Sea',38,20],['Gulf of Mexico',-90,25],['Arctic',0,88]])assert.ok(earthCoastDistance(lon,lat)<0,name);
 for(let lat=-85;lat<90;lat+=5)assert.ok(Math.abs(earthCoastDistance(-180,lat)-earthCoastDistance(180,lat))<1e-9);
});
test('Earth vegetation and relief follow geographic belts without random volcanic patches',()=>{
 assert.equal(at(25,24).biome,'desert');assert.equal(at(-62,-3).biome,'jungle');assert.equal(at(20,-80).biome,'waterice');assert.ok(at(85,29).extra>15);assert.ok(at(-68.5,-25).extra>10);assert.ok(at(20,0).extra<1);
});
test('branching earthquake opens every advertised fissure and leaves distant ground unchanged',()=>{
 for(const line of FAULT_BRANCHES)for(const [x,z]of line.slice(1,-1))assert.ok(faultProfile(x,z)<-2);
 assert.ok(Math.abs(faultProfile(90,90))<1e-8);for(let u=-40;u<41;u++)for(let v=-35;v<36;v++)assert.ok(Number.isFinite(faultProfile(u,v))&&Math.abs(faultProfile(u,v))<6);
 assert.ok(!DISASTERS.ashfall&&!DISASTERS.cryoburst);for(const p of disasterTargets('solar',0)){assert.equal(disasterExposure('solar',p.u,p.v,0,.1),1);assert.equal(disasterExposure('solar',p.u,p.v,0,2),0);}assert.equal(DISASTERS.solar.emp,8);
});
test('ecology is repeatable, spatially clustered and has irregular positions and rotations',()=>{
 const a=ecologyScatter(771),b=ecologyScatter(771),points=[];let close=0,far=0;
 for(let i=0;i<300;i++){const p=a.point();assert.deepEqual(p,b.point());points.push(p);assert.ok(Math.abs(Math.hypot(...p)-1)<1e-12);close+=Math.abs(a.density(...p)-a.density(p[0]+.001,p[1],p[2]));far+=Math.abs(a.density(...p)-a.density(-p[0],-p[1],-p[2]));}
 assert.ok(close<far*.1,'nearby points share density, remote points do not');const ys=points.map(p=>p[1]).sort((a,b)=>a-b),gaps=ys.slice(1).map((y,i)=>y-ys[i]);assert.ok(Math.max(...gaps)>Math.min(...gaps)*10);
 assert.deepEqual(patchScatter(771,25),patchScatter(771,25));assert.notDeepEqual(patchScatter(771,25),patchScatter(772,25));assert.equal(patchScatter(771,25).length,25);
});
