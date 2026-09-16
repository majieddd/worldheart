# Approved Hard Cel and three controlled iterations

Owner: Codex. Branch: feature/hard-cel-candidates. Status: published and verified.
U164 archives the owner's selected Hard Cel from runtime 4fcee91 and its complete
dependencies. U165 adds three separately versioned variants against it. U166
verifies the baseline, input/render behavior and public delivery. U167 adds the
reusable method to current Aegis without replacing collaborator contributions.

## Accepted direction

2026-09-15 follow-up, active U168. Owner still prefers Hard Cel 1.0.0 overall.
Atmospheric Ink 1.3.0 is the best variation, but its haze washes out the scene.
Codex on feature/atmospheric-ink-depth will preserve 1.0 and 1.3.0, add 1.3.1
with less fog, darker colored shadows and stronger saturation, and compare at
the same camera/light. Verify old/new pixel differences and baseline identity,
real controls, responsive views, public source identity and latest local Aegis.
Owner acceptance of 1.3.1 remains open.

U168 local verification: 61/61 browser checks, 364 core tests, 117 parsed modules,
195 mirror identities and 22 Aegis style-identity checks pass. The before/after
selector can use original 1.0.0 or old 1.3.0 on the left. New 1.3.1 uses .0115
fog versus .017, .29/.61/.99 cel bands, .10 extra directional shadow depth,
1.16 linear surface saturation and .16 warm rim. No camera overlay is used.
Valley image shadow percentile drops .519 to .423; mean HSV saturation rises
.288 to .413 in the measured scene crop. These measure direction, not approval.
Actual rendered comparisons are in `atmosphere-1.3.1/local-*.png` and results.json.

