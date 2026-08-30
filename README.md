# WORLDHEART

A 3D tower defense fought across the surface of living procedural planets. Raise defenses anywhere on the globe, bend the void swarm through your maze, and keep the Worldheart alight for thirty waves.

*The void found this world. Every breach must always have a path: seal nothing, shape everything.*

## Map types

Layouts are designed against three named modes:

- **Planetary Battlefield**: the entire globe is in play.
- **Battlefield**: one walled zone on a planet's surface, scaled so play inside feels identical to a planetary map. Towers cannot leave the bounds, the camera is confined to the zone, and the world beyond grays out under fog.
- **Space Battlefield**: floating rock platforms over open void, in predetermined balanced positions of varying size and altitude, tall spire rocks included. Placement stays freeform on every rock, sides included (towers align to the local surface). The swarm flies lanes that bend around the rocks in three altitude bands, so matching coverage height replaces mazing.

## Worlds

Four worlds, selectable on the title screen. Every one is procedurally generated from a seed.

| World | Mode | Scale | Front |
|---|---|---|---|
| Pocket World | Planetary Battlefield | Small globe, radius 30 | Whole planet, 4 breaches |
| Giant World | Planetary Battlefield | Large globe, radius 48 | More continents, longer marches, 5 breaches |
| Titan's Brow | Battlefield | Massive planet, radius 120 | One walled continental front; the colossus rolls past the horizon as scenery. 5 breaches |
| Shattered Reach | Space Battlefield | Asteroid field, radius 70 shell | Rock platforms adrift over void; everything flies. 5 breaches |

At strategic zoom, towers and creatures swell for readability (more on bigger worlds) and then hand over to a screen-fixed icon layer; the camera lens narrows as you zoom in so a planet feels vast underfoot and only reveals its curve from orbit; and pan speed tracks camera altitude so the world drags at the same rate at every zoom. Battlefield worlds sit under a planet-wide broken cloud deck with a clearing over the war zone.

## Play

Serve the folder over HTTP (ES modules require it), or open the prebuilt single file.

```bash
node tools/serve.mjs 8137
```

Then open http://127.0.0.1:8137. Alternatively, build and open `dist/worldheart.html`, which is fully self-contained:

```bash
node tools/build.mjs
```

Append `?seed=12345` to any URL for a specific world; the title screen's settings popover shows the current seed.

## Controls

| Input | Action |
|---|---|
| Drag | Orbit the planet |
| Scroll or pinch | Zoom |
| 1 to 5 | Select a tower to build |
| Left click | Build, or select a tower |
| Right click or Esc | Cancel, deselect |
| U | Upgrade selected tower |
| X | Sell selected tower (70% refund) |
| Space | Pause |
| F | Cycle game speed 1x, 2x, 3x |
| M | Mute |

## The one rule

Placement is freeform: any open walkable ground on the planet. The single restriction is that no placement may sever the last path between any breach (active or dormant) and the Worldheart. The ghost turns red and refuses when it would. Flyers ride the same corridors as walkers but ignore your blockers, so pure walls fail where layered ranges win.

## Towers

| Tower | Cost | Role |
|---|---|---|
| Bolt Sentinel | 150 | Rapid single-target rails, hits air |
| Cryo Bloom | 200 | Constant slow aura, ground and air |
| Mortar Bastion | 250 | Lobbed area damage, ground only, minimum range |
| Arc Spire | 300 | Charged chain lightning with a brief stun |
| Helios Lance | 500 | Continuous beam that ramps to triple damage |

Each has three marks; upgrades change the machine, not just the numbers.

## Technical notes

Three.js (vendored, r180) on WebGL2 with a custom pipeline: MSAA half-float scene target, soft-knee bright pass, dual-Kawase bloom pyramid, ACES tone map, grade, vignette, grain. Terrain, water, sky, clouds, and every tower and creature are procedural geometry; audio is synthesized WebAudio with no assets. One analytic height field drives the visual mesh, the navigation graph, and unit grounding. Ground pathing is a single-source Dijkstra flow field over a geodesic icosphere, recomputed on every build and sell; placement legality is a reachability sweep with the candidate footprint blocked.

Written by Claude (Fable 5) as a capability showcase. Design decisions and rationale live in [DESIGN.md](DESIGN.md) and [docs/superpowers/specs/2026-08-30-worldheart-design.md](docs/superpowers/specs/2026-08-30-worldheart-design.md).
