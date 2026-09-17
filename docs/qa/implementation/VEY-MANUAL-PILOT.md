# Vey manual production pilot

Owner feedback: the one-image paint projection and rotation-only draft locomotion
are inadequate. Build and review one complete manually supervised candidate before
promoting its method into the automatic studio. Original art, models and clips stay
available. Active branch: `feature/vey-manual-pilot`.

## Contract

- Preferred built-in hero image is the identity anchor.
- Six directional reference views, explicit material palette and portable prompt.
- Four cardinal views guide shape/paint. Top and bottom illustrations are advisory
  until checked against the mesh; generated pictures are not calibrated cameras.
- Geometry derives from the existing image-conditioned Hunyuan reconstruction.
  No primitive substitute, no new shape inference solely to recover old work.
- Paint uses separate views with visibility and material-region checks. Never
  project front eyes, badge or belt lens onto the rear. Preserve a source model.
- Anatomical joint placement, pelvis translation, bent knees/elbows and measured
  foot contacts. Walk and run must be watched through full cycles and transitions.
- Save manual decisions, inputs, intermediate outputs and final review model.
  Owner approval remains false until the owner actually approves this candidate.

## Research routes

[Modly](https://modly3d.app/docs) orchestrates local engines, including Hunyuan,
TripoSG and Trellis; it does not itself guarantee a different reconstruction.
[Tripo](https://docs.tripo3d.ai/model-generation/multiview-to-model-p1-20260311.html)
expects separate front/left/back/right images in that order. The export pack uses
that ordering. No cloud submission is claimed.
[Kimodo](https://github.com/nv-tlabs/kimodo) offers text/constraint-controlled motion;
its documented CPU text encoding lowers GPU use below 3 GB. It remains a researched
route; installing another large runtime is deferred until this pilot identifies
a need that the current tools cannot meet.

## Status

Locally verified; publishing the review candidate. The hero, six separate views,
eight-color palette, portable prompt, motion guide, painted GLB and editable rig
are in `lib/99-art/vey-pilot-v1`. Reproducible manual steps and scripts are in
`tools/asset-studio/pilots/vey`. The automatic studio has not been promoted.

## Acceptance evidence

- One built-in generated sheet, no subsequent image rerolls. Existing Hunyuan
  geometry reused; a separate 39,124-triangle copy was welded and given fresh UVs.
- Four depth-tested cardinal cameras cover approximately 65% of sampled surface
  texels. Remaining texels use authored material colors. Ceramic cuffs/collar
  received manual corrections where view alignment mixed cloth into ceramic.
- CMU 07_01 walk and 09_01 run were retargeted to 22 hand-placed bones. Full cycles
  keep pelvis translation and original cadence; frame-zero keys avoid a one-frame
  loop hold. Normalized heat skinning replaced the rejected region masks.
- Exported walk is 1.0833 seconds with 4.88cm vertical pelvis range; run is 0.7333
  seconds with 8.8cm range. Actual foot endpoint gaps are below 2mm.
- All nine exported-model browser checks pass. Desktop and mobile layout checks
  report no overflow or browser errors. Side-view eight-frame contact sheets for
  both complete cycles and front/rear paint renders were visually inspected.
- Deformation gate: no short rest edges exceed 25cm in either sampled clip.
  Worst short-edge lengths: walk 8.83cm, run 10.28cm. The rejected binding fails
  the same gate; its fingers were incorrectly attached to leg bones.
- 402 repository tests pass; 159/159 modules parse; style checks pass. Full logs,
  prior failures, render sequences and deformation reports remain in
  `artifacts/vey-pilot`. No test pass is treated as owner art acceptance.
- First public stage-switching check found an existing static-outline shader
  compile error in the shared model viewer. Replaced its unavailable objectNormal
  variable with the source normal attribute before skinning. All three stages now
  pass locally with no shader/browser errors. The failing public report is retained;
  corrected publication and final public recheck are pending.

## Pipeline lesson and Aegis

Aegis 3.18.5 adds compact terminal reports backed by full saved logs, resume
checkpoints, reference-first pilots, view/material validation and promotion only
after owner acceptance. A discovered headless-browser false success is fixed in
3.18.6: CDP exceptions and console errors fail the process while retaining complete
diagnostics and later screenshots. Ordinary returned data named ERROR still passes.
Both changes supplement existing tools and collaborator work.

## Remaining boundaries

Owner review, unseen-surface painting, shoulder/hand deformation acceptance and
Roblox import/triangle budget validation remain open. This is a supervised pilot,
not a general automatic rigger. Top/bottom are advisory perspective illustrations;
512px view sources do not become true high-resolution detail in a 2048px atlas.
Modly, Tripo and Kimodo were researched, not executed. Local tools handled mesh,
paint and retargeting; built-in concept generation was not a local inference run.
