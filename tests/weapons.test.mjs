import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventory, generateWeapon, weaponStats, shouldDrop, eraForPlanet, validWeapon } from '../js/run/weapons.js';
import { makeRng } from '../js/run/rng.js';
const item = (id, family = 'sword', seed = 42) => generateWeapon({ id, family, seed, rng: makeRng(seed) });
test('generation replays, families differ and tier/era/rarity remain separate', () => {
  const a = item('a'); assert.deepEqual(a, item('a')); assert.equal(validWeapon(a), true);
  const sword = weaponStats(a, 'commander'), spear = weaponStats(item('b', 'spear'), 'commander');
  assert.ok(spear.radius > sword.radius); assert.ok(sword.arcDeg > spear.arcDeg);
  assert.equal(weaponStats(item('c', 'carbine'), 'oracle'), null);
  assert.deepEqual([1,33,34,66,67,99].map(eraForPlanet), ['ancient','ancient','technological','technological','empowered','empowered']);
  assert.equal(validWeapon({ ...a, parts: { ...a.parts, core: '__proto__' } }), false);
});
test('drop boundaries are exact and bosses do not consume the chance stream', () => {
  assert.equal(shouldDrop({}, () => .01999), true); assert.equal(shouldDrop({}, () => .02), false);
  assert.equal(shouldDrop({elite:true}, () => .09999), true); assert.equal(shouldDrop({elite:true}, () => .1), false);
  assert.equal(shouldDrop({boss:true}, () => {throw Error('unexpected roll');}), true);
});
test('full backpack retains drops, replacement and salvage are idempotent', () => {
  const inv = createInventory('commander');
  for (let i = 0; i < 13; i++) { inv.register(item(String(i))); assert.equal(inv.pickup(String(i)), i < 12); }
  assert.equal(inv.drops.length, 1); assert.equal(inv.items.length, 12);
  assert.equal(inv.pickup('12', '0'), true); assert.equal(inv.pickup('12', '1'), false);
  assert.equal(inv.items.length, 12); assert.equal(inv.scrap, 1);
  assert.equal(inv.request({kind:'equip',id:'12',slot:0}), true);
  assert.equal(inv.salvage('12'), false); assert.equal(inv.salvage('1'), true); assert.equal(inv.salvage('1'), false);
  assert.equal(inv.register(item('12')), false);
});
test('equip and customization commit between attacks without mutating templates', () => {
  const inv = createInventory('commander'); inv.register(item('a')); inv.pickup('a');
  assert.equal(inv.request({kind:'equip',id:'a',slot:0}, true), true); assert.equal(inv.active,'native');
  assert.equal(inv.settle(true),false); assert.equal(inv.settle(false),true);
  const before = weaponStats(inv.current, 'commander');
  assert.equal(inv.request({kind:'part',id:'a',slot:'head',part:'long'},true),true);
  assert.deepEqual(weaponStats(inv.current, 'commander'),before); inv.settle(false);
  assert.ok(weaponStats(inv.current, 'commander').radius >= before.radius);
  const detached = inv.items; detached[0].tier = 99; assert.equal(inv.current.tier,1);
  assert.equal(inv.request({kind:'part',id:'a',slot:'core',part:'pulse'}),false);
  assert.equal(inv.request({kind:'select',slot:'basic'}),true); assert.equal(inv.current,null);
});
test('checkpoint rejects duplicate identities and malformed equipment; infusion is bounded', () => {
  const inv = createInventory('commander'); inv.register(item('a')); inv.pickup('a'); inv.request({kind:'equip',id:'a',slot:1});
  assert.deepEqual(createInventory('commander', inv.snapshot()).snapshot(), inv.snapshot());
  assert.throws(() => createInventory('commander', {...inv.snapshot(),items:[item('a'),item('a')]}));
  assert.throws(() => createInventory('commander', {...inv.snapshot(),slots:['a','a']}));
  assert.equal(inv.infuse('a',34),true); assert.equal(inv.infuse('a',34),false);
  assert.equal(inv.infuse('a',67),true); assert.equal(inv.infuse('a',99),true); assert.equal(inv.infuse('a',100),false);
  assert.equal(inv.current.era,'empowered'); assert.equal(inv.current.id,'a');
});
test('full loadouts swap slots without overflow and unequipping requires space', () => {
  const inv=createInventory('commander');
  for(let i=0;i<14;i++){
    inv.register(item(String(i)));assert.equal(inv.pickup(String(i)),true);
    if(i<2)inv.request({kind:'equip',id:String(i),slot:i});
  }
  assert.equal(inv.request({kind:'equip',id:'0',slot:1}),true);
  assert.deepEqual(inv.slots,['1','0']);
  assert.equal(inv.request({kind:'unequip',slot:1}),false);
  inv.salvage('2');assert.equal(inv.request({kind:'unequip',slot:1}),true);
  assert.equal(inv.active,'basic');assert.equal(inv.salvage('0'),true);
  assert.equal(inv.items.length-inv.slots.filter(Boolean).length,11);
});
