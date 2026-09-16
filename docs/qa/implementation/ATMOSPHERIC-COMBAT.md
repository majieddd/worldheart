# Atmospheric Ink combat field

Owner: Codex. Branch: feature/atmospheric-combat. U172-U177 published and publicly
verified at runtime 576e229, PR #54. Usage unmeasured.

## Reference

Owner-selected Atmospheric Ink 1.3.1: illustrative clarity and grit. Preserve its
exact rendering recipe and the existing Hard Cel archive. Borderlands informs
surface ink and readable combat; the current authored automaton is the accepted
movement/character reference. This standalone demo adds infinite-life combat and
inspection flight without changing campaign mechanics.

## Pillars

Paint stays attached to surfaces through movement and articulation. Immediate
first-person look with smooth translation and authored attack phases. Weapons
carry weight through shoulder, elbow and wrist motion. Every impact has a visible
cause. Art adjustments are reversible and reset exactly to the locked 1.3.1 recipe.

## Core loop

Explore a meadow, ochre canyon or dusk ruin. Start a repeatable demonstration
round, fight moving units with a sword and plasma rifle while towers assist.
Clear all waves, replay, or fly above the encounter. Defeat causes a quick free
respawn; there is no life limit and no campaign save access.

## Kit

The pinned CC0 RobotExpressive rig and 14 authored clips from the previous slice.
Three articulated sentinel loadouts (blade skirmisher, plasma ranger, heavy guard)
using that rig with modeled attachments. Three authored tower assemblies: rotary
cannon, twin plasma turret and crystal pulse beacon. Two first-person weapons
with articulated two-segment robot arms, joint pivots and finger grips. Archived
painted world geometry and pigment; additional canyon strata, ruin arches,
crystals, plants and arena paths use the same surface materials. Procedural
geometry is explicitly authored here; no new AI mesh generation is claimed.

## Concept

The existing local-atmospheric-ink.png and motion-review.webm in STYLE-PLAYGROUND/
are the owner-selected reference. Use those colors, fine contours and gouache
surfaces across new parts. Record one weapons/unit contact sheet before delivery.

## Mechanics

### First-person movement and inspection

Purpose: explore the look at walking scale and from above.
Experience: direct mouse look, grounded acceleration, responsive jump and stable horizon.
Inputs: WASD, Shift, Space, mouse look; V third person; F flight; Space/Ctrl ascend/descend.
Outputs: movement, authored locomotion, weapon sway and camera modes.
Edge cases: Escape releases pointer lock; blur clears held inputs; terrain bounds are enforced.
Failure: missing graphics/assets show retry guidance; reset returns to a safe spawn.

### Sword and plasma rifle

Purpose: inspect articulated weapon movement and visual feedback under real input.
Experience: three sword cuts with anticipation/contact/recovery; plasma recoil and rapid fire.
Inputs: 1/2 select weapon, primary attack, secondary guard/aim, R vent rifle.
Outputs: contact-timed hits, hit markers, recoil, ink trails, sparks and target reactions.
Edge cases: one sword hit per enemy per swing; queued attacks wait for recovery; bolts use swept hits.
Failure: empty swings and out-of-range fire miss; no invisible automatic damage.

### Demonstration rounds

Purpose: exercise moving/attacking units, towers and repeated feedback.
Experience: three escalating waves, readable enemy windups and a clear completed state.
Inputs: Start round, restart, weapons, movement and flight.
Outputs: pursuit, ranged fire, tower targeting, health, quick unlimited respawns and kills.
Edge cases: flight cannot leave stale hostile attacks active; enemies stay in arena and pool is bounded.
Failure: defeat respawns without ending the demo or consuming lives; restart clears every pooled state.

### Locked style and graphics controls

Purpose: tune readability while keeping the selected art direction recoverable.
Experience: immediate outline, haze, shadow, pigment, saturation and quality changes.
Inputs: graphics panel sliders, Reset to 1.3.1, export settings.
Outputs: temporary render overrides; separate exported custom JSON presets.
Edge cases: defaults never mutate the baseline recipe; reopening starts from 1.3.1.
Failure: invalid values are clamped; reset restores every graphics setting.

## Numbers

