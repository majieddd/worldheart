# 99 Planets local asset studio

A loopback-only browser workspace for a reference-led asset pipeline. It has no paid inference connector and sends no prompts or assets to a cloud generation API.

## Start on this computer

Run `tools/asset-studio/launch.ps1`, then open **http://127.0.0.1:8773/**. Use **Start local engine** if the image engine is stopped. The isolated runtime and outputs live in the sibling `local-asset-runtime` directory, outside Git.

## Workflow

1. Name the asset, select a saved style and describe its identity. Paste up to three images into the prompt area. Put the identity reference first.
2. **Generate main concept** first. Inspect the face, silhouette, skin, costume and framing. Correct this hero before spending time on a pack. Use **Test front view** to check that the local model preserves identity before making a full set. **Build remaining references** creates the other views, sampled palette, walk/strike guide and portable prompt. **Retry this view** preserves the previous attempt. Inspect every view before **Approve hero + pack**. Completed reference images are cached if a run is interrupted.
If a generated angle redesigns the character, **Use exact model views** switches routes. Approve the hero alone, reconstruct and refine it, then render its six matching views before animation approval. These are measurements of the model, not independent proof of hidden surfaces. Rejected image proposals remain in history.

3. **Make model** runs your selected local engine (Trellis.2 is the preferred installed route) against the approved hero image. **Run through motion** also performs paint and motion preparation, then stops for review.
4. Inspect shape and paint from every side. Select every animation, slow playback, and inspect fingers, feet and joint bends. Imported GLBs keep their geometry, rigs and clips.
5. Choose **Approve animation**, then **Polish & package**. The package contains GLB, editable Blender source, FBX and the project receipt.

Changing the brief, references or upstream output invalidates affected approvals. Only one GPU production job runs at a time. Jobs save intermediate files and receipts; cancelling retains completed outputs. Restarted jobs are marked interrupted rather than silently approved.

## What the stages actually do

| Stage | Implementation | Review boundary |
| --- | --- | --- |
| Concept | Local ComfyUI Krea 2 reference workflow; optional installed SDXL/SD1.5 checkpoints | Check identity and style. Checkpoint route is text-only and rejects pasted references. |
| Shape | Image-conditioned Trellis.2, or legacy Hunyuan3D-2mini | Reconstruction may invent hidden surfaces or merge fine fingers. No exact-match guarantee. |
| Paint | Trellis.2 generative UV texture on the reviewed geometry. Legacy front projection remains selectable and is labeled partial. Imported rigs retain their maps. | Inspect all sides and material boundaries. Generated guide views are uncalibrated and are not silently projected through the mesh. |
| Motion | Preserve existing rigs/clips; unrigged bipeds receive an editable geometry-proportioned 17-bone draft | Draft skinning is not a production-quality motion capture system. Unusual anatomy requires correction and review. |
| Polish | Validate finite geometry, pack textures, retain approved topology/motion, export GLB/Blend/FBX | Packaging does not automatically correct a poorly reconstructed face or bad animation. Roblox import/performance acceptance remains separate. |

The accepted 2D art and supplied geometry are the identity authority. A technically successful generation is a candidate, not owner approval. Agent pilot reviews carry separate provenance and never count as owner acceptance. Timings include failed attempts; do not add nested stage timings twice. The rejected primitive Vey reconstruction remains archived in the artbook and is not the foundation of new models.

## Settings

Four saved directions: Painted-Anime-Inkline, Hard Cel, Atmospheric Ink 1.3.1 and Vivid Paint. These are generation prompts, not changes to the frozen gameplay shader recipes.

Settings discovers installed Krea diffusion weights, ordinary checkpoint files and LoRAs under `ComfyUI/models`. Choose a compatible model and LoRA family, strengths, seed, dimensions and reconstruction quality. Default Krea uses 8 distilled steps. Keep the same identity image, prompt, framing and seed when comparing methods.

