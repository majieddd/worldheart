# Terrain recipes and inland routes

U31, September 9, 2026. The owner wants reusable groups of landforms that can
appear in different biomes and at different sizes, with natural inland paths.
This replaces the campaign's combined mountain/canyon formula. Classic maps
keep their original terrain formula.

## Authoring boundaries

`js/terrain/recipes.js` holds version 8 and fifty group recipes. The ten terrain
packs in `js/run/world-catalogue.js` set family weights, amplitudes, spacing and
detail noise. `js/terrain/formations.js` lays out and samples those groups. `world.js`
composes their relief with continents and small surface detail, then applies
elemental stone rules and the independent `terrain/ecology.js` climate fields.
`nav.js` validates the
resulting surface, rather than drawing hidden routes through blocked mountains.

| Group | Internal shapes | Route opportunities |
|---|---|---|
| Ridge chain | Shared spine, several folded crests, rounded feet | Valleys around the chain; ground creatures cannot shortcut over its crests |
| Winding Valley | Paired banks around a meandering dry floor | A continuous cut connects to the surrounding valley network |
| Open basin | Bowl, surrounding shoulders, two outlets | A clearing with multiple entrances |
| Rolling foothills | Broader, exaggerated irregular ridges and saddles | Traversable approaches and mid-height positions |
| Plateau | Flat bench, softened perimeter, side pass | Stable tower locations above a lower approach |
| Terraced plateau | Asymmetric tiers, scalloped flanks, a ramp and side outlet | Wide tower shelves above an open lower approach |
| Branching ravine | Variable width, unequal banks and three to five tributaries | Intersecting lower routes between enclosing banks |
| Fault crevices | Longer bending fractures with broader dry bottoms | Walkable inland passages below their enclosing rock |
| Eroded butte cluster | Seven to twelve separate flat-topped remnants with at least 5.5m between their analytic feet | Irregular gaps through a cluster of elevated positions |
| Breached caldera | Undulating ring around a low interior, with an open breach | A sheltered floor that connects to exterior valleys |
| Hill Fields | More widely spaced parallel low crests with a long windward side and shorter slip face | Low rolling obstacles beside larger formations |
| Winding Canyon | Negative incision with winding stepped walls and long end ramps | Dry sub-sea passage, with depth bounded by available exit length |
| Staircase escarpment | Three lateral benches crossed by a diagonal ramp | Multiple connected positions beside a steep flank |
| Glacial trough | Sunken U-shaped bed, unequal walls and an actual overhead land bridge | Walk below the bridge or land on its upper surface |
| Great continental rift | Long deep trunk with ten striating tributaries and extended end ramps | A deep route crosses several ordinary formation regions |
| Noctis labyrinth | Offset crossing faults and surviving upland islands | Multiple intersecting channels, inspired by Mars |
| Rafted crust blocks | Broad tilted angular slabs | Gaps through broken crust, inspired by Europa |
| Razorback ridge | Narrow toothed wall with a pass | A strong linear barrier, inspired by Iapetus |
| Lava spill volcano | Crater lake, breached rim and downhill lava channel | Hot elevated positions around an active flow |
| Canopy highlands | Broad lobed shelves and bounded forest clusters | Wooded highlands with stepped flanks |
| Meteor impact zone | One breached crater, displaced rim and scattered ejecta | A traversable impact floor with a clear exit |
| Wind-carved yardangs | Tall parallel fins with staggered ends and a crosswind gap | Several long corridors connected laterally |
| Drumlin shoal | Rounded asymmetric teardrops with long tails | Gaps between staggered low remnants |
| Alluvial fan | One apex spreading into a scalloped apron | Diverging radial approaches across an open flank |
| Joined karst sinkholes | Very deep rounded depressions connected by surface throats | Deliberate trapping pits, excluded from nest clearings |
| Spiral polar troughs | One continuous two-turn negative spiral | A connected floor and upper route around the spiral |
| Penitente blade field | Spaced pointed narrow blades | Open paths between elevated obstructions |
| Araneiform star channels | Radial channels converging on a low center | Several inward routes rather than a single ravine trunk |
| Convection cell mosaic | Polygonal plates and a depressed connected network | Branch choices around multiple adjacent cells |
| Tiger-stripe fractures | Four long parallel negative grooves | Separate narrow tracks with open ends |
| Vaulted grotto | Raised banks and a separate rough stone roof | A medium-sized open passage below a usable upper surface |
| Sky mesa | Three irregular floating slabs above a low basin | Flying commanders can land, walk and jump off the decks |
| Geyser staircase | Four ascending mineral terraces and a vent | Timed steam eruptions launch nearby units on both teams |
| Braided delta | Five diverging sinuous channels | Parallel low routes spread from a common upstream approach |
| Horseshoe amphitheatre | Open curved wall enclosing an inner court | Sheltered open floor with a wide mouth |
| Tilted cuesta comb | Three asymmetric tilted benches | Broad dip slopes beside steep faces |
| Crescent dune caravan | Three unequal crescent dunes | Curved horns enclose pockets, with gaps between dunes |
| Whaleback dome | One elongated smooth dome split by a cleft | Rounded high ground with a distinct transverse cut |
| Pedestal orchard | Separate mushroom rock caps on narrow stems | Pass under caps or land on their upper surfaces |
| Honeycomb hoodoos | Broad hexagonal walls interrupted by gates | Linked polygon rooms and flat wall tops |
| Folded wave rock | One sinuous asymmetric folded wall | A long corridor along its steep face |
| Flood scablands | Scoured lowland around streamlined remnants | Branch around elongated elevated islands |
| Box canyon | Rectangular inward cut with one open end | Deep enclosed court entered through a broad mouth |
| Kame staircase | Five staggered ascending mounds | Stepping positions and gaps beside the sequence |
| Reef atoll | Broken annular reef and shallow wet lagoon | Swim through its breaches or follow the island rim |
| Petrified trunk maze | Three large grained fallen trunks at different angles | Pass under or traverse the physical logs |
| Oxbow terraces | Meandering incision and paired offset benches | Connected curved lower route and upper shelves |
| Pancake lava shields | Broad low circular lava domes | Overlapping gentle volcanic rises |
| Kettle chain | Unequal linked deep round pits | Deliberate depressions with separate safe perimeter routes |
| Fulgurite crown | Angular forked lightning-like ridges | Wide interlocking spaces between branches |

