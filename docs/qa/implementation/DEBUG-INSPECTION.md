# Debug World inspection fixes

September 12, 2026. Owner: Codex. Branch `fix/debug-world-inspection`, based on
V2 `bc814c8`, following PR #35. Tracker #1 and milestone #5: U56-U59.

## Changes and acceptance

| Request | Implemented behavior | Evidence |
|---|---|---|
| U56: unintuitive right-drag | Grab-style horizontal and vertical panning, scaled by camera pitch, distance and viewport size. Middle-drag and Shift-drag share the gesture. Wheel up zooms in; arrow keys move the viewpoint. | Real pointer drags at three headings and two pitches; keyboard and wheel checks |
| U57: incomplete weapon rendering | Center the whole assembly and lift its lowest point 0.65 display units above the floor, including native twin blades and beam staff. Focus the camera on the actual center. | All fourteen assemblies clear the plinth and fit the camera; fourteen screenshots visually inspected |
| U58: loop all unit animations | Default repeating production-rig sequences for all eleven units, including units far from the camera. Allies cycle idle, walk, sprint, strafe, jump/land, alternating strikes or fire/beam, and hurt. Enemies cycle idle, move, turn, wind-up/strike, hurt, stun, shield and collapse/recovery. | Native full-cycle observation plus five samples per authored clip; pause, manual modes and reduced motion checked |
| U59: miniature themed planets | Ten rotating geodesic spheres combine the production height field, coast mask, biome/climate palette, formation library, thermal fissures and scenery geometry. Each uses Mixed Landscapes and seed 4206018157. | Ten rendered comparisons; field restoration, radius, relief, biome/formation coverage, links and phone framing checked |

The miniature is an overview mesh at subdivision 6 and radius 10, with
instanced scenery. It samples the requested seed directly; the full playable
generator can choose a deterministic retry seed to satisfy battlefield route
acceptance. Water uses the production coast predicate, so inland negative
relief stays exposed. Sea and lava presentation are simplified, static colors
on the rotating model, rather than the full game's animated water/lava shaders.
It is a visual field preview, not a navigation or combat simulation.

The Debug-only sampling adapter restores CONFIG and reinitializes its original
field synchronously before yielding. The Debug route explicitly uses the
campaign radius and retains zero storage access. Normal game configuration is
unchanged. Shared face-color and thermal samplers are exported from world.js;
the gameplay thermal calculation is extracted without changing its formula.

## Reproduction and adversarial findings

The owner report is confirmed. The ancient sword's initial minimum Y was
-2.20, while the plinth top is -0.05: most of its blade was hidden below the
display. Spears reached -2.63. The previous finite-geometry checks did not
detect this visual occlusion. Those historical results remain intact; the new
tests explicitly check surface clearance and framing.

A downward right-drag previously moved a projected scene point upward. Both
axes now follow the pointer at multiple camera headings. Scroll-wheel zoom
retains the standard wheel-down/out convention.

Rendered review led to two refinements: increase miniatures from subdivision
5 to 6 so narrow features survive, and suppress unrelated/distant labels over
the selected planet. All ten themes and all fourteen weapon silhouettes were
opened and compared after these changes. A narrow-screen focus uses the
camera's limiting field of view so the sphere remains fully visible.

The first expanded animation test incorrectly assumed every idle animates.
The production Aegis deliberately holds an armored idle, confirmed in its
pose function. Its full sequence does animate. The retained failure is not
hidden; the corrected native observation uses the walking state for every
species, while the full-cycle test preserves the authored held idle.

## Verification

- 288 pure tests, 71 parsed modules, and house style pass.
- 118 full-gallery checks and 155 targeted inspection checks pass locally.
- Five normal maps boot; all five camera harnesses, begin controls, campaign
  defeat and fresh retry fixtures pass. The Debug camera remains separate.
- Two 15-second native desktop fixtures at 1280x720: all-lane overview with
  full animation cycles and the walking unit lane. Both measure 6.9ms median
  and 7.1ms p99. The first observes every authored clip across all eleven rigs.
  This is the reference i9-13900H / RTX 4080 Laptop, not a low-end device claim.
- A fresh legal instrumented run clears all 15 waves and extracts to planet 2
  with 22 lives, eight towers and thirteen weapons; 551 kills and twelve nests
  destroyed. Requested seed 28183, accepted seed 44021. No health, resources,
  enemies or waves are injected. This advances simulation at 60Hz with sparse
  rendering, rather than constituting a real-time manual run.
- All 78 generated mirror files match source. The single-file game bundles
  73 modules. Publication identity is recorded below once complete.

## Evidence

| Record | Scope |
|---|---|
| [Before](DEBUG-INSPECTION/sword-before.png), [after](DEBUG-INSPECTION/sword-after.png), [measurements](DEBUG-INSPECTION/before.json) | Reproduced occlusion and inverted vertical drag |
| [Weapons 1](DEBUG-INSPECTION/weapons-1.png), [2](DEBUG-INSPECTION/weapons-2.png) | All fourteen complete assemblies |
| [Ten miniature planets](DEBUG-INSPECTION/themes.png), [phone view](DEBUG-INSPECTION/mobile-theme.png), [overview](DEBUG-INSPECTION/overview.png) | Actual rendered comparison |
| [Targeted cases](DEBUG-INSPECTION/inspection.json), [gallery cases](DEBUG-INSPECTION/catalogue.json) | 155 and 118 local checks |
| [Native animation/performance](DEBUG-INSPECTION/performance.json) | Every clip observed in the native frame loop |
| [Maps](DEBUG-INSPECTION/maps.json), [legal run](DEBUG-INSPECTION/legal-run.json), [extraction](DEBUG-INSPECTION/legal-campaign.json) | Shared-game regression |
| [Held-idle control](DEBUG-INSPECTION/idle-oracle-control.json) | Retained and explained first-test failure |
| [Unit tests](DEBUG-INSPECTION/unit.txt), [syntax](DEBUG-INSPECTION/syntax.txt) | Source gates |

The `DEBUG-INSPECTION/` directory stores the reproduction, retained test
failure, final local/public JSON, visual comparisons, unit/syntax output,
map regression, native performance and deployment identity. The executable
checks are `tools/debug-inspection-check.mjs`, `tools/debug-world-check.mjs`
and `tools/debug-performance-check.mjs`; each accepts an output directory and
`WH_BASE_URL`. They require Playwright via `WH_NODE_MODULES`.

Scope remains the four Debug World requests. Full unforced 99-planet
completion, broad device coverage, balance and owner feel acceptance remain
on the existing campaign tracker.

## Publication

Implemented and locally verified; V2 publication and public verification pending.
