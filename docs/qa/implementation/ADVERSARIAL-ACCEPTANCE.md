# Remaining acceptance: adversarial review

2026-09-06. Owner: Codex. Branch: `feature/adversarial-acceptance`, based on
live preview `a1d3238`. Parent tracker: [#1](https://github.com/majieddd/worldheart/issues/1).
The owner requested continued completion of open work, checked against the
original brief and improved where adversarial testing exposes a gap.

Preserve the light faceted world, satisfying readable combat, strategic terrain,
physical nest pressure and deliberate commander interaction. Keep the original
root on main; publish verified increments to V2. Human feel approval, technical
verification and campaign completion are separate claims.

| Item | State | Acceptance check | Evidence | Usage |
|---|---|---|---|---|
| A1 Keyboard and input ownership | active | Inventory actions/customization retain focus and scroll; modal shortcuts cannot mutate the world; closing resumes the prior input/pause context | Pending baseline browser checks | unmeasured |
| A2 Combat readability and model alignment | active audit | Strike guides remain visible and agree with damage on hills/shore/flat terrain; weapon era/parts have meaningful readable representation | Pending rendered fixtures | unmeasured |
| A3 Foliage and geometry | active audit | Fixed-seed close orbit, normals/winding, moving color/shadow deformation and all map families; preserve an unreproduced complaint as open | Pending expanded foliage checks | unmeasured |
| A4 Ocean and campaign pacing | planned | Varied legal strategy from earned checkpoint, clear win/loss and no indefinite stalls; preserve losses and distinguish controller defects from game balance | Prior failures in OCEAN-STRATEGY.md | unmeasured |
| A5 Sustained performance and recovery | planned | Reproducible load, frame-time distribution and resource growth over a prolonged session; pause/background recovery and reduced capability configuration | Prior short stress fixtures remain historical | unmeasured |
| A6 Final alignment and release gates | planned | Original U01-U27 and M0-M5 mapped to current evidence and actionable remaining work; all new changes tested on public V2 | Main release, owner feel and full 99-planet play remain open | unmeasured |

Start with baseline failures before source fixes. Browser fixtures may inject
explicit setup resources/positions to isolate a rule; only unforced legal play
counts toward campaign outcomes. Do not tune difficulty merely to make the
instrumented controller win. Every repair needs a reproducing check, relevant
regressions and a whole-run observation before publication.

M6 remains after stable single-player acceptance: authoritative co-op/PvPvE
and native platform prototypes are distinct future work, not automatic exports.
