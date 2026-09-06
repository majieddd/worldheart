# 99 Planets To Defend: running development blueprint

Owner direction captured 2026-09-05. Baseline: Worldheart `1374122`.
This is the plan for evolving the existing game around its 99 Planets mode.
Implementation is underway on feature/99-planets-integration. Start with the [QA evidence](qa/2026-09-05/README.md) and [progress ledger](PROGRESS.md). Proposed tuning below is a concrete prototype specification, subject to measured playtests rather than a claim of final balance.

## Reference

The owner's references are Dark Souls for committed, choreographed attacks with readable anticipation and recovery, and Borderlands for mechanically varied weapons and rewarding loot. Borrow those qualities without importing their artwork, names, grim visual tone, or a long inactivity-heavy combat cadence. No external reference research or asset selection was needed for this planning pass.

The distinguishing feature is a commander physically fighting and carrying resources across a curved strategic battlefield while player-built defenses protect an expanding base. The long arc is 99 defended planets, then connected PvPvE galaxies.

## Pillars

1. Every few seconds offer a useful action: fight, build, reposition, collect, return, equip or upgrade. Deliberate attacks still leave readable counterplay.
2. Terrain changes tactics, route choice and risk. Impressive peaks and deep canyons must remain legible from both orbit and a commander's height.
3. Preserve the light, simple, playful faceted aesthetic. Improve anatomy, pose, material consistency and impact feedback without increasing visual noise.
4. Rewards must visibly do what they promise. A rare drop, a delivered crystal and a defended wave should produce distinct, reliable feedback.
5. Prove each complete playable loop before multiplying content. Keep rules and content portable; networking and platform adapters come after the single-player experience works.

## Core loop

**Moment to moment:** read an attack tell or approach route, act with the commander or towers, land a hit, collect a reward, reposition. Strategic pause remains available in solo play.

**One planet:** establish a foothold, defend under nest pressure, venture out for crystals and weapons, return alive, explicitly upgrade the Worldheart to expand build territory, reach and defeat the planetary boss, bank progress, choose the next planet.

**Campaign:** carry an inventory and versioned expedition state through 99 planets with changing terrain, enemy behaviors and weapon eras. Defeat ends the current assault and retains banked account progression. The initial proposal keeps weapons already extracted from previous planets, loses unbanked current-planet loot, and offers a safe starter loadout. The UI must explain the stakes before departure.

**Long term:** add an authority-controlled shared galaxy with contested planets and co-op defense before competitive invasions. Carry forward learned rules, not an assumption that the current browser combat is already network-ready.

## Kit and asset vocabulary

The existing procedural kit is the starting manifest. No external art pack is selected in this batch.

| Class | Current count and source | Extension rule |
|---|---|---|
| Towers | 6 families, `js/towers.js` | Keep silhouettes and upgrade identity; inspect all authored marks and extended tiers |
| Allies | 5 commander archetypes plus Warden, `js/allies.js`, `js/soldier.js` | Keep faction/material cues; improve joint placement and silhouettes |
| Enemies | 5 species, `js/enemies.js` | Preserve species readability; give attacks distinct shapes/timing |
| Worlds | 5 selectable maps, `js/config.js`, `js/world.js` | Author campaign terrain profiles through the shared height field |
| Models and motion | `js/rig.js`, `js/viewmodel.js`, `js/soldier.js` | Reuse rig and shared strike timing; validate geometry before adding detail |
| Rewards | 20 powers, 13 talents in run/progress registries | Audit every consumer before expanding the catalog |
| Sound and effects | Synthesized WebAudio, `audio.js`, `effects.js`, `combatfx.js`, `post.js` | Separate hit, drop, deposit, upgrade and victory cues; bound simultaneous effects |

Use the existing cyan player energy, gunmetal machinery, warm heart, and magenta/obsidian enemy contrast as anchors. Ancient weapons can introduce shaped stone, bronze-like metal and cloth within these anchors; this deliberately extends the current "machined" creative direction. An empowered relic reads ancient by silhouette and extraordinary by controlled glow and behavior.

## Concept and visual baseline

This planning batch uses [live title/terrain](qa/2026-09-05/images/00-title.png), [battlefield](qa/2026-09-05/images/14-wave8.png), and [current Bulwark POV](qa/2026-09-05/images/26-bulwark-after-swing.png) as the visual baseline. They are observations, not approved new concept art.

