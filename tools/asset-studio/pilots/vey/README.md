# Vey manual production pilot

This is a saved experiment for owner review. It is not wired into the studio's
default automatic workflow. All paths below are relative to the Worldheart root.
Use the existing `local-asset-runtime/blender-py311/Scripts/python.exe` for Blender
steps. No new shape or motion model installation is required.

## 1. Reference and shape

The owner-preferred built-in hero is `lib/99-art/identity-v2/gray-commander.png`.
The built-in turnaround keeps this character and supplies front/left/right/back,
plus advisory top/bottom details. `prepare.py` separates the six supplied grid
cells without editing their content, saves a palette and exports a portable prompt.

The hero and four cardinal illustrations are identity and material references.
Top/bottom are perspective drawings, not calibrated orthographic projections.
Tripo input order is front, anatomical left, back, anatomical right. Do not send
the six-cell presentation sheet as if it were one view of one object.

The geometry was already reconstructed with local Hunyuan3D-2mini from the hero.
Reuse that preserved source. `paint.py` starts from its previous UV export, welds
duplicate vertices, removes loose vertices, decimates a separate copy to about
39,000 triangles and builds a fresh UV layout. The original is untouched.

## 2. Paint

Run `paint.py`. Four orthographic camera directions use a depth buffer and normal
weights; silhouette spans register each reference to the current shape. Cardinal
camera directions are front -Y, left +X, back +Y, right -X in Blender Z-up space.
All paint is baked to a 2048px UV map. Source images are retained at delivered
resolution. The image sheet's individual views are 512px: the atlas size does not
magically add source detail.

Manual correction: preserve continuous ivory forearm/boot guards and collar where
different reference poses would mix plum pixels into solid ceramic. Unseen
surfaces use authored material colors and small object-space brush variation.
`paint-coverage.png` separates referenced texels from authored fill. Inspect the
collar, cuff boundaries, face, seams, back and soles before accepting paint.

## 3. Real motion source

Download only these four files into `artifacts/vey-pilot/mocap/`:

- `http://mocap.cs.cmu.edu/subjects/07/07.asf`
- `http://mocap.cs.cmu.edu/subjects/07/07_01.amc`
- `http://mocap.cs.cmu.edu/subjects/09/09.asf`
- `http://mocap.cs.cmu.edu/subjects/09/09_01.amc`

The data used in this project was obtained from mocap.cs.cmu.edu. The database
was created with funding from NSF EIA-0196217. Keep that credit with the derived
model. Raw capture data must not be resold standalone. Finger channels were not
actually captured and are ignored. HTTPS certificate-chain validation failed on
this host; the source's public HTTP download was used. No certificate verification
was disabled and no model weights were downloaded for motion.

Run `mocap.py`: parse ASF/AMC, preserve 120Hz capture timing, determine facing from
actual travel, measure one complete gait period from foot extrema, minimize the
full-cycle pose/velocity seam, detrend path motion while retaining pelvis bob/sway.

## 4. Manual rig, retarget and polishing

Run `rig.py`: 22 bones placed for this specific mesh, normalized heat skinning,
world-direction retargeting to Vey's limb lengths, 60Hz keys, full captured cycles.
The geometry-informed box masks were rejected: finger vertices crossed their
boundaries and became attached to legs. Normalized heat skinning fixed those
cross-limb stretched triangles. The initial raw heat weights were not normalized;
normalization is required before checking that every vertex is weighted.

Actions begin at frame zero to avoid adding a one-frame hold at each exported
loop boundary. Preserve pelvis translation, including approximately 4.9cm of walk
and 8.9cm of run vertical range. Idle is a small authored breathing loop. No finger
animation or battle animation is claimed by this pilot.

## 5. Review before promotion

Run `check-deformation.py`; it must reject short rest edges stretched past 25cm.
The saved bad binding was observed failing this gate. Review complete walk/run
sequences from the side, front and rear in `vey-pilot.html`. The browser-side
`runtime-review.js` checks the actual exported GLB, including cadence, translated
pelvis and seam. GLTFLoader sanitizes dots from bone names; resolve that alias.
Run `browser-steps.cjs` through Aegis `tools/headless.js` against the local or public
pilot URL. Pass the steps file as an absolute path. This also switches through all
three model stages and checks mobile overflow. A static-outline shader regression
was discovered only by this switching check: expand along the source `normal`
attribute before skinning, because unlit static shaders may omit `objectNormal`.
Retain compiler errors and require a nonzero CLI exit for browser errors.

Use the rig and 3D foot-path overlay, slow playback, and walk/run crossfade. Moving
ground speed comes from measured stance travel after retargeting, and updates
with elapsed time rather than a fixed assumed frame rate. Save model, editable
Blend, reference pack, original sources, scripts, receipts and rejected evidence.

Run `package.py` after updating any reference or motion guide. It rebuilds the ZIP
and verifies every archived input against its current file. Owner approval remains
false; packaging is not a promotion step.

Owner acceptance is separate from these checks. Unseen-surface illustration,
shoulder/hand deformation and Roblox import/budget validation remain review topics.
After acceptance, promote only the demonstrated method, not the rejected masks or
an unverified promise that these bone coordinates work on every character.
