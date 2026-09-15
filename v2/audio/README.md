# Worldheart audio assets

Six original instrumental pieces were generated locally with the native
[ComfyUI YuE2 workflow](https://github.com/Comfy-Org/ComfyUI) demonstrated in the
[owner's reference video](https://www.youtube.com/watch?v=9RtywbN--QE).
The pinned [Comfy-Org/YuE2 checkpoint](https://huggingface.co/Comfy-Org/YuE2)
derives from [m-a-p/YuE2-3B](https://huggingface.co/m-a-p/YuE2-3B).

The model weights use **CC BY-NC 4.0**. This preview records that noncommercial
restriction; it does not assert commercial output rights. Code is Apache 2.0.
No copyrighted reference song or vocal performance was supplied. Track titles,
prompts, seeds, runtime/model revisions, original and delivered hashes,
mastering and vocal-screen results are in `music-provenance.json` and the
[repository audio ledger](https://github.com/majieddd/worldheart/blob/feature/yue2-audio-revamp/docs/qa/implementation/AUDIO-REVAMP.md).
The original FLACs and model stay in the local authoring workspace, not the web
runtime. The game streams 48 kHz stereo MP3s without running a model on players' devices.

`feedback-bank.mp3` contains 84 original nonvocal cues with 171 variations,
reproducible with `node tools/audio-build.mjs` and FFmpeg (libmp3lame).
No recordings, speech or third-party samples. Source: `tools/audio/design.mjs`.
These effects are authored sound design, not YuE2 output.

The instrumental score is screened with the MIT AudioSet AST classifier and
measured for output level and clipping. This is automated evidence, not a
human listening guarantee. Audition every track and effect in Debug World's
Sound studio; the game and lobby also have separate mix controls.
