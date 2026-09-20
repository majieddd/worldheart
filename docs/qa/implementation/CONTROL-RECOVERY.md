# U272: focused control and construction recovery

Owner Codex, branch `fix/controls-wall-performance`, base `81ba928`.
Status: implemented and locally verified; V2 publication recorded on tracker #1. Preserve usage with targeted existing checks and no subagents.

Scope: Space jump; tutorial cursor capture; restore prior UI font/color while
retaining simplified weapon cards; crosshair button hover/click; wall placement
latency and shared hotbar; stronger elevation range advantage. The owner withdrew the unfinished "Lift up the" item.

Acceptance: real keyboard/pointer-lock inputs, consecutive upgrades, wall
placement timing and finite breakable routes, desktop/touch hotbar, and measured
range comparison. Publish V2 only, preserve main and saved geography.


## Evidence and behavior

- 37 opening/desktop/touch checks pass, including real Space input, actual
  browser pointer capture at arrival, highlighted crosshair upgrade and retained
  capture after purchasing. Button alignment in that purchase check is a fixture.
- 12 construction/chest/touch checks pass. Two snapped placements plus their
  validation take 11.6 ms in this local run; route completion is checked separately.
  This is not a physical-phone timing measurement.
- Route rebuilding runs on private output buffers in roughly 2 ms frame slices.
  The prior complete field stays active, wall collision/breaching remains live,
  and concurrent tower/terrain changes invalidate the pending job. Completed
  fields swap together; frequent wall edits replace pending work.
- Wall selection lives beside towers. J selects on desktop; the existing touch
  wall card remains beside the tower cards. Wheel and R rotate.
- Space jumps; F remains interaction. Story confirmation captures the pointer
  inside the user's click. Tips never automatically borrow it; T deliberately
  opens the guide cursor. Press 1 to build during the locked tutorial.
- The prior Inter/Chakra palette cascade and blue weapon-card styling return;
  three-stat cards, emoji and expandable details remain.
- A five-metre emplacement gives 20% extra horizontal reach; this grows to
  100% at 25 m. The spherical range still accounts for vertical distance.
  Six traversal tests pass, including this threshold, monotonic growth and caps.
- 181 modules parse; house style passes. The first browser attempt exposed a
  test-driver hit-test conflict with genuine pointer capture; the fixture now
  sends a real mouse click rather than demanding DOM hit-testing of the canvas.

Reports: [opening](../control-recovery/opening.json),
[construction](../control-recovery/construction.json),
[retained first attempt](../control-recovery/first-attempt.json).
