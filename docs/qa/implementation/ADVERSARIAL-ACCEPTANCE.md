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
| A1 Keyboard and input ownership | repaired, browser verified | Inventory actions/customization retain focus and scroll; modal shortcuts cannot mutate the world; closing resumes the prior input/pause context | 15 keyboard, 6 possessed-ending, 20 campaign recovery checks; natural victory and extraction | unmeasured |
| A2 Combat readability and model alignment | arm repair verified, broader audit active | Strike guides remain visible and agree with damage on hills/shore/flat terrain; weapon era/parts have meaningful readable representation | 12 arm proportion/material checks; 29 combat regressions. Terrain-edge tells and authored era silhouettes remain | unmeasured |
| A3 Foliage and geometry | expanded geometry audit passed, visual acceptance open | Fixed-seed close orbit, normals/winding, moving color/shadow deformation and all map families; preserve an unreproduced complaint as open | Eight map/profile cases and rendered close views; original artifact not reproduced identically | unmeasured |
| A4 Ocean and campaign pacing | active | Varied legal strategy from earned checkpoint, clear win/loss and no indefinite stalls; preserve losses and distinguish controller defects from game balance | Fresh planet 1 won and extracted; planet 2 lost at wave 12. Ocean failures in OCEAN-STRATEGY.md remain | unmeasured |
| A5 Sustained performance and recovery | reference desktop passed; recovery repair active | Reproducible load, frame-time distribution and resource growth over a prolonged session; pause/background recovery and reduced capability configuration | Valid 180-second moving-camera load and pause/resume passed; reduced capability and actual background visibility remain | unmeasured |
| A6 Final alignment and release gates | planned | Original U01-U27 and M0-M5 mapped to current evidence and actionable remaining work; all new changes tested on public V2 | Main release, owner feel and full 99-planet play remain open | unmeasured |

Start with baseline failures before source fixes. Browser fixtures may inject
explicit setup resources/positions to isolate a rule; only unforced legal play
counts toward campaign outcomes. Do not tune difficulty merely to make the
instrumented controller win. Every repair needs a reproducing check, relevant
regressions and a whole-run observation before publication.

M6 remains after stable single-player acceptance: authoritative co-op/PvPvE
and native platform prototypes are distinct future work, not automatic exports.

## Reproduced defects and repairs

Keyboard part changes, equipping and salvaging rebuilt the inventory and left
focus on the document body. The transaction succeeded but the next Tab started
from the wrong place. Preserve focus by item/action, open customization and
scroll; when an item disappears, use a surviving neighboring action. Actual
Tab, Enter, ArrowDown, I and Escape inputs now pass [15 checks](ADVERSARIAL-ACCEPTANCE/keyboard-after.json).
The [corrected old-build control](ADVERSARIAL-ACCEPTANCE/keyboard-before.json)
fails exactly three focus checks. The [initial fixture](ADVERSARIAL-ACCEPTANCE/keyboard-initial.json)
also failed a camera assertion because it did not settle the camera first;
that fourth failure is a test defect, not an additional game bug.
[Keyboard focus capture](ADVERSARIAL-ACCEPTANCE/keyboard-equipment.png).

A natural commander victory revealed that pausing did not release pointer
lock. The visible extraction button could not be clicked, and the combat HUD
covered part of the receipt. The [old-build fixture](ADVERSARIAL-ACCEPTANCE/ending-before.json)
reproduced this with a browser-granted pointer lock, not a mocked lock flag.
Ending now suspends possessed input, releases the pointer, clears held board
input, focuses the receipt and hides combat overlays. Collect remaining loot
restores the same commander. An inventory opened above the receipt returns
its prior pause and input ownership. [Six checks](ADVERSARIAL-ACCEPTANCE/ending-after.json)
include a real extraction click and next-planet arrival.
[Repaired receipt](ADVERSARIAL-ACCEPTANCE/possessed-victory.png).

Long weapon parts scaled the entire first-person model, stretching the holding
arm. Era material changes also recolored the gauntlet. The arm now stays outside
weapon length and tint changes, while the blade trail follows the extended
prop. The four families failed [eight old-build assertions](ADVERSARIAL-ACCEPTANCE/proportions-before.json)
and now pass [all twelve checks](ADVERSARIAL-ACCEPTANCE/proportions-after.json).
This fixes anatomy consistency; it does not finish the three authored era sets.

