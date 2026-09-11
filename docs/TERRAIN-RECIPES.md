# Terrain recipes and inland routes

U31, September 9, 2026. The owner wants reusable groups of landforms that can
appear in different biomes and at different sizes, with natural inland paths.
This replaces the campaign's combined mountain/canyon formula. Classic maps
keep their original terrain formula.

## Authoring boundaries

`js/terrain/recipes.js` holds version 5, fourteen group recipes and four relief
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
| Glacial trough | Broad U-shaped floor between unequal shoulders | A wide corridor distinct from narrow ravines |

Mixed landscapes, Giant peaks, Deep canyons and Ocean islands are **relief mixes**,
not exclusive biome assignments. Any group can have neutral, hot or cold
surfaces. All four mixes include hills, tall ranges and incised uplands, with
different proportions and scales. No individual battlefield guarantees all fourteen
families. Low-frequency geology biases neighbouring family choices and peak
amplitudes, rather than distributing every recipe with identical probability.
Temperature, altitude snow, water and foliage remain separate fields.
Mortar/Cryo placement restrictions and bonuses still use the actual footprint.

Mixed Landscapes is the default across all 99 campaign definitions. Other
relief mixes remain explicit sandbox/inspector options. Distinct per-planet seeds
and climate preserve variety, including distinct opening-planet seeds.

Each accepted planet seed selects a Temperate, Desert, Boreal, Jungle, Volcanic
or Wetlands climate bias. Continuous latitude, temperature and moisture fields produce meadow,
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
   Winding Valley/ravines cut between raised banks. Fault relief can descend
   below sea level by up to 25% of group height. Winding Canyon is a true
   negative incision, with depth limited to 24% of its available cell extent
   so the exit ramps remain traversable. Broad outer joins stay at zero relief.
   This height field does not represent caves or overhangs.
6. Continental blending creates coasts and islands. Negative incisions begin
   beyond the shoreline band; inland depressions stay dry even below sea level.
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
The v5 [owner refinement and adversarial ledger](qa/implementation/LANDFORM-BIOMES.md)
records the current batch. The v4 [research and adversarial ledger](qa/implementation/TERRAIN-ATLAS.md)
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
