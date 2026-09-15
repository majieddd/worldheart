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