## Fresh installation (Windows / NVIDIA)

Prerequisites: Git, [uv](https://docs.astral.sh/uv/), a current CUDA-compatible NVIDIA driver, sufficient disk/RAM and network access for the one-time weights. The setup does not modify a pre-existing ComfyUI installation.

```powershell
./tools/asset-studio/setup.ps1
./tools/asset-studio/launch.ps1
```

`-Runtime D:/asset-runtime` chooses another disk. `-SkipModels` installs only the engines. Setup pins the ComfyUI and Hunyuan source revisions and uses a separate Python 3.11 environment for Blender 4.5.3. Runtime package versions are recorded with verification evidence. Model and dependency downloads require the internet; inference uses the local engines. Fully disconnected operation must be verified after all caches, including optional background removal, are present.

An optional `convert_cached_krea.py` tool reuses a complete local Diffusers Krea 2 Turbo cache. It validates every diffusion tensor key and shape against the installed native model before saving an FP8 candidate. Its format-conversion provenance must remain separate from the official prequantized download. Never overwrite the original cache.

### Engine sources

- [ComfyUI](https://github.com/Comfy-Org/ComfyUI) and [official Krea 2 workflow](https://docs.comfy.org/tutorials/image/krea/krea-2)
- [Krea weights](https://huggingface.co/Comfy-Org/Krea-2)
- [Hunyuan3D](https://github.com/Tencent-Hunyuan/Hunyuan3D-2) and [mini model](https://huggingface.co/tencent/Hunyuan3D-2mini)

Retain the upstream licenses with the runtime. Models are not redistributed in this repository.

## Verification

`python tools/asset-studio/test_server.py` checks approval invalidation, stage gates, reference handling and local HTTP boundaries without invoking inference. `tools/probes/local-asset-studio.mjs` checks the rendered UI, supplied model clips and responsive layout. Real Krea/shape jobs need separate receipts and visual inspection; mocked API checks do not prove generation quality.

The public mascot page displays saved banners and the supplied animated model. GitHub Pages does not execute the local generation pipeline.


## Fitted production replay (Albino Reptilian pilot)

The current local tool runs at `http://127.0.0.1:8773/`. Open a project, create/review its hero, then reconstruct and paint it. `Fit joints visually` provides front/side placement, mirrored joints, numeric correction and a model-bound save. `Paint palette` exposes material colours; fitted regions can be imported for detailed corrections.

After fitting the materials and anatomy, choose **Save fitted recipe**, then **Replay fitted production**. It restores the saved generated paint, applies the complete material recipe, rebuilds captured locomotion, checks both feet and complete loop seams, and renders the six-view/palette/motion packet. It stops at review. Approval and polish remain separate actions. A different hero or shape fails the replay gate. New anatomy needs an initial fit; this pilot does not prove automatic universal rigging.

The Reptilian pilot runs locally through Krea 2, Modly Trellis.2, unsigned surface repair, 4K UV paint cleanup and Blender finishing of the generated mesh. The final skin, eyes, costume regions, joints, tail lift and contact correction are data/code in the tool, not unsaved viewport edits. Paint and reference generation remain candidates. Exact model views document the reconstruction; they are not independent evidence that unseen surfaces match an unprovided design.

Setup also runs `prepare_motion.py` to cache and process the two pinned CMU takes used by fitted motion. Existing installations can run that script with the Studio Python once; cached source bytes are checked and reused. Trellis.2 remains a separately installed optional engine; this pilot validates the configured local installation, not a fresh Trellis setup on another machine. Keep the CMU credit in the reference packet and derived asset documentation.

Surface finishing reuses the dense reconstruction, and shape/paint share the saved foreground mask. Failures stay in the project history and timing receipts. The current production study and timings are in `docs/qa/implementation/REPTILIAN-STUDIO-PILOT.md`.


## Captured motion and research engines

Open **Motion & engine comparisons** from the asset page. Import a local Mixamo
locomotion FBX, choose the fitted rig and create a separate candidate. The worker
preserves source timing and rig identity, fits real sole contact, calibrates
travel, retains authored tail motion and checks floor and full loop continuity.
Use a passed candidate as the target to add another clip. Selection requires
visual review; final animation approval and polish stay separate. A technical
pass never records owner acceptance automatically.

`setup-research.ps1` installs the pinned MIA v2 and InstantMesh experiments.
Use `-VerifyOnly` to check existing source/weight identities and actual imports
without another download. The runtime must already have Studio and the working
Modly Torch/nvdiffrast environment. Dependencies stay isolated. The 25 pinned
files are in `research-lock.json`; original downloaded motion files stay local.
MIA predicts 52 humanoid bones and may fail unusual alien anatomy or appendages.
InstantMesh generates fixed-camera views and UV paint but lost fine detail on
this commander. Both remain experimental and preserve the current model.

See [measured research and limitations](../../lib/99-art/motion-research-v1/research.md)
and [implementation evidence](../../docs/qa/implementation/MIXAMO-RESEARCH-PIPELINE.md).
Run `python -m unittest discover -s tools/asset-studio -p 'test_*.py' -q` for the
pipeline regression suite. Failures and raw worker logs remain in the project.


### Reference integrity and full motion library

Hunyuan mini uses the hero only. Experimental Hunyuan multiview uses the reviewed
front/left/back/right images with a dedicated checkpoint; every run writes a
hash-bound conditioning receipt listing consumed and unused views. Top/bottom
remain inspection guides. Model-derived turnarounds are not independent inputs.
Install the pinned checkpoint with `setup_hunyuan_mv.py` in the Studio runtime.

Geometry extraction grid (up to 512) and texture pixels (up to 4096) are separate
settings. Hunyuan workers stop at 300 seconds and preserve the previous output.
Measured mini 512/60 completed in 173.7 seconds on the test RTX 4080 Laptop;
this is not a promise for every model or cold start.

`setup_identity_edit.py` installs the pinned Krea2 identity adapter. Select it in
settings for comparisons; it remains experimental because strong reference
conditioning can preserve the original view instead of rotating the character.
Review every angle, especially asymmetry, garment lengths and soles.

`sync_mixamo.py --metadata-only` builds the pinned dataset catalogue. Studio
also reads the authenticated user's existing Hugging Face cache, avoiding a
second download. The Motion page indexes all 2,455 captures and imports selected
files with hash verification. Current retargeting supports walks/runs; availability
of a capture does not establish support for arbitrary actions or unusual rigs.

Unrigged meshes now require explicit fitting or the learned MIA rig experiment.
There is no automatic proximity-weight/sine-wave animation fallback. All trials
stay separate until visual review; checks alone never grant owner approval.
See [reference integrity evidence](../../docs/qa/implementation/ASSET-REFERENCE-INTEGRITY.md).


### Recovering a failed shape

Multiview uses a separate five-minute profile (maximum 384 grid / 30 steps);
mini timings do not apply to it. Studio records both requested and effective
values. Geometry progress appears during the local job. Higher texture pixels
do not change the extraction grid.

A directional image must show one subject. If it contains multiple full-height
figures, choose that image in Concept and click **Isolate one figure**. Select
its left-to-right number, review the crop and approve the updated pack. Sources
and crop coordinates are retained; detection is conservative, not a substitute
for visual review. Mesh history retains previous outputs.

Motion comparisons expose **Make-It-Animatable v2 / local rig** and a fresh
prediction option. Leave fresh prediction off to reuse a compatible validated
prediction; turn it on when comparing the actual inference path. Each candidate
can be linked with `motion.html?project=ID&candidate=ID`.
See [recovery and measured comparison](../../docs/qa/implementation/ASSET-SHAPE-RECOVERY.md).
