# Natural bridges, geography and storms

Owner: Codex. Branch `feature/natural-bridges-and-storms`, based on verified
V2 `5f6836d` and its documentation handoff. September 12, 2026.
Current user feedback supersedes the previous visual acceptance for bridges
and storms. Retain that evidence; new checks must exercise both bridge levels.

| Item | State | Acceptance |
|---|---|---|
| U115 Glacial trough bridge | QA | Continuous faceted land with a real underpass; autonomous units route across the top and below it |
| U116 Sky mesa varieties | QA | Several distinct suspended mesa silhouettes with usable surfaces, reflected in recipes and Debug |
| U117 All bridge surfaces | QA | Audit glacial, grotto, cavern, arcade and ribbon geometry; shared terrain colors, strata and facet scale; coherent joins |
| U118 Earthquake crack | QA | Branching fissure warning and matching cracked terrain mutation; preserve nest destruction, route checks and bounded work |
| U119 Arc lightning | QA | Connected branched lightning bolts and storm clouds aligned with actual strikes |
| U120 Remove ashfall | QA | Remove event, scheduling, Debug and current descriptions without removing unrelated volcano features |
| U121 Tsunami wave | QA | Continuous curved water front and foam, matching advancing surge footprint |
| U122 Radiation EMP | QA | Purple storm clouds and branched strikes; struck nearby towers visibly disable temporarily, then recover cleanly |
| U123 Remove cryovolcanic outburst | QA | Remove disaster from all current consumers; retain independent cryovent feature |
| U124 Earth geography | QA | Accurate sourced continent outlines, geographic relief and biome regions; visually inspect several hemispheres |
| U125 Natural distribution | QA | Seeded clustered density and irregular spacing across scenery, biome previews and active features; no visible lattice/spiral placement |

Sequence: reproduce and define shared surface contracts, implement bridge
geometry/navigation and sky variations, improve storms and lifecycle, replace
Earth's crude coast mask and naturalize placement, then combined acceptance.
Use the existing tracker, pure tests, actual movement/effect fixtures, native
profiles, visual evidence and a completed defense. Publish verified work to
V2 only with exact deployment identity and public behavior checks.

Implementation checkpoint: 323/323 automated tests and 82/82 initial Debug checks. New autonomous movement checks cover both surfaces of four bridge families. Native enemy traversal, EMP lifecycle, Earth hemisphere review, final performance and public deployment remain in progress. First visual captures are retained in `artifacts/natural-worlds/visual-first`; this is not release acceptance.

Adversarial follow-up: separated tower footprint heights, removed submerged roof nodes from dry-route classification, constrained Earth bridges to cold geography, and made quake forecasts recheck bank/deck continuity. New native bridge and EMP checks pass 18/18, environmental effects 23/23, and the pre-follow-up quake profile measured 6.9 ms median, 7.2 ms p99, 8.6 ms maximum work slice. The broad sweep found Earth's submerged-cap classification issue; its failing result is retained and Earth will be rerun after the fix. Draft PR [#40](https://github.com/majieddd/worldheart/pull/40) carries the implementation checkpoint.

Final acceptance in progress: 327/327 automated tests pass. The 47-world sweep
finished 107/108; Earth and the three affected theme/pack reruns passed 11/11
after the submerged-roof correction. Inspection then found reversed east/west
on Earth, now corrected and queued for final hemisphere and live-world checks.
Sky generation profiling traced slow boots to repeated full-detail rejected
caps. A preliminary scout, followed by the unchanged full-detail certificate,
reduced the two measured sky cases from 61-83 seconds to 34-36 seconds (6/6
checks). Loot now retains its bridge level. Final native EMP/upgrade, quake
performance, whole Debug registry, defense and deployment checks are pending.
