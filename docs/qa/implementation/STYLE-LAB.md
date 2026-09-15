# Illustrative style lab

2026-09-15. Owner: Codex. Branch: `feature/illustrative-style-lab`, from V2 `496c9a2`.
Status: published and publicly verified at V2 `232d31b`. Usage: unmeasured.
[Live comparison](https://majieddd.github.io/worldheart/v2/style-lab.html) ·
[Hybrid close-up](https://majieddd.github.io/worldheart/v2/style-lab.html?style=hybrid&view=ground) ·
[PR #48](https://github.com/majieddd/worldheart/pull/48) ·
[Successful Pages action](https://github.com/majieddd/worldheart/actions/runs/35018076525).

## Reference
The owner's request is an isolated 3D graphics experiment, not a game overhaul.
Three directions: retro anime, Borderlands-inspired ink, and their hybrid.
The three supplied images constrain the hybrid's outlines, warm stone, violet
shadow masses, painted strata, restrained highlights and illustrative scuffs.
Their characters and depicted activities do not add gameplay requirements.

## Pillars
Compare identical geometry, camera, animation phase and light across styles.
Make differences visible in shading and surface marks, not palette alone.
Use a small pocket world, simple towers and units to judge a complete scene.
Keep the production renderer and campaign saves independent of the experiment.

## Core loop
Open `style-lab.html`, compare all three scenes, orbit, choose a close view,
inspect one style, change lighting, and toggle ink or texture to see its contribution.

## Kit
Code-authored kit in `js/style-lab-scene.js`: one curved terrain slice, layered
rock stacks, crystal heart, two tower types, three block-rig scouts, shrubs,
stones, ground markings and four material specimens. No downloaded asset packs.

## Concept
The owner's three attached illustrations are the concept references.
The live three-way render is the review sheet. No generated still is represented
as a 3D result. Saved browser frames will accompany runtime verification.

## Mechanics
### Synchronized inspection
Purpose: compare treatments fairly.
Experience: dragging any viewport moves all views together.
Inputs: pointer drag, wheel, arrow keys, view and style buttons.
Outputs: one shared camera and scene rendered through three material recipes.
Edge cases: mobile stack, resize, reduced motion and context loss.
Failure: a visible WebGL error with reload guidance replaces a silent empty scene.

### Material isolation
Purpose: expose the style decisions.
Experience: inspect stone, armor, foliage and crystal, with ink/texture toggles.
Inputs: specimen view, lighting selection and material toggles.
Outputs: consistent geometry with separate bands, contour widths and mark density.
Edge cases: full-width style focus and returning to comparison.
Failure: renderer faults are retained during QA and repaired before publication.

## Numbers
| Value | Number | Rationale |
|---|---|---|
| Style recipes | 3 | Exactly the requested alternatives |
| WebGL contexts | 1 | Shared scene, bounded GPU use and synchronized comparison |
| Pixel ratio cap | 1.5 | Readable ink with bounded fill cost |
| Towers / scouts | 3 / 3 | Small enough to inspect individually |
| Frame delta cap | 1/30 second | Prevent animation leaps after tab switches |
| Interface targets | 48 px | Mouse and touch access |

## Content
World view shows the whole terrain and all models. Ground view inspects units
against the cliffs. Material view shows four specimens together.

## Interface
Navy Worldheart chrome, cyan selected controls, system type, three aligned
viewports and a compact design recipe below. Scene palettes belong to each
experiment. No permanent campaign HUD or save controls.

## Build order
1. End-to-end inspection: boot, render all three, orbit, focus, return.
2. Distinct materials and references applied to the shared kit.
3. Responsive input, runtime QA, publication and public identity verification.

## Verification
Run syntax/style/core suite, a targeted browser harness, capture all style/view
combinations, compare rendered pixels, exercise real input, check save isolation,
responsive geometry, reduced motion and public asset identity. This is a visual
slice; a campaign playthrough is outside its independent entry point.

## Decided
| Decision | Status | Evidence |
|---|---|---|
| Separate opt-in page | in game | local/results.json: independent entry, unchanged storage |
| Three true 3D treatments | in game | local/compare-world.png and 39 browser cases |
| Final art direction | not yet | Owner comparison follows delivery |

## Task list
| Item | State | Acceptance |
|---|---|---|
| U158 three style recipes | verified | Distinct live render of the same world |
| U159 comparison and style guide | verified | Synced camera, focus, specimens, controls |
| U160 verification and preview | published | 39 public browser cases and 193 file identities pass |
| Owner art acceptance | planned | Owner chooses after inspecting the slice |

## Where we are
The graphics lab is implemented and locally verified. No normal gameplay renderer
changes. `local/results.json` records 39 passed checks: live geometry, rendered
differences, full-width inspection, real mouse/keyboard/touch, lighting, texture
and ink switches, storage isolation, PNG export, computed text contrast,
responsive 375/768/1280 layouts, reduced motion and graphics context recovery.
Desktop Chrome sampled 358 intervals: median 6.9ms, p95/p99 7.1ms. This is a
small native desktop test, not physical phone or full-campaign performance.
The core suite passed 361 tests; 111 source modules parse; 156 mirror files match.
The real blueprint checker passes 14/14 sections. Lobby navigation was exercised
at 1440px desktop and 390px touch widths. No campaign rule or camera file changed.

The initial shadow artifact is retained in `retained/initial-self-shadowing.png`.
A depth texture, back-face shadow casters and normal-offset receivers reduce the
self-shadow speckling exposed by discrete cel bands. Shadow-map edges can still
alias at extreme zoom. These are prototype shaders and block geometry, with
procedural illustrative marks, not final authored textures or production-ready
art. The owner has not yet selected or accepted a direction.

Resume locally: `node tools/serve.mjs 8152`, then `/style-lab.html`.
Reproduce browser QA: set `WH_NODE_MODULES` to the external Playwright/Sharp
runtime, then `node tools/qa-style-lab.mjs artifacts/style-lab/qa`.

Public verification: `public-results.json` passes the same 39 browser cases.
`public-identity.json` matches all 193 live asset hashes to the exact preview
and production revisions. V2 is `232d31b5b50b75f9d60b185fe2c0d48635214470`;
main remains `1374122`. Public frame sample: 356 intervals, median 6.9ms,
p95 7.1ms, p99 13.9ms. `public-compare.png` and `public-hybrid-ground.png`
are actual public browser captures. The evidence-only closeout does not change
the deployed runtime. Existing production rendering and campaign code are
unchanged; only the V2 lobby gains a link to the separate lab.
