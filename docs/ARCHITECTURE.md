# Architecture

What each module owns, and the exact steps to add the things people usually want
to add. Companion to `CLAUDE.md`, which carries the rules you must not break.

## Layers

```
                 js/run/*            pure, engine-free, 8 modules
                    |                returns EVENTS, never calls the renderer
                    v
        js/modes/ninetynine.js       the ONLY file that knows both sides
                    |
                    v
   js/main.js  js/game.js  js/world.js  js/nav.js  js/towers.js
   js/enemies.js  js/allies.js  js/possess.js  js/viewmodel.js
   js/camera.js  js/effects.js  js/postfx.js  js/audio.js  js/ui.js
```

The pure core decides *that* a wave was cleared, a tower unlocked, a frontier
widened. The shell decides what any of that *looks like*. The boundary is the
reason the mode can be ported to Luau later, and it is enforced by
`tests/run/purity.test.mjs`.

## Module responsibilities

| Module | Owns |
|---|---|
| `js/config.js` | `MAPS`, `PALETTE`, camera tuning, economy, limits. Reads the URL. |
| `js/noise.js` | The terrain height field and `SIM_RANDOM`, the seeded sim RNG. |
| `js/world.js` | Terrain mesh, biomes, water, sky, clouds, the heart, breaches, the frontier fog veil. |
| `js/nav.js` | The geodesic nav graph, the Dijkstra flow field, field scouting, walkability. |
| `js/towers.js` | 6 tower types: stats, models, firing. `MODS.current` holds run modifiers. |
| `js/enemies.js` | 5 enemy types, evolution tiers, melee, instanced rendering. |
| `js/allies.js` | Friendly units: the warden and 5 commander archetypes, AI, strikes, party, orders. |
| `js/possess.js` | First and third person: input, camera, pitch, jump, boom, base link. |
| `js/viewmodel.js` | The held weapon and its swing, drawn in its own scene inside the post pass. |
| `js/camera.js` | The focus-orbit rig. Pan, zoom, confine, trauma. |
| `js/game.js` | Placement legality, gold, lives, selection, build/upgrade/sell. Enforces `tierCap`, the Worldheart's ceiling, when the shell sets it. |
| `js/waves.js` | The wave director: composition, spawn cadence, pacing. In 99 Planets also the nests: raids from woken breaches outside the frontier. |
| `js/modes/ninetynine.js` | The 99 Planets shell. Binds the core's events to the renderer, owns the Worldheart purchase (gold is here, the level is in the core), remaps wave spawns to the frontier edge and lets raids through unremapped. |
| `js/effects.js` | Floaters, puffs, glows, ring pulses, the strategic icon layer. |
| `js/postfx.js` | MSAA target, bright pass, dual-Kawase bloom, ACES, grade, vignette, grain. |
| `js/ui.js` | Every DOM surface: HUD, overlays, cards, draft, talents, first-person HUD. |
| `js/modes/progress.js` | The persistent profile and the talent tree. The only `localStorage` writer for the mode. |

## Current content

5 maps · 4 map modes · 6 towers · 5 enemies · 1 warden + 5 commander archetypes
across 4 attack kinds · 20 powers · 13 talents in 4 tiers · 15 waves in
99 Planets, 30 on the classic maps · 5 Worldheart levels · 128 tests · 29 ES modules.

## Adding a tower

Eight registries. Only step 7 fails loudly if you skip it - the rest fail
silently, which is how a Warden Barracks once shipped drawing a Bolt Sentinel's
strategic icon.

1. `js/towers.js` - a `TOWER_TYPES` entry with its `tiers` array.
2. `js/towers.js` - a `buildX()` geometry function, registered in `BUILDERS`.
3. `js/towers.js` - firing behaviour: a `case` in the update switch, plus `_updateX()`.
4. `js/main.js` - an `ICON_COLORS` entry, or it draws the Bolt icon at strategic zoom.
5. `js/run/run.js` - add it to `UNLOCKABLE_TOWERS` if a run should be able to draw it.
6. `js/run/schedule.js` - `TOWER_UNLOCK_WAVES` must have one wave per unlockable, or the tower can never appear.
7. `js/modes/progress.js` - a `TALENTS` node, or it can never be bought permanently.
8. Digit hotkeys address the hand by **slot** in card mode, so nothing to do there; the classic shop map in `js/game.js` covers types 1-5 only.

