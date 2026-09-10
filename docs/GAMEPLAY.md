# Gameplay systems and numbers

Every number the game balances on, and the file and line it lives on. Read this
when you are changing what something does; read `docs/CREATIVE.md` when you are
deciding whether it should exist.

**The code is the source of truth, not this page.** Numbers move. Citations are
given as `file.js:LINE` so you can check any figure in a second, and you should,
because a document that quietly goes stale is worse than no document. The last
section lists the places where the code disagrees with itself.

## 99 Planets campaign preview, 2026-09-06

The active integration adds `?map=ninetynine&campaign=1`. This is a saved
99-destination campaign; the plain mode URL is a single-planet sandbox.
`js/run/planets.js` owns region, terrain, pressure, era and milestone definitions.
Four terrain profiles and five pressure patterns produce twenty combinations;
health scaling is bounded at 1.35x. `js/encounters.js` applies flyer, armor and
swarm composition changes and three milestone attack patterns without mutating
global enemy templates. Raider pressure uses a 0.85 interval multiplier.

Weapons retain family and parts across extraction. Tiers 1-33 are ancient,
34-66 technological, 67-99 empowered. Defeat/assault reload restores previously
extracted gear; victory reload restores cleared-field salvage. `wh99Campaign`
version 1 stores the account, expedition and idempotent assault receipts in one
envelope. Title purchases require Apply upgrades to save and rebuild that same
planet with the new account profile. See [M5B](qa/implementation/M5B.md) for exact
implementation/evidence scope and the remaining release gates.

## Towers

Six types, in `TOWER_TYPES` at `js/towers.js:16`.

| id | Name | Cost | Hits air | Footprint | Role |
|---|---|---|---|---|---|
| `bolt` | Bolt Sentinel | 150 | yes | 1.3 | Rapid single target |
| `cryo` | Cryo Bloom | 200 | yes | 1.3 | Slow aura, deals no damage |
| `mortar` | Mortar Bastion | 250 | no | 1.4 | Lobbed area damage, has a minimum range |
| `tesla` | Arc Spire | 300 | yes | 1.3 | Charges, then chains with a stun |
| `helios` | Helios Lance | 500 | yes | 1.3 | Beam that ramps on one target |
| `warden` | Warden Barracks | 220 | no | 1.5 | Summons units, no attack of its own |

On space maps the mortar is flipped to hit air, because a ground-only tower is
useless where everything flies (`js/towers.js:84`).

### Marks

Three marks are authored per tower. The tier index in code is zero based and the
player sees `tier + 1`, so `tierStats(type, 0)` is a freshly built tower and
`tierCost(type, 1)` is the price of the first upgrade. That off-by-one runs
through the whole file and through the gate at `js/game.js:585`.

Selected authored values, from the `tiers` arrays at `js/towers.js:21` onward:

| Tower | MK I | MK II | MK III |
|---|---|---|---|
| Bolt Sentinel | 9 dmg, 4.6/s, 8.1 range | 15, 5.2, 8.85, 15% crit | 24, 6.0, 9.6, 25% crit |
| Cryo Bloom | 38% slow, 5.25 range | 48%, 6.15 | 55%, 7.05, plus brittle |
| Mortar Bastion | 34 dmg, 0.48/s, 9.9 range, 2.3 splash | 56, 0.52, 10.8, 2.7 | 88, 0.56, 11.7, 3.1, two shells |
| Arc Spire | 30 dmg, 1.5 s charge, 3 chains | 46, 1.35, 4 | 68, 1.2, 6 |
| Helios Lance | 26 dps, 2.0 s ramp to 3x | 42, 1.7, 3x | 64, 1.4, 3.5x |
| Warden Barracks | 2 units, 7 s to summon | 3, 6 | 5, 5 |

Crits multiply by 2.2 on Bolt, Mortar, Arc and Warden hits. Helios applies the
equivalent expected DPS multiplier to its continuous beam (`js/rewards.js`).
The beam applies its damage as `trueDamage`, so it ignores armour entirely
(`js/towers.js:778`). Mortar shells always carry `armorPierce: 99` and fall off
with distance from the burst (`js/towers.js:1089`).

### The ladder past MK III

`AUTHORED_TIERS = 3` at `js/towers.js:92`. Past it the silhouette stops changing
and the numbers keep climbing, with no ceiling. Cost grows by 1.5 per mark and
power by an exponent of 1.5, so each step costs more and buys proportionally
less (`js/towers.js:100`, `:106`, `:122`).

