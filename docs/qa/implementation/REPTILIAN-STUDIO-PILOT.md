# Albino Reptilian / Asset Studio pilot

Owner request: another Xeno Commander in Painted-Anime-Inkline, produced through the local tool while fixing the workflow. Vey remains the accepted Gray Xeno Commander. The new character is an owner-review candidate; a working description is not a new canonical name or element.

## Current evidence

Local project `2c2e57d9be1f`, Studio `http://127.0.0.1:8773/?project=2c2e57d9be1f`. Runtime assets and every attempt live outside Git in `local-asset-runtime/studio-data/projects/2c2e57d9be1f`. The public artbook receives curated current artifacts; failed and superseded attempts remain in evidence/history.

- Hero 1: local Krea, 80.094 seconds. Rejected olive exposed scales for the albino brief.
- Color revision: one stalled job cancelled through the Studio, retained as a failed attempt. Releasing Comfy model cache allowed the retry to finish. White scales corrected; tail still clipped the frame.
- Framing revision: preserved the selected white character and pulled the complete tail inside the image. `concept-282623cd16.png` is the selected hero for candidate reconstruction.
- Generated angle tests failed identity review. A long prompt changed the head/body ratio and armor; a shorter prompt fixed front camera orientation but still redesigned the costume. These are not approved alternate views and must not become texture projections.
- Switched through the tool to the exact-model-reference route. The hero is the independent shape/paint authority; six model renders document the reconstructed asset after refinement. Hidden surfaces remain proposals, not independently verified design facts.
- First opaque-image reconstruction needed the missing Bria background-removal weight. The download is setup overhead; inference is local. No asset or prompt was sent to an external generation service.

## Tool corrections

Main concept and reference generation are separate checkpoints. Reuse a current concept as the next identity reference. Test one angle before a batch. Retry individual views without deleting their previous files. Generated reference cache identity depends on image-workflow code rather than unrelated HTTP/UI edits.

Exact-model mode permits reviewed hero reconstruction first and requires complete model views before animation approval. Agent reviews are explicitly marked as such; they cannot claim owner acceptance. Model, brief, reference and anatomical-fit hashes guard against stale reuse.

A mesh-bound anatomical fit can be imported/downloaded in Studio. It uses normalized heat binding, the retained CMU captures, explicit tail joints, rigid surface regions and the demonstrated heel-flat-toe law. New anatomy requires its own fit; the generic 17-bone fallback is still a draft. The Reptilian fit and measured motion acceptance are recorded after actual model inspection.

The revised tool runs on 8773 alongside the untouched legacy 8771 service. Launcher and model-reference rendering use the same configurable address. Runtime checks cover the real project UI on desktop/mobile. Full timings, retained failures and browser evidence are under `artifacts/ink-132/`.

## Replayed production candidate

The complete local tool produced the curated `lib/99-art/reptilian-pilot-v1/` delivery. The hero, six exact views, palette, portable prompt, three motion clips, fitted material/joint profiles, recipe and measured motion report are available together. The public inspector is `design-demos/99-planets/commander-preview.html`; `atmospheric-arena.html?world=meadow&commander=reptilian` uses the original 1.3.2 renderer. The default arena still loads accepted Vey.

| Step | Correction encoded in the tool | Evidence / boundary |
| --- | --- | --- |
| Shape | Reuse dense Trellis output; unsigned occupancy repair and bounded reduction | 19,238 vertices / 39,876 triangles, closed consistent surface. Direct reductions and signed voxel repair broke this source and remain rejected attempts. |
| Paint | Mesh-bound material regions, capsule-shaped tail mask, ivory/plum/brass/turquoise palette, red eye details, bounded pigment, 4K UV bake and gutter fill | Retains UV layout. This is fitted material repainting; it does not recreate every fine concept detail. |
| Rig | 26 explicit joints, heat binding, arm clearance, four tail joints, rigid sole regions | Visual joint editor and profile import/export. New anatomy requires its own initial fit. |
| Motion | Captured Idle/Walk/Run, heel-flat-toe roll, tail lift and per-foot running contact correction | Both feet contact the floor; complete loop surface error is 0.000551 m Walk and 0.001532 m Run. Run retains a flight phase. |
| Reference packet | Six calibrated model views, fitted palette, real walk frames and labeled strike pose proposal | Derived model views document the reconstruction. Strike is not an authored attack clip. |
| Replay | Saved hero/shape/raw-paint identities, full material and joint profiles, automatic repaint/rebind/motion/checks/reference stages | Completed through the Studio API, stops at review. Changed identity bytes reject stale recipes. |
| Export | Preserve approved GLB bytes; create editable Blend/FBX from saved Blender source; check decoded textures | Initial re-import package lost texture and failed. Corrected package contains 42 files with a clean ZIP CRC check. |

Final GLB SHA-256: `f32d4816a110c79eedae1d066b824dfdd5cb4116baffd98c87659ba19163a9a4`. The polished GLB matches the reviewed motion asset byte for byte. Full package: local `artifacts/ink-132/reptilian-package.zip`; the Studio download rebuilds it from the saved project.

Motion source setup now prepares the two selected CMU captures with pinned SHA-256 checks. It reuses local files and never replaces mismatched sources. Attribution: the data used in this project was obtained from mocap.cs.cmu.edu; the database was created with funding from NSF EIA-0196217. These two takes support derived character motion, not standalone data resale.

## Timing and verification

The final fitted replay took **65.990 seconds**: paint **50.225**, fitted motion and checks **9.227**, exact references **6.452**. Successful polish took **3.187 seconds**. These are replay timings after the initial concept, reconstruction and anatomical/material fit; they are not fresh-character end-to-end timings.

`lib/99-art/reptilian-pilot-v1/timing.json` retains all measured production attempts. The union of pipeline execution intervals is **3,982.734 seconds**; nested stages are not counted twice. Through the publicly verified production checkpoint the whole request occupied **4 h 31 m 03 s** wall clock, including Vey/Archives work, engineering, inspection and an approximately 67-minute continuation pause. It is not generation time or a billing measurement.

Local verification: 43 Studio tests pass. Actual Studio desktop/mobile controls load the saved recipe, complete reference packet, clips and installed model/LoRA settings. Joint editor front/side/mobile views pass. New inspector, embedded Xeno catalogue, current media and original Vey arena regression pass. Reptilian arena checks cover walk/run/stop, all three worlds, graphics, contour, first-person rifle and flight. Full logs, failed invocations, screenshots and timings remain in `artifacts/ink-132/`. Repository gates pass: 408 tests, syntax and style; deploy verified 594 mirrored files and rebuilt both single-file outputs. Pages run `35274789244` succeeded at preview `b596286`. All 26 checked public files match Git bytes; public inspector, arena and embedded catalogue checks pass. Initial 15/20-second public waits timed out during cold model downloads. The shared viewer now exposes download progress and disables controls until ready; the final bounded network checks pass. Failures remain in the logs. Aegis 3.18.11 is published through plugin PR #12 and installed in Codex; the installed method hash and portable doctor pass. Existing Claude/Hermes host-link failures remain outside this Codex installation scope.

## Remaining owner review

This is a new candidate, not owner-approved replacement art. The reconstructed mesh simplifies the concept's fine anatomy and costume; small hand/hip overlaps still merit visual review. New body types are not universally auto-fitted. No authored commander strike animation or Roblox import/performance acceptance is claimed. Original Vey and frozen 1.3.2 remain intact.
