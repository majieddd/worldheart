# Active worlds, astronomy and combat: request ledger

Owner: Codex. Branch `feature/planet-ecology-and-active-worlds`, based on V2
`8f94dc6`, retaining the previous public QA handoff. September 12, 2026.
This ledger captures the latest complete owner request. Publish verified
checkpoints to V2 only; preserve main and prior evidence.

| Item | State | Acceptance |
|---|---|---|
| U89 Wood and gold identity | Published + verified | Worn dark wood with visible wear; polished reflective gold across all families and views |
| U90 Natural glacial underpass | Published + verified | A coherent low hill bridge with usable top and open trough beneath |
| U91 Cell mosaic | Published + verified | More numerous, narrower cells with usable passages |
| U92 Integrated grotto | Published + verified | Continuous matching rock roof and banks, natural entries and upper surface |
| U93 Active land features | Published + verified | Separate recipe-fit placement after formation/biome layout; flat geyser pockets plus ten researched additions; dedicated Debug lane |
| U94 Disasters and hostility | Published + verified | Theme compatibility, independently seeded hostility increasing its range with campaign progress, ten new working disasters and dedicated Debug lane |
| U95 Fallen trunks | Published + verified | Move from formation catalogue into recipe-fit active features, retaining real traversal |
| U96 Amphitheatre replacement | Published + verified | A completely different formation, not another crater |
| U97 Pedestal integration | Published + verified | Rock mass, stems and caps use a coherent natural shape/material |
| U98 Honeycomb variation | Published + verified | Open central access and seeded variation in spine widths and spacing |
| U99 Deep Canyon profile | Published + verified | Lower positive relief, stronger inward depth, connected dry routes |
| U100 Four distinctive terrain replacements | Published + verified | Replace Karst, Geothermal, Glacial and Sky presets with recognizable terrain recipes and necessary new formations |
| U101 Tundra distinction | Published + verified | Block ice and frozen grasses distinguish it from alpine spires |
| U102 Coherent biome geography | Published + verified | Volcano-adjacent volcanic ecology; theme, geology and coast constrain placement |
| U103 Sky Archipelago | Published + verified | Dominant detached floating land, natural bridges and useful traversal, not ordinary hills |
| U104 All Planet | Published + verified | Oversized showcase world with the full compatible biome/terrain/feature vocabulary |
| U105 Solar system worlds | Published + verified | Earth, Moon, Mars, Venus, Mercury, Jupiter, Saturn, Neptune, Uranus, Titan, Europa, Ganymede, Triton, Io, Callisto and Pluto, researched and visually checked |
| U106 Commander frame | Published + verified | Clickable health/identity frame focuses the commander anywhere, including recovery state |
| U107 Ember scepter | Published + verified | Reproduce attack and fire rendering; fix real damage/beam/animation consumers |
| U108 Growing overview zoom | Published + verified | Early view remains useful; full-planet base permits full-planet framing |
| U109 Faster, expanding nest waves | Published + verified | Half inter-wave delay; later nests progressively farther from the base regardless of base size |
| U110 Scrap forging | Published + verified | Remove amber pickups; weapon salvage supplies the existing scrap balance used to forge towers; crystals preserved |
| U111 First-person aiming | Published + verified | Smooth held aim input, coherent weapon alignment/FOV and predictable release/pause/UI behavior |
| U112 Earthquake performance | Published + verified | Reproduce native hitch, bound preparation and terrain refresh work, preserve forecasts and routes |
| U113 Commander abilities | Published + verified | Five distinct activated abilities with readable cooldowns, real effects and clean lifecycle |
| U114 Weapon abilities | Published + verified | Six family-specific activated abilities with readable cooldowns, real effects and equipment lifecycle |

First checkpoint published as `574d6f4`: [Pages run](https://github.com/majieddd/worldheart/actions/runs/34718977246). `262` public identity checks and `50` public combat checks passed. [Evidence](ACTIVE-WORLDS/COMBAT.md). U90-U105 are published and publicly verified as `5f6836d`: [Pages run](https://github.com/majieddd/worldheart/actions/runs/34724405688). [Environmental checkpoint](ACTIVE-WORLDS/ENVIRONMENT.md).

Current combined QA: 318 automated tests; 108 route/composition checks across
all 47 pack/theme worlds; 25 actual environmental effect checks; eight real
floating-surface/geyser checks; 50 combat and 23 regression checks pass. The
Debug overview performance correction reduced native median frame time from
34.7ms to 13.7ms. The refreshed catalogue passed 264 checks and all seven camera cases pass.
A legal ten-wave defense extracted four items to Planet 2. Public V2 passed 272 identity comparisons and 339 functional checks. All Planet's survey contains all 52 formations,
44 biomes and 12 active feature types. Failed attempts and corrections are retained.

## Sequence and boundaries

First verify combat/economy/camera and earthquake performance. Then author the
environment layers and shape refinements; finally integrate astronomical worlds
and complete combined route, runtime, visual and full-defense acceptance.
Each checkpoint updates this ledger, docs/PROGRESS.md, the blueprint and GitHub
trackers #1/#5. Code, fixture setup, native performance and natural play are
different evidence categories. Retain failed attempts and their corrections.

Solar-system worlds are stylized playable analogues. Gas and ice giants use
cloud decks rather than falsely claiming solid terrain. All Planet is a large
showcase composition, not a requirement to put every incompatible hazard on
every ordinary planet. Compatibility remains authoritative for disasters.

Acceptance: pure rules and lifecycle tests, all five camera maps, actual input
and combat checks, visual comparison of each new catalogue item, whole-world
route/placement checks, native earthquake profiling, a completed legal defense,
V2 deployment identity and public interaction checks. No full-campaign or
broad-hardware claim follows from one successful fixture.
