# M5B: 99 destinations, milestone guardians and campaign QA

Owner: Codex, `feature/99-planets-content`, stacked on M5A PR #15.
Status: implemented, route and integration checks passed; release balance and
visual/performance acceptance remain open. Not merged or deployed.

The saved preview now contains 99 destinations, eleven regions, four terrain
profiles and five enemy-pressure patterns. All twenty profile/pressure pairings
occur. Era boundaries are ancient 1-33, technological 34-66 and empowered 67-99.
Health grows from 1x to a bounded 1.35x; opening worlds retain their pilot tuning.
Thirteen named milestone guardians use wide-sweep, narrow-lance or armored
bastion variants. They reuse the Colossus rig, with individual plate colors and
authoritative attack tells. This does not claim thirteen new authored models.

`?map=ninetynine&campaign=1` shows the 99 Planets To Defend preview identity,
current region/terrain/era, an expandable threat briefing, the next destination
on extraction and a final arsenal receipt. Existing two/three-world pilot saves
extend to the next unplayed node with earned weapons and receipts intact. A new
expedition after completion explicitly confirms replacing its route and arsenal;
account coins/talents remain. The production default and sandbox title are unchanged.

Inventory and other dialogs stop board movement. Modal backdrops and details
summaries now receive pointer events; the old HUD specificity disabled them.
Enemy pool pressure delays owed spawns rather than silently deleting them.
Title purchases now offer Apply upgrades: a successful save reloads the same
planet before constructing its next assault, so purchases affect that assault.
Failed writes keep the purchase screen open for retry.

## Evidence

The [unforced three-planet pilot](M5B/three-planet-campaign.json) completed before
the 99-node expansion. Requested seed 12345, fixed Bulwark, no injected resources,
waves, enemies or powers. The harness uses legal purchases/placements/equipment,
normal movement input and deterministic time advance; this is not blind human play.

| Planet | Effective seed | Kills | Score | Heart | Banked weapons |
|---|---:|---:|---:|---:|---:|
| Hearthwild | 28183 | 1,358 | 26,080 | 21 | 3 |
| Riftshore | 36102 | 1,206 | 23,830 | 24 | 9 |
| Crownfall | 51940 | 1,480 | 28,700 | 24 | 13 |

All three commanders ended at 1,400/1,400 HP. Forty-five waves paid 1,470 coins.
[Traces one](M5B/pilot-1.json), [two](M5B/pilot-2.json),
[three](M5B/pilot-3.json), [third terminal](M5B/pilot-3.png),
[pilot ending](M5B/pilot-complete.png) and the
[earned checkpoint](M5B/three-planet-checkpoint.json) are retained. The later
full-route change also applies Crownfall's 1.04 health multiplier to raiders;
these three wins predate that small change and the new milestone content.

- [All 99 generated worlds](M5B/99-navigation.json): 1,485 of 1,485 real ground
  and flying enemy bodies reached the heart; no ceiling violations or stranded
  units. Rendering, combat and economy are omitted in this isolated route test.
  Seed 12345 defines this suite; it does not prove every possible expedition seed.
- [Initial route failure](M5B/99-navigation-initial-failure.json): planet 8
  exhausted the old 14 generation attempts. The terrain-only budget is now 32,
  retaining every placement and route constraint. Its successful retry used
  attempt 16, requested seed 745448, effective seed 864233. Earlier successful
  generations keep their original effective seeds.
- [Seven live boundary fixtures](M5B/boundaries.json) at 1/33/34/66/67/98/99:
  real configuration, infusion/model era, boss attack guide, immutable Colossus
  template, guaranteed boss drop tier, exact next-planet inventory and no planet
  100. Prior progress and final wave clears are fabricated fixtures.
- [Twenty three-pilot checks](M5B/three-pilot-fixtures.json), then
  [twenty full-route recovery checks](M5B/recovery.json): mid-assault and victory
  reload, failed extraction write/retry, banked gear after defeat, final receipt,
  export/corrupt/import, visible arsenal, cancel/new expedition. The latter uses
  real first/second/third transitions and a fabricated final checkpoint.
- [Twenty-nine live weapon assertions](M5B/weapons.json), including inventory
  camera/hotkey isolation, and [all five camera/map regressions](M5B/regression.json)
  passed. [Title purchase fixtures](M5B/talents.json) verify 450 to 600 starting
  gold after paying exactly 300 coins for Cryo and Counting House, unchanged URL
  and seed, and a failed-write hold, in sandbox and campaign.
