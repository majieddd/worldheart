# Audio restoration and material sound retry

The next owner review is implemented in [AUDIO-FEEDBACK.md](AUDIO-FEEDBACK.md),
V2 023a70b. Its soundtrack and effects supersede the first comparison below;
the rejected piano sketch has been removed. This ledger retains that history.

Active 2026-09-15. Owner: Codex, `feature/audio-restoration`.

| Item | State | Scope |
|---|---|---|
| U140 | Published / verified | Restore every pre-revamp runtime, asset and audio UI change; V2 033d3e3 |
| U141 | Published / verified | Separate material-based comparison, with instrument-only piano sketch; V2 5577df3 |
| U142 | Open | Owner listening acceptance; do not treat classifier scores as proof of no vocals or pleasant sound |

The owner rejected U136-U139 after listening: vocals, sharp/tinny effects and
static-like ambience. This supersedes its prior automated acceptance. Those
records are retained as historical machine checks, not evidence of sound quality.
The previous audio at `c872a07` is the restoration target. Gameplay/mobile work
predating the sound pass remains intact. Main is not a publication target.

The retry takes inspiration from Tears of the Kingdom's material texture,
satisfying repeatable interactions, space and believable distance. It will not
copy Nintendo recordings or melodies. The restored game remains the default;
the new direction must be separately auditionable before another broad replacement.

Rollback local verification: 334 tests, 96 source modules, style gate, all 106
default runtime assets matching c872a07, generated mirrors and six browser
checks on the reported Io/seed configuration pass. The fixture followed the
world inspector's Play this seed link to its actual start controls. Public V2
then passed the same six checks. Retained local fixture failures were a stopped server and an attempt
to press the hidden Begin button while still in the world inspector.

Rollback published by [Pages action 34946151101](https://github.com/majieddd/worldheart/actions/runs/34946151101).
Public build identity: 033d3e3c3582b5328e3809e1a1bd19f7bb5522bd.
Main stays 1374122d1109919a5fab10b69fefdfb80308eb6e.

## Separate listening draft

`audio-lab.html` presents Previous/Draft buttons for 16 cue types, with 42
material and piano sample variants. The normal game stays on the restored
AudioEngine. Only `?sound=material` installs the comparison before boot shares
the engine with combat and input. It isn't saved as a preference. Existing
game cues outside these 16 retain their old recipes with a gentler treble bus.
The trial disables the old continuous ambient pad/wind. It requires the served
asset folders; the standalone export's default audio remains self-contained.

The optional 48-second piano sketch uses five CC0 upright piano recordings and
an original note arrangement. No YuE2 or vocal model is used in this draft.
Piano plays only in the audition page; the trial game does not start music.
Kenney CC0 impact materials supply wood, plate, body and footstep sounds.
Lossless 48kHz PCM avoids another lossy encoding generation; effects load once
(3.49MB), and piano loads only on request (4.61MB). Twelve sampled voices and
per-cue limits bound combat work; end callbacks disconnect nodes. A failed
sample download leaves the old cue usable rather than delaying the game.

[Nintendo's sound discussion](https://www.nintendo.com/us/whatsnew/ask-the-developer-vol-9-the-legend-of-zelda-tears-of-the-kingdom-part-4/)
informed material texture and repeatable feedback. This does not copy Zelda
assets or music, or claim equivalent sound quality. See the shipped
[credits and immutable source hashes](../../../audio/material/CREDITS.md),
`tools/build-material-audio.py` and the output manifest for reproducibility.

Local instrumented browser checks cover all 16 outputs, simultaneous playback,
no clipping in the measured burst, cache reuse, stop during pending music load,
mute, context suspend/resume/disposal, failure fallback, default isolation,
touch startup, 375/768/1280px layouts and measured text contrast. The implementing
agent visually inspected the mobile comparison. It cannot hear the audio.
The first pass caught a test that hadn't established keyboard modality and a
piano sketch with less than the intended 30% silence. The fixture now presses
Tab; piano note tails were shortened, retaining the failed evidence.
An adversarial maximum-volume burst then exceeded the output limit. The draft
now has a soft peak ceiling that stays linear below 0.72, with 2x oversampling;
the final output is measured after that ceiling. The failed maximum-volume
report is retained alongside the corrected run.

U142 remains open: owner listening on speakers/headphones and a physical phone,
perceived warmth/impact, comfortable relative levels, absence of perceived
voice-like content and whether this direction merits expanding beyond 16 cues.
Waveform tests and source provenance are not substitutes for this listening.

## Publication and handoff

Published V2 commit: `5577df38512785007e5e2abdcbf076636660694e`.
[Successful Pages action 34948123140](https://github.com/majieddd/worldheart/actions/runs/34948123140),
[draft PR #44](https://github.com/majieddd/worldheart/pull/44),
[live sound comparison](https://majieddd.github.io/worldheart/v2/audio-lab.html).
The default game continues to use its restored audio. Main is still `1374122`.

Final gates: 337 tests, 98 source modules, style, 116 generated mirrors, 41 local
and 41 public instrumented browser checks. Public verification also compared
every published preview asset and recorded production runtime hash to its Git
blob, and verified all 13 removed audio assets/modules return 404: 166 checks.
Reports: `AUDIO-RESTORATION/material-local.json`, `material-public.json` and
`public-identity.json`. The evidence-only closeout commit does not alter the
deployed runtime. No subjective listening or physical-device approval is claimed.
