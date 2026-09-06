# Commander and nest feedback intake

Owner follow-up, 2026-09-06. These are user reports and requested behavior,
not independent reproductions. The original blind observations and U01-U21
intake remain unchanged. Tracker: [#19](https://github.com/majieddd/worldheart/issues/19),
under [#1](https://github.com/majieddd/worldheart/issues/1).

| ID | User report and requested outcome | Existing milestone | Acceptance |
|---|---|---|---|
| U22 | Checkpoint overlay covers tower controls; put clickable Upgrade/Sell UI over the selected, hovered or looked-at tower, including first-person commander mode | M1 / M5 | Actual mouse and keyboard interactions, pointer-lock handoff, range validation and no checkpoint overlap |
| U23 | Sword arm is too skinny; prefer a fuller Minecraft-inspired blocky arm. Third-person swings look finicky and need repair | M1 / M4 | Before/after arm and timed swing poses, shared attack timing and uninterrupted movement/attack transitions; owner feel review |
| U24 | Commander collides and snags too often while running | M3 | Measured movement against identical obstacles before/after; preserve real blocked terrain, tower footprints and valid routes |
| U25 | Inspect hovered/looked-at loot before pickup, with Borderlands-like comparison, actual weapon model preview and pickup/equip choices | M4 | Preview/stat identity, deliberate pickup/equip, compatibility/full-bag feedback and no accidental combat input |
| U26 | Enemies emerge only from visible nests; waves use surviving nests, some waves introduce new nests, destroying them reduces enemy buildup | M5 | Exact physical spawn origins, destroyed/all-destroyed sources, guardian, ground/flyer routes, settlement and retry coverage without hidden fallback spawns |
| U27 | Show path lines when controlling/ordering units | M1 / M3 | Display the actual route and update/remove it on orders, arrival, death, possession and navigation changes |

The owner explicitly requested one parallel agent at extra-high reasoning.
`feature/commander-feedback` owns these six changes in a separate worktree;
the parent on `feature/ocean-strategy` continues ocean strategy QA and owns
integration, shared ledgers and V2 publication. The nest request supersedes
the earlier campaign wave-source behavior. Four classic map modes retain
their existing wave rules. User-visible nest wake timing is a prototype
tuning decision, to be recorded with the implementation evidence.

Changes progress from active to implemented-awaiting-verification, verified
and published separately. The same earned ocean checkpoint must be tested
again under new nest rules; an old-rule defeat cannot establish new balance.
Publication follows [PREVIEW.md](../PREVIEW.md), without merging gameplay
into main. Usage is unmeasured.
