# Fast planet generation experiments

Owner: Codex. Branch `feature/procgen-fast-sandbox`. Baseline `6b85808`.

| Item | State | Acceptance |
|---|---|---|
| U221 Research and profiles | Verified | Locate remaining work and evaluate primary-source methods |
| U222 Exact-output experiments | Verified fixtures | Preserve every generated geometry/navigation value |
| U223 Visual sandbox and benchmarks | Verified; numeric target OPEN | Paired renders, matched trials, target under 5 s normally and 10 s for stretch cases |
| U224 Integration and public verification | Publishing | Verified V2 only, preserve main and collaborator content |

The targets are goals, not measured claims. Cold generation must be reported
separately from cached revisits and rendering/shader startup. Rejected methods
remain in the record. No resolution, noise, formation or path-safety reduction.
## Methods and research

Primary references reviewed on 2026-09-16:

- [C2ME](https://github.com/RelativityMC/C2ME-fabric): independent generation tasks can run concurrently, but thread-local state and compatibility matter. Applied four bounded workers with independent seeded fields; never share mutable caches or change merge order.
- [Factorio expression compilation](https://factorio.com/blog/post/fff-390): remove redundant intermediate work before changing the algorithm. Applied packed typed input buffers, scalar result copying and an exact early rejection certificate.
- [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects): transfer ownership of sample buffers rather than structured-cloning their contents. Configuration remains cloned deliberately.
- [V8 elements kinds](https://v8.dev/blog/elements-kinds) and [fast properties](https://v8.dev/blog/fast-properties): keep hot storage predictable. Avoid boxed point lists and millions of tiny subarray views.
- [FastNoise2 graph architecture](https://github.com/Auburn/FastNoise2/wiki/Node-Graph-Architecture): fused SIMD noise is attractive but replacing this game's arithmetic could change output. Not adopted without an exact-equivalence implementation.
- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html): asynchronous shader compilation is a separate first-frame opportunity. Not counted as a world-generation speedup or implemented in this experiment.

## Experimental record

All times below are exploratory single runs unless explicitly identified as final matched trials. They are not comparable to older sessions on this machine without matched controls.

| Experiment | Observation | Decision |
|---|---|---|
| Delay rift angular math until footprint rejection | Canyon 55.01 to 55.44 s; exact arrays | Reverted; no measured benefit |
| First clearance bound attempt | 53.45 s, but replacement missed a CRLF anchor and bound was NaN | Invalid experiment; no conclusion about the method |
| First parallel bootstrap | Wrong insertion loop caused a boot failure | Fixed; retained failure evidence |
| Native worker imports | Bare Three import failed; serial fallback completed exactly in 20.48 s | Fixed transitive imports; not parallel timing evidence |
| Parallel vertex sampling | Garden 15.19 s; exact arrays | Promising single run |
| Parallel vertex, flight and edge sampling | Matched Garden 17.69 to 15.66 s; canyon 59.39 to 35.97 s; exact arrays | Continue |
| Packed buffers and activated conservative bounds | Garden 12.11 s; canyon 29.63 s; 165,879 main-thread clearance shortcuts | Continue; activation measured |
| Exact early floor-connectivity rejection | Canyon 21.58 s; same accepted seed and all arrays | Continue into repeated trials |

The early test only rejects candidates which cannot meet the existing 95% dry/deep floor connectivity gate. It performs breadth-first reachability on the same full-resolution graph from the same heart, with the same finite costs, floor eligibility, blockers, cap and authored-pit exclusions. It never accepts a world; successful candidates still execute all existing portal, nest, surface and route checks. No seed search order, polygon count, noise function, feature selection or acceptance threshold is reduced.

Height shortcuts are conservative and opt-in. Unknown recipes, solar planets, floating worlds and active faults use the detailed clearance calculation. Failed/unavailable workers return to serial sampling. Workers terminate after navigation initialization. Saved worlds still need explicit broad coverage before promoting the option to the default.

## Scope and remaining target

The sandbox is selected with `generation=parallel`; normal gameplay remains serial. The worker approach consumes additional peak memory. Desktop measurements are not mobile certification. The single-file build uses serial fallback if the opt-in worker URL cannot resolve from a data module.

Under 5 seconds normally and under 10 seconds for stretch cases remain OPEN until measured. Next likely work is avoiding repeated full graph construction during rejected candidate searches, without changing which candidate wins. SIMD noise replacement, coarser navigation and reduced detail are not accepted substitutes for the output-preservation requirement.
## Repeated desktop results

Three trials per fixture/version, fresh Chrome 152 processes, alternating before/after order, i9-13900H (14 cores / 20 logical processors), localhost. No competing benchmark or full test suite was run during this batch. Other desktop applications were not controlled. Times cover navigation to boot completion, including initial rendering; they are not pure CPU kernel times, mobile measurements, cached revisits or public network-load claims.

| Fixture | Serial median | Candidate median | Reduction |
|---|---:|---:|---:|
| Garden 12345 / Mixed Landscapes | 16.273 s | 13.730 s | 15.6% |
| Io 2919286854 / Mixed Landscapes | 17.592 s | 9.919 s | 43.6% |
| Arid 9137 / Deep Canyons | 56.595 s | 22.630 s | 60.0% |

[Raw trials](PROCGEN-FAST/final-results.json), [9 exact comparisons](PROCGEN-FAST/final-parity.json), [402 tests](PROCGEN-FAST/tests.txt), [hardware](PROCGEN-FAST/hardware.json).

Every accepted seed, node count, heart and portal list matched. Hashes cover all persistent navigation arrays, layered/deck surfaces, ground and flight flows, terrain vertices, colors and fog geometry. Search scratch arrays are excluded. This is exact generated-data equality for tested fixtures, not an assertion of exhaustive seed-space correctness.

Visual assessment: Garden's volcano, icy rim, water boundaries and fitted terraces match; Io's crater rims, lava cuts, yellow mineral surface and dressing remain intact; canyon cliff faces and tiered shelves retain their shapes. Animated stars/effects and the camera settling between frames can differ. Captures are full game renders at 1280 x 720, not reduced demo meshes. The wipe page provides the paired captures and interactive world links.

The earlier bound attempt is explicitly invalid rather than falsely described as a negative result. The original failed worker runs remain in the raw experiment files. Measurements from successful serial fallback are never labeled worker speedups.
## Compatibility and fallback

Four additional matched worlds preserve exact output: frozen/alpine (44021), oceanic/ocean (12345), skyarchipelago/sky (12345), Earth/varied (12345). Starter Earth homeworld and legacy terrain-version generation also match. An injected Worker-constructor failure boots successfully through serial fallback and matches the Garden oracle exactly. These checks are fixture-based and do not certify every possible saved world or mobile memory limit.

The sky case was slower in one trial, 15.268 to 17.660 seconds. It is retained prominently in the sandbox as a counterexample. No claim is made that workers improve every planet. The option remains experimental and is not the default.

Visual capture correction: the first canyon/sky pairs caught different points in the camera's settling motion. The comparison harness now advances only the camera to a settled state before capturing; it records the camera transform. This happens after boot timing and generated-data hashing, and does not change the measured medians or terrain. The first mobile UI probe also observed a not-yet-decoded image; the checker now waits for both images and explicitly fails zero-width captures.

Further visual QA: settling the orbit rig was insufficient because the route transports its heading. Fixed-camera captures now have exactly matching position/quaternion/FOV for canyon and sky. The raw first attempts remain retained. Later sky capture runs were faster; that variability reinforces why its first regression is retained without a general claim.

The local direct-runtime check (no source interception) matches the canyon oracle, activates 36 worker batches without failures, and compares clearance with/without the shortcut at 1,049 graph points both before and after a terrain fault. No differences; fault activation disables all shortcuts. Camera checks also pass. Desktop and 390px comparison UI checks pass with both images decoded, keyboard-operable wipe and no horizontal overflow.

Integration: the concurrent artbook used U217-U220 too. This experiment is renumbered U221-U224; earlier issue comments retain their original historical IDs. Preview d96576d is preserved in full. Generated dist conflicts are rebuilt from the combined source, not hand-merged.
