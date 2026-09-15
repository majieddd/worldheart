# DESIGN.md (WORLDHEART brand contract)

## North star
A hand-carved museum diorama of a living pocket planet, floating in deep indigo space under warm sunlight: faceted terrain like cut gemstone, water like poured glass, and a single luminous crystal heart worth defending. Player technology is machined gunmetal that runs on cyan light. The void enemy is wet obsidian lit from inside by magenta. Everything glows only where it means something.

## Dials
The owner selected **Hard Cel 1.0.0** with the detailed models as a candidate for
future Worldheart adoption. Preserve `art-candidates/hard-cel-v1/` and tag
`art/hard-cel-v1` exactly. `hard-cel-lab.html` compares it with three unreviewed
versions: Painted light 1.1, Etched color 1.2 and Atmospheric ink 1.3. Keep the
selected crisp contour and illustrative surface depth; vary only declared
rendering parameters against the same archived scene, camera and models.
This records candidate acceptance, not a production art migration.

Fourth study: `painted-lab.html` follows the owner's preference for anime + ink,
with softer painted light and richer environments. Dials 4/2/5. Retain fine
contours; use continuous paint ramps, blurred variance shadows, world-space
gouache pigment, curved grass, irregular stone and layered foliage. Preserve
the original three comparisons. Meshy models are reused from the owner's
reference collection, with textures and source provenance. Static art specimens
do not establish production animation or final aesthetic acceptance.

Illustration lab is an isolated three-direction experiment at `style-lab.html`.
Dials 4/2/4. It retains navy/cyan interface tokens and uses warm painted scene
palettes. Retro anime has fine contours and broad cel shadows; the ink study
has heavier seams, hatching and wear; the hybrid has peach light, violet shadows
and selective marks guided by the owner's three references. Synchronized
world/ground/material views and ink/texture switches expose each recipe.
None of these experiments selects or replaces the production art direction.

The opt-in sound comparison follows the existing Debug exhibition component
direction: navy surfaces, cyan links, system type, 48px buttons and paired
Previous/Draft rows. Dials 2/1/5. No repeated decorative motion. A single
column on phones preserves label space and separate tap targets. Its dedicated
stylesheet repeats these brand tokens so game HUD layout rules cannot leak in.

DESIGN_VARIANCE: 7/10 (memorable showcase, not a daily tool)
MOTION_INTENSITY: 5/10 (scene carries the motion; HUD stays at 3 and obeys the frequency gate)
VISUAL_DENSITY: 4/10 (rich scene, lean HUD)

Mobile retains this direction. The scene stays the main surface; a small
heart/wave strip and contextual controls replace the desktop HUD. Only direct
control shows the movement stick and combat buttons. Building, squad orders,
inventory, settings and checkpoint recovery live in scrollable drawers. Input
feedback is immediate; no repeated decorative control animation. Buttons use
48 CSS pixel targets for menus; combat uses 80px Attack, 84px Jump, 80x72px
named abilities, and 64px Aim/Swap. The 136px floating thumb pad anchors under
the landing finger and follows extended drags. Safe-area insets protect both
thumb zones. Cooldowns retain the ability name, role and remaining seconds.
Navy backplates keep labels readable; circular attack/jump surfaces are partly
transparent. The right corner anchors Jump, with fire and skills immediately
above/left. Mirroring moves the whole arrangement. On very short landscape
viewports, perspective switching remains in Menu > Squad to keep targets apart.
Both orientations and a mirrored thumb layout are supported. Native screen
zoom remains available outside the gesture-owned canvas. Touch UI does not
change camera tuning, combat, movement, placement or economy rules. A Power tap
during attack recovery queues one legal activation and temporarily yields held
basic attacks; opening a menu, losing control or changing family cancels it.

Debug World: owner-selected flat exhibition lanes, with dials 3/3/6. Unit
animation sequences loop by default, alongside slowly rotating miniature
planets. Still/manual controls and OS reduced motion pause the scene. Rig
clips use their authored game cadence; frame deltas clamp at 1/30 second,
and the clip readout swaps text instantly. Grab-style panning follows the
pointer on both axes. Retain cyan navigation and
opaque navy panels. Biome colors belong to the scene exhibits. Shared production
model builders, materials and terrain fields are the source of each sample.
Ten extreme themes intentionally extend scene palettes beyond the Garden world's
latitude bands; `js/biome-visuals.js` is their visual registry.

## Color tokens
HUD tokens are CSS custom properties in `css/style.css :root` (canonical for DOM). Scene palette is `PALETTE` in `js/config.js` (canonical for WebGL). Values listed here mirror those files.

| Token | Value | Role |
|---|---|---|
| --ground | #0a0e21 | Page and letterbox background |
| --surface | rgba(15, 20, 40, 0.84) | Panels over the 3D view (overlay translucency, no blur) |
| --surface-raised | rgba(23, 29, 56, 0.92) | Hover and selected panel step |
| --text | #e8ecf8 | Body copy |
| --text-muted | #9aa4c4 | Metadata, captions |
| --text-faint | #5a6284 | Disabled |
| --accent | #59f2ff | THE accent. Player energy cyan. Interactive states, selection, focus |
| --accent-hover | #8ff7ff | |
| --gold | #ffc857 | Semantic: economy only (costs, bounties, gold readout) |
| --danger | #ff5470 | Semantic: damage and loss only. Small text uses --danger-text |
| --danger-text | #ff8ba0 | AA-safe danger tint for small text |
| --hairline | rgba(148, 166, 224, 0.17) | Borders, dividers |

