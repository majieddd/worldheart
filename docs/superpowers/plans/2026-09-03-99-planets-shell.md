# 99 Planets — Shell Implementation Plan (Phase 1b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the pure run core (built in plan 1a) into WORLDHEART so 99 Planets is playable end to end: a masked frontier that widens each wave, a shop that unlocks towers, drafted powers that measurably change combat, evolving enemies, and a boss.

**Architecture:** One new mode shell, `js/modes/ninetynine.js`, is the only file that knows both the pure core and Three.js. It consumes core events and drives the renderer. Existing files gain small, surgical hooks. **The nav graph and terrain are built ONCE at the final frontier angle; the frontier is a mask over them, never a rebuild.**

**Tech Stack:** Plain ES modules, no build step. Core tests run under `node:test`; integration is verified in a real browser via `WH.step` and `WH.camTest`.

---

## Reference

- Spec: `docs/superpowers/specs/2026-09-03-99-planets-design.md`
- Core (already built, 76 tests green): `js/run/`
- **Integration map — read this before starting:** `docs/superpowers/research/2026-09-03-99-planets-integration-map.md`

## The design change this plan encodes

The spec said the frontier grows each wave by reusing the battlefield-cap machinery. The integration map measured that machinery and found it cannot grow:

- `nav._buildGraph` (nav.js:229) reallocates every array and rebuilds its index map. There is no grow path.
- A rebuild destroys live state nothing re-derives: `nav.block` (every tower footprint, keyed by tower id from game.js:402), `heartNode`, and `portalNodes`.
- The outside-cap haze is baked into terrain vertex colours by `faceColor` (world.js:381) at mesh-build time, not a shader uniform.

**Therefore: build once at final θ, mask afterwards.**

| Concern | Approach |
| --- | --- |
| Nav graph | Built once at θ_end (0.52). Never rebuilt. |
| Terrain, decor, portals | Authored once at θ_end. |
| Buildable area | A per-placement angle test against the *current* θ. Cheap, no rebuild. |
| Active breaches | Portals outside current θ stay dormant. |
| The wall | Rebuilt per expansion — measured nearly free, since `SEG = 200` fixes every buffer size regardless of θ (world.js:1404). |
| The haze | A live shader uniform on a separate overlay, copying the cloud deck, which already drives θ as a uniform (world.js:654). |

This is cheaper than the spec's approach *and* it fixes a second trap the map found: portal separation scales with θ² (`nav.js:533`), so choosing breach sites inside a 0.12 rad cap would have placed them almost on top of each other. Siting them at θ_end avoids that entirely.

## File structure

| File | Change |
| --- | --- |
| `js/modes/ninetynine.js` | **Create.** The shell: owns the run, consumes its events, drives world/camera/ui. |
| `js/run/frontier.js` | **Create.** Pure: is a direction inside θ? Obeys the portability contract. |
| `js/ui.js` | Draft overlay markup + `showDraft()`; shop cards gain a locked state. |
| `js/towers.js` | Read `MODS` in the stats getter; enforce the tier cap; seed the crit roll. |
| `js/enemies.js` | Read evolution tier for armour/speed/shield/split; colour tell. |
| `js/game.js` | Placement rejects outside the frontier; gold reads `goldMul`; cost reads `costMul`. |
| `js/waves.js` | 15-wave mode override; boss at 15. |
| `js/main.js` | Construct the shell when the mode is `ninetynine`; expose it on `WH`. |
| `js/config.js` | A `ninetynine` map entry. |
| `css/style.css` | Draft overlay styling. |

---

### Task 1: Frontier predicate (pure)

**Files:**
- Create: `js/run/frontier.js`
- Test: `tests/run/frontier.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/run/frontier.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insideFrontier, angleBetween } from '../../js/run/frontier.js';

const CENTRE = { x: 0, y: 0, z: 1 };

test('angleBetween is zero for identical directions', () => {
  assert.ok(angleBetween(CENTRE, CENTRE) < 1e-9);
});

test('angleBetween is a right angle for perpendicular directions', () => {
  const a = angleBetween(CENTRE, { x: 1, y: 0, z: 0 });
  assert.ok(Math.abs(a - Math.PI / 2) < 1e-9, `got ${a}`);
});

test('a direction at the centre is inside any frontier', () => {
  assert.equal(insideFrontier(CENTRE, CENTRE, 0.12), true);
});

test('a direction beyond theta is outside', () => {
  const off = { x: Math.sin(0.3), y: 0, z: Math.cos(0.3) };
  assert.equal(insideFrontier(CENTRE, off, 0.12), false);
  assert.equal(insideFrontier(CENTRE, off, 0.52), true);
});

test('the boundary is inclusive within a small epsilon', () => {
  const edge = { x: Math.sin(0.12), y: 0, z: Math.cos(0.12) };
  assert.equal(insideFrontier(CENTRE, edge, 0.12), true);
});

test('unnormalised input still works', () => {
  const scaled = { x: 0, y: 0, z: 240 };
  assert.equal(insideFrontier(CENTRE, scaled, 0.05), true);
});

test('a null centre means unbounded, for planetary maps', () => {
  assert.equal(insideFrontier(null, { x: 1, y: 0, z: 0 }, 0.1), true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test "tests/run/frontier.test.mjs"`
