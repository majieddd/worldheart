# Video motion and local decision-engine trial

Active owner: Codex. Branch: `fix/asset-shape-budget`, PR #76. Started
2026-09-18 16:54:27 UTC. Scope is Asset Studio, with additive Aegis guidance;
the accepted Painted-Anime-Inkline renderer and Vey production model stay intact.

## What is implemented

- Nine independent animation slots: idle, walk, run, punch, jump, wave, defeat,
  sword strike and rifle fire. Each has an identity-bound brief, its own imported
  video, prompt/job receipt, frame sheet, playback and reference review.
- Six real MiniMax H3 jobs completed and were imported through Studio. The provider
  rejected the seventh submission because the account ran out of credits. Defeat,
  sword and rifle remain awaiting video. The preflight was 16 credits per 8-second
  clip; this is not a statement of actual billed usage. No automatic resubmission.
- Local MediaPipe heavy body tracking, overlay, confidence/missing-frame checks,
  source-bound rig reuse or MIA fitting, retarget, boot contact, temporal filtering,
  measured loop selection and surface/stance checks. The conversion is a separate
  candidate, with prior models and approvals retained. It does not substitute a
  canned Mixamo clip for video-extracted motion.
- Failed checks prevent applying a candidate. Accepted video and explicit full
  animation review are separate requirements. Applying a candidate clears final
  animation approval; the existing polish/export path then remains available.
- Tracking caches include video, trim, extractor and weight identity. Loop retries
  test at most three distinct measured intervals and retain every failed attempt.
  Current check-contract version is 2; earlier candidates require revalidation.
- Windows atomic state writes now retry brief sharing locks instead of failing an
  otherwise valid conversion. The previous file remains intact on a persistent error.

Review: <http://127.0.0.1:8773/?project=3f18e4dbc375#motion-video-guide>.
Use the animation selector, watch the video, convert, inspect its tracking overlay
and candidate from multiple angles, then apply only an acceptable result. The
original Vey remains the current model until this explicit selection.

## Measured evidence and limitations

The original 12.25-second guide tracked all 294 frames, with 98.5% key-joint
observations above the configured confidence threshold, in 39.566 seconds.
The first retarget failed floor contact; the next exposed knee roll discontinuity.
Repairs were made in shared workers, not in a one-off edited model. In-place
walking required a separate support calculation: backward foot travel is expected
in body space. Target limb length, stable knee poles and quaternion filtering are
followed by new surface checks, rather than weakening thresholds.

The first complete six-video conversion pass took 39.046 s walk, 57.046 s idle,
32.991 s run, 62.592 s punch, 61.809 s jump and 61.387 s wave. These are per-step
wall times, not cloud generation time. Five passed that pass's technical checks;
run failed and was retained. Later retries add measured stance checks and reuse
tracking; see the final machine-readable evidence linked below. Technical checks
are not owner visual acceptance. The accepted walk has not been replaced.

Latest contract-2 candidates: idle 24.959 s, walk 32.665 s, punch 37.342 s,
jump 38.168 s and wave 36.144 s pass their technical checks. Running took
36.392 s and remains blocked by joint continuity and loop surface velocity.
These retries reused tracking. Contact is solved again after temporal filtering
and loop closure; otherwise smoothing reintroduced stance sliding. Both leg
segments now share a knee plane, removing a 180-degree shin roll at horizontal
crossing. The remaining run discontinuity is at the foot; it is not hidden or
declared acceptable. All alternatives and failed measurements remain on disk.

Verification: 88 Studio tests, 408 game regression tests, syntax/style checks,
desktop/mobile catalogue and candidate playback. Current walk front/side/back
renders were inspected. This proves the workflow and playback, not full artistic
acceptance of all five passing candidates. Original paint, shape, animation and
approvals were checked for preservation. Local elapsed implementation time was
96.6 minutes at the evidence checkpoint; publication and final verification are
additional. `timing-summary.json` records each extraction, rig and retarget stage,
including failures. Cloud inference latency was not measured; the original
approximate batch timestamp is explicitly labeled rather than called a measurement.

This is a body-motion conversion candidate workflow. MediaPipe estimates monocular
depth and does not reconstruct detailed fingers, weapon grips or reliable axial
twist. Occlusion, generated-video anatomical drift and a poor source action can
still require a better guide or captured motion. Do not call this production-grade
capture for every animation, or claim Meshy/Tripo parity. The running clip remains
a particularly difficult case; failed alternatives are visible rather than hidden.

Local evidence under `artifacts/video-motion/`: generation-jobs/results.json,
import-receipts.json, conversion-results.json, preservation.json, test logs,
tracking overlays, rendered comparisons and timing-summary.json. Raw media stays
local. Requested prompt timings are not treated as measured action boundaries.

