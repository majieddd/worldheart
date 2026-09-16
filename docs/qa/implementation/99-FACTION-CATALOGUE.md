# Faction catalogue and selected B interface

Owner: Codex. Branch: `feature/99-faction-catalogue`.
Base: preview `f43ca42`, including the collaborator's exact-output generation optimization.

## Active scope

- U213: refine selected B; remove planet/date block; keep combat/build/loadout interactions and improve tactile Roblox framing.
- U214: six faction catalogues, three commanders, three units, all six weapon families and three towers each; six homeworlds; 54 active powers and icons.
- U215: generate and retain 24 Painted Inkline plates with prompts, provider/model receipts and identity review. Original artwork remains available.
- U216: check content, qualitative tradeoffs, runtime navigation, responsive layout and public identity; publish V2 and hand off review links.

## Acceptance

Each faction has its own link and every asset has a readable illustration, role and five-step qualitative bars. Every commander and weapon has a named active, activation condition, feedback cue and limitation. Concept ratings are proposals, not simulated balance measurements. Actual crossover identities are distinguished from original concepts. Homeworlds and combat abilities are parallel-universe proposals, not claims about source-game canon.

## Visual contract

DESIGN_VARIANCE 4; MOTION_INTENSITY 2; VISUAL_DENSITY 5. One dark graphite page surface. Faction color has the semantic job of identity; warm white carries reading. Large art, compact selection strips, a single inspector and quiet dividers. No promotional feature-card grids. Existing B framing stays recognizable. Ability icons use a consistent licensed icon family, integrated with the same ink/material framing.

## Evidence

Status: U213-U215 verified locally; U216 publishing.

- 203/203 catalogue and selected-B browser checks. Covers all 90 asset selections, 54 active icons, 30 faction/subject routes, 48 served image identities, responsive layout, text contrast, keyboard modal/focus behavior, touch selection and retained equipment/build controls.
- 84/84 previous art-collection and UI-draft checks, including the original PNG identities, archive and live Axiom reference.
- 397/397 automated tests; 144/144 module parses; style check clean; 361 generated mirrors match source.
- Refined B mobile header received a targeted final visual check after the full local probe. Runtime publication will rerun the full acceptance probe.
- Visual contact-sheet review and two rejected roster layouts are recorded in [faction-review.md](../../art/99-planets/faction-review.md). First probe's incorrect selector failure is retained, not counted as a product pass.
- Original B remains at `design-demos/99-planets/arcade-v1.html`. First concept plates and all gameplay modules are preserved. Collaborator closeout `cc62311` was integrated before publication.

## Reproduction

```text
node tools/serve.mjs 8157
WH_NODE_MODULES=<bundled runtime node_modules>
WH_BASE_URL=http://127.0.0.1:8157
node tools/qa-painted-lab.mjs artifacts/factions/local-final --99-factions
node tools/qa-painted-lab.mjs artifacts/factions/regression --99-art
node tools/syntax.mjs
node tools/style.mjs
node tools/test.mjs
node tools/deploy.mjs
```

Generated images use Higgsfield. Nano Banana Pro was requested; the backend receipt says `nano_banana_2`; both are saved. 26 total generations including two revisions. The 2-credit preflight per image totals 52; observed balance changed from 187.78 to 135.78 during this work. No new mesh, ability implementation, campaign integration, Roblox port or empirical balance result is claimed.
