> **HISTORICAL RECORD.** This file records what was intended when it was
> written. It was not maintained afterwards and several details have since
> changed in the code. Treat it as background on the reasoning, not as a
> description of the current game. For that see [README](../../../README.md),
> [CLAUDE.md](../../../CLAUDE.md) and
> [docs/ARCHITECTURE.md](../../ARCHITECTURE.md).

# 99 Planets — Core Implementation Plan (Phase 1a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, engine-free simulation core for the 99 Planets roguelite mode, with a headless deterministic test suite.

**Architecture:** Seven small modules under `js/run/`, each with one responsibility. They import nothing — no `three`, no DOM, no `window`, no storage. `dt` and randomness are injected. State is plain serialisable data. The core emits events; it never calls a renderer. This is the portability contract from the spec, and it is what lets the same logic be transliterated to Luau in phase 2.

**Tech Stack:** Plain ES modules (`.js`), no build step, no dependencies. Tests use Node 24's built-in `node:test` and `node:assert`. Node 24 auto-detects ESM in `.js` files, so no `package.json` is required — this was verified before writing this plan.

**Scope:** This plan covers ONLY the core and its tests. Nothing in it touches Three.js, the DOM, or any existing WORLDHEART file. Wiring the core into the game is plan 1b.

---

## Reference

Spec: `docs/superpowers/specs/2026-09-03-99-planets-design.md`

Numbers this plan implements, taken from that spec:

- 15 waves total; wave 15 is the boss.
- Frontier θ: 0.12 rad before wave 1, reaching 0.52 rad after wave 14 clears. Ease-out. Fourteen expansions; the boss wave adds none.
- Tower unlocks on cleared waves 2, 4, 6, 8.
- Tier cap rises to 2 on cleared wave 10, to 3 on cleared wave 12. Starts at 1.
- Enemy evolution tier increments on cleared waves 3, 6, 9, 12.
- Draft of 1-of-3 after each cleared wave 1–14.
- Co-op (phase 2, built now because the data model must not change later): gold is per-player, the draft is shared and voted, 10-second timer, resolves early once all have voted, plurality wins, ties and the zero-vote case break on the seeded RNG.

## File structure

| File | Responsibility |
| --- | --- |
| `js/run/rng.js` | Seeded deterministic RNG and selection helpers |
| `js/run/schedule.js` | Pure wave→beat functions: frontier θ, unlocks, tier cap, evolution, boss |
| `js/run/modifiers.js` | The modifier object: base shape and folding a power list into it |
| `js/run/powers.js` | The power catalog, rarity weights, and drafting three distinct offers |
| `js/run/draft.js` | Shared draft voting: votes, 10s timer, early resolve, plurality, RNG tiebreak |
| `js/run/state.js` | Plain run state, creation, and serialise/deserialise |
| `js/run/run.js` | The run state machine that composes the above and emits events |
| `tests/run/*.test.mjs` | One test file per module |

Each module is small and depends only on modules above it in that table. No cycles.

---

### Task 1: Seeded RNG

**Files:**
- Create: `js/run/rng.js`
- Test: `tests/run/rng.test.mjs`

- [x] **Step 1: Write the failing test**

Create `tests/run/rng.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, pick, weightedPick } from '../../js/run/rng.js';

test('same seed produces the same sequence', () => {
  const a = makeRng(1234);
  const b = makeRng(1234);
  const seqA = [a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test('different seeds diverge', () => {
  const a = makeRng(1);
  const b = makeRng(2);
  assert.notEqual(a(), b());
});

test('values stay in [0, 1)', () => {
  const r = makeRng(99);
  for (let i = 0; i < 500; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('pick returns a member of the list and is deterministic', () => {
  const list = ['a', 'b', 'c', 'd'];
  assert.equal(pick(makeRng(7), list), pick(makeRng(7), list));
  assert.ok(list.includes(pick(makeRng(7), list)));
});

test('pick on a single-item list returns that item', () => {
  assert.equal(pick(makeRng(3), ['only']), 'only');
});

test('weightedPick respects weight zero', () => {
  const items = [{ v: 'never', w: 0 }, { v: 'always', w: 10 }];
  const r = makeRng(5);
  for (let i = 0; i < 100; i++) {
    assert.equal(weightedPick(r, items, (i2) => i2.w).v, 'always');
  }
});

test('weightedPick favours the heavier item', () => {
  const items = [{ v: 'rare', w: 1 }, { v: 'common', w: 99 }];
  const r = makeRng(11);
  let common = 0;
  for (let i = 0; i < 1000; i++) {
    if (weightedPick(r, items, (i2) => i2.w).v === 'common') common++;
  }
  assert.ok(common > 900, `expected >900 common, got ${common}`);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test "tests/run/rng.test.mjs"`
Expected: FAIL — `Cannot find module` for `js/run/rng.js`.

- [ ] **Step 3: Write the implementation**

Create `js/run/rng.js`:

```js
// Deterministic seeded randomness for the run core.
//
// The core never calls Math.random(). Every random decision flows through a
// seeded generator passed in by the caller, so a run replays identically from
// its seed. That is what makes the core testable headlessly, lets a seed be
// shared, and lets a draft tiebreak resolve the same way for every player in
// co-op without anyone having to agree over the network.

// mulberry32: small, fast, and good enough for gameplay. Not cryptographic.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// Weight zero must never be selected, so the scan compares strictly.
export function weightedPick(rng, list, weightOf) {
  let total = 0;
  for (const item of list) total += weightOf(item);
  if (total <= 0) return list[0];
  let roll = rng() * total;
  for (const item of list) {
    roll -= weightOf(item);
    if (roll < 0) return item;
  }
  return list[list.length - 1];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test "tests/run/rng.test.mjs"`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add js/run/rng.js tests/run/rng.test.mjs
