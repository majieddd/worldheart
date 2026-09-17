# Vey surface and motion refinement

2026-09-17, Codex, `feature/vey-surface-refinement`, U244-U246. These IDs
replace the earlier U240-U242 claim because the first-expedition collaborator
used U240-U243. Preserve and integrate that work before publishing V2.

## Delivered candidate

`design-demos/99-planets/vey-refinement.html` compares the original benchmark
and refined exports under the same view. Whole-body and close-up controls,
paint-only/clay modes, cycle scrubbing, speed and contour controls also exist in
local Asset Studio. Originals and approval history are retained.

The repair uses a Vey-specific material/rig profile, not a generic classifier.
It reconstructs a coherent surface from unsigned occupancy, closes the hollow
boot undersides, creates new UVs, bakes a 4096px atlas, transfers the existing
rig and captured clips, and fits foot contact against evaluated mesh vertices.
Rigid soles and guards are separated from flexible ankle/cloth weighting.

## Evidence

- 402 repository tests and 27 pipeline tests pass before integration; syntax and
  style checks pass. Desktop/mobile public-review and Studio controls pass with
  no console errors. Integration checks follow the collaborator merge.
- Six surface checks pass. Original rear mantle/hand contamination was 18.4%,
  17.0% and 15.0%; new values are 1.92%, 0% and 0%. Deliberate seams remain.
- The original mesh fails orientation and closed-surface checks. The repaired
  surface passes both. It contains 65,000 triangles, a review asset rather than
  an accepted Roblox optimization budget.
- Nine exported sole checks and eight existing motion checks pass. Original
  sole distortion was about 9-12%; repaired soles are rigid within floating-point
  precision. Walk clearance stays about 1-4.8mm; run flight remains intact.
- Twelve-frame walk/run sequences, both sides, front/back, face/hands/boots,
  unlit paint, clay and underside were inspected. Final replay animation hash
  matches the inspected candidate. Reports bind to exact exported bytes.
- Retained surface distance is at most 23.8mm, with 9.4mm combined P95. The full
  maximum is 76.5mm at intentionally added sole caps. This is disclosed rather
  than hiding cap additions in an average or claiming unchanged geometry.

Reports, atlas, editable blend, GLBs and timings are in
`lib/99-art/vey-refinement-v1/`. Full local logs and rejected outputs remain in
`artifacts/vey-refinement/`. The original is the material and sole negative control.

## Reusable route and measured time

The actual Asset Studio project `e234a5cd81bf` completed a full replay in
**131.404 seconds**: surface/soles 84.102s, silhouette/UV 2.413s, paint 15.224s,
rig/motion 12.421s, surface checks 1.609s, sole checks 15.223s. This is replay
time, not development time. Total wall work starts at **09:26:01 UTC**; release
checkpoint and every timed retry are retained in `timing-ledger.json`.

No neural regeneration or new runtime installation was needed. Clearing custom
normals alone failed. Signed voxel remeshing hollowed the model; unconstrained
collapse produced spikes; watertightness alone missed hollow soles. Those trials
are retained and the corrected steps are saved in the tool and Aegis references.

Aegis **3.18.8**, commit `f07d3c4`, is published and installed. Source/cache method
hashes match and an installed workflow passes. The prior 75 plugin regression
tests passed; the final documentation correction passed portable doctor and text
gates. Collaboration guidance remains additive in CONTRIBUTING. This task does
not claim a hot reload of the current conversation's already loaded skill text.

## Acceptance boundaries

This fixes the demonstrated patching, broken shading and sole deformation, but
does not certify Tripo parity, exact likeness, facial/finger/attack animation or
Roblox import/performance. The profile stays review-only and explicitly scoped
to Vey. Owner approval does not carry across changed paint or motion.
