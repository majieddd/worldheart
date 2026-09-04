> **HISTORICAL RECORD.** This file records what was intended when it was
> written. It was not maintained afterwards and several details have since
> changed in the code. Treat it as background on the reasoning, not as a
> description of the current game. For that see [README](../../../README.md),
> [CLAUDE.md](../../../CLAUDE.md) and
> [docs/ARCHITECTURE.md](../../ARCHITECTURE.md).

# 99 Planets — design

Status: approved in principle 2026-09-03. Phase 1 is specced to build. Phase 2 is a stated
target that constrains phase 1's architecture; it gets its own spec.

## What this is

A roguelite campaign mode for WORLDHEART. You start fogged in on a scrap of a planet with one
tower and fight outward. Each wave survived widens your territory and hands you a power. Every
other wave gives you a new tower, every third wave the enemies change, and the fifteenth wave is
a planetary boss. Beating it banks the planet and opens the next one, larger and in a different
biome.

Owner's references: Planetary Annihilation TITANS for the planetary scale, *99 Nights in the
Forest* for the expanding survival cycle, Megabonk and Risk of Rain for stacking run powers.

## Two phases, and why phase 1 looks the way it does

| | Phase 1 (this spec) | Phase 2 (later spec) |
| --- | --- | --- |
| Engine | WORLDHEART, Three.js | Roblox, Luau |
| Players | Solo | Co-op 1–4 |
| Core | Pure sim modules | Same logic, transliterated |
| Shell | Three.js + DOM | Instances, Remotes, GUI |

Phase 2 is not hypothetical, so phase 1 is built portable. The cost is a discipline, not extra
features, and it removes a full rewrite later.

### Portability contract

Binding on everything under `js/run/`:

1. **No imports of `three`, no DOM, no `window`, no `localStorage`.** Pure data in, pure data
   out. Anything ambient is injected by the caller.
2. **No floating-point wall-clock.** The core advances by an explicit `dt` passed in.
3. **Randomness is injected**, never `Math.random()` directly — the core takes a seeded RNG
   function. This also makes runs reproducible for tests and for seed sharing.
4. **State is plain serialisable data.** No class instances holding renderer handles, no
   `Vector3` in run state — directions are `{x, y, z}` literals.
5. **Players are a list, always.** Solo is `players.length === 1`. No code may assume one player.
6. **The core never calls the renderer.** It returns events (`towerUnlocked`, `frontierGrew`,
   `waveCleared`) that the shell consumes.

Rule 6 is what makes the Roblox port a transliteration: the shell differs entirely between
engines, the core does not.

## Run structure — 15 waves

| Wave | Beat |
| --- | --- |
| After each cleared wave 1–14 | Draft 1 of 3 powers; frontier expands |
| 2, 4, 6, 8 | Unlock a random tower |
| 10, 12 | Raise the global tower tier cap (→2, →3) |
| 3, 6, 9, 12 | Enemy evolution tier increments |
| 15 | Planetary boss |

Opening state, before wave 1: Bolt only, tier cap 1, frontier 0.12 rad.

Clearing wave 15 ends the run, so it grants no draft and no expansion — the boss reward is the
planet itself.

Fifteen waves is chosen for a 12–18 minute run, long enough that the wave-8 tower ceiling is not
the end of progression.

**The five-tower problem and its fix.** There are only five tower types (Bolt, Cryo, Mortar,
Tesla, Helios). Bolt is granted, so unlocking one every other wave exhausts the roster at wave 8.
Rather than invent towers, later even waves raise a **global tier cap** instead, reusing the
`tiers` array and `tierCost` that already exist in `towers.js`. Towers therefore keep improving
after the roster is full, and the every-other-wave beat never goes silent.

## Frontier

The fog is a hard frontier, not a vision effect. Outside it you cannot build, and it is the edge
of the played world.

- θ starts at **0.12 rad** and reaches **0.52 rad** after wave 14 is cleared, on an ease-out
  curve, so early expansions read as dramatic and late ones as incremental. Fourteen expansions
  total; the boss wave adds none.
- Reuses the existing battlefield-cap machinery: `rig.confine`, `buildFieldWall`, and the
  outside-haze treatment already shipped for Titan's Brow.
- Portals light at the rim as it grows: `1 + floor(wave / 4)`.
- Clearing the boss reveals the whole globe.

The core owns θ as a number. The shell decides what a wall and haze look like.

## Powers

Drafted 1 of 3 after every wave. Rejected offers are gone, so the choice has teeth.

