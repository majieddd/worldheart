# Soft painted cel and ink study

2026-09-15. Owner: Codex, branch `feature/painted-cel-ink`, based on verified
V2 `232d31b` plus its evidence closeout `1975e9e`. Status: published and verified. Usage: unmeasured.

## User direction
The owner prefers anime + ink but rejects the boxy shadows and overly simple
models/environment. Add a further style with soft painted retro-anime texture,
rich illustrated nature and retained ink contours. Inspect the supplied
https://majieddd.github.io/worldheart-styles/ reference and consider AI 3D tools.
The site's no-contour direction is reference data; the current user request
explicitly keeps ink contours. Previous three studies remain available.

## Scope and plan
U161: a new opt-in painted study, layered environment and softly shaded surfaces.
U162: actual textured Meshy models from the owner's reference repository, with
source revision/hashes, consistent scale, fine contours and runtime inspection.
U163: input, rendering, asset, accessibility, performance and public verification.
This slice does not change production gameplay, saves, animation rigs or combat.

## Reference and asset contract
Reference source pinned at worldheart-styles `a7ade6bb5081ea852128becb42c0e9b14c64d020`.
Its README identifies the supplied retroanime commander, enemy and tower as Meshy
image_to_3d outputs through Higgsfield. This is repository-reported provenance;
no new Meshy generation is claimed. Existing models are about 1.3-1.5 MB GLB each.
Use the self-contained glTF JSON variants to retain their painted base textures.
The repository's three original style plates were inspected in a browser.

The local Aegis Meshy adapter is installed, but no MESHY_API_KEY is present in
this task environment. Plugin discovery found general generation providers,
not a connected Meshy tool. Reusing the supplied generated assets requires
neither a new provider connection nor another paid generation job.

## Acceptance
- A visibly richer live 3D environment with foliage, irregular rock, water and details.
- Soft painted light transitions and contact shadows, with optional fine contours.
- Commander, enemy and tower load with their embedded textures at sane dimensions.
- Compare soft paint and hard cel on the same new assets; inspect models up close.
- Real pointer, keyboard and touch controls; pause/reduced motion; no save access.
- Persist asset identities, screenshots and local/public verification.
- Owner aesthetic acceptance stays open after implementation and delivery.

## Pillars
1. Soft painted light with a restrained ink contour.
2. Textured, recognizable models and a layered natural environment.
3. Inspect the real 3D recipe on the same assets before choosing a direction.

## Core loop
Open the valley, orbit, inspect a model, compare its shading, then save a view.
No combat loop or campaign progression is included in this graphics slice.

## Kit
Three.js r180 and official matching GLTFLoader/BufferGeometryUtils. Source
meshes keep their embedded sRGB color maps. The environment is authored as
deterministic geometry, with merged grass and leaf meshes to contain draw calls.

## Concept
The reference site's Soft painted cel has warmth, pigment and simplified large
light masses. The owner's additional contour instruction takes precedence over
the site's no-contour description. The new valley explores mossy stone, wild
meadow, a stream and textured technology rather than repeating the first canyon.

## Mechanics
### Inspect and compare
Purpose: evaluate the painted treatment on richer models and terrain.
Experience: four camera subjects and synchronized two-pane soft/hard cel views.
Inputs: real pointer, keyboard and touch orbit, zoom, lighting and paint toggles.
Outputs: the same geometry in both panes, shareable view URLs and PNG exports.
Edge cases: phone layout, reduced motion, repeated views and graphics recovery.
Failure: a visible reload message and disabled export when an asset cannot load.

## Numbers
Three source models: 29,527 commander, 31,019 invader and 28,415 cannon triangles.
The scene includes two cannon instances, 10,716 curved grass blades and 360
flowers. One WebGL context; desktop valley renders about 593k triangles including
outlines, with 377 scene draw calls. These are bounded scene counts, not budgets
for a full campaign. Browser diagnostics expose actual counts for each view.

## Content
Exact Meshy asset hashes and source URLs: ../../../lib/painted/provenance.json
(repository path: lib/painted/provenance.json). Built-in image_gen created
lib/painted/gouache.png; its final prompt and provenance are in that folder's
README.md. No paid Meshy generation or new rig was performed.

## Interface
Existing navy/cyan contract, system type, 48px controls, visible keyboard focus,
stacked comparisons on phones. Computed text contrast and 375/768/1280 layouts
pass. The scene remains the main surface; implementation details stay in docs.

## Build order
Reference inspection; source model ingestion; representative environment and
painted shading; visual revision of faceted stone and triangular grass; browser
checks; publication; exact public asset and behavior verification.

## Verification
38 source-informed local Chrome cases pass: textured assets and hashes, finite
views, actual pixel changes, pointer/keyboard/touch, export, storage isolation,
AA text contrast, responsive layout, reduced motion, graphics recovery, missing
asset recovery and stable allocation across repeated camera changes. 361 core
tests pass. Detailed machine results are stored beside this document.
This is not blind playtesting, physical-device QA or owner aesthetic approval.

## Decided
| Decision | Status | Evidence |
|---|---|---|
| Keep earlier styles available | in game | Navigation between both test pages |
| Reuse the owner's Meshy outputs | in game | Three texture-bearing files match source SHA-256 |
| Smooth rock normals and blur shadows | in game | Inspected commander and cannon captures |
| Same-model shading comparison | in game | 38 browser checks and comparison screenshot |
| Final art direction | not yet | Owner review remains open |

## Task list
| Item | State | Acceptance |
|---|---|---|
| U161 painted environment | verified | Visible surface, lighting and contour differences |
| U162 textured model integration | verified | Three referenced meshes and textures load; hashes match |
| U163 public checkpoint | published | 38 public browser cases and 206 asset identities |
| Owner art acceptance | open | Owner inspects the fourth direction |
| Production model adoption | out of scope | Retopology, articulated cannon, LODs and rigs |

## Where we are
Implementation and public verification complete. Initial
runtime images were reviewed and revised to remove flat triangular grass and
faceted cliff normals. The imported coat contains baked dark paint; lighting
cannot reconstruct detail absent from its texture. Fine outlines can alias at
extreme zoom. Desktop performance evidence does not cover low-end phones.

Reproduce: `node tools/serve.mjs 8152`, open `/painted-lab.html`.
Set WH_NODE_MODULES to an external Playwright/Sharp runtime and run
`node tools/qa-painted-lab.mjs artifacts/painted-qa`. WH_BASE_URL targets Pages.

Local closeout: 114/114 modules parse, 169 source/mirror identities, house style,
361 core tests and 14/14 blueprint sections pass. The prior three-style lab passes
all 39 regression cases. Final native Chrome sample: see local-results.json;
median about 6.9ms and p95 about 7.1ms. These are desktop frame intervals only.

## Publication
Published V2 4fcee910ca6fb71771fa8b8ba54d9a5172281a58 after
[Pages action 35022602468](https://github.com/majieddd/worldheart/actions/runs/35022602468).
[PR #49](https://github.com/majieddd/worldheart/pull/49) remains a draft stacked
on the prior illustration study. The root game stays at main 1374122.
[Open Painted frontier](https://majieddd.github.io/worldheart/v2/painted-lab.html).

All 38 browser cases also pass on the public site. The 206 live/source identities
include the new loader, model files, pigment texture, page and renderer modules,
plus the unchanged production assets. Public valley and comparison captures are
actual browser renders. Public evidence is in PAINTED-CEL/public-results.json,
public-identity.json, public-valley.png and public-comparison.png.
Owner art acceptance, physical-phone behavior and production rigging remain open.
This evidence-only closeout does not change the deployed runtime.
