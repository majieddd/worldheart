# Atmospheric Ink handling and concept board

Owner: Codex. Branch: feature/ink-fps-handling. U189-U193 locally verified.
Intake: https://github.com/majieddd/worldheart/issues/1#issuecomment-5692619265

## Reference

The owner's latest screenshot supplies Vivid Paint: 2.8 contour, .0225 haze,
.35 shadow, 1.3 saturation, 1.5 paint, .77 exposure, 1.25 scale, 81 FOV,
.45 sway, .45 impact, 1 sensitivity. Original 1.3.1 stays archived.
FPS motion reference: https://www.youtube.com/watch?v=73vQzWNoqGo.
Visual inspection, access receipts and intervals are recorded below.

## Pillars

Keep the approved surfaces and contour. Responsive travel with controlled inertia.
Aim and fire without input cancellation. Connected silhouettes at close range.
Bind future 2D concepts to Paintline and Roblox-readable block character forms.

## Core loop

Sprint, slide, aim, shoot, cut and recover. Compare the presets in the same world.
Inspect assets and browse the concept board for future production direction.

## Kit

Existing arena, viewmodel, RobotExpressive clips and painted environment.
Live foliage adaptation leaves frozen factories unchanged. Built-in image
generation for new concept plates; shared real models remain labeled separately.

## Concept

Atmospheric Ink 1.3.1 remains the art foundation. Vivid Paint is the new live
default. Paintline posters anchor future 2D illustration: firm black contours,
painted color masses, crisp cel shadows and restrained surface wear.

## Mechanics

### Presets (U189)
Purpose: reproduce the new screenshot at startup.
Experience: new Vivid by default with original and Deep comparisons.
Inputs: preset buttons, reset, export/import.
Outputs: exact eleven values and matching selected button.
Edge cases: partial import fills from the current default.
Failure: invalid import leaves the prior state.

### Connected foliage (U190)
Purpose: remove hovering canopy plates.
Experience: accented crowns with leaves embedded at the surface.
Inputs: live archived environment construction.
Outputs: connected accent geometry, shared breeze and bounding volumes.
Edge cases: cloned miniature uses the same builder.
Failure: unexpected leaf topology fails loudly instead of corrupting vertices.

### FPS handling (U191)
Purpose: quicker travel, fluid ADS and sprint/slide/shoot transitions.
Experience: immediate steering, brief momentum slide, controlled settling.
Inputs: WASD, Shift, Ctrl/C, Space, RMB, LMB/J, touch controls.
Outputs: normalized velocity, camera height/FOV, articulated held poses, attacks.
Edge cases: collision stops sliding; jumping cancels slide; pause clears input.
Failure: unavailable pointer capture retains drag-look, click and keyboard fire.

### Concept artboard (U193)
Purpose: make a shared future Roblox art reference.
Experience: readable units, towers and manufacturer-specific weapon families.
Inputs: category/manufacturer filters, full-size plate, live 3D links.
Outputs: persisted concept images and exact prompts/provenance.
Edge cases: conceptual IP associations are labeled; current meshes are separate.
Failure: missing art is reported, never represented by an unrelated placeholder.

## Numbers

Initial tuning targets: walk 4.4, sprint 7.1 world units/s, slide peak 9.1 for
.82 seconds, aim blend .20 seconds. Validate actual distances and render timing.

## Content

Three existing demo worlds and seventeen stage specimens. New concepts cover
units/towers, plasma carbines, swords and ember staves with Roblox IP-associated
manufacturer studies. Concepts are proposals, not implemented gameplay assets.

## Interface

Retain navy/mint UI, readable controls, visible active presets and 44px targets.
Add clear slide/aim controls and artboard navigation. Reduced motion limits bob.

## Build order

Presets and foliage, visual reference inspection, controller and viewmodel,
runtime/temporal verification, then concept generation and board, publication.

## Verification

Pure controller transition/frame-rate tests plus real browser keyboard/mouse.
Inspect ordered animation sequences, ADS sight alignment and close canopy.
Run shared stage/arena checks and full demo round. Preserve archive hashes.
Verify public behavior and identities after deployment. Feel remains owner review.

## Decided

