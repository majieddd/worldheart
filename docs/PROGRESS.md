# 99 Planets development progress

Updated 2026-09-06. This is the collaborator entry point for the owner's new direction.
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

Active parallel work, 2026-09-06: Codex on `feature/ocean-strategy` investigates
ocean planet 4 with active commander/nest tactics and varied legal tower layouts.
The owner-requested extra-high agent on `feature/commander-feedback` owns
[six commander/interaction/nest feedback items](https://github.com/majieddd/worldheart/issues/19)
in a separate worktree. Codex coordinates integration and V2 publication.
The first ocean baseline uses ded4fbc rules; nest-only waves require a new
balance pass after integration. Usage is unmeasured.

Ocean update: [three additional commander/nest attempts](qa/implementation/OCEAN-STRATEGY.md)
are preserved, ending at waves 9/11/11. Two limitations in the testing strategy
were corrected; these losses do not prove the planet is unwinnable. The
[six follow-up request IDs U22-U27](qa/2026-09-06-COMMANDER-REQUEST.md) are
implemented-awaiting-verification in the agent's local worktree, not yet live.

PR [#20](https://github.com/majieddd/worldheart/pull/20) is now integrated locally:
221 tests, 29 primary interaction checks, 11 campaign checkpoint/loot checks,
29 combat checks and all five camera harnesses pass. Parent verification adds
three actual Upgrade/Sell checks. Unforced ocean retesting found a later
wave-9 stranding after passing wave 4, so movement repair and another retest
remain active before this feedback slice is published. See the
[dedicated evidence](qa/implementation/COMMANDER-FEEDBACK.md) and
[unforced results](qa/implementation/OCEAN-STRATEGY.md).

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

## Development queue

Issue closure requires evidence, not just a merged diff. Proposed future implementation owners remain unassigned; the owner can claim work without changing this plan's scope.

| Milestone | Work item | Status | Owner | Depends on | Exit evidence |
|---|---|---|---|---|---|
| M0 | [M0 implementation issue](https://github.com/majieddd/worldheart/issues/2) | implemented; review open | Codex, feature/99-planets-integration | QA baseline | [Automated and unforced instrumented evidence](qa/implementation/M0.md); manual continuous-input acceptance remains open |
| M1 | [M1 implementation issue](https://github.com/majieddd/worldheart/issues/3) | implemented; feel review open | Codex, feature/99-planets-camera | M0 | [Input harness and Bulwark comparison](qa/implementation/M1.md); full visual acceptance remains open |
| M2 | [M2 implementation issue](https://github.com/majieddd/worldheart/issues/4) | implemented; review open | Codex, feature/99-planets-crystals | M0-M1 | [Resource fixtures and unforced expedition/boss victory](qa/implementation/M2.md) |
| M3 | [M3 implementation issue](https://github.com/majieddd/worldheart/issues/5) | implemented; review open | Codex, feature/99-planets-terrain | M2 | [Terrain, routes, range and unforced victory](qa/implementation/M3.md); [M5C center-focus cliff occlusion fix](qa/implementation/M5C.md). Broad framing/startup/feel review open |
| M4 | [M4 implementation issue](https://github.com/majieddd/worldheart/issues/6) | implemented; visual review open | Codex, feature/99-planets-weapons | M1/M3 | [M4 combat/loot evidence](qa/implementation/M4.md); M5A/B now verify extraction and retention |
| M5 | [M5 implementation issue](https://github.com/majieddd/worldheart/issues/7) | 99-route PR #16 and camera visibility verified; release acceptance open | Codex, feature/99-planets-visibility | M4 | [M5B three unforced planets, 99 routes and preserved ocean defeats](qa/implementation/M5B.md); [M5C camera visibility and fresh victory/extraction](qa/implementation/M5C.md). Full campaign balance, broader performance and public default/rename release open |
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
