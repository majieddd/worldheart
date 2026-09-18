# Siria: complete painted-model production path

## Scope and reproduced failure

Owner: Codex. Branch: `fix/asset-shape-budget`. Asset Studio project
`6a20e617fc92` (Siria), source paint `paint-1789726025.glb`.

The main Prepare motion action still entered `model_worker.py`, which deliberately
rejects unrigged geometry after removal of the generic proximity rig. The validated
MIA/Mixamo implementation was available only through the separate research page.
The Motion tab was also disabled until an animation already existed. The owner's
paint was valid and retained; regenerating paint would not fix either problem.

## Changes

- Main Rig and animate now runs local MIA prediction, paint-preserving binding,
  captured walking retarget and contact/seam checks. One worker owns the whole
  sequence. Existing fitted profiles and authored imported clips retain their path.
- Static imports are classified from their actual GLB skeleton/animation data.
- Rig & Motion is accessible when shape or paint exists. The painted source stays
  visible before motion exists. Review then unlocks Polish & package and export.
- Candidate history, source/capture hashes, timings and failure diagnostics remain
  saved. Main UI displays a concise error instead of repeated tracebacks.
- New concept packets include a separate identity-locked T-pose. Existing projects
  can create a supplement without changing their accepted model or approvals.
  MIA consumes the mesh; the 2D T-pose is explicitly a fitting/review guide.
- Aegis research-engine method supplemented, installed as
  `3.18.13+codex.20260918112917`, and installed workflow smoke passed.
  Plugin PR #14 remains open; the installed workflow smoke passed.

## Verification

74 Studio unit tests passed, including main-route worker orchestration, rejection
without destructive output replacement, approval/export gates, static-import
classification and T-pose supplementation. These use mocked inference and are not
visual acceptance. Game suite: 408 tests; source syntax: 168 modules; house style pass.

Live main-page action and final-page browser checks passed with no console errors.
Rendered rest pose and four walk phases from front, back and profile. The first
learned rig exposed fused arm sheets and a foot plinth; source-preserving binding
now records removed faces, seals cuts, verifies retained UVs/pixels and normalizes
sole foot/toe influence. Failed candidates remain separately identifiable.

Final walk: minimum soles 0.00300 m on both sides; stance travel p95
0.16683/0.14514 m/s; loop position gap 0.000000803 m; loop velocity p95
0.22233 m/s. Measurements do not certify the remaining visual issues below.

The initial 237.0 MB downloaded ZIP passed CRC and network/file SHA equality. It contains
GLB, Blender, FBX, paint, references, the generated T-pose guide and timing receipts.
Polished GLB is byte-identical to the reviewed walking GLB. Original paint SHA-256
remains `3fedf21aba6fa6ca4f37f03bd69d97ccd7fbb3c810f2a9da2621272357f02999`.
Final local project: http://127.0.0.1:8773/?project=6a20e617fc92

### Time and retained failures

Measured implementation/validation window: 10:18-11:44 UTC, about 86 minutes,
including edits, diagnosis, checks and waiting for other local jobs. Publication
is additional. These are wall-clock timings, not token/billing estimates.

| Successful step | Time | Qualification |
|---|---:|---|
| Rig prediction reuse and repaired binding | 17.062 s | Existing source-bound prediction, not fresh inference |
| Captured walk plus contact/loop checks | 43.752 s | Final repaired rig |
| Main rig-and-walk stage | 62.150 s | Includes the two nested steps above; do not double count |
| T-pose concept guide | 175.206 s | Includes two additional side references; guide only, not shape conditioning |
| Polish/packaging worker | 7.484 s | Archive streaming/verification is additional |

First packaging attempt hit an ENOSPC write error. Disk availability had recovered
when checked; atomic GLB copy and free-space preflight were added and retry passed.
No user models were deleted. Two optional single-figure T-pose retries failed:
Comfy dynamic-memory HostBuffer I/O, then native access violation with dynamic
VRAM disabled. Original runtime flags were restored and the server restarted.
The revised front-conditioned route subsequently succeeded in 108.682 s. It still
includes side figures beside the full front T-pose. An automatic isolation trial
failed visual inspection and was removed; the intact guide remains review-pending.
New-packet schema/prompt/resume behavior is unit-tested.

Other native workers are never stopped mid-job. Main actions can now queue behind
another job owned by the same Studio process, using its single executor; an
external runtime's jobs remain blocked. Queue ownership/re-entry are tested.

### Remaining quality limits

The walking candidate is agent-reviewed for export testing, not owner-accepted
production art. Side/raised-arm views retain rough geometry and cap paint around
hips/holster and underarms. Boots and seam metrics pass, but these source regions
still need a cleaner open-limb reconstruction or fitted surface refinement.
The generated guide is reference material; MIA consumes the mesh, not the PNG.
No automatic fix is claimed to produce arbitrary commercial-quality characters.

## Acceptance

Machine verification, agent visual review and owner acceptance remain separate.
No claim of commercial-generator parity. Prior source/paint files remain intact.

### Storage interruption after validation

The drive filled again during final cleanup. The regenerable ZIP and one hash-verified
duplicate source intermediate were removed; original paint and final GLB/FBX/Blender
files remain. JSON saves now use unique temporary files, flush and atomic replacement.
ZIP exports preflight space, write a temporary archive and retain the prior ZIP if a
write fails. Regression tests cover both failure paths. The truncated test source was
restored and all 74 tests passed. A fresh ZIP needs free disk space; the earlier
verified archive is not currently on disk. Direct final model downloads remain usable.
The owner was asked to pause large downloads and free 10 GB.

Final local verification at 12:09 UTC: 111 minutes from the measured 10:18 start,
including all repair attempts, concurrent-job waits and storage recovery. Latest UI
reload passed with no console errors, the final GLB returned HTTP 200, and ZIP export
returned the intended HTTP 507 with 25 MB free. Code checkpoint: 9f3b3c0 on PR #76.
Public game files did not change; no destructive mirror rebuild was attempted on
the full drive.