| Decision | Status | Evidence |
|---|---|---|
| Revised Vivid is the live default | in game | Exact eleven-value browser and pure checks |
| Original 1.3.1 stays saved | in game | Original button, archive hashes and unchanged frozen files |
| Faster movement, slide and ADS | in game | Real-input handling probe and full three-wave run |
| Paintline anchors future Roblox concepts | partial | Six visually inspected concept plates; owner review pending |
| Production Roblox port | not yet | Browser study only; concepts and current 3D are labeled separately |

Campaign mechanics and frozen art archives are outside this change.

## Task list

- U189 presets: locally verified.
- U190 foliage: locally verified; 496 formerly detached accents embedded.
- U191 handling: locally verified, including simultaneous aim/fire inputs.
- U192 verification/publication: local verification complete, publication pending.
- U193 artboard: six plates generated, saved, inspected and browser verified.

## Where we are

Current Aegis remains 3.18.3 / upstream f91aa9f. Existing collaborator methods
and contribution guidance are retained. No plugin overwrite is needed.

### Reference observations

Visually inspected ordered frames from the actual video at 2:00-2:20,
5:00-5:16 and 15:00-15:16, 260 frames at 5 samples/s. This is a bounded
motion review, not a claim to have watched all 34:57. Observed rapid hip-to-sight
centering, short recoil, release back to travel, directional changes while
reloading and a stable horizon. The slide is an explicit owner-requested mechanic;
these samples do not establish exact Call of Duty movement constants.
Initial browser seeking stalled and returned player errors. HLS extraction
provided real 720p/60fps clips for visual frame review. Clips remain local under
artifacts/ink-fps-handling; the source is linked rather than redistributed.

### Changes and measurements

Walk 2 to 4.4 and sprint 3.5 to 7.1 world units/s. Normalized input removes
diagonal advantage; stronger ground acceleration/braking removes sluggish drift.
Slide requires a grounded forward sprint and a new Ctrl/C press: peak 9.1,
.82 seconds, exponential friction, limited steering, obstacle/jump cancellation.
Hold crouch at 2.25. Camera lowers toward 1.24 from 2.02. ADS reaches its pose
in .20 seconds; world FOV narrows 16 degrees with matching optical-center grip.
Open reflex sight, reduced aim sway/sensitivity, sprint carry, landing settle,
.115-second plasma cadence and longer heat capacity support continuous play.

Source finding: pointer events only fire for the first mouse button down and
the last button up. An actual-input test caught that left click could not fire
while right aim was held. Captured mouse input now handles each mouse button
independently. Retained handling-r1 failures prove the test detects the defect;
handling-r2 and the final run pass. Uncaptured click/drag behavior is retained.

Foliage correction projects accent centers just inside the closest oriented
canopy ellipsoid. All 4,480 accents remain; 496 are reattached. Shared crown
wind still carries them together. Archived source is unchanged.

### Concept collection

Six 1536x1024 built-in image_gen plates are persisted in lib/artboard, with
optimized WebP display copies, original PNG downloads, SHA-256 identities and
composed prompts in catalogue.json. Three maker studies each show a plasma
weapon, sword and ember staff: Playtime Foundry / Rainbow Friends, Latchworks /
DOORS, Tideforge / Blox Fruits. These are proposed crossover identities.
The unit sheet shows three heroes and three towers. Its keeper carries a mint
crystal variant; the manufacturer sheets contain the orange ember studies.
The UI plate was revised to match those manufacturers' actual weapon designs
and remove incidental outer slogans. It is concept art, not implemented UI.

Artboard includes category/manufacturer filtering, full-size modal, keyboard
navigation, native-size zoom, original downloads and a lazy loaded actual 3D
stage with direct specimen selection. Palette and character/form consistency
were inspected visually; no automated art-quality or Roblox-readiness claim.

### Local acceptance

379 automated tests, syntax and style checks pass. 53 arena, 48 asset-stage,
20 handling and 25 artboard browser cases pass. Real-time position-assisted
input cleared all three waves / 15 enemies without damage or wave overrides.
Saved videos and ordered ADS/cut sequences provide motion evidence. The first
blueprint check rejected a missing decision-table format; this ledger records
the actual states. Public verification follows publication.

Limits: physical-phone performance and owner feel/art acceptance remain open.
Current units retain the existing authored robot rig. New Roblox concepts,
manufacturer weapons and interface are production studies, not generated meshes.