Before a model/content batch, produce a comparison sheet of existing and proposed commander, enemy, weapon and foliage silhouettes at first-person, third-person and strategic distances. Include flat-shaded and final-lighting views. No new concept/coherence-sheet gate has passed yet. Do not hold basic reward fixes behind an art-production gate.

## Mechanics

### Camera and contextual controls

Purpose: keep orientation and targeting reliable while the player changes scale and control mode.
Experience: responsive input, smooth arrival, deliberate view changes and an obvious way home.
Inputs: mouse/keyboard, current mode, terrain/decor collision, desired zoom, reduced-motion setting.
Outputs: presentation camera pose, context-specific hints and selection focus; no simulation changes from smoothing.
Edge cases: paused zoom, interrupted portal flight, extreme peak, canopy, 180-degree turn, pointer-lock refusal, overlapping unit/tower, UI focus.
Failure: retain a valid collision-safe pose and restore input ownership. Add a distinct Return to heart action; R remains explicitly labelled Reset rotation. Prefer a breach ping over forced flight during active targeting. Provide separate bob, shake and automatic-focus controls.

### Combat choreography, models and feedback

Purpose: make moving, attacking and landing hits readable, dynamic and satisfying.
Experience: anticipation, committed active frames, impact and recovery; directional locomotion and towers that turn toward their actual target.
Inputs: authoritative attack start/direction/shape/timing, locomotion state, target, hit result, weapon definition.
Outputs: damage only on active frames, hit/miss events, red danger telegraph, corresponding pose/audio/particles.
Edge cases: target exits the shape, moving terrain-relative actors, interrupt/death, speed changes, pause, simultaneous attacks, large foes, first/third-person handoff.
Failure: cancel invalid attacks and remove their tell; never leave invisible damage or a stale red zone. Drive the telegraph and hit resolver from the same attack definition. Red is paired with border/pattern/timing cues; ground projection must not imply safety to a flying or elevated target inside a 3D strike.

Fix the current block-like Bulwark arm by reviewing attachment axes, elbow/wrist proportions and silhouette through the full arc. Inspect winding, normals and near-plane behavior before altering geometry. Extend the existing shared strike-frame rig rather than layering a second unsynchronized animation clock. Measure foot sliding, aim tracking, return-to-idle, cape/limb motion and hit readability before adding secondary motion.

### Terrain traversal and flight

Purpose: create large-scale spectacle and strategic route tradeoffs.
Experience: easy hills, imposing peaks, deep navigable canyons and slower ocean crossings.
Inputs: shared height/material field, slope, water depth, movement class, destination and flight envelope.
Outputs: traversable routes, slope/water-adjusted speed and movement animation; identical terrain interpretation by rendering, grounding, nav and placement.
Edge cases: shores, thin ridges, steep drops, canyon exit, flying dive under an overhang, mountain ceiling, seed retry, unit crowding.
Failure: choose another valid route or clearly reject the destination. Worldgen must guarantee heart/breach connectivity and accessible crystals; never strand essential content behind impossible terrain.

Use directed uphill edge cost in flow-field Dijkstra, since climbing and descending differ. Commander movement and AI use the same cost function. Swimmable ground actors enter a swim state at sufficient water depth; ground enemies and Wardens initially use the same rule, with explicit per-species opt-outs later. No drowning or oxygen meter in the first slice. Flying creatures clear ordinary terrain, but route around peaks exceeding their maximum radial flight envelope; they must not ride an unlimited terrain-relative altitude over every mountain.

### Raised placement, climate and spherical ranges

Purpose: make high ground usable while reserving extreme climate positions for appropriate towers.
Experience: a clear valid/invalid ghost, a useful sphere of reach and an understandable terrain bonus.
Inputs: stable surface footprint, frontier, shared terrain classification, tower family, nav reachability, actual attack origin/range/target mask.
Outputs: legal placement, explicit denial reason, one bounded compatible-terrain bonus, sphere/orbit outline and terrain intersection contour.
Edge cases: mixed footprint, summit slope, water, caves/canyons, range through the planet, Mortar minimum range, aura/barracks non-damage range, upgrade preview.
Failure: explain Too hot, Too cold, Too steep, Outside frontier or Blocks last path. Neutral high ground is legal when stable; only Mortar can occupy hot volcanic/black stone and only Cryo can occupy cold ice/blue-white stone. Apply a bonus once, using a declared terrain sample policy.

