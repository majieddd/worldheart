# Painted training ground: walkable style slice

Owner: Codex. Branch: feature/style-playground. U169-U171 published and publicly verified.

## Reference

Worldheart's owner-selected Hard Cel 1.0.0 and refined Atmospheric Ink 1.3.1.
Borderlands informs readable ink silhouettes and impact marks; the supplied
retro-anime references inform broad colored shadows and painted vegetation.
This is a small interactive art playground, not a campaign conversion.

## Pillars

Keep the selected contour and surface paint visible while moving. Animate with
actual articulated clips and continuous transitions. Tie every impact effect to
an attack event. Keep both treatments on identical content and controls.

## Core loop

Walk the meadow, sprint between landmarks, strike training targets and trigger
a pulse. Inspect cannon fire and moving characters, then switch style in place.
Reset the tableau whenever desired. No persistence, rewards or campaign state.

## Kit

One authored CC0 animated automaton with 14 clips, two skins, four skinned hand primitives and face
morphs (Quaternius / Tomás Laulhé, three.js RobotExpressive distribution).
Three preserved detailed reference models: commander, cannon and invader.
The archived painted environment, pigment, engine and loader. Local procedural
world-space impact shards, expanding rings, dust and strike arcs.
Manifest: `lib/playground/provenance.json`; original asset credits stay alongside.

## Concept

Approved visual reference: `HARD-CEL-CANDIDATES/public-valley.png`.
Refinement reference: `HARD-CEL-CANDIDATES/atmosphere-1.3.1/public-valley.png`.
New animation specimen uses the same material factory, cel ramp and contour.
Review the moving render before accepting the integration.

## Mechanics

### Movement and camera

Purpose: inspect the environment and animated character at walking scale.
Experience: smooth acceleration, turning and follow camera with free orbit.
Inputs: WASD/arrows, Shift sprint, right drag orbit, wheel zoom; touch stick/look.
Outputs: grounded movement and crossfaded Idle, Walking or Running clips.
Edge cases: blur clears inputs; diagonal speed is normalized; obstacles block.
Failure: missing assets show retry guidance; reset recovers position and camera.

### Strike and pulse

Purpose: demonstrate authored attacks and matching illustrative impact feedback.
Experience: anticipation, contact flash, target recoil, dust and quick recovery.
Inputs: primary click or J strike; E pulse; Space jump; equivalent touch buttons.
Outputs: one hit per contact event, target stagger, pooled physical effects.
Edge cases: repeated inputs are bounded by action recovery; empty swings remain visible.
Failure: out-of-range attacks miss without hidden damage; targets recover for reuse.

### Style comparison

Purpose: compare the same live tableau in the two chosen treatments.
Experience: immediate change with camera and animation phase retained.
Inputs: Hard Cel and Atmospheric Ink buttons; pause and reset controls.
Outputs: original 1.0 or revised 1.3.1 materials across world and animated meshes.
Edge cases: reduced motion suppresses decorative shake; pause freezes all actors/effects.
Failure: context loss pauses and shows recovery rather than accepting invisible input.

## Numbers

| Value | Number | Rationale |
|---|---|---|
| Character height | 2.4 world units | readable alongside the existing 3.1-unit commander |
| Walk and run | calibrated from stance motion | match visible foot movement to travel |
| Clip crossfade | 0.18 seconds | smooth transitions without long input lag |
| Strike reach | 3.1 units | contact zone fits the enlarged hands and effects |
| Pulse radius | 5.5 units | clear local feedback without filling the entire valley |
| Effect pool | 160 slots | bounded allocation during repeated combat |
| Play area | 40 by 40 units | enough traversal while keeping the painted landmarks close |

## Content

Meadow approach, stream crossing, crystal court and cannon range. Detailed
commander stands at the court; animated automaton is controllable; invaders are
training targets with hit/death recovery. Cannon demonstrates timed fire and recoil.

## Interface

Full-height scene with compact dark header, two style buttons, controls, pause,
reset and screenshot. Bottom status names the current action and nearest target.
Touch movement pad and actions appear on coarse-pointer devices.

## Build order

1. Load the rig and run a moving, attack-capable character through the meadow.
2. Bind both treatments to articulated meshes and contour deformation.
3. Add contact-timed feedback, targets, cannon example and touch controls.
4. Review temporal captures, run input/animation tests, publish and verify.

## Verification

Use actual keyboard, pointer and touch events. Record frame sequences of walking,
running and striking; inspect poses over time, clip transitions and loop behavior.
Measure skeleton movement, ground travel, pause, attack contact count, allocations,
style preservation, load failure and context recovery. Keep desktop performance
separate from physical-phone acceptance. A still screenshot does not verify motion.

## Decided

| Decision | Status | Evidence |
|---|---|---|
| Preserve 1.0 and use refined 1.3.1 | in game | Candidate lab public evidence |
| Authored animated specimen | in game | Pinned source, full-cycle metrics and ordered rendered sequences |
| Walkable scene and combat feedback | in game | 35 live-input, rendering and recovery checks |

## Task list

