# M5A: saved two-planet continuation

Owner: Codex, `feature/99-planets-campaign`, stacked on M4 PR #14.
Status: implemented; automated and unforced two-planet evidence passed.
This is the first M5 slice. The 99-node content route and public rename remain
later work. Not merged or deployed.

`?map=ninetynine&campaign=1` starts or resumes the saved pilot. The existing
single-planet URL remains a sandbox, with a pilot entry button. Hearthwild uses
Highlands; Riftshore uses deep canyons with more flyers. Both have fifteen waves.
The commander and carried arsenal persist across planets; towers, draft powers,
gold, base level and crystals belong to each assault.

The `wh99Campaign` version-1 envelope contains separate account, expedition and
assault records in one atomic storage write. `wh99Progress` is preserved as the
migration source. Its old victory counter remains lifetime history, not completed
unique campaign nodes. Wave rewards use an assault ID and paid-wave mask; refresh
restarts the assault from wave one and its banked loadout without repaying the
same waves. Defeat allows a new attempt and keeps previously extracted weapons
and earned talent coins. Unbanked loot and current assault modifications are lost.

Victory saves collected inventory and remaining ground drops. Reload restores a
cleared field for salvage, emits no repeated rewards, and cannot be overturned by
a late defeat. Extraction records one receipt, banks the exact carried inventory,
and loads the next terrain. The final pilot planet produces a persistent distinct
ending with aggregate score/kills. Three optional infusions let a favorite weapon
catch up to the current planet's tier; part changes remain bounded and compatible.

Failed writes remain in memory and expose export/retry controls. Departure waits
for a successful write. Corrupt source text is preserved until explicit recovery,
and a stale tab cannot overwrite another tab's newer checkpoint. Export/import
uses the same validation as normal saves. Saves are checkpoints, not complete
mid-wave simulation snapshots; the title explains that distinction before play.

## Evidence

[Two unforced linked planets](M5A/campaign.json), requested seed 12345:

| Planet | Effective seed | Outcome | Kills | Score | Heart | Extracted weapons |
|---|---:|---|---:|---:|---:|---:|
| Hearthwild | 28183 | wave-15 victory | 1,357 | 26,060 | 22 | 4 |
| Riftshore | 36102 | wave-15 victory | 1,206 | 23,810 | 24 | 8 |

The commander finished both at 1,400/1,400 HP. Both traces include actual crystal
delivery and enemy weapon pickup/equipment. The first inventory arrived unchanged
on the second terrain; the second extraction produced the saved ending. No gold,
lives, enemies, waves or powers were injected. The harness advances time and uses
legal purchase/card/equipment seams plus movement input. This is instrumented
self-play, not blind human acceptance. [First trace](M5A/planet-1.json),
[arrival](M5A/arrival.json), [second trace](M5A/planet-2.json),
[first terminal](M5A/planet-1.png), [second terminal](M5A/planet-2.png),
[campaign receipt](M5A/campaign-complete.png).

- [200 headless tests](M5A/headless.txt), syntax and style passed.
- [16 browser transition/recovery checks](M5A/campaign-results.json): injected
  wave clears, boss pickup, mid-assault and victory reload, banking into a new
  world, defeat/retry, exact retry after failed transition storage, final ending,
  export, corrupt-save preservation and validated import. These are fixtures.
- [All five map camera harnesses and defeat/retry](M5A/regression.json), plus
  [27 shared weapon assertions](M5A/weapons.json), passed.
- Interface captures: [title at 720p](M5A/title-720.png),
  [failed-save recovery](M5A/save-failure-720.png),
  [completion at 1080p](M5A/complete-1080.png),
  [narrow completion](M5A/complete-390.png).

The first title fixture exposed Begin below the 720p viewport. Campaign mode now
collapses alternative maps and uses a shorter introduction. A failed extraction
write initially needed an explicit pending-departure state in the view so retry
could still navigate after the atomic receipt was saved. The final fixture tests
that case. Board X still sells a selected tower; weapon X/R shortcuts now belong
to possession, and open dialogs keep board hotkeys from leaking into gameplay.

## Remaining M5 work

A representative third terrain/era pilot precedes the 99-node content route.
The campaign/default title switch, complete-route unforced release evidence,
broader keyboard/accessibility review and sustained performance certification
remain open. Existing M1/M3/M4 owner feel and art-review gaps still apply.
Multiplayer authority and native platform prototypes remain M6 future work.