Scaling is per stat and deliberately uneven at `js/towers.js:130`: damage and
dps scale with the full multiplier, fire rate at 35% of it, garrison at 50%,
range by its cube root. Authored slow scaling saturates at 85% and redirects
surplus into range. Campaign combat additionally caps applied slow at 70%,
including terrain and drafted bonuses; classic maps retain the 85% ceiling.

The classic maps stop at MK III. 99 Planets does not, and instead caps the mark
at the Worldheart's level (`js/game.js:575`, `:585`).

### Targeting

`Tower._acquire` keeps its current target within 1.1 times squared range,
about 4.9% extra radius, and otherwise picks the enemy with the lowest `progress`, which is
the flow field's remaining distance to the heart (`js/nav.js:667`). So the policy
is "whoever is closest to the heart", not closest to the tower. Heads turn at 9
radians per second, 5 for the mortar, and will not fire until aimed within 0.15
radians.

### The one placement rule

No placement may sever the last path from any breach to the heart.
`nav.validatePlacement` at `js/nav.js:715` runs a reachability sweep from the
heart with the candidate footprint blocked, and refuses with `reason: 'path'`.
It also refuses a footprint that covers the heart or a portal node.

In 99 Planets a placement must also be inside the frontier
(`js/game.js:450`), and from first person within 14 units of the body
(`FP_BUILD_REACH`, `js/game.js`).

## Enemies

Five species, in `ENEMY_TYPES` at `js/enemies.js:86`.

| id | Name | HP | Speed | Armour | Bounty | Lives on leak | Flying |
|---|---|---|---|---|---|---|---|
| `mite` | Mite | 26 | 3.1 | 0 | 6 | 1 | no |
| `husk` | Husk | 85 | 1.85 | 0 | 12 | 1 | no |
| `aegis` | Aegis | 340 | 1.1 | 6 | 32 | 2 | no |
| `wisp` | Wisp | 52 | 2.5 | 0 | 14 | 1 | yes, altitude 2.6 |
| `colossus` | Colossus | 3600 | 0.72 | 10 | 320 | 6 | no, and it is the boss |

`damage` on that table is **lives lost when it reaches the heart**, not damage
dealt (`js/game.js:301`). Melee damage is the separate `atk` field. A colossus
reaching the heart costs 6 of your 20 lives.

### Blows, not contact

Nothing damages anything by touching it (`js/allies.js:159`). Every species has a
wind-up and a blow:

| id | atk | Blow to blow | Wind-up | Reach |
|---|---|---|---|---|
| `mite` | 7 | 1.00 s | 0.25 | 1.2 |
| `husk` | 11 | 1.40 s | 0.40 | 1.3 |
| `aegis` | 16 | 1.60 s | 0.45 | 1.4 |
| `wisp` | 6 | 1.10 s | 0.30 | 1.6 |
| `colossus` | 90 | 2.40 s | 0.60 | 1.5 |

The wind-up plants the body, which is the main way an ally slows a march
(`js/enemies.js:1374`). A blow only lands if the victim is still inside reach
plus a small grace when the strike frame arrives (`js/enemies.js:1141`).

### Chasing the player

Constants at `js/enemies.js:16`. An enemy may break off toward the possessed
body within 7 units, but the heart wins if it is within 10. The chase ends at 11
units or after 9 seconds, and then that enemy ignores the player for 6 seconds so
it cannot be re-hooked frame after frame. Bosses never chase. Only a possessed
body is ever chased.

Flyers dive to altitude 0.7 while fighting or while an ally stands within 3.2
units, and climb back afterwards (`js/enemies.js:44`).

### The damage pipeline

`damage()` at `js/enemies.js:1191`, in order: armour subtracts unless the hit is
`trueDamage`, with a floor of 1 so nothing is ever fully immune; brittle adds
12%; `capFrac` limits any single player strike to 85% of maximum health so no
blow deletes a healthy body; then the evolution shield soaks three hits and
recharges only after 3 seconds untouched.

Death pays bounty and score immediately, then the body spends 0.42 seconds
collapsing during which it is inert to every targeting pass and cannot block a
tower placement (`js/enemies.js:1248`).

Deep Freeze is budgeted: 4 seconds of holding, then 2.5 seconds where that enemy
cannot be frozen at all (`js/enemies.js:64`). Without that a cryo field could
make a wave unresolvable.

