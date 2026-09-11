# Terrain routes and planet atlas, September 11

Owner: Codex, `feature/terrain-routes-and-atlas`, based on V2 `525a220`.
U41-U43, tracker #1 and terrain #5. Status: implemented, integration verification underway.

The owner wants defined routes produced by terrain on every planet, an animated
dotted nest overlay covering the globe, and more distinct formations based on
research followed by adversarial review and a finite number of useful iterations.

- U41: moving dotted approaches and a globe-wide terrain/nest habitat atlas.
  Keep exact current-battlefield legality distinct from potential habitat outside
  the current combat graph. Do not silently extend combat range or wave pacing.
- U42: certify visible formation variety and connected terrain routes in actual
  accepted battlefields. Count exposed landforms, not underwater recipe names.
  Preserve dry nest exits, floor-first routing and terrain-based obstruction.
- U43: improve plateau and ravine silhouettes; add distinct new formation
  families, with biome-compatible variants and connected entrances.

Bounded process: one researched implementation pass, then one measured revision
against fixed seeds, counterexamples and visual inspection. Additional fixes
must resolve a concrete failed check, not restart the design loop. Acceptance:
determinism/shape contracts, actual map diversity/connectivity, world-wide atlas
coverage and honest labels, moving dotted lines with reduced-motion support,
real nest traversal, placements, whole legal planet, performance, generated
outputs and public V2 identity/behavior. No perfection or all-seed proof claim.

## Research translated into implementation

