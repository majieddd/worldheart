# Mobile acceptance

September 14, 2026. U126-U131, owner Codex, `feature/mobile-controls`.
Publication is pending. [Action map and input contract](README.md),
[request ledger](../MOBILE-CONTROLS.md).

## Result

Touch players can move and fight, change perspective, build and manage towers,
order units, manage equipment, prepare in the lobby and continue the campaign.
Controls appear by context. Secondary tools use one field menu; original game
handlers remain responsible for all transactions. The start screen keeps
commander choice and launch visible, while world settings use a disclosure.
Settings include touch detection/override, look sensitivity and mirrored thumbs.

The inspected commander HUD occupies about 21.6% of a 360x640 viewport and
15.6% at 844x390, measured as the sum of control/readout bounding rectangles
including the translucent joystick. Tablet samples use about 6.6%. These are
bounded screenshots, not a guarantee for every possible alert or localization.
Tested targets are at least 44 CSS pixels, with the main control token at 48.
Targets do not overlap and the aiming center remains clear. Contextual tower
and inventory sheets deliberately take more space while the player interacts.

## Verification

| Check | Evidence |
|---|---|
| Input and responsive geometry | [42/42](evidence/input.json): real Chromium multitouch, simultaneous movement/fire/look, aim, jump/flight, abilities, swap, pause, cancellation, hybrid restoration and four viewport sizes |
| Transactions | [16/16](evidence/transactions.json): actual placement/card spend, upgrade/sell, first-person resume, weapon equip/parts/salvage, crystal deposit and rising-cost forge |
| Lobby and inspection | [19/19](evidence/scenes.json): touch navigation, commander/mount/foundry/mission, launch, Debug categories/exhibits and generator seed regeneration |
| Results and recovery | [20/20](evidence/overlays.json): start/results recovery, full bag, rewards, Endless start/finish, returning from collection and normal extraction |
| Squad | [10/10](evidence/orders.json): touch rally/dismiss, roster, real movement/routes, barracks patrol and desktop right-click regression |
| Camera regression | [7/7 suites](evidence/cameras.json): pocket, giant, titan, 99 Planets, space, All Planet and Saturn |
| Full defense | [Ten-wave victory](evidence/defense.json), seed 12345, 20 heart health, 251 kills and six towers. [Victory checkpoint](evidence/victory-checkpoint.json) retained two ground drops; [normal extraction](evidence/arrival.json) carried seven weapons into Planet 2 |
| Native rendering | [Three 15-second samples](evidence/performance.json) at 390x844, DPR 3: strategy, first person, range preview. Each p95/p99 about 7.1 ms; maximum 20.9 ms. Desktop RTX GPU, isolated calm-wave fixture |
| Core/build/public | [329/329 tests](evidence/tests.txt), [95/95 modules parse](evidence/syntax.txt), [style passed](evidence/style.txt), [97 bundled modules and 105 mirrors](evidence/deploy.txt). Public verification pending |

The full defense ran the touch HUD with a legal instrumented gameplay policy,
not touch-only manual play. It advanced simulation time and rendered sparsely;
its FPS is not a performance measurement. It did not inject resources, health,
enemies or wave completion. Automatic pickups supplied its seven carried items;
the older trace's `weaponLoop` flag remained false because it requires explicit
pickup/equip actions. Those transactions are tested separately above.

## Retained adversarial findings

- [Missing first taps](evidence/input-first.json): native click was absent after
  a canvas gesture. Delay did not repair it. Stationary pointer release now
  activates the real control, with a guard against duplicate compatibility clicks.
- [Closing-panel tap-through](evidence/scenes-first.json): closing a station
  activated the Debug link behind it. The guard now owns the completed gesture
  even when the original element moves or disappears.
- [Clipped tower actions](evidence/transactions-first.json): desktop ID styles
  kept the landscape sheet narrow; action labels and hit regions overlapped.
  Touch styles now override that width and allow labels to wrap.
- Results initially lacked a mobile route back from loot collection and a way
  to access save recovery. Both use explicit touch actions. Invalid import
  feedback remains visible inside the save panel, including above results.
- [Full-run failure](evidence/defense-first.json): two shell paths referenced
  undefined `R`, including victory serialization when ground drops remained.
  Both now use `CONFIG.planetRadius`. The completed run retains two actual drops
  and reaches Planet 2; the desktop right-click path also gets a targeted check.
- [Fixture corrections](evidence/overlays-fixture-first.json): the original
  assertions forgot the equipped starter item and the checkpoint export wrapper.
  Corrections verify 12 backpack items plus the equipped starter, unchanged
  equipment and the actual exported checkpoint. An earlier first-person
  approach fixture placed the commander below a floating island; the tower
  transaction check now uses a known ground planet and a real crosshair ray.

## Inspected captures

[Start](evidence/start.png), [commander](evidence/commander-portrait.png),
[base menu](evidence/base-menu.png), [tower actions](evidence/tower-actions.png),
[lobby](evidence/lobby.png), [Debug](evidence/debug.png).

Physical Android/iOS input, thermal behavior and GPU performance have not been
measured. Browser emulation does not certify them. Full 99-planet balance and
multiplayer acceptance remain in the broader roadmap. No gameplay PR is merged
into main by this workstream.