The initial policy classifies the footprint by its most restrictive covered material: any mixed hot/cold footprint is invalid. Mortar on hot gets +15% damage; Cryo on cold gets +10% slow strength with a global slow cap. A range sphere must depict the same 3D metric and origin used by targeting, including Mortar's inner exclusion. Show invalid target classes and line-of-sight restrictions separately. An aura or Warden leash must be labelled as such, not as damage reach. Preserve existing acquisition/retention hysteresis explicitly instead of silently presenting a false exact boundary.

### Crystals, base upgrades and expansion

Purpose: turn leaving the base and returning alive into the engine of territorial growth.
Experience: spot a crystal, make a risky trip, carry it home, deposit it, deliberately buy the next expansion.
Inputs: commander location, carried crystal IDs, deposit interaction, banked crystals/run gold, base level.
Outputs: an idempotent deposit event and upgrade transaction; only a successful explicit base upgrade changes frontier size or tower cap.
Edge cases: double input, deposit and death on one tick, full carry capacity, inventory open, pause, reload, max base level and old saves with wave-earned rings.
Failure: no duplicate resource or partial purchase. Insufficient funds show the shortfall. Deposit adds base credit and a clear receipt; it does not expand territory automatically. Defeat follows the declared run-loss rule.

Replace wave-earned rings with a base-level-to-radius table. Wave completion still pays/drafts rewards but cannot change the circle. Permit early gold-only upgrades so the first expedition is not a resource softlock; later levels can be paid with gold, crystals or a mixture via an explicit quoted price. The prototype converts one deposited crystal to 100 gold of **base-only upgrade credit**, never freely spendable weapon/tower cash. Carry up to three. Deterministically place reachable caches, with a small visible carry-speed tradeoff. Leaving the frontier keeps the existing risky base-control disconnect behavior, with a clear route-home cue.

### Weapon inventory, generation and customization

Purpose: give commander exploration and enemy kills lasting, mechanically distinct rewards.
Experience: occasional exciting drops, quick compare/equip, and a recognizable build with meaningful tradeoffs.
Inputs: deterministic drop RNG, enemy/planet tier, weapon family, compatible parts, rarity and commander loadout.
Outputs: unique item ID and serializable item data, a pickup, an inventory transaction and an equipped attack definition.
Edge cases: full inventory, duplicate pickup, attack in progress, death/transition, sold or salvaged equipped item, invalid imported part, old save, ranged ammo starvation.
Failure: leave a full-inventory drop visible with a replace/salvage action; never silently erase a valuable item. Equip commits between attacks. A basic melee fallback is always available. Use a separate RNG stream so cosmetic particles or drop rolls cannot change wave layouts.

Start with four families: sword, spear, projectile carbine and lobber. Support both melee and ranged loadouts without making every commander use every animation immediately: define compatibility and show it. Commander identities become handling/specialty traits as weapon choice expands. Two equipment slots and twelve carried items are the prototype. Weapon data contains family, era, tier, rarity, seed, compatible part IDs and affixes; keep rendering out of it. Start customization with a striking head/barrel, grip/stock and power core. Parts change reach, arc, cadence, recoil, projectile behavior or resource use with visible costs, not only additive DPS.

Use ancient, technological and empowered-relic art/behavior sets. The first content pilot shows all three in three representative planets; the provisional full campaign uses planets 1-33, 34-66, 67-99 for the era arcs. At a new era, preserve and upgrade favorite weapons through a bounded infusion path, so a lucky sword does not become instantly disposable. Keep rarity distinct from tier and era. No armor, trading or crafting economy in the first weapon slice.

### Campaign, persistence and endings

Purpose: make 99 planets an actual expedition with meaningful continuation and a final destination.
Experience: secure a planet, bank rewards, see a route map, land somewhere different and retain earned identity.
Inputs: planet index/seed/profile, terminal outcome, extracted inventory and next-world choice.
Outputs: versioned save checkpoint, one-time settlement, next planet state or a distinct planet-99 ending.
Edge cases: win/death race, duplicate victory, refresh mid-transition, storage failure, corrupt/old saves, defeat/retry, returning to an already completed node.
Failure: recover the last committed checkpoint without duplicate coins/items. Show a save-failure notice with export/retry. Build and play a two-planet continuation before creating 99 content entries.

Maintain separate account unlocks, expedition state and temporary assault state. Migrate `wh99Progress` with explicit versions and test fixtures; do not infer 99 completed unique worlds from the old counter. Keep stable internal map keys and existing shared URLs when the title becomes 99 Planets To Defend. Move classic modes to an accessible legacy/sandbox entry only after campaign parity and a measured regression pass.

