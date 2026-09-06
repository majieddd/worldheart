# Commander feedback implementation

Issue: [#19](https://github.com/majieddd/worldheart/issues/19). Owner: delegated
Codex agent, branch `feature/commander-feedback`, baseline `ded4fbc`.

Active: contextual tower and loot interaction, fuller first-person arm and
third-person choreography, forgiving collision, nest-only campaign waves,
and actual ordered-unit route visualization. Parent owns the shared progress
ledger, blueprint, integration and V2 publication.

Design: preserve the existing light faceted scene and HUD primitives. Context
panels follow their world target, avoid fixed checkpoint chrome, use instant
state updates, and explicitly lend the pointer while interacting on foot.
Damage timing stays at the existing shared active frame. Navigation barriers
stay authoritative; glancing movement may slide along a valid direction.

Acceptance: preserve before/after failures, run meaningful headless and browser
checks for all six, test camera and classic-map regressions, regenerate v2/dist.
Instrumented fixtures and natural play are reported separately. No publication
or owner feel approval is claimed by implementation alone.

## Implemented behavior

- Tower hover/selection/look-at panels project over their world target and
  avoid the actual checkpoint panel. `tp-upgrade` and `tp-sell` stay stable.
  F lends the pointer; F/Escape closes inspection without releasing the
  commander. Tower transactions validate identity, playing state and 14m reach.
- The holding hand/arm is approximately twice as wide, with a square gauntlet
  and forearm. The sword cleave uses absolute shoulder/elbow/hand poses; both
  sides point forward at the unchanged 0.40 active frame.
- Commander movement subdivides travel into at most 0.12m steps and tests
  progressively shallower valid slide directions against the same navigation
  barriers. Matched inputs improved from 0.7184m to 0.9541m mean displacement
  over 0.75s: 28 of 39 improved, none regressed, near-stalls below 0.25m fell
  from two to zero. This is a controlled boundary fixture, not a feel verdict.
- Looking at a drop reveals its real equipped geometry/material preview,
  rarity/tier, damage/cadence/range or ballistic stats, compatibility and
  comparison before pickup. Pick up and Pick up + equip are deliberate actions.
  Incompatible inspection uses untraited item stats without granting equip.
  Full bags open the existing replacement flow; attack-time equip waits for
  recovery. The preview borrows cached weapon GPU assets instead of disposing
  shared geometry on close.
- In 99 Planets, wave units and raids emerge at stationary physical nests.
  The existing campaign wake schedule is 1/3/7/11/15. New nests have a 3s
  warning; wave 15 also establishes a protected guardian launch. Destroyed
  sources cancel their remaining buildup, while live enemies and the guardian
  remain owed. Expanding no longer removes nests. Classic maps keep their rules.
  Boss-shed escorts and evolved mite splits also use a surviving nest; with
  none alive those reinforcements are prevented while their live parent remains.
- Selected units with move orders display the remaining route the actual
  navigator is consuming, sampled every 0.35m onto terrain. New routes replace
  the line; cancellation, death, unselection and possession remove it. A stale
  navigation revision hides the line until the unit replans.

## Evidence and preserved failures

- `commander-feedback/before/`: original movement inputs and arm/pose captures.
- `commander-feedback/after/`: initial FP click failure from a late pointer-lock
  grant. Releasing a grant that arrives during suspension repairs it.
- `commander-feedback/after-2/` through `after-4/`: loot inspection failures.
  The first fixture targeted behind the camera; the actual aim probe then
  exposed stale `:hover` after closing a panel, preventing a new target. Both
  fixture and runtime correction are retained rather than overwriting evidence.
- `commander-feedback/after-5/results.json`: 25 feature assertions passed with
  no browser faults. Its appended orbit camera harness incorrectly ran while
  possessing a unit; that fixture failure is preserved and corrected separately.
- `commander-feedback/context-edges/results.json`: 11/11 checks, no faults.
  Actual campaign checkpoint at 1280x720, 1920x1080 and 390x844; real pointer
  hover and first-person input; incompatible/full-bag/lobber/attack lifecycle.
- `commander-feedback/regression/results.json`: all five maps booted and all
  13 camera checks passed per map. Campaign defeat and retry also passed.
- `commander-feedback/weapons-regression/weapon-results.json`: 29 browser
  assertions passed, including actual combat active frames and queued changes.
- `commander-feedback/final-2/results.json`: 29/29 primary checks, no browser
  faults. Includes actual nest birth positions within the existing 0.25m spawn
  scatter, boss shedding and evolved splitting at nests, and guardian survival
  after all sources are destroyed. The earlier `final/results.json` retained
  an overstrict exact-direction assertion that rejected intentional scatter.

The parent observed a real ocean wave-4 softlock before final integration:
placement protected original entrances but could disconnect a moved nest or
an occupied enemy pocket. The retained parent run reached its 1800s bound
with one stranded Aegis. Placement now protects living physical nest nodes
and occupied ground-enemy nodes, with an explicit nest footprint exclusion.
Two synthetic bridge regressions prove old validation accepted the cut and
the updated validator rejects it. The parent's unforced retest remains required.

The parent independently verified 486/486 isolated real enemy arrivals using
the actual nest-site selector: nine profile/era boundary planets, three
frontier sizes, six distinct sites, and husk/mite/wisp. No stranded unit or
flight ceiling violation occurred. This covers routes before placed towers;
it is separate from the placement regression and natural campaign play.

## Current handoff

Source syntax and style pass; all 221 headless tests pass. Primary UI and
combat regressions, campaign checkpoint/loot edge fixtures and all five camera
harnesses pass. Regenerated mirrors accompany the review commit.
Parent owns shared ledger/blueprint updates, natural ocean retest, integration
and publication. Broader commander feel, 99-planet balance and sustained
performance acceptance remain open. Usage is unmeasured.
