> **HISTORICAL RECORD.** This file records what was intended when it was
> written. It was not maintained afterwards and several details have since
> changed in the code. Treat it as background on the reasoning, not as a
> description of the current game. For that see [README](../../../README.md),
> [CLAUDE.md](../../../CLAUDE.md) and
> [docs/ARCHITECTURE.md](../../ARCHITECTURE.md).

# WORLDHEART: design spec
2026-08-30. Autonomous session: the brief explicitly delegated style and design decisions to Claude ("assess your capability to know what style will work best for you"), so the brainstorming gates were executed in self-approval mode and the reasoning is recorded here.

## Brief
A 3D tower defense fought on a globe. Freeform tower placement, with one restriction: a placement may never fully block enemy pathing. Units and towers need proper animation. The whole game must feel cohesive, smooth, fluid, performant, and polished to a AAA standard. This is a capability showcase.

## Direction gate (three directions, one pick)
Per design-forge direction-first, generated from three logic systems:

- **A (entropy): Memphis toybox.** Bright primaries, plastic toy planet, confetti particles. Bet: charm through play. Wrong for this brief: reads as a toy, not as AAA craft.
- **B (reference): dioramic stylized low-poly.** Reference artifacts: Bad North, Monument Valley, Grow Home. Flat-shaded faceted geometry, restrained saturated palette, strong silhouettes, soft HDR bloom on emissives, painterly post grade. Bet: cohesion and polish through art direction instead of asset fidelity.
- **C (philosophy): terminal vector hologram.** Tron-like wireframe globe, everything emissive. Bet: pure tech aesthetic. Wrong: cold, empty at scale, and drifts into the neon-glow slop pattern.

**Pick: B.** It plays directly to procedural strengths (parametric geometry, GLSL, code-driven animation), it has shipped-game precedent at exactly this scale, and it cannot fall into the uncanny valley that a photoreal attempt from procedural textures would. Photorealism without a texture artist is how a project looks cheap; committed stylization is how it looks intentional.

## Fantasy and framing
A pocket planet carries a luminous crystal, the **Worldheart**. Void swarms breach through dormant fissures on the surface and march for it. You raise defenses anywhere on the globe. The planet is small enough that curvature is always visible: enemy silhouettes crest the horizon against the atmosphere glow. That shot is the signature of the game.

Faction color logic (owned, stated): the living world is teal and green with warm sun; player technology is gunmetal with **cyan** energy (the single UI accent); the void faction is obsidian with **magenta** emissive (threat semantic, scene only, never a UI accent); **gold** appears only as the economy semantic; **red** only as the danger semantic.

## Core mechanics
- **Globe navigation graph.** An icosphere subdivision (detail 5, 10,242 vertices) forms the walkable graph. Node blocked if underwater, too steep, or inside a tower footprint. All heights come from one analytic noise function shared by visual mesh, nav graph, and unit grounding, so the three can never disagree.
- **Flow field pathing.** Single-source Dijkstra from the Worldheart across walkable nodes, recomputed on any build or sell (about 2 ms). Ground enemies steer along the interpolated flow direction with turn-rate limits, separation, and surface reprojection. Building mid-wave live-reroutes every walker, which makes the placement rule legible.
- **Freeform placement with the block rule.** Towers sit anywhere on walkable ground (no grid shown to the player). A candidate placement temporarily blocks its footprint nodes; if any active or dormant portal loses all paths to the Worldheart, the ghost turns red with a "path blocked" reason and cannot be confirmed. Mazing is allowed and encouraged; sealing is impossible.
- **Path preview.** While a ghost is held, animated flow lines from every portal to the Worldheart update live (throttled recompute), so players see exactly how their maze bends the assault before committing.
- **Air lane.** Flyers ignore the graph and fly great circles at altitude; only towers flagged anti-air can hit them. This is the strategic answer to heavy mazing.
- Placement is also refused within a small radius of a living ground enemy. A stranded walker (edge case) falls back to great-circle steering toward the Worldheart.

