# Painted-Anime-Inkline 1.3.2, Vey and Archives

U253-U255. Codex / `feature/ink-132-vey-archives`. Started 2026-09-17 16:42:49 UTC.

The owner reported that the separate Vey field diverged from the accepted art direction. Source inspection confirmed changed lighting, fog, shadow type and a separate PBR model treatment. The original Atmospheric Arena remained intact and rendered successfully in a live baseline capture. It is now the current Vey environment.

## Current renderer and commander

- Exact supplied numeric preset saved as `art-candidates/atmospheric-ink-v1.3.2.json`; its source declared 1.3.1, but the owner explicitly requested the new 1.3.2 identity. Only contour thickness differs from prior Vivid Paint: 1.81 instead of 2.8. All eleven supplied values are preserved.
- Vey is a Xeno Commander. The accepted GLB is unchanged. Arena paint/cel shading, mesh-anchored pigment and adjustable skinned contours now handle his existing UV texture.
- Default camera is third person. Its walk/run pace matches accepted source travel. First-person combat pace and weapon feedback remain available. Vey has no authored attack or jump animation; do not label the weapon rig's action as a new full-body clip.
- The first skinned-outline integration duplicated the mesh bind transform, leaving a displaced dark silhouette. Fixed by placing a same-transform shell beside the skinned mesh and sharing its bind mode and skeleton. Retained before/after screenshots and regression assertion verify the correction.
- Settings export identifies 1.3.2; old 1.3.1 files still import. Reset restores the new default. Original, prior Vivid and Deep Ink remain under Archived presets.

## Current artbook and Archives

The primary five sections exclude explicitly archived media. The sixth Archives tab contains earlier/rejected method comparisons, superseded rosters, alternate UI layouts, historical captures, old presets and the medieval studies. Original files and URLs are preserved. Binding Paintline and Inked Cel references remain current because they still define the direction.

Current production shows accepted Vey, his exact views and the original arena capture. Design Principles uses the current method rather than rejected Blender/Krea/Higgsfield comparisons. Vey's Xeno role is explicit. Legacy archive routes resolve to Archives. Catalogue `archived` flags are the editorial source of truth.

## Validation

- Live original arena baseline: 5.83 seconds, no browser errors.
- Revised arena: walk/run/stop at measured speeds, attached contour transform, contour toggle, rifle fire, flight, three environments, versioned export, legacy import, reset and mobile settings pass in 7.72 seconds.
- Artbook: all six sections/images, current/archive separation, image modal, current method and mobile overflow checks pass in 8.56 seconds.
- First input harness sent keys to Window rather than a DOM element; its errors are retained. Corrected bubbling canvas-key fixture passes. This is instrumented interaction, not a claim of a full natural play session.
- Repository tests pass; syntax/style/build and public release identity are recorded after publication.

Raw logs, timings and screenshots: `artifacts/ink-132/`. Owner-requested albino Reptilian commander production follows this checkpoint through Asset Studio, with separate candidate status and timing.
