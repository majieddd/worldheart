# Expedition, survival and lobby expansion

Owner: Codex. Active branch `feature/expedition-lobby-and-survival`, based on
V2 `665b8f3`. September 12, 2026. Tracker #1; current subsystem ownership:
run progression, commander lifecycle, world inspection, weather/mount adapters
and lobby. The parallel lobby-reference research is complete. Implementation is in the
working branch; local acceptance is complete and V2 publication is next.

## Complete request ledger

| Item | State | Acceptance |
|---|---|---|
| U60: Terrain collection between formations and biomes | Verified locally | Large combined production-field samples show the four terrain mixes |
| U61: Themes own climate | Verified locally | Remove climate selector, use planet theme; shared inspector links remain reproducible |
| U62: At least fifteen biomes | Verified locally | Fifteen named, visibly distinct registered samples and themed generation |
| U63: Starting commander choice | Verified locally | Select any of the five commanders before an assault; show health, power and speed |
| U64: Weapons scale with base level | Verified locally | Native and equipped weapon damage/range and comparison UI agree |
| U65: Base can grow over the full planet | Verified locally | Increasing late expansion steps reach the antipode; navigation and camera remain valid |
| U66: Ten-wave cap and opt-in endless | Verified locally | Wave ten resolves once, then explicit continuation runs increasing waves without a terminal cap |
| U67: More threatening enemies | Verified locally | Actual commander hits increase, with measured survivability and complete-run checks |
| U68: Safe-base respawn | Verified locally | Death inside territory waits 30 simulation seconds, outside territory defeats; pause and repeat deaths are safe |
| U69: Commander identity and level scaling | Verified locally | Five distinct health/power/speed profiles; upgrades apply once and speed includes mounts |
| U70: Movement comfort | Verified locally | Smooth acceleration/traversal and milder bob, including first/third person and reduced motion |
| U71: Tactical weather | Verified locally | Warned tornado moves units; earthquake visibly alters terrain and routes without rebuilding graph identities |
| U72: Distinct balanced mounts | Verified locally | Ground speed, water traversal and limited flight have different strengths/costs, real models and controls |
| U73: Walkable preparation lobby | Verified locally | Screenshot-inspired open courtyard, commander pavilion, tower roller/loadout, mount station and explicit launch |
| U74: Exploration-funded random tower crafting | Verified locally | Collect planet resource, return to base, spend once for a random buildable tower; no paid currency |

Local verification: 297 unit/shell tests, 126 gallery cases, 31 theme/hydrology cases,
35 campaign fixtures, 35 sandbox fixtures, 20 input/traversal cases, 13 lobby cases,
all five camera suites, standalone bundle launch and native rendered weather pass.
A fresh legal ten-wave victory/extraction reaches planet two with three weapons.
[Durable evidence](EXPEDITION-LOBBY/). Publication and public checks are the remaining gate.

## Sequence and design decisions

1. Progression, commander selection/stats, death/respawn, ten waves and endless.
2. Theme-driven climate, fifteenth biome and combined Terrain exhibits.
3. Mounts, movement comfort, weather and exploration/crafting loop.
4. Walkable lobby and persistent preparation, connected to real game launch.
5. Adversarial browser and full-run checks, native render measurements, V2
   publication and public identity/behavior verification.

The supplied screenshots choose an open courtyard with preparation stations
on the perimeter and clearly marked launch pads. Follow that concrete
direction with Worldheart's own faceted models, materials and names. The
lobby is currently solo preparation; it must not pretend that networking or
public matchmaking exists. Random tower rolls use earned in-game resources.

The movement note ends mid-sentence. Proceed with the actionable part:
reduce aggressive bob and abrupt acceleration/view transitions. Full campaign,
wide device coverage and final owner feel approval remain distinct from the
bounded acceptance above. Do not mark any item done until its behavior is
observed. Record retained failures and deployment checkpoints here.

## Implementation checkpoint, September 12

- Pure and shell suite: 296 cases. Two final test-contract corrections now
  align old five-level/fifteen-wave expectations with ten levels and ten waves.
- Unforced instrumented defense on requested seed 12345 (accepted seed 36102):
  wave 10 victory, 20 lives, 347 kills, six legally bought/upgraded towers, no
  runtime faults. Normal extraction carried three weapons to planet two.
  Evidence: artifacts/expedition/full-run. This is one planet, not campaign completion.
