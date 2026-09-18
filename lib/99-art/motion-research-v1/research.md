# Commander production: measured method comparison

Study date: 17 September 2026. **Painted-Anime-Inkline and the Atmospheric Ink
1.3.2 renderer remain unchanged.** The retained Vey and Reptilian assets remain
selected in the game. The comparison page contains separate review candidates.

## What improved

Mixamo walk and run captures now drive the fitted Reptilian rig, with corrections
for its actual soles, limb lengths and tail. Both feet contact the floor; full
surface sampling checks penetration and loop continuity. The original fitted
clips remain in the same comparison file. Agent review sampled 12 poses across
each full cycle plus front/back views. Owner visual acceptance is still pending.

| Final capture | Walk | Run |
|---|---:|---:|
| In-world travel calibration | 1.661 m/s | 4.108 m/s |
| Left/right interior stance speed, p95 | 0.166 / 0.142 m/s | 0.078 / 0.167 m/s |
| Loop surface position difference, maximum | 0.00000093 m | 0.00000134 m |
| Loop surface velocity change, p95 | 0.672 m/s | 0.794 m/s |
| Minimum surface height | 0.003 m | 0.003 m |

Interior stance excludes immediate contact transitions; it is not a claim of
zero sliding throughout a game. Whole-cycle floor and loop checks retain every
sample. See [walk checks](walk-quality.json) and [run checks](run-quality.json).
The run's initial velocity discontinuity was 2.183 m/s, despite almost identical
endpoint poses. Cyclic filtering and fitted endpoint tangents brought it below
the unchanged 1.0 m/s project limit. No thresholds were relaxed to pass.

## Which engine does which job

**Modly is already used.** The installed host is `lightningpixel/modly` at
`1476fd0b1c19c9ab177c1ca3ee4d1842119e9f65`; the executing Trellis2 GGUF extension
is `caa85c7a1aa6c6ba9cb3f07f13878ba8e3864912`. Asset Studio's worker invokes that
extension for both image-conditioned shape and generative UV paint. The retained
pilot used Q5_K_M, 1024 cascade, 25 steps and 4K paint. A second Modly interface
would use the same reconstruction engine, not create a new quality comparison.

**Mixamo** supplies humanoid characters, rigs and captured movement. It does not
reconstruct our concept or paint its materials. Its original FBX reference
library stays local. The walking capture is the user's existing local FBX; the
run is the pinned public MIA author reference. Original FPS, exact frame range,
rest matrices, bone names, poses and source hashes are retained in Studio.

The requested Hugging Face dataset gate was accepted with the owner's explicit
permission. The browser confirmed access. Its protected CDN could not be fetched
through the available browser, and CLI authentication is separate. No bypass or
unrecorded dataset download is claimed. The refined-character subset lacks
textures and therefore cannot be used to validate painting.

## Make-It-Animatable v2: installed, executed, rejected for these aliens