- [207 headless tests](M5B/headless.txt), 46-module syntax parsing, house style
  and regenerated deployment mirrors passed. The single-file build inlines
  48 modules; all 51 v2 mirror files match their source.
- [20,000-item deterministic sample](M5B/loot-distribution.json): 832 distinct
  family/parts/affix signatures, no invalid items or nonfinite stats, four families
  and three eras. Ordinary drops 407/20,000; elite drops 1,992/20,000. This samples
  the generator, not natural pickup frequency or player-perceived variety.
- Interface captures: [720p title](M5B/title-720.png),
  [save failure](M5B/save-failure-720.png), [1080p completion](M5B/complete-1080.png),
  [390px completion](M5B/complete-390.png). Begin is visible at 720p and the narrow
  final receipt has no horizontal overflow.

## Continued combat and remaining release work

The earned pilot save was extended into planet 4, Verdant Reach Shoals, effective
seed 389884. [Attempt one](M5B/planet-4-first-defeat.json) lost at wave 13, 701
kills, 13,805 score, five towers and 623 unspent gold. It searched positions only
within 11 units of the heart. [Attempt two](M5B/planet-4-second-defeat.json)
searched the expanded shore out to 26 units and also lost, with seven towers.
Neither attempt injected resources or produced a runtime fault. These failures
remain evidence; a weak policy alone does not establish that a planet is unwinnable.

The [retry checkpoint](M5B/planet-4-retry-checkpoint.json) retains earned coins
and the thirteen weapons extracted from the first three planets. A further
attempt spent 1,960 of its 1,988 earned coins through the actual talent UI.
Counting House raised starting gold by 150 and Veterancy raised commander HP
to 1,680. [That attempt](M5B/planet-4-talent-defeat.json) also lost at wave 13,
769 kills, 14,820 score, six towers, 129 gold and commander HP 1,664.64.
[Terminal](M5B/planet-4-talent-defeat.png) and
[latest earned checkpoint](M5B/planet-4-talent-checkpoint.json) are retained.
The varied-strategy balance investigation remains open.

## Performance sample

[The 60-second stress fixture](M5B/performance.json) used real-time browser
frames at 1920x1080, DPR 1, with thirty normally validated towers and a replenished
target of one hundred active enemies. Gold, territory, enemy population and
heart health were fixture setup; this is not combat-balance evidence. No other
QA browsers were running during measurement.

Chrome 152.0.7977.77, Windows 11 10.0.22631, i9-13900H, RTX 4080 Laptop GPU,
63.6 GiB RAM: 7,784 frames, median 7.6 ms, p95 8.4 ms, p99 8.8 ms, maximum
34.6 ms. Inverse median/p99 frame times were 131.6 / 113.6 fps. Boot took
8.257 seconds at effective seed 28183. Bloom stayed at five levels, shadows
enabled. Pause held simulation time exactly; resume advanced normally. No
runtime faults occurred. This passes the provisional budget on this machine,
not on unspecified low-end devices or a prolonged campaign session.
[Stress capture](M5B/performance.png) also preserves the unresolved cliff
occlusion: a clear performance result does not establish clear battlefield framing.

Full unforced 99-planet completion, varied-strategy balance, lower-end and
prolonged-session performance, broader accessibility and the existing camera/cliff/model/feel
review remain release gates. The public default switch and M6 multiplayer/native
ports follow those gates. No whole-game completion or owner art approval is claimed.

## Reproduce and continue

Use the repository's optional Playwright setup and `node tools/serve.mjs 8139`.
The runtime dependencies stay outside production; no package install is required.

```powershell
node tools/test.mjs
node tools/planet-nav-check.mjs artifacts/m5-nav --seed=12345
node tools/campaign-boundaries.mjs artifacts/m5-boundaries
node tools/campaign-check.mjs artifacts/m5-recovery
node tools/talent-launch-check.mjs artifacts/m5-talents
node tools/self-play.mjs 12345 artifacts/m5-continue --campaign --weapons --talents --planets=1 --checkpoint=docs/qa/implementation/M5B/planet-4-talent-checkpoint.json
```

`--planets` bounds the number of additional worlds, not the campaign length.
Every successful extraction writes a resumable checkpoint. A ready checkpoint
means remaining planets are unplayed; it is not a completion receipt. Preserve
failed traces before changing policy or tuning. Usage is unmeasured.