### Evolution

Tiers at `js/enemies.js:69`, advancing on waves 3, 6, 9 and 12
(`js/run/schedule.js:55`): armour, then speed, then a shield that only sustained
fire breaks, then mites that split on death at 40% health. Split children are
flagged so the cascade stops at one generation.

## Allies and commanders

`ALLY_TYPES` at `js/allies.js:30`.

| id | Name | Commander | HP | Speed | Weapon | Strike |
|---|---|---|---|---|---|---|
| `warden` | Warden | no | 220 | 2.4 | spear | melee |
| `commander` | Bulwark | yes | 1400 | 2.6 | sword | heavy cleave, 44 dmg, 0.85 s |
| `duelist` | Twinfang | yes | 1050 | 3.6 | twin knives | fast pair, 17 dmg, 0.34 s |
| `marksman` | Longsight | yes | 900 | 3.0 | rifle | hitscan, 34 dmg, 34 range |
| `bombardier` | Kettle | yes | 1150 | 2.9 | mortar | lobbed, 40 dmg, 3.4 splash |
| `oracle` | Emberline | yes | 1000 | 3.0 | staff | beam, 52 dps, ramps to 1.9x |

All five commanders share `dps: 26` for their AI on purpose, so the choice is how
you fight and not how hard. Every commander holds ground rather than seeking a
fight, because its death ends the run.

A player strike lands at the strike frame of the animation, not on the click:
`STRIKE_AT` at `js/soldier.js:402` is 0.40 for a cleave, 0.34 for the twin
strike, 0.42 for the lob, and effectively immediate for hitscan and beam.

**Any ally can be possessed, wardens included.** The commander restriction applies
to rallying a party, not to taking control (`js/possess.js:546`).

Two budgets keep melee honest: a unit may pin one enemy for 3 seconds and must
then release it for 4 (`js/allies.js:128`), and the hold is skipped entirely when
the enemy is already inside its own reach so it is never stunlocked out of
swinging back (`js/allies.js:590`).

## Waves, breaches and nests

`js/waves.js`.

Health scales at 8% per wave, steepening past waves 10 and 20 and going
exponential past 30 (`js/waves.js:53`). Melee damage scales on a much shallower
slope, 35% of the health curve, capped at 4x (`js/waves.js:202`). Wave reward is
`70 + wave * 9`.

Composition is a switch on `wave % 5` at `js/waves.js:100`, which is what gives
the run its texture: a husk wave, a mite swarm, a wisp wave, an aegis wave, a
mixed one. Bosses land at 10, 20 and 30 on the classic maps, and on the final
wave of a short run. The 99 Planets boss is hand authored rather than formula
driven: one colossus, four aegis, eighteen husks, twenty-four mites, ten wisps
(`js/waves.js:83`).

Classic breaches follow `portalWakes` in `js/config.js`: Pocket World wakes
at 1, 4, 9 and 14; other classic maps at 1, 3, 7, 11 and 15.

**99 Planets nest waves** create one new physical source every wave, with two
on waves 5 and 10 when space permits. Wave 15 creates a protected guardian
nest. New nests warn for three seconds before spawning. The countdown runs
during combat: `min(75, 45 + (wave - 1) * 2)` simulation seconds between starts.
Game speed affects this clock; the campaign's half-speed spawn-spacing factor
does not. Strategic pause and reward drafts freeze both combat and the clock.

Surviving nests join the next wave's authored distribution and each add a pack:
one mite, two from wave 4, plus one husk from wave 6 and one aegis from wave 9.
Destroying a source cancels its queued enemies, never its already spawned mobs.
There are no separate continuous raids in this timed mode. Rewards resolve in
wave order only after that wave's queued mobs, living enemies and descendants
are gone. Clearing wave 15 cannot bypass an earlier assault.

Nests require a 2.4 m dry clearing in the heart-connected floor region, at least
6 m from other nest sites and 10 m from the heart. Their floor route cost is
at most 160 world units. Generation certifies room for all 17 sources even
without expansion. Footprints that later remove every safe site delay the next
wave with a visible warning; selling reopens the search. Blocked-site retries
cannot pay repeated early-call gold. Nests remain fixed after expansion.

## Maps

`MAPS` at `js/config.js:23`.

