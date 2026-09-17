# 99 Planets local asset studio

A loopback-only browser workspace for a reference-led asset pipeline. It has no paid inference connector and sends no prompts or assets to a cloud generation API.

## Start on this computer

Run `tools/asset-studio/launch.ps1`, then open **http://127.0.0.1:8771/**. Use **Start local engine** if the image engine is stopped. The isolated runtime and outputs live in the sibling `local-asset-runtime` directory, outside Git.

## Workflow

1. Name the asset, select a saved style and describe its identity. Paste up to three images into the prompt area. Put the identity reference first.
2. Generate a concept using an installed model. An existing reference can also become the concept without another generation. Inspect it, then choose **Approve 2D**.
3. **Make model** runs local Hunyuan3D-2mini against the approved image. **Run through motion** also performs paint and motion preparation, then stops for review.
4. Inspect shape and paint from every side. Select every animation, slow playback, and inspect fingers, feet and joint bends. Imported GLBs keep their geometry, rigs and clips.
5. Choose **Approve animation**, then **Polish & package**. The package contains GLB, editable Blender source, FBX and the project receipt.

Changing the brief, references or upstream output invalidates affected approvals. Only one GPU production job runs at a time. Jobs save intermediate files and receipts; cancelling retains completed outputs. Restarted jobs are marked interrupted rather than silently approved.

## What the stages actually do

| Stage | Implementation | Review boundary |
| --- | --- | --- |
| Concept | Local ComfyUI Krea 2 reference workflow; optional installed SDXL/SD1.5 checkpoints | Check identity and style. Checkpoint route is text-only and rejects pasted references. |
| Shape | Image-conditioned Hunyuan3D-2mini | Reconstruction may invent hidden surfaces or merge fine fingers. No exact-match guarantee. |
| Paint | Reference front projection baked to mesh UVs; unseen back uses the source palette. Imported geometry receives UV-attached brush variation while existing maps are retained. | This is a portable local texture bake, not a generative multiview repaint. Inspect seams and rear detail. |
| Motion | Preserve existing rigs/clips; unrigged bipeds receive an editable geometry-proportioned 17-bone draft | Draft skinning is not a production-quality motion capture system. Unusual anatomy requires correction and review. |
| Polish | Validate finite geometry, pack textures, retain approved topology/motion, export GLB/Blend/FBX | Packaging does not automatically correct a poorly reconstructed face or bad animation. Roblox import/performance acceptance remains separate. |

The accepted 2D art and supplied geometry are the identity authority. A technically successful generation is a candidate, not owner approval. The rejected primitive Vey reconstruction remains archived in the artbook and is not the foundation of new models.

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
