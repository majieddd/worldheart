# Modular landforms: implementation and acceptance

September 9, 2026. Owner: Codex, `feature/modular-landform-recipes`, based on
preview `ffb1831`. Status: published and live-verified at
[V2](https://majieddd.github.io/worldheart/v2/), gameplay source `4e1eaf3`,
[PR #27](https://github.com/majieddd/worldheart/pull/27).
[Deployment 34432028998](https://github.com/majieddd/worldheart/actions/runs/34432028998)
succeeded. Main remains `1374122`; documentation follow-ups retain this runtime.
U31 adds grouped reusable formations, separate biome dressing and connected
inland paths. [Recipe architecture and authoring](../../TERRAIN-RECIPES.md).

The prior nest-wave/high-ground and commander feedback batches are already
published. Wider acceptance remains open; this terrain work does not certify
owner art/feel, the full natural campaign, device coverage or multiplayer.

## Current checks

- 251 core/shell/tool tests pass; 53 ESM modules parse; style passes.
- Six new formation tests cover deterministic manifests/order, an exhaustive
  nearest-site oracle, poles/bucket edges, cross-biome/scale reuse, floor joins,
  picking bounds, explicit overrides, exclusions and bad-authoring controls.
- Final shape slice passes 36 fixed-field comparisons with the original
  September 8 pillar baseline. Sampled alpine global peaks are 118-133m.
- All four real-profile audits pass 25 checks. Remote approach samples are
  74%, 79%, 86% and 75% inland for Highlands, Giant peaks, Deep canyons and
  Ocean islands, versus 34%, 54%, 22% and 22% on frozen source `ffb1831`.
  Between 99.98% and 100% of each sampled front's dry floor connects to the
  heart floor network. These are different selected fronts, not paired layouts.
  The final alpine playable front reaches 97.87m; four actual-render galleries
  record selected fronts and their complete recipe manifests.
- All five final map/camera harnesses, four terrain profiles, 96 directed
  placement comparisons, 180 point-route oracles, 19 wave/range/HUD checks,
  22 native-pointer/tree/range comfort checks and 16 nest-attack checks pass.
  Twenty-four continuous spawn headings have zero stuck frames; twelve sampled
  forest sites remain traversable.
- All 99 planets pass 15,147 isolated physical-source arrivals: 17 sources,
  three expansion levels and three movement types per planet. Longest arrival
  is 87.54 simulation seconds. No floor or flight-ceiling violations.
- Fresh legal planet 1 wins all 15 waves with 24 heart health, 542 kills,
  eight towers, 12 nests destroyed and 13 retained weapons. Commander finishes
  with 1389.64 health. Actual extraction reaches planet 2. This is an ordinary
  action policy with deterministic time advance and sparse rendering, not blind
  play or an FPS test. The subsequent alpine-only cap guard does not change
  that played Highlands terrain; the all-99 and camera suites include it.
- Legal continuation on published gameplay source wins planets 2, 3 and 4,
  then extracts into planet 5 with 13 weapons. The cautious policy bought
  talents using earned coins and kept normal movement, combat and wave rules.
  Canyon ends with 20 heart health / 524 kills / 13 nests destroyed; alpine
  with 22 / 554 / 12; ocean with 20 / 609 / 12. Alpine logs 2.3 seconds of
  recoverable controller stalls; all three finish with no runtime faults.
  These four linked victories cover the opening terrain cycle, not all 99.
- Native 720p stress with 100 enemies, 30 towers and continuous camera motion
  passes: median 67.1 FPS, p99 16.6ms. At 4x CPU, median is 63.3 FPS but p99 is
  53.1ms, so the tail-frame budget remains open. Measured startup is 6.14s native
  and 14.52s throttled. These are measurements on one GPU and a newly selected
  battlefield, not lower-end hardware certification or a controlled FPS A/B.
- Moving placement passes 64 legal positions and 280 route validations with
  two retained range geometries. Frame p99 is 8.6ms native / 16.2ms at 4x CPU.
  [Public verification](MODULAR-LANDFORMS/public/results.json) passes 74
  behavior/save checks, 24 spawn headings, twelve forest crossings and four
  rendered profiles matching local seeds, meshes and peak heights. All 95
  preview/original asset hashes match the expected builds.

## Evidence index

[Four-profile manifests and graph audit](MODULAR-LANDFORMS/audit/results.json),
[frozen prior-source comparison](MODULAR-LANDFORMS/before-audit.json),
[all-99 source routes](MODULAR-LANDFORMS/all99.json),
[shape comparisons](MODULAR-LANDFORMS/shapes.json),
[terrain/flight/placement](MODULAR-LANDFORMS/terrain.json),
[legal run](MODULAR-LANDFORMS/legal/run.json) and
[earned planet-2 checkpoint](MODULAR-LANDFORMS/legal/planet-2-checkpoint.json).
The [continued runs](MODULAR-LANDFORMS/continuation/results.json) and
[earned planet-5 checkpoint](MODULAR-LANDFORMS/continuation/planet-5-checkpoint.json)
provide the next collaborator's legal starting point.

Actual rendered inspection views use injected reveal gold and camera placement:
[Highlands](MODULAR-LANDFORMS/gallery/varied-overview.png),
[Giant peaks](MODULAR-LANDFORMS/gallery/alpine-relief.png),
[Deep canyons](MODULAR-LANDFORMS/gallery/canyon-overview.png),
[Ocean islands](MODULAR-LANDFORMS/gallery/ocean-overview.png).
They establish visible shapes, not earned upgrades or natural play.

## Retained failures and corrections

1. First geometry slice: canyon peaks were too shallow (three of 36 historical
   shape comparisons failed), and the alpine inspection mesh showed overly
   blunt tops. Increased canyon bank relief, kept rounded feet and used a
   pointed upper shoulder. The picking shell now derives from recipe maxima.
2. First route audit: 47% Highlands and 45% Ocean approach samples were inland,
   below the new majority-inland requirement. The cap scout had counted water
   in its walkable score and accepted coastal bases. It now prefers dry inland
   floor. This changes the chosen cap/seed; comparisons are generator outcomes,
   not controlled same-layout performance experiments.
3. The new audit initially called a private tangent-basis helper. That was a
   harness error with zero accepted coverage. The repaired tool computes its
   own basis. Failed outputs are retained beside corrected runs.
4. Against the frozen prior source, the same dry-floor connectivity check
   fails Highlands and Deep canyons. Prior source-route success did not prove
   the rest of each battlefield's dry floor was connected. Preserve that older
   route evidence; the new audit asks an additional question.
5. The actual alpine gallery exposed a 43m maximum inside one playable cap,
   despite 118-133m peaks in the global field samples. The scout now requires
   a major peak in the actual Giant-peaks battlefield. Recheck real caps,
   rather than using a globe-wide maximum as evidence of visible spectacle.
6. A swimming comparison selected water by cosmetic height, then carried
   the first input's swim hysteresis into the second input. One start was just
   outside swimming while the next was already swimming. Select a deep
   gameplay-height sample and reset both inputs to the same grounded state.
   This was a fixture defect; the movement/hysteresis rules did not change.

## Resume / handoff

Start with `docs/PROGRESS.md`, tracker #1 and M3 #5. The next open engineering
item is reduced-CPU tail-frame profiling; retain the recorded native/throttled
workload and distinguish sampling-profiler overhead from budget measurements.
Owner composition/scale/animation review, broader seeds, later tactics, wider
devices and full natural campaign acceptance remain open. Resume legal QA with:

```powershell
$env:WH_NODE_MODULES='C:\Users\Majied LaFleur\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
# Reuse port 8139 if the dev server is already running; otherwise start it:
node tools/serve.mjs 8139
# In another terminal, with the same WH_NODE_MODULES:
node tools/self-play.mjs 12345 artifacts/modular-next --campaign --planets=1 --weapons --strategy=assault --cautious --talents --sparse-render --checkpoint=docs/qa/implementation/MODULAR-LANDFORMS/continuation/planet-5-checkpoint.json
```

The saved checkpoint is earned; do not replace it with a later forged state.
The main rename/release and M6 multiplayer/ports remain later readiness work.
Follow the standing V2 workflow for subsequent verified checkpoints. No main merge.
Usage unmeasured.
