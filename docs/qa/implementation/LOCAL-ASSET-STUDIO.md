# U229-U233: local asset production and Gray mascot

Branch: `feature/local-asset-studio`. Supplements the identity correction and unified artbook work. Preserve shared preview history and all prior source art. The owner rejected the primitive Blender Vey model; it remains archived and explicitly labeled rejected.

## Delivered slice

- **U229:** Actual local Krea 2 Turbo image, using the preferred Vey poster as a reference, a style LoRA, seed 99131 and 8 steps. The successful 768 x 1024 run took 150.4 seconds. Full model-key/shape validation for the cached Diffusers-to-native FP8 conversion; Qwen namespace adapter preserves tensor values. A framing iteration drifted in identity and was rejected, not promoted.
- **U230:** Real local Hunyuan3D-2mini reconstruction from the preferred built-in poster. 30 steps, resolution 256, 68.9 seconds, 81,738 vertices / 163,472 faces. The paint candidate projects the front reference into a 2048px UV texture; unseen rear detail is a palette fill. Supplied Gray mascot geometry is preserved separately.
- **U231:** Loopback-only asset studio with four saved styles, prompt/image paste, installed-model and LoRA settings, concept approval, reconstruction, UV paint, rig/motion review, animation approval and GLB/Blend/FBX packaging. Importing a GLB preserves its source rig. Automatic biped skinning/motion is explicitly a draft.
- **U232:** Two built-in Painted-Anime-Inkline mascot banners based on the supplied Gray/deer model and requested pursuit/fortification compositions. Source model: 18 meshes, 1 skin, 40 bones and 21 clips. Public study includes original geometry and clip playback.
- **U233:** Installation/launch scripts, pinned engine source revisions, recorded Python package versions, local receipts, source hashes and runtime checks. Publication receipt will be recorded after deployment.

## Verification evidence

- Eight local API tests pass: current-art approval, changed-file/reference invalidation, motion approval, export gating, upload validation, installed-model restriction and loopback HTTP boundaries.
- Seven browser checks pass for studio and mascot viewer: 21 clips present, four styles, five stages, model/LoRA settings and desktop/mobile width. Screenshots visually inspected. Initial settings check ran before the asynchronous dialog opened; corrected to await the visible dialog and retained the earlier report history in task output.
- Vey 3D comparison loads both real geometry and embedded paint with no browser errors. The front read is substantially closer to the source than the rejected primitive reconstruction. Full turnaround and owner acceptance remain separate.
- Supplied rig finishing retains all 21 clip names and 120 channels per clip. A QA-only packaging pass exported GLB, Blend and FBX. It did not approve or polish the actual owner-review project.
- Repository integration: 402 tests pass; 157 modules parse; style check passes. Later new modules receive targeted parsing and public checks.
- Detailed local artifacts: `artifacts/local-asset-studio-qa`, `artifacts/vey-image-to-3d`, `artifacts/mascot-animation-preservation`; image and shape receipts are also distributed beside the public candidates.

## Failures retained and corrections

Hugging Face Xet range failures prompted standard official downloading. Subsequent network timeouts/DNS errors and a Windows file-length observation mistake inflated troubleshooting time. Complete cached Krea weights were then reused. The initial Qwen checkpoint lacked the namespace needed for native detection; the successful adapter prefixes keys without changing tensor values. The pinned Hunyuan offload helper lacked its expected components mapping; a local adapter supplies that mapping and explicitly selects the CUDA execution device. No external engine source is overwritten.

The efficiency audit and amended workflow are in [LOCAL-PRODUCTION-EFFICIENCY.md](LOCAL-PRODUCTION-EFFICIENCY.md).

## Acceptance boundaries

This is a functioning local production workbench, not a promise of automatic production-quality assets. The generated biped rig is a draft, unseen texture surfaces need authored detail, and the high-resolution source mesh exceeds a practical Roblox character budget. Final animation approval, mesh optimization and Roblox import validation remain open. The supplied mascot's authored motion is the stronger animation reference.

Local inference has no paid generation API fallback. First-time setup downloads models/dependencies. Transparent or flat-backdrop image reconstruction works locally; optional U2Net requires a separately installed cache for scenery-backed images. Public GitHub Pages displays saved outputs and cannot perform local GPU inference itself.
