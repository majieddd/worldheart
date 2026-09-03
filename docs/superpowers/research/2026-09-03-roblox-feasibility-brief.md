<!-- Adversarially-checked research workflow, 17 agents, 2026-09-03. Each angle was
     researched then attacked by a skeptic told to refute; 8-16 claims fell per angle.
     Tags: [ROBLOX] verified primary, [EXPERT] single named expert, [FOLKLORE] no
     primary source (do not build on it), [OURS] our own target.
     Informs the PHASE 2 spec. Not a plan. -->

# 99 PLANETS: DECISION BRIEF
**For: owner + implementing engineer. Date: 2026-09-03.**
Sourcing convention used throughout: `[ROBLOX]` = Roblox primary documentation, verified. `[EXPERT]` = single named industry expert, not Roblox. `[FOLKLORE]` = circulating figure with no primary source, do not build on it. `[OURS]` = our own target, no external authority.

---

## 1. THE SPHERE VERDICT

### Build the sphere. Do not build a *globe game*.

The recommendation is a true spherical planet with an orbital camera and **no player avatar**, where the playable frontier is capped at roughly one visible hemisphere for the entire 15-wave run. The far side of the planet is scenery, never gameplay.

That second half is the load-bearing decision and it is not in the research. Everyone verified that a sphere is *technically* fine. Nobody asked whether a sphere is *legible*. A tower defense is a game about seeing threats early enough to respond. A sphere hides half its content by construction. On a phone, the cost of rotating to check the far side is a thumb-drag every few seconds, competing with the thumb you need for placement. That is the mechanism by which a beautiful planet becomes an unplayable one, and no top Roblox TD or 99 Nights has this problem because they are all flat.

The design already contains the fix. The run "starts fogged in on a small cap and expands the frontier outward." Cap that expansion so that at wave 15 the revealed frontier still fits inside one camera framing. You get real curvature, a real limb, real atmosphere, real orbital camera, and you never once ask the player to manage combat they cannot see.

### Why a sphere at all, given that constraint

Because with the avatar removed, every hard sphere problem disappears and several things get *cheaper* than the flat equivalent:

- **Placement is closed-form.** Ray-sphere intersection is six lines of Luau against the mouse/touch ray. No raycast, no collider, no `CollisionFidelity`. The visual planet mesh can be `CanCollide = false, CanQuery = false` and leave every physics and query broadphase entirely.
- **The tile grid is the pathfinding graph is the fog structure is the adjacency lookup.** One precomputed Goldberg hexsphere table (`{centre unit-vector, normal, neighbours}`) serves four systems. On a flat map those are four different structures.
- **Lanes are closed-form.** A great-circle arc is a slerp between two unit vectors. Enemy position is one scalar (arc-length or tile index plus sub-tile offset). That is the cheapest possible wire representation and it is *better* than a flat map's waypoint chasing.
- **Precision is a non-issue** at R = 300 to 500 with the camera at 750 to 1,500 studs. (Note: the "~10,000 studs" figure in the research is `[FOLKLORE]`; the actual community report is jitter at ~3,000 studs, and Roblox publishes no threshold. R = 300 keeps us clear of it; R = 900 does not.)

### What it costs

| Cost | Size |
|---|---|
| `PathfindingService` is unusable. Build a flow field over the tile graph. | Small. ~200 lines, and it is the correct answer for hordes anyway (one field, N enemies read it). |
| Roblox's occlusion culling contributes nothing on a convex exterior. Write horizon culling by hand (one dot product per tile-chunk). | Small, but must be budgeted, not assumed. |
| No custom shaders on Roblox. Fog of war has no "proper" rendering solution. | Medium. v1 is per-tile opaque tint driven by one integer. `EditableImage` is a polish upgrade, not a plan. |
| Mobile touch placement on a rotating sphere is **unprecedented**. No shipped comparator exists. | **This is the real cost.** Prototype it before any content work. See §5 and §6. |
| Zero reusable flat-map TD tutorials, plugins, or assets. | Medium. Everything is bespoke. |

### What it forecloses, permanently

- **A walking player avatar on the surface.** There is no supported arbitrary-gravity character system on Roblox. `ControllerManager.UpDirection` only reorients the RootPart and does not make controller physics relative to it (open feature request, no staff reply, as of 2026-05-01). The legacy `VectorForce` + `AlignOrientation` + `Gravity = 0` path fights the default camera scripts, the stock Animate script, and Humanoid floor detection. **Get an explicit "no avatar" from the owner before line one of code.** This is the single decision that determines whether the project is 6 months or 18.
- Terrain deformation / destructible ground.
- `Model.LevelOfDetail = SLIM` (it requires `StreamingEnabled`, which we are turning off). Minor loss.
- Any design requiring the whole board visible at once. Accept it.

### If the sphere fails the prototype

The fallback that preserves the fantasy is a **spherical cap**: a curved section of planet surface with a real horizon, real limb, atmosphere and starfield, camera fixed above it at a shallow angle, the rest of the globe implied and never rendered as gameplay. Curvature reads immediately, no rotation is required, and the tile graph, flow field, and closed-form placement math all carry over unchanged. You lose the orbital "spin the world" verb and nothing else. Do not fall back to a flat map with a skybox planet; that discards the premise.

---

## 2. ARCHITECTURE

### Toolchain: yes to all three

- **Rojo**, pinned at **7.7.0** (2 July 2024). Flag: there has been no Rojo release in over two years. Check open issues and commit recency before committing; it is still the ecosystem default and nothing better exists, but this is a live dependency-health question.
- **Rokit** for tool pinning (`rokit.toml`: rojo, wally, selene, stylua, luau-lsp, lune). Not Foreman, not Aftman.
- **Wally** for packages. Vendor the `.rbxm` for anything load-bearing.
- Set `emitLegacyScripts: false` on the first commit. Two project files: `default.project.json` (ship) and `dev.project.json` (adds tests + debug UI).

### Framework: none. Compose libraries.