## Numbers and tuning

All **prototype** numbers below require telemetry and playtesting. They are starting values with rationale, not existing game behavior.

| Value | Baseline or prototype | Rationale |
|---|---|---|
| Current planet | 15 waves; 20 lives; 450 gold | Verified current opening and source; retain while diagnosing reward/feel defects |
| Current base costs | 250, 450, 700, 1000, 1400 | Start with a known economy while replacing expansion triggers |
| Current tower caps | II, III, IV, V, VI, VII by base level | Preserve one-mark-per-upgrade readability initially |
| New frontier policy | Radius table keyed only by base level | Avoid hidden wave-earned territory and make purchase outcomes predictable |
| Uphill speed | Prototype smoothly falls to 80% on a moderate climb, floor 65% before impassable slope; no downhill speed boost initially | Modest local penalty plus detour cost, without frustrating controls or downhill exploits |
| Swimming | Prototype 60% of ground speed; no sprint | Noticeable route tradeoff without immobilizing actors |
| Terrain presets | Prototype peak prominence 4, 12, 40 commander-heights; canyon depth paired to profile | Relative scale communicates the Everest goal better than importing literal real-world meters onto a radius-240 planet |
| Flight | Prototype clearance 2 body-heights; radial ceiling chosen per terrain profile below extreme peaks | Common mountains can be cleared; extreme peaks remain meaningful obstacles |
| Climate bonuses | Prototype hot Mortar damage +15%; cold Cryo slow strength +10%, cap combined slow at 70% | Reward specialist positioning without unbounded stacking or permanent immobilization |
| Crystals | Prototype carry 3; 100 base-only credit each; carried load up to 10% movement penalty | Short risky excursions with a tangible base payoff; separate from weapon inventory |
| Weapon drops | Prototype ordinary enemy 2%, elite 10%, boss one guaranteed; distinct RNG stream | Occasional excitement plus a reliable milestone reward; measure per-minute ground clutter and pickup rate |
| Inventory | Prototype 2 equipped slots, 12 backpack items, 3 modular part slots | Enough comparison/build choice without an inventory-management-heavy first slice |
| Attack tells | Prototype light attacks 0.25-0.4s anticipation; heavy attacks 0.6-1.0s | Visible warning at 1X while retaining frequent action; adjust with dodge/counterplay measurements |
| UI motion | Transitions at most 300ms; dt-based interpolation and reduced-motion alternative | Responsiveness and accessibility; this is presentation guidance, not a cap on authored combat durations |
| Performance | Provisional 60fps median / 30fps 1% low on a recorded reference desktop at 1080p, 100 enemies + 30 towers | Establish a repeatable budget before increasing art density; current performance was not measured this session |

## Content and planets

Build a representative small set before scaling: an open hills tutorial, a canyon/shore world, then a peak/hot/cold world with the same mandatory base and breach connectivity rules. Each needs an overhead walkability/material view, a commander-height scale view, and an ordinary live defended run.

First validate one complete planet, then two linked planets. Expand to a three-planet pilot that exercises all weapon eras in test fixtures. Only then generate the 99-node campaign with authored milestone bosses, biome/difficulty/era tables and repeated-play variation. Avoid 99 nominally different seeds with identical decisions. Record time spent defending, traveling, managing inventory and waiting; use that distribution to maintain constant action while permitting strategic breathers.

## Interface and HUD

- **Title and first minute:** center the campaign; display current-mode controls, possess/release, select/pan, base role, nests and loss conditions. Keep advanced detail in a compact contextual help panel.
- **Board:** current versus next base level/cap/radius/cost; explicit crystal bank; Return to heart; clear tower/unit priority and selected state.
- **Possession:** readable health, equipped weapon, ammo/resource if applicable, carried crystals, route home and mode-specific pause hint. Test on bright terrain as well as dark sky.
- **Placement:** spherical orbit range with a ground intersection and labelled special regions; elevation/material bonus or denial; first-person reach indicator.
- **Combat:** danger shape plus timing cue; distinguish hit, critical hit, blocked strike, loot and crystal effects. Reduce screen shake, flashes, trails and popups independently.
- **Draft and inventory:** solo choices wait by default; compare meaningful mechanics and compatibility, equip/salvage by deliberate action; no important feedback dependent on a toast that can expire unseen.
- **Between planets:** settlement receipt, banked/unbanked distinction, next destination, save state and clear final campaign ending.