## Laya: actual local inference, bounded adoption

Source: [Laya](https://github.com/NandhaKishorM/laya), pinned
`fcf127c57176d7b8354510ed9124fc098560600a`; model `convaiinnovations/laya`.
The author's [article](https://dev.to/nandakishor_m_6cc0adfde9f/i-built-non-autoregressive-decision-models-a-year-ago-then-a-frontier-lab-called-it-a-18me)
was read through the public article API when the normal page fetch failed.
It is a 421M-parameter text/JSON decision model, not a visual evaluator or generator.

CPU trial: 13/21 diagnostic classifications correct; deterministic exact-keyword
baseline 9/21. Median warm decision 989 ms, cold load 49.857 s. Seven predictions
with top-label probability at least 0.8 were correct, but this is a small selected
subset, not general confidence calibration. A separate animation-intent trial
scored 8/12, median 591 ms, cold load 51.624 s. Author GPU latency claims were not
reproduced by these CPU trials. No API-token or billing savings were measured.

Adoption: optional **Explain the current issue locally**. Known errors use rules;
unstructured diagnostics can use the cached local model. Uncertain answers fall
back to review. Advice cannot submit a generation, repair a mesh, spend money,
change a quality result or approve an asset. The first request loads the model;
subsequent requests reuse it. It uses CPU to leave GPU memory for asset workers.

| Pipeline process | Suitable mechanism | Decision |
|---|---|---|
| Free-text error category | Laya plus abstention | Optional advice, tested |
| Animation-name synonyms | Laya | Tested; 8/12 is insufficient for automatic dispatch |
| Brief/style completeness | Schema plus optional text advice | Required fields stay deterministic |
| Engine compatibility and availability | Explicit capabilities | No model needed |
| Resource budget / five-minute limit | Measured time, RAM and VRAM | No model needed |
| Job priority and queue ownership | Fixed queue | No model needed |
| Cache reuse / stale references | Exact hashes | Never delegated to a classifier |
| Corrupt files / topology / weights | Parsers and numeric probes | Never delegated to a classifier |
| Pose coverage / foot contact / seams | Measured motion data | Never delegated to a classifier |
| Retry choice | Bounded validated alternatives | Advice cannot weaken constraints |
| Visual likeness / texture / motion appeal | Full visual comparison | Text model cannot establish this |
| Approval / applying / export eligibility | Explicit state checks | Never delegated to a classifier |

## Open-Higgsfield: local interface trial

[Open-Higgsfield-AI](https://github.com/Autom8AI/Open-Higgsfield-AI), pinned
`b578108936e83a3b2a5e86644057a56f8aea73a1`, was cloned and actually run at
<http://127.0.0.1:8774/>. Installation used the lockfile with lifecycle scripts
disabled. This checkout needed an ESM Vite config, Tailwind 4 alignment, removal
of the conflicting PostCSS pass, and repair of a missing instruction helper.
TLS verification was enabled on the development proxy.

Browser image/video screens now render without console errors. A real client
generation preflight reports a missing Muapi API key; no key was present in the
trial browser. Therefore output quality and generation latency are **unavailable**,
not a failed quality comparison. Source inspection confirms cloud uploads and
requests to api.muapi.ai. This repository provides a UI, not local Higgsfield
model weights. Its README claims MIT but the checked-out root has no standalone
LICENSE file. No upstream UI code was copied into Asset Studio and no replacement
was embedded because a quality/efficiency benefit has not been demonstrated.

## Further motion research

[GVHMR](https://github.com/zju3dv/GVHMR) supports static-camera motion recovery,
but its source license limits use to educational/research/non-profit purposes and
its setup requires registered SMPL/SMPL-X body files. Neither body file was present
in this runtime. It was not silently embedded as a commercial production dependency
or reported as tested inference. MediaPipe was selected for the runnable local
pilot; its limitations are kept visible.

## Reproduce

1. Run `tools/asset-studio/setup_video_motion.py` with the asset runtime Python.
2. Start Studio on 8773 using its existing launcher.
3. Import a reference-bound MP4 into its animation slot, then choose **Track, rig &
   create animation**. Pose extraction and retarget stages each have bounded timeouts.
4. Review overlay, checks, full motion and model surfaces before selecting a result.
5. Run `benchmark_laya.py <runtime> <report.json>` for the retained diagnostic trial.

Aegis adds these lessons to `research-engine-pilot.md`; its existing rigging and
collaborator methods remain intact. Implementation, technical verification, owner
acceptance and GitHub preview publication are recorded separately.

Aegis commit `7f98127` is pushed on PR #14. Installed version
`3.18.13+codex.20260918180129` was validated and its method file matched the
source hash. No shared production quality or approval gate was delegated to Laya.