Terrain packs are geological recipes, separate from biome assignments. Mixed
Landscapes uses the full vocabulary. Giant Peaks uses only extreme ridge chains
and razorbacks; Deep Canyons emphasizes negative incisions; Ocean World builds
formation-bearing islands, connected archipelagos and peninsulas. Badlands,
Karst Labyrinth, Geothermal Fields, Glacial Frontiers, Windlands and Sky Reaches
complete the ten packs. No individual battlefield guarantees all fifty families.
Themes can apply a pack regionally, across most provinces, or globally. They
control the pack's weight, amplitude and detail-noise biases in those provinces.
Temperature, altitude snow, water and foliage remain separate fields.
Mortar/Cryo placement restrictions and bonuses still use the actual footprint.

Mixed Landscapes is the default across all 99 campaign definitions. Other
relief mixes remain explicit sandbox/inspector options. Distinct per-planet seeds
and climate preserve variety, including distinct opening-planet seeds.

Each requested planet seed selects an M/K/G/F star and an orbital distance.
Flux L/a^2 shifts temperature; water inventory and tectonic activity separately
produce twenty themes, described below. Planet Mix has
wet equatorial, dry subtropical, wetter temperate and cold polar belts, with
smaller longitude noise and an altitude cooling term. The Planet theme owns
this climate; there is no second climate dropdown to contradict the theme.
The climate fields produce meadow,
woodland, jungle, wetland, savanna, desert and tundra regions across multiple formation
families. Tectonic activity creates volcanic regions where the theme allows them.
Hot/cold tinting preserves the new biomes' authored identity while retaining
the same tower restrictions. Biome dressing blends the existing palette and
vegetation; it does not add a new tower restriction or movement penalty. Deserts have sparse cacti; jungles have larger broadleaf canopies. Volcanic
regions show basalt and warm fissures on raised hot crust. This is solid rock,
not a liquid lava simulation or added damage hazard. Hot volcanic highlands use
the existing Mortar-only restriction/bonus; snowy ground retains Cryo rules.
Trees and cacti remain passable scenery. Mild benches can support vegetation.
The theme choice is preserved by Load seed, recent history, share links and
Play this seed. Legacy biome URL arguments are ignored by the shell. Campaign
climates remain seeded; inspector choices do not overwrite campaign saves.

