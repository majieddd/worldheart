import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../js/run/rng.js';
import { generateWeapon, weaponStats, validWeapon, createInventory, FAMILIES } from '../../js/run/weapons.js';
import { MANUFACTURERS, MODIFIERS, MAKER_SKILLS, applyMakeEffects } from '../../js/run/manufacturers.js';
import { weaponCard } from '../../js/weapon-card.js';
const make=(overrides={})=>generateWeapon({id:'test',seed:381,rng:makeRng(381),family:'sword',...overrides});
test('new identities preserve the expedition RNG and legacy equipment byte for byte',()=>{
  const oldRng=makeRng(12),newRng=makeRng(12),old=make({rng:oldRng,legacy:true}),modern=make({rng:newRng});
  const {make:identity,...remaining}=modern;assert.deepEqual(remaining,old);assert.equal(newRng(),oldRng());assert.ok(identity);
  const inv=createInventory('commander');inv.register(old);inv.pickup(old.id);const restored=createInventory('commander',inv.snapshot());assert.deepEqual(restored.items,[old]);
});
test('all manufacturer/family/modifier combinations have finite bounded and distinct combat effects',()=>{
  const identities=new Set();
  for(const family of Object.keys(FAMILIES))for(const manufacturer of Object.keys(MANUFACTURERS))for(const modifier of Object.keys(MODIFIERS)){
    const item=make({family,manufacturer,modifier}),s=weaponStats(item,'commander',true);
    assert.equal(validWeapon(item),true);assert.ok(s.dmg>5&&s.dmg<180&&s.cd>0&&s.cd<3);assert.ok((s.slow||0)<=.7&&(s.leech||0)<=.35);
    assert.ok(Object.values(s).filter(v=>typeof v==='number').every(Number.isFinite));assert.ok(MAKER_SKILLS[s.weaponSkill]);
    identities.add(JSON.stringify([family,item.make.brand,item.make.perk,s]));
  }
  assert.equal(identities.size,6*4*8);
});
test('malformed maker data and cross-brand skills cannot enter inventory or a checkpoint',()=>{
  const item=make({manufacturer:'skibidi'});
  for(const bad of [null,{}, {...item.make,quality:0},{...item.make,quality:Infinity},{...item.make,brand:'__proto__'},{...item.make,skill:'siphon'},{...item.make,version:99}]){
    const corrupt={...item,make:bad};assert.equal(validWeapon(corrupt),false);assert.equal(createInventory('commander').register(corrupt),false);
  }
});
test('part fitting and attunement preserve dropped manufacturer, modifier and skill',()=>{
  const item=make(),inv=createInventory('commander');inv.register(item);inv.pickup(item.id);inv.request({kind:'equip',id:item.id,slot:0});
  inv.request({kind:'part',id:item.id,slot:'core',part:'frost'});inv.infuse(item.id,40);
  assert.deepEqual(inv.current.make,item.make);const restored=createInventory('commander',inv.snapshot());assert.deepEqual(restored.current,inv.current);
});
test('selecting the same maker in inspection reproduces its procedural identity',()=>{
  const original=make(),inspected=make({manufacturer:original.make.brand});assert.deepEqual(inspected.make,original.make);
});
test('manufacturer cards show actual combat values without invented ammo or levels',()=>{
  for(const family of Object.keys(FAMILIES)){
    const item=make({family}),s=weaponStats(item,'commander',true),html=weaponCard(item,{stats:s});
    assert.ok(html.includes(MANUFACTURERS[item.make.brand].name));assert.ok(html.includes(MAKER_SKILLS[item.make.skill].name));
    assert.doesNotMatch(html,/\b(ammo|ammunition|reload|level|tier)\b/i);assert.doesNotMatch(html,/NaN|undefined|Infinity/);
    if(family==='scepter')assert.ok(html.includes('Base beam DPS'));
  }
});
test('reach and coverage skills work on shells and beams as well as melee',()=>{
  const shell={...FAMILIES.lobber},beam={...FAMILIES.scepter};
  applyMakeEffects(shell,[MAKER_SKILLS.pressure.strike]);assert.ok(shell.speed>FAMILIES.lobber.speed&&shell.fuse>FAMILIES.lobber.fuse);
  applyMakeEffects(beam,[MAKER_SKILLS.resonance.strike]);assert.equal(beam.corridor,FAMILIES.scepter.corridor*2);assert.equal(beam.slow,.45);
});