Do not adopt a monolithic framework.
- **Knit** is archived (owner-archived 31 July 2024, read-only). Anything built on it starts as legacy.
- **Flamework** requires roblox-ts, which puts a transpile step between you and the MicroProfiler on a simulation-heavy game. Wrong trade.
- **Roblox's own Server Authority** (`Workspace.AuthorityMode = Server`, GA 2026-07-09) is the wrong tool and this is the most seductive mistake available. It force-enables `StreamingEnabled`, `UseFixedSimulation`, and `SignalBehavior = Deferred`; caps Animators at 8 tracks and instances at 64 attributes; and pays for correctness in **client CPU** (Roblox: a misprediction at 100 ms latency costs 6.25x the sim load of that window, and it is "the primary reason why Server Authoritative games require more CPU on the client"). It exists to solve contested per-frame physics. A tower defense has none. Reject it.

Write a ~200-line bootstrap: ordered module discovery, two-phase Init/Start lifecycle, a dependency accessor. Then compose:

| Layer | Choice | Note |
|---|---|---|
| UI | **React-lua** (`jsdotlua/react` via Wally), exact-pinned and vendored | Roblox uses React internally but "the publicly available react-lua packages are all community maintained" (Roblox staff, May 2024, nothing since). This is real supply-chain risk; vendoring is the mitigation, not a footnote. Fusion is pre-1.0 and its own community says "not recommended for production." |
| Networking | **Zap** (IDL → buffer codegen) | Chosen over Blink specifically because Zap validates all received data by construction, which is free server-side input sanitization. The FPS delta between them is irrelevant at our packet volumes. |
| Persistence | **ProfileStore** | Successor to ProfileService, same author, MessagingService-based conflict resolution, 300 s autosave (~10x fewer DataStore calls than ProfileService). |
| ECS | **None for v1** | Jecs is good, but its headline "800,000 entities at 60 FPS" is a README claim with no published methodology, CPU, or mobile figure. A few hundred enemies in flat parallel `buffer`s is simpler, testable off-platform, and fast enough. Revisit only if profiling demands it. |
| Cleanup | Trove | Trivial, take it. |

### Luau settings, set now

`LuauTypeCheckMode = Strict` and `UseNewLuauTypeSolver = Enabled` at project level. Strict projects are deliberately left on the *old* solver by default, and Roblox only committed to maintaining it through 2026. Eat the friction while the codebase is small.

**Native codegen is documented server-side only.** Put `--!native` on server sim modules. Do not annotate `shared/Sim` as if the client will compile it; budget the client sim as interpreted Luau. Structure hot work into functions (top-level scope barely benefits) and note that an attached breakpoint disables native execution, so a debugged profile is not the shipped profile.

### Folder layout

```
rokit.toml  wally.toml  wally.lock  selene.toml  stylua.toml
default.project.json  dev.project.json
src/
  shared/
    Sim/        <- PURE LUAU. May reference ONLY: buffer, vector, math, table, bit32, os.clock is BANNED.
                   tick loop, flow field, enemy step, damage resolve, targeting,
                   wave table, draft table, seeded PRNG (hand-rolled xorshift/PCG over
                   bit32; math.random is NOT a Luau fastcall and is not seedable per-stream)
    Rules/      <- placement legality + cost tables. Required by BOTH client preview and server validation.
    Net/        <- Zap-generated modules
    Planet/     <- hexsphere generation, tile table, ray-sphere, great-circle math
    Types/
  server/
    Services/   <- Economy, Placement, Wave, Draft, Reward, Profile
    Bootstrap.server.luau
  client/
    Controllers/  <- Input, Placement, CameraOrbit, Interp
    UI/           <- React-lua tree
    Render/       <- entity renderer, VFX pools, horizon cull
    Bootstrap.client.luau
  replicatedFirst/  <- loading screen
tests/            <- mirrors src/shared/Sim, runs under Lune
```

The `src/shared/Sim` purity rule is the most valuable line in this document. It is what makes the simulation unit-testable off-platform in CI, what makes headless balance sweeps possible (see §6, risk 7), and what makes a future port to any other engine tractable.

### Client/server split

**Server owns, absolutely:** currency ledger, placement legality, tower cost, wave clock and composition, enemy HP, all damage and death, the RNG seed and every draft roll, tower unlock rolls, evolution tiers, boss phase transitions, planet unlock persistence.

**Client owns, and is never trusted:** tower ghost and range ring, placement preview, projectile flight and impacts, muzzle flashes, damage numbers, enemy interpolation and animation, all HUD, the camera, fog reveal animation, audio.

**The one rule that matters:** the client may choose what to *look at*; the server decides what *dies*. Never accept a client message asserting a kill, a wave completion, damage dealt, or a reward.

### Enemy simulation and replication

Enemies are **data, not Instances**. No Humanoid, no physics, no per-enemy script, no per-enemy RunService connection. A server enemy is `{id, archetype, laneId, spawnTick, speed, hp, mods}` in a flat array. Server ticks at **20 Hz**. Position derives as arc-length along a precomputed great-circle lane; orientation falls out free (`up = normalize(pos)`, forward = path tangent).

Replication is a three-channel design, and this is the part to get right on day one because it cannot be retrofitted:

1. **Reliable spawn message** (once per enemy): `{id, archetype, laneId, spawnTick, speed}`. About 8 bytes. The client now derives that enemy's entire future position with no further traffic.
2. **Reliable correction** (only when state changes): a slow, stun, knockback, speed buff, or lane change sends `{id, tick, arcLength, newSpeed}`. Roguelite powers make these frequent, so budget for them, but they are event-driven, not per-frame.
3. **Unreliable 10 Hz drift snapshot**, carrying **only enemies flagged dirty this window**. Bit-packed: ~10-12 bits tile/arc index, ~7 bits orientation, ~5 bits state flags, ~10 bits id. Call it 4 bytes per dirty enemy.

Worst case (300 enemies all dirty every tick) is 300 x 4 x 10 = 12 KB/s. Typical case is near zero. Compare: stock Humanoid NPCs measured at ~110 KB/s for 200 units.

