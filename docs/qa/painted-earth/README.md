# Painted Earth review evidence

September 19, 2026. Scope: [U256-U261](../implementation/PAINTED-EARTH.md).

These images are real rendered captures. They are review evidence, not concept
paintings substituted for game output. Four generated story paintings are
separately documented in `lib/first-expedition/panels-v3.json`.

| Capture | View |
| --- | --- |
| [Approved meadow](approved-arena.webp) | Actual atmospheric-arena reference |
| [Production ground](game-fps.webp) | New production terrain, foliage and held weapon |
| [Production strategy](game-strategy.webp) | Same Earth, bird's-eye view |
| [Story](story-desktop.webp) | Centered four-panel presentation |
| [Phone story](story-phone.webp) | Responsive 390x844 layout |
| [Phone guide](guide-phone.webp) | Build spotlight with movement controls clear |
| [Landscape guide](guide-landscape.webp) | Compact card below the reticle |
| [Survey outpost](structure-outpost.webp) | Shared runtime/debug building |
| [Observatory](structure-observatory.webp) | Shared runtime/debug building |
| [Bolt tower](painted-bolt.webp) | Upgraded existing tower with new surface treatment |
| [Commander](painted-commander.webp) | Existing rig with production material treatment |

`local-opening.json` records browser actions plus labeled setup fixtures.
`cross-map-and-waves.json` records five camera checks and an accelerated wave
lifecycle; its earlier manually-triggered save check is superseded by
`home-autosave.json`. `touch-layout.json` records the accepted layout.
`visual-and-timing.json` includes boot, frame and camera measurements.
The `superseded-*` reports intentionally retain disproven checks.
Full uncompressed captures and other exploratory failures remain locally under
`artifacts/painted-earth/`. See the implementation ledger for limitations.

Public acceptance at runtime `c015fd2` is captured by `public-opening.json`,
`public-debug.json` and `public-identity.json`: 32 gameplay/UI checks, six
debug-lane checks and 863 actual deployed-file/source SHA-256 comparisons.
