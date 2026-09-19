# Painted Earth / U256-U261

Owner: Codex. Branch: `feature/painted-earth`. Base: preview/v2 `14b9dd7`.
Published runtime: `c015fd2`. [PR #77](https://github.com/majieddd/worldheart/pull/77).
September 19, 2026. The initial tracker claim reused U244-U249; those belong to
the Vey collaborator and are preserved. This work uses U256-U261.

| Item | Scope | State |
| --- | --- | --- |
| U256 | Approved Painted-Anime-Inkline 1.3.2 surfaces, contours and lighting in production | Implemented and visually inspected; owner acceptance open |
| U257 | Direct Earth arrival, centered revised story illustrations and first-person start | Desktop and touch verified |
| U258 | Action-driven spotlight tutorial, beginner wave gate, powers, loot and boss guidance | Opening, priority briefings and 10-wave lifecycle verified |
| U259 | Five wooden walls per scrap, enemy detours and breach behavior | Core routes and browser breach fixture verified |
| U260 | Procedural explorable structures/chests, debug lane, crystal scarcity and Solar relief | Rewards, visuals, home autosave/reload verified |
| U261 | Adversarial, desktop/touch, persistence, performance and public V2 verification | Published; 32 public opening/touch checks, 6 debug checks and 863 identities pass |

The existing approved art references and archived renders remain unchanged.
The production art pass reuses their surface treatment; it does not promote
unapproved Asset Studio animation candidates. Existing campaign and home saves
must remain readable. Ordinary entry starts or resumes the Earth-first campaign;
explicit homeworld, debug and generation links retain their destination.

Acceptance requires actual rendered play, not only source checks: compare the
arena and game, follow the new opening and beginner actions, validate wall
detour/breach and chest claims, inspect responsive layout, then publish to V2
and verify deployment identity. Main is not part of this release. Record staged
fixtures separately from natural gameplay and keep failed evidence.

## Implementation contracts

- The production material adapter imports the approved arena factory and the
  immutable ink132 preset. Pigment is surface anchored. Existing vertex colors,
  instancing, foliage sway, emissive warnings and polished metal maps survive.
  Chamfered tower/structure masses and broader crown clusters complement the
  materials. Daylight follows the spherical local normal; airless worlds keep
  space skies. This is a production surface and geometry pass, not acceptance
  of the collaborator's unapproved Asset Studio motion candidates.
- Four independent original paintings live in `lib/first-expedition/*-v3.webp`,
  with provenance in `panels-v3.json`. The older images remain available.
- The six initial objectives use actual game state. Waves and disasters remain
  held until the base upgrade or explicit guide skip. T lends the cursor to
  guide controls during FPS play; completed actions restore camera input.
  Powers arrive after wave one and every other wave thereafter. Wave two's
  last owed creature guarantees a weapon, including overlapping wave queues.
- Walls cost one scrap per five, have 180 HP, and add finite navigation cost.
  A viable detour wins; a sealed route remains reachable through a breach.
  Air paths ignore walls. Pooled enemies reset their breach cooldown.
- Four structure recipes have open entrances and deterministic chest rewards.
  Claimed chest IDs persist on home saves and through defense rollback. Walls
  restore their stock, orientation and HP. Terrain revisions re-ground both.
- Crystal generation uses two caches per expansion, a 24-cache cap and wider
  spacing; the opening places its caches outside the starting perimeter.
- New terrain version 2 increases Solar relief 30% and characteristic accents
  22%. Legacy version 0/1 saves keep their prior geometry and initial planet.

## Failed checks retained

Local artifacts are in `artifacts/painted-earth/`. Initial placement QA exposed
mutation of the Solar sampler's memoized relief records, producing runaway
heights. The fix uses immutable local scaling; a repeated fine/coarse query and
cache invalidation regression now passes. Later runs exposed a fixture using
`renderDir` instead of `_renderDir`, delayed crystal polling, an off-camera base
interaction fixture and pointer-locked guide controls. The probe now aims at
the actual base and presses F, and uses the player-facing T cursor shortcut.
One mobile run loaded an intermediate sky edit before its axis constant was
added; that failed report is retained and is not counted as acceptance.

The first landscape-phone checks found overlap with the invisible touch-stick
area and tower-placement buttons. The final guide uses a compact, expandable
card below the aiming reticle in landscape, and sits above the reticle in
portrait. A camera probe initially ran after victory, when camera input is
intentionally suspended; moving that probe into active play resolves the
fixture error. The final briefing probe also caught the temporary outside-base
warning remaining visible after returning to safety. Returning now clears it,
and later events replace unattended lower-priority guide cards.

## Local acceptance evidence

Committed evidence is in [painted-earth](../painted-earth/). Original full-size
captures, earlier failures and full command logs remain in the ignored local
`artifacts/painted-earth/` directory. Encoded review screenshots retain their
original framing; the JSON reports are unabridged.

- 416/416 automated tests; 175/175 JavaScript modules parse. The new assertions
  cover immutable Solar sampling, wall route choice/breach/air behavior,
  deterministic supplies, save validation, opening state and guardian retries.
- All 32 opening and responsive checks pass. Real browser interactions select, place and upgrade a tower, deposit
  a crystal, interact with the base, release the held countdown, switch views,
  and skip the guide. Wave/boss/claim briefs replace stale tips. Camera aim, crystal proximity, resource grants and boss
  events are explicitly staged fixtures, not a natural campaign completion.
- A separate accelerated fixture completes 10 waves through actual director
  queues. First-wave powers and the last wave-two enemy weapon pass. Large HP,
  lethal test damage and disabled weather make this a lifecycle check, not a
  difficulty or balance verdict. All five map camera regressions pass.
- Touch emulation at 390x844 and 844x390 verifies story overflow, first-person
  arrival, the real Build menu/card, aiming clearance, control clearance and
  skip. No browser runtime or shader errors were recorded in accepted runs.
- Home autosave/reload preserves a 111-HP damaged wall, four remaining wall
  items and an opened supply chest without manual save flags. Direct home
  links remain peaceful, fog-free and in third person.
- The approved meadow and production ground/strategy views were actually
  rendered and visually compared. The second pass reduced cyan foliage and
  added sparse instanced grass. Debug structures, upgraded bolt tower,
  commander and metallic weapon were individually inspected.

### Performance and acceptance limits

The seed-12345 desktop visual sample recorded 143 FPS, 6.15 ms work per frame,
116 draw calls and 1.20 million triangles. This is one headless desktop sample,
not a sustained physical-phone result. The same boot took about 38 seconds,
including 31.6 seconds in navigation and 4.0 seconds carving terrain. Another
opening took 21.4 seconds. The prior 5-second ideal / 10-second stretch loading
target remains open; this release does not claim it has been reached.

The production paint, palette, contours, chamfered tower/structure masses and
foliage are integrated. Existing instanced unit rigs and weapon silhouettes
remain; no unapproved concept model or animation has been silently promoted.
Owner judgment of the in-game artistic result and physical-device mobile
performance remain acceptance work, distinct from the automated checks.

## Publication

The [V2 deployment](https://github.com/majieddd/worldheart/actions/runs/35440915160)
succeeded for `c015fd263e23876bca758067640d6b857677f53e`. All 863 deployed
preview/production files matched the manifest and their exact Git sources.
Main remains `6133d0713f4e93e6fc743c35d9dd0fd1834bc98f`.

All 32 public opening/touch checks pass, including normal Earth entry,
centered paintings, FPS arrival, real build/upgrade/deposit controls, tutorial
briefing priorities, returning-assault behavior and portrait/landscape touch.
The public Structures lane renders all four buildings and the wooden wall;
its six checks pass without runtime or shader errors. Reports:
[opening](../painted-earth/public-opening.json),
[debug](../painted-earth/public-debug.json),
[exact identities](../painted-earth/public-identity.json).

Play [V2](https://majieddd.github.io/worldheart/v2/) or inspect
[Structures](https://majieddd.github.io/worldheart/v2/debug.html#structures/outpost).
For an isolated replay that leaves campaign progress alone, use the
[Earth first-defense sample](https://majieddd.github.io/worldheart/v2/?map=ninetynine&campaign=0&planet=earth&seed=12345&onboarding=1).
Later documentation-only commits can update the deployment identity without
changing these verified runtime assets.
