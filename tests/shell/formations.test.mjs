import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFormationField } from '../../js/terrain/formations.js';
import { LANDFORM_RECIPES, landformSettings, formationHeightLimit, formationDepthLimit } from '../../js/terrain/recipes.js';
import { mulberry32 } from '../../js/noise.js';
const profile = { range: 96, canyon: 38 }, R = 240;
const field = createFormationField(12345, R, profile, 'alpine');
function directions(count, seed = 8) {
  const rng = mulberry32(seed);
  return Array.from({ length: count }, () => { const y = rng() * 2 - 1, az = rng() * 2 * Math.PI, r = Math.sqrt(1 - y * y); return [r * Math.cos(az), y, r * Math.sin(az)]; });
}
test('recipe manifest and query results replay independently of query order', () => {
  const repeat = createFormationField(12345, R, profile, 'alpine'), dirs = directions(500);
  assert.deepEqual(field.manifest(), repeat.manifest());
  const before = dirs.map(d => field.height(...d));
  dirs.slice().reverse().forEach(d => repeat.height(...d));
  assert.deepEqual(before, dirs.map(d => repeat.height(...d)));
  assert.notDeepEqual(field.manifest().modules, createFormationField(12346, R, profile, 'alpine').manifest().modules);
});
test('spatial index matches a full nearest-site oracle including cube boundaries and poles', () => {
  const points = directions(6000);
  for (let x = -1; x <= 1.00001; x += .1) for (let y = -1; y <= 1.00001; y += .1) {
    const z2 = 1 - x * x - y * y;
    if (z2 >= 0) { points.push([x, y, Math.sqrt(z2)], [x, y, -Math.sqrt(z2)]); }
  }
  points.push([0, 1, 0], [0, -1, 0], [-1, 0, 0], [1, 0, 0]);
  for (const p of points) {
    const a = field.inspect(...p), b = field.inspect(...p, true);
    assert.equal(a.id, b.id); assert.ok(Math.abs(a.relief - b.relief) < 1e-9); assert.ok(Math.abs(a.edge - b.edge) < 1e-9);
  }
});
test('all group types work at different scales and relief without a biome dependency', () => {
  for (const type of Object.keys(LANDFORM_RECIPES)) {
    const weights = Object.fromEntries(Object.keys(LANDFORM_RECIPES).map(k => [k, k === type ? 1 : 0]));
    const a = createFormationField(91, R, profile, 'varied', { weights, spacing: 80 });
    const b = createFormationField(91, R, { ...profile, snow: 0, ocean: 1 }, 'varied', { weights, spacing: 80 });
    const large = createFormationField(91, R, profile, 'varied', { weights, spacing: 160 });
    assert.ok(a.modules.every(m => m.type === type)); assert.ok(a.modules.length > large.modules.length * 3);
    for (const d of directions(300)) assert.equal(a.height(...d), b.height(...d), 'climate cannot reshape a formation');
  }
});
test('shared valley joins stay at the floor and all relief fits its picking shell', () => {
  let floor = 0, high = 0;
  for (const p of directions(8000)) {
    const s = field.inspect(...p);
    assert.ok(Number.isFinite(s.relief) && s.relief > -formationDepthLimit(profile) && s.relief < formationHeightLimit(profile));
    if(s.relief<0)assert.ok(['crevice','gorge'].includes(s.type),'only authored incisions descend below the enclosing floor');
    if (s.edge <= s.valley) { floor++; assert.equal(s.relief, 0); }
    if (s.relief > 85) high++;
  }
  assert.ok(floor > 1000, 'connected borders retain a substantial floor area');
  assert.ok(high > 20, 'tall mountains are retained');
});

test('mountain spines bridge internal cell borders continuously above the floor', () => {
  const {chains, modules} = field.manifest();
  assert.ok(chains.length > 3);
  let seamCrossings = 0;
  for (const chain of chains) {
    // Short open chains leave valleys around their perimeter, rather than
    // closing a ring of mountains around a trapped floor pocket.
    assert.ok(chain.members.length <= 3);
    assert.equal(chain.links.length, chain.members.length - 1);
    for (const [a, b] of chain.links) {
      const at = t => {
        const d = modules[a].dir.map((v, k) => v * (1 - t) + modules[b].dir[k] * t), length = Math.hypot(...d);
        return field.inspect(...d.map(v => v / length));
      };
      let prev = at(.1);
      for (let step = 101; step <= 900; step++) {
        const next = at(step / 1000);
        assert.ok(next.relief > 12, 'a range spine cannot fall into a valley at a member boundary');
        assert.ok(Math.abs(next.relief - prev.relief) < 3, 'a member switch cannot create a height seam');
        if (next.id !== prev.id) seamCrossings++;
        prev = next;
      }
    }
  }
  assert.ok(seamCrossings >= chains.length, 'the probe crosses actual ownership boundaries');
});
test('bad authoring parameters fail explicitly rather than silently breaking generation', () => {
  for (const input of [{ spacing: 0 }, { spacing: Infinity }, { valley: 0 }, { typo: 1 }, { weights: { mountainn: 1 } }, { weights: { range: -1 } }]) assert.throws(() => landformSettings('varied', input));
  assert.throws(() => landformSettings('missing'));
  assert.throws(() => createFormationField(NaN, R, profile));
  assert.throws(() => createFormationField(1, R, { range: Infinity, canyon: 2 }));
  assert.throws(() => landformSettings('varied', { weights: Object.fromEntries(Object.keys(LANDFORM_RECIPES).map(k => [k, 0])) }));
});
test('authored anchors and exclusions are replayable without consuming the shared random stream', () => {
  const base = createFormationField(42, R, profile);
  const edited = createFormationField(42, R, profile, 'varied', { groups: [{ id: 0, disabled: true }, { id: 1, type: 'canyon', height: 63, size: 1.25 }] });
  assert.deepEqual(base.modules.slice(2), edited.modules.slice(2));
  assert.equal(edited.modules[0].height, 0); assert.equal(edited.modules[1].height, 63); assert.equal(edited.modules[1].type, 'canyon');
  assert.equal(edited.modules[1].size, 1.25);
  const pinned = createFormationField(42, R, profile, 'varied', {groups:[{id:1,type:'range',height:2,size:.6}]});
  assert.ok(pinned.manifest().chains.every(c=>!c.members.includes(1)), 'explicit heights and sizes are not enlarged by an automatic chain');
  assert.throws(() => createFormationField(42, R, profile, 'varied', { groups: [{ id: 0, dir: base.modules[1].dir }] }), /overlap/);
  for (const groups of [[{ id: 9999 }], [{ id: 1 }, { id: 1 }], [{ id: 1, dir: [NaN, 1, 0] }], [{ id: 1, height: -2 }], [{ id: 1, unknown: 1 }]]) assert.throws(() => createFormationField(42, R, profile, 'varied', { groups }));
});