Scene palette (config.js `PALETTE`): space #0a0e21 to horizon #2a3670, sun #ffe9c4, meadow #4ec98a / #7fdd9e, forest #2e8f6a, cliff #6b7a8f to #93a3ba, snow #e9f1fb, sand #e8d29a, water shore #37c9c0 to deep #17578f, tech gunmetal #3d4757 + trim #cdd8e6, energy cyan #59f2ff, void body #241a38, void emissive #d84dff / #ff3fa6, gold #ffc857.

Campaign biomes blend this scene palette across continuous climate regions:
sand/soil for dry land, cliff/meadow for tundra, moss for forest and visible
strata for incised walls. Keep the faceted diorama geometry. Tall ranges, low
hills, flat benches and cuts must have distinct silhouettes within one planet.
Desert cacti and broad jungle canopies use the same faceted meshes and passable
scenery contract. Volcanic basalt uses muted charcoal; warm orange fissures mark
raised hot crust, keeping the Mortar restriction visible. Climate is independent
of geometry, including dry inland canyon floors below sea level.
The World generator's formation selector reuses its existing native select,
panel and camera focus behavior; it adds no decorative animation or UI accent.

Landforms v6 adds broad angular crust rafts, a narrow toothed ridge, long
continental incisions, crossed fault labyrinths and canopy shelves. Each must
read by silhouette and route, not just a palette swap. Lava uses the existing
warm fissure palette in an emissive crater and downhill channel; a slow
advecting crust pattern stops for reduced motion. Planet Mix's broad climate
belts should be readable from orbit. The inspector's labeled daylight toggle
is for judging terrain, separate from ordinary game lighting.

Rules: no pure #000 or #fff anywhere. One UI accent (cyan); gold and danger are semantic, never decorative. Magenta belongs to the enemy faction in the scene and never appears in HUD chrome. No purple gradients in UI.

## Type
| Role | Family | Size px | Weight | Tracking | Line height |
|---|---|---|---|---|---|
| Display | Chakra Petch | 48 / 64 | 700 | 0.02em | 1.05 |
| Headline | Chakra Petch | 26 | 700 | 0.02em | 1.15 |
| Title | Chakra Petch | 16 | 600 | 0.04em | 1.2 |
| Numerals | Chakra Petch | 14 to 20 | 600 | 0.02em | 1 |
| Body | Inter | 14 | 400 | 0 | 1.6 |
| Caption | Inter | 12.5 | 400 | 0 | 1.5 |
| Marker | Chakra Petch | 11 | 600 | 0.14em uppercase | 1 |

Scale steps (px): 11, 12.5, 14, 16, 20, 26, 34, 48, 64. Every font-size lands on a step.
Tracked uppercase only for short system markers (WAVE 12, PATH BLOCKED), never sentences.
Fonts load from Google Fonts with system fallbacks (`Chakra Petch, Segoe UI, sans-serif` / `Inter, Segoe UI, sans-serif`).

## Space and radius
Spacing steps (px): 4, 8, 12, 16, 24, 32, 48.
Radius steps (px): 4, 8, 10. Maximum radius 12 (build-card thumbs). No pill shapes except the wave pill and small tags (height under 28px, where a full round is the shape, not a wide radius).

## Motion
--ease-out: cubic-bezier(0.23, 1, 0.32, 1)
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)
Duration budget: HUD under 300ms (most at 140 to 220ms). Entrances and exits ease-out. Animate transform and opacity only. Never `transition: all`.
Frame loop (scene): dt-driven, dt clamped to 1/30 s, ease functions from canvas-motion.md, retarget-from-current, pooled objects, capped particle counts.
Frequency gate: per-shot, per-kill, per-coin HUD changes are instant text/state swaps with zero animation. Wave-level and rarer moments may animate.
Reduced motion: `prefers-reduced-motion` read in CSS and JS. Drops screen shake, camera kicks, grain flicker, and decorative particles; keeps informational color and opacity changes.

## Primitives
Home controls live inside Expedition kit / the mobile Base menu. The on-request
dialog uses existing surface, accent and text tokens, a 560px maximum width,
48px touch targets and internal viewport-bounded scrolling. Decoration placement
uses a compact contextual tray; there is no permanent extra HUD panel. A peaceful
home replaces the wave countdown with its peaceful status. The lobby's mission
gate lists saved homes with names and checkpoint numbers.

| Primitive | Variants |
|---|---|
| .btn | primary, ghost, icon, danger, disabled |
| .panel | default, raised |
| .build-card | default, selected, disabled |
| .pill | default, alert |
| .bar | integrity, boss, charge |
| .toast | info, warn, danger |
| .kbd | |

## Elevation
Hairline borders first. One shadow token only: `--shadow-overlay: 0 8px 32px rgba(4, 6, 16, 0.55)` for full modal overlays (intro, defeat, victory). Panels in the HUD get hairlines, never shadows.

## Iconography
System icons are vendored Lucide paths (ISC license) inlined as SVG: play, pause, fast-forward, volume, volume-x, settings, x, info, chevrons. No emoji as icons. No hand-drawn paths. Tower imagery on build cards comes from live 3D thumbnail renders at boot.

## Do not
- No em dash in any shipped text, code comment, or copy.
- No pure #000 or #fff surfaces or text.
- No second UI accent without a named semantic job (current jobs: gold = economy, danger = loss).
- No purple or violet gradients in HUD chrome.
- No backdrop-filter blur (perf over WebGL, and glass-as-decoration is banned).
- No emoji icons, no hand-rolled icon paths outside the vendored Lucide set.
- No animation on 100+ per match actions (shots, kills, gold ticks).
- No `transition: all`; no animating width/height/margin/padding/top/left.
- No content radius above 12px; no card-in-card nesting.
- No mood-first descriptions: mechanics first, flavor in italics below.
- No unpooled allocation inside the frame loop (vectors, arrays, geometries).