Expected: FAIL — `Cannot find module` for `js/run/frontier.js`.

- [ ] **Step 3: Write the implementation**

Create `js/run/frontier.js`:

```js
// Is a direction inside the current frontier?
//
// This is the whole of the frontier mechanic at runtime. The nav graph and the
// terrain are built once at the FINAL angle and never rebuilt, because
// nav._buildGraph reallocates every array and would destroy the tower
// footprints in nav.block along with heartNode and portalNodes. So the frontier
// is a mask over a fixed world rather than a smaller world that grows.
//
// Pure by contract: plain {x,y,z} objects, no THREE.

export function angleBetween(a, b) {
  const la = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z) || 1;
  const lb = Math.sqrt(b.x * b.x + b.y * b.y + b.z * b.z) || 1;
  const dot = (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb);
  return Math.acos(Math.min(1, Math.max(-1, dot)));
}

// A hair of tolerance so a point placed exactly on the rim is not rejected by
// floating-point noise.
const EDGE_EPSILON = 1e-6;

export function insideFrontier(centre, dir, theta) {
  if (!centre) return true;
  return angleBetween(centre, dir) <= theta + EDGE_EPSILON;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test "tests/run/frontier.test.mjs"`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add js/run/frontier.js tests/run/frontier.test.mjs
git commit -m "99 Planets: pure frontier predicate"
```

---

### Task 2: Mode registration

**Files:**
- Modify: `js/config.js` — add to the `MAPS` registry (the literal begins at config.js:23)

- [ ] **Step 1: Add the map entry**

In `js/config.js`, inside the `MAPS` object, after the `titan` entry, add:

```js
  ninetynine: {
    name: '99 Planets',
    mode: 'ninetynine', modeLabel: 'roguelite campaign',
    tag: 'One tower. Fifteen waves. The frontier widens with every one you survive.',
    chip: 'roguelite · 15 waves · boss',
    // Same planet class as Titan's Brow. fieldTheta is the FINAL frontier: the
    // nav graph, terrain, decor and breach sites are all authored at this angle
    // once, and the run masks a smaller area early on. Building small and
    // growing is not possible - nav._buildGraph cannot grow and a rebuild
    // discards every tower footprint.
    radius: 240, terrainDetail: 7, navDetail: 9, pickDetail: 5,
    freqMul: 1.7, fineAbsolute: true,
    portalWakes: [1, 3, 7, 11, 15],
    fieldTheta: 0.52,
    startGold: 450,
    waterSegs: [320, 214],
    decorMul: 1.15,
  },
```

- [ ] **Step 2: Verify the mode boots**

Run the dev server, then load `http://localhost:8137/index.html?map=ninetynine&seed=20260830`.
Expected: the world generates and the title card for 99 Planets appears. Nothing roguelite happens yet — only the map exists.

- [ ] **Step 3: Confirm the camera harness still passes**

In the browser console: `WH.camTest()`
Expected: `pass: true`. This map has a `fieldTheta`, so it exercises the confine path.

- [ ] **Step 4: Commit**

```bash
git add js/config.js
git commit -m "99 Planets: register the mode with its final frontier angle"
```

---

### Task 3: Frontier mask on placement

**Files:**
- Modify: `js/game.js` — `_validate`, whose rule chain begins at game.js:348

- [ ] **Step 1: Add the frontier rule**

In `js/game.js`, add the import at the top of the file:

```js
import { insideFrontier } from './run/frontier.js';
```

In `_validate`, immediately after the existing `isBuildableDir` terrain check and before the heart-distance check, insert:

```js
    // 99 Planets: the frontier is a mask over a world built at its final size,
    // so a placement outside the CURRENT angle is refused even though the nav
    // graph and terrain extend past it.
    if (this.frontier && !insideFrontier(this.frontier.centre, this.cursorDir, this.frontier.theta)) {
      return { ok: false, reason: 'frontier' };
    }
```

In the `Game` constructor, after `this.validity = ...` (game.js:191), add:

```js
    // Set by the 99 Planets shell; null in every other mode.
    this.frontier = null;
```

- [ ] **Step 2: Give the refusal a player-facing message**

In `js/ui.js`, find the object mapping validity reasons to toast text (near the placement-failure handling) and add:

```js
      frontier: 'Beyond the frontier. Survive a wave to push it out.',
```

- [ ] **Step 3: Verify by hand in the browser**

Load `?map=ninetynine`, then in the console:

```js
WH.game.frontier = { centre: WH.nav.fieldCenter, theta: 0.12 };
```

Hover near the cap centre and near its edge.
Expected: placement is allowed near the centre and refused past 0.12 rad with the new toast, while terrain still renders out to 0.52.

