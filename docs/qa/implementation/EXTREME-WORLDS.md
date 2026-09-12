# Extreme planets and Debug World

September 12, 2026. Owner: Codex on `feature/extreme-worlds-and-debug-gallery`, based on V2 `009e873`. Tracker #1, terrain milestone #5. U52-U55 cover tower reach, extreme planet themes, thirty distinct formations and a flat feature exhibition.

## Acceptance and boundaries

Use the production registries and geometry builders in the exhibition. Show all authored tower marks, unit species/archetypes, weapon silhouette/era representatives, every formation and biome in separate labeled lanes. Procedural weapon rolls remain selectable representatives, not a claim that every randomized statistic creates a different mesh. The exhibition must not read or write campaign progression.

Base tower reach rises 35%; subsequent authored tier gains halve, and extended tiers use logarithmic growth. Existing reward modifiers are preserved. Preserve the separate elevation bonus, artillery inner exclusion and shared targeting/preview statistics. Extreme themes must visibly dominate while retaining neutral ground corridors and legal nest sites. The owner's follow-up raises the theme minimum to ten.

Add ten geometrically distinct patterns to the existing twenty. Compare actual renders at a common scale and record revisions. Deterministic shape checks, route/placement tests, UI interaction and render checks precede V2 publication. Full unforced campaign, broader device coverage and final owner feel approval remain separate open work.

## Status

- U52-U55: implemented and locally verified, including combat and exhibition performance. Publication pending.
- Publication: pending. Main remains unchanged.

## Research converted into geometry

These are exaggerated playable interpretations, not geological simulations.
No reference assets were copied into the game. The existing twenty include
calderas, dunes, mesas, buttes, ridges, rifts, ravines and chaos blocks.

