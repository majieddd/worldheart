# Combat and economy checkpoint

The first U89-U114 checkpoint covers wood/gold finishes, commander focus,
scepter fire, global-base overview, quicker outward nest waves, scrap forging,
held aiming, bounded earthquake work and activated commander/weapon skills.
Environmental systems, terrain refinements and astronomical worlds are still
open in [the request ledger](../ACTIVE-WORLDS.md).

## Evidence

- [50 input/combat/placement checks](combat.json): all five commander skills,
  all six weapon-family skills, cooldowns and expiration, actual damage,
  scrap purchases, held aim and menu release, beam origin, complete-planet
  framing and ten waves of connected nests farther from an unchanged base.
- [23 regression checks](regression.json): physical ledges, actual quake nest
  destruction, predicted-versus-committed geometry, unchanged footprint buffers,
  forging and HUD separation. Old ore assertions now use salvaged weapons.
- [22 equipment checks](equipment.json): actual inventory equipment and damage
  across five material tiers for Twinfang blades and Ember scepters.
- [12 finish checks](finishes.json) and [visual comparison](finishes.png): six
  families, dark rough wood with grain/scars versus polished reflective gold.
  Grip-space UVs survive the shared geometry merger. The same finish function
  is used by first-person, soldier and dropped/exhibited weapons.
- [First-person fire](scepter-fire.png) and [aiming](aim-scepter.png): the beam
  begins at the visible prop. A first review exposed its old hidden-body origin;
  this was fixed before acceptance.
- [Full defense and extraction](defense.json): fresh profile, ten waves,
  325 kills, 22 heart health, six towers, five items carried to Planet 2. Legal
  purchases, placement and rewards; no injected gold, enemies or wave wins.
  This is an instrumented policy, not blind play. Simulation is 60Hz with one
  rendered frame per two simulated seconds, so it does not establish FPS.
- All five map camera suites passed. 307 automated rules/geometry/lifecycle
  tests passed; runtime checks remain separate from those tests.

## Earthquake timing

Native Chrome on this workstation, 1440x900, seed 12345. Three fixture-funded
base upgrades make the event visible; quake placement is triggered deliberately.
Both runs changed 26,212 existing navigation nodes and 16,560 mesh vertices,
preserved footprints and resumed simulation with responsive camera input.

| Metric | [Before](quake-before.json) | [After](quake-after.json) |
|---|---:|---:|
| Frame median | 6.9 ms | 6.9 ms |
| Frame p99 | 13.9 ms | 7.2 ms |
| Worst frame | 48.6 ms | 27.8 ms |
| Longest terrain work slice | 17.6 ms | 6.0 ms |

The forecast mesh now builds in yielded rows. Ground sampling and terrain
repainting use smaller batches and the per-frame work budget is 3ms. Results
are one bounded native scenario, not a broad hardware guarantee.

## Retained failures and limits

[The first combat run](combat-first.json) missed the lobber target because the
fixture stood underneath a forward ballistic shot. The corrected fixture aims
the actual shell at nearby ground and verifies its explosion damages a body.
[A subsequent fixture error](combat-second.json) accessed a released aim vector;
the fixture now creates its own aim direction. Neither failure was hidden.
The final run additionally checks beam-tip alignment, menu cancellation and
outward nest placement. One successful defense does not complete 99-planet,
device, multiplayer or long-term balance acceptance.
