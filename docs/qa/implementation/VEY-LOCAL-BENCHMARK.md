# Vey local benchmark / U237-U239

Status: published and publicly verified review candidate.
Owner acceptance and Tripo-equivalent quality are not claimed.

## Publication receipt

Published and publicly verified at V2 `7db5236` ([PR #68](https://github.com/majieddd/worldheart/pull/68), [Pages run](https://github.com/majieddd/worldheart/actions/runs/35189473724)). All 24 deployed files match the committed V2 bytes; live desktop/mobile motion checks pass with no console errors. Main remains `6133d07`. Total through public verification: **2h 48m 43s**, including failures and overlapping setup. [Every measured step](VEY-LOCAL-BENCHMARK-TIMING.md).

[Open the comparison](https://majieddd.github.io/worldheart/v2/design-demos/99-planets/vey-benchmark.html?stage=motion).

## What changed

- Ran Modly's open-source Trellis.2 GGUF shape and texture engine on the existing
  approved identity. No new concept-generation credits were spent.
- Preserved the old pilot; added a separate comparison with unpainted shape,
  raw texture, corrected paint, and animated Vey. Fixed default facing and exposed
  front/side/back controls, outline strength, walk/run/idle, and moving ground.
- Saved Vey-specific palette, eye/badge detail and source-rig transfer recipes.
  The raw texture's brown skin/yellow guards were rejected. This is supervised
  finishing, not proof of universal automatic painting or rigging.
- Added SHA-bound shape/paint/motion checks, reference invalidation, failed-stage
  blocking, stale export protection, seven reference slots and stage timing
  receipts in the local studio. Preserved the original engine choices/defaults.
- Added optional silhouette masking in the shared viewer; original hull mode
  remains the default for previous studies. Old pilot browser regression passed.

## Measurements and evidence

Current source assets: lib/99-art/vey-benchmark-v1/manifest.json and timing-ledger.json.
Full local logs/screenshots: artifacts/vey-quality-research/.

| Stage | Measured elapsed |
|---|---:|
| Benchmark inspection and route selection | 6m 18s |
| Initial isolated engine setup | 64m 36s |
| Selected Q5 weights | 72m 56s (overlaps setup) |
| First failed engine launch | 14.21s |
| First successful shape inference + process startup | 5m 24s |
| Topology reduction | 55.31s |
| First texture trial | 64.27s engine time |
| Stronger-reference texture trial | 66.63s engine time |
| Palette correction | 3.14s process time |
| Eye/badge detail and UV padding | 5.85s |
| Final rig/clip rebuild | 3.86s |
| Final independent deformation/stance sampling | 3.22s |

The JSON ledger contains additional repairs, failed skinning, intermediate tests,
render checks, UTC timestamps and the checkpoint wall duration. Parallel durations
must not be summed. Repeatable processing excludes research, code changes,
installation and human review. A single asset is not a batch timing estimate.

The final adapter texturing trial also passes its technical checks; an identical cached replay takes 0.21 seconds without inference.

402 repository tests and 23 Python pipeline tests pass. Syntax/style checks pass.
The release model has 39,938 triangles, an embedded 2048px atlas, 22 bones and
exactly three clips. The shape copy has 39,999 triangles. Vertex counts grow at UV
seams during export; polygon count alone does not prove likeness or performance.
Browser checks cover live GLB loading, full-cycle sampled pelvis movement, seam,
cadence, transitions, old-viewer regression and narrow-screen layout. No browser
console/shader errors were reported. Motion probes use explicit rest-space toe
contacts and check sampled cross-limb edge stretching; these are diagnostic
thresholds, not a certificate of natural motion or collision-free animation.

## Failures preserved and corrected

1. Tripo's owner model rendered in Chrome but export returned 403. The benchmark
   was visually inspected; its downloadable geometry was not obtained.
2. Upstream setup chose cp312 CUDA wheels for a cp311 environment and still exited
   zero. Two upstream wheel folder names also confused pip. Targeted repairs and
   real imports were required before inference could run.
3. First generative texture was muddy and changed the palette. Stronger guidance
   alone did not fix the colors; a separate Vey finishing recipe was required.
4. Automatic heat weighting left the new mesh unbound. The gate rejected it.
   Same-character barycentric source-weight transfer passed the retained checks.
5. Imported source actions caused duplicate exported clips. Orphan actions are
   now removed before the new capture retarget is authored.
6. Initial stance sampling used joint origins rather than contract toe tips.
   That could falsely fail a run because of toe rotation. The correction and
   shared-direction negative controls are retained; no threshold was relaxed.
7. Render inspection found dark marks; disabling outlines showed some were baked
   into the generated paint. Face-normal cleanup and silhouette masking are
   separate from texture quality. Do not claim all surface marks are fixed.

## Remaining acceptance

The candidate is substantially different from the old pipeline but remains a
review study. Face likeness, surface polish and finger articulation need owner
judgment. No finger/facial/attack animation or Roblox import acceptance is claimed.
The generic automatic studio biped is still a draft; the supervised Vey rig is not
silently substituted for every character. Its paint/rig recipe is saved for reuse
if the owner accepts it. The Tripo page is proprietary P2.0; public TripoSG is a
separate shape model and was researched, not run in this trial.

## Source research

- https://github.com/lightningpixel/modly-trellis2-gguf-extension
- https://modly3d.app/docs/models
- https://github.com/microsoft/TRELLIS.2
- https://huggingface.co/Aero-Ex/Trellis2-GGUF
- https://github.com/VAST-AI-Research/TripoSG
- https://github.com/IgorAherne/TRELLIS.2-stableprojectorz

Engine commits, fixed seed and weight revision are in the asset manifest. Actual
Modly extension execution is distinguished from desktop-app usage. The separate
Windows 8GB route was researched but not installed. CMU motion attribution remains
in the pilot recipe and on the comparison page.
