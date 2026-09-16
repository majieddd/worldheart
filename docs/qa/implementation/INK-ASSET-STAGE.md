# Atmospheric Ink asset inspection

Owner: Codex. Branch: feature/ink-asset-stage. U184-U188 locally verified; publication pending.
Intake: https://github.com/majieddd/worldheart/issues/1#issuecomment-5691920677

## Reference

Preserve Atmospheric Ink 1.3.1 and its frozen ZIP, manifest and tag. The owner's
two screenshots supply exact reversible graphics overrides. The collaborator's
Paintline posters and comparison plate are the future 2D reference: painted color
masses, clean contours and readable dark shadows. The owner likes the current
3D treatment; this is a detail and inspection pass. Borderlands contributes ink
and grit; the approved painted direction contributes surface color and clarity.

## Pillars

Original style remains recoverable. Compare identical scenes with exact settings.
Pigment belongs to surfaces. Weapon contact stays readable throughout its arc.
The workbench uses the actual runtime builders and labels static reference art.

## Core loop

Compare original, Vivid paint and Deep ink on the same subject. Explore the FPS
arena or the exhibition. Focus a specimen, orbit it, play/pause or scrub its
motion, trigger effects and inspect the actual held weapon. No campaign saves.

## Kit

Seventeen specimens: four RobotExpressive units, three articulated tower types,
one Paintline tower, two weapons, three earlier painted reference meshes,
three actual environment miniatures and one effects target. Fourteen authored
actor clips and three FPS sword cuts. Shared arena material/weapon/unit/effects
builders. lib/paintline/provenance.json pins source ac1a925 and the original
2048-square embedded texture. Existing collaborator asset, no new AI generation.

## Concept

The attached red-base, gunmetal/cyan cannon guides the new articulated Bastion.
Paintline's tower poster and towerline plate were inspected on the supplied live
page after lazy image load. Warm painted masses and clean ink guide future art;
the source 3D retexture differs from its poster and is labeled as a static
reference. Review sheets: INK-ASSET-STAGE/overview.png, held-rifle.png,
bastion-cannon.png and cut-1-sequence.png through cut-3-sequence.png.

## Mechanics

### Graphics comparisons (U184)
Purpose: reproduce both screenshots with one click.
Experience: immediate comparison on the same subject.
Inputs: preset buttons, sliders and JSON import/export.
Outputs: exact values and selected state.
Edge cases: manual changes clear named selection; reset restores 1.3.1.
Failure: invalid imports preserve previous settings and show an error.

### Articulated attacks and weapon detail (U185-U186)
Purpose: reliable input and continuous readable cutting motion.
Experience: an arc with contact velocity and visible recovery.
Inputs: click, J, held attack or touch attack.
Outputs: windup, cut, recovery, collision and surface-attached close-up paint.
Edge cases: denied pointer lock supports click attack and drag look; drags do
not attack. A recovery click queues one next cut. Limbs retain fixed lengths.
Failure: misses remain misses; interrupted input cannot stick on.

### Asset and effects stage (U187)
Purpose: inspect assets together and diagnose motion.
Experience: a readable exhibition with direct focus and precise motion controls.
Inputs: specimen, orbit/zoom, clip, time, speed, pause, frame step and effects.
Outputs: live runtime models, animation poses, feedback and FPS preview.
Edge cases: scrubbing freezes playback; in-place loops are labeled; responsive
controls remain usable. Static reference specimens are explicitly unrigged.
Failure: loading errors show retry; context loss pauses with recovery guidance.

## Numbers

| Value | Purpose |
|---|---|
| 17 specimens / 14 clips | Complete current demo/reference catalogue |
| 0.62 / 0.64 / 0.76 s cuts | Quick cross-cuts and a heavier overhead cut |
| 0.45 / 0.44 m arm segments | Fixed analytic articulation without stretching |
| 2.4 weapon pigment scale / 0.22 world | Fine held detail; preserved world paint |
| 24 burst / 24 ribbon slots | Bounded feedback allocation under sustained fire |
| 5 px click/drag threshold | Fallback attacks ignore intentional look drags |
| 1/60 s frame step | Inspect one animation frame without running simulation |
| 2048 x 2048 tower texture | Preserve original UV detail |

All eleven values for each screenshot are in arena-presets.js. These are
owner-provided comparisons, not new defaults. 1.3.1 remains immutable.

## Content

