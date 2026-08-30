# DESIGN.md (WORLDHEART brand contract)

## North star
A hand-carved museum diorama of a living pocket planet, floating in deep indigo space under warm sunlight: faceted terrain like cut gemstone, water like poured glass, and a single luminous crystal heart worth defending. Player technology is machined gunmetal that runs on cyan light. The void enemy is wet obsidian lit from inside by magenta. Everything glows only where it means something.

## Dials
DESIGN_VARIANCE: 7/10 (memorable showcase, not a daily tool)
MOTION_INTENSITY: 5/10 (scene carries the motion; HUD stays at 3 and obeys the frequency gate)
VISUAL_DENSITY: 4/10 (rich scene, lean HUD)

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
