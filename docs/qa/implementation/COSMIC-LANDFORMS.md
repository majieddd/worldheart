# Planet climate and cosmic landforms

Owner: Codex, `feature/planet-climate-and-cosmic-landforms`, based on V2
`f50e935`. U48-U51 on tracker #1 and terrain milestone #5. Published and publicly
verified on September 12, 2026 through [draft PR #34](https://github.com/majieddd/worldheart/pull/34).
This ledger does not close broad campaign/device QA.

## Research translated into mechanics

These are deliberately exaggerated, playable adaptations, not reconstructions
of the bodies or a physical climate simulation. No external art is embedded.

| Reference | What is distinctive | Implementation and visual acceptance |
| --- | --- | --- |
| [NASA: Noctis Labyrinthus](https://science.nasa.gov/photojournal/pj-noctis-labyrinthus-3/) | Intersecting valleys with a labyrinth-like plan | Long crossing incisions leave upland islands; must read differently from the branching erosion ravine |
| [NASA: Europa chaos terrain](https://www.nasa.gov/solar-system/newly-reprocessed-images-of-europa-show-chaos-terrain-in-crisp-detail/) | Crustal blocks displaced and rotated relative to one another | Rafted crust uses broad tilted angular slabs separated by gaps; must differ from rounded butte pillars |
| [NASA: Iapetus](https://science.nasa.gov/saturn/moons/iapetus/) | A striking equatorial mountain ridge | A local razorback wall with teeth and a pass, rather than a globe-encircling impassable wall |
| [NASA: Io facts](https://science.nasa.gov/jupiter/jupiter-moons/io/facts/) | Active volcanism, lava lakes and fresh flows | A crater lake feeds a visible downhill lava channel; moving crust pattern uses one material uniform, with no new particle system |
| [NOAA: global circulation](https://prod-01-alb-www-noaa.woc.noaa.gov/jetstream/global/global-atmospheric-circulations) | Wet equator, dry subtropics and different circulation belts | Broad moisture belts and equator-to-pole cooling dominate smaller longitude noise |
| [NASA: habitable zone](https://science.nasa.gov/exoplanets/habitable-zone/) | Stellar energy and orbital distance affect surface conditions | Seeded M/K/G/F star, luminosity and distance give flux L/a^2, which shifts temperature; water inventory and tectonics remain separate |

The new Great continental rift has a much longer floor and longitudinal ramps.
Noctis labyrinth crosses its trunk with offset faults. Rafted crust is angular;
Razorback is a narrow wall; Canopy highlands have broad lobed shelves and forest
clusters; Lava spill volcano has a depressed crater and a spill channel.
Existing Winding Canyon, Fault crevices and Branching ravine also cut deeper.

## Decisions and invariants

- Mixed Landscapes stays the default. It reserves one anchor per enabled
  family, then fills the remaining anchors from weighted seeded choices.
  Specialized profiles retain their established range distributions.
- Continental incisions can cross ordinary cell boundaries. The older
  zero-relief shared-border invariant applies outside these explicit cuts.
  They never stack depths additively. Floor/network acceptance still applies.
- Longitudinal ramp budgets limit new rift depth; steep side walls remain
  barriers. Inland negative floors stay dry, with their real movement/raycast
  height. Sea water still uses the continental water mask.
- Planet Mix uses strong latitude bands. Garden, Monsoon, Sunbaked, Frost and
  Ember environments shift their temperature/water/activity and formation mix.
  Water inventory also shifts the continental sea threshold: dry worlds expose
  broader land for inland cuts, while Monsoon worlds have more ocean.
  Explicit climate selection still dresses the same requested planet geometry.
- The environment derives from the requested planet seed, not a retry seed.
  Campaign definitions, inspector history, play links and shared URLs carry
  the same descriptor. Combat and loot RNG streams are untouched.
- Volcanic raised terrain uses the existing Mortar rule. Animated lava adds no
  invisible damage zone. Reduced motion holds the crust pattern still.
- Daylight inspection is a labeled sandbox-only toggle. Ordinary gameplay
  retains its directional sun and uses the generated star's light tint.
- Canopy clusters are instanced and passable, including outside the active
  cap. The additional global budget is bounded at 600 trees.

## Retained findings during iteration

1. The first pure run found the new moisture bands crowded the explicit
   Wetlands preset with jungle. Its wet lowland classification now takes
   precedence over jungle when that preset is explicitly selected.
2. The expanded vocabulary initially omitted a crevice on seed 12345. Mixed
   Landscapes now reserves enabled families before weighted placement. Applying
   that reservation to Giant Peaks diluted its established long ridges; the
   reservation is therefore scoped to Mixed Landscapes, and the original
   specialized ridge checks remain required.
3. An older climate test read the display label `Planet mix` as the planet's
   climate identity. It now checks the environment theme; the seed cohort also
   includes the owner's current 4206018157 world.
4. The old route probe counted negative dry floors as coast. It now reads the
   shared water-depth field, retaining its inland-route threshold.
5. The first controlled renders exposed poor night-side legibility. The
   inspector now provides a daylight toggle; visual acceptance uses that
   declared mode rather than silently changing gameplay lighting.
6. A stricter browser probe found that 95% connectivity across all dry ground
   could conceal isolated deep floors. The old noisy coastline multiplier
   introduced steep dams along otherwise gentle exits. A once-per-seed
   spherical coast-clearance field now caps depth by available shoreward ramp
   distance. Generation separately requires 95% connectivity of deep dry
   floors. The failed five theme cases are retained under `review/results.json`.
7. Visual comparison found raft blocks too similar to butte pillars; their
   height is now capped against footprint. The volcano outlet was cut below
   its lake level, and its hot crater now takes precedence over altitude snow.
   Canopy inspection prefers jungle shoulders instead of a bare summit. The
   final camera review found a snowy polar shoulder still winning in Monsoon;
   the selector now includes the actual biome when ranking forest examples.
8. The first native stress check missed the existing frame budget (48.1 FPS
   median, 55.6ms p99). The attempted profiler lost its Chrome context before
   measurement, so it supplies no bottleneck evidence. Source inspection found
   repeated fixed slab trigonometry and whole-globe rift scans in height
   queries. Precomputed slab transforms and a conservative spatial shortlist
   remove that work. A 60,000-direction before/after comparison is exactly
   equal; an independent exhaustive oracle also checks shortlist boundaries.
   Native results are retained rather than replacing the failed control.
9. The whole-globe atlas kept smooth frame pacing but blocked input during
   construction. Extra yields in contours and long approaches did not remove
   the roughly 1.16-second task. The retained CPU profile identified 1.19
   seconds in `getProgramInfoLog`: first-use dotted-shader compilation. Atlas
   line materials now compile asynchronously outside the visible scene using
   the HDR pass's linear output settings. Renderer state is restored before
   awaiting completion. The cooperative segment work is also retained.

The first ten all-campaign route samples passed 1,530 isolated arrivals, but
that run was stopped during these geometry repairs. They are intermediate
evidence, not acceptance for the final build. Final route coverage uses a
bounded cohort across the five environment themes, plus all-99 pure campaign
descriptor checks. Full 99-planet rendered play remains open.

## Verification status

Initial targeted checks passed the orbital model, latitude dominance, a
252-metre authored rift with a floor below -27m and sub-0.5 entrance grades,
unique numerical shape fields, and theme URL/history behavior. Numerical
differences alone are not visual acceptance.

Initial rendered owner seed: effective 4206041914, exposed continental cut
around -30.4m and Noctis cut around -22.7m. That version preceded the final
family reservations and daylight/forest refinements, so its measurements are
retained as intermediate evidence only. Initial source-controlled UI survey
passed 5 checks with no runtime faults.

Final geometry passed 284 pure tests and 32 controlled browser cases across
the automatic selection and five explicit themes. On the owner's automatic
seed 4206018157, the exposed continental rift reaches -16.7m; 3,908 of 3,909
deep walkable battlefield samples connect to the heart. This is the final
coast-clearance model, with a 0.4 depth-to-clearance budget and an explicit
95% deep-floor connectivity gate, rather than the rejected deeper control.

Six campaign planets (1, 2, 6, 7, 71 and 99) cover all five themes and pass
918 actual isolated enemy arrivals. A legal instrumented 15-wave run on
effective seed 28183 reaches victory with 12 lives, 584 kills and 10 destroyed
nests, then extracts. Simulation advances at 60 Hz with sparse renders; this
is neither blind play nor a frame-pacing measurement.

The final forest selector passes its actual-jungle check. Thirty additional
browser cases cover dry sub-sea commander movement, enemy travel, ray picking,
tower placement, ordinary oceans and six explicit climate presets. All four
terrain profiles pass 29 graph/formation checks. Classic equivalence preserves
96,000 sampled field values and four geodesic meshes across the prior baseline.
The reduced-motion browser case holds the lava uniform at zero.

The [rendered review gallery](COSMIC-LANDFORMS/GALLERY.md) records visual
judgment separately from numerical signatures. The labyrinth is the most
subtle new formation and can be partly clipped by oceans; the review retains
this limitation. Wooded highlands keep traversable shelves and do not promise
a solid canopy over steep or cold terrain.

| Evidence | Scope |
| --- | --- |
| [Pure test output](COSMIC-LANDFORMS/tests.txt) | 284 passing tests, including the exhaustive spatial oracle |
| [Rendered/UI checks](COSMIC-LANDFORMS/visual.json) | 32 cases, six theme selections |
| [Hydrology and biomes](COSMIC-LANDFORMS/hydrology-biomes.json) | 30 targeted browser cases |
| [Terrain profiles](COSMIC-LANDFORMS/fields.json) | 29 graph and geometry cases |
| [Campaign routes](COSMIC-LANDFORMS/routes.json) | Six planets, 918 actual arrivals |
| [Legal campaign](COSMIC-LANDFORMS/legal-campaign.json) | One 15-wave victory and extraction |
| [Classic equivalence](COSMIC-LANDFORMS/classic.json) | Twelve sampled fields and four meshes |
| [Detail and reduced motion](COSMIC-LANDFORMS/detail-review.json) | Controlled overhead renders and held lava pattern |
| [Rejected connectivity control](COSMIC-LANDFORMS/rejected-deep-floor-control.json) | Five failing theme cases retained before coast repair |
| [Exact optimization comparison](COSMIC-LANDFORMS/perf-equivalence.json) | 60,000 unchanged height values, three seeds and four profiles |
| [Native gameplay stress](COSMIC-LANDFORMS/performance.json) | 60 seconds, 30 towers and 100 enemies, native 1280x720 |
| [Earlier failed stress](COSMIC-LANDFORMS/performance-before.json) | Retained 48.1 FPS / 55.6ms p99 control |
| [Interrupted profiler](COSMIC-LANDFORMS/interrupted-profiler.json) | Browser context closed before measurement; no CPU attribution |
| [Native atlas](COSMIC-LANDFORMS/atlas.json) | 7.2ms frame p99, longest construction task 169ms |
| [Atlas interactions](COSMIC-LANDFORMS/atlas-ui.json) | 12 cases: visibility, legal sites, global coverage, route progress, dots and reduced motion |
| [Atlas diagnosis](COSMIC-LANDFORMS/atlas-profile.json) | Shader-log wait accounts for the 1.16-second stall |
| [Yields-only control](COSMIC-LANDFORMS/atlas-yields-only.json) | Extra segment yields alone did not repair the stall |

The optimized native gameplay fixture passes at 144.9 FPS median and 13.8ms
p99, with live simulation and pause recovery. Hardware is the same reported
i9-13900H / RTX 4080 Laptop GPU. These are separate runs; background machine
conditions were not held constant, so the measured difference is not an
isolated causal speedup claim. Full details and load samples are retained.

The final native atlas passes with 7.2ms p99 and a 169ms longest construction
task. Its 40,962 nodes, 91,552 edges, 12,812 potential habitat samples and
95,136 rendered vertices match the pre-scheduling result. Syntax parses
65 modules; all 70 generated mirror files match their source. Broad
manual/device acceptance and full unforced 99-planet completion remain open.

## Published preview

Functional commit `2481d95164d3361ecc07d0aac33a4f263a34e7ba` deployed through
[Pages 34676110272](https://github.com/majieddd/worldheart/actions/runs/34676110272).
The [same seed on V2](https://majieddd.github.io/worldheart/v2/?map=ninetynine&campaign=0&seed=4206018157&terrain=varied&worldgen=1)
passes 54 public browser cases: [32 visual/theme cases](COSMIC-LANDFORMS/public-visual.json),
[10 dry-floor operations](COSMIC-LANDFORMS/public-hydrology.json), and
[12 atlas interactions](COSMIC-LANDFORMS/public-atlas.json). There are no runtime
faults in those runs. Deployed volcano and rift screenshots were also opened
and visually inspected; [the live volcano capture](COSMIC-LANDFORMS/public-volcano.png)
is retained separately from the local gallery.

[214 public asset/source comparisons](COSMIC-LANDFORMS/public-identity.json)
verify the deployed preview and stable root. Main remains
`1374122d1109919a5fab10b69fefdfb80308eb6e`. The documentation handoff preserves
the functional commit's runtime bytes; the tracker and live `v2/build.json`
identify the latest published handoff SHA. No gameplay PR was merged into main.
