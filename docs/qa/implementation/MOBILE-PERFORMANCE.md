# Mobile performance and control polish

Owner request, 2026-09-14. Owner: Codex. Branch: `feature/mobile-performance-polish`, based on V2 `102d4a5` plus its documentation closeout. This feedback supersedes the prior touch button sizing acceptance, while retaining its mechanic parity requirements.

| Item | Status | Acceptance |
|---|---|---|
| U132: diagnose and optimize runtime | Active | Native and CPU-constrained combat profiles; before/after frame costs, unchanged gameplay and visual settings |
| U133: Roblox-style thumb controls | Active | Floating movement stick, larger reachable jump/combat actions, recognizable abilities during cooldown, both orientations and handedness |
| U134: adversarial touch and gameplay QA | Planned | Simultaneous move/look/fire/skills, pointer cancellation, transactions, sustained combat, complete defense, desktop and camera checks |
| U135: V2 publication and handoff | Planned | Green checks, draft PR, successful Pages action, public input checks and live asset identity; main preserved |

## Scope and evidence

The prior calm desktop touch-viewport benchmark is not a physical mobile or heavy-combat performance measurement. This pass measures actual rendered frames under repeatable load and distinguishes browser CPU slowdown from phone hardware. Physical Android/iOS thermal and GPU acceptance remains an explicit gap unless measured on those devices.

The control direction retains Worldheart's navy/cyan HUD. Larger thumb actions and a floating stick replace small fixed targets. Inventory, construction, recovery and squad tools remain contextual drawers. Game balance, content, enemy counts and authored visual settings are not a performance shortcut.

References: Roblox's [thumb zones and context-based UI](https://create.roblox.com/docs/building-and-visuals/ui/positioning-and-sizing-guiobjects), [touch shooter controls](https://create.roblox.com/docs/tutorials/curriculums/user-interface-design/implement-designs-in-studio). These inform reach and placement, not copied artwork.

Evidence and findings will be recorded here as measured. Implementation, verification and publication are separate states.
