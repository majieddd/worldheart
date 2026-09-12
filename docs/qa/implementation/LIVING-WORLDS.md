# Living worlds and traversal: request ledger

Owner: Codex. Branch `feature/living-worlds-and-traversal`, based on V2 `42b1ee0`.
September 12, 2026. Scope is the latest complete owner request. All earlier
interrupted copies are superseded by this ledger. Main is not a publication target.

| Item | State | Acceptance |
|---|---|---|
| U75 Earthquake prediction and nest destruction | Verified locally | Shared fault geometry produces a red pulsing predicted surface; disrupted nests are destroyed once |
| U76 Commander cliff traversal | Verified locally | Walk and jump off real ledges, fall and land naturally, retaining terrain and tower collision |
| U77 Increasing forge cost | Verified locally | Each successful forge raises the displayed next cost; failed attempts do not |
| U78 Tower clearance and nest routes | Verified locally | Enemies pass close to towers through actual gaps; valid nests are not delayed by inflated grid footprints |
| U79 One relic per object | Verified locally | Every visible amber pickup grants exactly one ore, including nest drops |
| U80 Alert and campaign HUD separation | Verified locally | Planet status, alerts and controls do not overlap at desktop and narrow sizes |
| U81 Weapon families and five material tiers | Verified locally | Twin blades and ember staves receive wood, iron, gold, diamond and onyx models and rarity stats alongside every weapon family |
| U82 Tower upgrade silhouettes | Verified locally | Every family retains its identity while upgrades add clear structural advancement |
| U83 Flying saucer mount | Verified locally | Replace the flying mount model with a coherent UFO, retaining flight controls and balance |
| U84 Twenty new landforms | Active: audited and authored design | Audit existing thirty; research, author and visually compare fifty distinct formations, including useful traversal and interactive features |
| U85 Ten terrain packs | Active: audited and authored design | Mixed default; specialized extreme peaks, deep cuts and island worlds; ten packs with theme-dependent regional coverage |
| U86 Fifteen new biomes | Active: audited and authored design | Audit existing fifteen; thirty distinct biome palettes, vegetation and environmental dressing in planets and Debug World |
| U87 Ten new planet themes | Active: audited and authored design | Twenty distinct combinations of terrain packs, climate and biome distribution, shown on real miniature planets |
| U88 Existing formation revisions | Active: audited and authored design | Flat plateau siblings, broader spaced buttes, larger hills, glacial bridge, deeper branched rift, spaced crust, larger volcano, flat canopy shelves, meteor crater, spaced yardangs/drumlins/blades, flat fan apex, deep karst, continuous spiral and usable star/cell passages |

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
0.7 m nominal gap, passing within 1.45 m of a tower centre. Local verification
is complete for U75-U83; preview publication is in progress.

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
