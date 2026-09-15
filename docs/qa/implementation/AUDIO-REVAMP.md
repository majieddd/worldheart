# YuE2 soundtrack and sound feedback

Active 2026-09-15. Owner: Codex. Branch: `feature/yue2-audio-revamp`, based on
V2 `309aaa7` plus the prior documentation closeout. Publication remains V2 only.

| Item | Scope | Status | Acceptance |
|---|---|---|---|
| U136 | Exact video workflow, isolated local YuE2 generation, soundtrack and provenance | Active | Pinned runtime/model, actual instrumentals, no vocals, listening/waveform checks, documented rights |
| U137 | Responsive engine, buses, bounded voices, spatial feedback and mechanic cues | Planned | Audible coverage, clean lifecycle, no duplicate feedback, measured combat cost |
| U138 | Music transitions, ambience, mobile unlock, mix controls and Debug audition | Planned | Browser interaction, pause/visibility recovery, settings persistence, compact touch layout |
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
