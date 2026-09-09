# Natural terrain and commander feel

2026-09-08. Owner: Codex. Branch: `feature/natural-terrain-feel`, starting at
`174bf1b` from origin/preview/v2. Tracks #1, M1 #3, M3 #5 and M4 #6.

Owner report: some tall terrain rises like a random pillar. Keep the mountain
addition and height variety, but give it curved approaches and coherent biome
regions. Also revisit apparent tree/obstacle collision, text animation,
first-person weapon presentation and view bob while advancing the open queue.

Keep the light faceted aesthetic, strategic passes and terrain costs, explicit
frontier upgrades, physical nests and readable combat. Main stays unchanged;
verified increments publish through V2. Human feel remains distinct from
measured contracts. The prior 99-planet and art acceptance gaps remain open.

| Item | State | Subsystem and acceptance | Evidence | Usage |
|---|---|---|---|---|
| N1 Rounded landform regions | published and live-verified | world terrain field, coherent foothills and retained height; fixed-seed field comparisons and rendered inspection | 36 public shape assertions, four profile fixtures, all 99 isolated routes | unmeasured |
| N2 Obstacle and camera response | published and live-verified | actual decor bounds replace fixed-height camera obstacles; real terrain/tower movement barriers retained | 15 public decor probes; ten public current-layout surface/path checks at 30/60/120 Hz | unmeasured |
| N3 First-person motion and text | targeted fixes published and live-verified; full motion review open | actual displacement drives bob; reset residual sway, deduplicate warnings and anchor reduced-motion text | 7 public motion/text assertions after vs 0 before; 16 local possession-camera and 12 held-prop checks | unmeasured |
| N4 Integrated acceptance and publication | checkpoint published and live-verified; broader acceptance open | route/cost repairs, full legal planet-1 run, core/combat regression, measured performance, V2 identity and public behavior | 228 core tests, 1,485 route arrivals, 486 nest arrivals, 180 path comparisons, victory/extraction and 85 public checks; reduced-CPU gate open | unmeasured |

Record old-build failures before repair. Compare exact effective seeds for
geometry, since world generation can choose a different seed after terrain
changes. Retain saved-profile compatibility and named limitations; a winning
controller or green unit suite does not establish whole-game completion.

## Player behavior and design decisions

Campaign terrain now uses broad continental, upland and erosion regions.
Mountain relief blends into wider foothills; canyon shoulders widen with their
depth and round into surrounding terrain. Fine facets remain cosmetic. This
uses the owner's biome-region inspiration within the existing spherical
generator, without claiming Minecraft's implementation or a new biome library.
The four classic maps retain their original height formula. Climate placement,
swimming, uphill costs and flight ceilings still use the same authoritative
surface as the campaign's navigation and rendering.

The original narrow warped coast/pass masks amplified large heights into
isolated needles. The old canyon distance estimate also divided by a changing
local noise gradient, creating abrupt rims. The replacement uses coherent
regional fields and a stable canyon coordinate. Noise widths are nominal;
only the sampled field measurements below are world-space evidence.

Decor was not a commander body collider. The third-person camera approximated
every tree and small rock with points extending 2.5m upward, inventing obstacles
over small rocks while missing some real geometry. It now tests padded bounds
in each actual instance's scaled, tilted frame. Inverse transforms are cached
once; crushed decor stops occluding. The camera's clearance probe is 0.3m, with
a 5cm approach gap and time-based retraction/release. Terrain and tower edges
remain solid for commander movement; existing swept steps and gliding remain.

Requested movement previously ran the head/weapon bob and footstep clock even
when the body could not move. Actual displacement now controls those cues,
including slope and swim slowdown. Acceleration and roll use exponential
response; the landing spring uses small integration steps. Turning bob off
clears lingering roll/sway even when paused, and equipping resets held-model
turn lag. Camera tuning defaults, arm geometry and attack timing are preserved.

Repeated identical warnings refresh one toast instead of stacking duplicates
or restarting the entrance. Damage labels disappear at expiry and both camera
clip planes. Essential BLOCKED labels stay anchored under reduced motion.
This is targeted feedback repair; it does not close all UI or animation review.

## Adversarial defect found during the terrain sweep