| Primary source | Observation | Intended application |
|---|---|---|
| [Minecraft Caves and Cliffs features](https://www.minecraft.net/en-us/article/caves---cliffs-part-ii-the-features) | Terrain shape and biome assignment are separated; cave shapes vary in breadth and branching | Keep geometry independent of biome, and give ravines variable width, asymmetric banks and tributaries |
| [Tectonic creator description and gallery](https://modrinth.com/datapack/tectonic?hl=en-US) | Large ranges, tiered plateaus with occasional ramps, valleys, dunes and connected rivers | Distinct shelves and accessible outlets; add low dune fields and wide valley troughs; retain open connecting routes |
| [Terralith creator gallery](https://www.stardustlabs.net/terralith) | Contrasting terrain silhouettes and biome dressing; volcanoes and dramatic peaks | Add breached calderas and retain tall silhouettes beside lower terrain |
| [Minecraft Badlands](https://www.minecraft.net/en-us/article/around-block--badlands) | Isolated eroded spires, plateaus and terracotta bands | Add clustered buttes with irregular spacing and navigable gaps |
| [No Man's Sky Worlds Part II](https://www.nomanssky.com/worlds-part-ii-update/) | Explicit focus on reducing repeated patterns within a planet, broad plains/valleys and extreme relief | Vary internal shape, orientation, scale and silhouette within a family; measure actual exposed variety |

These are design adaptations, not transplanted algorithms or copied assets.
The existing radial height field cannot represent true tunnels or overhangs;
this batch uses open cuts, breached rims and flooded fractures. Source claims
above are distinct from our implementation choices and runtime evidence.

## Two bounded implementation passes

Pass 1 added the four families, plateau shelf/ramp and ravine branch variation,
strict battlefield certification, the independent globe survey and animated
dots. Primary-source descriptions and the Terralith/Tectonic galleries were
reviewed before these adaptations. No Man's Sky's text was available; its
gallery navigation timed out, so this is not a claim of hands-on reference play.

Adversarial findings retained:

- A new alpine layout exposed a narrow shared ridge saddle at 10.85m. The
  existing continuity test required the connecting spine to stay above 12m.
  Its shoulder is now firmer while its exterior remains zero-relief floor.
- The previous version accepted an alpine battlefield at requested seed
  2387895531 whose nominal second family was an almost invisible low plateau.
  The new certificate counts substantial exposed relief in the actual cap.
- The first overlay was functionally complete but visually covered ground in
  cyan. Pass 2 replaced dense site dots with area outlines and shared route
  trunks, cutting global line vertices from 155,092 to 78,712 on seed 12345.
  Both the rejected and corrected screenshots are retained.
- Highest-point selection made a caldera look like one isolated wall and
  a glacial trough look like a mountain. The landmark survey now seeks actual
  surrounding banks and focuses the lower interior.
- The certificate initially sampled the graph's extra margin. It now excludes
  that margin so an off-battlefield sliver cannot satisfy the variety gate.
- The first native stress probe missed the 1% frame target (34.8ms versus
  33.3ms), and atlas construction recorded a 358ms task. Profiling retained in
  the archive led to shorter cooperative atlas chunks, including the initial
  seventeen route queries. An exact-coordinate cache experiment preserved
  160,000 sampled heights but did not demonstrate a frame-time improvement;
  it was removed. The slower experiment (48 FPS median) is retained, with
  concurrent local workloads noted as a confounding factor. Performance is
  not certified by selecting the best run or changing the acceptance target.

Terrain design stops after these two passes. Further edits are limited to
specific failed checks. Current limitations: radial height field, finite seed
survey, approximate global habitat, owner visual/balance acceptance and broader
device performance. Existing full-campaign acceptance remains open.

## Verification and acceptance boundary

- 271 tests pass, including exact formation/spatial oracles and a synthetic
  mountain belt that separates hemispheres: unreachable habitat remains
  visible without inventing a route across the mountains.
- Four fixed seeds across all four terrain mixes pass 116 field assertions.
  Accepted fields expose three to six substantial families, contain 32 to 293
  sampled terrain passages, and connect 98.15% to 99.99% of dry floor to the
  heart. Peaks span 25m to 103m. Requested/effective seeds are recorded; stricter
  acceptance can select a different effective seed than v3.
- All 99 planet definitions at expedition seed 12345 pass 15,147 isolated
  arrivals from 17 nests at three expansion levels: no stranded enemies,
  floor-network escapes or flying ceiling violations. This is not a full
  campaign completion claim.
- The legal instrumented opening planet wins all 15 waves with 22 heart
  health, 624 kills and 10 destroyed nests, then carries 13 weapons to planet 2.
  Time is advanced deterministically with sparse rendering; no economy,
  health, waves or enemies are injected into this run.
- 96 terrain and 96 placement cases, 64 zoom/automatic-loot cases and 30
  commander/context/path cases pass. The old tower fixture's false tier-cap
  assignment was replaced by actual paid base upgrades. Its failure is kept.
- Inspector tests cover all legal clearings, eight globe octants, asynchronous
  hide/show lifecycle, unchanged combat graph, flowing dots, buffer reuse and
  reduced motion. The globe survey is 40,962 nodes; seed 12345 has 10,267
  potential habitat samples and 55,280 individually valid battlefield nodes.
- 96,000 classic terrain/fine-height/forest/moisture values and four full
  geodesic mesh comparisons exactly match V2 `525a220`. Classic maps retain
  their original landscape and topology.

Performance remains a qualified result. The retained implementation's final
60-second native 720p stress fixture (30 towers, 100 enemies) passed: median
7ms, p95 14ms, p99 20.8ms, sustained simulation and pause recovery. An earlier
run of this terrain missed the 1% target; the rejected cache experiment was
slower. Other local workloads were active during this session, so these runs
are not an isolated before/after speed comparison. No speedup is claimed.

The final atlas probe reduced construction's worst long task from 358ms to
65ms and completed without scene errors. Its median frame was 7ms, but p99
34.8ms missed the 33.3ms target. Keep **atlas frame pacing and broader device
performance open under M0**, alongside full unforced campaign and owner
visual/balance review. This preview is a functionally verified terrain and
inspection checkpoint, not full performance or game release acceptance.

Raw results, selected rendered views and rejected experiments are in
[TERRAIN-ATLAS/](TERRAIN-ATLAS/). Publication and public checks are recorded
below after deployment. Usage unmeasured.
