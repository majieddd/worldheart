# Working on WORLDHEART

Standing instructions for anyone - human or agent - changing this repo. Read this
before your first edit. It is short on purpose; everything in it is here because
something broke without it.

## Run it

```bash
node tools/serve.mjs 8137      # then open http://127.0.0.1:8137
node tools/syntax.mjs          # parse all 31 modules as ESM
node tools/test.mjs            # 128 headless tests, no browser
node tools/style.mjs           # the house style rules a machine can check
node tools/deploy.mjs          # refresh v2/ and dist/ before you commit
```

`syntax.mjs` is not optional politeness. `node --check` parses these files as
scripts, because there is no manifest telling it otherwise, so it passes modules
that are genuinely broken - a regex edit once welded two statements onto one line
across five sites and `--check` was happy with all of them. `syntax.mjs` imports
each file as ESM instead, which is what the browser will do.

There is **no `package.json`**, no install step and no lint. Node 24 auto-detects
ESM in `.js`, which is why none is needed. `npm test` and `npm install` will both
fail; that is expected, not a broken checkout.

Do not "simplify" `tools/test.mjs` to `node --test tests/` - the directory form
misbehaves on this setup and the glob form is deliberate. Bare `node --test` also
picks up the runner itself and double-counts.

### URLs

`?map=<key>&seed=<n>`. Map keys: `pocket`, `giant`, `titan`, `reach`, `ninetynine`.
The roguelite mode is `?map=ninetynine`.

Two things will confuse you if nobody says them:

- **Map and seed persist to `localStorage`** (`whMap`, `whSeed`). A bare URL boots
  whatever you played last, not the default.
- **`?seed=N` is not the seed the game runs on.** Worldgen retries by advancing
  `CONFIG.seed` by 7919 per attempt (`js/nav.js`), so `?seed=771` reports 40366.
  It is deterministic, so sharing a seed still works.

## The shape of it

```
js/run/       THE PURE CORE - the 99 Planets run state machine. Imports nothing.
js/modes/     ninetynine.js is the ONLY file that knows both the core and Three.
js/*.js       the engine: world, nav, towers, enemies, allies, possess, ui, main
tests/run/    tests for the core. tests/tools/ tests the bundler.
v2/           a MIRROR of the app that Pages serves. Not "version 2".
dist/         the committed single-file build.
```

Read `docs/ARCHITECTURE.md` for what each engine module owns and where to add a
tower, an enemy or a commander.

## Invariants

These break **silently**. Each one has cost this project real time.

**1. `js/run/` imports nothing.** No `three`, no DOM, no `window`, no
`localStorage`, no `Math.random`, no `Date.now`. It takes `dt` and its RNG by
injection, keeps state plain and serialisable, models players as a list even when
solo, and reports what happened by returning events - it never calls the
renderer. This exists because the mode is going to Roblox/Luau, and
`tests/run/purity.test.mjs` enforces it. Anything needing storage or rendering
belongs in the shell.

**2. A unit's frame is orthonormal, and `fwd` is tangent.** `a.dir` is where it
stands, `a.fwd` where it faces. Moving `dir` without carrying `fwd` tips the
frame a little every step - it once reached 18° and slid the horizon off the
screen. Use `advanceToward(dir, target, arc, fwd)` and `reflatten`. Never rotate
one without the other.

**3. The nav graph is built once at the final frontier and MASKED, never rebuilt.**
`nav._buildGraph` reallocates every array, which would destroy `nav.block` (tower
footprints), `heartNode` and `portalNodes`. The frontier grows by moving a wall
and a mask, not by regrowing the graph.

**4. Pooled objects must reset every field.** `js/enemies.js` and `js/allies.js`
both pool. A field written outside `init()` and not cleared on release will be
inherited by the next occupant - this has produced enemies that spawned already
immune to being held.

**5. `renderer.autoClear` is on by default.** A second `renderer.render()` wipes
the **colour** buffer. The first-person view model pass must only ever clear
depth, or it draws the weapon onto a black screen with the whole world erased.

**6. Depth precision.** `near` is tied to altitude. Dropping it to 0.1 against a
far plane of 7200 is a 72,000:1 range and z-fights the terrain into nothing. If
something close needs to be visible, give it its own camera and pass.

**7. Removing a rule from the model does not remove it from the view.** This has
happened three times. Deleting the tower tier cap left the UI still hiding the
Upgrade button at MK III. Adding a marquee that claimed every left mousedown
killed click-to-possess, tower selection and building. When you delete or change
a rule, grep for every place that assumed it.

**8. The camera defaults in `js/config.js` were playtested by the owner.** Several
deliberately reverse an earlier rationale. Do not "correct" them without asking.
`WH.camTest()` in the console is the fastest regression check in the project -
13 checks, and it must stay green on all five maps.

## Verifying

The test suite covers the pure core and the bundler. **It does not cover the
shell, the renderer, or any gameplay system** - that is a known gap, and it is
why so many defects here were found by playing rather than by CI.

So "done" means:

0. `node tools/syntax.mjs` and `node tools/style.mjs` green. Both are seconds.
1. `node tools/test.mjs` green.
2. The thing you changed observed **in the browser**, not reasoned about. Drive
   it with `WH.step(seconds)` for deterministic advance, and read state off the
   `WH.*` handles rather than trusting a screenshot alone.
3. `WH.camTest()` green if you went near the camera.
4. The four classic maps still boot and behave, if you touched shared code.
5. `node tools/deploy.mjs` run, so `v2/` and `dist/` are not stale.

Verify each feature end to end, then **play a whole run**. Per-feature checks
have passed here while the mode was unfinishable: an inverted shield made every
enemy immortal from wave 12, a unit could pin an enemy forever, and wave
completions were being dropped - none of which any isolated test could see.

## House style

Comments explain **why**, not what, in full prose sentences. Match the density of
the file you are in. When you fix something subtle, say what the wrong behaviour
was - most of the comments in this codebase are load-bearing for exactly that
reason.

**No em dashes** anywhere: in code, comments, copy or docs. Use " - ".

Commit messages are long and explanatory. They describe the defect, the cause and
the measurement, not just the change. `git log` is the real design record here -
read a few before writing one.

## Known gaps

Honest list, so you are not surprised:

- **No shell tests.** Everything outside `js/run/` is verified by hand.
- **Sun elevation swings across a playfield** (measured 3° to 61° on one seed). A
  60°-wide cap under a fixed sun has a gradient by construction; fixing it needs
  a per-field sun or a smaller cap.
- **`docs/superpowers/`** is a historical record. The specs and plans describe
  what was intended in early September 2026 and several details have since
  changed. Every file there carries a status header saying so. Trust the code.
