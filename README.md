# WORLDHEART

A 3D tower defense fought across the surface of living procedural planets. Raise defenses anywhere on the globe, bend the void swarm through your maze, and keep the Worldheart alight.

Five worlds across four map types, plus **99 Planets**, a roguelite campaign mode where you hold a shrinking circle of ground, draft powers between waves, and can drop into first person to fight alongside your towers.

*The void found this world. Every breach must always have a path: seal nothing, shape everything.*

## Map types

Layouts are designed against four named modes:

- **Planetary Battlefield**: the entire globe is in play.
- **Battlefield**: one walled zone on a planet's surface, scaled so play inside feels identical to a planetary map. Towers cannot leave the bounds, the camera is confined to the zone, and the world beyond grays out under fog.
- **Space Battlefield**: floating rock platforms over open void, in predetermined balanced positions of varying size and altitude, tall spire rocks included. Placement stays freeform on every rock, sides included (towers align to the local surface). The swarm flies lanes that bend around the rocks in three altitude bands, so matching coverage height replaces mazing.
- **Roguelite campaign**: a walled front that GROWS. You start on a circle twelve units across, earn a ring of ground for every wave you survive, and widen the circle as far as your Worldheart can hold, fighting fifteen waves to a planetary boss. See [99 Planets](#99-planets).

## Worlds

Five worlds, selectable on the title screen. Every one is procedurally generated from a seed.

| World | Mode | Scale | Front |
|---|---|---|---|
| Pocket World | Planetary Battlefield | Planetoid, radius 30 | Whole world, 4 breaches |
| Giant World | Planetary Battlefield | Planet, radius 240 | Continents past counting, ocean-crossing marches, 5 breaches |
| Titan's Brow | Battlefield | Planet, radius 240 | One walled front on a full planet; the world rolls on past the horizon. 5 breaches |
| Shattered Reach | Space Battlefield | Asteroid field, radius 70 shell | Rock platforms adrift over void at varying altitude; everything flies. 5 breaches |
| 99 Planets | Roguelite campaign | Planet, radius 240 | A circle you widen wave by wave, 15 waves to a boss, 5 breaches |

Titan's Brow and Giant World are the same class of world, deliberately: a Battlefield is a section of a real planet, so a campaign can fight several fronts on one world and later play the whole globe with those regions still in place. A walled front prunes its navigation graph to the cap, which buys it a far finer grid than a whole planet could afford.

## Camera

Panning locks the point of the world under your cursor to the cursor, at any lens, pitch, rotation, or zoom (measured to within a pixel by the built-in harness, `WH.camTest()` in the console). Every part of the feel is a live slider under the settings gear: lens and pitch at each end of the zoom, minimum and maximum height, and pan and zoom sensitivity. Settings persist per browser; "Reset camera feel" restores the defaults.

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

Append `?map=<key>&seed=12345` to pick a world and a seed. Map keys are `pocket`,
`giant`, `titan`, `reach` and `ninetynine`. Both persist to `localStorage`, so a
bare URL reopens whatever you played last.

The seed you pass is a starting point, not the final one: worldgen retries until
it finds a habitable field, advancing the seed each attempt, so `?seed=771` may
report 40366 in the settings popover. It is deterministic, so sharing either
number reproduces the world.

Run the tests, and refresh the published copies before committing:

```bash
node tools/test.mjs      # 128 headless tests, no browser needed
node tools/deploy.mjs    # mirrors v2/ and rebuilds dist/
```

There is no `package.json` and nothing to install - Node 24 runs the ES modules
directly.

## Controls

**On the board**

| Input | Action |
|---|---|
| Drag / WASD / arrows | Move across the world |
| Scroll, pinch, + / - | Zoom |
| Ctrl + middle-drag, or Q / E | Rotate the view (R or middle-click resets) |
| 1 to 6 | Pick a tower. In 99 Planets these address your HAND by slot; on the classic maps they pick a tower type (1-5) |
| Left click | Build, select a tower, or take control of a unit |
| Left drag | Box-select your units (99 Planets) |
| Right click | Order the selection to move, post a barracks patrol, or cancel |
| Esc | Cancel, deselect |
| U | Upgrade selected tower |
| X | Sell selected tower |
| B | Upgrade the Worldheart (99 Planets) |
| Space | Pause |
| F | Cycle game speed 1x, 2x, 3x |
| M | Mute |

**Controlling a unit** (99 Planets, click a friendly unit to take it)

| Input | Action |
|---|---|
| WASD / arrows | Move and strafe. Speed ramps up and settles rather than snapping |
| Shift | Sprint (forward only); the lens widens and the stride lengthens |
| Mouse, or Q / E | Look. Right-drag looks when pointer lock is refused |
| Left click | Strike. Hold to keep swinging or channel. A melee blow lands at the strike frame of the swing, not on the click |
| Space, or F | Jump. A press just before landing is buffered and fires on touchdown |
| P | Pause (Space is the jump while you are in a body) |
| Scroll | Pull back to third person and return |
| G / H | Rally nearby units into a party / dismiss them |
| Esc or Tab | Release control. Refused while you are outside the frontier |

P pauses while you are in a body (Space jumps), and the board's keys stand down.

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
| Warden Barracks | 220 | Summons a garrison that holds ground. No attack of its own |

Three marks are authored, and upgrades change the machine, not just the numbers.
In 99 Planets the ladder does not stop there: a tower can be upgraded for ever,
with the price climbing exponentially against power that climbs polynomially, so
each step costs more and buys proportionally less. The mark a tower may reach at
any moment is capped by the Worldheart's level, two marks on an unraised heart
and one more per level (see [99 Planets](#99-planets)). Selling refunds 70%, or
up to 90% with the Salvage power.

## 99 Planets

`?map=ninetynine`, or the fifth card on the title screen.

Fifteen waves on one planet. You begin holding a circle twelve units across with
a single tower from your loadout. Every wave you survive **earns** a ring of
ground, but the circle only widens as far as your **Worldheart** can hold. The
two rewards alternate: an **odd** wave hands you a tower card, an **even** one
opens a draft of three powers. Enemies evolve on waves 3, 6, 9 and 12 - gaining
armour, then speed, then a shield that only sustained fire breaks, then the
ability to split - and wave 15 is a planetary boss.

### The Worldheart

The heart is the run's one upgradable base, bought with run gold from the panel
under the gold readout or with **B**. Its level sets two things: the highest
mark any tower may reach, and how many of the fourteen frontier rings the run
can hold. A wave cleared past what the heart permits is banked, not lost: the
panel counts the rings held and the next upgrade pays them all out at once.

| Level | Cost | Tier cap | Rings held |
|---|---|---|---|
| 0 | - | MK II | 1 |
| 1 | 250 | MK III | 3 |
| 2 | 450 | MK IV | 5 |
| 3 | 700 | MK 5 | 8 |
| 4 | 1,000 | MK 6 | 11 |
| 5 | 1,400 | MK 7 | 14 |

Only a fully raised heart reaches the planet's final frontier.

### Nests

Every woken breach that still stands **outside** your circle is a nest, and a
nest trickles a raid from where it actually stands: two mites, joined by a husk
from wave 4 and an aegis from wave 8, every 16 seconds of sim time at first and
a little faster each wave. Raids walk the same field to the heart as the waves
do, but they are not pulled in to your frontier the way the waves are, so they
arrive from the dark. A nest falls silent when units bring the breach down,
which pays 180 gold, or when the frontier grows out to swallow it. The wave
readout counts the nests that are live. That is the pressure that makes
expanding the circle, or marching out to it, worth the gold.

You are not only the camera. A **commander** is granted each run, permanent and
strong, and losing it ends the run. Click any friendly unit to take control of it
in first person: walk, jump, look around, strike, and pull back to third person
on the scroll wheel. Five commander archetypes fight completely differently -
a heavy cleave, a fast dual-strike, a hitscan marksman, an arcing bombardier and
a channelled beam.

Walking out past the frontier severs base control: the fog closes in, the orbit
view is refused, and you have to walk home. Out there are the breaches that feed
the waves, which units can destroy, and caches of gold worth the trip.

Cleared waves pay **coins**, banked whether the run is won or lost, and spent
between runs in a four-tier talent tree on permanent unlocks: the rest of the
tower roster, the commander archetypes, and standing bonuses.

## Technical notes

Three.js (vendored, r180) on WebGL2 with a custom pipeline: MSAA half-float scene target, soft-knee bright pass, dual-Kawase bloom pyramid, ACES tone map, grade, vignette, grain. Terrain, water, sky, clouds, and every tower and creature are procedural geometry; audio is synthesized WebAudio with no assets. One analytic height field drives the visual mesh, the navigation graph, and unit grounding. Ground pathing is a single-source Dijkstra flow field over a geodesic icosphere, recomputed on every build and sell; placement legality is a reachability sweep with the candidate footprint blocked.

The 99 Planets run logic lives in `js/run/`, which imports nothing at all - no
Three.js, no DOM, no storage, no `Math.random` - so it can be unit tested
headlessly and transliterated to Luau later. `js/modes/ninetynine.js` is the only
file that knows both that core and the renderer.

## Working on it

- **[CLAUDE.md](CLAUDE.md)** - how to run, test and deploy, and the invariants
  that break silently. Read this first.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - what each module owns, and
  step-by-step recipes for adding a tower, an enemy or a commander.
- **[DESIGN.md](DESIGN.md)** - the visual and interaction contract.
- `docs/superpowers/` is a historical record of specs and plans, not current
  documentation. Each file says so at the top.

Written by Claude as a capability showcase - Fable 5 through the classic maps,
Opus 5 for 99 Planets and everything after it.