## Extreme worlds and exhibition

The environment catalogue composes fifty formation recipes into twenty themes.
Each theme biases suitable shapes and changes land, water and dressing through
the shared `js/biome-visuals.js` registry. Garden retains varied latitude belts.
Canopy favors dense jungle; Dune favors dry sandstone and cacti; Cryosphere
favors ice and cold placement; Molten uses glowing fissures, red seas and hot
raised ground. Crystal uses violet crust and prisms; Spore uses plum soil and
mushroom groves; Pelagic emphasizes turquoise water, coral and wetlands; Iron
desert uses rust-red crust and dark blades; Luminous twilight uses cobalt and
branching luminous flora. Their major visual identity dominates ordinary land.
Explicit hot formations and altitude ice can remain as minority contrasts.

The ten additional themes are Titan Forest, Bloom Sanctuary, Sulfur Furnace,
Salt Mirror, Reef Ocean, Sky Archipelago, Fossil World, Copper Harvest,
Carnivorous Fen and Stormglass. Each has its own pack coverage, formation
weights, biome palette and climate distribution. Thirty biomes include distinct
redwood, bamboo, blossom, baobab, cloud forest, mineral, reef, kelp, lichen,
sponge, pitcher and luminous-frond dressing. See the
[catalogue audit and research](qa/implementation/LIVING-WORLDS-RESEARCH.md).

Gameplay variety follows real water coverage, terrain biases and the existing
hot/cold tower affinities. Molten seas currently use swimming slowdown; they do
not add an unannounced damage rule. Scenery remains passable. Neither a theme
nor a color change grants a hidden movement or tower modifier.

`debug.html` provides eight flat lanes and 186 exhibits: 11 unit rigs, 3 mounts,
30 tower marks, 32 weapon appearances, 50 isolated formations,
10 combined Terrain collections, 30 biomes and 20 theme globes. The Terrain lane
is between formations and biomes. Each approximately 300m production patch
shows the multiple formation groups selected by that relief mix. Mangrove
adds stilt-rooted trees to wet lowland Canopy and Pelagic planets.
Formation tiles use the real production field at a common
1:5 scale. Model poses and materials come from the same production builders.
Each theme links to a full generated planet. Debug reads/writes no campaign or
preference storage. [Research, visual comparisons and checks](qa/implementation/EXTREME-WORLDS.md).

## Generation order

1. The effective seed rotates and jitters an evenly distributed set of sites
   over the sphere. The configured spacing controls group footprint size.
2. Each site receives a weighted recipe, orientation, scale, height and fold
   phase. Explicit group anchors and exclusions override that seeded choice
   without advancing other groups' random streams.
3. In version 2, adjacent automatic range cells can join into short open chains
   of two or three members. A shared spine crosses the internal borders without
   dropping to the floor. Isolated ranges and explicit authored groups retain
   their own footprints. Chains cannot form closed rings.
4. A shared low-frequency bend makes the boundaries meander. The continuous
   distance difference between the nearest two DIFFERENT territories defines
   broad outer valleys. Recipes reach zero relief at these outer borders.
   Junctions widen naturally. Canyon and basin outlets join that same network.
5. Measured neighbour spacing sets the shoulders. Feet ease into the floor;
   high crests retain a pointed profile. Mesa tops deliberately stay flat.
   Winding Valley cuts between raised banks. Ravines and faults also descend
   below sea level; depth is limited by footprint and available exit length.
   Winding Canyon is a negative incision capped at 32% of its cell extent.
   The longer continental rift and labyrinth overlays cross cell joins;
   other outer joins stay at zero relief.
   The height field represents the lower floor. `terrain/features.js` adds
   shared rendered and physical upper surfaces for caves, bridges, floating
   islands, rock caps and fallen logs. AI routes follow the lower height field;
   commander support, falling, head clearance and flight use those extra surfaces.
