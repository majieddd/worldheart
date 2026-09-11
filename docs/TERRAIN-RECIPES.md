# Terrain recipes and inland routes

U31, September 9, 2026. The owner wants reusable groups of landforms that can
appear in different biomes and at different sizes, with natural inland paths.
This replaces the campaign's combined mountain/canyon formula. Classic maps
keep their original terrain formula.

## Authoring boundaries

`js/terrain/recipes.js` holds the version, five group recipes and four relief
mixes. `js/terrain/formations.js` lays out and samples those groups. `world.js`
composes their relief with continents and small surface detail, then applies
the existing climate, stone, snow and foliage rules. `nav.js` validates the
resulting surface, rather than drawing hidden routes through blocked mountains.

| Group | Internal shapes | Route opportunities |
|---|---|---|
| Ridge chain | Shared spine, several folded crests, rounded feet | Valleys around the chain; ground creatures cannot shortcut over its crests |
| Winding canyon | Paired banks around a meandering dry floor | A continuous cut connects to the surrounding valley network |
| Open basin | Bowl, surrounding shoulders, two outlets | A clearing with multiple entrances |
| Rolling foothills | Several low overlapping rises | Broad traversable approaches and modest high ground |
| Eroded tableland | Flat bench, softened perimeter, side pass | Stable tower locations above a lower approach |

Highlands, Giant peaks, Deep canyons and Ocean islands are **relief mixes**,
not exclusive biome assignments. Any group can have neutral, hot or cold
surfaces. Temperature, altitude snow, water and foliage remain separate fields.
Mortar/Cryo placement restrictions and bonuses still use the actual footprint.

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
   Canyon depth is measured relative to its raised banks, with a dry floor
   above sea level. This height field does not represent caves or overhangs.
6. Continental blending creates coasts and islands. Climate and decor dress
   the result. Fine facet noise is cosmetic and cannot close a route.
7. The cap scout prefers dry inland floor, not water counted as traversable
   ground. The full graph still certifies the base, flight lanes and all 17
   separated nest clearings. Ground enemies use the existing floor-first field
   and slow emergency crossings only when their floor component has no route.
   Giant-peaks fronts must also contain a surveyed peak at least 65% of the
   profile's 96m range scale; a tall peak elsewhere on the globe is insufficient.
   Nest placement also penalizes wet distance along the complete existing route.
   A dry clearing across a long swim no longer beats a nearby dry approach just
   because its compass bearing is closer. Water remains an allowed fallback.

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
  weights: { range: 3, canyon: 5, basin: 2, hills: 1, mesa: 1 },
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
The in-game World generator selects published mixes and seeds; it does not edit
individual group parameters.

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

The [implementation ledger](qa/implementation/MODULAR-LANDFORMS.md) records
results and retained failures. Whole-campaign, broader seed/device and owner
visual/balance acceptance remain separate from these fixtures.

## Research translated into this implementation

Minecraft's [official terrain update explanation](https://www.minecraft.net/en-us/article/caves---cliffs-part-ii-the-features)
describes separating biome assignment from terrain shape. Here that becomes
independent formation and climate layers, without copying Minecraft internals.
[Red Blob's mapgen4](https://www.redblobgames.com/maps/mapgen4/) supports authored
mountain/valley intent before secondary generation, while its
[sphere experiment](https://www.redblobgames.com/x/1843-planet-generation/)
illustrates graph-based terrain on a globe. This implementation uses spherical
regions and shared valley constraints suited to Worldheart's existing field.
