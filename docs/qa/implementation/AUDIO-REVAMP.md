# YuE2 soundtrack and sound feedback

**Superseded: owner listening failed this pass on 2026-09-15.** Reported vocals,
tinny/sharp effects and static-like ambience require complete rollback. Automated
checks below are historical and do not establish vocal absence or sound quality.
Follow [restoration and retry](AUDIO-RESTORATION.md).

Updated 2026-09-15. Codex owns `feature/yue2-audio-revamp`,
[draft PR #43](https://github.com/majieddd/worldheart/pull/43). Based on V2
`309aaa7` plus its documentation closeout. Publication remains V2 only.

| Item | Scope | Status | Acceptance |
|---|---|---|---|
| U136 | Exact video workflow, local YuE2 soundtrack and provenance | Implemented; automated checks passed | Six delivered instrumentals screened; human listening remains open |
| U137 | Engine, buses, bounded voices and mechanic cues | Verified locally | Cached bank, spatial feedback, input timing, lifecycle and combat checks |
| U138 | Music transitions, ambience, touch mixer and Debug audition | Verified locally | Actual media output, loops, stream retirement, gesture unlock and settings |
| U139 | Delivery, adversarial regression and V2 publication | Published and publicly verified | V2 `1f2eb75`, successful Pages action, 157 asset comparisons and 123 public browser checks |

## Delivered implementation

- Six original YuE2 pieces: lobby, exploration, battle, danger, victory and
  defeat. 305.8 seconds of delivered music, 7.35 MB total, streamed as 48 kHz
  stereo MP3. There is no inference or model download on a player's device.
- 84 original nonvocal effects, 171 baked variations in a 3.08 MB bank. Weapons,
  hits, creatures, character movement, mounts, powers, construction, inventory,
  rewards, weather, local ecology and interface actions have dedicated cues.
  Effects are authored sound design, not falsely attributed to YuE2.
- Two music decks crossfade with combat state. Alerts and important rewards
  briefly duck music. One cached effects buffer, distance attenuation, stereo
  positioning, per-cue rate limits and a 24-active-voice budget limit combat
  work. Stolen voices have a short release tail; the cap describes logical
  active voices, not an absolute count of every releasing Web Audio node.
- Master, music, effects, ambience and interface sliders plus mute are in the
  existing game settings, mobile Field menu and lobby. Debug's Sound studio
  auditions every cue and track. Stop preserves volume and permits replay.
- Gesture unlock, interruption recovery, hidden-page suspension, disposal and
  failed-asset fallback keep input feedback responsive. Audio state remains
  outside the deterministic simulation; gameplay rules are unchanged.
- `audio/` is included in V2 publication and generated mirrors. The local
  single-file build embeds the same delivery assets. Stable main remains separate.

## Exact generation and rights

The [owner's video](https://www.youtube.com/watch?v=9RtywbN--QE) and its linked
workflow were inspected before setup. The runtime uses stock native ComfyUI
YuE2 ABC score generation, music conditioning, 32-step dpm_2 sampling and tiled
VAE decoding. No reference song, voice or copyrighted performance was supplied.
Inputs are original instrumental style and bracketed arrangement instructions.

The [Comfy-Org/YuE2](https://huggingface.co/Comfy-Org/YuE2) BF16 checkpoint,
revision `8e6fcf0f23252ed188b634bd50d44f4b01fba890`, was downloaded locally and
matched SHA-256 `33765adbf9813c9a50318218760b2fd819a319862460a04884607581961c6fee`.
The isolated ComfyUI checkout is `36da3ff763687eab86a35e1019995dd1fb369b0d`,
with Python 3.12 and CUDA PyTorch 2.10 on the author's RTX 4080 Laptop GPU.
[Runtime versions](AUDIO-REVAMP/runtime-freeze.txt),
[repeatable authoring instructions](../../../tools/audio/README.md),
[delivered provenance](../../../audio/music-provenance.json).
The model stays outside Git in the sibling authoring directory.

Model weights use **CC BY-NC 4.0**; upstream code uses Apache 2.0. The preview
records that noncommercial restriction and does not assert commercial output
rights. Attribution ships with the assets in `audio/README.md`.

Pristine FLACs were retained before bounded eight-second phrase leveling,
1.6-second equal-power wraps and two-pass loudness normalization. Actual final
levels are -20.26 to -20.27 LUFS, with true peaks from -7.76 to -2.84 dBTP.
These are measured values; musical phrase quality still needs listening.

Three first takes and the second exploration take exceeded the preregistered
0.12 vocal-event screening threshold. They were replaced, not waived. The
final exploration arrangement uses detached guitar, piano and woodblock.
[First screen](AUDIO-REVAMP/retained-first-score-screen.json),
[second screen](AUDIO-REVAMP/retained-second-score-screen.json),
[accepted final hashes and screens](AUDIO-REVAMP/accepted-vocal-screen.json).
The score's original and delivery hashes, seed, processing and successful
request/history receipts are retained for each track. Scores are classifier
outputs, not calibrated probabilities or proof that no vocal artifact exists.

## Runtime and adversarial evidence

339 automated tests, 100/100 source syntax checks and the house style gate pass.
The generated V2 mirror matches all 120 source files; the standalone build is
16.54 MB with 102 modules and embedded audio.

- 100 actual game/lobby/Debug browser checks: all 84 decoded cues, bounded burst
  behavior, native touch sliders, mobile geometry, persistence, mute, context
  recovery and no exceptions. [Report](AUDIO-REVAMP/effects-browser.json).
  The final decoded bank is 36,902,452 bytes, below the 40 MiB budget.
- 23 real-score component checks: six media hashes/MIME/durations, actual
  isolated music output, loop wrap, one remaining stream after each crossfade,
  Stop/replay and no errors. [Report](AUDIO-REVAMP/score-browser.json).
- 16 lifecycle fault fixtures: two-deck unlocking, rapid transitions, spatial
  output, visibility, disposal and failed-download recovery. This suite uses
  intercepted synthetic test media, never shipped or described as generated
  music. [Report](AUDIO-REVAMP/lifecycle-fixtures.json).
- Four standalone checks verify classic-map boot, embedded music playback,
  bank decode and no external audio requests. [Report](AUDIO-REVAMP/bundle.json).
- 21 production mechanic fixtures cover each weapon family, weapon power, all five
  commander abilities, mounts and silence while the scepter is overheated.
  [Report](AUDIO-REVAMP/mechanics.json).
- The final score completed an instrumented ten-wave defense with 20 heart
  health, 251 defeated enemies and seven items extracted to Planet 2. It played
  841 cues across 39 identities, including storms and earthquake, without audio
  errors or unknown names; music reached victory. [Run](AUDIO-REVAMP/score-defense.json),
  [arrival](AUDIO-REVAMP/score-arrival.json). Legal purchases and movement policy,
  accelerated simulation and sparse rendering: not blind play or a phone benchmark.
- The earlier effects checkpoint also passed a complete defense and all seven
  camera/map suites. [Prior run](AUDIO-REVAMP/defense.json),
  [camera evidence](AUDIO-REVAMP/cameras.json).

Retained fixture corrections: initial slider counting included hidden controls;
the next Debug fixture omitted its mobile inspector. Both were corrected to
use the actual visible interface. The first new weapon fixture tried a carbine
on the incompatible Bulwark commander; the game correctly refused that loadout.
The refined fixture uses a compatible production body for each family. None of
these failed fixtures is evidence of a product regression. The first public
score check also required exactly `audio/mpeg`; GitHub serves `audio/mp3`.
All six assets already matched their hashes, durations and output checks. The
refined check accepts both MP3 MIME spellings and retains the initial report.

## Remaining acceptance

Native audio input is unavailable to this agent: an attempted WAV audition
returned an explicit unsupported-audio response. This record does not claim
subjective listening, guaranteed vocal absence, physical-phone speaker quality,
or Safari/iOS hardware acceptance. Final owner listening in Sound studio and
real-device play remain open, along with the already tracked full-campaign work.
A public preview is reviewable implementation, not commercial release approval.


## Publication, 2026-09-15

Published V2 is `1f2eb7593f639aa4399b832f59f1043cc0d264d8`.
[Pages action 34942144017](https://github.com/majieddd/worldheart/actions/runs/34942144017)
passed build validation and deployment. Main remains
`1374122d1109919a5fab10b69fefdfb80308eb6e`; no gameplay branch was merged into it.

All 157 manifest-listed public assets match both the deployment manifest and
exact Git source, including seven compressed audio files and both stable and
preview route assets. [Identity](AUDIO-REVAMP/public-identity.json).
The public site passes all 23 real-score checks and 100 game/lobby/Debug audio
checks. [Public score](AUDIO-REVAMP/public-score.json),
[public mixer](AUDIO-REVAMP/public-mixer.json). This confirms actual live music
output, looping, touch mix controls and persistence; it does not replace listening.

Play [V2](https://majieddd.github.io/worldheart/v2/) or open
[Debug World](https://majieddd.github.io/worldheart/v2/debug.html), expand Sound
studio in its controls and select an instrumental track or cue. On mobile,
open Exhibits and controls first. The separate authoring runtime is installed
for future work; its server has been stopped and GPU cache released after generation.
The documentation/test closeout does not change deployed runtime asset bytes.