git commit -m "99 Planets: seeded RNG for the run core"
```

---

### Task 2: Wave schedule

**Files:**
- Create: `js/run/schedule.js`
- Test: `tests/run/schedule.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/run/schedule.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOTAL_WAVES, BOSS_WAVE, THETA_START, THETA_END,
  frontierTheta, unlocksTowerAt, tierCapAfter, evolutionTierAfter, isBossWave,
} from '../../js/run/schedule.js';

test('the run is 15 waves and the boss is the last', () => {
  assert.equal(TOTAL_WAVES, 15);
  assert.equal(BOSS_WAVE, 15);
  assert.ok(isBossWave(15));
  assert.ok(!isBossWave(14));
});

test('frontier starts at THETA_START before any wave clears', () => {
  assert.equal(frontierTheta(0), THETA_START);
});

test('frontier reaches THETA_END after wave 14 clears', () => {
  assert.ok(Math.abs(frontierTheta(14) - THETA_END) < 1e-9);
});

test('frontier never shrinks and never exceeds the end', () => {
  let prev = -Infinity;
  for (let cleared = 0; cleared <= 15; cleared++) {
    const t = frontierTheta(cleared);
    assert.ok(t >= prev, `shrank at ${cleared}`);
    assert.ok(t <= THETA_END + 1e-9, `overshot at ${cleared}`);
    prev = t;
  }
});

test('the boss wave adds no expansion', () => {
  assert.equal(frontierTheta(15), frontierTheta(14));
});

test('expansion eases out: the first step is larger than the last', () => {
  const first = frontierTheta(1) - frontierTheta(0);
  const last = frontierTheta(14) - frontierTheta(13);
  assert.ok(first > last, `first ${first} should exceed last ${last}`);
});

test('towers unlock on waves 2, 4, 6, 8 only', () => {
  const unlockWaves = [];
  for (let w = 1; w <= 15; w++) if (unlocksTowerAt(w)) unlockWaves.push(w);
  assert.deepEqual(unlockWaves, [2, 4, 6, 8]);
});

test('tier cap starts at 1, becomes 2 after wave 10 and 3 after wave 12', () => {
  assert.equal(tierCapAfter(0), 1);
  assert.equal(tierCapAfter(9), 1);
  assert.equal(tierCapAfter(10), 2);
  assert.equal(tierCapAfter(11), 2);
  assert.equal(tierCapAfter(12), 3);
  assert.equal(tierCapAfter(15), 3);
});