| Value | Number | Rationale |
|---|---|---|
| Player height | 2.4 units | matches the accepted rig |
| Walk / sprint | 2.0 / 3.5 units per second | matches calibrated gait at useful FPS travel speed |
| Sword cycle | 0.58-0.76 seconds | visible anticipation, decisive active cut and recovery |
| Sword reach | 3.4 units | fits blade plus articulated arm extension |
| Plasma cadence | 0.16 seconds | readable rapid shots with distinct recoil |
| Projectile speed | 50 units per second | fast feedback with swept collision |
| Enemy pool | 9 actors | bounds draw calls and animation work |
| Round waves | 3 | complete repeatable demo rather than an unfinished campaign |
| Respawn delay | 1.0 seconds | gives defeat feedback without stopping exploration |
| Outline default | 1.4 CSS pixels | exact 1.3.1 recipe |
| Fog default | 0.0115 | exact selected atmosphere |
| Saturation default | 1.16 | exact selected color depth |

## Content

Three environments selected directly in the header: meadow, amber canyon,
moonlit ruins. A peaceful overview displays three unit and tower families;
Start round activates the encounter. Flight, camera switching and reset remain
available. Weapon selection exposes both first-person models without progression.

## Interface

Retain the navy/cyan visual language with a large scene, compact health/round
status, crosshair/contact marker and a bottom weapon selector. A collapsible
settings drawer owns graphics tuning. Pointer-lock entry explains Escape. Touch
uses a movement pad, free-look gesture and large attack/jump/fly buttons.

## Build order

1. End-to-end playable: locked surface paint, move/look, one enemy, sword/plasma,
   three-wave completion and unlimited respawn.
2. Articulated weapon poses and accepted locomotion across the unit loadouts.
3. Environment/tower variants, graphic controls and inspection flight.
4. Temporal review, performance/input/regression probes and live publication.

## Verification

Measure material-space stability while object and camera translate together,
including a deliberately world-projected control. Record natural first-person
sword/plasma and enemy motion over time. Assert windup/contact/recovery, finite
joint transforms, hit/miss behavior, swept projectile collisions, repeatable round
completion, respawn and reset. Exercise real keyboard/mouse/touch and pointer lock.
Check all environments, settings/reset and unchanged candidate identities.
Run syntax/core tests and existing browser harness, then public identity/runtime checks.

## Decided

| Decision | Status | Evidence |
|---|---|---|
| Atmospheric Ink 1.3.1 selected | in game | owner message this turn |
| Correct surface anchoring | in game | translated surface fixture is pixel-identical; old control changes |
| FPS combat, enemies and worlds | in game | 52 browser checks and real-input three-wave completion |

## Task list

- U172 lock 1.3.1 and fix material sliding: published and verified.
- U173 FPS controls and articulated sword/rifle: published and verified.
- U174 moving unit variants, towers and repeatable rounds: published and verified.
- U175 three environments and inspection flight: published and verified.
- U176 graphics tuning and exact reset: published and verified.
- U177 temporal/local/public verification: complete for the bounded slice.

## Where we are

The user selected 1.3.1 and likes the previous character and effects. This builds
on those assets. Source pigment uses world-space projection, which causes moving
objects to travel through their paint. The frozen original stays intact; the
corrected live material separates surface coordinates from world lighting.

### Delivered slice

`atmospheric-arena.html` has the meadow, amber canyon and moonlit ruins, three
sentinel loadouts, cannon/plasma/beacon towers, articulated first-person arms,
three sword cuts, guard, plasma recoil/heat/venting, authored enemy locomotion,
attacks/death, hit feedback, flight and optional third-person inspection. The
three-wave round contains 3/5/7 enemies with unlimited one-second respawns.
Graphics exposes contour width, haze, shadow depth, saturation, texture, exposure,
render scale, FOV, movement sway, impact motion and sensitivity. Custom presets
export separately; Reset restores all 1.3.1 defaults. Campaign saves are untouched.

The exact selected prior slice is preserved in the 32-file ZIP and manifest at
`art-candidates/atmospheric-ink-v1.3.1.*`, from revision `060c78c`. The annotated
tag `art/atmospheric-ink-v1.3.1` targets that source. Historical recipe status
inside the archive is deliberately unchanged; the new manifest records approval.
All archived file hashes match Git bytes. The live shader correction changes
pigment attachment; the preserved reference remains available without this fix.

### Evidence and limits

- 42/52 local browser checks, 35/35 previous-playground regressions and 61/61
  candidate regressions. 372 automated tests pass. The 14-section blueprint gate
  passes with zero failures/warnings.