## Whole-run observation

The [initial legal run](ADVERSARIAL-ACCEPTANCE/initial-victory.json), requested
seed 12345/effective 28183, won wave 15 with 22 heart health, 1,575 kills and
eight towers. Its next real extraction click timed out.
[Preserved failure](ADVERSARIAL-ACCEPTANCE/initial-extraction-failure.png).
That harness version had not exported a victory checkpoint before clicking,
so it lost the resumable save when the browser closed. No save was fabricated
from the trace; the harness now exports before travel and also on errors.

The [repaired run](ADVERSARIAL-ACCEPTANCE/repaired-victory.json) independently
won the same starting planet with 22 heart health, 1,551 kills, eight towers,
1,083 gold and commander HP 753.04/1,400. It destroyed two physical nests.
[Victory](ADVERSARIAL-ACCEPTANCE/repaired-victory.png),
[earned victory checkpoint](ADVERSARIAL-ACCEPTANCE/victory-checkpoint.json),
and [successful planet-2 arrival](ADVERSARIAL-ACCEPTANCE/repaired-arrival.json)
retain the eight banked weapons. The next canyon planet, effective seed 36102,
[lost at wave 12](ADVERSARIAL-ACCEPTANCE/planet-2-defeat.json) when the commander
died, with 20 heart health, 283 kills and seven towers.
[Defeat](ADVERSARIAL-ACCEPTANCE/planet-2-defeat.png) and
[earned retry checkpoint](ADVERSARIAL-ACCEPTANCE/earned-retry-checkpoint.json)
are retained. Neither run had a runtime fault or injected combat resources.

These are unforced instrumented policy runs using legal purchases, movement,
attacks and placements, not blind or human play. The repaired run advances
simulation at 60 Hz but renders once per two simulated seconds plus captures;
it is not frame-rate evidence. Its changed sampling cadence and boot timing
mean the two outcomes are not a deterministic performance comparison. A weak
controller losing does not establish an unwinnable planet or justify lowering
difficulty. Full 99-planet completion and varied ocean tactics remain open.

## Geometry and regression coverage

[Eight foliage cases](ADVERSARIAL-ACCEPTANCE/foliage.json) cover pocket, giant,
titan, reach and varied/alpine/canyon/ocean campaign profiles. Pine, broadleaf,
rock and crystal meshes have finite geometry, outward triangle winding,
positive finite instance transforms and shared visible/depth wind uniforms.
Degenerate pole triangles are reported separately. Front/side views sample
different wind times; close tree views were also rendered. Inspected
[pine](ADVERSARIAL-ACCEPTANCE/pine-near.jpg),
[broadleaf](ADVERSARIAL-ACCEPTANCE/broadleaf-side.jpg) and
[ocean grove](ADVERSARIAL-ACCEPTANCE/ocean-pines.jpg) show intact faceted forms.
The owner's original polygon complaint is not reproduced identically and
remains a visual acceptance item. No foliage source changes were needed here.

[All five map/camera regressions](ADVERSARIAL-ACCEPTANCE/regression.json),
[29 weapon checks](ADVERSARIAL-ACCEPTANCE/weapons.json),
[14 context edge checks](ADVERSARIAL-ACCEPTANCE/context.json), and
[20 campaign/recovery checks](ADVERSARIAL-ACCEPTANCE/campaign.json) passed.

The first extended performance fixture was rejected: its pause/resume check
revealed that simulation had already stopped. The first diagnosis focused on
the commander's unprotected health. An instrumented retry still reached
defeat, revealing the second setup mistake: heart upgrades re-applied normal
heart health after the fixture had injected it. The corrected setup applies
stress health to both heart and commander after upgrading, and holds the wave
director while the replenished enemies, movement, combat and effects run.
Every recorded sample must remain playing/unpaused with advancing simulation
time, and pause/resume is part of the passing gate. Earlier short performance
records are historical, not retroactively strengthened by this fixture repair.

