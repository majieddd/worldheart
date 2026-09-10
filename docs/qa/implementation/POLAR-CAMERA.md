# Polar camera navigation, September 10

Owner: Codex on `fix/polar-camera-navigation`, based on preview `bdd7c81`.
U32 / [tracker #1](https://github.com/majieddd/worldheart/issues/1) /
[M1 #3](https://github.com/majieddd/worldheart/issues/3).
Status: implemented, published and live-verified at [V2](https://majieddd.github.io/worldheart/v2/).
[PR #28](https://github.com/majieddd/worldheart/pull/28) is stacked on PR #27.
Gameplay source `95f838f37ed61e900e3e7a34cb828baa806d7b60` was published by
[deployment 34447445692](https://github.com/majieddd/worldheart/actions/runs/34447445692).
Documentation-only follow-ups preserve this tested runtime. Main remains `1374122`.

## Report and reproduction

The owner reported arrow-left movement jumping to another side, unstable rotation
and difficulty looking directly at a pole. The owner's exact saved seed was not
provided. This is targeted, source-informed browser QA, not a repeat blind run.

On unchanged source `bdd7c81`, the real browser arrow-key listener reproduces a
168.8-degree camera orientation jump in one 60 Hz frame near northern latitude
70.05 degrees, even though focus moves only about 0.18 degrees. `_placeCamera`
switches its reference axis abruptly at `abs(focus.y) = 0.94`. Which apparent
direction triggers it depends on the player's yaw. A separate `latClamp = 1.42`
fence stops pan/flyTo 8.64 degrees short of either pole. A north-pole fixture also
stalls entirely under ArrowLeft. Seven of the eight initial regression cases fail.

Both mechanisms are present in `origin/main:js/camera.js`; the modular terrain
update did not introduce these camera branches. This proves a coordinate-dependent
camera defect, but does not identify the owner's unsupplied spawn or save.

The fixture uses `?map=ninetynine&campaign=0&seed=12345`, actual generated seed
36102. Its natural heart is at latitude 13.06 degrees. Polar tests relocate only
the rig and a test confinement cap, using the real height/picking field. Exploration
fog and cloud cover are hidden only for those captures, then restored for actual
spawn testing. No world generation, gameplay barrier or spawn is moved by the fix.

## Repair

- Carry heading and tangent velocity through the same rotation as the focus.
  Longitude is a coordinate for inspection, never a velocity or orientation seam.
- Differentiate the terrain drag solver in two tangent directions, so it remains
  solvable at a pole. Bound drag correction and retain terrain eye clearance.
- Integrate release damping by elapsed time. The legacy `velLon`/`velLat` handles
  now represent local east/north angular velocity; existing zero/reset consumers
  remain valid.
- Remove the latitude fence from pan, intro and focus flights. Travel along a
  great circle while carrying heading; complete and skipped flights agree.
- Use surface heading for camera up. Radial up was singular when terrain
  visibility requested an exact overhead view.
- Enforce the real battlefield cap with a rotation that remains finite at an
  antipodal starting focus. This does not expand the player's territory.

The player's FOV, zoom range/speed, pitch and reset controls are unchanged.
R explicitly resets heading and tilt; normal panning preserves orientation along
the curved surface instead of repeatedly aligning to geographic north.

## Evidence

Durable records are in [POLAR-CAMERA/](POLAR-CAMERA/).

- `before/results.json`: eight original browser cases, seven failures retained.
- `local/results.json`: 16 browser cases pass. Both seams/poles, exact focus,
  polar terrain drags, release drift, near/far rotated arrow movement, confinement,
  Return to heart and real-spawn movement after Q rotation and wheel zoom.
- Same northern seam sweep: maximum orientation change falls from 2.946 radians
  to 0.003183 radians per frame, about 168.8 to 0.183 degrees.
- Polar middle drags hold the original ground anchor within 0.01 pixels; actual
  DOM pointer events drive the solver, and release velocity decays to zero.
- `tests/shell/camera-poles.test.mjs`: six tests cover 30/60/120 Hz crossings,
  frame-independent pole-crossing inertia, exact focus/date-line flights, polar
  and antipodal confinement, overhead yaw, and skip/complete intro agreement.
- `maps.json`: all five maps boot and pass the existing camera harness, including
  terrain grab behavior, zoom endpoints, viewport rays and frontier confinement.
- `ownership.json`: 16 camera/possession checks pass, including refused pointer
  lock fallback, input ownership, paused views and reduced-motion preferences.
- `tests.txt`: 257 tests pass. All 53 modules parse, house style passes, 55 modules
  are bundled and all 58 generated source mirrors match.
- `legal/run.json` and `legal/arrival.json`: fresh legal 15-wave victory, 24 heart
  health, 545 kills, eight towers, 12 nests destroyed and zero controller stalls.
  Commander finished at 1296.43/1400 HP, and 13 weapons arrived on planet 2.
  Real purchases/cards/placements, no injected waves/resources and no runtime faults.
  Sparse rendering makes this campaign smoke evidence, not a camera feel/FPS test.

Browser frames are deterministic and sparsely rendered. Screenshots were inspected
alongside pose/error traces; these are not human feel or performance-budget claims.

Public V2 passes the same 16 polar/input cases with no browser faults. The public
record is [public/results.json](POLAR-CAMERA/public/results.json).
[Public identity](POLAR-CAMERA/public/identity.json) verifies all 95 preview/original
asset hashes plus direct source comparisons for camera/config, 97 checks total.
CI source checks, Pages build and deployment passed. Original main source and
root game bytes are preserved; no gameplay PR was merged.

## Corrections and limits

The first polar screenshots showed the real exploration cloud cover instead of
terrain because the inspection camera was outside the natural frontier. Pose
measurements were still valid; final inspection captures explicitly hide the
fog/cloud meshes and restore them before testing the actual spawn.

The first 30 Hz unit assertion required a sampled pose within 0.0038 radians of
the pole. One valid crossing straddled it by 0.0056 radians between frames. The
test now allows half of its separately bounded step and proves the meridian was
crossed; exact pole focusing has its own zero-error assertion. No movement limit
was relaxed to make the test pass.

This bounded camera repair is complete. Broader owner camera feel, CPU frame spikes, device coverage and full natural
campaign acceptance remain in the original tracker. No main merge. Usage unmeasured.

## Resume commands

```powershell
$env:WH_NODE_MODULES='C:\Users\Majied LaFleur\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node --test tests/shell/camera-poles.test.mjs
node tools/polar-camera-check.mjs artifacts/polar-camera/recheck
node tools/browser-regression.mjs artifacts/polar-camera/maps
node tools/camera-check.mjs artifacts/polar-camera/ownership
node tools/self-play.mjs 12345 artifacts/polar-camera/legal --campaign --planets=1 --weapons --strategy=assault --sparse-render
```

Use the current V2 workflow in `docs/PREVIEW.md`. For public polar checks set
`WH_BASE_URL=https://majieddd.github.io/worldheart/v2` before running the tool.