- Debug runtime: 105 exhibits, eight lanes, 30 formations, four combined terrain
  samples, fifteen biomes, ten theme globes and three mount models.
- Initial instrumented feature pass: 31/35. Retained report at
  artifacts/expedition/runtime/report.json. It caught a missing free-placement
  price check and storm-warning time being counted again at activation. Both
  are corrected and rerunning. The camera fixture also needed to dismiss its
  victory overlay before sending camera input.
- Lobby screenshots caught signs behind pavilion roofs. Signs were raised.
  Commander and mount selection, storage, and shop affordability are observed.

### Lobby references

The supplied 99 Nights screenshots are the main visual reference: an open
courtyard, perimeter shops, readable physical signs, visible previews and a
separate mission gateway. The new scene uses Worldheart models and materials.
Research agent reviewed these primary sources alongside the screenshots:

- [99 Nights official experience](https://www.roblox.com/games/79546208627805/99-Nights-in-the-Forest).
- [Tower Defense Simulator creator lobby update, 2021](https://devforum.roblox.com/t/tower-defense-simulator-frost-invasion-update/1210291). Historical mall/lobby grouping.
- [TDS creator update log](https://devforum.roblox.com/t/tower-defense-simulator-update-log/320475). Historical environmental signs and launch elevators.
- [All Star Tower Defense X](https://www.roblox.com/games/17687504411/All-Star-Tower-Defense-X). Summon gate and unit collection, distinct from in-battle upgrades.

The lobby is solo preparation. Discovery uses 60 earned wave coins and rolls
unowned tower families with equal odds, displayed before the roll. No paid
currency, invented players, public matchmaking or networked lobby is present.

## Adversarial corrections

- Repeated safe deaths reserve the dead commander outside the reuse pool. Outside death is now also observed as actual defeat.
- Mount and mute shared M; mounting now uses M and sound uses N in 99 Planets.
- A free commander roster cannot charge old talent prices or bypass the paid bonus progression.
- The first ocean fixture accidentally chose a dry sub-sea canyon, then tested sea-surface elevation instead of depth. Corrected real water traversal passes. The melee fixture now checks radius, rather than a ranged-only field. Both fixture mistakes remain in local reports.
- Quake work initially blocked one frame for 951-1076ms. Navigation and terrain now yield in bounded batches during a brief seismic hold; final measured maximum work slice is 14.5ms in the fixture, with native rendered verification following. No node, adjacency or footprint identities change.
- Endless health no longer overflows exponentially and individual packs are bounded. Collected ore slots are reusable with new identities for later nest drops.
- Native 60-second orbit stress: 30 towers, roughly 100 enemies, 7.1ms median and 14.1ms p99 frame time at 1280x720 on RTX 4080 Laptop GPU. No runtime faults; pause/resume passes. This is injected stress, not a campaign result or broad device claim.

## Final local acceptance

The final unforced requested-seed-12345 defense accepted seed 36102, completed
wave ten with 20 lives, 331 kills and six legal towers, and extracted three
weapons to a ready planet-two checkpoint. This is one completed planet.
The separate 35-case fixtures inject setup gold/ore and wave-clear events;
20 input/traversal cases verify real melee damage, swimming, mounts, ore and
outside death. The 13 lobby checks use real input/reload/launch and injected
earned coins only for the shop transaction.

Native rendered quake: 7ms median, 14.2ms p99 and 27.7ms maximum frame, with
a maximum 7.3ms terrain work slice and responsive arrow navigation. The final
pass also moves an active build preview during the seismic hold.
Terrain edits preserve live graph identity and footprint bytes, then release
combat. Before/after and tornado captures were inspected.

The generator suite first kept its obsolete wave-derived route-count assertion.
The inspector intentionally displays seventeen example approaches independently
of the eleven scheduled nest slots. Its other 54 checks passed; the corrected
route assertion passes in atlas.json. Six explicit themes and legacy climate
URL handling pass 31 additional checks. No climate selector remains.

The shared navigation change also passes all five camera harnesses. A bundled
file URL launches 99 Planets with no runtime faults. Source syntax, house style
and generated mirrors pass. Full 99-planet play, broad device coverage and final
subjective tuning remain ongoing product acceptance, beyond this completed
feature batch. The lobby is solo; multiplayer remains future work.
