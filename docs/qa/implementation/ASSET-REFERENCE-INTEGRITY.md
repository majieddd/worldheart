# Asset Studio reference integrity

Owner: Codex. Branch: `feature/asset-reference-integrity`.
Started 2026-09-18 05:45:13 UTC. Source project: Ashtar `bbd43128d405`.
The original project is retained. Reference trial: `28f9496d5cc2`; budget trial: `5906481de468`; four-view shape trial: `c4a53ad0490c`; rig/motion trial: `fd9bf626f926`.

## Confirmed defects

- Shape used only `p.art`. The six-view pack was not geometry conditioning.
- Each view was an independent image edit. The old front simplified armor and
  shortened fabric. Stronger identity instructions improved those details, but
  one revised left view contained two figures and a bottom view became frontal.
  These failed visual examples remain on disk; prompt changes are not a solved
  consistency guarantee.
- Generic unrigged models fell back to proximity weights and sine-wave motion.
  This fallback is now refused. Fit the rig or use the learned-rig comparison;
  save the source-bound profile before captured motion and deformation review.

## Implemented

- Hash-bound conditioning receipt; explicit consumed/unused camera roles.
- Separate Hunyuan multiview adapter with pinned, verified weights. Its four
  slots are front/left/back/right. Top/bottom cannot be passed to this model.
- Experimental 512 extraction grid, separate 4096 px texture setting, and
  300-second Hunyuan process limit. Previous accepted output survives timeout.
- Read the owner's existing HF dataset cache. Index all 2,455 motion files,
  import captures on demand with upstream hash validation, preserve raw timing.
  Arbitrary actions are not automatically treated as locomotion cycles.
- Fork inputs through Studio for independent comparisons; never inherit owner
  acceptance for the new candidate.

## Measured trials

RTX 4080 Laptop, 12,282 MiB physical VRAM; Windows. End-to-end Studio timings:

| Trial | Seconds | Result |
|---|---:|---|
| Hunyuan mini, 512 grid, 30 steps | 189.242 | Completed; unaccepted geometry |
| Hunyuan mini, 512 grid, 60 steps | 173.719 | Completed on warmed runtime; unaccepted geometry |
| Original dataset capture extraction | 2.856 | Original timing preserved |
| Hunyuan multiview, 384 grid, 30 steps | 190.481 | Four independent generated inputs consumed; unaccepted geometry |
| Identity Edit whole-body side request | 77.354 | Failed camera rotation; appearance retained but still front-facing |
| MIA inference | 50.228 | Prediction checks passed; process failed after inference |
| MIA validated prediction reuse + binding | 17.127 | 52-bone candidate; exact paint/UV preservation |
| Captured Mixamo walk retarget | 93.807 | Technical checks passed; candidate retained for visual review |

These timings do not establish a universal maximum for all assets/hardware.
The saved setting is 512/60 with a 4096 texture map; the timeout is enforced.
Raw receipts and failed attempts live in the trial projects and ignored
`artifacts/reference-integrity`. No comparison establishes Meshy/Tripo parity.

## Research decisions

- [Hunyuan multiview](https://huggingface.co/tencent/Hunyuan3D-2mv): use the
  dedicated checkpoint and image dictionary, not a collage or unused paths.
- [Era3D](https://github.com/pengHTYX/Era3D) jointly predicts color/normal views
  with camera estimation. It is a relevant consistency candidate, not a drop-in
  Krea setting. Its published views and resolution need their own fidelity trial.
- [UniRig](https://github.com/VAST-AI-Research/UniRig) separates skeleton and
  skin prediction; its instructions recommend editing inaccurate skeletons
  before skinning. [RigAnything](https://github.com/Isabella98Liu/RigAnything)
  predicts topology without a fixed humanoid template. Neither is installed or
  claimed validated by this change.
- [Omniverse retargeting](https://docs.omniverse.nvidia.com/extensions/latest/ext_animation-retargeting.html)
  maps a skeleton to NVIDIA's Human rig. Matching rest poses, facing direction
  and joint tags are required. It is not a replacement for shape reconstruction,
  texture generation or a malformed skeleton. Keep these mappings in the asset
  recipe; inspect the actual deformed character and complete motion.

## Remaining acceptance

The revised reference pack still needs a coherent all-angle result. Painting
still uses single-image Trellis conditioning. Rig and motion quality on a new
character must pass rendered review; disabling a poor fallback does not itself
create good animation. Keep these items open until actual output proves them.

## Rendered validation and unresolved boundaries

The first contact sheet accidentally inspected the current model-derived pack.
The conditioning gate correctly rejected it as independent reconstruction input.
The actual multiview trial instead used approved generated history entry 6;
its existing costume drift is recorded and does not become accepted automatically.

All 2,455 dataset captures are available in the owner's shared Hugging Face cache.
Only selected captures have been extracted to Studio motion arrays. Dataset IDs
are opaque; they are not invented action labels. General emote/attack retargeting
is not yet implemented by the locomotion adapter.

The trained Krea2 Identity Edit adapter, pinned installer and dual appearance/
semantic paths are implemented. The full-rank v1.2 LoRA preserves appearance
better, but the measured side-view trial did not rotate the body. It remains
experimental, not a guaranteed turnaround generator. A corrected bottom prompt
produced an upward view with visible soles, but its perspective is uncalibrated.

The learned-rig walk has a 0.00289 m floor clearance, 7.94e-7 m loop position seam,
and interior-stance foot speeds of 0.169/0.147 m/s. These are not whole-stance
sliding measurements or visual approval. The Windows worker completion patch
has passed cached prediction reuse; fresh inference teardown remains unverified.

Browser review exposed valid 4096-pixel PNGs failing the ImageBitmapLoader blob
fetch path. Direct decode and DOM TextureLoader succeeded. The shared preview
now uses DOM image decoding and rejects missing expected base-color textures.
The same candidate rendered with paint in front/back and six walk phases, with
zero console errors. Previous failed white-model screenshots are retained.

Aegis 3.18.13 is installed and its portable doctor and installed workflow pass.
The additive method update is in plugin PR #14; this is not a merged main release.
56 Studio regression tests pass. Syntax and house-style checks are recorded in
`artifacts/reference-integrity`, alongside browser logs and failed trials.

A lower Identity Edit fidelity of 0.5 produced a genuine side profile in 58.926
seconds, unlike fidelity 2.0. Costume/plate detail still changes, so this is a
promising directional comparison, not a consistency pass. That value remains
selectable in settings. Studio was restarted idle to load the final prompt and
hash-contract changes. Work through this local checkpoint took about 1h 55m;
one resumed multiview checkpoint download alone took 39m 35s. Setup/downloads
are excluded from the per-asset generation numbers above.
