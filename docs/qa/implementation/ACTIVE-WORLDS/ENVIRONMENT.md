# Environmental implementation and acceptance

Owner: Codex. U90-U105 on `feature/planet-ecology-and-active-worlds`.
Implementation checkpoint; final combined and public verification is underway.

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

## Verification in progress

Initial implementation checks: 315 automated tests; 23 actual feature/disaster
checks; 14 world-route checks across six representative worlds; 84 finite-render
and selection checks. These precede the final review refinements and therefore
are checkpoint evidence rather than final acceptance of the current tree.

The initial visual review caught slab-like bridge roofs, excessive positive
canyon relief, hidden astronomical landmarks and weak Debug tornado rendering.
The first runtime effect pass caught an incorrect enemy slow-method name.
Those were corrected. Sky generation initially took 91 seconds; caching shared
warped coordinates and avoiding irrelevant lower-ground sampling are being
measured in the full route sweep. All initial artifacts and failures remain in
`artifacts/active-worlds/` until durable final evidence is recorded here.

Required remaining acceptance: all pack/theme worlds, actual upper-deck
movement and enemy routes, native render/quake timing, combined gameplay,
five camera maps, a legal ten-wave defense and public V2 identity/interaction.
