# YuE2 soundtrack and sound feedback

Active 2026-09-15. Owner: Codex. Branch: `feature/yue2-audio-revamp`, based on
V2 `309aaa7` plus the prior documentation closeout. Publication remains V2 only.

| Item | Scope | Status | Acceptance |
|---|---|---|---|
| U136 | Exact video workflow, isolated local YuE2 generation, soundtrack and provenance | Active | Pinned runtime/model, actual instrumentals, no vocals, listening/waveform checks, documented rights |
| U137 | Responsive engine, buses, bounded voices, spatial feedback and mechanic cues | Implemented; targeted verification passed | Audible coverage, clean lifecycle, no duplicate feedback, measured combat cost |
| U138 | Music transitions, ambience, mobile unlock, mix controls and Debug audition | Implemented; generated score acceptance pending | Browser interaction, pause/visibility recovery, settings persistence, compact touch layout |
| U139 | Asset delivery, adversarial regression and V2 publication | Planned | Repository gates, classic/campaign boot, complete defense, live identity and audio checks |

## Direction and evidence boundaries

Music uses the YuE2 model demonstrated in the
[owner's video](https://www.youtube.com/watch?v=9RtywbN--QE): native ComfyUI YuE2
nodes, score generation, semantic conditioning, 32-step sampling and tiled VAE
decoding. Short effects use authored sound design and must not be labelled
YuE2-generated. No speech, singing, vocal chops or lyrical material belongs in
the catalogue. Creature and commander feedback remains nonverbal.

The existing engine synthesizes short cues and a continuous pad/wind bed. It has
no imported soundtrack. Preserve immediate feedback while avoiding per-shot
synthesis graphs and unbounded loading on mobile.

Model source: [Comfy-Org/YuE2](https://huggingface.co/Comfy-Org/YuE2), revision
`8e6fcf0f23252ed188b634bd50d44f4b01fba890`. The card declares CC BY-NC 4.0
weights; upstream code uses Apache 2.0. Record this noncommercial restriction
with preview assets. Commercial distribution rights are not asserted. No
copyrighted reference song or vocal performance is supplied as generation input.

Current evidence: video metadata/transcript and linked workflow inspected;
native ComfyUI YuE2 source inspected. Isolated runtime/model setup is underway.
No new audio is live yet. Generation, listening, runtime, performance and
physical-device acceptance are separate gates.

## Effects checkpoint, local verification

Draft [PR #43](https://github.com/majieddd/worldheart/pull/43) retains the review.
The full BF16 checkpoint downloaded and matched its published SHA-256. An
isolated Python 3.12 / CUDA PyTorch 2.10 runtime is being installed outside the
repository. The soundtrack has not yet been generated or published.

- 84 authored nonvocal cues, 171 baked variations. One 3.08 MB MP3 bank decodes
  to 36,902,452 bytes on the reference browser, below the 40 MiB budget.
- 99 initial browser checks; refined tests verify visible 48px mobile sliders
  through the actual Field menu, plus touch unlock, mute and storage recovery.
- 16 lifecycle fixtures cover two-deck streaming, fade cleanup, real output
  analyser energy, spatial direction/attenuation, hide/show, disposal and failed
  asset recovery. The fixture score is synthetic test media, never shipped or
  represented as YuE2. [Fixture evidence](AUDIO-REVAMP/lifecycle-fixtures.json).
- 338 automated tests and syntax/style gates pass. A legal instrumented
  ten-wave defense retains 20 heart health, defeats 254 enemies and extracts six
  items to Planet 2. It exercised 39 cue types without unknown names or audio
  errors. [Defense](AUDIO-REVAMP/defense.json), [arrival](AUDIO-REVAMP/arrival.json).
  Time is accelerated; it does not prove natural audio pacing or listening feel.

The retained first slider fixture counted hidden controls; that claim was
superseded by actual visible geometry. The next Debug fixture omitted opening
its mobile inspector and timed out; the corrected test uses the real inspector.
Both records remain beside the passing evidence. These were fixture defects.

Native audio input is unavailable to this agent: an attempted local WAV audition
returned an explicit unsupported-audio response. Waveform and browser output
checks are objective evidence, not a listening claim. Automated vocal screening
will supplement the generated music review; final subjective listening and
physical-phone audio remain explicitly separate owner/device acceptance.
