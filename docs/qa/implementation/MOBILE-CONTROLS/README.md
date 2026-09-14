# Mobile control contract

September 14, 2026. Owner: Codex, `feature/mobile-controls`.
[Request and progress](../MOBILE-CONTROLS.md). V2 publication only.

## Action map

| Existing mechanic | Touch access |
|---|---|
| Start, commander, campaign/sandbox, talents | Start screen; optional World and game mode disclosure; preparation lobby |
| Globe navigation | One-finger drag to pan; pinch to zoom; two-finger drag to rotate/tilt |
| Commander focus and strategy return | Commander / Strategy button; outside-base link restriction still applies |
| First/third person | View button beside Commander |
| Walk, strafe, sprint | Analog left stick with dead zone and existing acceleration; Run toggle |
| Look, attack, aim | Drag the scene; hold Attack, or drag Attack to look while firing; Aim toggle in first person |
| Jump, flight, abilities | Jump / held Rise; Skill and Power with real cooldowns; flight energy beside health |
| Mounts and expedition economy | Menu > Base: ride/dismount, crystal deposit, base upgrade, scrap forge, finish Endless |
| Equipment | Swap during combat; Menu > Weapons for slots, native/basic attacks, parts, infusion, salvage and replacement |
| Nearby loot | Automatic bag collection preserves deliberate equip; Inspect loot shows the actual model and pickup/equip choices; full bag replacement stays in Weapons |
| Tower construction | Menu > Build, choose card, tap ground to preview, explicit Place / Cancel; commander view uses the ground crosshair |
| Tower upgrades and selling | Tap tower in strategy, or aim at it and Manage tower; first-person transactions return control immediately |
| Squad | Menu > Squad: roster Select/Control, box/select-visible, tap move destination, real dotted route lines, rally/dismiss, barracks patrol |
| Pause, settings, home view, speed, sound | Menu > Options; menus pause the solo battle and preserve an explicit pause choice |
| Rewards and victory | Scrollable draft/results; loot collection, return to results, Endless and normal extraction |
| Checkpoints | Menu > Base during play; Checkpoint and saves on the start screen and victory/defeat results; export, native file-picker import, retry/recovery |
| Lobby | Move stick, drag look, pinch zoom, tap-to-walk; Prepare opens commander/mount/foundry/mission stations |
| Debug World | One-finger orbit, pinch/two-finger pan; scrolling category strip; Exhibits and controls drawer |
| World generator | Collapsed inspection tools, touch world/formation selection, seed form, regenerate/play links |

## Input ownership

`js/touch-input.js` owns each canvas gesture and joystick pointer independently.
Multitouch cannot turn into a tap when one finger remains. Movement and attack
can be held together, and the attacking finger can steer aim. Capture loss,
cancel, resize, blur, hidden-page transitions, death and modal entry clear
held intent. Backgrounding pauses the solo battle. Touch possession never
requests Pointer Lock. Mouse and keyboard remain usable, and the saved setting
can restore the original desktop HUD on hybrid devices.

Buttons commit once on stationary release. The shared guard cancels scrolling
gestures and suppresses compatibility clicks, including clicks retargeted to
content behind a closing panel. Transactions remain in their existing game
handlers; the touch shell does not create resources or relax gameplay checks.
Menus use the original controls, temporarily reparented with restore points.
Preview preferences use the existing `whV2:` storage namespace.

## Design basis and evidence limits

The existing `DESIGN.md` direction is retained. Pointer capture and cancellation
follow [MDN Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
and [setPointerCapture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture).
Safe-area placement follows [WebKit's viewport guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).
The scene owns its gestures; overlays retain scrolling and form controls.

Acceptance combines native Chromium touch dispatch, screenshots and measured
layout, gameplay transaction fixtures, a complete legal defense/extraction,
classic camera regression and public identity checks. Targeted fixtures label
arranged actors/items and frozen waves. Native desktop GPU measurements at a
mobile viewport are distinct from physical Android/iOS testing. Full 99-planet
balance, multiplayer and physical-device performance remain broader acceptance
work and are not certified by this change.