The first all-99 route sweep passed 98 planets. A husk on planet 95,
Firstlight Bastion, effective seed 9856871, oscillated at a blocked corner for
500 simulated seconds. A single frame of cell-center fallback was followed
by blended steering back into the same invalid neighbor. This could hold a
wave open despite a valid navigation graph.

Enemy recovery now completes its short route to the current cell center and
then its certified outgoing edge before restoring blended steering. Movement
still uses normal collision, slope and flyer checks. It never teleports or
deletes owed enemies. Recovery state resets on pooled reuse and is cancelled
if construction blocks its target. The exact failure and the first failed
99-planet sweep are preserved alongside the repaired runs.

The first revised 60-second stress run missed the p99 frame-time target.
The frozen old build passed the same policy, though the terrain chooser selects
different effective seeds. A CPU profile attributed 10.83 seconds of sampled
self time to commander point-to-point Dijkstra searches during AI pursuit.
The failed run and diagnostic profile are retained, without treating profiler
frame times as acceptance measurements.

Commander point searches now use A* with a conservative Euclidean lower bound
derived from the minimum actual directed edge cost per unit chord. Tower blocks,
uphill/swim weights and path ownership are preserved. Full heart, placement
and air calculations still use Dijkstra. Four current profiles compare 180
forward/reverse, disconnected and reopened route cases against the original
solver, including unchanged shared flow arrays. Search work drops from
16,829,033 heap pops to 5,706,956 in the final fixtures; this is a work count,
not an FPS claim. Browser performance is measured separately below.

That first guided-search iteration still failed the stress budget. Units
isolated by construction could repeatedly search an entire region for an
impossible pursuit. A revision-scoped weak-connectivity cache now rejects
separate walkable regions before weighted search. It ignores edge weights,
so it can allow an eventual weighted-search failure but cannot reject a valid
directed path. Building/selling and terrain graph changes invalidate it.
Tests include trapped starts, changed targets and reopened regions.

The final native-speed 60-second, 1080p orbit fixture passes with 100 enemies,
30 towers and continuously advancing simulation: median 131.58 fps, p99 8.7ms
(114.94 fps inverse p99), maximum 33.6ms; pause/resume passes and no page faults.
Hardware: i9-13900H / RTX 4080 Laptop, Chrome 152. This is one repeatable stress
policy, not an actual lower-end device or a full campaign performance verdict.

| Performance iteration | Median fps | p99 ms | Budget | Evidence |
|---|---:|---:|---|---|
| Frozen 174bf1b control | 129.87 | 16.2 | pass | [control](NATURAL-TERRAIN-FEEL/performance-control/results.json) |
| Rounded terrain before search repair | 131.58 | 48.5 | fail | [retained failure](NATURAL-TERRAIN-FEEL/performance-native/results.json) |
| Diagnostic CPU profile | 128.21 | 85.2 | diagnostic only | [report](NATURAL-TERRAIN-FEEL/performance-profile/results.json), [profile](NATURAL-TERRAIN-FEEL/performance-profile/cpu.cpuprofile) |
| Guided search without connectivity cache | 126.58 | 107.7 | fail | [retained insufficient fix](NATURAL-TERRAIN-FEEL/performance-guided/results.json) |
| Guided search plus connectivity cache | 131.58 | 8.7 | pass | [final native](NATURAL-TERRAIN-FEEL/performance-final/results.json), [rendered load](NATURAL-TERRAIN-FEEL/performance-final/stress-60s.png) |
| Final code, 4x CPU slowdown at 720p | 62.89 | 53.1 | fail | [reduced-CPU record](NATURAL-TERRAIN-FEEL/performance-cpu4/results.json) |

These runs used the same stress policy and machine, one at a time. Revised
terrain uses effective seed 36102; the frozen generator selects 28183, so the
old/new terrain comparison is not an identical-layout performance ablation.
Both revised search iterations and the final cache use the same layout.
The reduced-CPU case has 18.83 fps inverse p99, maximum 95.3ms, with continuous
simulation, successful pause/resume and no faults. It uses DevTools slowdown
on the same GPU, not a measured lower-end device. Its frame-time gate stays open.

## Evidence and reproducibility