- Surface motion fixture: mean RGB delta 0 when object and camera translate
  together; deliberately old world-projected control delta 0.6076. World-space
  deformed positions/normals still drive lighting; rest coordinates drive pigment.
- Ordered sword frames and numeric shoulder/elbow/wrist checks cover anticipation,
  active cut and recovery. Fixed .45/.44 arm lengths, finite transforms, contact
  only during the active interval, one hit per target per swing, and distant miss.
- `live-combat.webm` records real-time input with position-assisted aiming. No
  damage/wave overrides: 15 kills, three waves, completed in 34.5 simulated seconds.
  This is an assisted input test, separate from the controlled lifecycle test.
- Desktop Chrome on NVIDIA RTX 4080 Laptop GPU (driver 610.88), 1600x1000 viewport,
  1.25 render scale: median 13.8 ms, p95 14 ms across 300 combat frames. This bounded
  sample does not certify lower-end hardware or physical-phone performance.
- Keyboard, captured mouse, touch swipe/attack, flight, pause, settings export/
  import/reset and responsive 390/768/1600 layouts were exercised. Physical-phone
  feel and owner approval of the expanded models/environments remain open.

### Corrections retained

The first probe caught a ZIP manifest field mismatch in the test, an over-specific
patrol assertion (one unit may legitimately be idle), and the pause veil covering
header controls. Later evidence caught a tower event payload overwriting its event
kind. These were corrected and the failed receipts retained. A longer input run
found an enemy spawned inside a rock at wave three. Spawns now find collision-clear
positions; ranged units navigate until they have a clear firing line. Every wave
in every environment is checked for blocked spawns, and the repeated live round
clears. Initial ZIP line-ending conversion also failed the individual hash audit;
the archive was rebuilt from Git with automatic CRLF conversion disabled before
publication. All 32 entries now match their source bytes.

### Current Aegis

Installed `3.18.3+codex.20260916020940` includes current upstream `f91aa9f` and
preserves production workflow contribution `cb14a65`. All 320 installed files
match integrated source `3d52542`; installed/source portable doctor reports 8/8.
The latest style-to-3D, character-animation, blueprint and interface methods were
read directly. The first conflicted-manifest install failed and was replaced with
the corrected installation. Existing contribution/coordination guidance remains
intact; no collaborator method or pending PR was replaced.

### Reproduce

Serve the repository with `node tools/serve.mjs 8154`. Open atmospheric-arena.html.
WASD/Shift move, mouse looks, 1/2 select weapons, mouse/J attacks, RMB guards/aims,
R vents, F flies, Space/Ctrl change altitude, V changes camera and G opens graphics.
Escape releases the cursor and pauses; the header remains available.

Use the existing `tools/qa-painted-lab.mjs` runner with `--arena` or `--arena-live`.
Set WH_BASE_URL and WH_NODE_MODULES as for previous labs. Evidence and preserved
failures are in the adjacent ATMOSPHERIC-COMBAT/ folder. The implementation retains
the latest Homeworld preview; publication must fast-forward shared preview/v2.

### Public closeout

[Open the proving ground](https://majieddd.github.io/worldheart/v2/atmospheric-arena.html).
[PR #54](https://github.com/majieddd/worldheart/pull/54) retains the scoped review.
Runtime `576e229a753a3d3ec355cefd712c36e6044d824e` passed
[Pages action 35050727019](https://github.com/majieddd/worldheart/actions/runs/35050727019).
The annotated preservation tag and ZIP are pushed. Stable main remains `1374122`.

53/53 public browser checks pass, including the added AA contrast measurement
(minimum 5.87:1), actual mouse/keyboard/touch controls, rendered graphics sliders,
all-wave spawn checks in all environments, infinite respawns, preset round trip,
bounded GPU allocation, missing-model guidance and graphics-context restoration.
The public surface-anchoring control passes. Public desktop median 7 ms, p95 14 ms
over 300 frames on the same RTX 4080 Laptop GPU. All 251 public/source identities
match. The first concurrent network pass timed out on page navigation and three
older campaign audio files; sequential browser and targeted hash retries pass.
Both initial failure receipts are retained, and no runtime fix was needed for
those transport timeouts.

This evidence closeout changes documentation only. It does not change the
verified runtime commit or imply a production campaign art migration. Expanded
asset/art acceptance and physical-phone feel remain owner/device checks.
