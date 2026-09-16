import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun} from '../../js/run/run.js';
import {createInventory,generateWeapon} from '../../js/run/weapons.js';
import {createScrapForge} from '../../js/run/expedition.js';
import {createCrystalLedger} from '../../js/run/crystals.js';
import {canClaimHome,validateHome,starterEarthHome,homeDefeatCheckpoint} from '../../js/run/homeworld.js';
import {createHomeStore} from '../../js/modes/home-store.js';
import {makeRng} from '../../js/run/rng.js';
const core=()=>createRun({seed:123,playerIds:['solo'],startGold:400});
function fixture(){const r=core();for(let i=0;i<10;i++)r.upgradeHeart();r.queueConquest(1);r.defeatConquestBoss(1);r.completeWave();r.claimHome();return {version:1,id:'home-123-1',name:'Test home',decorations:[],world:{seed:123,radius:240,terrain:'varied',environment:{theme:'temperate'},centre:[0,1,0],heart:[0,1,0],portals:[[1,0,0]]},checkpoint:{run:r.checkpoint(),commander:'commander',inventory:createInventory('commander').snapshot(),gold:400,lives:20,maxLives:20,forged:4,towers:[],faults:[]}};}
test('home capture requires maximum base, scheduled boss kill and stable completion',()=>{
 const r=core();assert.equal(r.queueConquest(1),false);for(let i=0;i<10;i++)r.upgradeHeart();
 assert.equal(r.claimHome(),false);assert.equal(canClaimHome(10,'building'),false);
 assert.equal(r.queueConquest(1),true);assert.equal(r.queueConquest(2),false);
 assert.deepEqual(r.completeWave(),[]);assert.equal(r.defeatConquestBoss(2),false);assert.equal(r.claimHome(),false);
 assert.equal(r.defeatConquestBoss(1),true);assert.equal(r.claimHome(),false);
 assert.ok(r.completeWave().some(e=>e.type==='planetConquered'));assert.equal(r.claimHome(),true);
 assert.equal(canClaimHome(10,'building',false,r.hasConquered()),true);
 assert.equal(canClaimHome(10,'drafting',false,true),false);assert.equal(canClaimHome(10,'building',true,true),false);
 assert.equal(r.getFrontierTheta(),Math.PI);assert.equal(r.isEndless(),true);
});
test('home run checkpoint restores powers, hand and exact future RNG',()=>{
 const r=core();r.restoreCheckpoint(fixture().checkpoint.run);
 const snap=r.checkpoint(),other=core();assert.equal(other.restoreCheckpoint(snap),true);
 assert.deepEqual(other.checkpoint(),snap);assert.deepEqual(other.completeWave(),r.completeWave());assert.deepEqual(other.getDraft(),r.getDraft());
});
test('saved home input rejects damaged identities, geometry, equipment and core state',()=>{assert.equal(validateHome(fixture()),true);for(const change of [h=>h.world.seed=NaN,h=>h.world.centre=[0,0,0],h=>h.checkpoint.run.powers=['bogus'],h=>h.checkpoint.run.hand=['bogus'],h=>h.checkpoint.inventory.slots=['missing',null],h=>h.checkpoint.lives=0,h=>h.decorations=[{kind:'missing'}],h=>h.checkpoint.run.heartLevel=9]){const h=fixture();change(h);assert.equal(validateHome(h),false);}});
test('home save is atomic on refusal and never erases campaign keys',()=>{const values=new Map([['campaign','keep']]);let fail=false;const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>{if(fail)throw Error('Quota exceeded');values.set(k,v);}};const store=createHomeStore(storage),h=fixture();assert.equal(store.save(h).ok,true);const before=store.export();fail=true;h.checkpoint.gold=999;assert.equal(store.save(h).ok,false);assert.equal(store.export(),before);assert.equal(values.get('campaign'),'keep');});
test('home backup merges distinct worlds, validates before writing and isolates returned copies',()=>{const map=new Map(),store=createHomeStore({getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)});store.save(fixture());const h=fixture();h.id='second';assert.equal(store.import(JSON.stringify({version:1,homes:[h]})).ok,true);assert.equal(store.list().homes.length,2);const before=store.export();assert.equal(store.import(JSON.stringify({version:1,homes:[h,h]})).ok,false);assert.equal(store.export(),before);store.get('second').checkpoint.gold=0;assert.equal(store.get('second').checkpoint.gold,400);});
test('checkpoint restores escalating forge cost and crystals without duplicate deposits',()=>{const bag=createInventory('commander'),f=createScrapForge(bag,4);assert.equal(f.cost,11);const c=createCrystalLedger();c.register('x');c.pickup('x');c.deposit({alive:true,nearHeart:true});const restored=createCrystalLedger(c.snapshot());restored.register('x');assert.equal(restored.pickup('x'),false);assert.equal(restored.credit,100);assert.equal(restored.deposit({alive:true,nearHeart:true}).count,0);});
test('RNG checkpoint is reproducible and does not alter the generator sequence',()=>{const a=makeRng(48),b=makeRng(48);assert.equal(a(),b());const saved=a.state();a();b.restore(saved);assert.equal(a(),(b(),b()));});
test('choosing another captured planet survives reload without erasing either checkpoint',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},store=createHomeStore(storage);
  const first=fixture(),second=fixture();second.id='second-home';second.checkpoint.gold=919;
  store.save(first);store.save(second);assert.equal(store.list().selected,first.id);
  assert.equal(store.choose(second.id).ok,true);assert.equal(createHomeStore(storage).list().selected,second.id);
  assert.deepEqual(store.get(first.id),first);assert.deepEqual(store.get(second.id),second);
  const before=store.export();assert.equal(store.choose('uncaptured').ok,false);assert.equal(store.export(),before);
});
test('failed home selection preserves the current home and other saved planets',()=>{
  const values=new Map();let blocked=false;const storage={getItem:k=>values.get(k),setItem:(k,v)=>{if(blocked)throw Error('quota');values.set(k,v);}},store=createHomeStore(storage);
  store.save(fixture());const second=fixture();second.id='second';store.save(second);blocked=true;
  const before=store.export();assert.equal(store.choose('second').ok,false);assert.equal(store.export(),before);
});
test('home backups restore selected identity on a new device and reject dangling selections',()=>{
  const data=new Map(),store=createHomeStore({getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}),first=fixture(),second=fixture();second.id='other';
  assert.equal(store.import(JSON.stringify({version:1,homes:[first,second],selected:'other'})).ok,true);assert.equal(store.list().selected,'other');
  const before=store.export();assert.equal(store.import(JSON.stringify({version:1,homes:[first],selected:'missing'})).ok,false);assert.equal(store.export(),before);
});

