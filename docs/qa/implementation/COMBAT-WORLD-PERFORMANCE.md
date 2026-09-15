# Combat motion, world performance and music drafts

2026-09-15. Owner: Codex, branch `feature/combat-world-performance`.
Tracker #1: U146 swing audio and weapon motion; U147 generation and quake
performance; U148 five instrumental reference-conditioned music auditions.
Published as V2 `fc5299c`, [PR #45](https://github.com/majieddd/worldheart/pull/45).
[Pages deployment](https://github.com/majieddd/worldheart/actions/runs/34964348368) succeeded; public behavior and identity verification passed. Main is not a
release target. Music drafts require owner approval.

## Findings before edits

- Normal play uses `AudioEngine`; the material comparison is opt-in.
- Twin first-person motion rotates the whole pair; hand selection incorrectly
  depends on commander type rather than equipped weapon.
- Spear third-person motion rotates independent arms without a shared grip.
- World generation synchronously builds navigation; quake forecasting repeats
  a full solve at commit, and visual deformation visits the entire globe.

## References

- [Adobe Mixamo](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html):
  retargeted humanoid animation requires a compatible rig. Preserve this game's
  instanced rig and author its grip-constrained motion; no imported clip claimed.
- [ComfyUI ACE-Step 1.5](https://docs.comfy.org/tutorials/audio/ace-step/ace-step-v1-5)
  and its installed `ReferenceTimbreAudio` node: local reference conditioning.
  Generated audio remains an audition; machine measurements are not listening.

## Weapon motion and swing sound

The instanced third-person rig now solves both arm segments to authored grip
targets. Spear hands lie on one shaft and thrust along its direction. Twin Fang
cuts with one hand while the other guards; its trail follows the active hand.
First-person arcs use continuous cubic tangents through contact, independent
Twin Fang hand poses, and a fixed spear orientation. Default Duelist and
equipped Twin Fang retain their existing, different hit timings.

Normal V2 and the optional material-audio path both use three cached air-sweep
variations per weapon family. Rounded turbulence replaces the bright, cheap
noise burst; envelope velocity follows strike timing. No new ambient bed or
pitched ping was introduced. The six owner-approved samples remain unchanged.
Audio Lab provides a true old/new swing comparison using its weapon selector.

`tools/qa-combat-motion.mjs` checks 482 poses per weapon: finite matrices,
unchanged upper/forearm lengths (maximum error 1.39e-16), and spear grip/shaft
alignment (maximum cross-product error 0.000075). Real held attacks and movement
exercise all three equipped families, audio routing and first/third-person
views. Rendered wind/contact/follow poses were inspected. This is targeted
runtime QA, not a claim of imported mocap or owner-approved feel.

## Measured world and earthquake changes

Navigation and mesh/scenery loops now yield cooperatively during loading.
Repeated exact-coordinate terrain samples and accepted cap certificates are
reused; fog copies the already-displaced terrain positions. Hash collisions
only evict cache entries; they never quantize heights. The fallback scheduler
uses message tasks so browsers without Scheduler.yield avoid nested timer clamps.

Desktop Chrome, 1280x720, local server, sequential runs:

| Seed / theme | Previous load | Final load | Previous largest task | Final largest task |
|---|---:|---:|---:|---:|
| 12345 / temperate | 20.08 s | 18.69 s | 14.76 s | 0.72 s |
| 2919286854 / Io | 26.13 s | 21.27 s | 22.23 s | 0.55 s |

All 13 terrain, colour, fog and navigation buffers are byte-identical for both
seeds; heart and portal nodes also match. These are bounded desktop results,
not physical-phone benchmarks or a promise that loading is instantaneous.
The [paired baseline/intermediate results](combat-world/world-before-and-intermediate.json)
retain an unsuccessful iteration: timer yielding plus shader precompilation
made total startup worse. Removing those costs and reusing exact air-clearance
certificates produced the [final measurements](combat-world/world-final.json).

Earthquake preparation now runs while combat continues, then gives the full
eight-second red warning. Commit reuses the prepared terrain and navigation
when valid. Tower edits recompute occupancy paths on that prepared terrain;
actual terrain changes fall back to a fresh solve. Private snapshot buffers
prevent live tower edits from mutating forecast work. The predicted air-edge
test was corrected to include the proposed fault height.

The [baseline profile](combat-world/baseline-profile.json) spent 6.13 seconds in
preparation with combat held, then 3.60 seconds in the shift. The
[local quake check](combat-world/quake-local.json) measured a 0.36-second prepared
commit, with 8.4 ms maximum work slice. A simulated tower-footprint edit took 1.41
seconds, with 4.7 ms maximum slice. Camera/rendering continue between slices.
An independent direct terrain rebuild matches all nine forecast buffers.
Disrupted nests collapse, tower footprint arrays survive, the new occupied node stays blocked and excluded
from the solved path, and simulation resumes.
Forecast and commit checks use forced disasters and shortened post-preview
warning waits; they are not full-campaign blind evidence.

## Five music auditions

Five planet arrangements, about 90 seconds each, use ACE-Step 1.5's native reference/cover
conditioning with the owner's supplied tracks and instrumental-only prompts.
This route replaces the rejected YuE2 approach for these auditions. Exact
recipes, model subset hash and source provenance are in
[audio/auditions/CREDITS.md](../../../audio/auditions/CREDITS.md) and its manifest.
All nine original soundtrack assets and runtime mappings remain unchanged.

The initial short-reference takes were rejected: the node padded a 32-second
cover reference with silence, leaving long quiet tails. The replacement uses
the full 96-second reference extent. Silent tails after natural endings are trimmed.
The first PCM export also clipped isolated peaks; the replacement adds 9 dB
of headroom before lossless export, then level-matches the intact signal.
Rejected take IDs are retained in
[music-rejected.json](combat-world/music-rejected.json). These are new
reference-derived arrangements, not assertions of unrelated melodies.

Audio Lab exposes five lazy native players in a separate approval section,
with planet names and references. Only static gain and short edge fades are
applied in mastering. No player downloads a song before an audition gesture.
Agent hearing is unavailable; output measurements never certify no vocals or
musical quality. U148 remains awaiting the owner's listening approval.

## Verification and handoff

- 340/340 gameplay tests; 100/100 source modules parse.
- Source-informed world hashes, forecast oracle and actual weapon input checks
  are recorded above. [74 browser audio/UI checks](combat-world/audio-local.json) pass, including all
  five drafts, nine owner tracks, phone layouts and gameplay/lobby audio controls.
- One fixed-wall-time motion rerun while the music model occupied the GPU
  observed only one spear strike within its 1.5-second window. No runtime error
  occurred. The test now waits for two simulation attacks with a bounded timeout;
  final game/performance checks run without concurrent model inference.
- The forced message-task fallback loaded seed 12345 in 15.44 s (largest task
  575 ms), with all 13 buffers unchanged. This is a Chrome fallback exercise,
  not a physical Safari benchmark. [Result](combat-world/world-fallback.json).
- [Music measurements](combat-world/music-levels.json): zero clipped samples in
  final lossless exports; delivered peaks -7.24 to -2.48 dBTP, -20.14 to -18.99 LUFS.
  Five 92-96 second arrangements.
- [Motion report](combat-world/motion-local.json); [contact pose](combat-world/contact.png),
  [Twin Fang view](combat-world/first-person-duelist.png), [spear view](combat-world/first-person-warden.png).
- Generated V2: 135 source-identical files, 102-module single-file export.
- [76 public audio/UI checks](combat-world/audio-public.json),
  [public weapon input/pose checks](combat-world/motion-public.json), and
  [187 public asset/removal checks](combat-world/public-identity.json) pass.
  Public checks also confirm zero music requests before audition gestures and
  zero approval-draft downloads during gameplay music context changes.
- Main remains `1374122d1109919a5fab10b69fefdfb80308eb6e`. The evidence closeout
  changes documents and QA only; deployed runtime identity remains `fc5299c`.
- [Public earthquake check](combat-world/quake-public.json) passes the direct
  rebuild oracle, ongoing combat, disrupted-nest collapse, edited-footprint
  exclusion and resumed simulation. Prepared commit 0.36 s; occupancy refresh
  1.41 s in this repeat.
- Open acceptance: owner listening and motion feel, physical mobile devices,
  broader seed/hardware coverage and the separate full-campaign QA backlog.
