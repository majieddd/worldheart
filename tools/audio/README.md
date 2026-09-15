# Local audio authoring

The game is a static site. No Python, model, GPU inference or Comfy server is
required by a player. Only the compressed delivery assets enter `audio/`.

## Exact model route

The [reference video](https://www.youtube.com/watch?v=9RtywbN--QE) uses native
ComfyUI YuE2 nodes. This project uses the full BF16 checkpoint, not another music
generator. `music-briefs.json` pins the model, checkpoint hash and runtime commit.
The [video workflow](https://github.com/user-attachments/files/32133499/yue2_full.json)
provides the node sequence. Reference audio encoding is unused: inputs are
original instrumental style/arrangement instructions, not an existing song.

The working local installation is in the sibling `worldheart-audio-tools/`
directory: isolated Python 3.12, CUDA PyTorch 2.10 and ComfyUI 0.35.0 at the
pinned commit. The BF16 file belongs in `ComfyUI/models/checkpoints/` and has
SHA-256 `33765adbf9813c9a50318218760b2fd819a319862460a04884607581961c6fee`.
See `docs/qa/implementation/AUDIO-REVAMP/runtime-freeze.txt` for exact packages.
Keep weights outside Git and verify a fresh download against this hash.

Run the isolated interpreter from the ComfyUI directory:

```
../.venv/Scripts/python.exe main.py --listen 127.0.0.1 --port 8188 --disable-all-custom-nodes --reserve-vram 1
```

From the game repository:

```
python tools/audio/generate-yue2.py --track explore
../worldheart-audio-tools/.venv/Scripts/python.exe tools/audio/master-music.py explore SOURCE.flac RECEIPT_DIRECTORY
../worldheart-audio-tools/.venv/Scripts/python.exe tools/audio/screen-vocals.py audio/explore.mp3 --out artifacts/audio-revamp/new-screen.json
python tools/audio/finalize-provenance.py SCREEN_REPORTS...
```

Resolve `SOURCE.flac` from the successful receipt's `history.json`, not a guessed
filename. Requests and history are retained under `artifacts/audio-revamp/generation/`.
Never replace a rejected result silently. Archive its hash/report and use a new
seed or an explicit brief revision. Pristine FLACs are retained locally before
mastering. Finalization requires a matching delivered hash and passing screen
for all six states, then copies generation receipts into the tracked QA folder.

Mastering applies slow eight-second phrase leveling capped at six dB, a 1.6s
equal-power wrap and two-pass normalization targeting -20 LUFS and -2 dBTP.
It preserves remaining dynamics and records measured values instead of assuming
the target was achieved. Delivery is stereo 48 kHz, 192 kbit/s MP3. A mathematical
wrap avoids a hard sample discontinuity; musical phrasing still needs listening.

The [MIT AST AudioSet model](https://huggingface.co/MIT/ast-finetuned-audioset-10-10-0.4593)
screens overlapping ten-second windows at five-second intervals. The conservative
0.12 rejection threshold was fixed before the full soundtrack screen. Scores
are event-classifier outputs, not calibrated probabilities or proof of no voice.
Human listening remains an acceptance step, particularly on headphones and phones.

## Effects and runtime checks

`node tools/audio-build.mjs` renders the original nonvocal effects bank with
FFmpeg. Recipes are in `design.mjs`; it uses no recordings or external samples.
The generated `js/audio-bank.js` describes every exact clip and file hash.
It does not rewrite the soundtrack or its credits.

Run the normal repository gates and these browser tools with the repository's
existing Playwright dependency wrapper and `WH_BASE_URL` pointed at the build:

```
node artifacts/cosmic-landforms/run.mjs tools/audio-qa.mjs OUTPUT_DIRECTORY
node artifacts/cosmic-landforms/run.mjs tools/audio-score-qa.mjs OUTPUT_DIRECTORY
node artifacts/cosmic-landforms/run.mjs tools/audio-lifecycle.mjs OUTPUT_DIRECTORY
```

The first checks the actual game/lobby/Debug interface. The second uses real
delivered songs in a small component fixture to isolate music output, hashes,
loops and mix controls. The third deliberately intercepts synthetic test music
for fault injection; it is never a claim about listening to the generated score.
Release the authoring GPU cache before rendered performance testing.

YuE2 model weights are CC BY-NC 4.0. This workflow records their noncommercial
restriction and does not assert commercial output rights. See `audio/README.md`
and `audio/music-provenance.json` for attribution and acceptance boundaries.