- [ ] **Step 4: Commit**

```bash
git add js/game.js js/ui.js
git commit -m "99 Planets: refuse placement beyond the current frontier"
```

---

### Task 4: Modifiers reach combat

The integration map identifies `towers.js:369` as the primary multiplier seam — a `stats` getter that every tower reads.

**Files:**
- Modify: `js/towers.js` — the stats getter at towers.js:369

- [ ] **Step 1: Add a modifier source**

At the top of `js/towers.js`, after the existing imports:

```js
// The 99 Planets shell installs the run's modifier object here. Every other
// mode leaves it null and the getters below fall through to base stats.
// Powers ONLY ever write to this object; towers ONLY ever read it.
export const MODS = { current: null };
```

- [ ] **Step 2: Apply the multipliers in the stats getter**

Replace the body of the `stats` getter (towers.js:369) so it folds the modifiers over the tier stats:

```js
  get stats() {
    const base = this.def.tiers[this.tier];
    const m = MODS.current;
    if (!m) return base;
    return {
      ...base,
      dmg: base.dmg * m.dmgMul,
      rate: base.rate * m.rateMul,
      range: base.range * m.rangeMul,
      crit: (base.crit || 0) + m.critAdd,
    };
  }
```

- [ ] **Step 3: Verify the multiplier actually lands**

In the browser on any map:

```js
const t = WH.game.towerMgr.towers[0];
const before = t.stats.dmg;
WH.TOWER_MODS.current = { dmgMul: 2, rateMul: 1, rangeMul: 1, critAdd: 0 };
console.log(before, t.stats.dmg, t.stats.dmg === before * 2);
WH.TOWER_MODS.current = null;
```

Expected: the third value is `true`.

To make that possible, add `MODS as TOWER_MODS` to the `WH` debug object in `js/main.js` (the object begins at main.js:784), importing it alongside `TOWER_TYPES`.

- [ ] **Step 4: Commit**

```bash
git add js/towers.js js/main.js
git commit -m "99 Planets: route run modifiers through the tower stats getter"
```

---

### Task 5: Seed the sim's randomness

The map found five unseeded `Math.random()` calls in `towers.js` and three more in the sim path. The crit roll (towers.js:469) and the spawn jitters are gameplay-relevant, so a "same seed replays identically" claim is false until they are seeded.

**Files:**
- Modify: `js/towers.js:469`, `js/waves.js:124`, `js/enemies.js:194`
- Modify: `js/noise.js` — the map notes a seeded RNG already exists here at noise.js:5

- [ ] **Step 1: Expose a shared sim RNG**

In `js/noise.js`, export a mutable sim RNG that defaults to `Math.random` so existing modes are unchanged:

```js
// A single seeded stream for anything that affects the simulation. Defaults to
// Math.random so the classic modes behave exactly as before; 99 Planets swaps
// in a seeded generator so a run replays identically from its seed.
export const SIM_RANDOM = { next: Math.random };
```

- [ ] **Step 2: Use it at the three gameplay sites**

In `js/towers.js`, import `SIM_RANDOM` and replace the crit roll at line 469:

```js
    const crit = s.crit && SIM_RANDOM.next() < s.crit;
```

In `js/waves.js:124`, replace the spawn jitter:

```js
      t: 1.2 + i * g.gap + SIM_RANDOM.next() * 0.3,
```

In `js/enemies.js:194`, replace the portal scatter:

```js
      _tmp.set(SIM_RANDOM.next() - 0.5, SIM_RANDOM.next() - 0.5, SIM_RANDOM.next() - 0.5);
```

Leave the cosmetic calls (turret yaw, helios spark, enemy phase) alone — they do not affect outcomes and seeding them buys nothing.

- [ ] **Step 3: Verify determinism**

In the browser, on `?map=ninetynine`:

```js
const run = (seed) => {
  WH.SIM_RANDOM.next = WH.makeRng(seed);
  WH.waves.callEarly();
  WH.step(20);
  return WH.game.kills + ':' + Math.round(WH.game.gold);
};
console.log(run(7), run(7));
```

Expected: the two strings are identical. Export `SIM_RANDOM` and `makeRng` on `WH` in `js/main.js` to make this runnable.

- [ ] **Step 4: Commit**

```bash
git add js/noise.js js/towers.js js/waves.js js/enemies.js js/main.js
git commit -m "99 Planets: seed the three sim-path random calls"
```

---

### Task 6: Shop lock state

The map warns that a `<div>` inside a shown `.overlay` computes `pointer-events: none` (verified in a live browser), and that unaffordable cards are greyed via a `locked` class at ui.js:496 with styling at style.css:220.

**Files:**
- Modify: `js/ui.js` — `_buildCards` at ui.js:179, and the per-frame affordability pass at ui.js:496

- [ ] **Step 1: Gate cards on the unlocked set**

In `js/ui.js`, change the affordability pass so a card is locked when the mode has not unlocked it, reusing the existing `locked` class so the styling matches exactly:

```js
      const unlocked = !this.unlockedTowers || this.unlockedTowers.includes(key);
      card.classList.toggle('locked', !unlocked || g.gold < TOWER_TYPES[key].cost);
      card.disabled = !unlocked;
      card.title = unlocked
        ? `${TOWER_TYPES[key].name}: ${TOWER_TYPES[key].desc}`
        : `${TOWER_TYPES[key].name} — locked. Survive more waves.`;
```

In the `UI` constructor add:

```js
    // null means every tower is available, which is how the classic modes read.
    this.unlockedTowers = null;
```

- [ ] **Step 2: Block the number-key shortcut for locked towers**

In `js/game.js`, in `toggleBuild`, add at the top:

```js
    if (this.unlockedTowers && !this.unlockedTowers.includes(key)) return;
```

and in the `Game` constructor:

```js
    this.unlockedTowers = null;
```

Without this, keys 1–5 would still build a locked tower even though the card is disabled.

- [ ] **Step 3: Verify**

In the browser:

```js
WH.ui.unlockedTowers = ['bolt'];
WH.game.unlockedTowers = ['bolt'];
WH.step(0.2);
```

Expected: four cards render greyed and do nothing on click; pressing `3` does not enter build mode.

- [ ] **Step 4: Commit**

```bash
git add js/ui.js js/game.js
git commit -m "99 Planets: lock shop cards and hotkeys to the unlocked set"
```

---

### Task 7: Draft overlay

Three constraints from the map, all verified in a live browser, and all easy to get wrong:
1. `#hud > *` sets `pointer-events: none` at ID specificity, and only `<button>`, `.panel` and `.build-card` re-enable it. **Draft cards must be real `<button>` elements** or they will look right and be unclickable.
2. Overlays have no `z-index` and stack by DOM order, so the draft markup must sit **after** `#end-overlay`.
3. Show and hide only via `classList.add('show')` / `remove('show')`; never touch `style.display` or `style.opacity`.

**Files:**
- Modify: `js/ui.js` — markup in the `_build()` template literal (ui.js:49–160), after the `#end-overlay` block
- Modify: `css/style.css`

- [ ] **Step 1: Add the markup**

In the `_build()` template literal in `js/ui.js`, immediately after the `#end-overlay` block and before the closing backtick:

```html
      <div class="overlay" id="draft-overlay">
        <div class="panel draft-panel">
          <h2 class="draft-title">Choose a power</h2>
          <p class="draft-sub" id="draft-sub">Wave cleared</p>
          <div class="draft-cards" id="draft-cards"></div>
          <div class="draft-timer"><span id="draft-timer-fill"></span></div>
        </div>
      </div>
```

- [ ] **Step 2: Add the styling**

Append to `css/style.css`:

```css
.draft-panel { max-width: 720px; text-align: center; }
.draft-title { font-size: 26px; margin: 0 0 4px; letter-spacing: 0.06em; }
.draft-sub { color: var(--dim); margin: 0 0 18px; font-size: 13px; }
.draft-cards { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.draft-card {
  flex: 1 1 190px; max-width: 220px; padding: 14px 12px;
  background: var(--panel); border: 1px solid var(--line);
  border-radius: 10px; cursor: pointer; text-align: left;
  color: var(--text); font: inherit; transition: border-color 140ms, transform 140ms;
}
.draft-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.draft-card .dc-name { font-weight: 700; margin-bottom: 6px; }
.draft-card .dc-desc { font-size: 12px; color: var(--dim); line-height: 1.45; }
.draft-card .dc-rarity { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; }
.draft-card.rare .dc-rarity { color: var(--gold); }
.draft-card.uncommon .dc-rarity { color: var(--accent); }
.draft-card.common .dc-rarity { color: var(--dim); }
.draft-timer { height: 3px; background: var(--line); margin-top: 18px; border-radius: 2px; }
.draft-timer span { display: block; height: 100%; width: 100%; background: var(--accent); border-radius: 2px; }
```

- [ ] **Step 3: Add `showDraft` to the UI class**

In `js/ui.js`:

```js
  // Cards are <button> elements on purpose: css/style.css:84 sets
  // `#hud > * { pointer-events: none }` at ID specificity, and only buttons,
  // .panel and .build-card get it back. A <div> card would look correct and be
  // completely unclickable.
  showDraft(offers, onPick) {
    const host = document.getElementById('draft-cards');
    host.textContent = '';
    offers.forEach((power, i) => {
      const card = document.createElement('button');
      card.className = `draft-card ${power.rarity}`;
      card.innerHTML = `
        <div class="dc-rarity">${power.rarity}</div>
        <div class="dc-name">${power.name}</div>
        <div class="dc-desc">${power.desc}</div>
      `;
      card.addEventListener('click', () => onPick(i));
      host.appendChild(card);
    });
    document.getElementById('draft-overlay').classList.add('show');
  }

  setDraftTimer(fraction) {
    document.getElementById('draft-timer-fill').style.width = `${Math.max(0, fraction) * 100}%`;
  }

  hideDraft() {
    document.getElementById('draft-overlay').classList.remove('show');
  }
