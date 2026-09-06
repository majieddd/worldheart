# Ocean strategy investigation

2026-09-06, Codex on `feature/ocean-strategy`, under [M5 issue #7](https://github.com/majieddd/worldheart/issues/7).
These are unforced instrumented runs, not blind or human play. They extend the
[three preserved tower-focused ocean defeats](M5B.md). No game balance was
changed to produce these outcomes.

## Fixed starting conditions

All three attempts below used runtime `ded4fbc541c77cec2b035eee04e692342098b92e`,
planet 4, Verdant Reach Shoals, requested seed 326532, effective seed 389884,
and the same [earned talent checkpoint](M5B/planet-4-talent-checkpoint.json).
Counting House and Veterancy were already earned and purchased, starting
gold was 600 and Bulwark HP was 1,680. The thirteen banked weapons came from
the first three victories. No new gold, health, enemies, waves, positions,
weapons or powers were injected. An isolated browser received the checkpoint;
simulation time advanced through the existing QA step function.

The optional assault policy uses ordinary movement, look, attack and equipment
actions. It first completes the existing crystal trip, hunts actual live nests,
then defends near the heart and attempts recovery when hurt. Tower priorities
were Mortar, Bolt, Tesla, Helios, Cryo, Warden, with up to ten legal placements
within the earned frontier. An offered card, sufficient gold and valid footprint
were still required. Compatibility remained enforced: this Bulwark cannot equip
the banked carbines. This policy is a limited strategy, not an optimal player.

## Preserved outcomes

| Attempt | Terminal outcome | Commander activity | Interpretation |
|---|---|---|---|
| [Possessed construction](OCEAN-STRATEGY/baseline/run.json) | Defeat wave 9, heart 0, 176 kills, 1 tower, 2,833 gold | 2 nests destroyed, 4,252 damage, 798 world units traveled | Harness tried distant construction while possessed. The game's reach check correctly refused it. Not a placement bug or useful economic balance verdict |
| [Strategic construction](OCEAN-STRATEGY/strategic/run.json) | Commander defeat wave 11, heart 18, 265 kills, 5 towers, 186 gold | 3 nests destroyed, 6,422 damage, 1,093 world units traveled | Switching to strategic view fixed construction. A policy condition still allowed melee to interrupt intended retreat |
| [Earlier recovery](OCEAN-STRATEGY/retreat/run.json) | Commander defeat wave 11, heart 19, 247 kills, 6 towers, 87 gold | 2 nests destroyed, 4,669 damage, 882 world units traveled | Recovery now takes priority at 65% HP and seeks reachable ground away from the assault. It still did not survive the return journey |

All three reported zero runtime faults. Their policy movement-stall counter
reported zero seconds; that thresholded counter does not supersede the owner's
collision report or the dedicated before/after collision fixtures. Construction
and retreat policy defects were corrected openly; the failed traces remain.
The `weaponLoop` field is false because it follows the older pickup/equip event
sequence; assault equipment changes have separate `assault-weapon` trace events.

Terminal captures: [first](OCEAN-STRATEGY/baseline/terminal.png),
[second](OCEAN-STRATEGY/strategic/terminal.png),
[third](OCEAN-STRATEGY/retreat/terminal.png). Each attempt directory also retains
the exact harness/policy source snapshot and tested runtime commit. Tests shared
the machine with the parallel feature agent; no performance result is claimed.

## What this establishes and what remains

Active exploration and nest destruction work on the old rules, but these
strategies have not beaten this ocean planet. Losing with a limited controller
does not prove the planet is unwinnable. The physical nest-only wave change in
[issue #19](https://github.com/majieddd/worldheart/issues/19) changes source
locations and pressure, so this checkpoint requires a new test after integration.
Keep the old and new results separate. Full campaign balance and unforced
99-planet completion remain open.

## Physical-nest integration failure

The same earned checkpoint and corrected assault policy were then tested
against the agent's initial physical-nest worktree on port 8141. The
[preserved run](OCEAN-STRATEGY/physical-nests-softlock/run.json) remained on
wave 4 for the 1,800-second simulation bound, with 20 heart health, 27 kills,
three towers and two destroyed nests. A surviving Aegis on node 157860 had
`nav.next = -1` at repeated observations from simulation second 197 through
1,697. The [capture](OCEAN-STRATEGY/physical-nests-softlock/terminal.png) is a
stalled live wave, not a terminal victory or defeat. There were no runtime
exceptions. The run records the actual loaded asset hashes and exact policy
source hash; it tested an intermediate uncommitted feature build.

Source review found that tower placement protected only the original
portal nodes. A placement could preserve those routes while cutting off a
new physical nest or an enemy that had already moved through a junction.
This is a game softlock, unlike the limited-controller defeats above. Active
sources and occupied ground-enemy nodes were added to placement connectivity
validation, with a nest footprint exclusion and a synthetic bridge regression.
That proves the placement vulnerability, but does not uniquely establish it
as the cause of the original wave-4 stall, which lacked full terminal nav data.

The parent also ran [real-worldgen nest route fixtures](OCEAN-STRATEGY/nest-nav/results.json)
for planets 1/2/3/4/33/34/66/67/99, covering the four terrain profiles and
era boundaries. Each tested frontier rings 0/3/14, six distinct sites and
Husk/Mite/Wisp movement: 486/486 isolated arrivals, no stranded enemies or
flight-ceiling violations. The tested nest-site helper hash is
`dcf11530b9bf0d331d8dc00251da1782f720c9f44739866f8189cd922d6a8ef0`.
These fixtures had no tower placements and did not cover the later softlock.
They do not establish all-99 coverage or combat balance.

The self-play harness now records terminal tower/nest/enemy navigation data
and loaded runtime hashes. It stops for a diagnostic failure if the same
non-heart enemy remains without a path at two consecutive 100-second samples,
rather than waiting out the whole simulation bound.

## Retest at integrated e93d2cb

The [ocean retest](OCEAN-STRATEGY/physical-nests-wave9-stall/run.json) on
`e93d2cb5b65d6bc0cf6401dc9ea12b42bc046863` passed wave 4, then stopped at
wave 9 with eight persistently stranded ground enemies. It retained 22 heart
health, 175 kills, four towers and two destroyed nests. Source nest 5946 still
had a valid route; stranded nodes were unblocked but had `next = -1`.
The diagnostic stopped after repeated observations, with no game exceptions.
Full tower positions, nest and enemy nodes, source IDs and loaded asset hashes
are in that record. [Capture](OCEAN-STRATEGY/physical-nests-wave9-stall/terminal.png).

A separate [fresh defensive run](OCEAN-STRATEGY/fresh-nests-defeat/run.json)
on the same build ended in commander defeat at wave 10, with 18 heart health,
370 kills and six towers. Its last progress sample also observed an unblocked
Aegis without a route. [Capture](OCEAN-STRATEGY/fresh-nests-defeat/terminal.png).
Both used normal gameplay transactions; neither is a victory or a balance pass.

Follow-up review found that commander melee knockback directly rotated the
enemy direction without validating terrain or navigation. An exact-world
reproduction and repair are active. This is an older interaction exposed by
more active exploration, rather than evidence that every stalled enemy came
from the new placement code. The new physical-nest build remains unpublished
until this failure is repaired and retested.

Reproduce the current corrected policy against a local source checkout:

```powershell
node tools/self-play.mjs 12345 artifacts/ocean-assault --campaign --weapons --planets=1 --checkpoint=docs/qa/implementation/M5B/planet-4-talent-checkpoint.json --strategy=assault --tower-priority=mortar,bolt,tesla,helios,cryo,warden --tower-limit=10
node tools/nest-nav-check.mjs artifacts/nest-nav
```

`--base-url=http://127.0.0.1:8141/` selects a collaborator's local server.
The policy is loaded from the invoking checkout and imports game code from
the tested server. Record both revisions. Omit `--strategy=assault` to retain
the established defensive controller. Usage is unmeasured.