| key | Name | Mode | Radius | Nav detail | Breaches | Start gold | Field |
|---|---|---|---|---|---|---|---|
| `pocket` | Pocket World | planetary | 30 | 5 | 4 | 400 | whole globe |
| `giant` | Giant World | planetary | 240 | 7 | 5 | 500 | whole globe |
| `titan` | Titan's Brow | battlefield | 240 | 9 | 5 | 450 | 0.28 rad cap |
| `ninetynine` | 99 Planets | ninetynine | 240 | 9 | up to 17 nests | 450 | 0.52 rad cap |
| `reach` | Shattered Reach | space | 70 | 7 | 5 | 450 | 0.5 rad cap |

A URL with no `?map=` and no stored choice loads **Pocket World**, where none of
the run core, powers, hand, frontier, nests or Worldheart levels exists
(`js/config.js:102`).

Classic walkability requires height from 0.05 through 2.05, slope at or
below 0.95, and no dense forest. Campaign terrain allows water and elevated
ground, and uses directed slope costs and separate flight clearance. The forest threshold
matches the tree scatter exactly, so blocked ground is precisely where the player
sees trees. Lives start at 20, sell refunds 70%.

## The 99 Planets run

The pure core is `js/run/`, and it imports nothing. It takes `dt` and its RNG by
injection and reports what happened by returning events. `js/modes/ninetynine.js`
is the only file that knows both the core and the renderer.

Fifteen waves, boss on 15 (`js/run/schedule.js:5`). Rewards alternate: an odd
wave hands you a tower card, an even one opens a draft of three powers, and each
wave gives exactly one of the two (`js/run/schedule.js:61`).

### The Worldheart

| Level | Cost | Rings held | Tier cap |
|---|---|---|---|
| 0 | - | 0 | MK II |
| 1 | 250 | 3 | MK III |
| 2 | 450 | 5 | MK IV |
| 3 | 700 | 8 | MK V |
| 4 | 1,000 | 11 | MK VI |
| 5 | 1,400 | 14 | MK VII |

Tables at `js/run/schedule.js:29`. The full ladder costs 3,800 gold. The tier cap
is `2 + level`.

Only buying a base level grants territory, immediately and independently of
wave count. Waves do not expand or bank rings. Forward Scout still starts the
run one geometric step wider, without granting a free level.

Crystals are seeded on reachable nav nodes outside the frontier. A commander
automatically picks up at most three, with a total 10% movement penalty at full
load. Return within 4.5 units of the heart and press C to deposit. One crystal
grants 100 base-only credit; deposit does not expand territory or grant tower
gold. The next explicit base upgrade uses credit first, then quotes the gold
remainder. Deposit and pickup identities cannot pay twice.

Cargo and base credit belong to the current assault. Death loses carried
crystals; reload starts a fresh assault, just like towers and run gold. This
is not yet the M5 versioned expedition checkpoint/inventory system.

The frontier angle eases out from 0.05 to 0.52 radians over 14 steps
(`js/run/schedule.js:77`), so early expansions read as dramatic and late ones as
incremental. It is a **mask over a world built at final size**, never a world
that grows, because rebuilding the nav graph would destroy every tower footprint.

### Hand and draft

Hand cap 3, raised to 4 by a talent. A run opens with one card, the loadout
tower, and earns one per odd wave drawn at random from unlocked towers. **A draw
into a full hand is lost** (`js/run/run.js:66`). The five unlockable towers open
at waves 2, 4, 6, 8 and 10, so the roster is complete by wave 10.

The solo shell offers three powers and waits for a deliberate choice. A click
resolves immediately, including while paused. The pure core also supports a
10-second timed draft for future multi-player callers, with seeded tie breaks.

### Powers

Twenty, at `js/run/powers.js:16`, weighted 100 common, 45 uncommon, 14 rare.
Rarity only affects how often something is offered. Four rare powers are unique
and change a rule rather than a number: shots pass through their target, mortar
craters burn, cryo halts outright, every fifth shot doubles.

**Multipliers accumulate additively into a base of 1** (`js/run/modifiers.js:6`).
Three copies of a 12% damage power give 1.36, not 1.40. Multiplicative stacking
across fifteen powers is how roguelite balance explodes, and this is the guard.
Cost cannot fall below 25% either way (`js/run/modifiers.js:38`).

A power is a function of one argument that writes only to the modifier object. It
never reaches into towers, economy or enemies directly. `MODS.current` at
`js/towers.js:9` is the single seam where those modifiers meet the game, and it
is null on every map except 99 Planets.

