# Vey / local Trellis benchmark 02

Run from the Worldheart repository root. The output is a review candidate, not an
approved replacement for Vey or the art direction. Preserve pilot 01 and the raw
engine outputs. Model-generation Blender primitives were not used.

## Exact engine

Modly Trellis.2 GGUF extension caa85c7a1aa6c6ba9cb3f07f13878ba8e3864912,
Modly host 1476fd0b1c19c9ab177c1ca3ee4d1842119e9f65, Aero-Ex/Trellis2-GGUF
weights revision edf81aef93af0823ac8721da3c9cd3c52d539f87, Q5_K_M only.
RTX 4080 Laptop, 12 GB VRAM; Python 3.11, Torch 2.6.0+cu126. The isolated runtime
is the sibling local-asset-runtime/modly-trellis2 directory. It does not replace
ComfyUI or the original Hunyuan environment. This trials Modly's extension via
its API, not the desktop interface. Public TripoSG is not proprietary Tripo P2.0.

The initial setup process exited zero despite CUDA-wheel failures. Invoke setup
with the TARGET Python version, not the system Python: otherwise it chooses
cp312 wheels for a cp311 environment. The recorded repair scripts rerun only the
CUDA component installation and normalize two malformed upstream .dist-info
folder names inside downloaded wheels. They leave package code unchanged. Verify
imports of torch, cumesh, flex_gemm, nvdiffrast and o_voxel before marking ready.
Do not rerun a multi-GB installation to fix a small dependency error.

## Recorded candidate

1. Preserve the approved gray-commander.png; use supplied alpha instead of
   segmenting fingers again. Center it on white at 85% of a square canvas.
2. Shape: seed 99131, 25 sparse + shape steps, 1024_cascade, remesh 768.
   Raw 2,878,883 triangles are retained locally in artifacts/vey-quality-research.
3. prepare-shape.py: MeshLab quadric reduction to 39,999 triangles with protected
   topology, boundary and normals; scale a copy to two metres. The studio worker
   now includes this reduction and canonical +Z-facing conversion.
4. Texture: raw native-facing mesh, 1024 texture diffusion, 2048 atlas. Retain the
   rejected 12-step / guidance 1.0 trial. The second uses 24 steps / guidance 2.5.
   The current trellis_worker.py takes canonical +Z meshes; the saved raw shape
   from this experiment faces -Z. Use shape-review.glb with the current adapter.
5. finish-palette.py restores Vey's named gray, ivory, plum and slate palette with
   edge-preserving denoise. finish-details.py authors the two eye catchlights and
   crisp mint badge in UV space. These are Vey-specific rules, NOT a generic
   character classifier, and are not silently promoted into the studio defaults.
6. prepare-rig.py preserves UV loops, welds duplicated seam vertices and checks
   face orientation. Blender is used downstream for mesh cleanup and rigging.
7. The existing pilots/vey/rig.py accepts --output-dir and --weights-from. The
   automatic heat solve failed and was rejected. Barycentric nearest-surface
   transfer from the previous Vey rest mesh uses four normalized influences.
   Maximum correspondence distance 9.4 cm, p95 4.6 cm. This is the SAME identity,
   size and rest pose; do not reuse the method blindly on another character.
8. Existing CMU 07_01 walk and 09_01 run supply captured full-body motion. They
   are baselines, not newly authored finger/facial/combat animations. Run the
   asset_quality.py and motion_quality.py checks, then inspect rendered motion.

The shared studio now offers the original engines plus the technically trialled
Trellis route. Its automatic biped draft is still not this supervised Vey rig.
New failing outputs cannot be approved or exported as production-ready.

## Gates and timing

Technical reports bind to exact GLB bytes and reference bytes, never auto-approve
visual quality. Test negative controls for broken texture binding, tiny textures,
invalid weights, missing animation and a frozen pelvis. Inspect the actual face,
materials, all sides, hands, complete cycles and transitions in the browser.

A GLB preserves joint origins, not Blender bone tails. The stance probe requires
an explicit rest-space contact contract. The initial origin-based run diagnostic
was misleading; the corrected toe-tip probe and regression fixtures are saved.
Neither probe certifies natural motion. Raw texture marks also remain visible
with outlines disabled; do not misdiagnose every dark mark as a contour artifact.
Optional stencil-masked contours keep the exterior outline separate from paint.

run_logged.py saves UTC start/end, monotonic elapsed seconds and failures beside
full logs. The studio additionally saves each attempt to timings.json. The main
timing-ledger.json records setup separately and warns about overlapping stages.
Do not add parallel downloads to total wall time or describe one asset as a batch
average. Cached results and preserved raw shape avoid rerunning expensive stages.

## Articulation follow-up

`refine-articulation.py` starts from the saved clean `vey-refinement-v1` blend.
The Studio action **Refine hands & foot roll** checks the exact reference,
surface and rig hashes first. It preserves earlier files and invalidates motion
approval. Reconstruction and painting are not repeated.

This fitted Vey pass authors heel/flat/toe roll from measured ankle phase,
corrects sole pitch and bank, expands the cuff openings with radial falloff,
isolates palm/wrist weights and adds ten digit joints with relaxed motion.
`articulation_quality.py` checks exported sole pitch, grounded flat support and
finger edge strain. Existing surface, sole and motion checks remain in force.
The original upturned boot, hard digit-weight seams and outside-edge support are
retained as failure cases. Owner visual acceptance remains separate.

## Evidence

Browser steps: browser-steps.cjs. Local evidence: artifacts/vey-quality-research.
Published assets: lib/99-art/vey-benchmark-v1; viewer: vey-benchmark.html.
CMU attribution and source limitations remain with the prior pilot documentation.
Roblox import/budget checks and owner visual acceptance are still separate gates.

## Complete reference packs and accepted Vey replay

Concept generation now saves the hero, six individual directional views, sampled
color palette, walk/strike guide and portable prompt. Successful views are cached
by hero, brief, settings and recipe hashes. An incomplete or changed pack cannot
be approved. Inspect the first generated view before spending on a batch: the
Krea pilot changed Vey's mantle into a long coat and was rejected. Generated views
are design proposals, not calibrated projection inputs. Shape currently consumes
the hero only. Export includes the pack, reports and production contract.

For an existing accepted model, **Render exact model references** uses six
orthographic cameras and records their transforms. Walk frames come from the
source clip. The compatible arm profile also provides labeled strike pose
proposals; it does not claim a baked attack. Alpha-aware palette sampling retains
minor accents and excludes transparent background pixels.

**Replay complete Vey refinement** performs the saved surface/sole, semantic
paint, motion and wrist/digit refinement with artifact-bound checks. This is an
exact-source Vey recipe; other anatomy still requires a fitted material and rig
profile. Preserve the accepted model while testing replays in a separate project.
See `docs/qa/implementation/VEY-FIELD-REFERENCE-PIPELINE.md` for live-scene and
replay evidence.
