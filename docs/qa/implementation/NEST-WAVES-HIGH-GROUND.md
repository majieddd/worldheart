# Nest waves, clear routes and high ground

Updated 2026-09-09. Owner: Codex on `feature/nest-waves-and-high-ground`, based
on preview `4ce4f94`. This continues [PR #25](https://github.com/majieddd/worldheart/pull/25)
and the [shared tracker](https://github.com/majieddd/worldheart/issues/1).
Publication is pending final checks. No main merge; usage unmeasured.

## Implemented

| Request | Behavior | Acceptance |
|---|---|---|
| U28 Mountain nests and usable biome routes | Nests need a 2.4 m dry clearing, a heart-connected floor route costing at most 160 units, 6 m separation and 10 m heart clearance. Generation certifies 17 sources. Broad eroded passes reach meadow height; tall uncut crests remain. | All-99 source capacity and isolated movement; four terrain profiles; fixed-field shape comparisons. More terrain-affinity species remain a content option. |
| U29 Elevated tower reach | Up to 60% extra horizontal reach over 30 m elevation, with vertical-drop compensation in the true targeting sphere. Placement, selection and upgrades use the same stats. Garrison leash gets the horizontal part. | Real shell guide/target boundaries, valley target and readout; template/element/upgrade tests. Extreme-height balance remains an owner playtest item. |
| U30 Timed nest waves | One nest each wave; two on waves 5/10 where space permits; final guardian nest. Survivors add packs on subsequent waves. The combat countdown allows overlap and pauses during drafts. Existing enemies and descendants stay assigned to their assault. | Overlap, source destruction, ordered rewards, full pool, guardian child, draft freeze/resume, narrow HUD, and a legal planet victory/extraction. |

Ordinary nest placement fixes the reported mountain-speed exploit without
giving ordinary mobs a mountain speed bonus. Emergency mountain travel remains
at 8% when a floor route is unavailable. New nest placement never relies on
that fallback. Water routes still use the existing swim penalty.

The countdown follows simulation time and game speed: 45 seconds after wave 1,
then two more seconds per wave, reaching 71 seconds before the final assault.
New structures have a three-second emergence warning. The early-call button
lets the player accelerate an assault for gold. If tower footprints leave no
safe source, a visible five-second retry holds the wave, awards nothing and
cannot farm repeated early-call gold. Selling can reopen ground.

## Evidence

These are source-informed fixtures unless explicitly labelled legal play.
They do not replace the frozen blind pass or certify a natural full campaign.

| Check | Result | Record |
|---|---|---|
| Headless contracts | 245/245 tests; 51/51 ESM modules parse | [test output](NEST-WAVES-HIGH-GROUND/tests.txt) |
| Live shell fixtures | 19 checks: overlap, source cancellation, draft freeze/resume, nonoverlapping 375/768/1280 HUD, elevated boundary/valley targeting and upgrade readout | [browser](NEST-WAVES-HIGH-GROUND/browser.json), [high ground](NEST-WAVES-HIGH-GROUND/high-ground.png), [narrow HUD](NEST-WAVES-HIGH-GROUND/hud-375.png) |
| Physical sources across all 99 planets | 17 sites at each of three frontier sizes; 15,147 husk/mite/wisp arrivals; no floor/ceiling violations; longest 88 simulation seconds | [full sweep](NEST-WAVES-HIGH-GROUND/all99.json) |
| Terrain profiles | Highlands, alpine, canyon and ocean checks pass; picking, camera, climate, swim, ground/air graphs | [terrain](NEST-WAVES-HIGH-GROUND/terrain.json) |
| Fixed effective seeds | 36 shape checks pass against the original pillar terrain; sampled alpine peaks remain 101.1 to 120.8 m | [field samples](NEST-WAVES-HIGH-GROUND/landforms.json) |
| Map regressions | Five maps and camera harnesses; actual defeat/retry | [maps](NEST-WAVES-HIGH-GROUND/maps.json) |
| Placement routes | 96 cases agree with independent full floor/weighted Dijkstra and preserve authoritative fields | [placement](NEST-WAVES-HIGH-GROUND/placement.json) |
| Commander and tower interaction | 22 comfort/native pointer-lock checks; twelve flat forest crossings and sixteen spawn headings; 16 actual nest-target/destruction checks | [comfort](NEST-WAVES-HIGH-GROUND/comfort.json), [movement](NEST-WAVES-HIGH-GROUND/clearance.json), [nest attacks](NEST-WAVES-HIGH-GROUND/targets.json) |
| Legal combat run | Fresh profile; 15-wave victory, 15 heart health, 543 kills, 12 nests destroyed; extracted 13 weapons to planet 2; no runtime faults | [run](NEST-WAVES-HIGH-GROUND/legal-run.json), [arrival](NEST-WAVES-HIGH-GROUND/arrival.json) |
| Moving placement | 64 legal positions and 280 route validations; p99 8.6 ms native, 40.3 ms at 4x CPU slowdown | [timing](NEST-WAVES-HIGH-GROUND/range-performance.json) |
| Sustained native stress | 100 enemies, 30 towers, 60 seconds and moving camera; p99 8.6 ms, median 131.6 FPS; no faults; pause/resume and frame budget pass | [timing](NEST-WAVES-HIGH-GROUND/performance-native.json) |
| Sustained 4x CPU stress | 100 enemies, 30 towers, 60 seconds and moving camera; p99 54 ms, median 26.8 FPS; no faults and pause/resume passes; frame budget fails | [retained timing](NEST-WAVES-HIGH-GROUND/performance-4x.json) |

The legal controller uses normal movement, attacks, purchases, cards, drafts,
equipment and extraction. It advances simulation at 60 Hz with sparse rendered
captures. This proves the implemented planet loop with that policy and seed,
not human feel, continuous rendered performance or all-99 combat completion.

## Adversarial findings retained

1. Requiring only a safe-looking node allowed tiny meadow patches and long
   approach detours. The initial canyon search found only one opening site.
   The search now inspects the entire clearing and certified approach.
2. Wider search still left one generated battlefield with only ten eligible
   sites. The intermediate legal run stalled at wave 10 after destroying ten
   nests. The generator now rejects fields without full schedule capacity.
   The fresh final run completed and extracted. [Initial sites](NEST-WAVES-HIGH-GROUND/initial-sites.json),
   [capacity failure](NEST-WAVES-HIGH-GROUND/capacity-failure.json),
   [stalled run](NEST-WAVES-HIGH-GROUND/stalled-run.json).
3. A HUD-width-only test passed while the countdown overlapped controls at
   375/768 px. The updated oracle checks overlap as well as screen bounds;
   narrow layouts put the wave row below controls and above resource panels.
   [Retained overlap failure](NEST-WAVES-HIGH-GROUND/hud-failure.json).
4. A source retry could otherwise pay repeated early-call bounty. The blocked
   state disables that payout. Queue ownership also preserves owed enemies
   when the pool is full and carries boss/split descendants through rewards.

## Remaining acceptance

Reduced-CPU frame budgets and startup are still open. This build took 102.2
seconds to boot in the 4x slowdown fixture and 21.9 seconds at native speed;
this changed battlefield is not a
controlled same-layout comparison with prior timing. The placement veil stays
pooled at two geometries, but navigation and full-frame work can exceed the
budget under slowdown. This is the same GPU with DevTools CPU throttling,
not lower-end hardware certification. No multiplayer or platform-port claim.

Continue natural tactics on later planets and owner review of terrain scale,
high-ground balance, first-person models and continuous motion. Full natural
99-planet completion and main rename/release stay open on M0-M5. M6 multiplayer
and native platform prototypes remain subsequent work.