Powers write **only** to a modifier object; towers, economy and enemies **only** read it. Without
that rule, twenty powers need hooks in twenty places.

| Family | Examples |
| --- | --- |
| Offense | +12% damage, +10% fire rate, +8% range, +5% crit, chain to +1 target |
| Economy | +15% kill gold, 3% interest per wave, −10% tower cost, 90% sell refund |
| Defense | +2 lives, heart regen 1/wave, slow aura at the heart |
| Build-defining (rare) | Bolt pierces, Mortar leaves burning ground, Cryo hard-freezes, every 5th shot doubles |

Roughly twenty powers: mostly numeric so they compose cleanly, with four specials to give a run
its identity. Rarity weighting makes strong offers occasional rather than reliable.

Powers belong to the **run, not the player**: a draft yields one power for the whole team. Gold
is the per-player quantity. Phase 1 has one player, so the distinction is invisible in play, but
the data model must already separate them or co-op is a restructure.

## Enemy evolution

At waves 3, 6, 9 and 12 the evolution tier increments. Each tier adds a trait **and a visual
tell**, so the change is legible in play rather than only in the numbers:

1. **Armour** — flat damage reduction
2. **Swift** — movement speed up
3. **Shielded** — regenerates if undamaged for 3 s
4. **Splitting** — mites divide on death

## Boss

Wave 15. A three-phase Colossus, reusing the existing `colossus` enemy and the boss slot already
present in `waveComp`:

1. Armoured approach
2. Summons adds
3. Enrage — speed and damage up

## Persistence

`localStorage` key `wh99Progress`, shape `{ planetsBeaten: number }`. The victory screen banks the
win and states that the next planet is coming. The planet ladder itself is milestone 2.

Persistence is injected into the core, never called from it (contract rule 1), so phase 2 swaps
`localStorage` for a Roblox DataStore without touching run logic.

## File layout

```
js/run/
  run.js        run state machine: waves, frontier, unlock schedule, evolution, boss
  powers.js     catalog, rarity weighting, draft rolling, modifier resolution
  state.js      plain-data run state + serialisation
js/modes/
  ninetynine.js the shell: binds the core to world/camera/ui, consumes core events
```

`js/run/*` obeys the portability contract. `js/modes/ninetynine.js` is the only file that knows
both the core and Three.js. Existing files take small changes: `waves.js` (evolution, boss),
`ui.js` (draft overlay, locked shop cards), `game.js` (read the modifier object), `config.js`
(mode entry).

## Verification

The existing discipline holds: nothing is claimed working until it has been run.

- `WH.camTest()` must stay green on all four maps — this mode changes the camera confine, which
  is exactly what that harness guards.
- **Core unit tests run headless**, with no browser, because the core is pure. Seeded RNG makes
  them deterministic. This is the payoff of the portability contract arriving immediately rather
  than only in phase 2.
- A scripted full run through `WH.step`: asserts the frontier grows monotonically, unlocks fire
  on their exact waves, drafted powers measurably change damage, the boss dies, no NaN, no
  console errors.
- Screenshots at the opening frontier, mid-run and boss for visual confirmation.

## Out of scope for phase 1

Named so they are not half-built: the planet ladder, biome variety, size scaling per planet,
meta-currency, power banishing, co-op. Phase 1 ends at a complete single-planet run with a
victory screen.

## Co-op rules (phase 2, decided 2026-09-03)

Recorded now so phase 1's data model is shaped correctly and these are not re-litigated later.

- **Gold is per-player.** Each player earns and spends their own. Powers are not.
- **The power draft is shared and voted.** One power per wave for the whole team:
  1. The same three options are shown to everyone.
  2. Each player casts one vote.
  3. A **10-second timer** runs.
  4. It resolves **immediately** once every player has voted, without waiting out the clock.
  5. On resolve, the **plurality** wins.
  6. **Ties, and the zero-vote case, break on the run's seeded RNG** among the leading options.
     Seeded rather than wall-clock or host-decided so a run still replays identically, which
     keeps determinism for tests and for seed sharing.

Timer, vote counting and resolution live in the pure core and are driven by injected `dt`, so
they are unit-testable headlessly and identical on both engines.

### Follow-on, not yet decided

- With per-player gold, who may upgrade or sell a tower another player paid for? Needs an
  ownership or permission rule before co-op is built.

## Open questions for phase 2

- Whether a true sphere is viable in Roblox at all, or whether the planetary fantasy needs a
  different presentation there. Research is running separately and will land before that spec.
