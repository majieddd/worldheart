# Approved Hard Cel and three controlled iterations

Owner: Codex. Branch: feature/hard-cel-candidates. Status: active.
U164 archives the owner's selected Hard Cel from runtime 4fcee91 and its complete
dependencies. U165 adds three separately versioned variants against it. U166
verifies the baseline, input/render behavior and public delivery. U167 adds the
reusable method to current Aegis without replacing collaborator contributions.

## Accepted direction
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
