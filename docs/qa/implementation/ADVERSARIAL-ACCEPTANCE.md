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
| A2 Combat readability and model alignment | arm and terrain contracts verified; authored content open | Strike guides remain visible and agree with damage on hills/shore/flat terrain; weapon era/parts have meaningful readable representation | 12 arm checks, 29 combat regressions, 300 terrain strike probes. Human readability and authored era silhouettes remain | unmeasured |
| A3 Foliage and geometry | expanded geometry audit passed, visual acceptance open | Fixed-seed close orbit, normals/winding, moving color/shadow deformation and all map families; preserve an unreproduced complaint as open | Eight map/profile cases and rendered close views; original artifact not reproduced identically | unmeasured |
| A4 Ocean and campaign pacing | ocean victory and extraction verified; broader balance open | Varied legal strategy from earned checkpoint, clear win/loss and no indefinite stalls; preserve losses and distinguish controller defects from game balance | Fresh planet 1 won and extracted; planet 2 lost at wave 12. Cautious ocean won wave 15 and arrived at planet 5 with 13 weapons. Prior failures retained | unmeasured |
| A5 Sustained performance and recovery | reference desktop and GPU recovery passed; reduced CPU budget failed | Reproducible load, frame-time distribution and resource growth over a prolonged session; pause/background recovery and reduced capability configuration | Valid 180-second reference and final 60-second rerun passed; exact upload savings verified. Reduced CPU and actual background visibility remain | unmeasured |
| A6 Final alignment and release gates | U01-U27 review recorded; second batch live verified | Original U01-U27 and M0-M5 mapped to current evidence and actionable remaining work; all new changes tested on public V2 | OWNER-ALIGNMENT.md separates implemented contracts from remaining art, feel, device and campaign gates; 50 final public checks pass | unmeasured |
| A7 Independent feedback preferences | published and live verified, 23/23 checks | Flashes, blade trails, floating numbers and grain can be reduced separately; saved preferences preserve damage, red tells and essential hit/block information | Four missing old-build controls, narrow overlay repair, keyboard and real combat checks; public-preferences.json | unmeasured |

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
difficulty. Full 99-planet completion remains open.

The [cautious ocean continuation](ADVERSARIAL-ACCEPTANCE/ocean-victory.json)
resumed the earned M5B planet-4 talent checkpoint, effective seed 389884. It
won wave 15 with two heart health, 940 kills, seven towers, 724 gold and
commander HP 1,501.39/1,680. It destroyed three nests, issued 404 attacks and
used 1,495 ordinary evasive-input decisions. The commander recovered after
wave 13, but the heart lost health while the remaining pressure was cleared.
[Victory receipt](ADVERSARIAL-ACCEPTANCE/ocean-victory.png),
[pre-extraction save](ADVERSARIAL-ACCEPTANCE/ocean-victory-checkpoint.json),
[actual planet-5 arrival](ADVERSARIAL-ACCEPTANCE/ocean-arrival.json) and
[earned ready checkpoint](ADVERSARIAL-ACCEPTANCE/planet-5-checkpoint.json)
preserve the result and all 13 banked weapons. No combat state was injected;
the input policy chose legal purchases, attacks, movement and placement.
The trace retains transient stopped enemies, but the wave cleared naturally
and there was no persistent commander stall or runtime fault. This is one
successful varied strategy, not late-campaign or overall ocean balance
acceptance. Sparse rendering has the same limits as the repaired run above.

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

The optional assault policy now has a `--cautious` variant for the ocean
attempt: read visible windups, use ordinary sidesteps, stop at actual melee
reach and reconsider recovery routes. It alters input decisions only, not
game health, damage, movement, rewards or difficulty. Its completed outcome
is recorded above. The harness also recognizes its actual
assault equipment trace action when summarizing the weapon loop; previous
false summaries remain preserved with their raw actions.

