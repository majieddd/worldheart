# Landform and biome refinement

September 11, 2026. Owner-directed U44-U47, Codex on
`feature/landform-biome-refinement`, based on preview `9fae91d`.
Status: published and publicly verified in V2 through draft [PR #33](https://github.com/majieddd/worldheart/pull/33).

## Outcomes

- All 99 campaign definitions use Mixed Landscapes. Per-planet seeds and climate
  still vary. Explicit Giant peaks, Deep canyons, Ocean islands and Classic
  remain available in the separate generator/sandbox.
- Dune field is now Hill Fields with wider crest spacing. Foothills are broader
  and taller. Plateau replaces Eroded tableland. Favorite caldera and terraced
  plateau formulas are preserved; their locations can change with the new mix.
- Butte groups have 7-12 separate remnants. Their analytic foot spacing is at
  least 5.5m; shorelines can erode/submerge peripheral groups. Branching ravines
  now have 3-5 tributaries and more substantial banks. Faults are longer, wider
  and dry inland. Staircase escarpments add long lateral benches with a ramp.
- The former Winding canyon is named Winding Valley. New Winding Canyon cuts
  into the sphere. Inland cuts stay dry; normal coastal/ocean terrain remains
  water. This resolves the owner's ambiguous canyon sentence in line with the
  explicit request for dry walkable faults. No reply to the optional water
  clarification was received during implementation.
- A shared water mask and explicit depth separate elevation from swimming.
  Picking, camera, unit grounding, weapon origins, placement, route costs,
  physical nests and the global dotted atlas use the same distinction.
- Temperate, Desert, Jungle, Boreal, Volcanic and Wetlands climate choices dress
  the same geometry. Seeded campaign climates remain automatic. Cacti and larger
  broadleaf canopies reuse the faceted style and passable-tree rule. Basalt and
  warm fissures mark volcanic terrain. Fissures are solid crust, not simulated
  liquid lava or a new damage hazard; raised hot stone keeps Mortar rules.

## Bounded adversarial review

1. Initial tests exposed stale expectations for the deliberately changed
   campaign defaults, hill scale and allowed negative cuts. These contracts
   were updated explicitly. A cold-biome precedence defect was fixed rather
   than weakening its test: cold stone still presents as alpine/tundra.
2. The first live sub-sea fixture caught a second commander swimming assignment
   in `Allies._ground`. It still inferred water from height after movement had
   correctly used the new mask. This was repaired and the same walk rerun.
3. The first deep canyon could trap its low floor behind exit grades. Depth now
   respects available ramp length, capped at 24% of cell extent. A dry-floor
   flood-fill across nine fixed group patches passes. Reinstating uncapped
   depth in an isolated control fails on seed 771, group 0. The failed control
   is retained; it was never used for publication.
4. Several initial browser fixtures asked for a deep canyon inside a cap that
   did not contain one, including after accepted-seed selection changed. Those
   failures are retained as fixture errors. The final traversal fixture uses
   seed 4306234, identified from the real all-99 source survey, with over a
   thousand dry sub-sea floor nodes. Other seeds still test general variety.
5. The shape gallery was inspected. The inward canyon received a stronger
   meander after the first render; useful ramp slopes take precedence over
   making a small cell arbitrarily deep. No unbounded search for a pretty seed
   or passing performance run was used.

## Evidence and remaining acceptance

Evidence is stored alongside this file in `LANDFORM-BIOMES/`.

| Check | Result / scope |
|---|---|
| Pure tests | 276 pass, including dry walls, directed costs, measured butte gaps, climate controls and canyon exit flood-fill |
| Fixed real fields | 116 assertions pass across 4 seeds x 4 terrain profiles |
| Physical nests / all 99 definitions | 15,147 isolated enemy arrivals pass at three base expansions; no stranded enemies or floor/flight violations |
| Terrain / placement | 96 terrain and 96 placement cases pass |
| Generator / atlas | 40 normal generator UI and 12 whole-globe atlas cases pass |
| Climate and sub-sea browser | 30 cases pass; another 20 explicitly cover Winding Canyon (seed 771, 470 connected dry low nodes) and Fault Crevices (4306234, 1,132 nodes) |
| Commander context / unit paths | 30 cases pass; old frozen collision coordinates are explicitly not comparable after reseeding |
| Classic / camera | All five maps boot and pass camera checks; 96,000 classic field values and four geodesic comparisons unchanged |
| Standalone / mirrors | 3 bundle checks pass; 64 inlined modules and 67 source/mirror files verified |
| Legal instrumented play | 15-wave victory, 24 heart health, 514 kills, 12 nests destroyed, zero controller stall seconds; 11 weapons carried to planet 2 |
| Native gameplay performance | 60 seconds, 720p, 30 towers/100 enemies: median 13.9ms, p99 20.9ms; sustained simulation and pause/recovery pass |

The legal run uses normal purchases/actions with deterministic 60Hz advancement
and sparse rendered frames. It is not continuous manual play or a full-99 win.
The classic numeric comparison uses the preserved v3 snapshot `525a220`; both
v4 and this build preserve that formula. Rendered shape/biome captures are
controlled inspection evidence, not proof of gameplay by themselves.

The native performance fixture ran after this task's heavy verification jobs
finished. No unrelated user processes were stopped. The separate native 10-second atlas fixture passes: median 6.9ms, p99 7.1ms,
maximum construction long task 55ms. This one-device result does not erase the
retained v4 timing failures or close broader M0 performance acceptance.
Functional build `d2d7a2f8aa30c9746f1f60047f3228f58f36d76a` deployed successfully
through [Pages 34634297774](https://github.com/majieddd/worldheart/actions/runs/34634297774).
Public browser verification passes 40 climate/sub-sea, 40 generator and 12 atlas
cases. All 208 public asset/source identity comparisons pass. Stable main stays
`1374122d1109919a5fab10b69fefdfb80308eb6e`. Review CI passes as well.
The documentation handoff adds these results without changing runtime bytes.

[Play V2](https://majieddd.github.io/worldheart/v2/) or
[inspect Mixed Landscapes](https://majieddd.github.io/worldheart/v2/?map=ninetynine&campaign=0&seed=771&terrain=varied&worldgen=1).
Reload an existing tab to load this build. Tracker #1 and terrain issue #5 keep
this batch separate from the remaining milestone acceptance work. Runtime fixtures, pure geometry checks, controlled captures and legal
instrumented play are separate evidence types. None is blind full-campaign QA.

Broader M0 device/frame-pacing acceptance, unforced full-99 combat balance,
multiplayer PvPvE, ports and owner visual/feel acceptance remain open. Existing
M0 atlas frame-pacing failures are not closed by this terrain batch. The stable
root continues to come from main; only V2 publication is authorized here.