The [paper](https://arxiv.org/abs/2411.18197) was read with its supplement and
compared to the [current v2 source](https://github.com/jasongzy/Make-It-Animatable/tree/v2),
pinned at `bbd8b158d88879c310ad130f9b25056935d221e9`. Coarse pelvis/thigh
canonicalization and hand-focused sampling address the ambiguities of direct
joint prediction. Our worker uses 32,768 surface points with half concentrated
near hands. The v2 implementation uses Hunyuan3D 2.1 and ortho6d pose prediction;
the original paper's architecture, timing and commercial comparisons are not
presented as measurements of this deployed v2 pipeline.

The learned topology predicts 52 humanoid bones. A 65-bone Mixamo source includes
end bones; that count does not mean our alien tail is represented. We tested a
known standard humanoid as a positive control before attributing failures to the
adapter. The control passes; Vey and the Reptilian do not. Fitted pelvis and hand
guidance improves Reptilian predictions but does not fix them sufficiently.

| Input | Rest-surface edge stretch, p99 | Result |
|---|---:|---|
| Standard humanoid control | 1.057 | Technical pass |
| Vey | 8.124 | Incorrect head/ankle ordering and deformation |
| Reptilian | 16.118 | Incorrect anatomy and severe deformation |
| Reptilian with fitted guidance | 3.390 | Still fails; standard topology also lacks tail coverage |

Threshold-based skin-weight pruning retained tied weights, sometimes exceeding
four influences. Normalizing before pruning also left sums below one. The
adapter now keeps exactly the strongest four and renormalizes afterward. UV and
decoded-image preservation are checked independently. These repairs fix real
adapter issues, but they do not make incorrect learned anatomy acceptable.

The Studio also executed the MIA rejection path: it retained prediction and
diagnostic reports and left the production selection unchanged. MIA remains
experimental, with no automatic fallback disguised as a successful prediction.

## InstantMesh: a real local alternative, not a quality upgrade here

The [paper](https://arxiv.org/abs/2404.07191), including experiments and
limitations, was checked against the [source](https://github.com/TencentARC/InstantMesh)
at `08822c52fdc399b93ea00e4fa9e596344ed52ccc`. White-background Zero123++ creates
six fixed-camera views; DINO features feed triplanes and a FlexiCubes surface.
Those camera views cannot be replaced blindly with arbitrary concept-sheet
panels. The adapter reuses the primary engine's saved foreground mask and
explicitly exports UV texture maps rather than relying on vertex colours.

A complete candidate took **77.30 seconds** on this computer. The generated
views kept the broad character identity, but reconstruction lost snout, fingers,
armor boundaries and thin detail. Clay and unlit inspection reveal those losses.
Increasing texture size would not repair missing geometry. The corrected output
is included for honest comparison and labeled rejected for this commander.

InstantMesh geometry is Z-up. The adapter converts it to glTF Y-up automatically;
repacking the first retained OBJ took 1.47 seconds. Views, geometry and paint now
have verified caches, so packaging can be corrected without regenerating them.

## Repeat this in Asset Studio

1. Open an asset with reviewed concept, painted geometry and fitted rig.
2. Choose **Motion & engine comparisons**. Import a Mixamo locomotion FBX or use
   the saved walking/running captures.
3. Choose the current fitted rig, create a comparison and inspect the result.
   To add another clip, choose the first passed comparison as the next target.
4. Review front/side/back, full-speed and slow motion, soles, fingers, tail, clay
   and unlit paint. Failed checks retain their reports and block selection.
5. Select a visually reviewed candidate, then use the normal separate animation
   approval and polish stages. Source changes invalidate stale comparisons.

The optional research setup pins sources and 25 model/config/reference files.
MIA has its own environment; InstantMesh uses isolated library overrides over
the existing Modly Torch/nvdiffrast runtime. A Windows import-order fault was
fixed by loading Blender before Torch. Setup verifies hashes and real imports.
Dependencies and weights stay outside the site. All inference in this pilot
runs locally; first-time installation and downloading require network access.

## Timing, quality limits and rights

[Timing ledger](timing.json) separates setup, downloads, successful and failed
attempts, refinement and browser review. Overlapping download durations are not
added to the total. Hardware: RTX 4080 Laptop, 12,282 MiB physical VRAM. Torch
reported 19.63 GiB peak allocation for the initial InstantMesh run under Windows;
that is not a claim that the GPU has that much physical VRAM.

The primary generated model still simplifies the concept's face, claws and
armor. This study improves reproducibility and captured locomotion; **it does
not establish parity or superiority to Tripo or Meshy**. That requires a matched
reference/output comparison and owner review. Generic alien rigging, authored
attacks, and Roblox import/performance acceptance remain separate work.

MIA code is MIT; InstantMesh code is Apache-2.0. Their model and transitive
dependencies have their own terms. Upstream licenses remain in the runtime;
this site does not redistribute learned weights or raw Mixamo reference assets.
Consult the [Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html),
[dataset card](https://huggingface.co/datasets/jasongzy/Mixamo),
[Modly source](https://github.com/lightningpixel/modly) and
[Trellis2 extension](https://github.com/lightningpixel/modly-trellis2-gguf-extension).
