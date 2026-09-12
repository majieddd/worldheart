# Terrain recipes and inland routes

U31, September 9, 2026. The owner wants reusable groups of landforms that can
appear in different biomes and at different sizes, with natural inland paths.
This replaces the campaign's combined mountain/canyon formula. Classic maps
keep their original terrain formula.

## Authoring boundaries

`js/terrain/recipes.js` holds version 7, thirty group recipes and four relief
mixes. `js/terrain/formations.js` lays out and samples those groups. `world.js`
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
| Glacial trough | Sunken U-shaped bed, unequal walls and hanging side valleys | Broad below-floor route with graded ends, distinct from the raised Winding Valley |
| Great continental rift | Long negative trunk with a side branch and extended end ramps | A deep route crosses several ordinary formation regions |
| Noctis labyrinth | Offset crossing faults and surviving upland islands | Multiple intersecting channels, inspired by Mars |
| Rafted crust blocks | Broad tilted angular slabs | Gaps through broken crust, inspired by Europa |
| Razorback ridge | Narrow toothed wall with a pass | A strong linear barrier, inspired by Iapetus |
| Lava spill volcano | Crater lake, breached rim and downhill lava channel | Hot elevated positions around an active flow |
| Canopy highlands | Broad lobed shelves and bounded forest clusters | Wooded highlands with stepped flanks |
| Concentric impact rings | Two gated rims and a central rebound | Linked concentric shelves and radial approaches |
| Wind-carved yardangs | Tall parallel fins with staggered ends and a crosswind gap | Several long corridors connected laterally |
| Drumlin shoal | Rounded asymmetric teardrops with long tails | Gaps between staggered low remnants |
| Alluvial fan | One apex spreading into a scalloped apron | Diverging radial approaches across an open flank |
| Joined karst sinkholes | Rounded depressions connected by surface throats | Linked dry doline floors; no simulated caves |
| Spiral polar troughs | Two winding negative cuts | Curving inward routes with graded exits |
| Penitente blade field | Dense pointed narrow blades | Many small paths between elevated obstructions |
| Araneiform star channels | Radial channels converging on a low center | Several inward routes rather than a single ravine trunk |
| Convection cell mosaic | Polygonal plates and a depressed connected network | Branch choices around multiple adjacent cells |
| Tiger-stripe fractures | Four long parallel negative grooves | Separate narrow tracks with open ends |

Mixed landscapes, Giant peaks, Deep canyons and Ocean islands are **relief mixes**,
not exclusive biome assignments. Any group can have neutral, hot or cold
surfaces. All four mixes include hills, tall ranges and incised uplands, with
different proportions and scales. No individual battlefield guarantees all thirty
families. Low-frequency geology biases neighbouring family choices and peak
amplitudes, rather than distributing every recipe with identical probability.
Temperature, altitude snow, water and foliage remain separate fields.
Mortar/Cryo placement restrictions and bonuses still use the actual footprint.

Mixed Landscapes is the default across all 99 campaign definitions. Other
relief mixes remain explicit sandbox/inspector options. Distinct per-planet seeds
and climate preserve variety, including distinct opening-planet seeds.

Each requested planet seed selects an M/K/G/F star and an orbital distance.
Flux L/a^2 shifts temperature; water inventory and tectonic activity separately
produce ten extreme themes, described below. Planet Mix has
wet equatorial, dry subtropical, wetter temperate and cold polar belts, with
smaller longitude noise and an altitude cooling term. Explicit Temperate,
Desert, Boreal, Jungle, Volcanic and Wetlands overrides remain available.
The climate fields produce meadow,
woodland, jungle, wetland, savanna, desert and tundra regions across multiple formation
families. Tectonic activity independently creates volcanic regions. Hot stone and
altitude/cold rules take precedence as volcanic/alpine surface biomes. Biome dressing blends the existing palette and
vegetation; it does not add a new tower restriction or movement penalty. Deserts have sparse cacti; jungles have larger broadleaf canopies. Volcanic
regions show basalt and warm fissures on raised hot crust. This is solid rock,
not a liquid lava simulation or added damage hazard. Hot volcanic highlands use
the existing Mortar-only restriction/bonus; snowy ground retains Cryo rules.
Trees and cacti remain passable scenery. Mild benches can support vegetation.
The inspector Climate selector independently dresses the same layout and is
preserved by Load seed, recent history, share links and Play this seed. Campaign
climates remain seeded; inspector choices do not overwrite campaign saves.

