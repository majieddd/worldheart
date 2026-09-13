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

Implementation and local acceptance complete at c699def. All U115-U125 items have passing targeted evidence in [the acceptance report](NATURAL-WORLDS/ACCEPTANCE.md), including 329 automated tests, 265 Debug checks, 108 aggregate world checks, physical bridge/sky movement, six tower EMP lifecycles, a completed ten-wave defense and measured quake performance. Publication to V2 and exact public identity/behavior verification remain in progress. First failures and their fixes are retained in the report. Draft PR [#40](https://github.com/majieddd/worldheart/pull/40) contains the implementation.
