# Mobile controls and readable touch UX

Owner: Codex. Branch `feature/mobile-controls`, based on verified V2
`67e14d0` plus its documentation closeout `f427ea3`. September 13, 2026.
Tracker #1. Scope: every existing player mechanic accessible by touch, with
contextual controls and unobstructed aiming/strategy space. Preserve desktop
controls, campaign rules and the existing visual direction. Publish only V2.

| Item | State | Acceptance |
|---|---|---|
| U126 Input ownership and touch gestures | Active | Simultaneous movement/look/action, pointer cancellation, backgrounding, resize, modality and hybrid mouse use without stuck inputs or phantom taps |
| U127 Commander and expedition controls | Planned | Analog move, look, attack, aim, jump/flight, sprint, abilities, weapon switch, mounts, rally/dismiss, interact, release and return to base without keyboard |
| U128 Strategy and construction | Planned | Globe pan/pinch/orbit, deliberate placement preview/confirm/cancel, tower upgrade/sell, unit selection/orders/patrol, base upgrades and crystal deposit |
| U129 Compact responsive HUD and menus | Planned | Safe areas, portrait/landscape, readable health/waves/resources, contextual actions, scrollable inventory/customization, rewards/endless/extraction/save/settings |
| U130 Lobby and inspection touch parity | Planned | All preparation stations, commander/mount/loadout choices, roll/launch, world generator and Debug World accessible on touch |
| U131 Adversarial QA and V2 publication | Planned | Real browser touch interactions, full defense/extraction, desktop/classic regressions, responsive geometry and performance evidence; verify deployment identity and public behavior |

The existing HUD is being adapted, retaining its navy/cyan primitives. Thumb
controls appear only during direct control. Secondary tools live in one menu;
building and world interaction use small contextual strips. No gameplay rule
is relaxed to accommodate touch. Physical phone testing is distinct from
browser mobile emulation and will not be claimed without device evidence.

Evidence, action inventory, retained failures and acceptance will be appended
here during implementation. Full 99-planet and multiplayer acceptance remain
in the broader roadmap.