| Addition | Primary reference | Distinction from the existing library |
|---|---|---|
| Concentric impact rings | [NASA: Caloris basin](https://science.nasa.gov/photojournal/mercurys-caloris-basin-one-of-the-largest-impact-basins-in-the-solar-system/) | Two separated rings, central rebound and radial gates; no volcanic bowl |
| Wind-carved yardangs | [ESA: Sandblasting on Mars](https://www.esa.int/Science_Exploration/Space_Science/Mars_Express/Sandblasting_on_Mars) | Tall narrow parallel rock fins with staggered ends, unlike low Hill Fields |
| Drumlin shoal | [USGS: drumlins](https://apps.usgs.gov/thesaurus/term-simple.php?code=337&thcode=3) | Repeated rounded asymmetric teardrops with long tails |
| Alluvial fan | [USGS: fan research](https://www.usgs.gov/publications/waters-divided-a-history-alluvial-fan-research-and-a-view-its-future) | One apex spreads into a wide scalloped depositional apron |
| Joined karst sinkholes | [NPS: Karst landscapes](https://www.nps.gov/subjects/caves/karst-landscapes.htm) | Rounded dolines with connecting surface throats; no simulated caves |
| Spiral polar troughs | [NASA: South Polar Spiral](https://science.nasa.gov/photojournal/south-polar-spiral/) | Two inward winding cuts, rather than straight or branching faults |
| Penitente blade field | [NASA: Pluto bladed terrain](https://www.nasa.gov/missions/scientists-offer-sharper-insight-into-plutos-bladed-terrain/) | Dense pointed blades instead of broad flat buttes |
| Araneiform star channels | [JPL: Martian spiders](https://www.jpl.nasa.gov/news/nasa-scientists-re-create-mars-spiders-in-a-lab-for-first-time/) | Radially converging channels centered on a vent, unlike a ravine trunk |
| Convection cell mosaic | [NASA: Pluto convection cells](https://www.nasa.gov/solar-system/plutos-heart-like-a-cosmic-lava-lamp/) | Low polygon plates separated by a continuous depressed network |
| Tiger-stripe fractures | [NASA: Enceladus tiger stripes](https://science.nasa.gov/resource/tiger-stripes-up-close/) | Four parallel negative grooves, unlike a single branching crevice |

First rendered review: all ten new shapes were inspected individually at a
common 1:5 scale. Impact's outer wall obscured its inner ring, so its outer rim
was lowered. Inward cuts needed stronger exposed-stone contrast in the gallery.
The initial model lane lacked visible plinths and hid scale relationships;
individual pads and clearer focus distances replace that presentation.
First unit run also caught loss of a major range after vocabulary expansion:
Mixed Landscapes now reserves one major range height without changing authored
overrides. Theme-count and multi-biome-everywhere expectations are updated for
the explicitly requested ten extreme worlds, not silently relaxed.

## Final visual and adversarial review

All thirty isolated production samples were opened and compared. The existing
Glacial trough and Winding Valley were still too similar: the trough now has
a sunken U-shaped bed, asymmetric walls and hanging side valleys. Its measured
8.3m-deep sample was inspected again and the complete ten-theme route cohort
rerun. Negative-relief tests now explicitly require measured incisions and
bounded trough depth; the old nonnegative-trough expectation was obsolete.

All ten whole planets and near-surface views were inspected at the requested
seed `4206018157`, recording any deterministic terrain retry seed separately.
Molten fissures initially read as noisy glitter; a lower-frequency vein field
now produces coherent glowing lines. The palette/scenery distinctions are
visible both globally and near the surface. The nine extreme themes exceed
82% matching themed dry land in 3,000 distributed samples each; Garden retains
its deliberately diverse latitude biomes. This is a fixed comparison cohort,
not a proof that every possible seed has identical coverage.

The Debug World contains 97 exhibits: 11 units, 18 tower marks, 14 weapon
silhouettes, 30 formations, 14 biomes and 10 theme plots. Tests select every
entry through the UI and inspect finite rendered geometry. Runtime checks
also exercise real idle/walk/attack rigs, shared weapon materials, core
selection/restoration, drag, wheel, keyboard, all-lane framing, theme links,
reduced motion and layouts at 375/768/1280px. Save interception confirms zero
storage reads or writes. Initial core selection could display the previous
weapon's choice; the selector now restores each weapon's actual core. Browser
back-cache preservation no longer disposes a retained renderer.

Source review found placement previews still reading the original range table;
they now use `tierStats`, like placed towers. Browser fixtures compare all six
families at the same location, including Warden's surface leash. Two test
harness assumptions were corrected openly: the page has two legitimate Debug
links, and a raised Warden's surface leash is not its attack sphere radius.
Neither correction changed game behavior to satisfy the test.

## Verification scope

- 288 pure tests pass. Syntax: 69 modules. House style passes.
- 118 Debug World browser cases pass, with no runtime faults.
- 40 complete-planet theme/render/coverage cases pass, with no runtime faults.
- 108 cases across four terrain profiles pass placement, real target acquisition, range veil,
  flight, swimming and camera checks, including six preview-to-built comparisons.
- Eleven campaign definitions cover all ten themes and planets 1, 2 and 99:
  1,683 actual isolated enemy arrivals across 17 nest sites, three base sizes
  and three creature types. Route fixtures are not combat acceptance.
- A fresh legal instrumented campaign run clears all 15 waves, defeats the boss
  and extracts to planet 2: requested seed 28183, effective seed 44021,
  22 lives, eight purchased towers, 562 kills, 12 destroyed nests and 13 carried
  weapons. No waves, resources, enemies or health were injected. Simulation
  advances at 60Hz with sparse rendering; it is not a real-time manual run.
- Classic equivalence: 96,000 sampled heights across four classic maps and
  three seeds, plus four navigation meshes, match the previous baseline.
- Native combat stress passes: 60 seconds at 1280x720 with 30 towers and a
  replenished 100-enemy target load, 142.9 FPS median, 14.1ms p99, continuing
  simulation and working pause/resume. Hardware: i9-13900H / RTX 4080 Laptop.
  This injects health, resources and enemies to hold load; it is separate from
  the legal campaign run. It is not a lower-end hardware measurement.
- Native Debug World: two 15-second 1280x720 runs, all-lane overview and animated
  unit lane, both 6.9ms median and 7.1ms p99. All 76 generated mirror files
  match source; the single-file game bundles 71 modules including Three.js.

## Durable evidence

| Record | Scope |
|---|---|
| [Formation comparison 1](EXTREME-WORLDS/formations-1.png), [2](EXTREME-WORLDS/formations-2.png), [3](EXTREME-WORLDS/formations-3.png) | Thirty actual production-field render samples at one display scale |
| [Ten themed planets](EXTREME-WORLDS/themes.png) | Same requested seed, near-surface views; deterministic retry seeds recorded in JSON |
| [Debug overview](EXTREME-WORLDS/debug-overview.png), [mobile layout](EXTREME-WORLDS/mobile.png) | Six separate labeled lanes, responsive controls |
| [Revised glacial trough](EXTREME-WORLDS/glacial-trough.png), [molten world](EXTREME-WORLDS/molten.png) | Accepted visual revisions |
| [Pure tests](EXTREME-WORLDS/unit.txt) | 288 passing tests |
| [Debug UI](EXTREME-WORLDS/debug.json) | 118 runtime cases |
| [Complete planets](EXTREME-WORLDS/themes.json) | 40 runtime theme cases and distributed biome counts |
| [Terrain operations](EXTREME-WORLDS/terrain.json) | 108 cases across four profiles |
| [Campaign cohort](EXTREME-WORLDS/cohort.json), [routes](EXTREME-WORLDS/routes.json) | Eleven definitions and 1,683 isolated arrivals |
| [Legal campaign](EXTREME-WORLDS/legal-campaign.json) | One unforced instrumented victory and extraction |
| [Classic equivalence](EXTREME-WORLDS/classic.json) | Twelve fields and four meshes |
| [Combat performance](EXTREME-WORLDS/performance.json), [exhibition performance](EXTREME-WORLDS/debug-performance.json) | Native load measurements with scope/hardware boundaries |
| [First unit run](EXTREME-WORLDS/unit-first.txt), [trough expectation](EXTREME-WORLDS/trough-expectation-control.txt) | Retained failures and superseded contract expectations |
| [Link selector control](EXTREME-WORLDS/link-selector-control.json), [Warden oracle control](EXTREME-WORLDS/warden-oracle-control.json) | Retained harness assumptions corrected before acceptance |

Reproduce runtime checks with `WH_NODE_MODULES` pointing to a Playwright-capable
Node dependency directory and the local server on port 8139. Run
`tools/debug-world-check.mjs`, `tools/extreme-world-check.mjs`,
`tools/terrain-check.mjs`, `tools/nest-nav-check.mjs`,
`tools/performance-check.mjs` and `tools/debug-performance-check.mjs`.
The two catalogue tools accept `WH_BASE_URL` for the deployed V2 route.

The stronger tower reach is an initial balance revision. Full unforced
99-planet completion, owner feel acceptance, broad seeds/device coverage,
loot-frequency balancing and multiplayer/platform work remain open.
