# Implementation batch: 99 Planets integration

Started 2026-09-05 from d19e105. Branch `feature/99-planets-integration`.
Owner: Codex. Scope: the approved plan, implemented in dependency order.
Tracker: https://github.com/majieddd/worldheart/issues/1.

| Item | State | Subsystem | Acceptance/evidence | Usage |
|---|---|---|---|---|
| Reusable implementation tracking skill | verified | personal skill and AGENTS.md | quick_validate.py: Skill is valid; default implicit invocation retained | unmeasured |
| Live V2 publication workflow | published and live-verified | Pages, preview integration branch, storage isolation | [PR #18](https://github.com/majieddd/worldheart/pull/18), [workflow](PREVIEW.md), [213 tests and live browser/root preservation evidence](qa/implementation/V2-PREVIEW.md) | unmeasured |
| M0 reward/talent contracts | implemented, automated verification passed | run, mode bridge, towers, allies, enemy effects | [168 tests and unforced instrumented victory](qa/implementation/M0.md); review open | unmeasured |
| M0 control/draft clarity | implemented, automated verification passed | mode, UI | Current/next labels, immediate deliberate solo pick, contextual help, retry | unmeasured |
| M1 camera and arm | implemented, automated verification passed | camera, possession, viewmodel, UI | [M1 evidence](qa/implementation/M1.md); owner feel/all-model review remains open | unmeasured |
| M2 crystals and explicit expansion | implemented, automated verification passed | run, mode, cache field, UI | [M2 resource contracts, expedition and boss victory](qa/implementation/M2.md) | unmeasured |
| M3 terrain strategy | implemented, automated verification passed | terrain, nav, traversal, placement, ranges | [178 tests, four profiles, 60 route arrivals, five camera harnesses and unforced boss victory](qa/implementation/M3.md); visual/feel and startup review open | unmeasured |
| M4 weapons and choreography | implemented, automated verification passed | inventory, loot, attacks, models, HUD | [187 tests, 27 browser checks, unforced loot/equip/boss victory](qa/implementation/M4.md); extraction follows in M5, visual review open | unmeasured |
| M5A | implemented, verification passed | campaign rules, storage, transition UI | [Two unforced linked planets, 200 tests and 16 recovery fixtures](qa/implementation/M5A.md); remaining M5 content/rename active | unmeasured |
| M5B | implemented; release verification active | 99 destinations, guardians, briefing, inventory UI and title talent apply | [Three unforced planets, all 99 routes and live boundary/recovery fixtures](qa/implementation/M5B.md); ocean losses retained, full balance/performance/rename release open | unmeasured |
| M5C | implemented, verification passed | terrain camera visibility | [96/96 visible poses, frame-rate/drag/reduced-motion checks, moving-camera performance and unforced victory/extraction](qa/implementation/M5C.md); owner feel review remains open | unmeasured |
| M5 ocean strategy | continued balance work open | optional instrumented commander/nest tactics | [Old-rule losses, reproduced softlocks, repairs and normal wave-12/wave-15 retest defeats](qa/implementation/OCEAN-STRATEGY.md); no full balance pass | unmeasured |
| U22-U27 commander feedback | implemented and verified; publication pending | tower context, arm/swing, collision, loot preview, physical nests, route lines | [Issue #19 / PR #20](https://github.com/majieddd/worldheart/pull/20), [228 tests and feature evidence](qa/implementation/COMMANDER-FEEDBACK.md), [parent QA PR #21](https://github.com/majieddd/worldheart/pull/21); owner feel review open | unmeasured |
| M6 | future | See blueprint | Stable campaign dependency remains open | unmeasured |

Audit correction: Quartermaster already works through
`prof.bonuses?.quartermaster` in `js/run/run.js`, with the profile passed by the
mode. The prior S3 text-search conclusion missed optional chaining. Preserve
the dated report and raw archive; test the existing behavior as a healthy
control. Counting House, Veterancy and Forward Scout were repaired in M0 and
are covered by its live fixtures.
