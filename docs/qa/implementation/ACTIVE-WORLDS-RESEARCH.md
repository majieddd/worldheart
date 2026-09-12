# Active worlds: reference and distinctness decisions

September 12, 2026. Owner: Codex. Implementation and acceptance are tracked in
[the request ledger](ACTIVE-WORLDS.md). Research informs authored geometry and
rules; it does not certify the resulting game. Runtime evidence is separate.

## Land and local features

The first audit found that the existing fifty formations already included
craters, buttes, domes, spirals, branching channels, ice blades, mushroom rocks,
and floating slabs. More round bowls would duplicate that vocabulary. The
replacement arcade uses repeated open arches; cavern networks expose crossing
subsurface corridors through skylights; impact chains progress in size along a
line; helical terraces provide an ascending coil; floating ribbons join wide
islands. These are new spatial arrangements with shared collision surfaces.

[Mojang's generation notes](https://www.minecraft.net/en-us/article/new-world-generation-java-available-testing)
support separating terrain variation from biomes, fitting mountain biomes to
elevation, suppressing isolated climate patches, and integrating entrances.
[Mojang's dripstone cave reference](https://www.minecraft.net/en-us/article/around-block--dripstone-caves)
inspired visible cave openings and ceilings with room beneath them, rather than
decorative dark patches on a heightfield.

[Yellowstone's hydrothermal taxonomy](https://www.nps.gov/yell/learn/nature/hydrothermal-features.htm)
distinguishes geysers, hot springs, mud pots and fumaroles by water supply and
plumbing. The game accordingly uses flat vent pockets, circulating spring
basins, low bubbling clay pools and steaming mineral cracks. Each has a
different silhouette and timing/effect. The spring's healing is explicitly
fantasy, not a claim about real hydrothermal water.

[USGS's volcanic-gas explanation](https://www.usgs.gov/volcanoes/yellowstone/science/monitoring-volcanic-gas-tells-story-magma-and-groundwater-movement)
informs steam and gas vents. Additional fantasy systems are resonant crystals,
spore sacs and restorative springs. Rockfall, thermal updraft, tidal whirlpool,
lava seep and cryovolcanic jet complete ten additions beside the migrated
geyser and fallen trunk. Fits require biome, formation, water state and measured
slope. They are placed after the geography has been generated.

## Disasters

[NWS's storm reference](https://www.weather.gov/safety/thunderstorm) distinguishes
lightning, hail and strong winds. [NOAA's tsunami explanation](https://oceanservice.noaa.gov/facts/tsunami.html)
informs a moving coastal inundation footprint with refuge on high ground. It
is rendered as a stylized surge, not a surf breaker. Molten and airless worlds
cannot select an ocean tsunami. Atmosphere-dependent storms cannot select
airless worlds. Volcanic eruptions require actual volcanic geology.

Ten additions beside earthquake and tornado are meteor shower, lightning,
hail, whiteout, sand wall, ashfall, tsunami surge, radiation storm, cryovolcanic
outburst and volcanic bomb eruption. These differ in impact pattern, movement,
damage timing, slowing, lift, shelter or elevation constraints. The independent
hostility stream increases both its minimum and maximum with campaign progress;
it changes event size and frequency, without changing compatibility.

## Astronomical analogues

These use recognizable authored geography with seeded local variation. They
are compact, exaggerated game worlds. No gas giant is represented as having a
real solid surface: Jupiter, Saturn, Uranus and Neptune use fictional cloud
decks. [NASA's planet overview](https://science.nasa.gov/solar-system/planets/)
and [temperature reference](https://science.nasa.gov/resource/solar-system-temperatures/)
inform the separation of surface, cloud and atmospheric conditions.

| Body | Recognizable signature and primary reference |
|---|---|
| Earth | Simplified continent outlines, polar caps, tropical forest and dry subtropics. [NASA](https://science.nasa.gov/earth/facts/) |
| Moon | Grey cratered highlands and smoother dark maria on the near side. [NASA](https://science.nasa.gov/moon/facts/) |
| Mercury | Grey-brown crust, Caloris basin and contraction scarps. [NASA](https://science.nasa.gov/mercury/facts/) |
| Venus | Volcanic plains, ochre tessera uplands and shield volcanoes. [NASA](https://science.nasa.gov/venus/venus-facts/) |
| Mars | Rust plains, polar caps, Olympus shield and Valles Marineris. [NASA](https://science.nasa.gov/mars/facts/) |
| Jupiter | Cream and ochre cloud belts and a prominent red storm oval. [NASA](https://science.nasa.gov/jupiter/jupiter-facts/) |
| Saturn | Broad divided rings, pale cloud belts and northern hexagon. [NASA](https://science.nasa.gov/saturn/facts/) |
| Uranus | Pale cyan clouds, polar hood and sideways narrow rings. [NASA](https://science.nasa.gov/uranus/facts/) |
| Neptune | Blue-green clouds, bright streaks and dark storm ovals. [NASA](https://science.nasa.gov/neptune/neptune-facts/) |
| Titan | Organic dunes and dark hydrocarbon lakes concentrated near the poles. [NASA](https://science.nasa.gov/saturn/moons/titan/facts/) |
| Europa | Bright ice crossed by long stained fractures. [NASA comparison](https://science.nasa.gov/science-research/europa-ganymede-and-callisto-surface-comparison-at-high-spatial-resolution/) |
| Ganymede | Old dark regions juxtaposed with bright grooved ice provinces. [NASA comparison](https://science.nasa.gov/science-research/europa-ganymede-and-callisto-surface-comparison-at-high-spatial-resolution/) |
| Callisto | Dark, densely cratered crust with bright ejecta and a ringed impact basin. [NASA](https://science.nasa.gov/jupiter/jupiter-moons/callisto/facts/) |
| Io | Sulfur-rich yellow plains and dark volcanic centres, with no ordinary impact-crater pack. [NASA](https://science.nasa.gov/jupiter/jupiter-moons/io/facts/) |
| Triton | Southern nitrogen cap and cantaloupe-textured terrain. [NASA mosaic](https://science.nasa.gov/resource/global-color-mosaic-of-triton/) |
| Pluto | Heart-shaped nitrogen plain, convection cells and water-ice blocks. [NASA](https://science.nasa.gov/dwarf-planets/pluto/facts/) |

All Planet is a deliberately fictional atlas: twice the ordinary campaign
radius, with all formation families reserved and ten terrain provinces. Its
ecology is a broad regional mosaic; ordinary themed planets retain tighter
geology and climate constraints. Debug miniatures sample the production field
at lower mesh detail and preserve actual overhangs and rings.
