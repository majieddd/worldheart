# Owner-feedback effects revision

The opt-in comparison preserves Menu Click, Build Tower, Blocked Strike, Mortar,
grass step and hard step exactly at the PCM segment level. approved-clips.json
contains their accepted hashes. The bank now contains 24 contextual cue types
and 65 variations. Tower shot and lobber use the original procedural recipes;
explosion retains its old noise/sub structure at lower frequencies.

Blade contact varies with sword, spear, twin blades, wooden equipment and
flesh/armor/wood targets. Five creature reactions have separate pitches and
durations. Short original mallet-like reward motifs replace the piano cues.
The pickup lasts 0.20 seconds. The rejected piano sketch is removed.

## Sources

- [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds), CC0.
  Archive SHA-256: 029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8.
- [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio), CC0.
  Archive SHA-256: 6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b.
- Original synthesized blast bodies, creature cries and reward motifs. No
  commercial-game audio recordings, melodies, voice model or continuous bed.

Build: tools/build-material-audio.py, Python/numpy/FFmpeg. New sample tails use
a smoothed gate and explicit fades; no compressor makeup or room-noise boost.
Accepted clips retain their original processing. Output is lossless mono 48kHz
PCM, with per-voice cleanup, bounded simultaneous samples and a soft peak ceiling.

The developer cannot hear this session's output. Source identity, waveform
headroom, silence and browser playback are measured, not evidence of perceived
warmth or voice absence. Owner listening remains the subjective acceptance.