## Terrain

`js/world.js`. The height field is analytic and drives the visual mesh, the
navigation graph and unit grounding at once. Passing `includeFine = false` gives
the gameplay surface, so walkability never fractures on visual noise
(`js/world.js:177`).

On classic maps, **ranges** are a ridged band standing 7 to 11 units over the land, far above the
2.05 walk limit, pierced by passes where a separate gap noise runs high. A pass
both drops the crest and levels the ground beneath it, because lowering the crest
alone left pass floors at 3 to 4 units, which is still a wall
(`js/world.js:38`).

**Canyons** follow the zero line of a low frequency noise: a dry floor 5.5 units
across, a wall, a rim at 2.6, and ramps where the gap noise opens one. Widths are
measured **in world units from the noise gradient**, never as thresholds on the
noise value, because thresholding gave a 20 unit floor inside a 40 unit shelf
(`js/world.js:52`).

Both are sampled on the unwarped direction. Through the continent warp a canyon
wriggled at the warp's frequency and ranges broke into spikes. Range height also
scales with planet radius, or a 10.5 unit range on the radius 30 planetoid is
half the world.

### Campaign terrain profiles

The title selector and `?terrain=varied|alpine|canyon|ocean` choose Highlands,
Giant peaks, Deep canyons or Ocean islands. Their range/canyon amplitudes are
28/10, 96/24, 18/38 and 16/5 world units. These are inputs to the composed
height field, not maximum heights. Versioned [formation recipes](TERRAIN-RECIPES.md)
mix ridge chains, winding canyons, basins, hills and tablelands independently
of biome dressing. Shared valleys connect their boundaries; group dimensions,
weights and authored anchors are configurable. Canyon banks use a 1.65 relief
gain and ridge chains use 1.18 before seeded variation and continental blending.
Picking, camera clearance and fog use the conservative recipe height envelope.

Ground route costs include actual 3D distance and a bounded uphill penalty.
Swimming enters at 0.65 water depth and exits at 0.45, runs at 60% speed and
disables sprint. Cargo multiplies traversal speed. Route graphs own blocking;
commander orders and enemies share costs. Flyers use a fixed, separate graph
and radial clearance ceilings of 22/38/26/20 units for the four profiles.

Stable, dry footprints can hold towers at elevation. Hot black stone accepts
only Mortars with 15% extra damage; cold blue-white stone accepts only Cryo
with 10% stronger slow, subject to the 70% campaign ceiling. Mixed climates
are denied. A reusable translucent spherical veil and three orbits show actual
3D acquisition, clipped by scene depth, with a red Mortar inner exclusion.
At height `h >= 0`, the horizontal reach multiplier is `1 + min(0.6, h * 0.02)`.
The acquisition radius is `hypot(modifiedRange * multiplier, h)`, which includes
the vertical drop so towers can attack the valley below. This applies after
power and upgrade modifiers, once per stat read. Minimum range and secondary
chain hops stay fixed. Warden gets the horizontal multiplier on its labelled
surface leash. Placement, selection and targeting share these stats.

Connected group valleys reach the meadow floor, while uncut crests retain
their tall, rugged silhouette. The meadow-to-stone blend meets the same 1.75 m
height and 0.62 grade boundary used by floor routing. Ground enemies prefer
connected floor routes; emergency mountain travel remains at 8% speed. Ordinary
nest placement never depends on that emergency passage.

## Weapon and strike prototype

Campaign commanders have two equipment slots and twelve backpack spaces.
I opens a paused inventory, R collects nearby loot, and X cycles equipped/native
attacks. Full backpacks preserve drops and require explicit replacement or
salvage. Native techniques and a basic sword remain available. Compatible sword,
spear, carbine and lobber families have head/grip/core tradeoffs. Pending changes
settle after recovery; launched projectiles retain their release stats.

Drop chances are 2% ordinary, 10% Aegis and one guaranteed Colossus weapon.
Rarities are 68% common, 22% uncommon, 8.5% rare and 1.5% relic. Tiers 1-33 use
ancient presentation, 34-66 technological and 67-99 empowered. These numbers
remain balance prototypes. The saved expedition pilot below supports persistence;
the single-planet sandbox does not retain weapon loot.