Latest Aegis main was 3.18.1. Its new animation skill had invalid unquoted YAML;
[PR #8](https://github.com/majieddd/claude-plugins-custom/pull/8) fixes only metadata
and is merged as 3.18.2. Local integrated install includes main 143abe9 plus
already-installed production cb14a65: 9 skills, 7 MCP tools; 320 installed files
match source. Portable doctor 8/8, workflow tests 48/48, style gate 20/20 and
mesh gate 6/6 pass. Source and Codex cache are verified separately from Claude
host wiring. Collaborators' original checkout and pending PR remain unchanged.
This session reads and runs the updated files directly; a new task loads newly
installed skill/tool definitions automatically. Receipt: atmosphere-1.3.1/plugin-install.json.
The owner explicitly loves the Hard Cel pane on the detailed models: crisp ink,
illustrative texture, shadow depth and smooth readability. Preserve it as a real
candidate for eventual Worldheart use. That approval applies to v1.0.0 only.
The three alternatives start unreviewed and are experiments, not upgrades by fiat.

## Comparison contract
The same pinned geometry, assets, placement, camera, light and animation phase
appear in every pane. Only declared rendering parameters vary. Baseline shader
output is compared to the archived original at the same viewport and phase.
The preserved original includes all vendored dependencies and source hashes;
the recipe alone is insufficient to recover this style.

## Versions
- v1.0.0 / Hard Cel: exact selected baseline, owner-approved candidate.
- v1.1.0 / Painted light: retain crisp contours; explore richer colored shadows.
- v1.2.0 / Etched color: refine ink and pigment detail, with shadow-only hatching.
- v1.3.0 / Atmospheric ink: explore warm highlights, cool depth and distance haze.

## Acceptance and evidence
Require archive hash verification, matching baseline pixels, distinct candidate
renders, real mouse/keyboard/touch, responsive comparisons, export and context
recovery. Keep public identity, machine results and owner approval separate.
No production game art migration, new model generation or rigging is requested.

The new collaborator mesh gate found 512px embedded textures in the exact
approved glTF files. Its default 1024px quality floor therefore fails. The
candidate intentionally preserves these already-approved bytes; its declared
512px floor passes structural validation. No 2048px or full-source-resolution
claim is made. A higher-resolution delivery would be a separate named variant.

## Aegis coordination
Current main 0b9c09f includes the collaborator's style-to-3d skill and glbgate.
The supplement adds candidate preservation and controlled iteration there.
Pending PR #2 has content receipts and tracker helpers; this work must not
replace those workflows or copy an older skill over current main.

## Verified locally

- `node tools/test.mjs`: 364/364 tests pass, including archive and recipe identity.
- `node tools/syntax.mjs`: 117/117 source modules parse. House style passes.
- `node tools/deploy.mjs`: 195 source/mirror files match.
- Existing browser runner with `--candidates`: 56/56 cases pass. Mouse, keyboard,
  touch, 375/768/1280 layouts, contrast, URL state, PNG and ZIP export, loss and
  recovery, failed asset loading, allocation stability and save isolation covered.
- Aegis study identity gate: 21/21 checks. Mesh structure passes at the declared
  512px preservation floor; default 1024px texture-quality floor is not met.
- Previous Painted frontier: 38/38 regression cases pass. ZIP inspection verifies
  all 16 dependency hashes and the exact manifest inside the downloadable file.

Evidence lives in `HARD-CEL-CANDIDATES/local-results.json`, identity-gate.json and
the actual local valley, commander and touch captures. Original-to-original
control difference is 0; baseline comparison mean RGB difference is 0.003016
on a 0-255 scale, within the explicit 0.02 tolerance. Source bytes are exact;
rendered pixel equality is a tolerance check, not a bit-identical image claim.

Native Windows Chrome 152, ANGLE D3D11, RTX 4080 Laptop GPU, DPR 1: four-pane
animation sample had 83 measured frames, median 13.9ms and p95 20.9ms. This is a
short desktop sample, not physical-phone or low-end performance acceptance.
The coat's baked dark texture and static unrigged models remain limitations.

## Reproduction and handoff

Serve with `node tools/serve.mjs 8152`; open `/hard-cel-lab.html`. Set
WH_NODE_MODULES to a Playwright/Sharp installation, then run
`node tools/qa-painted-lab.mjs artifacts/candidate-qa --candidates`.
Use WH_BASE_URL to run the same cases against the published V2.
The original dependency folder is frozen. Future candidates need a new directory,
manifest and version; do not overwrite the approved tag or infer owner approval.
Campaign rendering and production main are outside this slice.

## Publication

Published runtime `307f2a6bb62787ef6d99973c929f63cc212aad45`,
[Pages action 35030790895](https://github.com/majieddd/worldheart/actions/runs/35030790895),
[PR #50](https://github.com/majieddd/worldheart/pull/50).
[Open all four versions](https://majieddd.github.io/worldheart/v2/hard-cel-lab.html?layout=all).
All 56 browser cases pass publicly, with no runtime or shader errors; 232/232
public/source file identities match. Public results, identities, valley and
commander renders are committed beside the local evidence. Production main
remains `1374122d1109919a5fab10b69fefdfb80308eb6e`.

Hard Cel 1.0.0 remains the owner-approved candidate under tag `art/hard-cel-v1`
at `ae41d5523e0a8ce6601fc9a2e73c3bbed108113d`, plus its self-contained ZIP.
Only the three experiments await aesthetic review. No game migration is implied.

Aegis 3.18.1 is merged in
[PR #7](https://github.com/majieddd/claude-plugins-custom/pull/7), main `fb97aa0`.
The supplement extends the current style-to-3d skill with a preservation method,
a read-only identity gate and explicit complementary-contribution rules in
CONTRIBUTING. Latest character-animation, huashu-design and mesh-gate work is
retained. Pending production-workflow PR #2 remains intact and has a coordination
note. Existing local plugin links were not repointed to this review worktree.

U164 preservation, U165 three versions, U166 local/public verification and U167
the GitHub method supplement are complete. This evidence-only closeout does not
change the published runtime. Future implementation must retain the original
and get a separate owner decision before treating a variant as selected.
