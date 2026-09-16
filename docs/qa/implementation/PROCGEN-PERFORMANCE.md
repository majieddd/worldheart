# Procedural generation performance

Owner: Codex. Branch `feature/procgen-performance`. Reference `e527859`
(runtime `f22e3b2`). September 16, 2026. V2 only.

| Item | State | Acceptance |
|---|---|---|
| U209 Research and profiling | Verified | Primary sources, actual CPU profile, reproducible matched seeds |
| U210 Implementation | Verified | Measured speed improvement without changing generated output |
| U211 Verification | Verified locally | Exact terrain, navigation and placement identity; gameplay and quake regressions |
| U212 Publication | Active | V2 deployment identity and public behavior; main unchanged |

Contract: preserve resolution, noise, formation recipes, random sequence, seed
selection, navigation safety, saved-world versions and the approved demo.
Optimization must remove redundant work, not reduce quality. Compare identical
guided worlds, not the older terrain algorithm. Timing samples are desktop
browser measurements and do not certify physical mobile hardware.

## Research and bounded experiments

Primary sources inspected September 16:

- [Noisium](https://github.com/Steveplays28/noisium): bypass redundant per-block
  placement work during generation while preserving vanilla output. Applied
  here as narrow-phase terrain sampling only where a structural deck exists.
- [C2ME](https://github.com/RelativityMC/C2ME-fabric): parallel chunk work,
  allocation/math optimizations and explicit random-state/thread-safety checks.
  Worldheart currently shares mutable CONFIG, terrain caches and Three scratch
  vectors; blind worker fan-out would change this contract. No worker rewrite
  is claimed in this pass.
- [Factorio noise compilation](https://factorio.com/blog/post/fff-390): reuse
  intermediates, deduplicate allocations and specialize work by needed outputs.
  Applied as packed exact indices, bounded geography storage, hoisted flight
  probe offsets and skipping the classic cost calculation on terrain maps.
- [Factorio threading experiments](https://factorio.com/blog/post/fff-421):
  independent read work can parallelize, but memory throughput and dependencies
  can erase gains. Judge whole-load measurements, not a microbenchmark alone.

Reference CPU profiles locate hot graph loops, Set insertion, string-coordinate
matching, solar geography Map access, formation evaluation and garbage collection.
Shader compilation also occupies substantial first-frame time; generation
measurements must distinguish it from building the world.

| Experiment | Observation | Decision |
|---|---|---|
| Direct-mapped solar cache; remove redundant cost/temporary record | Io 32.0 to 27.3 s; Garden 22.3 to 24.9 s, noisy exploratory samples | Keep exact cache for combined trials; do not claim a Garden gain |
| Packed ordered edges, exact point index, precomputed probe offsets | All array hashes match; Io 32.1 to 24.1 s; Garden nav phase essentially unchanged | Measure combined pipeline; isolated edge collection is 2.5-3x faster |
| Deck broad-phase before fine terrain; empty feature buckets before domain warp | First Garden load 22.1 to 18.3 s | Verify across repeated and varied worlds |
| Incremental icosphere construction | Same synchronous API and arithmetic; final topology splits now yield through existing boot scheduler | Check output parity and generation long tasks |
| Symmetric flight-edge reuse | Canyon profile shows expensive rift evaluation in clearance tests; each undirected midpoint was requested twice | Reuse its exact Float32 air cost, retaining directed ground costs and every unique probe |
| Lower resolution, fewer flight probes, coarser noise, different seeds | Would weaken requested quality or safety | Not used |

Exploratory profiles include profiler overhead and some concurrent local tool
work. The packed trial retained one external request failure rather than hiding
it. Final timing trials run separately with fresh browsers, matched settings,
alternating order and no profiler. The runner stores failures, actual accepted
seeds and hashes of the complete terrain mesh/colors and persistent navigation
arrays, including adjacency, bridge layers and both flow fields.

Reproduce with `node tools/serve.mjs 8141` in a separate terminal. Set
`WH_NODE_MODULES` to your node_modules directory containing Playwright, then run:

```text
node tools/qa-world-optimization.mjs artifacts/procgen-performance/recheck --reference=e527859 --runs=3 --cases=12345:temperate:varied,2919286854:io:varied,9137:arid:canyon
```

`WH_BASE_URL` overrides the default local source server. `--profile` records CPU
traces, `--legacy` checks the saved-world version-zero field, `--map=pocket`
checks Classic and `--fallback` exercises browsers without scheduler.yield.
Use `--after-only --oracle=<prior-results.json>` to verify a new candidate against
recorded reference arrays without paying for another unchanged reference boot.
Final performance batches must run without another local browser QA workload.

## Measured results

Three counterbalanced trials per version, fresh headless Chrome 152, 1280x720,
same Windows laptop and settings. Medians, not best runs. The machine has an
i9-13900H and RTX 4080 Laptop GPU; user applications were not closed. Raw timing
ranges are retained because this is a working machine, not an isolated lab.

| World | Previous load | Optimized load | Reduction | Navigation phase |
|---|---:|---:|---:|---:|
| Garden, requested seed 12345 (accepted 36102) | 16.620 s | 13.483 s | 18.9% | 14.069 to 10.418 s |
| Io, seed 2919286854 | 21.475 s | 12.926 s | 39.8% | 18.363 to 10.361 s |
| Deep Canyons, requested seed 9137 (accepted 24975) | 61.884 s | 38.907 s | 37.1% | 58.855 to 35.290 s |

Median longest generation task: Garden 593 to 354 ms; Io 743 to 213 ms;
Deep Canyons 854 to 419 ms. Every matched pair improved in this final batch.
First-frame shader compilation still causes longer tasks (roughly 1.7-3.1 s
in this fixture) and is reported separately, not hidden as a terrain improvement.
JS heap readings vary with garbage-collection timing; no memory percentage is
claimed from those readings. Physical phones, thermal behavior and low-memory
devices are not certified by desktop timings.

All nine measured pairs exactly match every recorded generated array and anchor.
[Raw trials](PROCGEN-PERFORMANCE/timing-results.json),
[parity](PROCGEN-PERFORMANCE/timing-parity.json),
[summary](PROCGEN-PERFORMANCE/timing-summary.json).

## Correctness and visual review

- 397/397 automated tests and 142/142 module syntax checks pass; style gate clean.
- [Terrain matrix](PROCGEN-PERFORMANCE/terrain-parity.json): five further exact
  before/after pairs, covering arid canyons, frozen peaks, ocean islands,
  suspended sky terrain and geographic Earth. These ran alongside lifecycle QA;
  their timings are not used as performance claims.
- [Legacy terrain](PROCGEN-PERFORMANCE/legacy-parity.json) and
  [Classic Pocket World](PROCGEN-PERFORMANCE/classic-parity.json) also match.
- The final edge-reuse revision repeats the remaining checks against those
  recorded references: [four terrain cases](PROCGEN-PERFORMANCE/final-terrain-parity.json),
  [legacy](PROCGEN-PERFORMANCE/final-legacy-parity.json),
  [Classic](PROCGEN-PERFORMANCE/final-classic-parity.json). Combined with the
  timing trials, all 15 final comparisons across nine configurations pass.
  Every final run records source fingerprint
  `74a34d7b258a14c8594b5bffcfaa61a005b910ce05b1a55cc04a72b448fd83d3`.
- [Ten browser lifecycle checks](PROCGEN-PERFORMANCE/lifecycle.json): campaign
  version persistence, capture snapshot, actual lobby-to-Earth launch, ground
  routes, held movement, climbing a fitted overlook with real collision,
  defense/nest activation, loading a legacy home and Debug World.
- [All 20 approved reference files](PROCGEN-PERFORMANCE/approved-baseline.json)
  retain their locked hashes. No recipe, noise, resolution or save version changed.
- Visually inspected paired canyon and sky screenshots: the same silhouette,
  shelves, canyon edges, bridge decks, vegetation placement and palette remain.
  Dynamic particles, water and slight camera settling prevent pixel-identical
  screenshots; generated mesh and color buffers are byte-identical.

- [Final quake oracle and two live commits](PROCGEN-PERFORMANCE/final-quake.json): zero
  mismatches in all nine predicted/applied arrays; disrupted nests destroyed,
  tower edits during warning retained/excluded from paths, both commits resume.
  Largest measured commit slices were 12.6 and 3.7 ms. This is a regression
  measurement, not a claimed quake speedup against an old release.

The first isolated canyon comparison also regressed (50.3 to 58.0 s), so release
was held. A profile located repeated rift evaluation during edge clearance.
Reusing symmetric air-edge results retains all terrain checks and directed
uphill ground costs; the next isolated pair was 59.7 to 57.9 s with exact array
parity. The final three-trial batch above confirms a gain for all three worlds;
all final output arrays still match. The earlier two-world timing batch is kept
in `intermediate-timing-*.json`, superseded by the final edge-reuse measurements.
The second pre-fix reference sample overlapped profiling and is retained as
contaminated, not included in speed claims. Public verification is pending.
These checks are instrumented fixtures, not an unassisted full-campaign playthrough.

Publication gate: 397 tests, 142 parsed modules, house style, 251 generated
mirror files and the 144-module standalone bundle pass. Runtime changes and
evidence are ready for the review PR and V2 deployment. Main stays `6133d07`.

Integration note: preview advanced to `ec7320d` with the separate art collection
and UI review routes. Preserve those additions and merge their deployment
manifest before publication. Performance tracker IDs were moved from U205-U208
to U209-U212 because the concurrent art work used the same range.

Combined integration verification: 397 tests, 143 parsed source modules, style,
294 mirrored files and the 145-module bundle pass. Three real-game route and
placement checks plus all 84 art-review browser cases pass.
[Preservation hashes](PROCGEN-PERFORMANCE/integration-preservation.json) verify
all 142 pre-existing optimized runtime modules and 44 collaborator art files
unchanged. [Game](PROCGEN-PERFORMANCE/combined-game.json) and
[art](PROCGEN-PERFORMANCE/combined-art.json) reports retain errors and requests.
Latest art publication receipts from `f3a7763` are integrated as well.
The initial asset hash helper exceeded Node default output buffering for a PNG;
rerunning with a bounded 32 MB buffer completed all comparisons. This was a
verification-harness failure, not a game resource failure.