## Content
Towers (5, each with 3 tiers; tiers change geometry, not just numbers):
| Tower | Cost | Role | Fire behavior | Air | Signature animation |
|---|---|---|---|---|---|
| Bolt Sentinel | 150 | Single-target DPS | 5 shots/s tracers | yes | Head slerp-tracking, alternating rail recoil |
| Mortar Bastion | 250 | Ground AoE | Lobbed shell on a gravity arc | no | Barrel elevate + kick, dust ring on impact |
| Arc Spire | 300 | Chain + stun | 1.4 s charge, chains to 4 | yes | Floating coil rings rise while charging, snap on discharge |
| Cryo Bloom | 200 | Slow aura | Constant 40% slow dome | both | Crystal petals breathe; frost motes on victims |
| Helios Lance | 500 | Ramping beam | Continuous beam, 1x to 3x over 2 s | yes | Lens rings align on lock, beam heat glow |

Enemies (void faction, shared obsidian + magenta identity):
| Enemy | Role | Locomotion animation |
|---|---|---|
| Mite | fast swarm | leg-flicker skitter, body bob, yaw wiggle |
| Husk | standard, segmented worm | segments trail the head with lag, lateral undulation |
| Aegis | armored heavy | squash-charge hop, landing thump and dust |
| Wisp | flyer | membrane wing flap, ribbon trail |
| Colossus | boss (waves 10/20/30) | orbiting armor plates shed at HP thresholds |

All enemies: white hit-flash, cyan slow tint, shard-burst death, scale-pop spawn from the portal.

Waves: 30 scripted waves to victory, then endless scaling. Portals activate at waves 1/4/9/14, each announced with a brief camera glance. Dormant portal sites are visible from the start so the block rule never leaks hidden information. Economy: 400 start gold, kill bounties, wave-clear bonus, early-call bonus; 20 lives; sell at 70%.

## Presentation systems
- **Rendering:** Three.js (pinned, vendored locally), WebGL2, MSAA render target, custom post pipeline: soft-knee bright pass, 4-level Kawase blur pyramid, additive composite with ACES tone map, subtle vignette, grain, and edge chromatic aberration.
- **World:** flat-shaded displaced icosphere with biome vertex colors (beach, meadow, forest, slate cliffs, snow), shader water (shore-distance foam, sparkle, fresnel), atmosphere fresnel shell, gradient sky dome with twinkling stars and a ringed gas giant vista, drifting cloud clusters, instanced wind-swayed trees, rocks, and emissive crystals.
- **Animation policy:** every animation is dt-driven with dt clamped at 1/30 s, ease-out for entrances/exits, retarget-from-current on interruption, pooled objects in the hot loop (no per-frame allocation), particle counts capped, prefers-reduced-motion drops screen shake and heavy particles while keeping informational color and opacity changes.
- **Audio:** fully synthesized WebAudio (no assets): layered SFX per tower and event, ambient pad and wind, master compressor, mute toggle.
- **HUD:** DOM overlay. Chakra Petch for display and numerals, Inter for body. One cyan accent. Dark translucent panels with hairline borders (no backdrop blur), Lucide icon paths for system icons, live 3D-rendered tower thumbnails on build cards. Frequency gate honored: per-shot and per-kill HUD elements never animate; wave-level moments do.

## Architecture
ES modules, no build step for development, one vendored dependency (three.module.min.js). A tiny Node static server with explicit MIME types for dev. A bundler script produces a single self-contained dist HTML (three's export table rewritten to a namespace object) for publishing.

Module order (also the bundle concatenation order, acyclic by construction):
`noise, config, audio, postfx, camera, world, nav, effects, towers, enemies, waves, ui, game, main`

Single source of tuning: `config.js` (scene palette and every gameplay number). CSS custom properties in `:root` are the HUD token block. `window.WH` exposes a debug API (grant gold, spawn, place, kill, fps sampling) used for scripted in-browser verification.

## Milestones and verification
M1 planet and post pipeline, M2 nav and flow field with debug view, M3 placement UX and towers and combat, M4 waves and economy and HUD, M5 full enemy roster and boss, M6 juice and audio polish, M7 balance, performance, bundle, publish. Every milestone ends with a live browser check: screenshots, console error sweep, scripted play via the debug API, fps sampling; final pass runs the design-forge gates and slop detectors plus a full scripted playthrough.
