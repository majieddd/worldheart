# 99 Planets development progress

Updated 2026-09-05. This is the collaborator entry point for the owner's new direction.
Read the [running blueprint](99-PLANETS-TO-DEFEND.md), [QA report and evidence](qa/2026-09-05/README.md), then `CONTRIBUTING.md` and `CLAUDE.md` before changing code.

Tracker: [Direction and milestone tracker](https://github.com/majieddd/worldheart/issues/1). Documentation/QA PR: [Review branch](https://github.com/majieddd/worldheart/tree/docs/99-planets-qa-plan-2026-09-05).

## Completed in this batch

| Work | Status | Owner | Evidence | Usage |
|---|---|---|---|---|
| Blind public-build attempt | verified terminal defeat, not victory | Astra blind tester; parent UI relay | Wave 11/15, 330 kills, score 6195; immutable archive and screenshots in QA report | unmeasured |
| Repository and prior-work audit | completed | Codex | Audited head 1374122, collaborator docs, architecture and system references in QA report | unmeasured |
| Retrospective and targeted checks | completed with explicit gaps | Astra/Codex | Separate frozen/source records; actual tower getter results; current Bulwark POV screenshot | unmeasured |
| Proposed development sequence and acceptance criteria | documented | Codex | Blueprint, all U01-U21 mapped to milestones | unmeasured |
| GitHub collaboration record | published for review | Codex | Linked tracker, work items and PR | unmeasured |
| Gameplay changes | not started | unassigned | This batch changes documentation/evidence only | unmeasured |

## Development queue

Issue closure requires evidence, not just a merged diff. Proposed future implementation owners remain unassigned; the owner can claim work without changing this plan's scope.

| Milestone | Work item | Status | Owner | Depends on | Exit evidence |
|---|---|---|---|---|---|
| M0 | [M0 implementation issue](https://github.com/majieddd/worldheart/issues/2) | ready | unassigned | QA baseline | All rewards/talents work; natural 15-wave victory and defeat/reset; integration assertions |
| M1 | [M1 implementation issue](https://github.com/majieddd/worldheart/issues/3) | planned | unassigned | M0 | Natural camera/control input, Bulwark/animation before-after, all-map camera harness |
| M2 | [M2 implementation issue](https://github.com/majieddd/worldheart/issues/4) | planned | unassigned | M0-M1 | Crystal expedition, deposit, explicit base expansion and natural defended planet |
| M3 | [M3 implementation issue](https://github.com/majieddd/worldheart/issues/5) | planned | unassigned | M2 | Ground/air terrain routes, swim/climb, climate placement and spherical-range agreement |
| M4 | [M4 implementation issue](https://github.com/majieddd/worldheart/issues/6) | planned | unassigned | M1/M3 | Loot to inventory to equipped combat to extraction; telegraph/hit agreement; graphics sweep |
| M5 | [M5 implementation issue](https://github.com/majieddd/worldheart/issues/7) | planned | unassigned | M4 | Two-world continuation, campaign boundary tests, then full 99-world completion and rename |
| M6 | [M6 implementation issue](https://github.com/majieddd/worldheart/issues/8) | future | unassigned | M5 | Authoritative co-op/PvPvE prototype, then independent native platform feasibility evidence |

## Verification record

Baseline at 1374122: 31 modules parsed; 128 tests passed, zero failed/skipped; style passed; deployment mirror regeneration produced no content diff. Six sampled live assets matched that head. The read-only tower diagnostic confirmed inconsistent power application. See the QA report for exact scope and links to the previously successful main checks and Pages runs.

Final documentation validation: house style and whitespace checks passed; [43 local links, 14 sections, seven complete mechanic blocks and 21 request IDs checked](qa/2026-09-05/document-validation.json); [52 original archive files verified by size and SHA-256](qa/2026-09-05/archive-validation.json). No runtime implementation was changed, so the existing source/core test baseline remains applicable. The PR's normal CI additionally reruns the repository checks against the submitted branch. The blueprint skill's named checker was unavailable; no checker pass is claimed.

## How collaborators update this cleanly

1. Claim a linked issue and state the bounded behavior being changed. Keep one issue for a coherent player outcome; split a milestone into child issues as implementation becomes concrete.
2. Branch from current main, preserve unrelated work, and include Problem, Changed behavior, Validation and Remaining gaps in the PR.
3. Attach seed/build/profile/input and before/after evidence. Separate natural play, instrumented fixtures, source inference and user reports.
4. Update this table and the blueprint's Decided/Where we are sections in the same session that changes gameplay. Record usage only when measured.
5. Link a fixing PR to the affected issue. Main publishes to Pages, so this planning branch stays reviewable without claiming that future gameplay has shipped.

Historical polish records remain unchanged. This ledger supersedes the old suggested priority order for the new owner brief; existing architecture and verification invariants still apply. License, repository permissions and branch settings are outside this batch.