Notes the research got wrong and you must not repeat:
- The **~500 requests/sec/client throttle is client-to-server only** (`FireServer`). It does not protect server-to-client fan-out. Batch anyway, but the reason is bandwidth and `ProcessPackets` CPU, not that throttle. What it *does* mean: throttle player input remotes (placement spam, rapid upgrade taps) before `FireServer`.
- `UnreliableRemoteEvent` payload: creator-docs says 1000 bytes are dropped. Community testing suggests substantially more; the "908 bytes" figure has no source. **Size chunks to 800 bytes, assert buffer length in dev builds so an over-cap packet fails loudly, and measure the real ceiling before relying on anything larger.**
- `BulkMoveTo` is an **optimization, not architecture**. Roblox: "You should only use this function if you're sure that part movement is a bottleneck... setting the CFrame property of individual parts is fast enough in the majority of cases." It takes BaseParts, not Models. Write the renderer so the CFrame write path is a single swappable function, then measure, then decide. If you do use it, pass `Enum.BulkMoveMode.FireCFrameChanged` (the default is the slow one).

### Streaming: off

`StreamingEnabled = false`. The whole planet is permanently gameplay-relevant, there is no character to focus on (streaming centres on `Player.ReplicationFocus`, which defaults to the character's PrimaryPart and is absent here), and every correctness tax (`WaitForChild` discipline, lost client-only property writes, `GameplayPaused`) buys nothing at R = 300-500. Note that streaming is **on by default for new places**, so turning it off is an explicit action. Also note that `StreamOutBehavior`, `StreamingIntegrityMode`, `PhysicsSteppingMethod`, `ModelStreamingBehavior`, and `PlayerCharacterDestroyBehavior` are all `NotScriptable`; they must be set in Studio and committed to the place file, not in a bootstrap script that will silently fail.

### Persistence

ProfileStore, one key per player, `SchemaVersion` integer from commit one, an ordered list of pure `v(n) -> v(n+1)` migrations run on load. `UpdateAsync` only, never `SetAsync` (and note `UpdateAsync` decrements both the read and write budgets).

On session-lock failure: **do not load defaults and let them play.** Show a "restoring your save" overlay, retry, and kick with a clear message after a timeout. Roblox's own docs actually recommend letting the player continue on defaults, but that recommendation is written for games without cross-session progression; with permanent planet unlocks it is the textbook dupe/rollback path. This is a deliberate departure from Roblox guidance, made with eyes open.

`ProcessReceipt` must be idempotent: dedupe on `PurchaseId`, award in memory, persist data and `PurchaseId` in one write, return `NotProcessedYet` on save failure.

---

## 3. PERFORMANCE BUDGET

### Hard gates. A build that fails any of these does not ship.

| Budget | Value | Source |
|---|---|---|
| Client frame time | < 16.67 ms | `[ROBLOX]` "At 60 FPS, the total budget for each frame is 16.67 milliseconds" |
| Client CPU time | < 16 ms | `[ROBLOX]` analytics page |
| Server heartbeat | < 16 ms (`Stats.HeartbeatTime` x 1000; `HeartbeatTimeMs` is deprecated) | `[ROBLOX]` |
| Server memory | < 50% of `6.25 GiB + (100 MiB x players)` | `[ROBLOX]` |
| Client crash rate | < 2% | `[ROBLOX]` "investigate if your crash rates increase above 2-3%" |
| Total draw calls (Scene + Shadows + UI2D + UI3D) | **< 500** | `[EXPERT]` MrChickenRocket, 2024-08-20, guest article. Roblox's own doc example is < 1,000, explicitly framed as a per-project derivation, not a platform constant. |
| Total triangles | **< 500,000** | Same `[EXPERT]` source, same caveat. |
| Client memory | **< 1.3 GB** | Same `[EXPERT]` source. Roblox publishes no client memory target. |
| Client receive bandwidth | **< 50 KB/s** at wave 15 | `[OURS]`, adopted as a self-imposed target. There is **no engine throttle at 50 KB/s**; that is `[FOLKLORE]` traceable to the same single expert article. Adopt it because Astro Force demonstrated 5-10 KB/s is reachable for 100 units, not because anything enforces it. |
| Our internal split of the 16.67 ms | ~4 ms render prep / ~4 ms game Luau / ~2 ms physics / ~2 ms engine / ~5 ms headroom | `[OURS]`. Roblox publishes no split. |
| UI main-thread work | < 1.5 ms | `[OURS]` |

**Baseline device: a physical sub-2 GB Android phone.** Roblox ships a dedicated analytics insight for that tier, triggered at 5%+ of your concurrents. Gate on the low-end decile (Roblox's dashboards label the low-end Android cohort P10 for frame *rate*; write the criterion as "P10 client frame rate >= 60 on Android" so nobody inverts it). The dashboard needs 100 DAU before it populates, so until then that handset is your only honest signal. Roblox states Studio's device emulator is "unreliable for memory testing" and community measurement puts Studio at 2-3x live resource usage.

### The techniques that actually hold the budget

**Draw calls.** The single highest-leverage rule, verbatim: "Multiple meshes with the same `MeshContent` are handled in a single draw call when: `SurfaceAppearance`s are identical if present, otherwise when `TextureContent`s are identical." Every enemy of an archetype shares one mesh asset and one texture. Recolour and evolve (armour / shield / split tiers on every 3rd wave) via UV offset into a shared atlas, never a per-tier texture. 300 enemies of 6 archetypes should cost ~6 draw calls. **Instancing requires identical meshes**, so do NOT split the planet mesh "for batching" (distinct chunks each cost their own call); split it only for the `EditableMesh` 20,000-triangle cap or for culling.

**Transparency is binary.** `[ROBLOX]` "Avoid transparency values other than 0 (visible) and 1 (invisible)." Partial transparency forces the engine to render overlapping pixels multiple times. This is the likeliest mobile GPU failure in this specific design, because fog + range rings + shield bubbles + boss VFX all stack over the same pixels. Rules: fog is opaque tinted tiles, never a translucent dome; tower range is a thin opaque ring decal, never a filled disc; at most two translucent layers over any pixel.

**Particles.** 400/sec per emitter desktop, **100/sec mobile**, 20 s lifetime cap. Author every emitter to the 100/sec mobile cap and let desktop render the identical thing. Occlusion culling never culls VFX.

**Textures.** A 1024x1024 costs 4x a 512x512. `<= 512` for anything large on screen, `<= 256` for minor images. One atlas per biome, one UI atlas. Nine planets x nine texture sets is how this design blows the mobile memory budget; nine planets x one atlas plus palette and lighting variation is the fix and it also gives the biomes a coherent identity.

**Lighting.** `Lighting.Technology = Future` is **deprecated and non-scriptable** (Studio-only); the line will not even execute. Use `Lighting.LightingStyle = Enum.LightingStyle.Realistic`. Set `PrioritizeLightingQuality = false` (protect frame rate and draw distance; on a planet, cut draw distance and the frontier visibly pops). One directional light for the star. `Light.Shadows = false` on all local lights. `CastShadow = false` on every enemy and small part. `EnvironmentSpecularScale` and `EnvironmentDiffuseScale` both default to 0, so raise them explicitly if you want reflections. Watch `computeLightingPerform`, `LightGridCPU`, `ShadowMapSystem`; treat any above ~1.5 ms as a hard stop.

**Physics.** Everything `Anchored = true`, `CanCollide = false`, `CanTouch = false`, `CanQuery` only where clicking is needed, `CollisionFidelity = Box`. Anchoring is what makes arbitrary surface-normal orientation physically free. Adaptive stepping, never fixed (fixed forces every assembly to 240 Hz). **Trap:** `CanQuery = false` removes parts from raycasts and `GetPartBoundsInRadius`, so all targeting must run off your own tile spatial index. Make that an explicit decision now, not a discovery at integration.

**Culling.** Budget **zero** from Roblox's occlusion culler on a convex exterior. It never culls lights, VFX, shadows, UI, or avatars. Write horizon culling by hand: an object at surface point P is over the horizon from camera C when `dot(normalize(P), normalize(C)) < R/|C|`. Run it per tile-chunk, not per object, on a smeared budget of ~50 checks per frame. Then measure whether it actually pays after the engine's own frustum culling; the honest expectation is that the *render* saving is modest and the *client Luau, particle, and billboard* saving is large.

**World-space UI.** `MaxDistance` on every `BillboardGui` and `SurfaceGui` (default is unlimited). `AlwaysOnTop = false` so far-limb labels occlude behind the planet. Lower `PixelsPerStud` rather than raising `TextSize`.

**Instrumentation, week one.** A permanent debug overlay reading `SceneDrawcallCount + ShadowsDrawcallCount + UI2DDrawcallCount + UI3DDrawcallCount` (the sum, not just Scene), the four matching triangle counters, `InstanceCount`, `DataReceiveKbps`, `DataSendKbps`, `GetTotalMemoryUsageMb()`, and `HeartbeatTime x 1000`. Wrap every system in `debug.profilebegin`/`profileend` with stable names.

### Numbers you may NOT quote in any document or spec

- "Humanoid::findForce runs in a 240 Hz physics pipeline" (no primary source; not on the MicroProfiler page).
- "200 Humanoids cost ~8 ms of server frame time" (a 4x linear extrapolation of one contaminated n=1 community run).
- "Roblox throttles at 50 KB/s" (no such throttle documented).
- "Float precision degrades at ~10,000 studs" (the cited thread reports ~3,000; Roblox publishes nothing).
- "PathfindingService uses a 4x4x4 voxel navmesh" (that is Terrain voxel size; unrelated system).
- "Astro Force went 600 KB/s to 10 KB/s, a 120x reduction" (the post says ~3000 to ~10 to ~5 KB/s, and calls it 60x; it is also from 2021, predating `buffer` and `UnreliableRemoteEvent`).
- "80% of Roblox sessions are on mobile" (the source says 80% of *users*, and immediately notes only 24% play exclusively on mobile). Mobile-first is correct; the number is not quotable.
- "BulkMoveTo beats individual CFrame past ~30 parts" (one 2021 forum comment; the only measurement in that thread showed a ~9% margin).

---

## 4. FEATURE SET

### The scope statement nobody has written yet

**"99 Planets" is the title, not the launch scope.** Ship **3 planets, 8 towers, ~20 roguelite powers**. Every additional planet after that is a biome reskin plus a difficulty band on shipped systems, which is exactly the sub-three-weeks-of-effort cadence content Roblox recommends, and it becomes your update pipeline. Building 99 planets before launch is how this project dies.

### LAUNCH-CRITICAL

**Before any gameplay code:** ID verification, 2FA, and an active Roblox Plus subscription. All-Ages publishing has required all three plus a staged game evaluation since 2026-05-19, and new all-ages games run 16+-only first while Roblox measures engagement. Budget Plus as a permanent cost of doing business. Plan the 16+ phase as the real launch, not a beta.

**Also before any content:** lock R15/custom rigs and disable R6 in avatar settings. Worth a 42% DevEx uplift (0.0054 vs 0.0038) on US 18+ purchases, forever, and expensive to retrofit. (See §7 for an unresolved wrinkle: we may have no avatar at all.)

**Also before any UI:** fetch every price at runtime via `MarketplaceService:GetProductInfo()`. Never write a Robux integer into UI. Hard-coding silently disables regional pricing, Roblox Plus discounts, and (later, at 60,000 transactions/30 days) price optimization, and the failure mode is invisible.

Core loop:
- 15-wave run on one planet, **12-18 minutes**. This clears the Creator Rewards 10-minute floor with margin, sits at the top of the observed TD session band (TDS 13.1 min, Anime Defenders 10.0, Ultimate TD 8.5), and lets a player fit three runs inside the 60 min/game/day playtime credit cap.
- **First tower placed and killing something inside 30 seconds.** First play bounce rate is a top-tier negative ranking signal measured in explicit `<60s` and `61-180s` buckets. No cutscene, no lobby, no tower-select menu before first contact. The fogged cap helps here: the opening screen is small and legible.
- 1-of-3 roguelite draft after each wave, **generated server-side at offer time** from a server-held RNG stream. Never pre-roll a run seed and hand it to the client, or the client computes every future draft.
- Tower unlock every 2nd wave; global upgrade-tier cap raise on later even waves.
- Enemy evolution every 3rd wave, as **tier substitution, not stat inflation** (this is what makes 99 Nights' raid escalation legible: raid 1 is melee only, later raids add crossbows, then spears).
- Multi-phase wave-15 boss. **Storyboard and profile this first**, before waves 1-14 exist. It is the frame-rate ceiling of the whole project.

Meta and retention (all three, all server-configurable without a client update):
- Account level with a **published** unlock table, curve flattening after the midpoint. Loadout slot count is itself a level reward: it converts "I unlocked a tower" into "I must now choose."
- One soft currency, paid **win or lose**, scaled by waves survived. In a roguelite where most runs end in death, paying on loss is not optional.
- Daily login: **install Roblox's Engagement Rewards feature package.** Do not build this. Tune the reward to land in the first 3 minutes so it also serves the Creator Rewards "first three experiences of the day, 10+ minutes" rule.
- 3 daily quests (hard cap, anti-farm), requirements scaling with account level so one quest string serves every player.
- Index / codex: enemy logbooks that drop from kills, per-planet triumphs and best times, an achievement tree including **inverted-rule badges** (win without X, win in under N minutes, win without losing a tower). For a 99-planet game this is the cheapest retention surface in the design and costs almost no new art.
- Codes system with in-game redemption, plus a Discord. Table stakes for creator outreach. **Never put code or reward language in the title, icon, or description** (Roblox explicitly de-prioritizes metadata implying monetary reward).

Monetization, three rungs and nothing more:
- One anchor pass, 375-499 R$: XP%, a cosmetic nametag, auto-skip, extra loadout presets, a few crates.
- 2-3 tower **early-unlock** passes, 299-799 R$, for towers that are **also reachable by level**. That distinction is the entire reason TDS sustains a 94% like ratio while selling 2,249 R$ towers, and it is worth protecting.
- One time-compression SKU at **799 R$**. All three surveyed top TDs converge on 799 for speed (2x Game Speed, 3x Speed, 50x Unboxing). For us it is a 2x wave-speed toggle: pure convenience, zero combat advantage, raises runs-per-session.
- A 350 R$ starter bundle shown after the tutorial on a hard 72-hour window. Check the discount arithmetic; TDS shipped theirs claiming 47% when it was 41%, and once displayed 211%.

Infrastructure:
- Debug HUD with all `Stats` counters, from week one.
- Server-side config for every faucet and price. TDS cut Playtime Reward rare-tier odds 4-10x within 24 hours of launch.

### LATER (months 2-6, in this order)

1. **Co-op, 2-4 players.** This is the highest-value post-launch feature and the reason to architect server-authoritative multi-client from day one even while shipping solo. "Intentional co-play days per user" is a documented Home ranking signal. When you build it: scale enemy HP by headcount, **rescale on leave** (99 Nights' frozen-difficulty-on-leave is a documented run-ruining defect, not a feature to copy), and make the draft **client-sided per player** so nobody races anyone (this is exactly what 99 Nights' Pelt Trader does and it is the right answer).
2. Endless mode on cleared planets. This is the grind surface that makes a 15-wave campaign replayable, and in the anime TDs it is the primary resource faucet.
3. Season pass, using **Roblox's Season Pass feature package** on Roblox's own recommended shape: 1-month seasons, ~10 tiers, a one-week rest gap, daily-unlocking missions across easy/medium/hard, and no mission requiring hard currency. Adopt TDX's best idea: when a season ends the pass stays permanently grindable.
4. Events with an event currency. **Write the sunset rule first** (unspent event currency auto-converts at event end). TDS accumulated ~18 dead event currencies.
5. Per-tower mastery XP, awarded only to towers still standing at run end (which creates real tension against selling late).
6. A coin-sink meta upgrade tree with tiny per-rank effects and a six-figure total cost. **Disable it entirely in any leaderboard or competitive mode**, exactly as TDS disables Skills in Voidcore and PvP, so the meta layer never becomes the balance ceiling.
7. A local-currency subscription at $4.99 or $7.99 as the season pass premium track. It is the only surface paying **100% of value from month two** versus roughly 21-27% effective on the Robux path. Battle passes are the named exception to Roblox's rule against gating subscription benefits. Keep a Robux subscription in parallel for the ~12 regions and the console platforms where local currency is unavailable.

### CUT. A solo developer ships none of these, ever, or not for years.

| Cut | Why |
|---|---|
| **Trading** | A one-way door. TTD's trading brought third-party value lists, market manipulation, 18 documented scam patterns including a client-desync exploit, and permanent moderation cost. It also requires towers to become instanced rolled items, which contradicts a fixed roguelite roster. |
| **Unit gacha / trait rerolls** | The anime lane's engine, incompatible with our design, and the wiki for the reference game records sustained player criticism of exactly this. |
| **Any paid randomness touching the draft** | The free 1-of-3 draft is **exempt** from odds disclosure. The exemption is waived the moment the randomized reward is earned "in exchange for completing an action that does not involve the payment of Robux **or other in-game currency**." A reroll priced in soft currency plausibly trips it, and the policy names "re-roll tokens" as a regulated indirect purchase. **Rerolls must be free or earned, with no currency cost of any kind.** If you ever want a paid crate, make it a purely cosmetic planet skin, fully walled off. |
| **PvP** | TDS and Anime Vanguards both added it years in, with ELO. Not a year-one feature. |
| **Clans** | TDS has no guild system after seven years and remains #2. Genuinely optional. |
| **Immersive / rewarded ads** | Requires 2,000 monthly unique visitors, an approved compliance questionnaire, ID verification and 2FA. Portal ads actively teleport your players out. Not legally available at launch anyway. |
| **Roblox Server Authority** | See §2. |
| **Deterministic lockstep** | The bandwidth it saves, we do not need (our worst case is 12 KB/s). What it costs is the worst-named bug class in the project: "desyncs that appear only on specific devices in long sessions." Roblox publishes no cross-platform float determinism guarantee, and native codegen being server-only means server and client run different code paths. Keep the *discipline* it implies (pure sim module, owned PRNG, dense-array iteration) because that discipline is free and valuable. Skip the mechanism. |
| **Parallel Luau** | Roblox's own guidance: putting scripts under Actors changes nothing without `task.desynchronize()`, and instances cannot be modified in a parallel phase, which means the actual CFrame write (the point of the loop) must be serial anyway. Reach for it only if profiling proves the serial loop insufficient. |
| **`EditableImage` fog for v1** | Per-tile opaque tint driven by one integer is two hours of work and needs no new API. `EditableImage` is capped at 1024x1024 with an undocumented, deliberately dynamic, client-only memory budget that returns `nil` on failure. Polish upgrade only. |

---

## 5. UI SYSTEM

### Build it on the native styling engine, not a bespoke theming layer

Roblox now ships `StyleSheet` / `StyleRule` / `StyleLink` / `StyleDerive`: design tokens (as `$`-prefixed attributes, i.e. CSS variables), CSS-equivalent selectors (`.Tag` via CollectionService, `#Name`, `>` direct child, `>>` descendant, `::UICorner` pseudo-instances), state selectors (`:Hover`, `:Press` mapping to `Enum.GuiState`), device/input query selectors (`@ViewportDisplaySizeSmall/Medium/Large`, `@PreferredInputTouch/KeyboardAndMouse/Gamepad`, `@ReducedMotionEnabledTrue`), and native property transitions via `StyleRule:SetPropertyTransition`.

Author one `BaseStyleSheet` in ReplicatedStorage holding colour, spacing, radius, elevation, type, and motion tokens, before writing any screen. **Only one StyleSheet can apply to a given tree**, so each ScreenGui needs its own `StyleLink`, all deriving from the base.

### ScreenGui topology, fixed on day one

`HUD_Static`, `HUD_Live`, `Placement`, `Modal`, `Toast`, `World`. Explicit `DisplayOrder`. `ResetOnSpawn = false` on persistent ones. **No non-visual Instances inside any ScreenGui** (no ModuleScripts, no value objects, no config).

The reason: the documented `Rebuild Z-order list` cost triggers when an element is added, removed, or has its `ZIndex` changed, and "the more elements a LayerCollector has, the worse it performs." A 2019 Roblox staff post makes the stronger claim that *any* property change on *any* descendant invalidates the whole LayerCollector; the current docs do not restate that, so treat it as unverified. Either way the static/dynamic split is cheap insurance and costs nothing to do up front.

### Ten rules that separate this from default-looking Roblox UI

1. **Ban `TextScaled` from the HUD.** Roblox states it "takes about 10x more time to layout" and, decisively, text with `TextScaled = true` **is exempt from the player's `PreferredTextSize` accessibility setting**. A TextScaled HUD is both slow and silently inaccessible. Use fixed `TextSize` from the token scale plus `AutomaticSize.Y` with `TextWrapped`.
2. **Publish a typography inventory and enforce it:** 2 families, <= 6 sizes, <= 3 weights. The engine packs glyphs into a font atlas and "when this texture runs out of space, you will start seeing artifacts like text on screen constantly flickering." Never tween `TextSize` (burns a unique size every frame); tween `UIScale` or use `MaxVisibleGraphemes` for typewriter reveals. No custom font upload exists on Roblox, so build identity from weight, tracking, `UIStroke` (the two-stroke pattern, contextual on text plus a second for the border), `LineJoinMode`, and `UIGradient` instead.
3. **One sprite atlas.** `ImageRectOffset` / `ImageRectSize` for every icon; 9-slice (`ScaleType = Slice`) for every panel frame; `PreloadAsync` during the loading screen. ~100 sprites become 1-2 texture binds.
4. **`UIShadow`, not 9-slice shadow images.** Roblox: "consistently faster than 9-sliced ImageLabels," with a stated ceiling of 100 on screen at once. Three elevation tokens, same `Offset` direction everywhere. Note `Offset` and `Spread` are `UDim2`, `BlurRadius` is `UDim`. `UIShadow` shadows the bounding box of a TextLabel, not the text; use a second `UIStroke` for text depth. Add a debug counter that warns above 80.
5. **Transparency 0 or 1.** Premium glass is one pre-baked `ImageLabel` treatment, not four live translucent layers.
6. **Honour all three accessibility settings from build one:** multiply `BackgroundTransparency` by `GuiService.PreferredTransparency` on tagged elements; size containers with `AutomaticSize` so `PreferredTextSize` can grow text; set tween `Time = 0` when `ReducedMotionEnabled`. Nothing communicated by colour alone (over 5% of players have some form of colour blindness).
7. **Motion is asymmetric and boring by default.** Quad or Quint, `EasingDirection.Out`. 0.10-0.14 s press feedback, 0.18-0.25 s enter, 0.12 s exit. `Back`/`Elastic` reserved for wave-clear and draft reveal only. Prefer `SetPropertyTransition` in the stylesheet for state motion; hand-write Tweens only for orchestrated sequences.
8. **Every interactive element gets all three feedback channels:** an authored `:Hover` and `:Press` visual, an `Enum.HapticEffectType.UIClick` `HapticEffect`, and a sound. This is the single clearest differentiator from stock Roblox UI and the stylesheet makes it a one-time declaration rather than per-button handlers.
9. **The draft-card trap.** Do not combine a tweened `UIScale` with `AutomaticSize` children inside a `UIListLayout`. Roblox staff closed this as "a limitation of our current layout system" and converted it to a feature request with no workaround. The reporter also observed lag on *any* open/close tween, so validate the mitigation. Give cards fixed `Size` (Scale) plus `UIAspectRatioConstraint`, animate Position/Rotation/Transparency, and reserve `AutomaticSize` for static-at-rest text.
10. **Kill every Roblox artefact:** no default blue `SelectionImageObject`, no default `ScrollBarImage`, no stock grey `TextButton`, no `SourceSans`.

Responsiveness comes from `GuiService.ViewportDisplaySize` (physical panel size from vendor APIs, not resolution), driven through `@ViewportDisplaySize*` style queries. Do not write a pixel-breakpoint script.

### The mobile / touch placement flow

This is the highest-risk UX area in the project and it has no shipped precedent. Here is the design to prototype.

**Invert the usual pattern: the reticle is fixed and the planet moves under it.**

1. Bottom rail of tower cards, thumb-reachable, each target >= 9x9 mm (Roblox's stated minimum, derived from a W3C Mobile Accessibility Task Force note, not WCAG). Stay clear of the bottom-left and bottom-right corners, which the default mobile controls reserve.
2. Tap a card to enter placement mode. **The tower does not attach to the finger.**
3. A reticle appears at a fixed point slightly above screen centre, permanently outside the thumb zone. The tile under the reticle is the target. Because the reticle never moves, the finger never occludes the target, and there is no hover state to miss.
4. Drag anywhere on the lower two-thirds of the screen to **orbit the planet under the reticle**. Pinch to zoom. The camera moves; the reticle does not.
5. Resolve the reticle to a tile with closed-form ray-sphere intersection plus a nearest-tile-centre lookup against the precomputed table. Highlight with a ring plus a validity glyph. **Shape + colour + icon, never colour alone.**
6. Confirm with a large dedicated Build button; Cancel opposite it. Both clear of the reserved corners. **Never commit on finger-up.**
7. Haptic tick on tile change, haptic + sound + visual on confirm.
8. Long-press a placed tower to open a radial: upgrade, sell, target priority (First / Last / Strongest / Weakest is the shipped genre convention).

This scheme falls out cleanly to the other inputs: on gamepad the left stick orbits and A confirms (no selection graph needed for the world, only for menus); on mouse, keep the same reticle so the three platforms share one code path, or allow direct hover as an affordance.

**Coordinate space, pick one and assert it.** `UserInputService:GetMouseLocation()` explicitly "does not account for the ScreenInsets," and `ScreenPointToRay` **does** account for the GUI inset while `ViewportPointToRay` **does not**. Mixing them lands every tower a fixed number of pixels from the finger and reads as a camera bug. Standardise on `GetMouseLocation()` + `ScreenPointToRay`, and write a one-off on-device test that draws a marker at the ray hit under the finger. Also: `GuiService:GetGuiInset()` returns `(0,0,0,0)` for the first frames; wait on `GuiService:GetPropertyChangedSignal("TopbarInset")` rather than caching the first read (a legitimately-zero inset exists).

**Use `UserInputService.TouchTapInWorld`, not `TouchTap`**, so HUD taps never leak into placement.

**Security:** the client sends only an **integer tile index**. Never a Vector3, never a CFrame, never a price. The server validates a bounded integer against its own tile table. This eliminates an entire exploit class by construction (no float to smuggle, no NaN to inject, no out-of-bounds position to construct), and it is the same encoding used for replication.

**Route all input through the Input Action System** (out of beta, publishable) with three `InputBinding`s per action, and branch on `UserInputService.PreferredInput`, never on `TouchEnabled` (which reports false on some touch-capable desktops, and a phone with a Bluetooth pad is a gamepad player). Note `InputActionLabel` and the Input Action Manager plugin are still beta.

---

## 6. RISKS, RANKED

**1. Mobile placement on a rotating sphere. No precedent exists.**
Sinks the project by making the core verb feel broken on the platform where most players are. Everything else is downstream of this.
*Cheapest experiment (2-3 days):* greybox with no gameplay. Sphere, hexsphere tile overlay, fixed reticle, orbit drag, confirm button. Deploy to a real sub-2 GB Android. Ten testers place 20 towers each. Measure misplacement rate and median time-to-place. **Do this before writing a single tower.**

**2. Legibility. Half the board is always hidden.**
Sinks it slower: players lose runs to threats they could not see and quit. This is the risk nobody in the research raised.
*Cheapest experiment (same greybox, +half a day):* spawn dummy enemies on the far hemisphere and let testers play a fake wave. Watch whether they rotate compulsively, and whether they notice being flanked. This settles the hemisphere-cap decision, which then constrains planet radius, camera distance, hexsphere frequency, and 15 waves of frontier pacing.

**3. Frame and bandwidth cost at wave 15 on the baseline phone.**
Every server-cost number in the research is either a Humanoid measurement or an extrapolation of one. Nobody has measured the proposed architecture.
*Cheapest experiment (2 days):* 300 pooled anchored MeshParts on the sphere, driven by the real 20 Hz sim through the real Zap channel, with 30 towers doing spatial-hash targeting, plus the wave-15 VFX storyboard. Read all four drawcall counters, `DataReceiveKbps`, `HeartbeatTime x 1000`, and a MicroProfiler capture. Also verify the instancing claim directly: spawn 300 identical MeshParts, read `SceneDrawcallCount`, then vary one property at a time and find where the count jumps. That single test validates the entire art pipeline before any art is made.

**4. Solo-developer scope collapse.**
15 waves x 8 towers x 20 powers x 3 planets x novel controls x a full UI system x monetization x live-ops is already more than most solo Roblox projects ship.
*Cheapest experiment:* build the vertical slice (one planet, 15 waves, 4 towers, 12 powers, full UI, full monetization) end to end, timeboxed to 8 weeks. If it slips, cut content, never polish. A polished 8-wave game beats a rough 15-wave one on every discovery signal Roblox measures.

**5. Publishing gate delays launch by an unknown amount.**
All-Ages requires ID verification, 2FA, an active paid subscription, and a staged evaluation during which the game is 16+-only. Roblox itself warns this "may lengthen the time it takes for new games to grow their playerbase."
*Cheapest experiment (one afternoon, today):* complete ID verification and 2FA, subscribe to Plus, and publish an empty place through the All-Ages flow to observe the evaluation process before there is anything to lose.

**6. Balance blowup from multiplicative power stacking.**
Fifteen stacking drafted powers x a rising tier cap x evolving enemies is a multiplicative space. TDS's most-cited community complaint is violent balance swings from far simpler additive systems.
*Cheapest experiment:* because `src/shared/Sim` is pure Luau, run it headless under Lune. Sweep 10,000 random draft permutations per planet, chart clear rate and time-to-clear distributions, and flag any power pair whose joint clear rate exceeds a threshold. This costs a day and is impossible if the sim module is not kept engine-free, which is the main reason for that rule.

**7. Progression loss or duplication from DataStore races.**
Permanent planet unlocks plus fast rejoin plus multi-server residency is the textbook dupe setup, and it is far harder to unwind after launch than to prevent.
*Cheapest experiment:* ProfileStore plus a deliberate two-server rejoin race test on a live place. Verify the lock holds and that the failure path shows a retry overlay rather than defaults.

**8. Thermal throttling arrives at wave 12-15, exactly at the climax.**
Benchmarks on a cold device will not reproduce it, and the symptom presents as "the boss fight is laggy," not "the device is throttling."
*Cheapest experiment:* run a full 20-minute session on a heat-soaked phone, not a cold one. Throttle your own sim and replication tick during the draft screen and between waves; halt VFX and the enemy tick when the client is backgrounded. Note there is no supported API for an experience to cap its own render framerate; your only lever is your own workload.

**9. First-play bounce rate tanks discovery.**
A top-tier negative ranking signal with explicit `<60s` and `61-180s` buckets. Off-platform marketing does not compensate, because Roblox "doesn't count the engagement, monetization, or retention of users first acquired from ads, curation, friends, search, social media, or any other source in the ranking stage of Recommended for You."
*Cheapest experiment:* instrument both buckets from day one and treat them as the primary launch KPI, above revenue.

**10. React-lua dependency continuity.**
Public packages are community-maintained; Roblox stated in May 2024 it "does not release react-lua in a way that's directly usable into your Roblox Studio projects," and nothing since.
*Cheapest experiment:* check commit recency and open-issue health at decision time, vendor the `.rbxm`, pin the exact version, and keep the static chrome as plain Instances so a React problem is contained to the dynamic screens.

---

## 7. OPEN QUESTIONS

### Owner decisions needed before engineering starts

1. **Is there a player avatar on the planet surface? The answer must be no.** This is the single load-bearing decision. Yes doubles the schedule and bets on an API that provably does not do what it appears to.
2. **Does the run take place on ONE planet, or does a session chain multiple planets?** The spec reads as one planet per 15-wave run, with 99 planets as the meta ladder. Confirm explicitly; it changes run length, meta pacing, and the entire unlock economy.
3. **Does the revealed frontier ever exceed one visible hemisphere?** Recommendation: no. If the owner wants full-globe gameplay, risk 2 becomes risk 1 and the whole control scheme needs rethinking.
4. **Is frontier expansion automatic per wave, or a resource the player spends?** The research's claim that 99 Nights lets players choose an expansion *direction* was refuted (its campfire unlocks a concentric radius). But the underlying idea still has merit as *our* invention: waves grant "terraform" charges; the player spends one to push the frontier along a chosen arc. That converts expansion from a cutscene into a decision, and it pairs naturally with a hemisphere cap. Owner call, and it should not be sold as copying anything.
5. **Co-op at launch: yes or no?** Recommendation is no (see §4). If yes, the follow-on decision is per-player draft (recommended, matches the Pelt Trader model) versus party draft, because it determines whether power scales linearly or superlinearly with headcount.
6. **How many planets ship at launch?** Recommendation: 3.

### Needs a prototype, not more research

7. **Planet radius and camera distance.** Grey-box R=300 and R=900 and judge feel first, then check for jitter with the camera at 3,000 studs. R=300 keeps the camera at ~750-1,500 studs, well clear of the only reported jitter band; R=900 does not.
8. **Hexsphere frequency: 642 tiles (n=8) or 2,562 (n=16)?** Downstream of the frontier-cap decision. 642 fits a 10-bit tile ID; 2,562 needs 12. Both bit widths propagate into the replication packet format, so decide before writing the Zap schema. (Note the research contained two contradictory tile-count formulas. The correct one for a Goldberg dual at frequency n = 2^k is `10n^2 + 2` = `10 * 4^k + 2`: 162, 642, 2562, 10242. Exactly 12 cells are pentagons, always, and they are where distortion peaks. Assign them a deliberate role, core site or boss spawn, or exclude them from building.)
9. **Does the R6/R15 DevEx rule apply to a game with no character at all?** Real money is attached (42% uplift on US 18+). The rule says characters must spend "100% of active playtime" as R15 or an approved custom rig, and "if a player can spawn into or swap to a R6 avatar at any point during active playtime, your game is not eligible." With `CharacterAutoLoads = false` there is no avatar to be either. Nobody in the research noticed this interaction. Either read the eligibility docs closely or spawn an anchored, invisible, non-colliding R15 dummy (which also solves the `StarterGui` to `PlayerGui` copy problem, since with no character spawn the UI silently never appears).
10. **The real `UnreliableRemoteEvent` payload ceiling.** Docs say 1000 bytes; community measurement suggests ~3,873; the "908" figure is unsourced. Send increasing payloads until the engine warns, on a live server and a mobile client, and record the boundary. Size chunks to 800 in the meantime and assert in dev.
11. **Does hand-rolled horizon culling pay after the engine's own frustum culling?** MicroProfiler A/B at peak enemy count, measuring render time and client Luau time separately. Expect the render delta to be small and the Luau/particle/billboard delta to be large, but that is a prediction.
12. **Does `--!native` do anything on the client?** Docs say server-side scripts. Docs are not always exhaustive, and the answer determines whether the shared-sim symmetry the architecture assumes actually holds. Identical hot function, timed with `os.clock` over many iterations, on both sides.
13. **Real UI cost of the wave-15 HUD.** Roblox's UI performance guidance is thin and the community evidence is 2018-vintage against a since-rewritten layout system. Build the peak HUD state (boss phase bar, full tower rail, full power inventory, live counters) and read `UI2DDrawcallCount` plus a MicroProfiler capture. There is no published number to plan against.
14. **Actual run length distribution.** The 12-18 minute target is inferred from *average session* figures in games with lobbies and idle time, which are not comparable to a single run. Instrument real run duration in a playable build before locking wave pacing against the 10-minute Creator Rewards floor and the 60-minute playtime credit cap.