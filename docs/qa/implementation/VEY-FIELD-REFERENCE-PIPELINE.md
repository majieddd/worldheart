# Vey in the painted frontier / complete reference pipeline

U250-U252. Owner: Codex. Branch: `feature/vey-field-reference-pipeline`.
Published and publicly verified at V2 `109714f` ([PR #72](https://github.com/majieddd/worldheart/pull/72)). Main remains `6133d0713f4e93e6fc743c35d9dd0fd1834bc98f`.

## Delivered scope

- Playable third-person Vey in meadow, canyon and ruins, with two independently animated patrols, beacon and cannon towers. WASD, Shift run, drag orbit, wheel zoom, F free camera and touch movement. Free camera supports Space/Ctrl height. Walk/run speed is tied to measured source travel. Raised paving has a matching ground height.
- Exact accepted Vey GLB reused without edits: `e6dab674a5b106c0e4573580dcea720cfef8d72feac3adea2d777fb3edd1a814`. Owner accepted the walk as usable on September 17. The public acceptance receipt is scoped to that model and walk.
- Local Studio concepts generate a hero, six separate views, palette and walk/strike guide. Per-view checkpoints preserve completed work. Recipe hashes cover hero, brief, settings and scripts; changed or incomplete outputs invalidate pack approval.
- Existing models have an exact-reference route with six orthographic cameras recorded. Export includes hero, complete references, portable prompt, reports and production instructions.
- One button replays the complete fitted Vey surface, sole, paint and articulation recipe. Generic motion remains a draft requiring an anatomy-specific profile.
- Aegis 3.18.10 published at `dcf7323` and installed as `3.18.10+codex.20260917152952`. Added these lessons to the existing reference-pack method, preserving collaborators' work. Portable doctor: 8 pass, 0 fail, 0 warnings. Installed turn-grid workflow passes.

## Evidence

Local logs and images: `artifacts/vey-field/` (ignored evidence folder). Reproducible scene and Studio steps: `field-check.cjs`, `studio-check.cjs` there.

- Scene integration: 25.91 seconds. Walking, running, stopping, free camera/return, three environments, reset, dialog and mobile overflow checks pass. Local last-300-frame sample: median 6.9 ms, p95 7.1 ms, 78 draw calls, 420,470 triangles. This headless sample is not a guarantee for other devices.
- Real browser smoke: entered scene, movement/run taps, selected canyon and toggled free camera; screenshot inspected. Sustained movement assertions use synthetic keyboard events and are labeled as such.
- Studio UI: 6.97 seconds. Exact sheet, all six view choices, motion guide, prompt download, calibrated-camera label, fitted replay action and mobile layout pass; screenshots inspected. Initial harness checked the motion-only action on the Concept tab and failed. The corrected test checks it on Motion. Earlier scene harness invocation/evaluation failures are retained.
- Repository validation: 406 tests pass; JavaScript syntax, style and static build pass.
- Pipeline: 35 tests pass in 4.26 seconds including incomplete-pack rejection, resume without repeating completed views, changed-view approval invalidation and alpha-aware palette extraction.
- Exact pack final replay: 6.844 seconds end to end (6.821 seconds renderer subprocess). Camera and image hashes saved in `lib/99-art/vey-field-v1`.
- Krea pilot front: 145.033 seconds. Rejected after inspection because the short mantle became a long coat and identity details drifted. Remaining batch cancelled; failure preserved in local project `4ae924c8c5ad`. Full generic six-view generation is fixture-tested, not visually certified from this rejected pilot.

## Quality boundaries

The field scene is a locomotion/appearance slice. Combat and per-foot slope IK are separate work; center ground height does not guarantee both feet plant on uneven slopes. Strike examples are authored poses, not an approved or baked attack. Exact model views expose the existing geometry and paint; they do not establish independent correctness of unseen design.

The current reconstruction engine consumes the hero image. Six views support review and fitted camera/material work; they are not silently passed off as native multi-view inference. Generated references need identity review and calibration before texture projection. Vey's material regions, digit joints and foot-roll fitting cannot be safely transferred unchanged to arbitrary anatomy. No universal Tripo-quality guarantee or Roblox import certification is claimed.

## Timing

Turn began 2026-09-17 15:03:54 UTC. Per-job timings, failures and overlapping phases are retained in the local logs and Studio timing histories. Publication completion and total wall time are recorded below after live verification; do not sum overlapping test/replay durations.

## Complete fitted replay

Separate local project `3f18e4dbc375` completed in **307.676 seconds**. The regenerated animation SHA-256 exactly matches the accepted GLB (`e6dab674...bedd1a814`); all checks returned successfully. The owner project and its accepted animation were preserved. The first run exposed a premature review label between surface and articulation; the server now remains running through that boundary, with a regression check. A first test fixture omitted its stub output hash and failed; corrected fixture and raw log are retained.

| Step | Seconds |
| --- | ---: |
| surface and sole reconstruction | 148.167 |
| silhouette validation and UVs | 3.315 |
| material-region paint | 24.429 |
| sole weights and motion | 18.830 |
| surface region validation | 2.415 |
| deformed sole validation | 31.644 |
| boot roll, wrists and digits | 12.434 |
| articulation validation | 35.261 |
| sole validation | 27.237 |
| surface validation | 2.414 |

The total includes orchestration. Individual steps are measured, not estimates. This replay begins at the preserved reconstruction and paint, so it does not include new concept or shape inference.

## Publication and elapsed time

Live preview: `109714f39f9aea55d3dc54774a509178eae1d598`. Pages run [35243004302](https://github.com/majieddd/worldheart/actions/runs/35243004302) succeeded. `/v2/build.json` matches. All 20 delivered file identities match committed bytes, including the unchanged accepted model.

Public field movement/environment/free-camera/mobile checks passed in 25.40 seconds on `b17fd36`; the final commit changes only Studio orchestration, prompt metadata and evidence, with identical scene and model bytes. Public reference-sheet rendering passed in 5.20 seconds. No browser console errors in either. One transient GitHub API connection timed out; subsequent deployment and file verification passed.

Total this turn through final public verification: **51 minutes 25.5 seconds** (2026-09-17T15:03:54+00:00 to 2026-09-17T15:55:19.545592+00:00). This includes implementation, rejected Krea work, successful replays, tests, corrections and both deployments. Individual measured work is in the tables/logs above; overlapping work must not be added to the total.