- U169 animated movement and attack specimen: published.
- U170 authored feedback, comparison and touch interaction: published.
- U171 temporal/runtime/public verification: complete.

## Where we are

2026-09-15. Aegis 3.18.2 is installed and its current animation, preservation,
design and blueprint methods are used. The kit is pinned before implementation.
The original commander/invader/cannon remain static source assets; the new
automaton supplies real authored skeletal clips without claiming AI rigging.

## Verification record

35/35 local browser cases pass, with a continuous real-input motion recording,
ordered walk/run/punch renders and full-cycle pose measurements. Rendered sequences
were inspected in order: limbs articulate, weight moves through the hips, ink
tracks the meshes, movement crossfades into sprint and jump, and contact precedes
target recoil and pulse expansion. This is a stylized automaton, not a claim of
human mocap or final owner acceptance.

Walking and Running contain 120/120 moving sampled frames. Their wrap deltas are
1.257 and 1.000 times the median frame step. Stance-calibrated ground speeds are
1.767 and 2.248 world units/s; sprint plays Running at 1.3x for 2.922 units/s.
No limb retargeting or source-clip editing was needed.

The 840-frame local native Chrome / RTX 4080 Laptop sample measured 7.0 ms median
and 13.9 ms p95 between frames. This is a bounded desktop observation. Touch
controls pass in browser emulation; physical phone performance remains untested.
The demo uses one WebGL context, 160 reusable particle slots and 14 reusable rings.

364 core tests, 120 parsed modules, house style, 203 generated mirrors and the
22-check preserved-candidate identity gate pass. No campaign code/save access is
introduced. Same-frame Hard Cel and Atmospheric Ink comparison keeps actor pose
and position fixed. Failed model load and graphics-context recovery are tested.

### Failures retained and resolved

The first pass expected two skinned primitives, but the two source skins are
partitioned into four hand primitives in the loader. The assertion now checks
the observed four. The diagnostic pose sampler retained a locomotion timeScale;
resetting effective weight/timeScale and fading state fixed the measurement.
Quaternion normalization was required for a copied frozen pose to have zero
angular delta. The same detector now rejects the frozen control. No source
animation was changed to satisfy these checks.

Repeated FX initially uploaded separate ring geometry for each pool member.
All rings now share geometry, and the allocation check passes. The first and
second failed result files remain alongside the green evidence. An early RAF
timestamp can precede post-load initialization; elapsed time is clamped at zero
so startup cannot step the animation backwards.

### Current Aegis installation

3.18.2+codex.20260916003956 includes upstream b2df3e0, including the collaborator
ledger restoration, plus the existing production-feedback branch cb14a65.
All 320 installed files match the integrated source. Portable doctor: 8/8.
The collaborator checkout and pending PR #2 were retained. Current animation,
style preservation, blueprint and interface methods were read directly from
the current installation; new conversations load updated skill/tool definitions.

### Reproduce and continue

Run the normal static server, open style-playground.html, and use WASD, Shift,
Space, J/click, E and right-drag. The three field-station buttons reposition the
player for meadow, stream and cannon examples. Both material recipes stay tied
to the original candidate registry.

Run `node tools/qa-painted-lab.mjs artifacts/playground --playground` with
WH_NODE_MODULES pointing to Playwright/Sharp. Set WH_RECORD_MOTION=1 to also
record real-input motion; set WH_BASE_URL for public verification. The existing
harness owns the probe. Evidence is in STYLE-PLAYGROUND/ beside this document.

Final UI follow-up passes: minimum measured text contrast 5.99:1, P resumes
after clicking Pause, and movement works immediately after a style-button click.
The existing candidate comparison also passes all 61 regression cases.

Publication integration merges feature a7d1c79 with collaborator preview 2335642
in a separate integration/style-playground-v2 worktree. The artist PR #53 stays
scoped to the slice. Homeworld source files are retained byte-for-byte; generated
bundles are rebuilt from the combined tree. No shared history is rewritten.

Combined preview verification: 369/369 tests, 120 parsed modules and 203 mirrors pass. Homeworld js/css/tests are unchanged from 2335642, and playground source is unchanged from a7d1c79.

## Public closeout

Runtime 060c78c806f2ad17fed76a4951797b553d3beb09 passed
[Pages action 35041945537](https://github.com/majieddd/worldheart/actions/runs/35041945537).
[Open the playground](https://majieddd.github.io/worldheart/v2/style-playground.html?style=v1).
Feature review remains [PR #53](https://github.com/majieddd/worldheart/pull/53),
stacked on #51; integration includes the separate Homeworld work in #52.

35/35 public browser checks pass, including measured AA contrast, actual keyboard,
pointer and touch controls, authored full-cycle animation, attack events, GPU
allocation bounds, failure recovery and context restoration. All 240 public/source
identities match. Public native desktop p95 was 14.0 ms over 840 sampled frames.
Physical-phone feel/performance and owner approval of the new specimen remain open.
The original Hard Cel candidate and production main 1374122 remain unchanged.

This evidence closeout does not change runtime 060c78c. Public results, animation
metrics, performance, identities and selected renders are saved beside local
motion video, ordered sequences and the retained failed diagnostic passes.
