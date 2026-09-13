# Natural terrain and storm references

September 12, 2026. U115-U125 refine the previous release. These references
inform geometry and geographic rules; they are not copied game assets.

| Reference | Implementation decision |
|---|---|
| [USGS Sipapu Bridge](https://www.usgs.gov/media/images/natural-bridges-sipapu-bridge-1) | A bridge is an opening through a continuous sedimentary rock mass. Give roofs thickness, eroded outlines, faceted shading and the same strata palette as the adjacent banks. Bank samples, physical surfaces and both route layers must agree. |
| [NWS stepped leaders](https://www.weather.gov/safety/lightning-science-initiation-stepped-leader) | Use connected irregular segments with smaller forks, bright cores and halos. Every channel terminates at the actual marked strike position. Clouds persist between strokes. |
| [NOAA tsunami description](https://oceanservice.noaa.gov/facts/tsunami.html) | Depict an advancing continuous water front with a foamy crest. The curling bore is exaggerated for readability; the simulation remains a coastal surge with high-ground refuge. |
| [Natural Earth land polygons](https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/) | Replace eight hand-drawn continent outlines with the public-domain global land dataset. Include major islands, Antarctica and the antimeridian. |
| [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/) | Public-domain data may be redistributed and adapted. Retain provenance and a reproducible importer with the game. |
| [NASA Blue Marble](https://visibleearth.nasa.gov/images/57723/the-blue-marble) | Review the familiar arrangement of continents, oceans, polar ice, deserts and forest regions from multiple hemispheres. Mountain belts follow geographic locations rather than random peak placement. |

Earth source: the official Natural Earth repository's
[ne_110m_land.geojson](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson),
127 features. SHA-256:
`9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9`.
`node tools/build-earth-coast.mjs` scan-converts the polygons into a 720 by 360
signed coastline field. The bundled pure module performs a constant-time
bilinear lookup and requires no runtime network request. Grid sampling is half
a degree; coast detail remains bounded by the rendered mesh. Relief is authored
along major mountain belts, with deliberately exaggerated heights. It is not a
surveyed elevation model or an exact climate simulation. Earth's Debug globe
uses one additional mesh subdivision to show smaller coast features.

The spatial ecology field uses separate seeded random candidates and correlated
density noise. This produces clusters, clearings and varied orientation instead
of visible Fibonacci spirals. Active features still require a compatible biome,
formation, water state, slope and physical surface. This variation must never
consume combat or loot randomness.

Radiation EMP is a fantasy gameplay rule: purple cloud-to-ground strikes
disable struck towers for eight simulation seconds. It is not a claim about
the real appearance or local behavior of space radiation. Damage, warnings,
disable duration and recovery are tested separately from visual inspection.
