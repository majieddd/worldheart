# Worldheart / 99 Planets To Defend: request intake

Captured 2026-09-05 before repository inspection. This file is not supplied to the blind tester. These are user requests and planning questions, not observed defects or implemented features.

## Session deliverables

1. Astra performs a blind 99 Worlds attempt using only the shipped interface and records QA notes.
2. Freeze that record before inspecting source or collaborator documentation.
3. Study repository architecture, rules, gameplay, creative direction, roadmap, and CI.
4. Revisit the blind findings with source knowledge, identify missed coverage, and run targeted checks where practical.
5. Publish a concrete development plan and a clean progress record on GitHub.

## Requested direction and acceptance topics

| ID | User requirement | What the plan must settle or test |
|---|---|---|
| U01 | Center the game on 99 Worlds and eventually rename it 99 Planets To Defend | Campaign structure, migration of existing saves and links, what happens to other modes, a full 99-world completion gate |
| U02 | Natural, fluid camera | Camera modes, transitions, terrain collision, clipping, frame-rate independence, input latency, reduced motion |
| U03 | Fix commander POV with the rectangular sword arm | First-person and third-person weapon/hand silhouettes, clipping, proportions, attachments |
| U04 | Improve commander, enemy, tower-targeting, and other motion | Locomotion, turning, aiming, attack anticipation, active frames, recovery, hit response; gameplay timing remains authoritative |
| U05 | Fix graphical artifacts on tree and bush polygons | Reproduce at multiple view angles and distances; isolate geometry, normals, transparency, depth, culling, and terrain intersection causes |
| U06 | Dynamic choreographed combat inspired by Dark Souls, with red strike areas | Readable attack phases and ground telegraphs that match actual damage areas; maintain the requested constant-action pace |
| U07 | Improve models while preserving the simple, light, fun aesthetic and satisfying feedback | Retain silhouettes/palette; improve pose, joints, material consistency, hits, drops, reward readability and performance |
| U08 | Commander inventory and occasional enemy weapon drops | Ownership, capacity, equip/swap, compare, pickup clarity, persistence, deterministic generation, overflow/loss rules |
| U09 | Borderlands-inspired diversity/customization, initially melee and ranged weapons | Bounded weapon families and modular parts/affixes; meaningful mechanics rather than only stat multipliers; avoid unbounded art and balance scope |
| U10 | Weapons progress ancient to science fiction to ancient-looking empowered/glowing forms | Data-driven era progression, distinct silhouettes/effects, carryover rules, readability and performance budgets |
| U11 | Much greater terrain height/scale variance including Everest-like peaks | Relative player/world scale, traversability, camera, world generation safety, meaningful high-ground tradeoffs |
| U12 | Canyons with equivalent depth variation | Connected routes, escape routes, spawn/base reachability, bridge/choke opportunities without softlocks |
| U13 | Oceans with swimming and movement slowdown | Shore/deep-water transitions, navigation cost, swim animation and combat rules; clarify who can swim |
| U14 | Spherical tower range display | Render the actual gameplay volume, agree on distance/line of sight, terrain occlusion and target validity |
| U15 | Towers on raised terrain; only ice towers on cold terrain and mortars on hot terrain, with bonuses | Shared terrain classification, explicit placement feedback, surface stability, tower/terrain compatibility and bounded bonuses |
| U16 | Flying creatures clear most mountains but route around extremely tall ones | Flight ceiling, clearance, altitude-aware pathfinding and obstacle avoidance with no terrain intersection |
| U17 | Build circle expands only by base upgrades or commander-delivered crystals used to upgrade the base | Remove unrelated expansion triggers, make crystal deposits/upgrades explicit, prevent duplicate deposits, preserve delivery risk and recovery |
| U18 | Modest uphill slowdown for commander/ground units and pathfinding awareness | Shared slope cost for movement/navigation, downhill behavior, extreme slope limits and route choice |
| U19 | Constant action and eventual PvPvE galaxy expansion | Establish single-player fun first; deterministic systems, ownership/event boundaries and save versions prepare future networking |
| U20 | Eventually package for platforms such as Roblox and Fortnite | Separate platform-independent rules/content from rendering/input/persistence; future port feasibility is a separate gate |
| U21 | Keep progress cleanly tracked on GitHub for collaborators | One entry point, linked evidence and issues, statuses/owners/dependencies, acceptance criteria and same-session updates |

## Evidence conventions

- Blind observation: visible in the unmodified public build before code inspection.
- Source finding: supported by an identified commit/file, not proof of runtime behavior.
- Targeted reproduction: later check with exact environment, inputs and output.
- User report: supplied above and retained even when not reproduced.
- Proposal: a recommended future behavior, never described as current behavior.
- Untested: no claim of pass or fail. A full campaign claim requires actual terminal-state evidence.
