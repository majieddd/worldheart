# M5C: terrain visibility while moving the camera

Owner: Codex, `feature/99-planets-visibility`, stacked on M5B PR #16.
Status: implemented and verified by instrumented checks and an unforced planet
win/extraction. Broader owner feel and whole-campaign release acceptance remain open.
The previous eye-clearance solve kept the camera outside the mountain under it,
but did not detect a ridge between the eye and its focus. That could hide the
heart even when it projected to the center of the screen.

The camera now probes its actual terrain sightline. When blocked, it finds a
clearer angle toward overhead while preserving requested zoom and focus. The
angle uses a critically damped response at rate 14 per second, about 99.3%
settled half a second after correction starts. Reduced motion applies it without
animation. Pointer drags and the first 120 ms after release freeze the correction,
preserving the ground anchor. The requested
pose caches its visibility result; a stationary view does not keep raycasting.
The existing eye-clearance and focus-centering geometry are retained.

This repairs center-focus occlusion. It does not make every unit visible behind
every ridge, remove terrain, or certify subjective camera feel. Broad framing,
owner continuous-input review and lower-end performance remain acceptance work.

## Measured checks

[Before](M5C/visibility-before.json) and [after](M5C/visibility-after.json) use
the same requested seed, focus, eight headings and three zoom distances per
profile. A pose is visible when the terrain ray does not hit more than 0.4 world
units before the focus. The production correction uses a 0.25-unit tolerance.

| Profile | Effective seed | Visible before | Visible after |
|---|---:|---:|---:|
| Highlands | 28183 | 22/24 | 24/24 |
| Deep canyons | 36102 | 24/24 | 24/24 |
| Giant peaks | 51940 | 19/24 | 24/24 |
| Ocean shores | 389884 | 24/24 | 24/24 |

The [giant-peak before frame](M5C/alpine-before.png) hides the heart behind a
ridge. The [same requested view after correction](M5C/alpine-after.png) shows
the heart and its foothold. Screenshots supplement the measured sightline.

All four profiles converge monotonically to the same correction at 30/60/120
FPS, within 0.00001 radians after half a second. Drag-framing values remain unchanged;
120 stationary updates issue zero visibility probes. [Sixteen camera/input
assertions](M5C/camera.json), [five map camera harnesses](M5C/regression.json),
[giant-peak terrain/placement/traversal checks](M5C/terrain.json) and
[207 headless tests](M5C/headless.txt) passed. These are instrumented checks,
not blind player or owner approval.
The [reduced-motion giant-peak pass](M5C/reduced-motion.json) also keeps all
24 poses visible and applies its correction immediately. The
[final source manifest](M5C/source-final.json) identifies the repaired camera code.

The [first final-regression attempt](M5C/release-drag-failure.json) caught a
41.96-pixel cursor slip just after release. The original exponential correction
started too quickly on that frame. The release hold and zero-initial-speed
response reduced the worst error to 0.34 pixels across all 64 rotated drag
cases, with the original eight-pixel acceptance threshold unchanged. The final
five-map regression passes. That failure is retained rather than overwritten.

## Performance and gameplay

The [60-second moving-orbit fixture](M5C/performance.json) used one hundred replenished enemies and
thirty normally validated towers at 1920x1080, DPR 1. Camera heading changed by
0.15 radians per second. On the recorded i9-13900H/RTX 4080 laptop, it produced
4,932 frames: 15 ms median, 16.2 ms p95, 23.2 ms p99, 39.6 ms maximum. Inverse
median/p99 frame times were 66.7 / 43.1 fps. Boot took 8.235 seconds. No faults
occurred, and pause/resume preserved simulation time correctly. This passes
the provisional budget on that hardware. The earlier stationary sample is a
different workload and is not a controlled before/after comparison.

The [fresh unforced planet run](M5C/natural.json) completed wave 15 at effective
seed 28183 with 1,340 kills, 25,900 score, heart 13, eight towers and commander
HP 1,400/1,400. Its 64-action trace includes crystal delivery, weapon pickup and
equipment. [Normal extraction](M5C/arrival.json) loaded planet 2's canyon world
with the same three weapons. [Terminal capture](M5C/natural.png) and
[resumable checkpoint](M5C/checkpoint.json) are retained. No resources, enemies,
waves or powers were injected; it is instrumented self-play with time advance.
No runtime faults occurred. Ocean-planet balance and full 99-planet natural completion remain
open in [M5B](M5B.md); camera visibility does not resolve those combat gates.
The performance and full-run captures predate the final release-hold timing
refinement; [their source manifest](M5C/source.json) is retained separately.
The final response timing is covered by the repeated five-map, fixed-pose,
frame-rate and reduced-motion checks.

## Reproduce

With the optional Playwright runtime and local server on port 8139:

```powershell
node tools/visibility-check.mjs artifacts/visibility
node tools/visibility-check.mjs artifacts/reduced --terrain=alpine --reduced-motion
node tools/camera-check.mjs artifacts/camera
node tools/browser-regression.mjs artifacts/regression
node tools/performance-check.mjs artifacts/performance --orbit
node tools/self-play.mjs 12345 artifacts/natural --campaign --weapons --planets=1
```

The performance fixture injects its load and is not natural play. The self-play
run uses legal purchases, placements, movement and equipment with time advance.
Neither result substitutes for a full unforced campaign. Usage is unmeasured.
