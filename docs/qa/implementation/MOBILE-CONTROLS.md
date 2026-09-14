# Mobile controls and readable touch UX

Owner: Codex. Branch `feature/mobile-controls`, based on V2 `67e14d0` and
its documentation closeout. Completed September 14, 2026. Tracker #1.
[Draft PR #41](https://github.com/majieddd/worldheart/pull/41).

Published and publicly verified as V2 `102d4a5` through
[Pages run 34810471276](https://github.com/majieddd/worldheart/actions/runs/34810471276).
Main remains `1374122`; no gameplay PR was merged.

| Item | State | Delivered |
|---|---|---|
| U126 Input ownership and touch gestures | Published + verified | Independent movement/look/action pointers, cancellation, orientation/background reset, no Pointer Lock, tap-through protection and hybrid override |
| U127 Commander and expedition | Published + verified | Analog movement, sprint, attack/aim, jump/flight, both abilities, swap, mounts, rally/dismiss, interaction and strategy return |
| U128 Strategy and construction | Published + verified | Globe gestures, deliberate preview/Place/Cancel, upgrade/sell, unit selection/orders/patrol, dotted routes, base upgrade and crystal deposit |
| U129 Compact HUD and menus | Published + verified | Phone/tablet orientations, safe areas, 48px control token, mirrored layout, scrollable equipment/economy/settings, draft/results/Endless/extraction and start/results save recovery |
| U130 Lobby and inspection | Published + verified | Commander/mount/loadout/foundry/mission, lobby movement, Debug categories/controls and world regeneration |
| U131 Adversarial QA and V2 | Published + verified | 107 local touch/transaction/scene checks, 329 automated tests, seven camera suites, a full ten-wave defense/extraction, native rendering samples, 61 public touch checks and 284 identity comparisons |

[Action map and input contract](MOBILE-CONTROLS/README.md).
[Acceptance, captures and retained failures](MOBILE-CONTROLS/ACCEPTANCE.md).
The full run found and repaired undefined planet-radius references in ground-loot
victory serialization and desktop move orders. It finished with 20 heart health,
251 kills, two remaining ground drops and seven weapons banked on Planet 2.

No implementation or browser acceptance items remain open for U126-U131.
Physical Android/iOS input, thermal/GPU behavior and owner feel testing remain
explicit device acceptance; browser emulation is not a physical-phone claim.
Full 99-planet balance and multiplayer remain in the broader roadmap.