Baseline: frozen source 174bf1b on port 8142. Revised source: this branch on
port 8139. Whole legal play records 54 runtime hashes and the controller hash.
Most isolated fixtures inject placement, camera or enemy state; they are not
blind play or full-campaign completion. `WH_NODE_MODULES` supplies Playwright.
New focused browser tools accept `WH_BASE_URL`, including the public V2 route.

| Check | Result and scope | Durable evidence |
|---|---|---|
| Fixed field comparison | Four profiles x seeds 12345/51940/389884; 6,144 globe samples each; four 200m transects through each old peak at 0.5m intervals; 36/36 shape assertions | [before](NATURAL-TERRAIN-FEEL/landforms-before/results.json), [after](NATURAL-TERRAIN-FEEL/landforms-after/results.json) |
| Shape negative control | Unchanged frozen terrain fails all 24 improvement assertions and passes the 12 peak-retention controls, as expected | [control](NATURAL-TERRAIN-FEEL/landform-control/results.json) |
| Retained large peaks | Sampled alpine maxima 116.59/120.78/107.05m versus 118.1/119.9/120.7m; all 12 samples retain at least 70% of former peak height | Same field records; these are sampled global maxima, not every playable battlefield's height |
| Rendered landform review | Real field sampled into an inspection mesh with a simple height palette; visible rounded shoulders and foothills | [alpine before](NATURAL-TERRAIN-FEEL/landforms-before/alpine.png), [after](NATURAL-TERRAIN-FEEL/landforms-after/alpine.png), [canyon after](NATURAL-TERRAIN-FEEL/landforms-after/canyon.png); not full-game captures |
| Four-profile integration | Picking, camera height, raised/climate placement, swim and shared route contracts pass | [terrain](NATURAL-TERRAIN-FEEL/terrain-results.json) |
| Camera and held prop | All five map harnesses; 16 possession-camera and 12 weapon-proportion checks pass | [maps](NATURAL-TERRAIN-FEEL/camera/results.json), [possession](NATURAL-TERRAIN-FEEL/possession-camera/results.json), [proportions](NATURAL-TERRAIN-FEEL/weapon-proportions/results.json) |
| Decor camera clearance | 15/15 after versus 6/15 before; actual scaled instances, empty space above small rocks and crushed-object removal | [before](NATURAL-TERRAIN-FEEL/decor-before/results.json), [after](NATURAL-TERRAIN-FEEL/decor-after/results.json) |
| Movement and feedback | 7/7 after versus 0/7 before: blocked bob/footsteps, paused bob-off, duplicate warnings, clip-plane labels and reduced-motion text | [before](NATURAL-TERRAIN-FEEL/motion-before/results.json), [after](NATURAL-TERRAIN-FEEL/motion-after/results.json) |
| Continuous commander surface input | Ten assertions, including 12 current terrain and 12 tower boundary sites at 30/60/120 Hz; zero barrier crossings. Depending on rate/context, 8-12 of 12 glances travel over 0.2m; some contacts still stop as solid barriers | [surface records](NATURAL-TERRAIN-FEEL/surface/results.json); not universal no-snag or human feel acceptance |
| Point-search correctness/work | 180 directed-cost, trapped-start/target and reopening comparisons; shared heart flow unchanged; all four profiles pass | [final oracle comparison](NATURAL-TERRAIN-FEEL/path-final/results.json) |
| Core/shell | 228/228 headless tests; 50/50 modules parse; five map boot/camera plus campaign defeat/retry checks pass | [core](NATURAL-TERRAIN-FEEL/core.txt), [maps](NATURAL-TERRAIN-FEEL/camera/results.json) |
| Enemy recovery lifecycle | Exact corner now clears at 30/60/120 Hz; pooled state resets and newly blocked recovery targets cancel | [30 Hz](NATURAL-TERRAIN-FEEL/corner-30/results.json), [60 Hz](NATURAL-TERRAIN-FEEL/corner-60/results.json), [120 Hz](NATURAL-TERRAIN-FEEL/corner-120/results.json) |
| Combat timing | 300 probes across five species, four terrain contexts and 30/60/120 Hz; 21 grouped assertions pass | [strike records](NATURAL-TERRAIN-FEEL/strikes/results.json) |
| All campaign routes | Final sweep passes 99/99, 1,485/1,485 isolated enemy arrivals; no ceiling violations | [first failure retained](NATURAL-TERRAIN-FEEL/routes-before/results.json), [final](NATURAL-TERRAIN-FEEL/routes-after/results.json) |
| Physical nests | Nine representative planets, 486/486 arrivals from physical source sites | [nest routes](NATURAL-TERRAIN-FEEL/nest-routes/results.json) |
| Natural outcome | Final code, fresh profile, requested seed 12345, effective 36102; 15 waves won with 24 heart health, 1,058 kills and 13 carried weapons; real extraction arrives at canyon planet 2 | [input/run trace](NATURAL-TERRAIN-FEEL/legal-play/run.json), [receipt](NATURAL-TERRAIN-FEEL/legal-play/terminal.png), [arrival](NATURAL-TERRAIN-FEEL/legal-play/arrival.json), [earned checkpoint](NATURAL-TERRAIN-FEEL/legal-play/victory-checkpoint.json) |

