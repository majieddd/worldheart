# Natural bridges, geography and storms

Owner: Codex. Branch `feature/natural-bridges-and-storms`, based on verified
V2 `5f6836d` and its documentation handoff. September 12, 2026.
Current user feedback supersedes the previous visual acceptance for bridges
and storms. Retain that evidence; new checks must exercise both bridge levels.

| Item | State | Acceptance |
|---|---|---|
| U115 Glacial trough bridge | Published + verified | Continuous faceted land with a real underpass; autonomous units route across the top and below it |
| U116 Sky mesa varieties | Published + verified | Several distinct suspended mesa silhouettes with usable surfaces, reflected in recipes and Debug |
| U117 All bridge surfaces | Published + verified | Audit glacial, grotto, cavern, arcade and ribbon geometry; shared terrain colors, strata and facet scale; coherent joins |
| U118 Earthquake crack | Published + verified | Branching fissure warning and matching cracked terrain mutation; preserve nest destruction, route checks and bounded work |
| U119 Arc lightning | Published + verified | Connected branched lightning bolts and storm clouds aligned with actual strikes |
| U120 Remove ashfall | Published + verified | Remove event, scheduling, Debug and current descriptions without removing unrelated volcano features |
| U121 Tsunami wave | Published + verified | Continuous curved water front and foam, matching advancing surge footprint |
| U122 Radiation EMP | Published + verified | Purple storm clouds and branched strikes; struck nearby towers visibly disable temporarily, then recover cleanly |
| U123 Remove cryovolcanic outburst | Published + verified | Remove disaster from all current consumers; retain independent cryovent feature |
| U124 Earth geography | Published + verified | Accurate sourced continent outlines, geographic relief and biome regions; visually inspect several hemispheres |
| U125 Natural distribution | Published + verified | Seeded clustered density and irregular spacing across scenery, biome previews and active features; no visible lattice/spiral placement |

Sequence: reproduce and define shared surface contracts, implement bridge
geometry/navigation and sky variations, improve storms and lifecycle, replace
Earth's crude coast mask and naturalize placement, then combined acceptance.
Use the existing tracker, pure tests, actual movement/effect fixtures, native
profiles, visual evidence and a completed defense. Publish verified work to
V2 only with exact deployment identity and public behavior checks.

Published and publicly verified as V2 67e14d0 through [Pages run 34731406144](https://github.com/majieddd/worldheart/actions/runs/34731406144). All U115-U125 items are complete. [Acceptance and evidence](NATURAL-WORLDS/ACCEPTANCE.md) includes 329 automated tests, 265 Debug checks, 108 aggregate world checks, physical bridge/sky movement, six tower EMP lifecycles, a completed ten-wave defense, measured quake performance, 278 public identity comparisons and 33 public behavior checks. Main remains 1374122. First failures and their fixes are retained. [Draft PR #40](https://github.com/majieddd/worldheart/pull/40) contains the changes; multiplayer, full 99-planet endurance and future ports remain later roadmap work.