## Extreme worlds and exhibition

The environment catalogue is independent of the thirty formation recipes.
Each theme biases suitable shapes and changes land, water and dressing through
the shared `js/biome-visuals.js` registry. Garden retains varied latitude belts.
Canopy favors dense jungle; Dune favors dry sandstone and cacti; Cryosphere
favors ice and cold placement; Molten uses glowing fissures, red seas and hot
raised ground. Crystal uses violet crust and prisms; Spore uses plum soil and
mushroom groves; Pelagic emphasizes turquoise water, coral and wetlands; Iron
desert uses rust-red crust and dark blades; Luminous twilight uses cobalt and
branching luminous flora. Their major visual identity dominates ordinary land.
Explicit hot formations and altitude ice can remain as minority contrasts.

Gameplay variety follows real water coverage, terrain biases and the existing
hot/cold tower affinities. Molten seas currently use swimming slowdown; they do
not add an unannounced damage rule. Scenery remains passable. Neither a theme
nor a color change grants a hidden movement or tower modifier.

`debug.html` provides six flat lanes: 11 unit rigs, 18 authored tower marks,
14 weapon family/era or native silhouettes, 30 isolated formations, 14 biomes
and 10 theme plots. Formation tiles use the real production field at a common
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
   This height field does not represent caves or overhangs.
6. Continental blending creates coasts and islands. Negative incisions begin
   beyond the shoreline band; inland depressions stay dry even below sea level.
   A spherical coast-distance field limits negative depth to 0.4 times safe
   distance from shore, avoiding steep dams from noisy coastal blending.
   A shared continental water mask controls the water shader, unit/weapon
   grounding, swimming, placement, ray picking, camera and navigation costs.
   Dry cliff faces never inherit the water shortcut. Climate/decor dress the
   result; fine facet noise is cosmetic and cannot close a route.
7. The cap scout prefers dry inland floor, not water counted as traversable
   ground. The full graph still certifies the base, flight lanes and all 17
   separated nest clearings. Ground enemies use the existing floor-first field
   and slow emergency crossings only when their floor component has no route.
   Giant-peaks fronts must also contain a surveyed peak at least 65% of the
   profile's 96m range scale; a tall peak elsewhere on the globe is insufficient.
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
   This acceptance is not relaxed during the bounded 32-seed search. The higher
   Giant-peaks requirement remains. The geometry itself supplies the passages;
   navigation does not carve invisible shortcuts.

This is a gameplay-oriented geometric generator, not a geological erosion
simulation or a claim that every seed has been proven. Site boundaries form a
connected global network; playable-cap clipping, coasts, towers and movement
still require real graph validation. Construction never rebuilds that graph.

## Change a mix or pin a group

The four default mixes live in `LANDFORM_MIXES`. A terrain profile in
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
The in-game World generator selects published mixes, climates and seeds. Its formation
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
grant spawn legality outside the fine combat graph or its 160m route budget.
The survey yields between chunks, is built once on demand, and never rebuilds
combat navigation. Animation changes a GPU uniform; reduced motion holds it
still. Outlines replace the first pass's dense point carpet after visual review.

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
The v6 [cosmic landforms ledger](qa/implementation/COSMIC-LANDFORMS.md)
records the current batch. The v5 [owner refinement ledger](qa/implementation/LANDFORM-BIOMES.md)
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