```

- [ ] **Step 4: Verify it is actually clickable**

In the browser:

```js
WH.ui.showDraft(
  [{ name: 'Keen Rails', desc: 'Towers deal 12% more damage.', rarity: 'common' },
   { name: 'Chain Coil', desc: 'Shots arc to 1 extra target.', rarity: 'uncommon' },
   { name: 'Pierce Rounds', desc: 'Shots pass through their target.', rarity: 'rare' }],
  (i) => { console.log('picked', i); WH.ui.hideDraft(); },
);
const card = document.querySelector('.draft-card');
const r = card.getBoundingClientRect();
console.log('hit test:', document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === card
  || card.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)));
```

Expected: the overlay appears and the hit test logs `true`. If it logs `false`, the pointer-events cascade has been broken — check that the cards are `<button>` and the panel has class `panel`.

- [ ] **Step 5: Commit**

```bash
git add js/ui.js css/style.css
git commit -m "99 Planets: draft overlay with clickable button cards"
```

---

### Task 8: Enemy evolution

**Files:**
- Modify: `js/enemies.js` — damage application at enemies.js:207, speed read at enemies.js:271, colour at enemies.js:118, death at enemies.js:227

- [ ] **Step 1: Add an evolution source and its tiers**

At the top of `js/enemies.js`:

```js
// Evolution tier set by the 99 Planets shell; 0 in every other mode.
export const EVO = { tier: 0 };

// Each tier adds a trait AND a visual tell, so the change is legible in play
// rather than only in the numbers.
const EVO_TIERS = [
  { armour: 0, speedMul: 1, shield: false, split: false, tint: null },
  { armour: 2, speedMul: 1, shield: false, split: false, tint: 0x8a97b5 },
  { armour: 2, speedMul: 1.18, shield: false, split: false, tint: 0xc2a15a },
  { armour: 3, speedMul: 1.18, shield: true, split: false, tint: 0x6fe0d0 },
  { armour: 3, speedMul: 1.22, shield: true, split: true, tint: 0xd06fe0 },
];

export function evoTraits() {
  return EVO_TIERS[Math.min(EVO.tier, EVO_TIERS.length - 1)];
}
```

- [ ] **Step 2: Apply armour and the shield on damage**

At the damage site (enemies.js:207), before the hp subtraction:

```js
    const evo = evoTraits();
    let dealt = Math.max(1, amount - evo.armour);
    if (evo.shield && e.shieldT > 0) {
      dealt = 0;
    }
    e.shieldT = evo.shield ? 3 : 0;
```

and use `dealt` in place of `amount` for the hp subtraction. Initialise `e.shieldT = 0` where enemies are spawned (enemies.js:60 region), and decrement it in the per-enemy update:

```js
    if (e.shieldT > 0) e.shieldT -= dt;
```

The shield therefore regenerates only after three seconds without damage, which is the spec's wording.

- [ ] **Step 3: Apply the speed multiplier**

At the speed read (enemies.js:271), multiply by `evoTraits().speedMul`.

- [ ] **Step 4: Apply the colour tell**

Where enemy material colour is set (enemies.js:118), wrap the existing assignment:

```js
    const tint = evoTraits().tint;
    if (tint === null) {
      mat.color.setHex(def.color);
    } else {
      // 45%, not a full swap: the species must stay recognisable while the
      // tier is legible at a glance.
      mat.color.setHex(def.color).lerp(_evoColor.setHex(tint), 0.45);
    }
```

and add a scratch colour beside the other module-scope scratch objects at the top of `js/enemies.js`:

```js
const _evoColor = new THREE.Color();
```

- [ ] **Step 5: Split mites on death**

At the death site (enemies.js:227), following the existing precedent for spawning children from a damaged enemy (enemies.js:217):

```js
    if (evoTraits().split && e.type.key === 'mite' && !e.isSplit) {
      for (let i = 0; i < 2; i++) {
        const child = this.spawn('mite', e.node);
        if (child) { child.isSplit = true; child.hp *= 0.4; child.scale = 0.7; }
      }
    }
```

`isSplit` prevents an infinite cascade.

- [ ] **Step 6: Verify each tier**

In the browser:

```js
for (let t = 0; t <= 4; t++) {
  WH.ENEMY_EVO.tier = t;
  WH.testSpawn('mite', 6, 0);
  WH.step(6);
  console.log('tier', t, 'alive', WH.enemies.list.length);
}
WH.ENEMY_EVO.tier = 0;
```

Expected: no errors at any tier, and tier 4 leaves more mites alive than tier 0 because they split. Export `EVO as ENEMY_EVO` on `WH` in `js/main.js`.

- [ ] **Step 7: Commit**

```bash
git add js/enemies.js js/main.js
git commit -m "99 Planets: enemy evolution tiers with visual tells"
```

---

### Task 9: The mode shell

**Files:**
- Create: `js/modes/ninetynine.js`
- Modify: `js/main.js` — boot wiring (main.js:255 region) and the `WH` object (main.js:784)

- [ ] **Step 1: Write the shell**

Create `js/modes/ninetynine.js`:

```js
// The 99 Planets shell. The ONLY file that knows both the pure run core and
// Three.js. The core decides what happened; this file decides what it looks
// like. Nothing here leaks back into js/run.

