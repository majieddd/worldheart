# 99 Planets development progress

Updated 2026-09-09. This is the collaborator entry point for the owner's new direction.
Read the [running blueprint](99-PLANETS-TO-DEFEND.md), [QA report and evidence](qa/2026-09-05/README.md), then `CONTRIBUTING.md` and `CLAUDE.md` before changing code.

Tracker: [Direction and milestone tracker](https://github.com/majieddd/worldheart/issues/1). Documentation/QA PR: [#9](https://github.com/majieddd/worldheart/pull/9).
Latest review slices: [99 destinations, PR #16](https://github.com/majieddd/worldheart/pull/16)
and [terrain camera visibility, PR #17](https://github.com/majieddd/worldheart/pull/17).
Both are stacked drafts. The production site has not been changed by these PRs.

**Live development:** [Play V2](https://majieddd.github.io/worldheart/v2/).
The full implementation stack is now published there from `preview/v2`, while
the original root game remains from main. [PR #18](https://github.com/majieddd/worldheart/pull/18)
adds the owner-authorized [preview workflow](PREVIEW.md), separate saves and
root preservation. Codex on `feature/v2-preview-workflow` verified the
[first deployment](https://github.com/majieddd/worldheart/actions/runs/34044866229)
and [17 live browser/hash/save checks](qa/implementation/V2-PREVIEW.md).
Preview availability does not close the remaining milestone acceptance gates.

Active 2026-09-09: Codex on `feature/terrain-routes-and-arsenal`, based on
`79d6050` from preview/v2, is addressing the next owner feedback: invisible
spawn barriers, tower attacks on nests, varied rugged mountain regions,
ground-first enemy routes with slow emergency mountain crossings, connected
held weapon models and a lateral sword slash. Owned subsystems: world/nav,
commander movement, tower combat, soldier/viewmodel and weapon appearance.
Acceptance includes current-spawn continuous movement, nest damage/lifecycle,
route preference and fallback fixtures, rendered weapon poses, all-map
regressions, a legal run and verified V2 publication. The existing M4 era
silhouette task is included with weapon assembly; broader campaign/device
acceptance remains separately tracked. [Current evidence and retained failures](qa/implementation/TERRAIN-ROUTES-ARSENAL.md).
Implemented: all six reports and twelve authored family/era assemblies. Local
checks pass 237 tests, 96 placement/route oracles, 180 commander comparisons,
1,485 isolated all-99 arrivals and the movement/model/interaction fixtures.
Final legal replays end in retained wave-14 and wave-15 defeats after an earlier
15-wave victory. All 486 sampled physical-nest arrivals pass, including slow
maximum-expansion crossings; V2 publication is active.
Reduced-CPU frame times and long-route pacing remain open. Usage unmeasured.

Published and live-verified 2026-09-09: Codex on
`feature/commander-build-comfort`, [PR #24](https://github.com/majieddd/worldheart/pull/24), removed tree camera obstruction, added a
reusable translucent range veil and restored first-person mouse capture on
successful tower Upgrade/Sell. Profiling also found full-graph placement
searches; isolated detours now reuse the live heart field without mutating it.
Moving-preview p99 improved from 117.4ms to 8.7ms at native speed and from
607ms to 22.9ms at 4x CPU in the controlled 720p fixture. This is not a full
combat or lower-end device claim. Tests: 230 core, 22 comfort, 28 contextual
feedback, 14 UI edges, 21 decor, ten surface, four terrain profiles, five map
camera regressions, 96 placement-oracle cases and 180 point-route comparisons.
A fresh legal 15-wave run won with 24 heart health and 1,035 kills, then
extracted 13 weapons to planet 2. Full campaign/art/device acceptance stays open.
[Work log and retained failures](qa/implementation/COMMANDER-BUILD-COMFORT.md).
Public V2 passes 22 comfort and 17 deployment/save checks; all 55 preview and
37 production asset hashes match the tested source and unchanged main.
Gameplay source `f5bee2c`, [deployment](https://github.com/majieddd/worldheart/actions/runs/34332932384).
Documentation-only follow-ups preserve the tested runtime. Usage unmeasured.

Published 2026-09-08: Codex on `feature/natural-terrain-feel`, [PR #23](https://github.com/majieddd/worldheart/pull/23), has implemented
rounded mountain/canyon regions, actual decor camera clearance,
displacement-driven bob, held-sway resets and targeted text-motion repairs.
[Current scope, retained failures and checks](qa/implementation/NATURAL-TERRAIN-FEEL.md).
The adversarial sweep also repaired a planet-95 enemy corner loop and costly
AI pursuit searches. The native desktop stress fixture now passes at 131.58
fps median / 8.7ms p99 with 100 enemies and 30 towers. The 4x CPU, 720p fixture
still misses the p99 budget (53.1ms) and remains open. Source `88e8964` is
live through [deployment 34310871805](https://github.com/majieddd/worldheart/actions/runs/34310871805).
All 85 focused public checks pass; all 55 preview and 37 production asset hashes
match. Final source passes 228 core tests, 180 point-route comparisons, all 99
isolated enemy routes and a fresh legal 15-wave victory with actual extraction
of 13 weapons to planet 2. Main remains `1374122`. This completes the targeted
terrain/feel repair checkpoint; the original art/feel, device and full-campaign
gates below remain open.

Previous 2026-09-06 batch: Codex on `feature/adversarial-acceptance` checked the
remaining owner brief and acceptance gaps. [Current audit and work order](qa/implementation/ADVERSARIAL-ACCEPTANCE.md)
cover keyboard/input ownership, combat/model readability, foliage, ocean
strategy and sustained performance. Claims and repairs require browser evidence;
owner feel and whole-campaign completion remain separate gates.
The first adversarial batch repairs inventory keyboard focus, pointer lock on
the victory receipt and weapon parts stretching/recoloring the holding arm.
Targeted browser checks pass, including a natural planet-1 victory and real
extraction. The continued canyon planet ends in a retained wave-12 defeat.
Eight foliage geometry cases pass; the exact owner-reported artifact remains
unreproduced. The corrected 180-second reference stress run passes at 125 fps
median / 42.55 fps 1% low with active simulation, 100 enemies and 30 towers.
All five enemy species pass 300 terrain strike probes; GPU restoration now
preserves play without stale render-target warnings. Lower-capability and
actual background-tab checks remain open. These repairs are published at
`b17ec77` via [PR #22](https://github.com/majieddd/worldheart/pull/22) and
[deployment 34056541006](https://github.com/majieddd/worldheart/actions/runs/34056541006).
Thirty-eight public deployment/keyboard/victory checks passed; main is unchanged.
The [U01-U27 alignment review](qa/implementation/OWNER-ALIGNMENT.md) maps every
original and follow-up request to current evidence and explicit remaining work.
Independent feedback settings pass 23 local checks. Profiling the failed 4x CPU
configuration led to verified instance upload and exact cache-sampling savings;
the reduced-CPU frame budget still fails, with a similarly slow frozen control.
No FPS gain is claimed. The final reference rerun passed at 129.87 fps median
and 62.5 fps inverse p99. The cautious ocean continuation won wave 15 with two
heart health and extracted to planet 5, retaining all 13 weapons. This extends
the earned pilot; it does not complete the full campaign. Settings and exact
rendering efficiencies are live from source `d932459` through
[deployment 34058300671](https://github.com/majieddd/worldheart/actions/runs/34058300671).
All 50 final public feedback/GPU/deployment checks pass; production remains
`1374122`. Later documentation-only preview commits must retain these verified
runtime hashes. No milestone was closed without its remaining acceptance.

Latest batch, 2026-09-06: the owner-requested extra-high agent implemented
[U22-U27](qa/2026-09-06-COMMANDER-REQUEST.md) on `feature/commander-feedback`,
[PR #20](https://github.com/majieddd/worldheart/pull/20). Codex integrated it
on `feature/ocean-strategy`, [QA PR #21](https://github.com/majieddd/worldheart/pull/21),
while continuing ocean tactics. All six changes are now published and
live-verified at V2. [Deployment 34050434063](https://github.com/majieddd/worldheart/actions/runs/34050434063)
published source `0be12ef`; 17 public deployment checks and 14 public contextual
interaction checks passed. Owner feel and broader balance acceptance remain open.

Evidence: 228 headless tests, 29 primary interaction checks, 14 integrated
campaign/context transaction checks, 29 combat checks and all five camera
harnesses. Real route fixtures recorded 486 arrivals; exact-world combat
fixtures recorded 210 safe strike-and-arrival cases after reproducing unchecked
knockback stranding. Placement protection is a separate verified improvement.
See [feature evidence](qa/implementation/COMMANDER-FEEDBACK.md).

[Unforced retests](qa/implementation/OCEAN-STRATEGY.md) now pass the previously
stalled waves: ocean ends in normal defeat at wave 12, and a fresh active
commander reaches the final encounter before defeat at wave 15. Neither has
a runtime fault or persistent stranded-enemy diagnostic. Failed attempts and
diagnosis corrections remain preserved. These are progress on QA coverage,
not a campaign balance pass or an optimal-player verdict. Usage is unmeasured.

## Completed in this batch

| Work | Status | Owner | Evidence | Usage |
|---|---|---|---|---|
| Blind public-build attempt | verified terminal defeat, not victory | Astra blind tester; parent UI relay | Wave 11/15, 330 kills, score 6195; immutable archive and screenshots in QA report | unmeasured |
| Repository and prior-work audit | completed | Codex | Audited head 1374122, collaborator docs, architecture and system references in QA report | unmeasured |
| Retrospective and targeted checks | completed with explicit gaps | Astra/Codex | Separate frozen/source records; actual tower getter results; current Bulwark POV screenshot | unmeasured |
| Proposed development sequence and acceptance criteria | documented | Codex | Blueprint, all U01-U21 mapped to milestones | unmeasured |
| GitHub collaboration record | published for review | Codex | Linked tracker, work items and PR | unmeasured |
| Reusable implementation tracking skill | verified | Codex | Personal implementation-tracker skill validated; root AGENTS.md carries the workflow for every collaborator | unmeasured |
| Live V2 publication workflow | published and live-verified | Codex, PR #18 | [213 tests, all five maps, 17 public browser/hash/save checks](qa/implementation/V2-PREVIEW.md); [standing workflow](PREVIEW.md) | unmeasured |
| M0 reward/control implementation | verified by automated fixtures and unforced instrumented play | Codex | [Implementation evidence](qa/implementation/M0.md); 168 tests, 14 browser assertions, all five camera harnesses, victory and defeat/retry | unmeasured |
| Owner feedback U22-U27 | published and live-verified | Extra-high agent, Codex integration | [PR #20](https://github.com/majieddd/worldheart/pull/20), [PR #21](https://github.com/majieddd/worldheart/pull/21), [feature evidence](qa/implementation/COMMANDER-FEEDBACK.md), [unforced retests and public checks](qa/implementation/OCEAN-STRATEGY.md); owner feel and campaign balance open | unmeasured |

## Development queue

Issue closure requires evidence, not just a merged diff. Proposed future implementation owners remain unassigned; the owner can claim work without changing this plan's scope.

| Milestone | Work item | Status | Owner | Depends on | Exit evidence |
|---|---|---|---|---|---|
| M0 | [M0 implementation issue](https://github.com/majieddd/worldheart/issues/2) | implemented; review open | Codex, feature/99-planets-integration | QA baseline | [Automated and unforced instrumented evidence](qa/implementation/M0.md); manual continuous-input acceptance remains open |
| M1 | [M1 implementation issue](https://github.com/majieddd/worldheart/issues/3) | implemented; latest camera/bob repairs live-verified; feel review open | Codex, feature/natural-terrain-feel | M0 | [Input harness and Bulwark comparison](qa/implementation/M1.md); [actual decor clearance, motion and feedback fixes](qa/implementation/NATURAL-TERRAIN-FEEL.md); full visual acceptance remains open |
| M2 | [M2 implementation issue](https://github.com/majieddd/worldheart/issues/4) | implemented; review open | Codex, feature/99-planets-crystals | M0-M1 | [Resource fixtures and unforced expedition/boss victory](qa/implementation/M2.md) |
| M3 | [M3 implementation issue](https://github.com/majieddd/worldheart/issues/5) | implemented; rounded terrain and route repairs live-verified; feel review open | Codex, feature/natural-terrain-feel | M2 | [Terrain, routes, range and unforced victory](qa/implementation/M3.md); [rounded regions, fixed-seed comparisons and 99 routes](qa/implementation/NATURAL-TERRAIN-FEEL.md). Broad framing/startup/feel review open |
| M4 | [M4 implementation issue](https://github.com/majieddd/worldheart/issues/6) | four-family prototype plus twelve authored era assemblies implemented; visual acceptance open | Codex, feature/terrain-routes-and-arsenal | M1/M3 | [M4 combat/loot evidence](qa/implementation/M4.md); [connected assemblies, lateral cuts and era views](qa/implementation/TERRAIN-ROUTES-ARSENAL.md); owner art/feel review remains |
| M5 | [M5 implementation issue](https://github.com/majieddd/worldheart/issues/7) | 99 destinations and continuation verified; release acceptance open | Codex, feature/adversarial-acceptance | M4 | [M5B three-planet pilot and 99 routes](qa/implementation/M5B.md); [current fresh victory, retained canyon loss and earned ocean win/extraction to planet 5](qa/implementation/ADVERSARIAL-ACCEPTANCE.md). Full campaign, reduced-CPU budget and public rename release open |
| M6 | [M6 implementation issue](https://github.com/majieddd/worldheart/issues/8) | future | unassigned | M5 | Authoritative co-op/PvPvE prototype, then independent native platform feasibility evidence |

## Verification record

Baseline at 1374122: 31 modules parsed; 128 tests passed, zero failed/skipped; style passed; deployment mirror regeneration produced no content diff. Six sampled live assets matched that head. The read-only tower diagnostic confirmed inconsistent power application. See the QA report for exact scope and links to the previously successful main checks and Pages runs.

Final documentation validation: house style and whitespace checks passed; [local links, 14 sections, seven complete mechanic blocks and 21 request IDs checked](qa/2026-09-05/document-validation.json); [52 original archive files verified by size and SHA-256](qa/2026-09-05/archive-validation.json). No runtime implementation was changed, so the existing source/core test baseline remains applicable. The PR's normal CI additionally reruns the repository checks against the submitted branch. The blueprint skill's named checker was unavailable; no checker pass is claimed.

## How collaborators update this cleanly

1. Claim a linked issue and state the bounded behavior being changed. Keep one issue for a coherent player outcome; split a milestone into child issues as implementation becomes concrete.
2. Branch campaign work from current origin/preview/v2, preserve unrelated work, and include Problem, Changed behavior, Validation and Remaining gaps in the PR.
3. Attach seed/build/profile/input and before/after evidence. Separate natural play, instrumented fixtures, source inference and user reports.
4. Update this table and the blueprint's Decided/Where we are sections in the same session that changes gameplay. Record usage only when measured.
5. Link a fixing PR to the affected issue. Publish tested working checkpoints through docs/PREVIEW.md, verify the live V2 build and update the issue. Preview publication leaves main's gameplay separate and does not close release acceptance.

Historical polish records remain unchanged. This ledger supersedes the old suggested priority order for the new owner brief; existing architecture and verification invariants still apply. License, repository permissions and branch settings are outside this batch.
