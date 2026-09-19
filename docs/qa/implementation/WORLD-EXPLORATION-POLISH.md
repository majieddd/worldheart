# World exploration and lobby polish / U262-U271

Owner: Codex. Branch: `feature/world-exploration-polish`.
Base: preview/v2 `0036b84`. September 19, 2026. V2 only.
Status: published and publicly verified. [PR #78](https://github.com/majieddd/worldheart/pull/78).

Runtime checkpoint: `7f13b0d48807e13e3129034b6802387749608322`.
[Successful V2 deployment](https://github.com/majieddd/worldheart/actions/runs/35474014980).
All 870 deployed/source identities pass, including preserved main files. Public
opening (33), construction/chest/touch (9), and two responsive shop audits pass.
Nine initial audio downloads timed out or lost their connection; all nine
matched on a targeted retry. Both attempts are retained. Documentation-only
follow-ups may advance the preview SHA with the same runtime asset hashes.

| ID | Requested outcome | State / acceptance |
| --- | --- | --- |
| U262 | Snapping walls, wheel rotation, persistent tower upgrades, touch hotbar and pinch | Verified: straight/corner joints, duplicates, wheel capture, upgrade panel and touch gesture direction |
| U263 | Usable natural land bridges | Verified: roof/floor picking, roof placement and autonomous upper/lower routes; five exhibits inspected |
| U264 | Larger features, richer scenery, rewarding chests and buildings | Implemented: 1.6x new-world features, eight building families and animated one-time rewards; real chest button and ejected models verified |
| U265 | Richer meteors and other disasters | Implemented: hot cracked rocks, fading fire trails, target clocks, flashes/dust, volume clouds and continuous sand front; ten exhibits and seven phases inspected |
| U266 | Tactical Solar worlds and useful nest placement | Verified: 16 bodies, 105 named landmarks, denser regions, safe hill-adjacent nests, stable geography and local routes |
| U267 | Commander courtyard, shops, join circles, roll/merge | Verified: movement, 3-scrap roll, merge, reload, separate new/continue pads and campaign launch |
| U268 | Painted simple HUD and readable weapon panels | Implemented: three primary stats, emoji labels and expandable details; three-size contrast/focus/overflow audit passes |
| U269 | Laya/Jev recipe experiment | Complete, negative runtime result: 15/20 vs rules 19/20; 741 ms vs 0.025 ms median; retained offline |
| U270 | Aegis and contributors | Plugin 3.18.14 installed; seven tools discovered; installed exploration workflow passes; [PR #15](https://github.com/majieddd/claude-plugins-custom/pull/15) |
| U271 | Regression, evidence and V2 publication | Complete: CI, live asset identity, public desktop/touch flow and shop checks pass |

User-approved Painted-Anime-Inkline 1.3.2 remains the visual contract. The lobby
references define spatial proportions and station layout, not a copy of another
game's assets. Main and archived collaborators' art/animation candidates remain
preserved. Existing home/campaign saves retain their terrain-version identity.

Laya is a text/JSON decision model, not a mesh or terrain generator. Existing
Studio trials already installed the English model and measured limited accuracy.
This pass tests world/weapon recipe selection separately; geometry, path safety,
economy limits, seeds and runtime fallbacks stay deterministic. No quality or
speed improvement will be claimed without a measured comparison.

Research sources: [Laya](https://github.com/NandhaKishorM/laya),
[Made with Jev](https://madewithjev.com/). Lobby references are the seven supplied
screenshots in `Pictures/RobloxLobbylook`; first views show a broad courtyard,
large perimeter shop facades, readable destination signs and unobstructed join
pads surrounding a commander-height camera.

## Implementation contracts

- The actual meadow arena and supplied screenshots were inspected. Accepted
  Painted-Anime-Inkline 1.3.2 surfaces are shared by battle, courtyard and exhibits.
  Original art and other collaborators' motion/asset work remain preserved.
- Wall sockets project local tangent joints back onto the globe, with tested
  straight and 90-degree joint gaps under 0.28 metres. Wheel turns 45 degrees and
  consumes zoom. R/button still work; mobile shares the purchase/placement code.
- Bridge picks now intersect the solid interval used by support and navigation.
  Tower footprints validate their selected height, support and headroom. Orders
  retain roof height and lower passages remain separate. Stone side faces and
  shared paint remove the disconnected bridge outline.
- New terrain version 3 fixes each Solar body's geographic seed, adds named
  ridge passes, rifts, shields, crater gates, dunes, shelves and ice cells, and
  increases formation coverage. Coastlines and biome identities remain. These
  are exaggerated geological analogues, not accurate elevation reconstructions;
  the gas giants have fictional walkable cloud decks.
- Versions 0/1/2 retain sampled height, support and feature placement/radii.
  New feature scale is shared by art, collision, spacing and gameplay effects.
  Existing homes/campaigns are not silently regenerated.
- Nest scoring modestly favors safe clearings near hills. Dryness, connectivity,
  clearance, separation and route-length rules remain mandatory.
- Added cottage, city block, star sanctuary and relay buildings; revised the
  observatory dome, ruins, trim and foliage. Static building parts are merged,
  scenery/effects instanced. No downloaded model pack was introduced.
- Chest claims commit once. The lid eases open; weapons arc out before pickup;
  scrap/crystal models fly toward the commander with a warm burst and short
  dedicated latch/bell cue. The approved existing sound cues remain.
- The courtyard has seven stations and two large join pads. Start explicitly
  selects a fresh route, Continue preserves it. This remains a solo lobby.
  Ordinary V2 entry still opens the Earth-first game.
- Rolls cost three scraps. Merge three distinct unequipped weapons of one
  family to retain the best weapon's parts/manufacturer/skill and add one rarity.
  Home packs cap at rare. Full bags, stale saves and invalid recipes reject
  without spending. Updating the home defense checkpoint prevents rollback from
  undoing the transaction. Active expeditions cannot be edited from the lobby.
- Weapon cards prioritize damage, rate, reach and the skill; expanded details
  contain secondary parts/modifiers. No ammo or character levels were added.

## Evidence and acceptance limits

Committed reports and compressed review images: [world-polish](../world-polish/).
Full-resolution captures, failed attempts and raw logs remain in the local
`artifacts/world-polish/` folder. Screenshots do not grant owner art approval.

- 425 automated checks pass; 181 modules parse; house style passes.
- 33 opening/touch checks pass: actual build/upgrade/deposit/base interaction,
  held-wave release and portrait/landscape layout. Aim and late-game briefings
  are labeled fixtures.
- 11 lifecycle checks pass: five maps' camera regressions, real wave queues,
  accelerated ten-wave completion, peaceful home entry and wall/chest reload.
  High test HP and lethal damage make this a lifecycle check, not a balance win.
- Nine exploration checks pass: Earth anchors, wall sockets/corner/wheel, actual
  chest button and model ejection, touch wall card and two-finger pinch. Spreading
  zooms in and pinching out without rotating. This is touch emulation, not a
  physical-phone test.
- Eleven lobby/catalogue checks cover saved transactions and actual launch.
  Ninety-six content views cover 44 biomes, 12 features, eight structures plus
  wall, ten disasters, five bridges and all 16 Solar bodies. Seven labeled
  frames additionally isolate warning, approach, impact, lightning and quake.
- Five bridge tests execute autonomous units above/below arches and on a sky
  island; supported roof placement and underpass ray picks pass.
- Sixteen local Solar probes sample about 1,000 navigation nodes around one
  landmark per body. Every patch has connected dry floor routes beside relief.
  Different expedition seeds produce identical sampled geography. This is not
  a full unforced playthrough on every Solar planet.
- 54 legacy cases (18 themes x three versions), with 700 height/ocean samples
  each plus bridge/feature records, match baseline `0036b84` exactly.
- Shop audits at 390x844, 844x390 and 1280x800 show zero contrast, focus, page
  overflow, pure-color or transition-all failures. The actual open shop was
  inspected; the native input now inherits the painted foreground color.
- Aegis: 77 compatibility tests, eight portable checks, fresh seven-tool
  discovery and eight exploration checks executed from installed 3.18.14 pass.

Generation speed is not claimed improved. Earth home loads were about 23-24
seconds, close to the retained 24-second baseline; some runs overlapped other
QA. The historic under-5 / under-10-second target remains open. Physical mobile
performance, owner art/feel acceptance and long-run balance remain open.

## Failed checks retained

Earlier landscape guidance overlapped placement controls; spacing was corrected.
Touch assertions initially read before the 100 ms UI refresh and now await the
actual controls. A gallery fixture called `toArray` on packed navigation data;
it now reads the typed-array slice. Launch assertions now await the automatic
playing transition. An initial audit returned a setup function without executing
it and measured the prologue. Inspecting its screenshot caught this; the actual
shop audit then exposed and fixed the select's missing focus style.

Visual sheets exposed excessive airless-world spikes, flat ring-like clouds
and weak meteor tails. Body-specific relief, revised region spacing, volume
clouds, a continuous dust front and fading emissive wakes replaced them.
Weather-front ground warnings were restored during review. Exact legacy probes
caught unversioned bridge micro-relief and floating-feature scaling; corrected
comparisons now pass. The old build fails the same socket probe because it has
no endpoint API, preserving a negative control instead of accepting every build.

## Reproduce and contribute

Claim an ID/branch on tracker #1. Branch from current `origin/preview/v2`, read
CONTRIBUTING and CLAUDE, preserve accepted art and saved terrain versions. Extend
the existing scenario runner instead of making a browser launcher per request.

```powershell
$env:WH_NODE_MODULES='<external Node dependencies>/node_modules'
$env:WH_BASE_URL='http://127.0.0.1:8141'
node tools/syntax.mjs
node tools/test.mjs
node tools/style.mjs
node tools/qa-painted-earth.mjs artifacts/opening-review
node tools/qa-painted-integration.mjs artifacts/exploration-review --polish --interaction-only
node tools/qa-painted-integration.mjs artifacts/catalogue-review --polish --visual-only
node tools/qa-painted-integration.mjs artifacts/disaster-review --polish --effects-only
```

Aegis `examples/worldheart/profile.json` exposes `exploration` and `catalogue`.
The adapter retains browser errors even when interactions pass. A catalogue
capture requires visual inspection. Plugin tools may remain attached to an old
connection in existing tasks; start a new task to test after reinstall.
Follow [PREVIEW](../../PREVIEW.md) for mirror, commit, publication and public
verification. Do not force-push or merge gameplay into main.

## Research and Laya decision

[Laya](https://github.com/NandhaKishorM/laya) and the
[Jev game gallery](https://madewithjev.com/categories/games-and-real-time) describe
typed choices and actions. This can select supplied recipes; it does not create
verified meshes or navigation. Gallery claims were not treated as benchmarks.

The trial reuses the installed English runtime: source
`fcf127c57176d7b8354510ed9124fc098560600a`, model `convaiinnovations/laya`, snapshot
`7c76b622dfc5cac71b2dc1c29873efe2ce509a05`. On CPU/four threads, 20 authored
terrain/weapon intent cases yield 15 correct choices versus 19 for simple rules.
Cold load: 82.63 s. Median warm choice: 741 ms versus 0.025 ms. All wrong choices
and timings are in [the report](../world-polish/laya-recipes.json); rerun with
`tools/asset-studio/benchmark_procedural_laya.py`. This is a small diagnostic,
not a held-out general benchmark or test of newer Laya models. It demonstrates
no game-generation quality/speed gain. Keep it offline and optional; reviewed
choices can feed deterministic recipes without a runtime dependency.

NASA references informed geological identity: [Moon composition](https://science.nasa.gov/moon/composition/),
[Mars topography](https://science.nasa.gov/photojournal/maps-of-mars-global-topography/),
[Venus](https://science.nasa.gov/venus/venus-facts/),
[Europa](https://science.nasa.gov/science-research/landscapes-and-features-of-europa/),
[Ganymede](https://science.nasa.gov/jupiter/jupiter-moons/ganymede/facts/),
[Callisto](https://science.nasa.gov/jupiter/jupiter-moons/callisto/facts/) and
[Pluto ice hills](https://science.nasa.gov/photojournal/plutos-mysterious-floating-hills/).
[Kenney Fantasy Town](https://kenney.nl/assets/fantasy-town-kit) and
[Quaternius Modular Ruins](https://quaternius.com/packs/ultimatemodularruins.html)
were surveyed; extending the shared kit retained the accepted paint and batching.
