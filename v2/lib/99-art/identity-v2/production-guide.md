# Painted-Anime-Inkline: identity-first production

Version 2, 2026-09-16. Owner art approval remains separate from technical checks.

## The binding look

Whimsical, fantastical painted anime environments coexist with comic realism,
deep colored shadow and material grit. Broad local color and irregular brush
variation describe volumes. A confident dark outer contour gives the silhouette
weight; finer broken interior marks describe joins, wear and expression.
Protect saturated accents and readable shadow color. Softness belongs in light
and atmospheric distance, never in blurry weapon textures or facial features.
Avoid glossy toy rendering, generic sci-fi armor, full-frame grain as a substitute
for painting, uniform noise, crosshatched 3D shadows and excessive haze.

## Identity is a separate contract

Keep the source character's silhouette, proportions, anatomy, face, colors and
signature prop. Style references govern rendering only. A shark must remain a
shark with three sneakers; the wooden log must not become a box robot. Anomalous
uses the actual distorted animal patients in the owner's reference, without
invented gowns, soldier outfits or a generic horror redesign. Animal Hospital
anomaly labels are descriptive; their proposed commander roles are our design.

For each job, save source URL, reference hash, identity checklist, exact prompt,
seed when supported, requested and reported model, image dimensions and output
hash. Existing images and old prompt receipts stay archived. A model name never
proves fidelity. Inspect actual faces, feet, props and full silhouettes.

## Prompt composition

1. Identity: subject, race or source universe, invariant anatomy and props.
2. Render: the complete binding look above, concrete surface and edge behavior.
3. Deliverable: one isolated full-body three-quarter asset, neutral A-pose,
   hands apart, transparent background, no scenery or cast shadow for meshing.
4. Exclusions: no anatomy changes, extra costumes, cropped extremities, text,
   screen overlays or photorealistic materials.

The shared pilot is Vey, the Surveyor: pale pear-shaped Gray head, large black
almond eyes, thin neck, aubergine suit, slate short mantle, ivory cuffs and collar,
mint triangular instrument, violet belt lens. See gray-commander.json for the
exact prompt. Vey and Sarrak are working-name proposals, not imported lore.

## ComfyUI / Krea 2

The supplied workflow is adapted from the official Comfy-Org Krea 2 style-reference
template. Its complete subgraph is retained. Prompt enhancement is disabled so
the model does not expand away from the identity contract. The first pilot uses
one style reference, a fixed seed, and the template's sampler configuration.
Krea 2 is a 2D image model, not a mesh generator. A judged poster can be passed to
the same image-to-3D stage used by other methods.

Required files: krea2_turbo_int8_convrot.safetensors (diffusion model),
qwen3vl_4b_fp8_scaled.safetensors (text encoder), qwen_image_vae.safetensors (VAE),
and krea2_style_reference.safetensors (LoRA). Import krea2-vey-workflow.json in a
current ComfyUI. Put paintline_clash.webp in its input folder and select it in
LoadImage. Model filenames and node classes must match the running server.

Do not assume a generic retro-anime LoRA reproduces this style. It may pull the
palette toward purple. Establish a no-extra-LoRA reference run first; compare
style strength or a separately trained, documented style LoRA with the same
subject, seed, framing and lighting. Inspect at thumbnail size and 100% crop.
Record runtime, peak VRAM, checkpoint hashes and sampler values per run.

Status: workflow prepared from the current official template; local execution
is pending the owner's ComfyUI path/server and installed model discovery.
Detected local GPU: RTX 4080 Laptop, 12 GB. No Krea image or performance claim
is made. Default-port probing did not establish a running server.

Official sources:
- https://docs.comfy.org/tutorials/image/krea/krea-2
- https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_krea2_turbo_int8_image_style_reference.json
- https://huggingface.co/Comfy-Org/Krea-2

## Higgsfield / image-to-3D

The pilot image used gpt_image_2_5, high quality, 2K, transparent requested,
with the same written Vey contract and published Paintline style reference.
Reported image model: gpt_image_2_5. Cost estimate: 3 credits. Keep the receipt.
Transparent was requested, but inspect alpha before reconstruction: a dark
background preview is not proof of real transparency.

The connected model catalogue advertises Meshy image_to_3d, but image submission
rejects it and requires generate_3d, which is not exposed in this session.
No mesh job was created or charged by those rejected calls. Browser fallback
is signed out. The Meshy comparison remains pending, not a Blender substitute.
When available: feed the reviewed full silhouette; request textured output;
preserve delivered resolution; inspect all sides before rigging or animation.

## Blender

Vey has a separate hand-authored Blender comparison, executed in the connected
Blender 5.2 cloud worker. It is an editable, unrigged mesh, not AI image-to-3D.
Semantic parts and embedded painted UV maps accompany GLB and .blend delivery.
Its fidelity should be judged against the same poster. Do not label a procedural
blockout production-ready or count it as the missing Meshy result.

## 3D acceptance

Verify embedded images, UVs, dimensions, alpha mode, material color space and
mesh bounds. Preserve crisp texture on close-up weapons. Carry contour thickness
as a tunable render parameter. No hatch fill or camera-locked texture overlays.
Inspect front, rear and profile; compare pose and silhouette under the same
light and camera. Rig, animate and test deformation only after the mesh is chosen.

## Future game notes

Xeno contains multiple races; current chitin minions are one grunt race. Race,
element and role are independent. Keep brown Physical meteor dwellers on Mars
and purple Void scouts as the first Earth arrivals. Borrow only alien archetypes
and complementary roles from Cosmic Conquest, not its timeline or politics.
PvEvP, multiple commanders and opt-in planet stakes remain future exploration.