test('Earth is available on a fresh device without changing existing selection or requiring storage writes',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 const store=createHomeStore(storage,{starter:true});assert.equal(validateHome(starterEarthHome()),true);
 assert.equal(store.list().selected,'home-earth');assert.equal(map.size,0);
 const h=fixture();store.save(h);store.choose(h.id);
 assert.equal(createHomeStore(storage,{starter:true}).list().selected,h.id);
 assert.equal(store.list().homes.filter(x=>x.id==='home-earth').length,1);
 assert.equal(store.get('home-earth').world.environment.theme,'earth');
});
test('death rollback retains equipment, salvage balance, forge escalation and unique loot stream',()=>{
 const saved=fixture().checkpoint,gear={inventory:createInventory('commander').snapshot(),lootSequence:782,lootRng:193,forged:7};
 gear.inventory.items.push(generateWeapon({id:'kept-epic',seed:19,family:'sword',rng:()=>.99}));
 gear.inventory.scrap=11;saved.loot=[{item:gear.inventory.items[0],dir:[0,1,0],height:0}];
 const after=homeDefeatCheckpoint(saved,gear);assert.deepEqual(after.inventory,gear.inventory);
 assert.equal(after.lootSequence,782);assert.equal(after.lootRng,193);assert.equal(after.forged,7);
 assert.equal(after.run.wavesCleared,saved.run.wavesCleared);assert.deepEqual(after.loot,[]);
 assert.equal(saved.loot.length,1);assert.equal(saved.inventory.items.length,0);
});
test('home rarity ceiling retains ordinary roll distribution and expedition rarity',()=>{
 for(const roll of [.2,.8,.94,.99,.999]){
 const options={id:'roll',seed:93,family:'sword',rng:()=>roll};
 const normal=generateWeapon(options),home=generateWeapon({...options,maxRarity:'rare'});
 assert.equal(home.rarity,['epic','relic'].includes(normal.rarity)?'rare':normal.rarity);
 assert.deepEqual(home.parts,normal.parts);assert.deepEqual(home.make,normal.make);
 }
});

test('an imported selection on a fresh device wins over virtual starter Earth',()=>{
 const m=new Map(),store=createHomeStore({getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)},{starter:true});
 const h=fixture();assert.equal(store.import(JSON.stringify({version:1,homes:[h],selected:h.id})).ok,true);
 assert.equal(store.list().selected,h.id);assert.equal(store.list().homes.length,2);
});

test('home endless drafts resolve automatically for unattended defense',()=>{
 const r=core();r.restoreCheckpoint(starterEarthHome().checkpoint.run);
 r.completeWave();r.completeWave();assert.equal(r.getPhase(),'drafting');assert.equal(r.getDraft().remaining,10);
 assert.ok(r.tick(10).some(e=>e.type==='powerTaken'));assert.equal(r.getPhase(),'building');
});
