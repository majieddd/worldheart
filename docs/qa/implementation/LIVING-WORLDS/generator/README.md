# Generator v8 acceptance

This batch adds twenty formations, fifteen biomes and ten themes, bringing the
catalogues to 50 / 30 / 20. Ten terrain packs compose the formations. The
[request ledger](../../LIVING-WORLDS.md) records publication status; the
[morphology audit](../../LIVING-WORLDS-RESEARCH.md) records references and the
distinctions chosen before implementation.

## Rendered review

Every isolated formation, dressed biome, terrain collection and miniature planet
was captured from the production Debug World and inspected in these sheets:

- Formations: [1](sheet-formations-1.png), [2](sheet-formations-2.png),
  [3](sheet-formations-3.png), [4](sheet-formations-4.png), [5](sheet-formations-5.png).
- Biomes: [1](sheet-biomes-1.png), [2](sheet-biomes-2.png), [3](sheet-biomes-3.png).
- [Terrain packs](sheet-terrain-1.png).
- Themes: [1](sheet-themes-1.png), [2](sheet-themes-2.png).

This was a bounded visual review, with a correction pass for merged rift
tributaries, narrow honeycomb walls, feature material/readability and route
widths. The final sheets show different structural silhouettes, including open
roofs, detached decks, linked pits, branched cuts, asymmetric dip slopes,
crescent horns, broad caps and folded walls. Closely related geological shapes
still share the game's material language. Personal aesthetic acceptance remains
with the owner, and no claim of exhaustive procedural-seed coverage is made.

## Runtime checks

- [74 assertions across 30 worlds](worlds.json): all ten explicit packs and all
  twenty themes, actual navigation certification and eleven separated physical
  nest approaches per world. At least 99.8% of sampled non-trap deep floor was
  connected across these worlds. Intentional karst and kettle traps are recorded
  separately and never qualify as nest clearings.
- [207 Debug checks](gallery.json): 186 exhibits, all animation lanes, input,
  complete catalogue coverage, finite geometry, miniature composition and framing.
- [Five camera maps](cameras.json), [23 critical gameplay fixtures](critical.json)
  and [four physical tower-gap cases](tower-gaps.json).
- [Five surface fixtures](surfaces.json): physical deck landing, real keyboard
  movement off a floating edge into a fall, and rendered commander/enemy geyser
  launches. These use explicit setup; they are not blind play.
- [Native Debug performance](debug-performance.json): two fifteen-second
  fixtures on the recorded workstation, without concurrent browser suites.
- [Native game performance](game-performance.json): sixty seconds of continuous
  camera orbit with thirty towers and about one hundred enemies at 1280x720,
  median 72.5 fps and inverse p99 36.2 fps. Setup injects only a repeatable load;
  this is not a natural playthrough.
- [Legal ten-wave victory](ten-wave-victory.json) and
  [extraction to Planet 2](campaign-extraction.json): 22 heart health, 262 kills,
  six towers and five inventory items, including earned scepter and twinblade
  drops. Sparse rendering is separate from the native frame measurements. No
  dropped weapon was equipped in this run; equipment has separate fixtures.

Additional decks are real physical surfaces for the commander. Ground AI uses
the lower terrain floor, including the passage beneath a grotto or bridge.
Layered AI navigation and placing towers on a floating deck are outside this
implementation; ordinary raised-terrain placement remains available.

[Retained failures](retained-failures.json) include the initial ocean boot and
delta-floor failures, Debug framing/startup, camera grounding, and a legal
wave-ten loss. The loss exposed a test-player mistake: remote upgrades were
attempted through a contextual commander panel. The policy now leaves possession
for construction and resumes the same body before the next input step. No game
resources, enemy stats, placements or wave results were changed to obtain a win.

Reproduction uses the tools committed with this branch. Browser tools require
`WH_NODE_MODULES` pointing at a Node dependency directory with Playwright, a
Chrome installation, and a static server specified by `WH_BASE_URL`. Raw local
captures remain under `artifacts/living-worlds`; these selected reports are the
durable collaborator handoff.