Enemy red volumes and damage share a locked origin, facing, radius and arc.
Damage resolves after anticipation; moving outside avoids the hit. Generated
carbines travel through swept collision instead of dealing immediate damage.
Ember burns for three seconds and frost slows for two, respecting the global
70% slow cap. See [M4 evidence and limitations](qa/implementation/M4.md).

## Saved expedition pilot

`?map=ninetynine&campaign=1` opens the two-planet saved pilot. The plain mode URL
remains the single-planet sandbox. Victory enables salvage followed by explicit
extraction and a real next-world load. Collected inventory and remaining ground
drops survive a victory reload. Previously extracted weapons survive defeat;
current assault loot and modifications do not. Mid-assault refresh restarts wave
one from the last checkpoint without repaying previously cleared wave coins.
Three infusions per weapon can raise it to the current planet tier.

The version-1 `wh99Campaign` envelope stores account unlocks, expedition receipts
and temporary assault state atomically. Legacy `wh99Progress` remains preserved;
its victory count does not skip campaign nodes. Failed saves expose export/retry,
and travel waits for successful persistence. The second planet ends this pilot;
the 99-node route is the remaining M5 slice. [Evidence](qa/implementation/M5A.md).

## Audit follow-up

The 2026-09-05 implementation repairs the missing reward/talent consumers and
the Helios/Arc/Warden stat paths described in the original inventory below.
See [M0 evidence](qa/implementation/M0.md). Quartermaster was already functional.
The cached living-commander bonus is now copied before composition so UI
refreshes cannot stack it. Unlock toasts now use the displayed tower names.
The remaining constant-duplication and historical-comment observations below
still apply; the following defect descriptions record the pre-fix baseline.

Found by inventory on 2026-09-05 and each one verified by grep. These are real,
they are not documentation problems, and they are the most concrete work
available to a new collaborator.

**Four drafted powers do nothing.** `livesAdd`, `heartRegen`, `slowAura` and
`chainAdd` are written by powers and read by no consumer anywhere outside
`js/run/`. That makes Hardened Heart, Mending, Cryo Field and Chain Coil dead
picks that still occupy pool slots and can still win a draft, so a run can spend
one of its seven power choices on nothing. The pattern is known: `refundPct` and
`interestPct` both carry comments saying they were dead and were wired up later.
These four were missed.

**Damage powers do not reach the most expensive tower.** The stats getter at
`js/towers.js:491` multiplies `base.dmg`, but Helios Lance stores its damage in
`dps`, so `dmgMul` computes on a field nothing reads while `_updateHelios` uses
the untouched value. Keen Rails, Twin Rails and the living-commander bonus have
no effect on it. By the same mechanism Overclock and Flywheel do not speed up the
Arc Spire, which uses `charge`, nor the Warden Barracks, which uses `summonTime`;
only the bolt reads crit, and only bolt and mortar read the fifth-volley counter.
Every card says "Towers" without qualification.

**Two purchased talents do nothing.** Veterancy at 420 coins and Forward Scout at
400 both set a flag on the profile that nothing reads. Counting House is worse:
the extra 150 gold is added to the run core's per-player ledger, and live gold is
`game.gold`, which is initialised from config and never written from the run. The
per-player ledger is unused, presumably waiting for the multiplayer the file
headers describe.

**Duplicated constants that can silently drift.** `ATK_SCALE_SLOPE` and
`ATK_SCALE_CAP` are defined in both `js/enemies.js:61` and `js/waves.js:9`, and
only the waves copy is ever applied. The wave count, final frontier angle, sell
refund, starting gold and starting lives each exist in both `js/config.js` and
`js/run/`, which is deliberate because the core may not import config, but
nothing checks that they still agree. The boss landing on the final wave depends
on two of them matching.

**Stale comment.** The header of `js/waves.js` describes 30 waves with breaches
at 1, 4, 9, 14 and bosses at 10, 20, 30. That is true only of Pocket World. The
code reads the per-map schedule and is correct; the comment is not.

**Names diverge between code and interface.** Commanders are `commander`,
`duelist`, `marksman`, `bombardier`, `oracle` in code and Bulwark, Twinfang,
Longsight, Kettle and Emberline on screen. Towers are `bolt`, `tesla`, `helios`
against Bolt Sentinel, Arc Spire, Helios Lance. The unlock toast prints the raw
id in capitals, so a player is told "TESLA unlocked" and then goes looking for a
tower called Arc Spire.