[228 headless tests](ADVERSARIAL-ACCEPTANCE/headless.txt), 50-module syntax,
house style and regenerated deployment mirrors passed after the recovery fix.

## V2 checkpoint and continued work

Source `b17ec771f5b26e93b9f976f87fd33ffe8ae639dd` is live via
[deployment 34056541006](https://github.com/majieddd/worldheart/actions/runs/34056541006)
and [draft PR #22](https://github.com/majieddd/worldheart/pull/22). Public V2
passed [17 deployment/root/save checks](ADVERSARIAL-ACCEPTANCE/public-preview.json),
[six possessed-receipt checks](ADVERSARIAL-ACCEPTANCE/public-ending.json) and
[15 keyboard checks](ADVERSARIAL-ACCEPTANCE/public-keyboard.json). Production
remains `1374122d1109919a5fab10b69fefdfb80308eb6e`; no gameplay PR was merged.

The [4x CPU slowdown run](ADVERSARIAL-ACCEPTANCE/performance-cpu4-before.json)
kept its 100-enemy/30-tower simulation alive and passed pause/resume, but failed
the frame budget at 1280x720: median 39 ms (25.64 fps), p99 106.5 ms (9.39 fps),
maximum 215 ms, boot 39.76 seconds. Auto quality reduced bloom to three levels.
It is reduced CPU capability on the same GPU, not actual low-end hardware.
[Capture](ADVERSARIAL-ACCEPTANCE/performance-cpu4-before.png). CPU profiling and
the subsequent control are recorded below; the desktop pass cannot conceal this failure.

The approved blueprint called for independent cosmetic controls. The old build
has [none of these four controls](ADVERSARIAL-ACCEPTANCE/preferences-before.json).
The new settings provide Impact flashes, Blade trails, Damage numbers and Film
grain, persisted independently of bob, shake and focus. Reduced-motion defaults
disable all four. Lowered flashes retain a static expiring hit marker and
blocked feedback; trails apply to first and third person. Damage and red attack
tells, actual projectiles and beams remain active. The renderer lowers optional
particle brightness and actor hit whitening without changing combat values.
[Nineteen browser checks](ADVERSARIAL-ACCEPTANCE/preferences-after.json) cover
keyboard input, isolation, persistence, reduced defaults and effect behavior.
Settings were inspected at [720p](ADVERSARIAL-ACCEPTANCE/settings-1280.png),
[1080p](ADVERSARIAL-ACCEPTANCE/settings-1920.png) and
[390px](ADVERSARIAL-ACCEPTANCE/settings-390.png). This is a scoped comfort feature,
not a photosensitivity certification or a whole accessibility audit.

The first narrow screenshot exposed a build card covering lower Settings
controls. The settings surface now sits above world panels, closes on a
victory receipt and supports Escape with focus returned to its button.
[Expanded checks](ADVERSARIAL-ACCEPTANCE/preferences-expanded.json) pass 23/23,
including element hit-testing of every button and slider after scrolling at
all three sizes. [Repaired narrow view](ADVERSARIAL-ACCEPTANCE/settings-390-after.png).
[29 combat regressions](ADVERSARIAL-ACCEPTANCE/preferences-weapons.json) also pass.

## Measured CPU work

The [60-second sampled CPU profile](ADVERSARIAL-ACCEPTANCE/cpu-profile.json)
identified GPU buffer uploads, terrain noise sampling and ally route searches.
Profiler overhead makes its frame rates diagnostic rather than acceptance
evidence. Packed actor instance buffers were uploading their entire reserved
capacity, even when empty. They now upload only the live prefix and skip
empty buffers. Static cache positions retain the exact terrain sample until
their direction changes. A route whose endpoints are in the same valid cell
returns its zero-cost path without resetting and searching the graph.

[Before GPU readback control](ADVERSARIAL-ACCEPTANCE/uploads-before.json) and
[after](ADVERSARIAL-ACCEPTANCE/uploads-after.json) both verify the actual GPU
values against the CPU data after full, shrinking, empty and reused actor
populations. All ten after assertions pass. With 100 fixture enemies, measured
bufferSubData traffic per sampled frame falls from 2,676,688 to 126,008 bytes
(95.3%); empty actor traffic falls to 2,508 bytes. These are upload counts, not
an inferred FPS improvement. Exact cache positions and invalidation are
verified, and the same-cell path avoids the previous Dijkstra call. No terrain
sampling approximation, camera pose, navigation cost or combat value changed.
The slower-CPU frame budget was retested separately.

The [180-second optimized retry](ADVERSARIAL-ACCEPTANCE/performance-cpu4-after.json)
still fails: 18.12 fps median / 6.03 fps inverse p99. A subsequent
[60-second frozen old-build control](ADVERSARIAL-ACCEPTANCE/performance-cpu4-control.json)
also measured 18.35 / 6.13, showing that the initial 25.64 fps result cannot be
used as a stable before/after comparison in this session. One headless QA
browser was active at a time. The upload reduction is verified, but no FPS
improvement or lower-capability acceptance is claimed. Further camera terrain
query and path-search costs remain profiled leads rather than speculative
changes to camera feel or authoritative terrain rules.

The [final 60-second reference rerun](ADVERSARIAL-ACCEPTANCE/performance-final-native.json)
on the updated source passed with 7,374 frames: median 7.7 ms (129.87 fps),
p95 15.3 ms, p99 16 ms (62.5 fps), maximum 32.2 ms and boot 8.39 seconds.
All load samples were active, pause/resume passed, and no runtime faults
occurred. This preserves the reference desktop gate; it does not turn the
reduced-CPU failure into a pass or establish a causal FPS improvement.

Final source regressions pass [all five maps](ADVERSARIAL-ACCEPTANCE/final-regression.json),
[16 crystal transactions](ADVERSARIAL-ACCEPTANCE/final-crystals.json),
[four covered GPU recovery checks](ADVERSARIAL-ACCEPTANCE/final-recovery.json)
and [228 headless tests](ADVERSARIAL-ACCEPTANCE/final-headless.txt). Actual
background visibility remains untested because both headless tabs stayed visible.

## Final public checkpoint

Source `d9324592b38cdbd5d9c612ff93ab744d95567c57` was published by
[deployment 34058300671](https://github.com/majieddd/worldheart/actions/runs/34058300671).
Public V2 passed [23 feedback checks](ADVERSARIAL-ACCEPTANCE/public-preferences.json),
[10 real GPU upload/readback checks](ADVERSARIAL-ACCEPTANCE/public-uploads.json)
and [17 deployment/root/save-isolation checks](ADVERSARIAL-ACCEPTANCE/public-final.json).
All 50 passed without runtime faults. Production remains
`1374122d1109919a5fab10b69fefdfb80308eb6e`, with no gameplay merge to main.
This evidence follow-up changes documentation only. A later documentation-only
preview may retain the tested runtime only if every preview and production
asset hash still matches this public manifest; a runtime change needs its own
relevant verification. PR #22 remains a stacked draft on #21.

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
node tools/feedback-preferences-check.mjs artifacts/acceptance-preferences
node tools/instance-upload-check.mjs artifacts/acceptance-uploads
node tools/self-play.mjs 12345 artifacts/acceptance-ocean --campaign --weapons --talents --planets=1 --checkpoint=docs/qa/implementation/M5B/planet-4-talent-checkpoint.json --strategy=assault --cautious --tower-priority=helios,bolt,tesla,mortar,cryo,warden --tower-limit=10 --sparse-render
```

Performance measurements must run without another QA browser job. CPU slowdown
is a reproducible reduced-capability configuration on this GPU, not a claim
about an actual low-end device. Owner feel approval and main release remain
separate gates even after a V2 publication passes.