import { createRun } from '../run/run.js';
import { THETA_END } from '../run/schedule.js';
import { MODS } from '../towers.js';
import { EVO } from '../enemies.js';
import { SIM_RANDOM } from '../noise.js';
import { makeRng } from '../run/rng.js';
import { CONFIG } from '../config.js';

export function createNinetyNine({ game, waves, world, nav, rig, ui, enemies }) {
  const run = createRun({ seed: CONFIG.seed, playerIds: ['solo'], startGold: CONFIG.economy.startGold });

  // One seeded stream for the whole simulation, so a seed replays identically.
  SIM_RANDOM.next = makeRng(CONFIG.seed ^ 0x9e3779b9);

  const centre = nav.fieldCenter;

  function applyFrontier(theta) {
    game.frontier = { centre, theta };
    // The wall is cheap to regrow: SEG is fixed at 200 so every buffer is the
    // same size at any theta (world.js:1404).
    world.setFieldWallTheta?.(theta);
    // The camera confine follows the playable area, not the built area.
    if (rig.confine) rig.confine.maxAng = theta * 1.02;
  }

  function syncFromRun() {
    MODS.current = run.getModifiers();
    EVO.tier = run.getEvolutionTier();
    game.unlockedTowers = run.getUnlockedTowers();
    ui.unlockedTowers = game.unlockedTowers;
    game.tierCap = run.getTierCap();
    applyFrontier(run.getFrontierTheta());
  }

  function handle(events) {
    for (const e of events) {
      if (e.type === 'towerUnlocked') ui.toast?.(`${e.tower.toUpperCase()} unlocked`, 'good');
      else if (e.type === 'tierCapRaised') ui.toast?.(`Tower upgrades to tier ${e.cap}`, 'good');
      else if (e.type === 'enemiesEvolved') ui.toast?.('The swarm evolves', 'danger');
      else if (e.type === 'frontierGrew') ui.toast?.('The frontier widens', 'good');
      else if (e.type === 'draftOpened') {
        ui.showDraft(e.offers, (i) => { run.vote('solo', i); });
      } else if (e.type === 'powerTaken') {
        ui.hideDraft();
        ui.toast?.(`${e.power.name} taken`, 'good');
      } else if (e.type === 'runWon') {
        ui.showEnd?.(true, 'The planet is yours');
      }
    }
    syncFromRun();
  }

  // A cleared wave advances the run; the draft holds the next wave until it
  // resolves, which is why the director is paused here rather than in the core.
  const prevClear = waves.onWaveClear;
  waves.onWaveClear = (n) => {
    prevClear?.(n);
    waves.state = 'idle';
    handle(run.completeWave());
  };

  syncFromRun();

  return {
    run,
    // Driven from stepFrame. dt is injected, so the core never reads a clock.
    update(dt) {
      const draft = run.getDraft();
      if (draft) {
        ui.setDraftTimer?.(draft.remaining / 10);
        handle(run.tick(dt));
        if (!run.getDraft()) waves.state = 'countdown';
      }
    },
    getFrontierTheta: () => run.getFrontierTheta(),
  };
}
```

- [ ] **Step 2: Add the wall-resize helper the shell calls**

In `js/world.js`, add to the `World` class:

```js
  // Rebuild the field wall at a new angle. Cheap by construction: SEG is fixed,
  // so the vertex, uv and index counts are identical at every theta.
  setFieldWallTheta(theta) {
    if (!this.fieldWall) return;
    this.scene.remove(this.fieldWall.mesh);
    this.fieldWall.mesh.geometry.dispose();
    this.fieldWall = buildFieldWall(this.fieldWall.centerDir, theta);
    this.scene.add(this.fieldWall.mesh);
  }
```

For that to work, `buildFieldWall` must return the direction it was built around. At the end of `buildFieldWall` (world.js:1403), change the returned object to include it:

```js
  return { mesh, mat, centerDir: centerDir.clone(), theta };
```

`centerDir.clone()` matters: the caller passes a shared vector, and keeping a live reference would let a later mutation silently move the wall.

- [ ] **Step 3: Wire it into boot**

In `js/main.js`, after `game`, `waves` and `ui` are constructed and cross-wired, add:

```js
  let mode99 = null;
  if (CONFIG.map.mode === 'ninetynine') {
    const { createNinetyNine } = await import('./modes/ninetynine.js');
    mode99 = createNinetyNine({ game, waves, world, nav, rig, ui, enemies });
    window.WH.mode99 = mode99;
  }
