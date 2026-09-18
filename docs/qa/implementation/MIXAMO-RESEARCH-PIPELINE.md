# Character pipeline / Mixamo research integration

Status: final review published and publicly verified at `d278684` (PR #74) on `feature/mixamo-research-pipeline`.
Base preview: `4531bbd0db27efeda7550cfea88567709d240e84`.
Coordination: [issue claim](https://github.com/majieddd/worldheart/issues/1#issuecomment-5721607575).
This supplements the Reptilian pilot and preserves Vey, the fitted Reptilian,
Painted-Anime-Inkline, and the owner-locked Atmospheric Ink 1.3.2.

## Delivered and measured

- Read MIA's full 19-page paper/supplement and InstantMesh's 11-page paper, then inspected their current pinned implementations. Detailed findings, sources, scope and limitations are in the [public research record](../../../lib/99-art/motion-research-v1/research.md).
- Verified that Modly's Trellis2 GGUF extension already executes shape and generative paint. Installed isolated MIA v2 and InstantMesh runtimes, pinned 25 reference/config/weight files, verified all hashes and actual imports.
- User authorized the Hugging Face access form; browser access was granted. Protected browser downloads remained blocked and CLI authentication separate. The bounded library instead uses the user's local Walking FBX and the author's pinned public Standard Run FBX. Raw reference characters/captures remain local.
- Added local FBX extraction, exact source provenance, fitted Mixamo retargeting, sole-based two-bone contact, calibrated world travel, tail clearance, loop filtering/tangent correction, and deformed-surface checks. Walk and run are combined in a separate candidate; original clips and assets remain available.
- Actual Studio walk/run jobs passed. A MIA Studio job failed its anatomy/deformation gate, retained the prediction and did not change the production selection. InstantMesh executed through Studio in 38.152 seconds with cached views; verified raw geometry/paint reuse reduced a subsequent job to 8.060 seconds. Original cold candidate worker took 77.305 seconds.
- Added Motion & engine comparisons UI with capture import, target rig, saved candidates, clay/unlit views, scrubbing, diagnostics, timings and explicit visual review before selection. Source or candidate changes invalidate selection. Animation approval and polish remain separate.
- Created the public commander comparison with original fitted model, captured walk/run and rejected InstantMesh result. Owner acceptance remains pending.

## Quality findings

MIA's known standard-humanoid control passes (rest edge-stretch p99 1.057).
Vey fails anatomy/deformation (p99 8.124); Reptilian fails (16.118). Coarse fitted
guidance improves Reptilian to 3.390 but remains over the unchanged limit and
lacks its tail. Exact four-weight pruning and normalization repaired adapter
faults; they do not make wrong learned joints acceptable. The rejected first
bind, DLL failure and source predictions remain in local evidence.

InstantMesh loses fine snout, finger and armor geometry. It is an experimental
alternate, not a replacement. Its Z-up output is automatically converted to
Y-up; correcting the retained original took 1.470 seconds without regeneration.
Both full paper/code findings and actual inferior results are retained.

Captured walk/run both contact the floor. Maximum loop surface displacement is
below 0.000002 m; velocity change p95 is 0.151/0.794 m/s under the unchanged
1.0 m/s limit. The run initially failed at 2.183 m/s. Interior stance speed is
explicitly distinguished from contact transitions; full-cycle floor and loop
checks retain all frames. Hands, feet, knees and tail were reviewed in 12 side
poses per clip plus front/back renders. This does not certify arbitrary new
alien rigs, authored attacks, Roblox acceptance or commercial-generator parity.

## Validation and evidence

- 50 Studio tests pass, including sliding-foot, tied-weight, bad anatomy,
  excessive deformation, failed-job retention and stale-selection controls.
- 408 game tests pass; 168 modules parse; house style passes after normalizing
  existing em-dash strings in the two touched Studio UI files.
- `artifacts/motion-research/public-browser/`: all cycle samples, clay and unlit
  reconstruction inspection, desktop/mobile controls; zero browser errors.
- `studio-final-browser/`: actual completed candidate, scrubbing and mobile
  review. Screenshots caught a wrong default clip and narrow-view framing;
  corrected the UI to select the clip named by its report and fit the viewport.
- Raw logs, failed trials, receipts and local reference library are retained
  outside the site. The public [timing ledger](../../../lib/99-art/motion-research-v1/timing.json)
  distinguishes downloads, failed/successful processes, Studio stages and total
  tracked wall time. Initial uninstrumented setup spans are disclosed.

## Aegis

[PR #13](https://github.com/majieddd/claude-plugins-custom/pull/13) merged as
`2aaf3c1`. Aegis 3.18.12 adds research-engine and Mixamo contact methods alongside
existing production/animation references. CONTRIBUTING reinforces supplemental,
evidence-backed collaboration. Installed Codex package is
`3.18.12+codex.20260918000830`. Fresh app-server discovery reports version
3.18.12 and all seven tools; the installed turn-grid workflow passes. Portable
doctor: 8/8, 190 references valid; byte gate clean. Existing host-specific
Claude/Hermes link failures remain outside this Codex update.

## Open acceptance

Owner comparison; shape/detail refinement to match the hero more closely;
generalization to new anatomy; authored attack clips; Roblox import and budgets;
matched Tripo/Meshy output comparison. The local runtime is installed and tested,
but a completely clean installation on another machine is not certified.

## Final repeatability check

The first published comparison used imported display names to find the existing
tail cycle, which could miss `Walk`/`Run`. The Studio now passes the explicit
movement type and refuses a missing tail cycle instead of silently dropping it.
Replayed through the actual program: walk 10.350 seconds, run 8.671 seconds;
both pass the unchanged motion checks. The updated combined asset is
`85c72008c3242669f609798de972cd475f3b41bad8a5f5959cae3472e5ece2c0`.
The final walk improves loop velocity change to 0.151 m/s. New cycle renders
are in `artifacts/motion-research/final-motion-browser/`; public first-release
views are in `public-live/`, with zero console errors. Failed predictions hide
the empty viewer and irrelevant playback controls.

## Public handoff

Final deployment: [Pages run 35291710464](https://github.com/majieddd/worldheart/actions/runs/35291710464),
preview SHA `d278684e82882f6fbaaba43367803bd06883002f`. All 17 selected public
files match local bytes, including both new experimental models and the unchanged
accepted Vey/fitted Reptilian. The comparison viewer is
[commander-research.html](https://majieddd.github.io/worldheart/v2/design-demos/99-planets/commander-research.html).
The local generator runs at `http://127.0.0.1:8773/`. Public source identity and
browser evidence remain in `artifacts/motion-research/live-identity.json` and
`public-final-live/`. This publication is a review checkpoint, not owner acceptance
or a claim of Tripo/Meshy parity.
