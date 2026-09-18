# First expedition / U240-U243

Owner: Codex. Branch: feature/first-expedition. Base: preview/v2 7db5236.

- U240: Opening typing, cinematic and four-panel story: implemented, awaiting browser verification.
- U241: Third-person arrival and action-based tutorial: implemented, awaiting adversarial verification.
- U242: Art direction second pass against 99-art principles: active. Existing reference is Painted-Anime-Inkline; painting, ink, material wear and rich shadow, not generic science-fiction rendering.
- U243: Responsive, save isolation, real input, contextual briefing and V2 deployment: pending.

Scope: new-player presentation only; no world seed or campaign inventory migration. Main remains unchanged. Existing assaults bypass automatic beginner flow. Replay opening from lobby; onboarding=1 enables explicit test/replay on a non-home 99 Planets route. Guide can be skipped without changing gameplay progression.

Acceptance: real desktop/touch layout and interaction, first wave held only during movement/attack/build lessons, no permanent lock after skip; actual actions advance objectives; late-game briefings checked in labeled fixtures. Preserve full failures and evidence. No claim of full campaign completion from fixtures.

Art provenance: first sheet generated with built-in image_gen from existing earth.webp reference; output exec-5d9e2708-f976-48a7-85ad-2059824a2743.png. Model identity not certified. Compressed WebP is a delivery derivative.

## Verification, 2026-09-17

U240-U243 locally verified; publishing next.

- 406/406 repository tests, 163/163 source modules parse, house style passes.
- 21/21 browser checks: typed opening, cinematic rendering, four-panel story, 390px layout, native touch replay/dismissal, real desktop movement/attack, third-person start, beginner wave hold and skip release, fresh campaign start and return without repeated lore.
- Instrumented fixtures use the production placement validator/placement, crystal ledger/deposit and base upgrade; late skill/boss/Endless/conquest/homeworld panels use staged state. These verify briefing integration, not a complete natural campaign playthrough.
- First mobile pass failed grid overflow; fixed intrinsic grid minimum sizing. Original failed report retained. A later reload probe incorrectly referenced WH before module initialization; corrected the harness to window.WH?.onboarding. That failure is retained separately.
- Visual inspection rejected the initial circular crop pretending to be a globe. Replaced with a real small Three.js Earth scene using the existing coastline sampler, a moving low-poly meteor and disposed scene resources. It does not generate a second playable world.
- Second art pass uses the actual principles-page Earth/Void reference, local Barlow typography, strong drawn contours and broad painted surfaces. First sheet remains in local artifacts; committed delivery is revision 2 with provenance.
- Mobile guide moved below camera controls. Initial commander offset uses a reachable node inside the base, keeping the camera out of the Worldheart crystal. Simulation and campaign schemas unchanged.
- Homeworld/worldgen entries bypass onboarding. Existing assaults without presentation progress are not retroactively gated. Presentation-only storage follows the same V2 namespace as existing saves. The UI supports skip, minimize, replay, keyboard focus and reduced motion.

Evidence: [browser report](../first-expedition/browser.json), [desktop story](../first-expedition/story-desktop.png), [mobile story](../first-expedition/story-mobile.png). Reproduce with WH_NODE_MODULES pointing to Playwright/sharp, WH_BASE_URL set to the server, then node tools/qa-painted-lab.mjs artifacts/first-expedition/recheck --first-expedition.

Remaining acceptance: owner review of art/pacing and physical-phone play. This does not claim a 99-world campaign playthrough. The introductory Earth is narrative; existing procedural first-planet recipes and saved seeds are preserved.
