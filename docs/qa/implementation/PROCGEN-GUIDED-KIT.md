# Guided terrain kit experiment

U195-U198. Codex on `feature/procgen-guided-kit`, 2026-09-16. Published at
`2fb6ddf297a64edcb6c9257156d0fe78f99eccd0`; public identities and runtime verified.
Tracker: GitHub issue #1. V2 only; main remains release `6133d07`.

## Reference review

[Game Dev Buddies, How One Guy FIXED Procedural Generation](https://www.youtube.com/watch?v=Y19Mw5YsgjI),
12:08. Reviewed the complete timestamped English narration through 12:06 and
183 ordered visual samples across 00:00 through the closing frame at 12:07.
This is full-span transcript and sampled-frame analysis, not continuous video
playback or an audio listening claim. Raw video, captions and contact sheets
remain in ignored local `artifacts/procgen-reference/`; they are not published.

- 00:00-04:02: authored tiles preserve deliberate silhouettes; center-based
  occupancy makes matching inner and outer corners awkward.
- 04:02-06:17: four shared corner states yield 16 masks, reducible to six
  symmetry classes. Shared boundaries put transitions inside each piece.
- 06:17-08:06: variant pieces and cage deformation reduce visible repetition.
  Interpolating the same corner handles preserves compatible edge positions.
- 08:06-09:55: pair neighboring triangles, subdivide triangles and quads once
  with shared edge midpoints, then relax the resulting all-quad mesh.
- 09:55-11:10: match several neighboring cells to fit a larger authored landmark.
  A changed constituent cell must invalidate the whole matched pattern.
- 11:10-12:08: model synthesis and Wave Function Collapse are related extensions.
  WFC is mentioned, not implemented or explained fully in this video.

[Gumin's original WFC repository](https://github.com/mxgmn/WaveFunctionCollapse)
also distinguishes local compatibility from additional global constraints.
Our inference: matching edges alone cannot certify routes or useful tower sites.
This slice implements its own grid and profiles, without the creator's paid code.

## Comparison contract

Current Worldheart already uses authored formation recipes, warped regions,
connected shared valley floors and navigation acceptance checks. The control
must sample `createFormationField`, not a deliberately weak random-noise stand-in.
The experiment targets local cliffs, routes and build ledges, preserving the
existing global generator as its input. Climate, full spherical seams, campaign
navigation, saves, enemies and generation scheduling are outside this slice.

Both sides share seed, sampled planet area, footprint, mesh sampling, camera,
lighting and objective anchors. Candidate-only operations are explicitly named:
irregular dual-corner terrace profiles, reserved route clearance and an optional
multi-cell overlook. Flat patch projection and bounded demo navigation are
limitations, not evidence that the full spherical game is already integrated.

Acceptance before publication: deterministic seeded output; manifold shared
quad topology and non-inverted cells; equal edge positions from incident pieces;
actual rendered surface route/clearance checks; visible authored shape difference;
input-driven scouts and commander traversal; regenerated resource cleanup;
desktop and touch layout/input smoke checks; measured local generation cost;
successful V2 Pages identity and runtime verification. Reject or qualify failures.

## Work list

- U195: complete reference analysis and architecture comparison. Done.
- U196: seeded comparison core, input-driven local demo. Verified.
- U197: adversarial seeds, rendering and interaction review. Verified.
- U198: publish isolated V2 slice and verify public identities/runtime. Complete.

## Implemented slice

`procgen-lab.html` samples source region 0 from the current production formation
field at radius 240, projected onto a dry, approximately 180 m local hex patch.
Both sides use the same seeded triangle pairing, shared subdivision and convex
relaxation. The control evaluates current terrain at all mesh samples; the
candidate adds shared-corner height-band profiles, ten-metre route reservations,
and a multi-cell overlook with a checked ramp. Sixteen corner masks are handled
by one continuous profile. No external mesh kit or WFC library is used.

The camera is synchronized. Click/tap the ground to move commanders, Send scouts
to traverse every reachable approach, or Visit overlook to walk its ramp.
Keyboard/drag orbit, wheel and button zoom, seed sharing, three terrain presets,
grid overlay, reduced motion and a pause control are included. Generation runs
in a replaceable worker. Old geometry and light shadow maps are disposed on each
replacement. The Debug World links to the experiment. No storage is read/written.

## Measured evidence and limitations

- [Seed survey](PROCGEN-GUIDED-KIT/seed-survey.json): six seeds including 0 and
  uint32 maximum, across Mixed Landscapes, Badlands and Deep Canyons. All **54/54**
  guided approaches connect, compared with **42/54** source-field approaches in
  this fixture. These are deliberately fixed comparison objectives, not the
  campaign's accepted nest positions. This does not establish twelve game bugs.
- 64 grid seeds pass manifold edge counts, convexity, Euler topology, inverse
  mapping and deterministic replay. All 16 corner masks pass boundary tests.
  Measured piece seam error is zero in all 18 sampled worlds; both sides have
  the same 40,960-41,216 terrain triangles. This is not a polygon optimization.
- Five overlooks pass their rendered-surface route check; seven spatial matches
  are rejected and rebuilt once without the inaccessible stamp. Six have no
  geometric match. No retries change the seed or fabricate a landmark.
- [21 local browser checks](PROCGEN-GUIDED-KIT/local.json): actual pointer/keyboard
  and touch input, commander traversal, overlook ramp, all 18 scouts reaching
  their destinations in real time, pause, seed changes, cancellation, three
  rendered presets, responsive layout, no storage writes, no runtime errors,
  and stable GPU geometry/shadow texture counts after regeneration.
- [383 automated tests](PROCGEN-GUIDED-KIT/tests.txt), 139 parsed modules and
  house style pass. Generated V2 mirror: 248 identical source files.
- [Local browser timings](PROCGEN-GUIDED-KIT/local-metrics.json): approximately
  0.35 s / 0.48 s / 0.37 s worker construction plus navigation for seed 12345
  across the three presets. The separate Node survey ran alongside other tests,
  so its timings are explicitly contended. Neither is a mobile hardware or full
  planet benchmark. Main-thread first GPU upload is not included in worker time.
- Body clearance and flat-site figures are sampled slope checks (1.2 m / 3 m
  radial probes), not a complete campaign collision or tower-placement oracle.
  The inspector does not simulate combat, water, climate, overhangs, saved games,
  spherical chunk seams, or all 99 planets.

## Failures retained and resolved

The first route prototype allowed objectives/corridors too close to the patch
boundary. Shared fixed objectives are now inset; corridors include room for the
sampling lattice and unit radius. The first overlook ramps were too steep or
cut neighboring cliffs. Longer ramps are independently checked and failed fits
are omitted. The uint32-maximum canyon seed exposed Newton inversion escaping
skewed quads, producing false ground holes. Analytic inversion fixes that failure
and substantially reduces lookup work. A strict floating-point symmetry assertion
was corrected to a 1e-12 tolerance; actual seam checks remain in place.

[The initial browser receipt](PROCGEN-GUIDED-KIT/pre-fix-runtime.json) records
20/21 passing: shadow textures leaked on regeneration. Explicit shadow disposal
fixes the leak; the subsequent equal-seed repeat check passes. Initial mobile
framing cropped the patch, so the camera now accounts for narrow aspect ratios.

## Visual judgment

Inspected [Mixed Landscapes](PROCGEN-GUIDED-KIT/varied.png),
[Badlands](PROCGEN-GUIDED-KIT/badlands.png), [Deep Canyons](PROCGEN-GUIDED-KIT/canyon.png),
[shared grid](PROCGEN-GUIDED-KIT/shared-grid.png),
[walked overlook](PROCGEN-GUIDED-KIT/overlook-walk.png) and
[mobile layout](PROCGEN-GUIDED-KIT/mobile.png).

The candidate reads as deliberate cliff shelves and connected routes. The
canyon comparison is especially legible, but its protected routes sometimes
form conspicuous causeways across depressions. Blanket height quantization also
creates excessive stairs on large cliffs. Seed 12345 Mixed gains flat samples
343 to 383 while losing raised flat samples 65 to 56; more terraces do not
automatically mean more useful tower sites. Sparse trees are display dressing,
not new biome distribution, and some high ledges remain intentionally inaccessible.

Recommendation: adopt the shared-boundary and multi-cell fit contracts for local
terraced rock/coast/landmark recipes, keep the current macro generator and its
natural ridges, and preserve canyon-floor routes instead of universal zero-height
reservations. Before campaign integration, transfer those constraints to the
spherical surface, use slope-limited floor-following corridors, integrate the
actual nest/tower/commander navigation contracts, add locality/invalidation tests,
and measure representative real mobile hardware. WFC and whole-planet tile
replacement are not justified by this bounded experiment. Owner visual acceptance
is still pending; the demo exists to make that judgment concrete.

## Publication

[V2 terrain workshop](https://majieddd.github.io/worldheart/v2/procgen-lab.html?seed=12345&terrain=varied)
is published from `2fb6ddf`. [PR #58](https://github.com/majieddd/worldheart/pull/58)
is open for review, not merged. The [Pages action](https://github.com/majieddd/worldheart/actions/runs/35069534695)
succeeded. [All 21 public browser checks](PROCGEN-GUIDED-KIT/public.json) pass,
including real-input movement and the complete scout traversal. The public
[comparison render](PROCGEN-GUIDED-KIT/public-comparison.png) was inspected.
Main remains `6133d0713f4e93e6fc743c35d9dd0fd1834bc98f`.
[All 491 public/source identity checks](PROCGEN-GUIDED-KIT/public-identity.json)
pass for the combined deployment, including the stable root and the new preview
entry/modules. This closing evidence is committed to the review branch; the
published runtime remains the tested `2fb6ddf` snapshot.