Units, towers, weapons, detailed references and environment miniatures.
Inspect selected unit clips and weapon actions. Trigger blade/plasma/beacon
feedback. Return to the meadow/canyon/ruin arena for actual travel and combat.

## Interface

Existing navy/mint tokens; opaque readable controls, system font, 44-pixel
controls, focus rings and keyboard canvas navigation. Catalogue, canvas and
inspector on desktop; scene above two control columns on phones. No decorative
UI motion. Reduced motion pauses exhibition playback.

## Build order

Presets and fallback click repair form the first end-to-end playable. Then fine
weapon materials and continuous cuts, shared effects/cannon detail, the catalogue
and temporal inspection, followed by regression and publication.

## Verification

Existing tools/qa-painted-lab.mjs runner: --asset-stage, --arena and --arena-live.
WH_BASE_URL chooses local/public; WH_NODE_MODULES supplies Playwright. Pure tests
check contact velocity and screenshot values. Actual mouse fallback input must
start a swing, drag must not. Sample all three complete cycles, then inspect
ordered rendered sequences. Frame samples do not establish subjective fluidity.
Check source hashes, closeups, all stage controls, pool stability, mobile layout,
saved-recipe preservation, full-round input, public identity and public browser.

Retained reproduction: denied cursor capture gave zero click swings but one J
swing in input-before.json. The previous release tested captured mouse input,
which did not cover this fallback. The clean control now rejects the old path.

## Decided

| Decision | Status | Evidence |
|---|---|---|
| 1.3.1 remains selected | in game | Unchanged archive and original preset |
| Screenshots are named overrides | in game | 48/48 local-final browser checks |
| No cursor capture still permits attack | in game | Retained before failure and real-click regression |
| Paintline guides future 2D art | not yet | Owner direction and loaded reference poster/plate |
| New animation/art feel accepted | partial | Owner review remains after measured checks |

## Task list

- U184 screenshot presets: implemented and browser verified.
- U185 sword input/animation: verified with all three full cycles and actual-input contacts.
- U186 close-up weapon detail: implemented and visually inspected.
- U187 stage/reference tower: implemented and browser verified.
- U188 regression and tracking: locally verified; public checks pending.

## Where we are

Local implementation is complete. Initial stage capture found a negative first
frame delta and an unequipped inspection rifle; both are fixed. The first ordered
cut review found excessive offscreen follow-through, so positions and angles were
revised to keep the cutting path readable. Arena regression passes 53/53 cases.
Final motion evidence passes; publication is pending.

### Production boundary

Current Aegis 3.18.3 animation/style-to-3D methods were read and verified against
upstream. Preserve collaborator methods and source provenance. Campaign art,
static-mesh rigging, physical-phone feel and owner animation acceptance remain
separate. A wrist-only velocity gate initially rejected a rotational downward
cut; the corrected probe checks both wrist translation and angular contact speed,
retaining every frame and rejecting the previous stop-at-each-key interpolation.

### Local acceptance

48/48 targeted browser cases, 53/53 arena regressions and 374 automated tests
pass. All three cuts land exactly once with real key input; all 121 sampled
poses per cut retain fixed limb lengths and visible blade geometry. Ordered
8-frame sequences were inspected: the revised cuts retain the blade through
windup, contact and recovery, unlike the preserved first review.

The real-time input recording uses position-assisted aiming, with no damage or
wave overrides: 15 kills across all three waves in 32.6 simulation seconds.
The separate motion video records all three cuts at 0.25x and 1x, rifle recoil/
venting and running. These recordings support owner review, not aesthetic approval.

Desktop Chrome / RTX 4080 Laptop, 1600x1000, render scale 1.25: arena p95 7.1 ms
over 300 frames; stage p95 27.7 ms over 120 frames. Physical-phone performance
is unmeasured; responsive 390/768/1600 layouts and overview label containment pass.
All 32 archived entry hashes and 20 frozen dependency/archive files match.
Aegis upstream was refreshed again before publication: f91aa9f / 3.18.3 remains
current. No collaborator implementation or reference asset was replaced.

### Retained failures

The first probe had a malformed range-input test value (.4 rather than 0.4),
corrected without changing product behavior. Initial stage snapshots exposed a
negative first-frame delta and an unequipped rifle; delta clamping and explicit
preview equip fixed both. The first cut sheet had offscreen follow-through even
though joint-length tests passed; full-cycle blade-visibility checks now cover
that gap. Overview screenshots also found clipped outer labels; aspect-aware
framing and compact phone labels now pass explicit bounds checks.
