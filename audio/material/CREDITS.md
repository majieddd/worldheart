# Material audio listening draft

The normal game uses its restored procedural audio. This opt-in comparison
reworks 16 cue types (42 sample variants). It is awaiting owner listening.
Other game cues retain their original synthesis with a gentler high shelf.
The separate original 48-second piano sketch is not the game's soundtrack.

## Sources

- Kenney, [Impact Sounds](https://kenney.nl/assets/impact-sounds), CC0.
  Source archive SHA-256: 029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8.
  Material bodies, footfalls and contact transients. License included.
- Simon Dalzell / Ivy Audio, Versilian Studios, [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE), CC0.
  Upright piano soft layer; upstream commit 440300901dfe9275fd84e0b7763af1f8443ae62e.
  Five source notes, exact URLs and hashes in manifest.json. License included.

Build with tools/build-material-audio.py (Python, numpy, FFmpeg). This validates
source hashes, renders short lossless mono PCM variations with headroom and
exports an original piano arrangement. There is no vocal generation, choir,
voice recording, continuous noise layer or Nintendo recording/melody in the
build recipe. The piano phrases have literal digital silence between them.

## What has and has not been established

Source provenance, waveform bounds, decoding, output, lifecycle and live delivery
can be measured. Those measurements cannot establish pleasantness or perceived
vocal absence. The implementing session cannot listen to audio. The owner's
ears remain the acceptance gate; the rejected earlier pass showed why.

The direction draws from Nintendo's discussion of material textures and
repeatable feedback in [Ask the Developer, Tears of the Kingdom, part 4](https://www.nintendo.com/us/whatsnew/ask-the-developer-vol-9-the-legend-of-zelda-tears-of-the-kingdom-part-4/).
This is inspiration for a new material-based draft, not a claim to match the
recording quality, spatial design or scope of Nintendo's sound system.
