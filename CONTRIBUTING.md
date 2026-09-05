# Contributing to WORLDHEART

This is the front door. If you are new to the repo, read this page first, then
`CLAUDE.md`, then whichever document below matches what you are about to touch.

## What this is

A 3D tower defence fought on the surface of procedurally generated planets, with
a first-person mode you can drop into. About 16,500 lines of plain ES modules,
one vendored copy of Three.js, and nothing else. There is no bundler, no
transpiler, no package manager and no framework. The browser loads the source
files you edit.

That decision is load bearing. It is why the game boots from any static file
server, why a change is visible on reload, and why there is no `package.json`
for you to install from.

## Ten minutes to a running game

```bash
node tools/serve.mjs 8137
```

Open http://127.0.0.1:8137, pick **99 Planets** on the title screen, and press
Begin the defense. That is the mode most of the recent work targets.

Node 24 is what this is developed and tested against. It auto-detects ES modules
in `.js` files, which is the reason the repo needs no manifest. `npm install`
and `npm test` will both fail. That is expected, not a broken checkout.

The four commands that matter:

```bash
node tools/serve.mjs 8137   # serve the source tree
node tools/syntax.mjs       # parse every module as ESM (31 modules)
node tools/test.mjs         # 128 headless tests, no browser
node tools/deploy.mjs       # refresh the v2/ mirror and the dist/ single file
```

Run `syntax.mjs` before you trust a change. `node --check` passes broken modules
in this repo because there is no manifest to tell it the file is ESM, and a
welded-together statement has shipped that way before.

## Which document answers which question

| Question | Document |
|---|---|
| What is the game, what do the controls do, what is in it | `README.md` |
| What will break silently if I touch it, how do I run and verify | `CLAUDE.md` |
| Which module owns what, how do I add a tower, enemy or commander | `docs/ARCHITECTURE.md` |
| What are the actual numbers, and where do they live | `docs/GAMEPLAY.md` |
| What is this world, how should a new thing feel and be named | `docs/CREATIVE.md` |
| What colour, type, spacing and motion may I use | `DESIGN.md` |
| Where does the project stand, what is worth doing next | `docs/ROADMAP.md` |
| What does a finished batch of work look like | `docs/POLISH-2026-09-04.md` |

`docs/superpowers/` is a historical record of early plans. Several details there
are now wrong and every file says so at the top. Trust the code.

## Branch, because main is production

GitHub Pages serves `main` from the repository root. There is no deploy
workflow and no staging copy. **Anything merged to main is live at
majieddd.github.io/worldheart within about a minute.**

So: work on a branch, open a pull request, and let the checks run. If you have
push rights and are tempted to commit straight to main, that is the owner's call
to make, not a default.

Three copies of the game are published and all three must agree:

| URL | Source | What it is |
|---|---|---|
| `/worldheart/` | repo root | the live game |
| `/worldheart/v2/` | `v2/` | a mirror of the same files, kept because the URL was shared. Not a newer version |
| `/worldheart/dist/worldheart.html` | `dist/` | the committed single-file build |

`node tools/deploy.mjs` rewrites both and fails loudly if the mirror drifts. Run
it before committing anything under `js/`, `css/` or `index.html`. It is
deterministic, so running it twice changes nothing.

## The loop

1. Branch from main.
2. Make the change.
3. Verify it. See below, because this is the part with teeth.
4. `node tools/deploy.mjs`.
5. Commit with a message that says what was wrong, why, and how you measured it.
6. Open a pull request.

## What "done" means here

Done means observed, not reasoned about. The test suite covers the pure run core
under `js/run/` and the bundler, and nothing else. No renderer, no gameplay
system, no UI. Most defects in this project were found by playing.

A change is finished when you can quote the evidence:

- `node tools/syntax.mjs` and `node tools/test.mjs` green.
- The behaviour seen in the browser. Drive the simulation with `WH.step(seconds)`
  for a deterministic advance and read state off the `WH.*` handles. A screenshot
  alone is weak evidence, because the pane composites frames it never rendered.
- `WH.camTest()` green if you went anywhere near the camera. It is 13 checks and
  must pass on all five maps.
- The four classic maps still boot, if you touched shared code.
- A whole run played, not just your feature. Per-feature checks have passed here
  while the mode was unfinishable.

Numbers beat adjectives. "Detours went from 1.2 to 6.9 times the straight line"
is evidence. "Pathing feels better" is not.

## House style

The full rules are in `CLAUDE.md` and `DESIGN.md`. The short version:

- **No em dash character anywhere.** Not in code, comments, copy, documents or
  commit messages. Use a comma, a colon, or " - ".
- Comments explain **why**, in full sentences. When you fix something subtle, the
  comment says what the wrong behaviour was. Most comments here are load bearing
  for that reason.
- Player-facing descriptions lead with the mechanic and carry flavour in italics
  underneath. Never the other way round.
- Commit messages are long and explanatory: the defect, the cause, the
  measurement. `git log` is the real design record in this repo. Read a few
  before you write one.

## Things that will surprise you

Each of these has cost real time. `CLAUDE.md` carries the full list with the
reasons.

- **A bare URL boots whatever you last played.** Map and seed persist to
  `localStorage`. Without `?map=`, you are on Pocket World, a radius 30 planetoid
  with about 10,000 navigation nodes, not the radius 240 world the campaign uses.
  An afternoon of measurements has been taken on the wrong planet this way.
- **`?seed=N` is not the seed the world runs on.** Worldgen retries by advancing
  the seed per attempt, so `?seed=771` may report 40366. Still deterministic.
- **`js/run/` imports nothing.** No Three, no DOM, no `Math.random`, no
  `Date.now`. A purity test enforces it, because that core is going to Luau.
- **The navigation graph is built once and masked, never rebuilt.** Rebuilding
  reallocates every array and destroys the tower footprints.
- **Pooled objects must reset every field.** Enemies and allies both pool, and a
  field left set has produced enemies that spawned already immune.
- **A hidden browser tab throttles its timers to about one a minute** after a few
  minutes. Never poll in a hidden preview pane; the boot yields through a message
  port for exactly this reason.
- **Measure the world in world units.** Thresholds on a noise value are not
  widths, and graph hops are not distances. Both mistakes produced confidently
  wrong terrain measurements in one afternoon.

## Where to start

`docs/ROADMAP.md` has a list of work sized small, medium and large, with the
reason each one matters. The small ones are genuinely self-contained.
