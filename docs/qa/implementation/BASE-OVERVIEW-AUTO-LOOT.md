# Base overview and automatic loot, September 10

Owner: Codex on `feature/base-overview-auto-loot`, based on preview `036c57c`.
U33-U34 / [tracker #1](https://github.com/majieddd/worldheart/issues/1) /
[M1 #3](https://github.com/majieddd/worldheart/issues/3) /
[M4 #6](https://github.com/majieddd/worldheart/issues/6).
Status: implemented, published and live-verified at [V2](https://majieddd.github.io/worldheart/v2/).
[PR #29](https://github.com/majieddd/worldheart/pull/29) is stacked on PR #28.
Gameplay source `c9057b381c69beb6e49f59cc99675b1328baee47` was published by
[deployment 34450317178](https://github.com/majieddd/worldheart/actions/runs/34450317178).
Documentation-only follow-ups retain this runtime. Main remains `1374122`.

## Behavior and boundaries

The owner requested maximum zoom that grows with base level and shows the whole
base, plus automatic commander item collection. This changes campaign mode and
its single-planet sandbox. Other maps keep their planet-relative zoom limits.

The old campaign ceiling was capped at 112.8 m after level 1 and ignored viewport
shape. The retained baseline fails 37 of 43 checks. At 1280x720, level 5 has
147/288 sampled terrain points outside the viewport from the heart and 262/288
from the edge. The globe hides 38 points in that edge pose. Even the starting
base clips in portrait. Nearby weapon drops also remain on the ground.

The new ceiling encloses the unlocked cap from every allowed focus, accounting
for the narrower frustum axis and measured unlocked terrain height. A far-view
pitch floor keeps the opposite rim above the globe horizon. Terrain heights are
sampled from the fixed nav graph on expansion only. Normal pan does no graph
scan or rebuild. An already fully zoomed-out view eases into the expanded limit;
the initial close altitude remains unchanged. Extreme portrait/narrow-lens views
also get sufficient far-plane clearance. This is a conservative overview with
margin for raised terrain, rather than a tightly cropped map at the heart.

Living campaign commanders collect nearby weapon drops within 2.8 world units,
nearest first, in orbit, first person or third person. The existing inventory
transaction enforces item identity and twelve backpack spaces. Collection never
equips, replaces, salvages or cancels an attack. A full bag leaves the drop and
model on the ground until space is available or the player explicitly replaces
or salvages it. Pause, draft, defeat/death and campaign transition guards apply.
Victory salvage saves the updated inventory through the existing checkpoint.
No save schema or pure simulation contract changes. Crystals already collect
automatically; their three-item cargo limit and explicit deposit stay intact.

## Evidence

Records are in [BASE-OVERVIEW-AUTO-LOOT/](BASE-OVERVIEW-AUTO-LOOT/).

- `before.json`: unchanged source baseline, 43 checks with the 37 failures above.
- `local.json`: 64 checks pass. Actual rendered terrain projections at heart
  levels 0-5, from heart and edge, in 1280x720, 720x1280 and 1920x720. Each pose
  samples 288 points. All samples fit with margin and clear the globe horizon.
  Five additional cases retain the fully zoomed-out target after an upgrade.
  The same driver covers pickup in three control views, pause, death, draft,
  vertical/distant drops, busy attacks, full bag and later collection, duplicate
  rejection, keyboard inventory and saved victory/reload/extraction to planet 2.
- `tests/shell/camera-overview.test.mjs`: three tests cover growing ceilings,
  unchanged initial altitude, north/south/equatorial focus, elevated terrain,
  manual low pitch, portrait views and extreme narrow-lens far-plane clearance.
- `maps.json`: all five maps boot and pass their camera harnesses.
- `poles.json`: all 16 polar camera/input regressions pass.
- `weapons.json`: all 29 existing weapon/combat/inventory checks pass.
- `crystals.json`: all 16 existing cargo/deposit checks pass.
- All 260 tests pass, all 53 modules parse, and house style passes. The generated
  build bundles 55 modules and matches all 58 source mirrors.
- `legal/run.json`, `legal/arrival.json` and `legal/terminal.png`: fresh legal
  15-wave victory with 24 heart health, 545 kills, eight towers and 12 nests
  destroyed. The commander finished at 1368.93/1400 HP. Extraction carried 13
  weapons into planet 2. No runtime faults or controller stalls. The policy used
  real purchases, drops, movement and attacks without injecting resources or
  skipping waves. Deterministic time and sparse rendering make this campaign
  smoke evidence, not a performance benchmark or blind playthrough.

Framing, loot and terminal-state cases inject bounded fixtures and advance
deterministic frames. They are source-informed QA, not blind or natural campaign
completion. Screenshot inspection supports the pose/transaction measurements.
No frame-budget, human camera-feel or full 99-planet acceptance claim is made.

Public V2 passes the same 64 cases with no browser faults; see
[public/results.json](BASE-OVERVIEW-AUTO-LOOT/public/results.json).
[Public identity](BASE-OVERVIEW-AUTO-LOOT/public/identity.json) verifies 95
preview/original asset hashes plus direct camera, mode and weapon-UI source
comparisons, 98 checks total. Review CI, Pages build and deployment pass.
No gameplay PR was merged into main and the original root bytes are preserved.

## Retained test corrections

The first overview screenshot was taken after Return to heart restored the
close distance. The final capture explicitly settles at maximum zoom; the
earlier image is not accepted as overview evidence.

A compressed enter/exit possession fixture left an asynchronous pointer-lock
request pending, which blocked a later mouse click. The driver uses normal I
keyboard input to inspect the inventory. A later timeout was the victory CSS
transition: the driver had frozen animation callbacks but used the default
animation-frame polling to await opacity. It now polls that transition by time.
These harness failures are retained in `capture-failures.json`; they are not
counted as passing runs. The driver records thrown exceptions as faults before
writing its final pass flag, correcting an early report that marked completed
assertions green despite a subsequent capture error. No gameplay assertion was
removed or weakened to resolve these failures.

## Resume commands

```powershell
$env:WH_NODE_MODULES='C:\Users\Majied LaFleur\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node tools/base-loot-check.mjs artifacts/base-loot/recheck
node tools/browser-regression.mjs artifacts/base-loot/maps
node tools/polar-camera-check.mjs artifacts/base-loot/poles
node tools/weapons-check.mjs artifacts/base-loot/weapons
node tools/crystal-check.mjs artifacts/base-loot/crystals
node tools/self-play.mjs 12345 artifacts/base-loot/legal --campaign --planets=1 --weapons --strategy=assault --sparse-render
```

Public checks use `WH_BASE_URL=https://majieddd.github.io/worldheart/v2` with the
base/loot driver. Main/root publication remains outside this preview work.
Broader owner feel, reduced-CPU/device and natural full-campaign gates stay in
the original tracker. Usage unmeasured.
