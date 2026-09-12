# Environmental implementation and acceptance

Owner: Codex. U90-U105 on `feature/planet-ecology-and-active-worlds`.
Published and publicly verified as `5f6836d` through
[Pages run 34724405688](https://github.com/majieddd/worldheart/actions/runs/34724405688).
Stable main remains `1374122`. All latest request items are recorded in the
[completed ledger](../ACTIVE-WORLDS.md).

The shared production catalogue now contains 52 formations, 10 terrain packs,
44 biomes, 12 active land features, 12 disasters and 37 planet themes. Debug
World exposes each in a separate lane, using the production geometry and effects.
[Research and spatial distinctness decisions](../ACTIVE-WORLDS-RESEARCH.md)
map primary references to the implementation, including all 16 astronomical
analogues and the fictional walkable cloud decks used for the four giants.

## Implemented behavior

Active features are placed after terrain and ecology through explicit biome,
formation, slope and water fits, using a separate seeded stream. Placement
shuffles the complete globe before applying its bounded budget. Geysers are
flat pockets; fallen trees retain a solid walkable top. Ten additions apply
real damage, healing, slowing, lift or water pull to both teams.

Disaster compatibility comes from the planet. Environmental Hostility has its
own seeded value, with both limits increasing through the campaign; it scales
size and cadence. Ten new events accompany quake and tornado. Impact targets
and damage share their footprint definitions, coastal surges spare high ground,
cave roofs shelter bodies, and eruptions require an actual volcano. Debug's
tornado uses the in-game model, and its fault uses the same analytic profile.

Glacial and grotto roofs join sampled banks; cells are narrower and more
numerous, honeycomb access is wider and irregular, and pedestal stems flare
into their caps. Deep Canyons suppresses positive relief and increases incision.
The four replacement packs are Underworld Galleries, Meteor Marches, Spiral
Terrace Country and Aerial Kingdoms. Floating worlds have connected upper
navigation surfaces while preserving real air beneath the decks.

Volcanic ecology follows active geology. Tundra has block ice and frozen grass.
All Planet doubles the radius and reserves the full formation vocabulary across
ten geological provinces. Astronomical themes combine recognizable regional
geography with seeded local formations, correct atmospheric compatibility and
distinct surface materials. Miniatures use the same field at a lower mesh LOD.

## Combined verification

- [318 automated tests](environment/tests.txt): rules, seed determinism,
  compatibility, geometry/collision agreement, equipment and lifecycle. A
  dedicated regression checks that floating island features use their upper
  ecology after structural surfaces have been created.
- [264 Debug checks](environment/debug.json): all 243 exhibits in ten lanes,
  finite production models, animation, selection, core controls, keyboard/pointer
  camera input, responsive layouts, reduced motion and contrast. Startup was
  11.0 seconds. The route does not read or change browser saves.
- [108 route/composition checks](environment/worlds.json) across all ten packs
  and 37 themes. Each has a certified battlefield and eleven connected nest
  approaches. The independent whole-globe survey requires at least 95% of
  traversable dry depressed ground to reach the base, excluding authored
  trap sinkholes. All Planet contains all 52 formations, 44 biomes and twelve
  active feature kinds. Its radius is 480, versus 240 for ordinary planets.
- [25 environmental checks](environment/effects.json): all natural sites in
  the fixture satisfy their fit, both hemispheres receive features, garden
  volcanic biomes follow volcano geology, and all eleven timed local effects
  and ten new disasters affect actual commanders and enemies. Disaster types
  are deliberately forced in a compatible fixture; this is separate from
  natural event probabilities and the compatibility rules tested above.
- [Eight actual surface checks](environment/surfaces.json): commander spawn,
  enemy navigation and tower anchoring on upper islands, real landings and
  keyboard-driven falls off an exposed edge, plus geyser lift for both teams.
  Position and time are instrumented; this is not an unforced expedition.
- [50 combat checks](environment/combat.json) and [23 regressions](environment/regression.json)
  pass against the combined tree: all abilities, aim cancellation, scepter
  muzzle, salvage/forge rules, outward nest growth, cliff traversal, quake nest
  destruction and shared predicted/committed terrain.
- [Seven camera cases](environment/cameras.json): all five maps, oversized
  All Planet and Saturn. A global base frames the whole globe and its rings.
- [Legal defense and extraction](environment/defense.json): seed 12345,
  floating-island campaign opener, ten waves, 250 kills, six towers, 20 heart
  health and four inventory items carried into Planet 2. No resource, enemy
  or victory injection. This is an instrumented policy at 60Hz simulation,
  with sparse rendering; it does not establish gameplay FPS.

The route aggregate keeps the latest corrected record per case. Its source
reports and [earlier refinement run](environment/worlds-refinement.json)
preserve failed crater exits, the initial Mercury/terrain routing
failures and the subsequently corrected Sky Archipelago biome distribution.
Only one authored seed and its production deterministic fallback are covered
per world case; this is not exhaustive seed or 99-planet completion.

## Native performance

[The combined earthquake run](environment/quake.json) changed 24,688 existing
navigation nodes and 15,564 mesh vertices, preserved footprints and resumed
simulation while camera input stayed responsive. Chrome, this workstation,
1440x900: median 6.9ms, p99 7.2ms, worst frame 34.6ms, longest terrain-work slice
7.5ms. Triggered quake and fixture-funded base upgrades; no broad-device claim.
The identical-geometry before/after comparison remains in [the combat checkpoint](COMBAT.md#earthquake-timing).

The first full Debug overview exposed almost 7,000 draw calls and a 34.7ms
median. Static surface batching preserves the actual vertices and colors;
subpixel active props disappear only in distant catalogue views and return
when inspected. The first correction measured 13.7ms median and 14ms p99.
[Final native verification](environment/debug-performance.json) measured 7.1ms
median and 14ms p99 for the overview, and 6.9ms median / 7.1ms p99 for animated
units, at 1280x720 over two fifteen-second samples. All eleven unit rigs visited
all their clips. These are native measurements on this workstation only.

## Review and retained failures

The visual review covered every theme, formation, biome, active feature and
disaster. Corrections include low roofs joined to their actual banks, matching
pedestal rock, deeper canyon cuts, visible astronomical landmarks, proper
airless skies and the shared in-game tornado model in Debug. Full-resolution
captures and [compact contact sheets](environment/VISUALS.md) accompany the
final catalogue report.

Runtime review caught and fixed an incorrect enemy slow method, warped-log
geometry disagreeing with collision, crater exit ramps facing away from their
rim openings, and cavern roofs trapping ordinary passage floors. Sky worlds
also needed upper-surface spawning, a compatible base-height/flight envelope,
and their own upper ecology for biome and feature placement. The first fall
fixture walked along a causeway; the corrected input fixture starts at a real
exposed edge. The 30-second browser navigation timeout was insufficient for
the larger world and is recorded separately from gameplay failures.

Cached geography remains query-order independent. Reusing warped coordinates
and avoiding lower-floor queries reduced the same explicit floating terrain
case from about 91 to 20 seconds, and Earth from 75 to 25 seconds. The final
Sky Archipelago theme boots in about 41 seconds; large world generation still
has a visible loading interval. Owner art/feel review, broad hardware coverage,
all 99 planets and multiplayer remain separate longer-term acceptance work.

## Public V2 verification

[272 identity comparisons](environment/public-identity.json) verified the live
preview and stable root against their actual source commits. The deployed game
passed [50 combat checks](environment/public-combat.json), [25 environmental
checks](environment/public-effects.json) and [264 Debug checks](environment/public-debug.json).
There were no runtime faults. These are public source-informed fixtures, not
a second blind playthrough or full-campaign acceptance.

[Play V2](https://majieddd.github.io/worldheart/v2/) or inspect the
[active-feature lane](https://majieddd.github.io/worldheart/v2/debug.html#features/geyser).
An already-open session needs a refresh to load the deployed build.
