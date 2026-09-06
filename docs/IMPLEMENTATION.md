# Implementation batch: 99 Planets integration

Started 2026-09-05 from d19e105. Branch `feature/99-planets-integration`.
Owner: Codex. Scope: the approved plan, implemented in dependency order.
Tracker: https://github.com/majieddd/worldheart/issues/1.

| Item | State | Subsystem | Acceptance/evidence | Usage |
|---|---|---|---|---|
| Reusable implementation tracking skill | verified | personal skill and AGENTS.md | quick_validate.py: Skill is valid; default implicit invocation retained | unmeasured |
| M0 reward/talent contracts | implemented, automated verification passed | run, mode bridge, towers, allies, enemy effects | [168 tests and unforced instrumented victory](qa/implementation/M0.md); review open | unmeasured |
| M0 control/draft clarity | implemented, automated verification passed | mode, UI | Current/next labels, immediate deliberate solo pick, contextual help, retry | unmeasured |
| M1 camera and arm | implemented, automated verification passed | camera, possession, viewmodel, UI | [M1 evidence](qa/implementation/M1.md); owner feel/all-model review remains open | unmeasured |
| M2 crystals and explicit expansion | implemented, automated verification passed | run, mode, cache field, UI | [M2 resource contracts, expedition and boss victory](qa/implementation/M2.md) | unmeasured |
| M3 terrain strategy | active | terrain, nav, traversal, placement, ranges | Shared terrain classification before height/flight/placement extensions | unmeasured |
| M4-M6 | planned | See blueprint | Dependencies and exit gates remain open | unmeasured |

Audit correction: Quartermaster already works through
`prof.bonuses?.quartermaster` in `js/run/run.js`, with the profile passed by the
mode. The prior S3 text-search conclusion missed optional chaining. Preserve
the dated report and raw archive; test the existing behavior as a healthy
control. Counting House, Veterancy and Forward Scout still require live fixes.