Run the new shape, motion, decor, surface and corner checks with their matching
`tools/*-check.mjs` files. The shape tool takes an optional third argument
pointing to the retained baseline JSON. Corner QA accepts `--hz=30`, `60` or
`120`. Current-layout surface fixtures deliberately discover boundaries again;
old coordinates/node IDs must not be reused after a terrain formula change.

The fresh legal run uses ordinary commander actions, purchases and placements,
with deterministic 60Hz simulation and one rendered frame every two simulation
seconds plus captures. It contains no forced victory, free health or wave skip.
It is source-informed controller play, not blind or real-time FPS evidence.
Terrain generation can choose a different effective seed after this change.
Account/inventory schemas are unchanged; assault restarts generate the revised
terrain. Existing campaign save fixtures and actual weapon retention pass.

## Still open on the original tracker

- Owner approval of terrain spectacle, camera feel, weapon silhouettes and the
  complete motion catalog. The current batch repairs held-motion defects but
  does not author the three ancient/scifi/empowered silhouette sets.
- Exact owner-reported foliage polygon artifact and broader moving combat,
  crowded obstacle/flight, route-line clutter and device/accessibility review.
- Sustained lower-capability performance, broader natural strategy/seed balance
  and the full unforced 99-planet campaign. Route arrivals alone do not close it.
- Main rename/default/metadata migration after release acceptance, followed by
  M6 authoritative multiplayer and separate Roblox/Fortnite feasibility work.

## Publication and handoff

[PR #23](https://github.com/majieddd/worldheart/pull/23), stacked on #22, publishes
source `88e8964e0b38fb89b938fa20b737a84eea81f661` through
[deployment 34310871805](https://github.com/majieddd/worldheart/actions/runs/34310871805).
The preview is [live at V2](https://majieddd.github.io/worldheart/v2/).
CI source, core, style and generated-mirror checks passed. The original root
remains main `1374122d1109919a5fab10b69fefdfb80308eb6e`; no gameplay PR is merged.

Public verification: 36 seeded shape, 7 motion/text, 15 decor, 10 continuous
surface/path and 17 deployment/save-isolation checks passed (85 total), with
no reported page faults. Downloaded all 55 preview assets and all 37 production
manifest entries; every hash matched. All 55 preview hashes also match the
LF-normalized tested local source; all 54 response hashes from the final
legal run matched its local source bytes. Documentation-only follow-ups must
preserve these runtime hashes.

Evidence: [identity](NATURAL-TERRAIN-FEEL/public-identity/results.json),
[public shape](NATURAL-TERRAIN-FEEL/public-landforms/results.json),
[motion](NATURAL-TERRAIN-FEEL/public-motion/results.json),
[decor](NATURAL-TERRAIN-FEEL/public-decor/results.json),
[surface/path](NATURAL-TERRAIN-FEEL/public-surface/results.json),
[deployment/save checks](NATURAL-TERRAIN-FEEL/public-preview/results.json).

Next collaborator: start from origin/preview/v2, inspect this ledger and the
[U01-U27 alignment](OWNER-ALIGNMENT.md), then claim a bounded remaining item.
The earlier planet-5 checkpoint is retained for campaign continuation; terrain
is regenerated by the current field, so older position/node-specific fixtures
need fresh discovery. The new earned planet-2 checkpoint above is from this
exact gameplay batch. Keep performance failures and owner review separate from
functional passes. No milestone or future multiplayer/port work is closed here.
