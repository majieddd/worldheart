# Living worlds and traversal: request ledger

Owner: Codex. Branch `feature/living-worlds-and-traversal`, based on V2 `42b1ee0`.
September 12, 2026. Scope is the latest complete owner request. All earlier
interrupted copies are superseded by this ledger. Main is not a publication target.

| Item | State | Acceptance |
|---|---|---|
| U75 Earthquake prediction and nest destruction | Published and publicly verified | Shared fault geometry produces a red pulsing predicted surface; disrupted nests are destroyed once |
| U76 Commander cliff traversal | Published and publicly verified | Walk and jump off real ledges, fall and land naturally, retaining terrain and tower collision |
| U77 Increasing forge cost | Published and publicly verified | Each successful forge raises the displayed next cost; failed attempts do not |
| U78 Tower clearance and nest routes | Published and publicly verified | Enemies pass close to towers through actual gaps; valid nests are not delayed by inflated grid footprints |
| U79 One relic per object | Published and publicly verified | Every visible amber pickup grants exactly one ore, including nest drops |
| U80 Alert and campaign HUD separation | Published and publicly verified | Planet status, alerts and controls do not overlap at desktop and narrow sizes |
| U81 Weapon families and five material tiers | Published and publicly verified | Twin blades and ember staves receive wood, iron, gold, diamond and onyx models and rarity stats alongside every weapon family |
| U82 Tower upgrade silhouettes | Published and publicly verified | Every family retains its identity while upgrades add clear structural advancement |
| U83 Flying saucer mount | Published and publicly verified | Replace the flying mount model with a coherent UFO, retaining flight controls and balance |
| U84 Twenty new landforms | Published and publicly verified | Audit existing thirty; research, author and visually compare fifty distinct formations, including useful traversal and interactive features |
| U85 Ten terrain packs | Published and publicly verified | Mixed default; specialized extreme peaks, deep cuts and island worlds; ten packs with theme-dependent regional coverage |
| U86 Fifteen new biomes | Published and publicly verified | Audit existing fifteen; thirty distinct biome palettes, vegetation and environmental dressing in planets and Debug World |
| U87 Ten new planet themes | Published and publicly verified | Twenty distinct combinations of terrain packs, climate and biome distribution, shown on real miniature planets |
| U88 Existing formation revisions | Published and publicly verified | Flat plateau siblings, broader spaced buttes, larger hills, glacial bridge, deeper branched rift, spaced crust, larger volcano, flat canopy shelves, meteor crater, spaced yardangs/drumlins/blades, flat fan apex, deep karst, continuous spiral and usable star/cell passages |