test('evolution tier increments on waves 3, 6, 9, 12', () => {
  assert.equal(evolutionTierAfter(0), 0);
  assert.equal(evolutionTierAfter(2), 0);
  assert.equal(evolutionTierAfter(3), 1);
  assert.equal(evolutionTierAfter(5), 1);
  assert.equal(evolutionTierAfter(6), 2);
  assert.equal(evolutionTierAfter(9), 3);
  assert.equal(evolutionTierAfter(12), 4);
  assert.equal(evolutionTierAfter(15), 4);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test "tests/run/schedule.test.mjs"`
Expected: FAIL — `Cannot find module` for `js/run/schedule.js`.

- [ ] **Step 3: Write the implementation**

Create `js/run/schedule.js`:

```js
// When each run beat happens. Pure functions of the number of waves cleared,
// with no state of their own, so the shell and the tests agree by construction
// and any of it can be queried out of order.

export const TOTAL_WAVES = 15;
export const BOSS_WAVE = 15;

// Frontier angle in radians. This is the half-angle of the spherical cap the
// player owns; the shell turns it into a confine, a wall and a haze.
export const THETA_START = 0.12;
export const THETA_END = 0.52;

// Fourteen expansions: after waves 1..14. Clearing the boss grants none,
// because the planet itself is that reward.
const EXPANSIONS = 14;

const TOWER_UNLOCK_WAVES = [2, 4, 6, 8];
const TIER_CAP_WAVES = [10, 12];
const EVOLUTION_WAVES = [3, 6, 9, 12];

export function isBossWave(wave) {
  return wave === BOSS_WAVE;
}

// Ease-out so the early expansions read as dramatic and the late ones as
// incremental. A linear ramp made every wave feel the same.
export function frontierTheta(wavesCleared) {
  const steps = Math.max(0, Math.min(wavesCleared, EXPANSIONS));
  const t = steps / EXPANSIONS;
  const eased = 1 - (1 - t) * (1 - t);
  return THETA_START + eased * (THETA_END - THETA_START);
}

export function unlocksTowerAt(wave) {
  return TOWER_UNLOCK_WAVES.includes(wave);
}

export function tierCapAfter(wavesCleared) {
  let cap = 1;
  for (const w of TIER_CAP_WAVES) if (wavesCleared >= w) cap++;
  return cap;
}

export function evolutionTierAfter(wavesCleared) {
  let tier = 0;
  for (const w of EVOLUTION_WAVES) if (wavesCleared >= w) tier++;
  return tier;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test "tests/run/schedule.test.mjs"`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add js/run/schedule.js tests/run/schedule.test.mjs
git commit -m "99 Planets: wave schedule for frontier, unlocks, tier cap and evolution"
```

---

### Task 3: Modifier object

**Files:**
- Create: `js/run/modifiers.js`
- Test: `tests/run/modifiers.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/run/modifiers.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseModifiers, foldModifiers } from '../../js/run/modifiers.js';

test('base modifiers are neutral', () => {
  const m = baseModifiers();
  assert.equal(m.dmgMul, 1);
  assert.equal(m.rateMul, 1);
  assert.equal(m.rangeMul, 1);
  assert.equal(m.goldMul, 1);
  assert.equal(m.costMul, 1);
  assert.equal(m.critAdd, 0);
  assert.equal(m.chainAdd, 0);
  assert.equal(m.livesAdd, 0);
  assert.equal(m.pierce, false);
});

test('base modifiers are a fresh object each call', () => {
  const a = baseModifiers();
  a.dmgMul = 99;
  assert.equal(baseModifiers().dmgMul, 1);
});

test('folding no powers leaves the base untouched', () => {
  assert.deepEqual(foldModifiers([]), baseModifiers());
});

test('a single numeric power applies its delta', () => {
  const m = foldModifiers([{ id: 'x', apply: (mm) => { mm.dmgMul += 0.12; } }]);
  assert.ok(Math.abs(m.dmgMul - 1.12) < 1e-9);
});

test('duplicate powers stack additively, not multiplicatively', () => {
  const p = { id: 'x', apply: (mm) => { mm.dmgMul += 0.12; } };
  const m = foldModifiers([p, p, p]);
  assert.ok(Math.abs(m.dmgMul - 1.36) < 1e-9, `got ${m.dmgMul}`);
});

test('boolean powers latch true', () => {
  const m = foldModifiers([{ id: 'p', apply: (mm) => { mm.pierce = true; } }]);
  assert.equal(m.pierce, true);
});

test('fold order does not change the result', () => {
  const a = { id: 'a', apply: (mm) => { mm.dmgMul += 0.2; } };
  const b = { id: 'b', apply: (mm) => { mm.rateMul += 0.1; } };
  assert.deepEqual(foldModifiers([a, b]), foldModifiers([b, a]));
});

test('cost multiplier is floored so towers can never be free', () => {
  const cheap = { id: 'c', apply: (mm) => { mm.costMul -= 0.5; } };
  const m = foldModifiers([cheap, cheap, cheap]);
  assert.ok(m.costMul >= 0.25, `costMul fell to ${m.costMul}`);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test "tests/run/modifiers.test.mjs"`
Expected: FAIL — `Cannot find module` for `js/run/modifiers.js`.

- [ ] **Step 3: Write the implementation**

Create `js/run/modifiers.js`:

```js
// The single object powers write to and everything else reads.
//
// Powers NEVER reach into towers, economy or enemies directly. Without that
// rule twenty powers need hooks in twenty call sites and each new power risks
// every system. Here a power is a function of one argument.
//
// Multipliers accumulate ADDITIVELY into a base of 1 (+0.12 three times gives
// 1.36, not 1.40). Multiplicative stacking across fifteen drafted powers is
// how roguelite balance explodes, and additive accumulation keeps the total
// legible and bounded.

export function baseModifiers() {
  return {
    // offense
    dmgMul: 1,
    rateMul: 1,
    rangeMul: 1,
    critAdd: 0,
    chainAdd: 0,
    // economy
    goldMul: 1,
    costMul: 1,
    interestPct: 0,
    refundPct: 0.7,
    // defense
    livesAdd: 0,
    heartRegen: 0,
    slowAura: 0,
    // build-defining switches
    pierce: false,
    burnGround: false,
    hardFreeze: false,
    everyFifthDouble: false,
  };
}

// A tower must never become free, however the draft goes.
const MIN_COST_MUL = 0.25;

export function foldModifiers(powers) {
  const m = baseModifiers();
  for (const p of powers) p.apply(m);
  if (m.costMul < MIN_COST_MUL) m.costMul = MIN_COST_MUL;
  return m;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test "tests/run/modifiers.test.mjs"`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add js/run/modifiers.js tests/run/modifiers.test.mjs
git commit -m "99 Planets: modifier object with additive stacking and a cost floor"
```

---

### Task 4: Power catalog

**Files:**
- Create: `js/run/powers.js`
- Test: `tests/run/powers.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/run/powers.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../js/run/rng.js';
import { foldModifiers } from '../../js/run/modifiers.js';
import { POWERS, POWER_BY_ID, RARITY_WEIGHT, rollOffers } from '../../js/run/powers.js';

test('the catalog has twenty powers with unique ids', () => {
  assert.equal(POWERS.length, 20);
  assert.equal(new Set(POWERS.map((p) => p.id)).size, 20);
});

test('every power has a name, description, known rarity and an apply function', () => {
  for (const p of POWERS) {
    assert.ok(p.name && p.name.length > 0, `${p.id} missing name`);
    assert.ok(p.desc && p.desc.length > 0, `${p.id} missing desc`);
    assert.ok(RARITY_WEIGHT[p.rarity] > 0, `${p.id} bad rarity ${p.rarity}`);
    assert.equal(typeof p.apply, 'function', `${p.id} missing apply`);
  }
});

test('every power actually changes the modifiers', () => {
  const base = JSON.stringify(foldModifiers([]));
  for (const p of POWERS) {
    assert.notEqual(JSON.stringify(foldModifiers([p])), base, `${p.id} is a no-op`);
  }
});

test('POWER_BY_ID resolves every catalog entry', () => {
  for (const p of POWERS) assert.equal(POWER_BY_ID[p.id], p);
});

test('rollOffers returns three distinct powers', () => {
  const offers = rollOffers(makeRng(1), []);
  assert.equal(offers.length, 3);
  assert.equal(new Set(offers.map((o) => o.id)).size, 3);
});

test('rollOffers is deterministic for a seed', () => {
  const a = rollOffers(makeRng(42), []).map((o) => o.id);
  const b = rollOffers(makeRng(42), []).map((o) => o.id);
  assert.deepEqual(a, b);
});

test('rollOffers never offers an already-maxed unique power', () => {
  const unique = POWERS.filter((p) => p.unique).map((p) => p.id);
  const offers = rollOffers(makeRng(3), unique);
  for (const o of offers) assert.ok(!unique.includes(o.id), `${o.id} re-offered`);
});

test('rollOffers still returns three when most of the pool is excluded', () => {
  const owned = POWERS.slice(0, 17).filter((p) => p.unique).map((p) => p.id);
  const offers = rollOffers(makeRng(9), owned);
  assert.equal(offers.length, 3);
});

test('common powers are offered more often than rare ones', () => {
  let common = 0, rare = 0;
  for (let s = 0; s < 400; s++) {
    for (const o of rollOffers(makeRng(s), [])) {
      if (o.rarity === 'common') common++;
      if (o.rarity === 'rare') rare++;
    }
  }
  assert.ok(common > rare * 2, `common ${common} vs rare ${rare}`);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test "tests/run/powers.test.mjs"`
Expected: FAIL — `Cannot find module` for `js/run/powers.js`.

- [ ] **Step 3: Write the implementation**

Create `js/run/powers.js`:

```js
// The draftable power catalog.
//
// Mostly numeric so powers compose predictably, with four switches that give a
// run its identity. Rarity only weights how often something is OFFERED; it does
// not gate anything.

import { weightedPick } from './rng.js';

export const RARITY_WEIGHT = { common: 100, uncommon: 45, rare: 14 };

// `unique: true` means the power does nothing a second time (it latches a
// switch), so it is withdrawn from the pool once owned. Numeric powers stay in
// the pool and stack.
export const POWERS = [
  // ---- common ----
  { id: 'keen-rails', name: 'Keen Rails', rarity: 'common', desc: 'Towers deal 12% more damage.', apply: (m) => { m.dmgMul += 0.12; } },
  { id: 'overclock', name: 'Overclock', rarity: 'common', desc: 'Towers fire 10% faster.', apply: (m) => { m.rateMul += 0.10; } },
  { id: 'long-lens', name: 'Long Lens', rarity: 'common', desc: 'Towers reach 8% further.', apply: (m) => { m.rangeMul += 0.08; } },
  { id: 'bounty', name: 'Bounty', rarity: 'common', desc: 'Kills pay 15% more gold.', apply: (m) => { m.goldMul += 0.15; } },
  { id: 'thrift', name: 'Thrift', rarity: 'common', desc: 'Towers cost 10% less.', apply: (m) => { m.costMul -= 0.10; } },
  { id: 'hardened-heart', name: 'Hardened Heart', rarity: 'common', desc: 'The worldheart holds 2 more lives.', apply: (m) => { m.livesAdd += 2; } },
  { id: 'sharp-edge', name: 'Sharp Edge', rarity: 'common', desc: '+5% critical chance.', apply: (m) => { m.critAdd += 0.05; } },
  { id: 'salvage', name: 'Salvage', rarity: 'common', desc: 'Selling refunds 20% more.', apply: (m) => { m.refundPct += 0.20; } },

  // ---- uncommon ----
  { id: 'twin-rails', name: 'Twin Rails', rarity: 'uncommon', desc: 'Towers deal 20% more damage.', apply: (m) => { m.dmgMul += 0.20; } },
  { id: 'flywheel', name: 'Flywheel', rarity: 'uncommon', desc: 'Towers fire 18% faster.', apply: (m) => { m.rateMul += 0.18; } },
  { id: 'far-sight', name: 'Far Sight', rarity: 'uncommon', desc: 'Towers reach 15% further.', apply: (m) => { m.rangeMul += 0.15; } },
  { id: 'compound-interest', name: 'Compound Interest', rarity: 'uncommon', desc: 'Earn 3% interest on gold each wave.', apply: (m) => { m.interestPct += 0.03; } },
  { id: 'mending', name: 'Mending', rarity: 'uncommon', desc: 'The worldheart recovers 1 life per wave.', apply: (m) => { m.heartRegen += 1; } },
  { id: 'cryo-field', name: 'Cryo Field', rarity: 'uncommon', desc: 'Enemies near the heart are slowed 10%.', apply: (m) => { m.slowAura += 0.10; } },
  { id: 'deep-crit', name: 'Deep Crit', rarity: 'uncommon', desc: '+10% critical chance.', apply: (m) => { m.critAdd += 0.10; } },
  { id: 'chain-coil', name: 'Chain Coil', rarity: 'uncommon', desc: 'Shots arc to 1 extra target.', apply: (m) => { m.chainAdd += 1; } },

  // ---- rare ----
  { id: 'pierce-rounds', name: 'Pierce Rounds', rarity: 'rare', unique: true, desc: 'Shots pass through their target.', apply: (m) => { m.pierce = true; } },
  { id: 'scorched-earth', name: 'Scorched Earth', rarity: 'rare', unique: true, desc: 'Mortar leaves burning ground.', apply: (m) => { m.burnGround = true; } },
  { id: 'deep-freeze', name: 'Deep Freeze', rarity: 'rare', unique: true, desc: 'Cryo halts enemies outright.', apply: (m) => { m.hardFreeze = true; } },
  { id: 'fifth-volley', name: 'Fifth Volley', rarity: 'rare', unique: true, desc: 'Every fifth shot deals double.', apply: (m) => { m.everyFifthDouble = true; } },
];

export const POWER_BY_ID = Object.fromEntries(POWERS.map((p) => [p.id, p]));

// Three distinct offers. A unique power already owned is withdrawn, because
// offering a switch that is already on is a dead choice.
export function rollOffers(rng, ownedIds) {
  const owned = new Set(ownedIds);
  const pool = POWERS.filter((p) => !(p.unique && owned.has(p.id)));
  const offers = [];
  const taken = new Set();
  while (offers.length < 3 && taken.size < pool.length) {
    const candidates = pool.filter((p) => !taken.has(p.id));
    const chosen = weightedPick(rng, candidates, (p) => RARITY_WEIGHT[p.rarity]);
    taken.add(chosen.id);
    offers.push(chosen);
  }
  return offers;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test "tests/run/powers.test.mjs"`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add js/run/powers.js tests/run/powers.test.mjs
git commit -m "99 Planets: twenty-power catalog with rarity-weighted drafting"
```

---

### Task 5: Shared draft voting

**Files:**
- Create: `js/run/draft.js`
- Test: `tests/run/draft.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/run/draft.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../js/run/rng.js';
import { openDraft, castVote, tickDraft, DRAFT_SECONDS } from '../../js/run/draft.js';

const OFFERS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test('a fresh draft is unresolved and holds the full timer', () => {
  const d = openDraft(OFFERS, ['p1']);
  assert.equal(d.resolved, false);
  assert.equal(d.remaining, DRAFT_SECONDS);
  assert.equal(DRAFT_SECONDS, 10);
});

test('a solo draft resolves immediately once the only player votes', () => {
  const d = openDraft(OFFERS, ['p1']);
  castVote(d, 'p1', 2);
  const ev = tickDraft(d, 0, makeRng(1));
  assert.equal(d.resolved, true);
  assert.equal(ev.winnerIndex, 2);
  assert.equal(ev.reason, 'unanimous');
});

test('it does not resolve while a player has not voted', () => {
  const d = openDraft(OFFERS, ['p1', 'p2']);
  castVote(d, 'p1', 0);
  assert.equal(tickDraft(d, 1, makeRng(1)), null);
  assert.equal(d.resolved, false);
});

test('it resolves early once every player has voted', () => {
  const d = openDraft(OFFERS, ['p1', 'p2']);
  castVote(d, 'p1', 1);
  castVote(d, 'p2', 1);
  const ev = tickDraft(d, 0, makeRng(1));
  assert.equal(ev.winnerIndex, 1);
  assert.ok(d.remaining > 0, 'should not have waited out the clock');
});

test('plurality wins', () => {
  const d = openDraft(OFFERS, ['p1', 'p2', 'p3']);
  castVote(d, 'p1', 0);
  castVote(d, 'p2', 2);
  castVote(d, 'p3', 2);
  assert.equal(tickDraft(d, 0, makeRng(1)).winnerIndex, 2);
});

test('a player may change their vote before resolution', () => {
  const d = openDraft(OFFERS, ['p1', 'p2']);
  castVote(d, 'p1', 0);
  castVote(d, 'p1', 2);
  castVote(d, 'p2', 2);
  assert.equal(tickDraft(d, 0, makeRng(1)).winnerIndex, 2);
});

test('an unknown player cannot vote', () => {
  const d = openDraft(OFFERS, ['p1']);
  assert.equal(castVote(d, 'intruder', 0), false);
  assert.equal(tickDraft(d, 0, makeRng(1)), null);
});

test('an out-of-range option is rejected', () => {
  const d = openDraft(OFFERS, ['p1']);
  assert.equal(castVote(d, 'p1', 7), false);
  assert.equal(castVote(d, 'p1', -1), false);
  assert.equal(d.resolved, false);
});

test('the timer expiring resolves the draft', () => {
  const d = openDraft(OFFERS, ['p1', 'p2']);
  castVote(d, 'p1', 1);
  const ev = tickDraft(d, DRAFT_SECONDS + 0.1, makeRng(1));
  assert.equal(d.resolved, true);
  assert.equal(ev.winnerIndex, 1);
  assert.equal(ev.reason, 'timeout');
});

test('nobody voting still yields a winner on timeout', () => {
  const d = openDraft(OFFERS, ['p1', 'p2']);
  const ev = tickDraft(d, DRAFT_SECONDS, makeRng(5));
  assert.equal(d.resolved, true);
  assert.ok(ev.winnerIndex >= 0 && ev.winnerIndex < 3);
  assert.equal(ev.reason, 'timeout');
});

test('a tie breaks on the seeded rng, identically for the same seed', () => {
  const run = () => {
    const d = openDraft(OFFERS, ['p1', 'p2']);
    castVote(d, 'p1', 0);
    castVote(d, 'p2', 1);
    return tickDraft(d, 0, makeRng(77)).winnerIndex;
  };
  const first = run();
  assert.equal(run(), first);
  assert.ok(first === 0 || first === 1, 'tiebreak must pick a tied option');
});

test('resolving twice does not change the outcome', () => {
  const d = openDraft(OFFERS, ['p1']);
  castVote(d, 'p1', 1);
  const a = tickDraft(d, 0, makeRng(1));
  assert.equal(tickDraft(d, 5, makeRng(2)), null);
  assert.equal(a.winnerIndex, 1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test "tests/run/draft.test.mjs"`
Expected: FAIL — `Cannot find module` for `js/run/draft.js`.

- [ ] **Step 3: Write the implementation**

Create `js/run/draft.js`:

```js
// The shared power draft.
//
// One power per wave for the whole team. Every player sees the same three
// offers and casts one vote. It resolves the moment everyone has voted, or
// when the timer runs out, whichever comes first.
//
// The timer is driven by injected dt rather than a clock, so this is testable
// headlessly and behaves identically on a server tick or a render frame.
//
// Ties break on the run's seeded RNG rather than host preference or arrival
// order, so a run still replays identically and every client can compute the
// same winner without a negotiation round trip.

export const DRAFT_SECONDS = 10;

export function openDraft(offers, playerIds) {
  return {
    offers,
    playerIds: [...playerIds],
    votes: {},
    remaining: DRAFT_SECONDS,
    resolved: false,
    winnerIndex: -1,
  };
}

export function castVote(draft, playerId, optionIndex) {
  if (draft.resolved) return false;
  if (!draft.playerIds.includes(playerId)) return false;
  if (!Number.isInteger(optionIndex)) return false;
  if (optionIndex < 0 || optionIndex >= draft.offers.length) return false;
  draft.votes[playerId] = optionIndex;
  return true;
}

function tally(draft) {
  const counts = new Array(draft.offers.length).fill(0);
  for (const id of draft.playerIds) {
    const v = draft.votes[id];
    if (Number.isInteger(v)) counts[v]++;
  }
  return counts;
}

// Returns the leaders. With no votes at all every option leads, which is what
// makes the all-absent case fall through to the same RNG tiebreak.
function leaders(counts) {
  const best = Math.max(...counts);
  const out = [];
  for (let i = 0; i < counts.length; i++) if (counts[i] === best) out.push(i);
  return out;
}

function resolve(draft, rng, reason) {
  const tied = leaders(tally(draft));
  const winnerIndex = tied.length === 1
    ? tied[0]
    : tied[Math.floor(rng() * tied.length)];
  draft.resolved = true;
  draft.winnerIndex = winnerIndex;
  return { winnerIndex, winner: draft.offers[winnerIndex], reason };
}

// Returns the resolution event, or null while the draft is still open. Calling
// it again after resolution returns null rather than re-resolving.
export function tickDraft(draft, dt, rng) {
  if (draft.resolved) return null;

  const everyoneVoted = draft.playerIds.every((id) => Number.isInteger(draft.votes[id]));
  if (everyoneVoted) return resolve(draft, rng, 'unanimous');

  draft.remaining -= dt;
  if (draft.remaining <= 0) {
    draft.remaining = 0;
    return resolve(draft, rng, 'timeout');
  }
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test "tests/run/draft.test.mjs"`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add js/run/draft.js tests/run/draft.test.mjs
git commit -m "99 Planets: shared draft voting with early resolve and seeded tiebreak"
```

---

### Task 6: Run state

**Files:**
- Create: `js/run/state.js`
- Test: `tests/run/state.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/run/state.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunState, serialise, deserialise, STARTING_TOWER } from '../../js/run/state.js';

test('a new run starts before wave 1 with only the starting tower', () => {
  const s = createRunState({ seed: 5, playerIds: ['p1'] });
  assert.equal(s.wavesCleared, 0);
  assert.equal(s.phase, 'building');
  assert.deepEqual(s.unlockedTowers, [STARTING_TOWER]);
  assert.equal(STARTING_TOWER, 'bolt');
  assert.deepEqual(s.powers, []);
});

test('players are always a list, even solo', () => {
  const s = createRunState({ seed: 1, playerIds: ['p1'] });
  assert.ok(Array.isArray(s.players));
  assert.equal(s.players.length, 1);
  assert.equal(s.players[0].id, 'p1');
});

test('gold is per player', () => {
  const s = createRunState({ seed: 1, playerIds: ['p1', 'p2'], startGold: 300 });
  assert.equal(s.players[0].gold, 300);
  assert.equal(s.players[1].gold, 300);
  s.players[0].gold += 50;
  assert.equal(s.players[1].gold, 300);
});

test('powers belong to the run, not to a player', () => {
  const s = createRunState({ seed: 1, playerIds: ['p1', 'p2'] });
  assert.ok(Array.isArray(s.powers));
  assert.equal(s.players[0].powers, undefined);
});

test('state survives a serialise and deserialise round trip', () => {
  const s = createRunState({ seed: 9, playerIds: ['p1', 'p2'] });
  s.wavesCleared = 4;
  s.powers.push('keen-rails');
  s.unlockedTowers.push('cryo');
  s.players[1].gold = 777;
  const back = deserialise(serialise(s));
  assert.deepEqual(back, s);
});

test('serialise produces a plain JSON string with no functions', () => {
  const s = createRunState({ seed: 2, playerIds: ['p1'] });
  const text = serialise(s);
  assert.equal(typeof text, 'string');
  assert.doesNotThrow(() => JSON.parse(text));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test "tests/run/state.test.mjs"`
Expected: FAIL — `Cannot find module` for `js/run/state.js`.

- [ ] **Step 3: Write the implementation**

Create `js/run/state.js`:

```js
// Run state as plain, serialisable data.
//
// No class instances, no renderer handles, no Vector3. Everything here must
// survive JSON.stringify and come back identical, because phase 2 sends this
// over the wire and stores it in a DataStore.
//
// Two ownership rules from the spec, and they differ on purpose:
//   - GOLD is per player.
//   - POWERS belong to the run, because the draft is shared and yields one
//     power for the whole team.

export const STARTING_TOWER = 'bolt';
export const DEFAULT_START_GOLD = 450;

export function createRunState({ seed, playerIds, startGold = DEFAULT_START_GOLD }) {
  return {
    seed,
    wavesCleared: 0,
    phase: 'building',
    players: playerIds.map((id) => ({ id, gold: startGold })),
    powers: [],
    unlockedTowers: [STARTING_TOWER],
    lives: 20,
  };
}

export function serialise(state) {
  return JSON.stringify(state);
}

export function deserialise(text) {
  return JSON.parse(text);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test "tests/run/state.test.mjs"`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add js/run/state.js tests/run/state.test.mjs
git commit -m "99 Planets: plain serialisable run state, per-player gold, run-level powers"
```

---

### Task 7: Run state machine

**Files:**
- Create: `js/run/run.js`
- Test: `tests/run/run.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/run/run.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../../js/run/run.js';
import { THETA_START, THETA_END } from '../../js/run/schedule.js';

function newRun(seed = 1, playerIds = ['p1']) {
  return createRun({ seed, playerIds });
}

// Clear a wave and immediately settle the draft by voting for option 0.
function clearWaveChoosingFirst(run) {
  const events = run.completeWave();
  const draft = run.getDraft();
  if (draft) {
    run.vote('p1', 0);
    return events.concat(run.tick(0));
  }
  return events;
}

test('a new run opens at the starting frontier with one tower', () => {
  const run = newRun();
  assert.equal(run.getFrontierTheta(), THETA_START);
  assert.deepEqual(run.getUnlockedTowers(), ['bolt']);
  assert.equal(run.getTierCap(), 1);
  assert.equal(run.getEvolutionTier(), 0);
  assert.equal(run.getWave(), 1);
});

test('clearing a wave opens a draft of three', () => {
  const run = newRun();
  run.completeWave();
  const draft = run.getDraft();
  assert.ok(draft, 'expected a draft');
  assert.equal(draft.offers.length, 3);
});

test('a wave does not advance until its draft resolves', () => {
  const run = newRun();
  run.completeWave();
  assert.equal(run.getWave(), 1, 'wave should hold while drafting');
  run.vote('p1', 0);
  run.tick(0);
  assert.equal(run.getWave(), 2);
});

test('the drafted power is added to the run and reaches the modifiers', () => {
  const run = newRun();
  const before = JSON.stringify(run.getModifiers());
  run.completeWave();
  const chosen = run.getDraft().offers[0];
  run.vote('p1', 0);
  run.tick(0);
  assert.ok(run.getPowers().includes(chosen.id), 'power not recorded');
  assert.notEqual(JSON.stringify(run.getModifiers()), before, 'modifiers unchanged');
});

test('the frontier grows every cleared wave', () => {
  const run = newRun();
  let prev = run.getFrontierTheta();
  for (let i = 0; i < 5; i++) {
    clearWaveChoosingFirst(run);
    const now = run.getFrontierTheta();
    assert.ok(now > prev, `frontier did not grow on wave ${i + 1}`);
    prev = now;
  }
});

test('towers unlock on waves 2, 4, 6 and 8', () => {
  const run = newRun();
  const counts = [];
  for (let w = 1; w <= 8; w++) {
    clearWaveChoosingFirst(run);
    counts.push(run.getUnlockedTowers().length);
  }
  assert.deepEqual(counts, [1, 2, 2, 3, 3, 4, 4, 5]);
});

test('all five towers are owned once wave 8 clears, with no duplicates', () => {
  const run = newRun();
  for (let w = 1; w <= 8; w++) clearWaveChoosingFirst(run);
  const owned = run.getUnlockedTowers();
  assert.equal(owned.length, 5);
  assert.equal(new Set(owned).size, 5);
});

test('the tier cap rises after waves 10 and 12', () => {
  const run = newRun();
  for (let w = 1; w <= 9; w++) clearWaveChoosingFirst(run);
  assert.equal(run.getTierCap(), 1);
  clearWaveChoosingFirst(run);
  assert.equal(run.getTierCap(), 2);
  clearWaveChoosingFirst(run);
  assert.equal(run.getTierCap(), 2);
  clearWaveChoosingFirst(run);
  assert.equal(run.getTierCap(), 3);
});

test('the evolution tier reaches 4 by wave 12', () => {
  const run = newRun();
  for (let w = 1; w <= 12; w++) clearWaveChoosingFirst(run);
  assert.equal(run.getEvolutionTier(), 4);
});

test('a full run reaches the boss and then victory', () => {
  const run = newRun();
  for (let w = 1; w <= 14; w++) clearWaveChoosingFirst(run);
  assert.equal(run.getWave(), 15);
  assert.ok(run.isBossWave());
  const events = run.completeWave();
  assert.equal(run.getPhase(), 'victory');
  assert.ok(events.some((e) => e.type === 'runWon'));
  assert.equal(run.getDraft(), null, 'the boss wave grants no draft');
  assert.ok(Math.abs(run.getFrontierTheta() - THETA_END) < 1e-9);
});

test('completeWave emits the beats the shell needs', () => {
  const run = newRun();
  const types = run.completeWave().map((e) => e.type);
  assert.ok(types.includes('waveCleared'));
  assert.ok(types.includes('frontierGrew'));
  assert.ok(types.includes('draftOpened'));
});

test('losing the run ends it', () => {
  const run = newRun();
  run.loseRun();
  assert.equal(run.getPhase(), 'defeat');
  assert.deepEqual(run.completeWave(), []);
});

test('the same seed replays identically', () => {
  const ids = (seed) => {
    const run = newRun(seed);
    for (let w = 1; w <= 6; w++) clearWaveChoosingFirst(run);
    return run.getPowers().join(',');
  };
  assert.equal(ids(2026), ids(2026));
});

test('different seeds give different power sequences', () => {
  const ids = (seed) => {
    const run = newRun(seed);
    for (let w = 1; w <= 8; w++) clearWaveChoosingFirst(run);
    return run.getPowers().join(',');
  };
  assert.notEqual(ids(1), ids(999));
});

test('run state serialises at any point', () => {
  const run = newRun();
  for (let w = 1; w <= 3; w++) clearWaveChoosingFirst(run);
  assert.doesNotThrow(() => JSON.parse(run.serialise()));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test "tests/run/run.test.mjs"`
Expected: FAIL — `Cannot find module` for `js/run/run.js`.

- [ ] **Step 3: Write the implementation**

Create `js/run/run.js`:

```js
// The run state machine.
//
// This is the only module that composes the others, and it is still pure: it
// imports nothing outside js/run/, touches no renderer, and takes its time in
// injected dt. It reports what happened by RETURNING events. The shell decides
// what a frontier or an unlock looks like; the run only decides that one
// happened.

import { makeRng, pick } from './rng.js';
import {
  TOTAL_WAVES, frontierTheta, unlocksTowerAt, tierCapAfter,
  evolutionTierAfter, isBossWave,
} from './schedule.js';
import { foldModifiers } from './modifiers.js';
import { POWER_BY_ID, rollOffers } from './powers.js';
import { openDraft, castVote, tickDraft } from './draft.js';
import { createRunState, serialise, STARTING_TOWER } from './state.js';

// Everything unlockable, minus the tower the run is granted at the start.
const UNLOCKABLE_TOWERS = ['cryo', 'mortar', 'tesla', 'helios'];

export function createRun({ seed, playerIds, startGold }) {
  const state = createRunState({ seed, playerIds, startGold });
  const rng = makeRng(seed);
  let draft = null;
  let modifiers = foldModifiers([]);

  function refreshModifiers() {
    modifiers = foldModifiers(state.powers.map((id) => POWER_BY_ID[id]));
  }

  function unlockRandomTower(events) {
    const remaining = UNLOCKABLE_TOWERS.filter((t) => !state.unlockedTowers.includes(t));
    if (remaining.length === 0) return;
    const tower = pick(rng, remaining);
    state.unlockedTowers.push(tower);
    events.push({ type: 'towerUnlocked', tower });
  }

  // Applied once the draft settles, which is also when the wave number moves.
  function advanceAfterDraft(events) {
    const cleared = state.wavesCleared;

    if (unlocksTowerAt(cleared)) unlockRandomTower(events);

    const cap = tierCapAfter(cleared);
    if (cap !== tierCapAfter(cleared - 1)) {
      events.push({ type: 'tierCapRaised', cap });
    }

    const evo = evolutionTierAfter(cleared);
    if (evo !== evolutionTierAfter(cleared - 1)) {
      events.push({ type: 'enemiesEvolved', tier: evo });
    }

    state.phase = 'building';
  }

  return {
    // ---- queries ----
    // While a draft is open the wave has been cleared but not left behind, so
    // the HUD must keep showing the wave just survived rather than jumping ahead.
    getWave: () => (state.phase === 'drafting'
      ? state.wavesCleared
      : Math.min(state.wavesCleared + 1, TOTAL_WAVES)),
    getPhase: () => state.phase,
    getFrontierTheta: () => frontierTheta(state.wavesCleared),
    getUnlockedTowers: () => [...state.unlockedTowers],
    getTierCap: () => tierCapAfter(state.wavesCleared),
    getEvolutionTier: () => evolutionTierAfter(state.wavesCleared),
    getPowers: () => [...state.powers],
    getModifiers: () => modifiers,
    getPlayers: () => state.players,
    getDraft: () => draft,
    isBossWave: () => isBossWave(Math.min(state.wavesCleared + 1, TOTAL_WAVES)),
    serialise: () => serialise(state),

    // ---- transitions ----

    // Called by the shell when the current wave has been survived.
    completeWave() {
      if (state.phase === 'defeat' || state.phase === 'victory') return [];

      const wave = Math.min(state.wavesCleared + 1, TOTAL_WAVES);
      const events = [];
      state.wavesCleared += 1;
      events.push({ type: 'waveCleared', wave });

      if (isBossWave(wave)) {
        state.phase = 'victory';
        events.push({ type: 'runWon', wave });
        return events;
      }

      events.push({ type: 'frontierGrew', theta: frontierTheta(state.wavesCleared) });

      draft = openDraft(rollOffers(rng, state.powers), state.players.map((p) => p.id));
      state.phase = 'drafting';
      events.push({ type: 'draftOpened', offers: draft.offers });
      return events;
    },

    vote(playerId, optionIndex) {
      if (!draft) return false;
      return castVote(draft, playerId, optionIndex);
    },

    // Drives the draft timer. dt is injected; the core never reads a clock.
    tick(dt) {
      if (!draft) return [];
      const result = tickDraft(draft, dt, rng);
      if (!result) return [];

      const events = [];
      state.powers.push(result.winner.id);
      refreshModifiers();
      events.push({
        type: 'powerTaken',
        power: result.winner,
        reason: result.reason,
      });
      draft = null;
      advanceAfterDraft(events);
      return events;
    },

    loseRun() {
      state.phase = 'defeat';
      draft = null;
    },
  };
}

export { STARTING_TOWER };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test "tests/run/run.test.mjs"`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add js/run/run.js tests/run/run.test.mjs
git commit -m "99 Planets: run state machine composing schedule, powers and draft"
```

---

### Task 8: Purity guard and full suite

This task makes the portability contract enforceable rather than aspirational. Without it the contract erodes the first time someone adds a convenient import.

**Files:**
- Create: `tests/run/purity.test.mjs`
- Create: `tools/test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/run/purity.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'js/run';

// Comments are stripped before scanning. The first version of this guard
// flagged rng.js because its comment says the core never calls Math.random,
// and a check that trips on prose is one people switch off.
function code(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const BANNED = [
  { pattern: /from\s+['"]three['"]/, why: 'imports three' },
  { pattern: /\bdocument\./, why: 'touches the DOM' },
  { pattern: /\bwindow\./, why: 'touches window' },
  { pattern: /\blocalStorage\b/, why: 'touches localStorage' },
  { pattern: /\bMath\.random\s*\(/, why: 'uses Math.random instead of the injected rng' },
  { pattern: /\bDate\.now\s*\(/, why: 'reads a clock instead of injected dt' },
  { pattern: /\bperformance\.now\s*\(/, why: 'reads a clock instead of injected dt' },
];

const files = readdirSync(DIR).filter((f) => f.endsWith('.js'));

test('the core has files to check', () => {
  assert.ok(files.length >= 7, `expected the seven core modules, saw ${files.length}`);
});

for (const file of files) {
  test(`${file} obeys the portability contract`, () => {
    const src = readFileSync(join(DIR, file), 'utf8');
    for (const { pattern, why } of BANNED) {
      assert.ok(!pattern.test(src), `js/run/${file} ${why}`);
    }
  });
}

test('the core only imports from within js/run', () => {
  for (const file of files) {
    const src = readFileSync(join(DIR, file), 'utf8');
    const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const spec of imports) {
      assert.ok(spec.startsWith('./'), `js/run/${file} imports "${spec}" from outside the core`);
    }
  }
});
```

- [ ] **Step 2: Run the test to verify it passes already**

Run: `node --test "tests/run/purity.test.mjs"`
Expected: PASS. This test is a guard, not a driver — it should pass against the code written in tasks 1–7. If it fails, a previous task violated the contract and that is the bug.

- [ ] **Step 3: Add a one-command test runner**

Create `tools/test.mjs`:

```js
// Runs the headless core suite. The core imports nothing, so it needs no
// browser and no build step.
//
// `node --test tests/` (the directory form) misbehaves on this setup, so the
// glob form is used deliberately. Do not "simplify" it back.
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  ['--test', 'tests/**/*.test.mjs'],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
```

- [ ] **Step 4: Run the whole suite**

Run: `node tools/test.mjs`
Expected: PASS. Totals across all eight files: 76 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add tests/run/purity.test.mjs tools/test.mjs
git commit -m "99 Planets: enforce the portability contract and add a one-command test runner"
```

---

## Definition of done

- [x] `node tools/test.mjs` passes with 76 tests and zero failures.
- [ ] `js/run/` contains exactly seven `.js` modules and imports nothing outside itself.
- [ ] A run seeded with a given number replays to an identical power sequence.
- [ ] Nothing in `js/` outside `js/run/` has been modified by this plan.
- [ ] `node tools/build.mjs` still succeeds, and `WH.camTest()` is untouched because no rendering code changed.

## What this plan deliberately does not do

No Three.js, no DOM, no camera confine, no wall, no fog, no shop changes, no enemy evolution behaviour, no boss fight. Those are plan 1b, which binds this core to the game. Keeping them apart is what lets every line above be tested without a browser.
