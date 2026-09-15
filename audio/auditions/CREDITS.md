# Planet music approval drafts

Five new arrangements of owner-supplied musical references, generated locally
on 2026-09-15 with ACE-Step 1.5 turbo. These are **not approved game music**.
The nine existing soundtrack files and their runtime selection are unchanged.

| Draft | Planet | Owner reference |
|---|---|---|
| First Light Orchard | Garden World | Fun Mario-Like Planet Song |
| Coral Canopy | Canopy World | Tropical World |
| Amber Caravan | Dune World | Desert Boss Fight |
| Aurora Observatory | Cryosphere | Planet 1 Song |
| Ember Orbit | Molten World | Cinematic Trailer / Boss Fight |

Every prompt requests instruments only, with `[Instrumental]` lyrics. The
agent cannot hear these outputs. Playback, continuity and level measurements
do not certify musical quality or absence of voices. Owner listening approval
is required before any game integration.

## Generation provenance

- [ACE-Step 1.5 model card](https://huggingface.co/ACE-Step/Ace-Step1.5), MIT.
- [Comfy-Org checkpoint source](https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files/tree/694a9723ff772285c73f0700caacf944d3f02f8d/checkpoints).
- ComfyUI source commit `36da3ff763687eab86a35e1019995dd1fb369b0d`.
- The local reference-only checkpoint retains the original diffusion, VAE and
  Qwen text-encoder tensors, omitting the unused audio-code planner. It is
  6,316,877,444 bytes, SHA-256
  `bca0bfde54bc7177dc5939ca9e4fc94314b919f084044cd647347cdeac9bbd47`.
  This is a subset hash, not the full upstream checkpoint hash.
- Local loader fixes initialize the absent planner as `None`, permit its absence
  during encoder option changes, and reject audio-code generation without it.
- The native ReferenceTimbreAudio node uses cover conditioning. The full
  96-second owner excerpt (starting at 16 seconds) drives each new arrangement.
  These are reference-derived arrangements, not claims of unrelated melodies.
- Euler/simple, 8 steps, CFG 1, AuraFlow shift 3, denoise 1. VAE decoding is tiled.
- Exact prompts, seeds, reference/asset hashes and levels: [manifest](manifest.json).
- Repeatable local scripts: `tools/generate-planet-auditions.py` and
  `tools/master-planet-auditions.py`. Model weights remain outside the game.

Before lossless export, 9 dB of headroom prevents float decoder peaks from
clipping in PCM. Mastering uses only static gain and short edge fades, V0 MP3 encoding, and
metadata replacement. No denoising, pitch shift or compressor is used.
Earlier 32-second-reference takes were rejected for long quiet tails and are
retained privately with their generation records; they are not published here.