The [final reference stress run](ADVERSARIAL-ACCEPTANCE/performance-native.json)
kept simulation active for all samples: 180 seconds, 100 replenished enemies,
30 legally placed towers, continuous orbit, Chrome 152, 1920x1080/DPR 1,
i9-13900H, RTX 4080 Laptop GPU and 63.6 GiB RAM. Across 16,432 frames, median
was 8 ms (125 fps), p95 16.3 ms, p99 23.5 ms (42.55 fps inverse), maximum
46.6 ms. Boot took 8.3 seconds. Pause held simulation exactly and Resume
advanced normally. No runtime faults occurred; bloom remained at five levels
with shadows. This passes the provisional reference desktop budget, not
unspecified lower-end hardware or a many-hour campaign session.
[Final load capture](ADVERSARIAL-ACCEPTANCE/performance-native.png).
Geometry rose by 168 as loot appearances were lazily cached, textures stayed
constant and sampled heap fell by 0.75 MiB; this short sample does not establish
the absence of long-session leaks.

A real WebGL loss/restore test resumed correctly but emitted invalid-operation
warnings while deleting obsolete render targets. Dispose post-processing
targets while the original context is lost and rebuild on restoration, keeping
the selected quality. Actual tab switching in this headless Chrome left both
tabs visible, so it cannot prove background-tab behavior. That coverage stays
open rather than replacing document.hidden with a fabricated value.

[Before recovery warnings](ADVERSARIAL-ACCEPTANCE/recovery-before.json) and
[repaired recovery checks](ADVERSARIAL-ACCEPTANCE/recovery-after.json) are
retained. All four covered GPU/restart checks pass, with only the deliberate
context-loss warning. [Restored frame](ADVERSARIAL-ACCEPTANCE/context-restored.png).

[Expanded terrain strike fixtures](ADVERSARIAL-ACCEPTANCE/terrain-strikes.json)
pass 21 grouped assertions: four measured flat/slope/shore/peak sites, all five
enemy species, 30/60/120 Hz, and 300 inside/elevated/outside-radius/behind/outside-arc
damage probes. Grounded acquisition creates the real locked attack; exact
world-space probes independently use the displayed guide's matrix and verify
damage at release, no early damage, removal and death cancellation. Elevated
probe positions are injected, not a claim of natural jump/dodge play. The wisp
uses its actual 0.7m dive altitude. [Slope guardian](ADVERSARIAL-ACCEPTANCE/slope-colossus.jpg)
and [shore wisp](ADVERSARIAL-ACCEPTANCE/shore-wisp.jpg) preserve rendered tells.
These checks establish transform/timing agreement; owner readability and
continuous-input combat feel remain separate review.

The optional assault policy now has a `--cautious` variant for the next ocean
attempt: read visible windups, use ordinary sidesteps, stop at actual melee
reach and reconsider recovery routes. It alters input decisions only, not
game health, damage, movement, rewards or difficulty. No cautious outcome is
claimed until its legal run finishes. The harness also recognizes its actual
assault equipment trace action when summarizing the weapon loop; previous
false summaries remain preserved with their raw actions.

[228 headless tests](ADVERSARIAL-ACCEPTANCE/headless.txt), 50-module syntax,
house style and regenerated deployment mirrors passed after the recovery fix.

## Reproduce

Start the source server at port 8139 and use the external Playwright runtime
described in CONTRIBUTING.md. The new input/proportion tools accept
WH_BASE_URL for a frozen prior build or public V2.

```powershell
node tools/acceptance-input-check.mjs artifacts/acceptance-input
node tools/ending-input-check.mjs artifacts/acceptance-ending
node tools/viewmodel-proportion-check.mjs artifacts/acceptance-proportions
node tools/foliage-audit.mjs artifacts/acceptance-foliage
node tools/self-play.mjs 12345 artifacts/acceptance-play --campaign --weapons --talents --planets=4 --strategy=assault --sparse-render
node tools/performance-check.mjs artifacts/acceptance-performance --orbit --seconds=180
```

Performance measurements must run without another QA browser job. CPU slowdown
is a reproducible reduced-capability configuration on this GPU, not a claim
about an actual low-end device. Owner feel approval and main release remain
separate gates even after a V2 publication passes.