```

and in `stepFrame` (main.js:388), after `rig.update(dt)`:

```js
  mode99?.update(dt);
```

- [ ] **Step 4: Verify a full scripted run**

In the browser on `?map=ninetynine&seed=20260830`:

```js
WH.ui.beginGame();
for (let w = 1; w <= 14; w++) {
  WH.waves.callEarly();
  WH.step(40);
  const d = WH.mode99.run.getDraft();
  if (d) { WH.mode99.run.vote('solo', 0); WH.step(0.1); }
}
console.log({
  wave: WH.mode99.run.getWave(),
  theta: WH.mode99.run.getFrontierTheta(),
  towers: WH.mode99.run.getUnlockedTowers(),
  powers: WH.mode99.run.getPowers().length,
  evo: WH.mode99.run.getEvolutionTier(),
});
```

Expected: wave 15, theta ≈ 0.52, five towers, fourteen powers, evolution tier 4.

- [ ] **Step 5: Commit**

```bash
git add js/modes/ninetynine.js js/world.js js/main.js
git commit -m "99 Planets: the mode shell binding the run core to the game"
```

---

### Task 10: Wave and boss override

The map warns that `waves.js` hardcodes 30 waves with bosses at 10/20/30, and that five places outside `waves.js` assume it (including `ui.js:370`, where a wave-15 boss would get no banner).

**Files:**
- Modify: `js/waves.js` — `waveComp` at waves.js:27, victory gate at waves.js:156
- Modify: `js/ui.js:370`

- [ ] **Step 1: Make the boss wave a config value**

In `js/config.js`, inside the `ninetynine` map entry add `waveCount: 15`, and in `CONFIG.waves` read it:

```js
    count: MAP.waveCount ?? 30,
```

- [ ] **Step 2: Make the boss test read the count**

In `js/waves.js`, replace the hardcoded boss test in `waveComp`:

```js
  const boss = w === CONFIG.waves.count || (CONFIG.waves.count === 30 && w % 10 === 0);
```

so classic maps keep bosses at 10/20/30 and 99 Planets gets exactly one, at 15.

In `js/ui.js:370`, replace `const boss = n % 10 === 0` with:

```js
      const boss = n === CONFIG.waves.count || (CONFIG.waves.count === 30 && n % 10 === 0);
```

- [ ] **Step 3: Give the boss three phases**

In `js/waves.js`, in the boss branch of `waveComp`, when `CONFIG.waves.count === 15`:

```js
    push('colossus', 1, 4, 'far');
    push('aegis', 4, 2.2);
    push('husk', 18, 0.9);
    push('mite', 24, 0.4);
    push('wisp', 10, 1.1);
    return groups;
```

The three phases read as armoured approach, adds, then a swarm.

- [ ] **Step 4: Verify**

```js
console.log(WH.CONFIG.waves.count);
```
Expected: `15` on `?map=ninetynine`, `30` on `?map=pocket`.

Then clear to wave 15 and confirm the boss banner appears and the run ends in victory.

- [ ] **Step 5: Commit**

```bash
git add js/config.js js/waves.js js/ui.js
git commit -m "99 Planets: fifteen-wave run with a single boss at the end"
```

---

### Task 11: Enforce the tower tier cap

The shell sets `game.tierCap` in Task 9, but nothing reads it yet. Without this task, waves 10 and 12 announce an upgrade ceiling that does not exist and towers can be maxed from wave 1.

**Files:**
- Modify: `js/game.js` — the upgrade path at game.js:437
- Modify: `js/ui.js` — the upgrade button state

- [ ] **Step 1: Refuse an upgrade past the cap**

In `js/game.js`, in `upgradeSelected` (game.js:437), before the gold check:

```js
    // 99 Planets raises this ceiling on waves 10 and 12. It is null in every
    // other mode, which leaves the tower's own tier count as the only limit.
    if (this.tierCap !== null && t.tier + 1 >= this.tierCap) {
      this.onToast?.('Upgrade locked until the next tier unlocks', 'warn');
      return;
    }
```

and in the `Game` constructor beside the other mode fields:

```js
    this.tierCap = null;
```

- [ ] **Step 2: Reflect it in the panel**

In `js/ui.js`, where the upgrade button is enabled/disabled from cost, also disable it when the cap is reached, so the button does not invite a click it will refuse:

```js
      const capped = g.tierCap !== null && t.tier + 1 >= g.tierCap;
      btn.disabled = capped || g.gold < tierCost(t.def, t.tier + 1);
      btn.textContent = capped ? 'Tier locked' : `Upgrade ${tierCost(t.def, t.tier + 1)}`;