Preserve `DESIGN.md` type/color/spacing language. New UI must be reviewed in the running game at 1280 x 720 and 1920 x 1080, keyboard-only and reduced-motion settings. No new UI or motion implementation is included in this documentation batch.

## Build order and milestones

| Order | Deliverable | Dependency and exit gate |
|---|---|---|
| M0 | **First end-to-end playable baseline:** repair reward/talent contracts and control/draft clarity in the existing planet; instrument effects and play to boss victory plus commander defeat | Start here. All advertised rewards audited, 15-wave natural victory evidence, defeat/retry and save/talent tests. Existing pure-core tests alone cannot close it. |
| M1 | Camera and combat presentation foundation: fix Bulwark arm, input ownership, automatic flights, contextual HUD, animation timing inspection | M0 establishes reliable telemetry. Preserve combat rules while proving feel; camera harness on every map and human continuous-input review. |
| M2 | New expansion loop in one end-to-end planet: crystal venture/return, deposit, explicit base upgrade and territory growth | M0-M1. A natural win must use a crystal delivery; a wave clear alone never expands the circle. |
| M3 | Terrain strategy slice: extreme peaks/canyons, swim/slope costs, raised/climate placement, flyer ceiling routing and spherical range | M2 stable; implement terrain/nav classification before climate bonuses and visuals. Validate both ground and air routes across deterministic seeds. |
| M4 | Four weapon families, inventory/drop/customization slice, shared choreography and red telegraphs; foliage/model polish | M1 attack definitions and M3 terrain contact. Prove one item from enemy death to pickup/equip/attack/extraction, plus actual telegraph/damage agreement. |
| M5 | Two-planet continuation, then three-planet content pilot, then full 99-planet campaign and public rename | Save schema can be designed during M2; expansion waits for M4 loop evidence. Verify transition/retry/final-planet boundaries before content multiplication. |
| M6 | PvPvE galaxy prototype, then platform feasibility spikes | Stable M5. First authority-controlled co-op, then conflict rules/invasions. Roblox/Luau and Fortnite/Verse require separate renderer/input/network/persistence adapters and native prototypes. No automatic export promise. |

M1 and later work should be split into small reviewable PRs. Each first fixes or delivers a playable behavior, then polishes it, then expands its content. Shared camera/world changes retain all five maps until their retirement is explicitly part of a later release. No calendar estimate is asserted before M0 establishes a repeatable QA cost.

## Verification

| Surface | Evidence required to close work |
|---|---|
| Rewards and talents | Table-driven tests for every catalog entry and tower family plus live before/after health, gold, damage, cadence, chains, hand size and frontier values. Fresh profile, purchase, next run and reload. Negative control has no effect without the reward. |
| Camera and controls | `WH.camTest()` on all five map keys with per-map output; continuous-input captures at 1X, pause, low/high FPS; interrupted flight, pointer lock refusal, selection overlap, ground/build/possess/escape contexts. Qualitative owner review supplements the harness. |
| Combat | Record anticipation/active/recovery timestamps and rendered shapes; hit inside, miss outside, leave during windup, death/interrupt, high/low terrain, all weapon families and enemy species. First/third-person frames agree with the same authoritative hit event. |
| Graphics | Fixed seed/camera repro for trees, bushes, soldier joints, towers, water and post-processing; orbit and near-plane sweep; wireframe/normals/depth diagnostic then final-lighting before/after; repeat all map families. Do not close an artifact from a single attractive frame. |
| Terrain/navigation | Deterministic seed suite plus visible play on hills, canyon, shore and peak profiles; all breaches reach heart, crystals accessible, no softlocks, path cost predicts real travel time, swim/shore hysteresis, tall-peak flight detour and dive clearance. |
| Placement/range | Height/material/footprint matrix; hot/cold/neutral/mixed rules, bonus stacking, last-path preservation, max frontier, first-person reach. Probe target positions just inside/on/outside 3D range and Mortar minimum range, including elevated/flying targets. |
| Crystals/frontier | Pickup/deposit/upgrade idempotency, resource conservation, insufficient price, full carry, max base, death/reload races. Assert no expansion from waves, kills, drops, elapsed time or deposit alone. Natural UI expedition/return/upgrade evidence. |
| Weapons | Fixed seed generates stable legal parts; family compatibility, item uniqueness, full inventory, equip during attack, ammo/fallback, save/load/migration, death/transition retention, drop distribution measured over a large deterministic sample. Live pickup to equip to combat proof. |
| Campaign | Natural first-planet win and real next-world load; complete two-planet pilot. Fixture tests for nodes 1/33/34/66/67/98/99, transitions and final ending; all 99 definitions validate. Final release additionally needs a complete unforced campaign playthrough, which this session did not attempt. |
| Performance/accessibility | Recorded hardware/browser/resolution/seed/load, frame-time distributions, draw calls/memory, prolonged session and pause/background recovery; contrast, color-independent tells, audio/motion controls and keyboard flows. |
| Networking/ports | Authoritative command validation, replay/event ordering, reconnect, latency and duplicate transactions; native platform prototype proves input/combat/save before any portability claim. |