U75-U88 are live at [V2](https://majieddd.github.io/worldheart/v2/) and
[Debug World](https://majieddd.github.io/worldheart/v2/debug.html) as `8f94dc6`,
through [Pages 34713172378](https://github.com/majieddd/worldheart/actions/runs/34713172378).
[PR #38](https://github.com/majieddd/worldheart/pull/38) contains the changes;
260 identity comparisons and 253 public functional checks pass, with a separate
12.75s public startup and native render pass. Main remains `1374122`.

## Execution and evidence

Fix traversal, economy, alerts and disasters first; then equipment/mount visuals;
then expand the audited landform/biome/theme vocabulary and terrain recipes.
Record source findings separately from browser reproductions and unforced play.
Publish coherent verified checkpoints to V2 with draft review and update #1/#5.
Acceptance includes pure tests, actual browser input and geometry checks, visual
comparisons, classic/camera regression, one completed defense and live identity.
The unfinished phrase "without removing the current" is interpreted as preserving
the current terrain, obstacle and enemy-routing rules while allowing ledge drops.

Local gameplay checkpoint: 299 pure tests, 79 syntax modules, 156 Debug World
checks, 23 critical fixtures, 22 real equipment checks, 20 traversal/input cases,
35 campaign fixtures and all five camera maps passed. Eighteen equipped poses
have finite models in first and third person. Native-frame quake performance passed: 1,633 frames, 14 ms p99, 41.6 ms
worst frame and 16.8 ms longest preparation slice on this RTX 4080 laptop.
The initial 71 ms preparation slice is retained as a failed check; private
buffer copies and clearing probes now yield between bounded chunks. Four
physical tower-gap checks pass, including a real husk walking through the
0.7 m nominal gap, passing within 1.45 m of a tower centre. U75-U83 are published at V2 as e67d697 through
[Pages 34708733408](https://github.com/majieddd/worldheart/actions/runs/34708733408).
All 250 source/asset identity comparisons and 49 public interaction cases pass.
Main remains 1374122. Current review: [PR #38](https://github.com/majieddd/worldheart/pull/38).

Adversarial finding retained: the first complete-defense attempt stalled after
wave 6 because an earthquake left no future nest clearings. Forecast preparation
now checks both current unit routes and eleven future, separated nest sites on
private navigation buffers before showing the eight-second warning. The rerun
won all ten waves, retained all 20 lives, killed 306 enemies, then extracted to
Planet 2 with four earned inventory items intact. This was instrumented legal
self-play with sparse rendering, not native input/performance or a 99-planet pass.
The policy did not equip a dropped weapon; equipment acceptance is a separate
targeted check. Other retained failures were stale gallery keys, a camera test's
early global lookup, and outdated ore/weapon-family fixture expectations.

Local evidence: artifacts/living-worlds/{critical-capacity,equipment-fixed,
equipment-gallery-fixed,traversal-forecast,cameras,poses,full-run-fixed}.
Research and new-content distinctions are recorded in
[the morphology audit](LIVING-WORLDS-RESEARCH.md). Full-campaign, broad-device
and multiplayer work remain separate.

Durable reports and selected images: [checkpoint evidence](LIVING-WORLDS/).

## Generator v8 checkpoint

U84-U88 are implemented and locally verified: fifty formations, thirty biomes,
twenty themes and ten terrain packs. All requested old-shape corrections are
included. Grotto roofs, glacial bridges, floating mesas, pedestal caps and fossil
logs have shared physical/rendered surfaces. Geysers launch nearby ground units
on both teams using the displayed eruption clock. Themes compose regional,
majority or global pack coverage and their own biome vocabulary.

304 tests, 84 syntax modules, 93 generated mirrors, 207 Debug World checks,
74 world-composition/navigation assertions across all thirty pack/theme worlds,
five camera maps, 23 critical fixtures, four physical tower-gap cases and five
deck/geyser fixtures pass. The worst sampled connected deep-floor fraction was
99.8%, with intentional karst/kettle traps reported separately. Each world also
certified eleven separated physical nest approaches.

All fifty formation exhibits, thirty biomes, ten terrain patches and twenty
miniature globes were visually reviewed. The correction pass widened channel
floors, separated rift tributaries, widened honeycomb walls and improved the
floating-deck/log silhouettes. Ocean worlds initially failed the continental
base scout; broader island shelves and island-specific front acceptance fixed
this while preserving dry base placement and eleven-nest capacity. A camera
grounding bug that pulled commanders off extra decks was reproduced with real
keyboard movement and fixed.

Native performance on this RTX 4080 laptop: Debug startup 11.97s, full-lane p99
14ms, unit-lane p99 7.2ms. A separate 60-second moving-camera stress fixture at
1280x720 held thirty towers and about one hundred enemies: median 72.5 fps,
inverse p99 36.2 fps, worst frame 41.6ms, with pause/resume and no browser errors.
These are machine-specific native fixtures, not reduced-device acceptance.

Final-source legal self-play won all ten waves with 22 heart health, 262 kills
and six towers, then extracted to Planet 2 with five earned inventory items,
including the new scepter and twinblade families. Simulation used sparse
rendering and no injected economy/enemies/waves. It did not equip a dropped
weapon; that remains covered by the separate equipment fixtures. A prior legal
wave-ten loss is retained: the policy incorrectly attempted remote upgrades
while possessing the commander. It now uses the normal orbit construction view
and resumes the same body. Game balance was not changed for this rerun.

[Durable generator evidence and visual sheets](LIVING-WORLDS/generator/) include
the failed first attempts and bounded acceptance limitations. Upper-deck tower
placement and layered AI routes are not part of these physical commander
surfaces. Full 99-planet completion and broad hardware coverage remain open.
The generator checkpoint is published as `8f94dc6` through the Pages run linked
above. Public verification includes 260 identity comparisons, 206 functional
gallery checks, 23 critical cases, five deck/geyser cases and nineteen assertions
across six representative full worlds. The initial public gallery startup was
15.39s while concurrent suites ran, missing the 15s target. A separate isolated
public load took 12.75s; its full-lane p99 was 14ms and unit-lane p99 was 7.2ms.
Both records are retained. All source hashes match the tested release; the
production root still matches unchanged main.
