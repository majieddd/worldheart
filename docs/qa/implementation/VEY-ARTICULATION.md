# Vey hand and foot articulation

2026-09-17, Codex, `feature/vey-hand-foot-articulation`, U247-U249.
Published and publicly verified at V2 **4185d75**, [PR 71](https://github.com/majieddd/worldheart/pull/71),
[successful deployment](https://github.com/majieddd/worldheart/actions/runs/35236035454).
[Review the articulation](https://majieddd.github.io/worldheart/v2/design-demos/99-planets/vey-articulation.html?review=4185d75).
All 24 public file identities and desktop/mobile controls pass without console
errors. Main remains 6133d0713f4e93e6fc743c35d9dd0fd1834bc98f.
Total through public verification: **37m 15.5s**, 14:14:58 to 14:52:13.528 UTC.
The public timing table is the earlier release checkpoint. Final local timings
include the retained CI encoding failure, correction and live verification.

## Delivered change

`design-demos/99-planets/vey-articulation.html` compares the new exports with
the previous surface refinement under the same camera. The earlier model,
paint, and approvals are preserved. This is a review candidate.

The ankle-to-ball bone direction did not match the boot sole. The old walk
reached 53.13/47.37 degrees upward and was near-flat for only 7.4/10.7 percent
of the left/right cycle. The correction measures contact phase from ankle
travel, then authors heel contact, flat support and toe departure against the
actual sole frame. It corrects lateral bank as well as sagittal pitch. This is
an authored foot-roll correction, not untouched recovered mocap. Run foot
choreography is retained.

Wrist/cuff radius increases gradually by up to 18 percent, affecting 2,417
vertices. The saved UVs and 4K paint are reused. Forearm spill into the fingers
is removed; ten fitted digit joints and smoothed weight transitions give a
restrained locomotion curl. These are single-joint fingers, not a complete
multi-joint gripping system. No neural reconstruction or image generation ran.

## Evidence and retained failures

- Final motion SHA-256: `e6dab674a5b106c0e4573580dcea720cfef8d72feac3adea2d777fb3edd1a814`.
- 11 articulation, nine sole, six surface and eight motion checks pass against
  final exports. Each report binds to its artifact hash.
- Left/right walk pitch now spans -38.42 to 14.54 / -38.03 to 14.91 degrees.
  Near-flat fractions are 45.5/44.6 percent. Actual grounded flat support,
  requiring both heel and toe below 25 mm, is 31.4/27.3 percent. These are
  different measurements; near-flat orientation alone does not prove support.
- Maximum digit edge strain is 6.0/5.1 percent while walking and 9.9/8.9
  percent while running. P95 stays below 2.5 percent across all clips.
- The original model fails the new roll/digit checks. An initial hard digit
  assignment tore left webbing despite an acceptable P95; maximum strain
  exposed it. Five adjacency smoothing passes repaired that transition.
- A pitch-only correction looked flat in profile but banked the right sole;
  grounded support was zero and the Studio job correctly failed. The final
  sole-frame correction passes. Failed attempts remain in Studio history.
- Reviewed 12 phases each of walk boots from both sides, walk hands, run body,
  run hands and idle hands, plus the static hand fit. Contact sheets are saved
  beside the candidate. This is sampled rendered evidence, not a claim to
  have watched an external tutorial. Two Blender reference pages returned 402.
- 406 repository tests, 30 pipeline tests, syntax and style pass. New viewer
  and local Studio pass desktop/mobile controls with no console errors.
  One test invocation used system Python without trimesh and failed; rerunning
  in the configured runtime passed. Both logs are retained. The first CI build
  passed all 406 tests but caught a Windows text-encoding error in the new page;
  its UTF-8 correction passed the repository style check before republishing.

## Repeatable tool and plugin

Asset Studio exposes **Refine hands & foot roll** for the exact Vey source
profile. Source hashes prevent applying the fitted correction to an unrelated
mesh. It records timings and reports, preserves previous files and approvals,
invalidates current animation approval, and returns to visual review. The
actual final tool replay produced the same motion hash as the inspected pilot.

Aegis **3.18.9**, commit `e326374`, is published and installed/enabled as
`3.18.9+codex.20260917143318`. The character-animation surface-contact method
now distinguishes rigid soles, proper roll, bank and actual support; it also
requires cuff-fit/digit checks and maximum webbing strain. CONTRIBUTING adds
these as supplements to existing gates. Source/cache hashes match, portable
doctor passes and an installed turn-grid workflow passes. No collaborator
workflow was replaced.

## Measured repeat time

| Actual Studio step | Seconds |
| --- | ---: |
| Boot roll, wrists and digits | 8.419 |
| Articulation validation | 16.025 |
| Sole validation | 15.623 |
| Surface validation | 2.011 |
| Entire job including orchestration | **42.519** |

The previous failed Studio attempt took 24.124 seconds. Full development,
failed trials, tests and publication are separate from this cached replay.
The public timing ledger records the release checkpoint; local logs retain
the complete session. Visual acceptance, weapon grips and Roblox import
acceptance remain separate.