Automated runs must distinguish core fixtures, shell integration and actual UI play. Save build SHA, initial/effective seed, profile version, action trace, expected/actual results and terminal screenshots. No debug win or direct wave mutation counts as a natural completion. For shared gameplay changes run syntax, style, relevant tests, browser checks, classic-map regressions and deployment mirror verification; keep artifacts linked in the same PR.

Preserve the current contracts: pure injected-RNG/dt `js/run/`, only the mode bridge couples it to Three.js, final-frontier nav topology built once and masked, orthonormal tangent frames, complete pooled-state resets and separate depth-cleared first-person rendering. New network preparation should gradually move authoritative combat and inventory rules out of renderer owners; the existing pure run core alone does not make the whole game deterministic.

## Decided

| Decision | Status | Evidence |
|---|---|---|
| Existing campaign has an enjoyable playable defense loop | in game | Blind natural defeat wave 11, [terminal capture](qa/2026-09-05/images/23-defeat.png) |
| Center future development on this mode and rename after campaign readiness | not yet | Owner direction; M5 |
| Keep simple faceted aesthetic and extend existing rig/world systems | partial | [Live baseline](qa/2026-09-05/README.md); new model/feel acceptance still open |
| Trust every offered/purchased reward | implemented, review open | [M0 live consumers and verification](qa/implementation/M0.md); wider balance/manual sampling remains open |
| Camera/POV/animation polish and readable strike zones | partial | Current possession/strike systems exist; current arm screenshot and missing telegraph-area acceptance |
| Crystal-driven explicit upgrades are the only frontier expansion trigger | not yet | M2; existing code still earns wave rings |
| Massive terrain variation, swimming, slope cost, climate placement, flight ceilings, spherical ranges | partial | Existing ranges/canyons and 3D targeting; requested extension not built |
| Weapon inventory, loot, modular customization and era arc | not yet | M4-M5 |
| Actual 99-planet continuation and final ending | not yet | Current victory only banks a counter |
| PvPvE galaxies and platform ports | not yet | M6 after single-player evidence |

## Task list

The [GitHub-linked progress ledger](PROGRESS.md) is the live task index. It carries owner, dependency, status, evidence and usage. The request map is: U01/U19/U20 -> M5/M6; U02 -> M1; U03-U07 -> M1/M4; U08-U10 -> M4/M5; U11-U16/U18 -> M3; U17 -> M2; U21 -> the ledger and every PR. The [original request intake](qa/2026-09-05/REQUEST.md) spells out each ID.

Start M0 with one reward contract and an actual before/after shell test; then complete the catalog. Do not simultaneously rewrite terrain, combat, loot and campaign state. A task closes only when its stated player behavior is evidenced, with remaining gaps named. No gameplay task is marked implemented by this planning PR.

## Where we are

Implementation update, 2026-09-05: M0 reward and deliberate-draft changes are
implemented on the feature branch. 168 headless tests and 14 browser assertions
pass; all five maps pass their camera harnesses. Unforced instrumented play
defeated the wave-15 boss after a direct-control retreat, with commander defeat
and retry recorded separately. This is not a blind human victory or complete
campaign acceptance. M1 camera/POV work is active; M2-M6 remain queued. See the
[live implementation record](IMPLEMENTATION.md). No gameplay has shipped yet.

2026-09-05: Astra's blind attempt ended naturally at wave 11/15. Repository study, a source retrospective, a targeted commander POV retry, 128 existing tests and a read-only reward diagnostic now establish a documented baseline. The current repository still ships Worldheart with a one-planet 99 Planets mode. This batch supplies QA evidence, direction, acceptance gates and collaboration tracking; M0 is the next development milestone. The external blueprint checker was absent, so these fourteen sections were reviewed manually without claiming its gate passed.