6. Continental blending creates coasts and islands. Negative incisions begin
   beyond the shoreline band; inland depressions stay dry even below sea level.
   A spherical coast-distance field limits negative depth to 0.45 times safe
   distance from shore, avoiding steep dams from coastal blending.
   A shared continental water mask controls the water shader, unit/weapon
   grounding, swimming, placement, ray picking, camera and navigation costs.
   Dry cliff faces never inherit the water shortcut. Climate/decor dress the
   result; fine facet noise is cosmetic and cannot close a route.
7. The cap scout prefers dry inland floor, not water counted as traversable
   ground. The full graph still certifies the base, flight lanes and all eleven
   separated nest clearings. Ground enemies use the existing floor-first field
   and slow emergency crossings only when their floor component has no route.
   Giant-peaks fronts must also contain a surveyed peak at least 65% of the
   profile's 150m range scale; a tall peak elsewhere on the globe is insufficient.
   Nest placement also penalizes wet distance along the complete existing route.
   A dry clearing across a long swim no longer beats a nearby dry approach just
   because its compass bearing is closer. Water remains an allowed fallback.
8. Version 4 additionally certifies the actual battlefield, excluding the graph's
   outer margin: at least three exposed families (four sampled points each,
   height above 2m and recipe relief above 1m), 95% connected dry floor, and at
   least eight sampled reachable floor positions with raised terrain on opposite
   sides. A minimum 16m peak prevents the mixed front becoming a flat plain.
   Version 6 separately requires 95% of dry walkable floor below -1m to connect,
   so a large connected surface cannot conceal isolated deep canyon floors.
   V8 counts absolute negative relief too, accepts two families for the two-family
   Giant Peaks pack, and uses two families with 8m relief for island worlds.
   Ocean fronts may contain less land but still require the same dry base and
   eleven separated nest sites. Intentional karst/kettle traps are reported
   separately, never counted as connected passages or nest clearings.
   This acceptance is not relaxed during the bounded 32-seed search. The higher
   Giant-peaks requirement remains. The geometry itself supplies the passages;
   navigation does not carve invisible shortcuts.

This is a gameplay-oriented geometric generator, not a geological erosion
simulation or a claim that every seed has been proven. Site boundaries form a
connected global network; playable-cap clipping, coasts, towers and movement
still require real graph validation. Construction never rebuilds that graph.

## Change a mix or pin a group

The ten packs in `js/run/world-catalogue.js` supply `LANDFORM_MIXES`. A terrain profile in
`TERRAIN_PROFILES` can supply a `formations` override:

```js
formations: {
  spacing: 120, // Typical group spacing in metres, supported range 64..200.
  valley: 7, // Shared valley half-width. Keep enough room for nests and traffic.
  weights: { range: 3, canyon: 5, basin: 2, hills: 1, mesa: 1, plateau: 2, ravine: 2, crevice: 1 },
  groups: [
    { id: 4, type: 'canyon', height: 50, size: 1.2 },
    { id: 7, disabled: true }, // Reserve a low clearing; retain its valley joins.
  ],
}
```

Weights of zero disable a recipe. `spacing` changes region footprint sizes;
`size` changes a group's internal spine/bank scale within its shared boundaries.
`height` sets a group's maximum relief before continental blending. An optional
`dir: [x,y,z]` pins a site on the sphere. Invalid, overlapping or duplicate
anchors fail explicitly. An override can still fail gameplay site acceptance;
run the graph checks before publishing it. These are collaborator controls.
The in-game World generator selects terrain packs, planet themes and seeds. Its formation
selector surveys exposed representatives, preferring the active battlefield and
labelling examples elsewhere on the globe. Incisions need visible banks on both
sides; an isolated sea cliff cannot qualify. It does not edit individual group
parameters. `ECOLOGY.manifest()` exposes the accepted seed's climate regime.