```

- [ ] **Step 3: Verify**

In the browser on `?map=ninetynine`, place a Bolt tower, then:

```js
WH.game.tierCap = 1;
WH.game.select(WH.game.towerMgr.towers[0]);
WH.game.upgradeSelected();
console.log('tier after blocked upgrade:', WH.game.towerMgr.towers[0].tier);
WH.game.tierCap = 3;
WH.give(9000);
WH.game.upgradeSelected();
console.log('tier after allowed upgrade:', WH.game.towerMgr.towers[0].tier);
```

Expected: `0` then `1`.

- [ ] **Step 4: Commit**

```bash
git add js/game.js js/ui.js
git commit -m "99 Planets: enforce the global tower tier cap"
```

---

### Task 12: Persist the victory

The spec calls for `localStorage` key `wh99Progress` shaped `{ planetsBeaten }`, banked on a win. Persistence is injected into the shell, never called from the core, so phase 2 swaps it for a DataStore without touching run logic.

**Files:**
- Create: `js/modes/progress.js`
- Modify: `js/modes/ninetynine.js`

- [ ] **Step 1: Write the store**

Create `js/modes/progress.js`:

```js
// Campaign progress. Lives in the SHELL, not the core: js/run may not touch
// storage (portability contract rule 1), so the core stays transliterable to
// Luau where this becomes a DataStore.

const KEY = 'wh99Progress';
const EMPTY = { planetsBeaten: 0 };

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    // Never trust stored shape: a hand-edited or half-written value must not
    // take the game down on boot.
    return { planetsBeaten: Number.isFinite(parsed?.planetsBeaten) ? parsed.planetsBeaten : 0 };
  } catch {
    return { ...EMPTY };
  }
}

export function bankVictory() {
  const next = { planetsBeaten: loadProgress().planetsBeaten + 1 };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  return next;
}
```

- [ ] **Step 2: Bank it on the win**

In `js/modes/ninetynine.js`, import it:

```js
import { bankVictory } from './progress.js';
```

and replace the `runWon` branch:

```js
      } else if (e.type === 'runWon') {
        const progress = bankVictory();
        ui.showEnd?.(true, `The planet is yours. Planets held: ${progress.planetsBeaten}.`);
      }
```

- [ ] **Step 3: Verify it survives a reload**

In the browser:

```js
localStorage.removeItem('wh99Progress');
const { bankVictory, loadProgress } = await import('/js/modes/progress.js');
console.log(loadProgress());        // { planetsBeaten: 0 }
bankVictory(); bankVictory();
console.log(loadProgress());        // { planetsBeaten: 2 }
localStorage.setItem('wh99Progress', '{ broken');
console.log(loadProgress());        // { planetsBeaten: 0 }, not a crash
```

Expected: exactly those three results, including the corrupt-value case returning a default rather than throwing.

- [ ] **Step 4: Commit**

```bash
git add js/modes/progress.js js/modes/ninetynine.js
git commit -m "99 Planets: bank the victory to local progress"
```

---

### Task 13: Full verification

- [ ] **Step 1: Core suite**

Run: `node tools/test.mjs`
Expected: 93 tests (86 existing + 7 frontier), 0 failures.

- [ ] **Step 2: Camera harness on every map**

For each of `pocket`, `giant`, `titan`, `reach`, `ninetynine`, load the map and run `WH.camTest()`.
Expected: `pass: true` on all five. This mode moves `rig.confine.maxAng` every wave, which is exactly what that harness guards.

- [ ] **Step 3: The classic modes are unchanged**

On `?map=pocket`: confirm all five shop cards are unlocked, `WH.CONFIG.waves.count` is 30, and a boss appears on wave 10.
This proves the mode hooks are inert when the mode is off.

- [ ] **Step 4: Single-file build**

Run: `node tools/build.mjs`
Expected: 25 modules inlined (23 + frontier + the shell). Load `dist/worldheart.html` and confirm 99 Planets is playable from the bundle.

- [ ] **Step 5: Commit and deploy**

```bash
git add -A
git commit -m "99 Planets: phase 1 complete"
node tools/build.mjs
```

Then refresh `/v2` alongside root so both published paths stay identical, and republish the artifact.

---

## Definition of done

- [ ] A full 15-wave run is playable start to finish on `?map=ninetynine`.
- [ ] The frontier visibly widens each wave, and building past it is refused.
- [ ] Drafted powers measurably change tower damage.
- [ ] Towers unlock on 2/4/6/8; the tier cap rises on 10/12.
- [ ] Enemies visibly change on 3/6/9/12.
- [ ] The boss ends the run in victory, and the win is banked to localStorage.
- [ ] Upgrades are refused above the current tier cap.
- [ ] `node tools/test.mjs` is green and `WH.camTest()` passes on all five maps.
- [ ] The classic four maps play exactly as before.

## Known deferrals

Not in this plan, and named so they are not half-built: the planet ladder, biomes, per-planet size scaling, meta-currency, co-op, and the four build-defining power switches (`pierce`, `burnGround`, `hardFreeze`, `everyFifthDouble`) which are read by the modifier object but not yet acted on in combat. Those four need projectile-level work in `towers.js` and are worth their own plan once the loop is proven fun.
