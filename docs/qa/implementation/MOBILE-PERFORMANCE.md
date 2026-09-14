# Mobile performance and control polish

Owner request, 2026-09-14. Owner: Codex. Branch: `feature/mobile-performance-polish`, based on V2 `102d4a5` plus its documentation closeout. This feedback supersedes the prior touch button sizing acceptance, while retaining its mechanic parity requirements.

| Item | Status | Acceptance |
|---|---|---|
| U132: diagnose and optimize runtime | Verified, bounded browser evidence | Native and CPU-constrained combat profiles; 38.1% lower p95 delay, same median under 4x slowdown; original visual settings retained |
| U133: Roblox-style thumb controls | Verified in touch emulation | Floating stick, larger jump/combat actions, named skills and recovery queue, both orientations and handedness |
| U134: adversarial touch and gameplay QA | Verified | 125 touch cases, 334 automated tests, 180 route comparisons, seven camera suites, weather and ten-wave defense/extraction |
| U135: V2 publication and handoff | Published and publicly verified | V2 `309aaa7`, successful Pages action, 125 public touch cases and 286 identity comparisons; main remains `1374122` |

## Scope and evidence

The prior calm desktop touch-viewport benchmark is not a physical mobile or heavy-combat performance measurement. This pass measures actual rendered frames under repeatable load and distinguishes browser CPU slowdown from phone hardware. Physical Android/iOS thermal and GPU acceptance remains an explicit gap unless measured on those devices.

The control direction retains Worldheart's navy/cyan HUD. Larger thumb actions and a floating stick replace small fixed targets. Inventory, construction, recovery and squad tools remain contextual drawers. Game balance, content, enemy counts and authored visual settings are not a performance shortcut.

References: Roblox's [thumb zones and context-based UI](https://create.roblox.com/docs/building-and-visuals/ui/positioning-and-sizing-guiobjects), [touch shooter controls](https://create.roblox.com/docs/tutorials/curriculums/user-interface-design/implement-designs-in-studio). These inform reach and placement, not copied artwork.

[Acceptance and durable evidence](MOBILE-PERFORMANCE/ACCEPTANCE.md), [draft PR #42](https://github.com/majieddd/worldheart/pull/42). Implementation, verification and publication are separate states.

## Published implementation

- Pathfinding: finite-edge weak regions reject cliff-separated destinations; point searches use generation stamps instead of clearing 415,081-node buffers. A bounded cache copies exact node-pair routes and invalidates on navigation revision. Directed costs and full heart fields remain authoritative.
- Rendering: terrain sectors share original vertices and materials. One visible instance batch per scenery type retains source identities, matrices, colors and shadows. Full-globe views use the original submissions. Crushing and quake changes synchronize before render. Conservative feature bounds cull offscreen particles without stopping their gameplay.
- Inspection: world picking tests nearby object bounds before evaluating expensive terrain occlusion. Hidden desktop nest markers do not update on touch. Touch status labels avoid redundant text replacement.
- Controls: 136px floating thumb pad, 84px Jump, 80px Attack, 80x72px named skills, 64px Aim/Swap. Ability identities persist through cooldown. A single queued Power activation waits for legal recovery while held attacks yield; menus and control loss cancel it. Lobby movement uses the same floating stick.

Final visual ablation: close and regional scenes submit 20.5% and 12.4% fewer triangles respectively, with a maximum 7/255 channel difference in the final five-view comparison. Only three regional-view channels differed by more than 2/255; the other four views differed by at most 1/255. Whole-planet submission is unchanged. This is a bounded same-frame comparison, not universal visual or hardware acceptance. An earlier strategy saved more triangles but increased draw calls and made median frames worse; it was rejected and replaced.

Retained investigation: an initial touch test sent the remaining finger IDs to CDP's release event, which releases the supplied IDs. It lifted movement/fire instead of the skill finger. The corrected driver verifies independent release and actual queued activation. The prior one-step steering probe was also changed to a timed native drag, preserving its direction assertion.

Remaining acceptance: real Android/iOS touch feel, GPU and thermal behavior. The 4x CPU stress fixture still misses the absolute smoothness budget despite reducing long delays. A pre-existing `terrain=alpine`, automatic-theme seed 12345 generation failure reproduced with the previous reference modules; it is separate from this optimization. Route tests now hold the planet theme fixed and explicitly preserve layered endpoints.