Only three tiers are authored. Past them a tower keeps its tier-3 silhouette and
`tierStats` scales the numbers, so you never need to hand-write a tier 4.

## Adding an enemy

Well factored - four sites, two files, all keyed by the same species string.

1. `js/enemies.js` - an `ENEMY_TYPES` entry, including its melee block (`atk`, `swing`, `wind`, `reach`).
2. `js/enemies.js` - a parts spec for the instanced renderer.
3. `js/enemies.js` - an animation `case`.
4. `js/waves.js` - a `push(...)` in `waveComp` so waves actually contain it.

## Adding a commander archetype

1. `js/allies.js` - an `ALLY_TYPES` entry with a `strike` block. `strike.kind` is one of `melee`, `hitscan`, `lob`, `beam`.
2. `js/allies.js` - a `soldier(...)` call in the species table for its body.
3. `js/viewmodel.js` - a `GRIP` entry and a builder in `BUILD` for the first-person weapon.
4. `js/modes/ninetynine.js` - add the key to `COMMANDERS` so a run can draw it.
5. `js/modes/progress.js` - a `TALENTS` node to unlock it.

A genuinely new `strike.kind` also needs a dispatch arm in `playerAttack` and a
matching animation arm in the view model.

## The 99 Planets run loop

```
wave cleared
  -> waves.onWaveClear parks the director and calls run.completeWave()
  -> the wave EARNS a frontier ring
       heart can hold it:  frontierGrew, the circle widens one ring
       heart cannot:       frontierHeld, the ring is banked, the HUD says why
  -> ODD wave:  draw one tower card, advance immediately
     EVEN wave: open a 1-of-3 power draft, advance when it resolves
  -> enemies may evolve, a tower may unlock
  -> coins bank to the profile
  -> the director is released for the next wave

B, or the Worldheart panel (any time on the board)
  -> the shell checks and deducts gold, calls run.upgradeHeart()
  -> heartUpgraded: the tier cap rises one mark
  -> every banked ring the new level permits: frontierGrew, one each

while the director is not idle
  -> every woken breach outside the frontier is a nest
  -> each nest raids every raidInterval seconds, spawned AT the breach
  -> never under a draft: the mode's canRaid predicate freezes the clocks
```

The tables live in `js/run/schedule.js`: `HEART_COSTS` (one price per level
1..5) and `HEART_RINGS` (rings held at level 0..5, ending on all fourteen).
`run.getTierCap()` is `2 + level`. The core never touches gold.

The director and the core are two counters for the same thing. They are kept in
step by a queue in the mode shell: a completion that arrives while the core is
mid-draft is **queued, never dropped**. Dropping it was a real bug - the core
silently fell a wave behind per draft and stopped expanding on schedule. The
park itself was also a real bug: the director set `countdown` on the statement
after it called `onWaveClear`, so the hold lasted one line and the breather ran
down under the draft overlay. It now starts its own countdown only if nobody
parked it.

## Deployment

Three copies of the game are published:

| URL | Source | Notes |
|---|---|---|
| `/worldheart/` | repo root | the original build |
| `/worldheart/v2/` | `v2/` | a **mirror** of the source tree, not a newer version |
| `/worldheart/dist/worldheart.html` | `dist/` | the committed single-file build |

`node tools/deploy.mjs` refreshes `v2/` and rebuilds `dist/`, and verifies the
mirror file by file. Run it before committing anything under `js/`, `css/` or
`index.html`. Pages serves from repo settings, so there is no workflow file in
the tree to tell you this.

## Debug handles

Everything hangs off `window.WH` in the console:

- `WH.step(seconds)` - advance the sim deterministically, independent of rAF.
- `WH.camTest()` - the 13-check camera harness.
- `WH.game`, `WH.waves`, `WH.enemies`, `WH.allies`, `WH.towers`, `WH.possession`, `WH.viewModel`, `WH.mode99.run`
- `WH.mode99.upgradeHeart()` - buy a Worldheart level through the same path as B. `WH.waves.liveNests()` lists the breaches currently raiding.
- `WH.placeNear(type, portal, hops, side)` - scripted tower placement.
- `WH.fps`, `WH.drawCalls`, `WH.tris`, `WH.workMs`