The nest overlay outlines all individually valid battlefield clearings in cyan,
using the same clearance and route predicates as physical spawning. It also
surveys the entire globe on an independent 40,962-node inspection graph. Pale
outlines show potential habitat, including disconnected regions; dotted shared
routes flow toward the base. Every coarse edge is sampled at 1.2m or less to
avoid bridging mountain barriers. Global habitat is approximate and does not
grant spawn legality. Physical nests use the actual combat graph and footprint
checks; 160m is now a route-scoring preference rather than a hard cutoff.
The survey yields between chunks, is built once on demand, and never rebuilds
combat navigation. Animation changes a GPU uniform; reduced motion holds it
still. Outlines replace the first pass's dense point carpet after visual review.

Geysers share the displayed vent and a twelve-second cycle with 2.8 seconds of
eruption. Nearby ground units on either team receive one upward impulse per
cycle. Flying units high above the vent are excluded. Geysers pause with the
simulation and earthquake preparation; vents follow altered terrain heights.
Existing upper decks remain stable during faults. Towers and AI still use the
ordinary terrain floor; upper-deck tower placement and layered AI routes are
not part of this surface implementation.

Inspect `FORMATIONS.manifest()` from `js/world.js` for the version, effective
seed, settings and actual groups. `FORMATIONS.inspect(x,y,z)` identifies the
group, neighbour, valley distance and relief at a unit direction. The manifest
is an inspection object; treat it as read-only. Increment `LANDFORM_VERSION`
when changing seeded layout semantics and record the source commit with it.

Saved inventory/account/expedition schemas are unchanged. Reloaded planets use
the new terrain generator, including an existing assault's stored seed. Old
terrain layouts are not embedded in those saves. Preserve historical QA by
source commit and version; do not compare seed numbers without the generator.

## Cost and acceptance

A conservative spatial shortlist gives the same nearest sites as an exhaustive
scan. Buckets cache candidate lists, not rounded heights: picking, grounding,
movement, climate and rendering all evaluate the same continuous surface.
No terrain object or mesh is allocated per height query. The recipe height
bound also controls the picking shell and camera clearance fallback.

- `node --test tests/shell/formations.test.mjs`: repeatability, independent
  biome/scale controls, exhaustive spatial oracle, joins, height bounds and
  invalid authoring/exclusion controls.
- `node tools/formation-check.mjs artifacts/formations`: actual graph, dry-floor
  connectivity, 17 remote approaches, inland fraction and complete manifests.
  Inland means all eight probes 12 metres away are dry, not merely that the
  route node itself is above water. It is a sampled spatial measure.
- Existing shape, terrain, placement, all-99 physical-source, legal-run,
  camera and performance tools remain required integration evidence.
- `node tools/terrain-atlas-check.mjs artifacts/terrain-atlas`: whole-globe
  coverage, exact battlefield eligibility, animation/reduced motion, buffer
  reuse, graph immutability, hidden-during-build lifecycle and rendered views.

The [implementation ledger](qa/implementation/MODULAR-LANDFORMS.md) records
results and retained failures. Whole-campaign, broader seed/device and owner
visual/balance acceptance remain separate from these fixtures.
The v8 [living worlds ledger](qa/implementation/LIVING-WORLDS.md) records the
current batch. The v6 [cosmic landforms ledger](qa/implementation/COSMIC-LANDFORMS.md)
and v5 [owner refinement ledger](qa/implementation/LANDFORM-BIOMES.md)
and v4 [research and adversarial ledger](qa/implementation/TERRAIN-ATLAS.md)
records the bounded second pass and its integration evidence.

## Research translated into this implementation

Minecraft's [official terrain update explanation](https://www.minecraft.net/en-us/article/caves---cliffs-part-ii-the-features)
describes separating biome assignment from terrain shape. Here that becomes
independent formation and climate layers, without copying Minecraft internals.
[Red Blob's mapgen4](https://www.redblobgames.com/maps/mapgen4/) supports authored
mountain/valley intent before secondary generation, while its
[sphere experiment](https://www.redblobgames.com/x/1843-planet-generation/)
illustrates graph-based terrain on a globe. This implementation uses spherical
regions and shared valley constraints suited to Worldheart's existing field.
