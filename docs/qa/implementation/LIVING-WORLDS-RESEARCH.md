# Living worlds: morphology audit and authored vocabulary

September 12, 2026. Source inspection and design decisions, before new geometry.
Rendered acceptance and any revisions belong in LIVING-WORLDS.md. A catalogue
entry alone is not evidence that a feature appears correctly in a real planet.

## Research translated into implementation

[Tectonic](https://modrinth.com/datapack/tectonic) separates large connected
mountain ranges, continents, valley floors and underground rivers. Its useful
lesson here is scale hierarchy: a terrain pack controls the broad land mass,
while local formations create recognizable routes. [Stardust Labs](https://www.stardustlabs.net/datapacks)
uses distinct biome and dimension vocabularies; [The Aether](https://modrinth.com/mod/aether)
shows how sky geography changes traversal rather than merely changing a palette.
[Minecraft's dripstone cave reference](https://www.minecraft.net/en-us/article/around-block--dripstone-caves)
distinguishes floor, ceiling and vertical clearance. A genuine cave or bridge
therefore needs an additional surface, not a dark patch on the height field.
[Regions Unexplored](https://modrinth.com/mod/regions-unexplored/version/hfTCN9un)
and [Biomes O' Plenty](https://modrinth.com/mod/biomes-o-plenty?version=1.21.10)
motivate vegetation structure and climate placement as separate biome traits.
These are design references; no third-party code, models or textures are copied.

## Existing catalogue audit

Thirty formations currently cover ridge chains, paired mountain valleys, open
basins, rolling foothills, single and terraced plateaus, branching ravines,
straight faults, pillar clusters, breached calderas, parallel hill fields,
subsurface winding canyons, escarpments, glacial U-valleys, continental rifts,
cross-fault labyrinths, tilted crust rafts, razorback ridges, active cones,
canopy shelves, impact rings, wind fins, streamlined drumlins, depositional fans,
joined sinkholes, spiral troughs, ice blades, radial channels, polygon cells and
parallel tiger fractures. The most obvious duplication risks are more radial
rings, more parallel cuts, and more isolated circular mounds.

The fifteen existing biomes use grass, broadleaf/pine/jungle forests, cactus
desert, savanna, reed wetland, stilt-root mangrove, tundra/alpine ice, volcanic
vents, ocean coral, crystal rods, mushrooms, iron fins and luminous branches.
The ten existing themes are garden, canopy, dune, cryosphere, molten, crystal,
spore, pelagic, iron desert and luminous twilight. New content must change its
structure as well as colour; another generic forest or purple rock is insufficient.

## Twenty new formation signatures

| Formation | Distinct geometry and traversal purpose |
|---|---|
| Vaulted grotto | Broad open cave with a separate arched roof and two floor entrances |
| Sky mesa | Elevated detached slab above a low basin; separate upper and lower traversal |
| Geyser staircase | Offset shallow sinter terraces with a timed erupting vent that launches units |
| Braided delta | Low converging distributaries around tapered sediment bars |
| Horseshoe amphitheatre | C-shaped high escarpment with an open mouth and curved inner terraces |
| Tilted cuesta comb | Wide asymmetric dip slopes ending in abrupt staggered scarps |
| Crescent dune caravan | Separate crescent horns and windward bowls, unlike parallel Hill Fields |
| Whaleback dome | One elongated rounded rock dome split by an off-centre saddle |
| Pedestal orchard | Broad rock caps carried by narrow stems with clear routes underneath |
| Honeycomb hoodoos | Raised hexagonal wall network around open cells with connecting gates |
| Folded wave rock | A sinuous concave rock wall with alternating broad shelves |
| Flood scablands | Interlaced scour channels around elongated teardrop rock islands |
| Box canyon | Three straight stepped walls around a flat deep floor and graded open mouth |
| Kame staircase | Staggered oval flat benches joined by a diagonal climbing route |
| Reef atoll | Low broken ring around a shallow lagoon; coastal scale, unlike a high caldera |
| Petrified trunk maze | Fallen fossil trunks cross above and beside a winding ground route |
| Oxbow terraces | A looping horseshoe incision separates an inner island from stepped banks |
| Pancake lava shields | Overlapping broad low circular shields, without an active summit cone |
| Kettle chain | Offset bowl depressions separated by narrow rolling divides |
| Fulgurite crown | Branching positive lightning-shaped ridges around an open central court |

Existing formations receive the owner's exact corrections: flat plateau siblings,
wide spaced buttes, larger hills, glacial bridge, deeper longer branched rift,
spaced rafts, broad active volcano, flat canopy shelves, a traversable meteor
crater, spaced wind fins/drumlins/blades, flat fan apex, deep karst, one continuous
spiral, and broader radial channels and polygon passages. Those are revisions,
not counted among the twenty additions.

## New biome and theme separation

Fifteen additions: towering redwood, bamboo thicket, cherry grove, autumn woods,
baobab scrub, cloud forest, salt flats, sulfur springs, obsidian wastes, coral
reef, kelp beds, lichen steppe, sponge heath, carnivorous marsh and aurora grove.
Each has a distinct vegetation/deposit silhouette, palette and habitat rule.

Ten additions: Titan Forest, Bloom Sanctuary, Sulfur Furnace, Salt Mirror,
Reef Ocean, Sky Archipelago, Fossil World, Copper Harvest, Carnivorous Fen and
Stormglass. Their terrain composition and water inventory differ as well as
their biome distribution. Regional/majority/global terrain coverage is explicit.

Ten terrain packs: Mixed Landscapes, Giant Peaks, Deep Canyons, Ocean World,
Badlands, Karst Labyrinth, Geothermal Fields, Glacial Frontiers, Windlands and
Sky Reaches. Explicit pack selection retains its identity; a theme must not
silently reintroduce unrelated formations into Giant Peaks or Deep Canyons.

## Bounded verification

Compare all fifty isolated formations, thirty dressed biome samples, ten broad
terrain samples and twenty production miniature globes. Inspect contact sheets
and enlarge ambiguous examples. Fix failed signatures or traversal gaps, then
recheck that subset. Test catalogue references, seeded determinism, spatial
shortlist equivalence, real spawn routes, deck/ground separation and vent timing.
Do not run an open-ended aesthetic loop or infer performance from geometry tests.
